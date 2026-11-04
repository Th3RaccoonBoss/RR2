import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { business } from "../src/data.mjs";
import { legacyRedirects } from "../src/legacy-routes.mjs";
import { buildManifest, pages } from "../src/pages.mjs";
import { renderStaticHeaders } from "../src/platform-config.mjs";
import { searchConfig } from "../src/search-config.mjs";
import {
  ensureWebpDerivatives,
  loadWebpManifest,
  webpAvailability
} from "./encode-images.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist");

// Refresh WebP derivatives before page generation. This is a cheap
// content-hash comparison when nothing changed; stale sources are re-encoded
// through headless Chromium (see scripts/encode-images.mjs).
const encodeSummary = await ensureWebpDerivatives({
  documents: pages.map((page) => page.html)
});
if (encodeSummary.skippedNoChromium || encodeSummary.failed) {
  console.warn(
    "build: WebP derivatives are incomplete; pages fall back to JPEG/PNG where derivatives are missing."
  );
}

const webpAssets = webpAvailability(await loadWebpManifest());

function attributeOf(tag, name) {
  const match = tag.match(
    new RegExp(`(?<![-\\w])${name}\\s*=\\s*"([^"]*)"`, "i")
  );
  return match ? match[1] : null;
}

// Translate a JPEG/PNG srcset into its WebP twin. Returns null unless every
// candidate has a derivative, so a picture never mixes half-covered sets.
function webpSrcsetFor(srcset) {
  const candidates = srcset
    .split(",")
    .map((candidate) => candidate.trim())
    .filter(Boolean);
  const out = [];
  for (const candidate of candidates) {
    const [url, ...descriptorParts] = candidate.split(/\s+/);
    const available = webpAssets.get(url);
    if (!available) return null;
    let descriptor = descriptorParts.join(" ");
    if (/^\d+w$/.test(descriptor) && available.width) {
      descriptor = `${available.width}w`;
    }
    out.push(descriptor ? `${available.webpUrl} ${descriptor}` : available.webpUrl);
  }
  return out.join(", ");
}

function webpSourceForImg(imgTag) {
  const srcset = attributeOf(imgTag, "srcset");
  const sizes = attributeOf(imgTag, "sizes");
  const src = attributeOf(imgTag, "src");
  let webpSet = srcset ? webpSrcsetFor(srcset) : null;
  const withSizes = webpSet && sizes && /\d+w/.test(webpSet) ? sizes : null;
  if (!webpSet && src) {
    const available = webpAssets.get(src);
    if (available) webpSet = available.webpUrl;
  }
  if (!webpSet) return null;
  return `<source type="image/webp" srcset="${webpSet}"${withSizes ? ` sizes="${withSizes}"` : ""}>`;
}

// Add a parallel WebP <source> ahead of every JPEG/PNG source and the <img>
// fallback inside an existing <picture>. Idempotent: pictures that already
// declare a WebP source are left untouched.
function enrichPicture(block) {
  if (block.includes('type="image/webp"')) return block;
  return block.replace(/<source\b[^>]*>|<img\b[^>]*>/g, (tag) => {
    if (tag.startsWith("<source")) {
      const srcset = attributeOf(tag, "srcset");
      const webpSet = srcset ? webpSrcsetFor(srcset) : null;
      if (!webpSet) return tag;
      const media = attributeOf(tag, "media");
      const sizes = attributeOf(tag, "sizes");
      return `<source${media ? ` media="${media}"` : ""} type="image/webp" srcset="${webpSet}"${sizes ? ` sizes="${sizes}"` : ""}>${tag}`;
    }
    const webpSource = webpSourceForImg(tag);
    return webpSource ? `${webpSource}${tag}` : tag;
  });
}

// Wrap a bare <img> in a layout-inert <picture> carrying the WebP source.
// display:contents keeps the img's containing block unchanged so existing
// width/height:100% and aspect-ratio styling behaves exactly as before.
function wrapBareImage(imgTag) {
  const webpSource = webpSourceForImg(imgTag);
  if (!webpSource) return imgTag;
  return `<picture style="display:contents">${webpSource}${imgTag}</picture>`;
}

function transformImageMarkup(html) {
  return html.replace(
    /<picture\b[^>]*>[\s\S]*?<\/picture>|<img\b[^>]*>/g,
    (token) =>
      token.startsWith("<picture") ? enrichPicture(token) : wrapBareImage(token)
  );
}

// The homepage hero is the LCP element: make its fetch priority explicit.
function prioritizeHomeHero(html) {
  return html.replace(/<img\b[^>]*class="home-hero__image"[^>]*>/, (tag) => {
    let out = tag;
    if (!/(?<![-\w])fetchpriority\s*=/i.test(out)) {
      out = out.replace(/^<img/, '<img fetchpriority="high"');
    }
    if (!/(?<![-\w])loading\s*=/i.test(out)) {
      out = out.replace(/^<img/, '<img loading="eager"');
    }
    return out;
  });
}

// Version URLs by the exact emitted bytes so returning visitors cannot mix
// new HTML with a cached stylesheet or application module from an older release.
// Keep the existing asset paths and hosting/security cache policies intact.
const stylesheet = minifyCss(
  [
    await readFile(join(root, "src", "styles.css"), "utf8"),
    await readFile(join(root, "src", "compact.css"), "utf8")
  ].join("\n")
);
const mainScript = await readFile(join(root, "src", "main.js"), "utf8");
const assetVersion = (content) => createHash("sha256").update(content).digest("hex").slice(0, 16);
const versionAssetReferences = (html) => html
  .replaceAll('href="/assets/styles.css"', `href="/assets/styles.css?v=${assetVersion(stylesheet)}"`)
  .replaceAll('src="/assets/main.js"', `src="/assets/main.js?v=${assetVersion(mainScript)}"`);

const outputPages = pages.map((page) => ({
  ...page,
  html: versionAssetReferences(transformImageMarkup(
    page.path === "/" ? prioritizeHomeHero(page.html) : page.html
  ))
}));

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

function outputPath(page) {
  if (page.output) return join(dist, page.output);
  if (page.path === "/") return join(dist, "index.html");
  return join(dist, page.path.replace(/^\/|\/$/g, ""), "index.html");
}

for (const page of outputPages) {
  const target = outputPath(page);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, page.html, "utf8");
}

await mkdir(join(dist, "assets", "images"), { recursive: true });
await mkdir(join(dist, "assets", "projects"), { recursive: true });
await mkdir(join(dist, "assets", "editorial-v2"), { recursive: true });
await mkdir(join(dist, "assets", "vendor"), { recursive: true });
// The base stylesheet and compact module share tokens and utility classes.
// Conservative minification: comments and whitespace only — no rule
// rewriting — so the emitted sheet is byte-lean but semantically identical.
function minifyCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([{}:;,>])\s*/g, "$1")
    .replace(/;}/g, "}")
    .trim();
}

await writeFile(join(dist, "assets", "styles.css"), stylesheet, "utf8");
await writeFile(join(dist, "assets", "main.js"), mainScript, "utf8");
await cp(
  join(
    root,
    "node_modules",
    "@vercel",
    "analytics",
    "dist",
    "index.mjs"
  ),
  join(dist, "assets", "vendor", "vercel-analytics.mjs")
);
await cp(
  join(root, "node_modules", "@vercel", "analytics", "LICENSE"),
  join(dist, "assets", "vendor", "vercel-analytics.LICENSE.txt")
);
await cp(join(root, "public", "assets", "fonts"), join(dist, "assets", "fonts"), {
  recursive: true
});

const projectAssets = new Set(
  outputPages.flatMap((page) =>
    [...page.html.matchAll(/\/assets\/projects\/([^"'?\s]+)/g)].map(
      (match) => match[1]
    )
  )
);

for (const name of projectAssets) {
  await cp(
    join(root, "public", "assets", "projects", name),
    join(dist, "assets", "projects", name)
  );
}

const editorialAssets = new Set(
  outputPages.flatMap((page) =>
    [...page.html.matchAll(/\/assets\/editorial-v2\/([^"'?\s]+)/g)].map(
      (match) => match[1]
    )
  )
);

for (const name of editorialAssets) {
  await cp(
    join(root, "public", "assets", "editorial-v2", name),
    join(dist, "assets", "editorial-v2", name)
  );
}
await cp(
  join(root, "public", "assets", "brand-pattern.svg"),
  join(dist, "assets", "brand-pattern.svg")
);
await cp(
  join(root, "public", "assets", "favicon.svg"),
  join(dist, "assets", "favicon.svg")
);
await cp(
  join(root, "public", "assets", "favicon-48.png"),
  join(dist, "assets", "favicon-48.png")
);
await cp(
  join(root, "public", "assets", "favicon-512.png"),
  join(dist, "assets", "favicon-512.png")
);
await cp(
  join(root, "public", "assets", "apple-touch-icon.png"),
  join(dist, "assets", "apple-touch-icon.png")
);
await cp(
  join(
    root,
    "public",
    "assets",
    "raccoon-restoration-logo-bahnschrift-480.png"
  ),
  join(
    dist,
    "assets",
    "raccoon-restoration-logo-bahnschrift-480.png"
  )
);
await cp(
  join(
    root,
    "public",
    "assets",
    "raccoon-restoration-logo-bahnschrift-960.png"
  ),
  join(
    dist,
    "assets",
    "raccoon-restoration-logo-bahnschrift-960.png"
  )
);
await cp(
  join(root, "public", "assets", "footer-brand-pattern.jpg"),
  join(dist, "assets", "footer-brand-pattern.jpg")
);
await cp(
  join(root, "public", "assets", "raccoon-restoration-slogan-social.png"),
  join(dist, "assets", "raccoon-restoration-slogan-social.png")
);

const imageAssets = new Set(
  outputPages.flatMap((page) =>
    [...page.html.matchAll(/\/assets\/images\/([^"'?\s]+)/g)].map(
      (match) => match[1]
    )
  )
);

for (const name of imageAssets) {
  await cp(
    join(root, "public", "assets", "images", name),
    join(dist, "assets", "images", name)
  );
}

// Copy every referenced WebP derivative, including root-level /assets/ files
// (e.g. the logo) that the directory-scoped loops above do not cover.
const webpAssetPaths = new Set(
  outputPages.flatMap((page) =>
    [...page.html.matchAll(/\/assets\/([^"'?\s]+\.webp)/g)].map(
      (match) => match[1]
    )
  )
);

for (const name of webpAssetPaths) {
  const target = join(dist, "assets", name);
  await mkdir(dirname(target), { recursive: true });
  await cp(join(root, "public", "assets", name), target);
}

const sitemapPages = outputPages.filter(
  (page) => !page.noSitemap && !page.html.includes('name="robots" content="noindex')
);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapPages
  .map(
    (page) => `  <url>
    <loc>${business.siteUrl}${page.path}</loc>
    <lastmod>${page.lastModified || searchConfig.defaultLastModified}</lastmod>
  </url>`
  )
  .join("\n")}
</urlset>
`;

await writeFile(join(dist, "sitemap.xml"), sitemap, "utf8");
await writeFile(
  join(dist, "robots.txt"),
  `User-agent: OAI-SearchBot
Allow: /

User-agent: OAI-AdsBot
Allow: /

User-agent: *
Allow: /

Sitemap: ${business.siteUrl}/sitemap.xml
`,
  "utf8"
);
await writeFile(
  join(dist, `${searchConfig.indexNowKey}.txt`),
  searchConfig.indexNowKey,
  "utf8"
);

await writeFile(
  join(dist, "_headers"),
  renderStaticHeaders(),
  "utf8"
);

await writeFile(
  join(dist, "_redirects"),
  `${legacyRedirects
    .map(
      ({ source, destination, status }) =>
        `${source} ${destination} ${status}`
    )
    .join("\n")}
`,
  "utf8"
);

await writeFile(
  join(dist, "content-manifest.json"),
  JSON.stringify(buildManifest, null, 2),
  "utf8"
);

console.log(
  `Built ${pages.length} pages, ${sitemapPages.length} indexable URLs, and production assets in dist/.`
);

// Approved editorial and credential assets are source-controlled, not copied from a preview build.
for (const directory of ["credentials", "resources"]) {
  await cp(join(root, "public", "assets", directory), join(dist, "assets", directory), { recursive: true });
}
