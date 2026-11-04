import { access, readFile, readdir, stat } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  legacyRedirects,
  legacyRetirements
} from "../src/legacy-routes.mjs";
import { createVercelConfig } from "../src/platform-config.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist");
const htmlFiles = [];
const failures = [];
const warnings = [];
const titleOwners = new Map();
const descriptionOwners = new Map();
const routeRecords = [];
const inboundRoutes = new Map();
const idPixelScriptSrc =
  "https://cdn.idpixel.app/v1/idp-analytics-6a57c20f5c012440693ab2b9.min.js";

async function walk(directory) {
  for (const entry of await readdir(directory)) {
    const path = join(directory, entry);
    const info = await stat(path);
    if (info.isDirectory()) await walk(path);
    else if (extname(path) === ".html") htmlFiles.push(path);
  }
}

await walk(dist);

function targetFor(href) {
  const clean = href.split("#")[0].split("?")[0];
  if (!clean || clean.startsWith("http") || clean.startsWith("mailto:") || clean.startsWith("tel:")) {
    return null;
  }
  if (clean.startsWith("/assets/")) return join(dist, clean);
  if (clean === "/") return join(dist, "index.html");
  if (clean.endsWith(".html")) return join(dist, clean);
  return join(dist, clean, "index.html");
}

for (const file of htmlFiles) {
  const html = await readFile(file, "utf8");
  const label = relative(dist, file);
  const route =
    label === "index.html"
      ? "/"
      : label === "404.html"
        ? "/404.html"
        : `/${label.replace(/\/index\.html$/, "/")}`;
  const noindex = /<meta name="robots" content="[^"]*noindex/i.test(html);
  const titles = [...html.matchAll(/<title>(.*?)<\/title>/g)];
  const descriptions = [
    ...html.matchAll(/<meta name="description" content="([^"]+)"/g)
  ];
  const canonicals = [...html.matchAll(/<link rel="canonical" href="([^"]+)"/g)];
  const h1s = [...html.matchAll(/<h1[\s>]/g)];
  const imagesWithoutDimensions = [
    ...html.matchAll(/<img\b(?![^>]*\bwidth=)(?![^>]*\bheight=)[^>]*>/g)
  ];
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/)?.[1] || "";
  const mainText = main
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const wordCount = mainText ? mainText.split(" ").length : 0;
  const idPixelLoads = html.split(idPixelScriptSrc).length - 1;
  routeRecords.push({ route, label, noindex, wordCount });

  if (titles.length !== 1) failures.push(`${label}: expected exactly one title`);
  if (descriptions.length !== 1)
    failures.push(`${label}: expected exactly one meta description`);
  if (canonicals.length !== 1)
    failures.push(`${label}: expected exactly one canonical URL`);
  if (h1s.length !== 1) failures.push(`${label}: expected exactly one h1, found ${h1s.length}`);
  if (!html.includes('href="#main"'))
    failures.push(`${label}: missing skip link`);
  if (!html.includes('type="application/ld+json"'))
    failures.push(`${label}: missing structured data`);
  if (idPixelLoads !== 1)
    failures.push(
      `${label}: expected exactly one IDPixel loader, found ${idPixelLoads}`
    );
  if (!html.includes(`<script defer src="${idPixelScriptSrc}"`))
    failures.push(`${label}: IDPixel loader must be deferred`);
  if (imagesWithoutDimensions.length)
    failures.push(`${label}: image missing explicit dimensions`);
  if (duplicateIds.length)
    failures.push(`${label}: duplicate id values ${duplicateIds.join(", ")}`);
  if (/\[(VERIFICATION REQUIRED|PLACEHOLDER|TODO)\]/i.test(html))
    failures.push(`${label}: public placeholder token found`);
  if (/Strong Roofs\. Safe Homes\. Done Right\./i.test(html))
    failures.push(`${label}: legacy primary slogan found`);
  if (/class="breadcrumbs"[\s\S]{0,600}&lt;br/i.test(html))
    failures.push(`${label}: escaped line-break markup found in breadcrumb`);
  if (
    /(production operator|final legal review recommended|this new site|being configured|generated editorial imagery|owner-supplied fleet)/i.test(
      mainText
    )
  )
    failures.push(`${label}: internal production language found in public copy`);

  if (titles.length === 1) {
    const title = titles[0][1];
    const owner = titleOwners.get(title);
    if (owner) failures.push(`${label}: duplicate title also used by ${owner}`);
    titleOwners.set(title, label);
    if (title.length < 25 || title.length > 65)
      warnings.push(`${label}: title length is ${title.length} characters`);
  }

  if (descriptions.length === 1) {
    const description = descriptions[0][1];
    const owner = descriptionOwners.get(description);
    if (owner)
      failures.push(`${label}: duplicate meta description also used by ${owner}`);
    descriptionOwners.set(description, label);
    if (!noindex && (description.length < 60 || description.length > 170))
      warnings.push(
        `${label}: meta description length is ${description.length} characters`
      );
  }

  if (!noindex && wordCount < 100)
    warnings.push(`${label}: indexable main content has only ${wordCount} words`);
  if (route === "/" && wordCount > 650)
    failures.push(`${label}: homepage copy exceeds the 650-word density budget`);
  if (route.startsWith("/services/") && route !== "/services/" && wordCount > 380)
    failures.push(`${label}: service-page copy exceeds the 380-word density budget`);
  if (route === "/contact/") {
    const requiredLeadFields = [
      "first_name",
      "last_name",
      "phone",
      "email",
      "street_address",
      "city",
      "postal_code",
      "property_type",
      "service",
      "project_timing",
      "consent"
    ];
    if (!html.includes('data-form-type="quote_request"'))
      failures.push(`${label}: structured quote form is missing`);
    if (html.includes("data-form-fallback"))
      failures.push(`${label}: quote form was replaced by a contact-only fallback`);
    for (const name of requiredLeadFields) {
      if (!html.includes(`name="${name}"`))
        failures.push(`${label}: quote form is missing ${name}`);
    }
  }

  const labelledByRefs = [
    ...html.matchAll(/\saria-labelledby="([^"]+)"/g)
  ].flatMap((match) => match[1].split(/\s+/));
  for (const id of labelledByRefs) {
    if (!ids.includes(id))
      failures.push(`${label}: aria-labelledby references missing id ${id}`);
  }

  const jsonLdBlocks = [
    ...html.matchAll(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g
    )
  ];
  let schemaTypes = [];
  for (const block of jsonLdBlocks) {
    try {
      const schema = JSON.parse(block[1]);
      schemaTypes = (schema["@graph"] || []).map((item) => item["@type"]);
    } catch {
      failures.push(`${label}: invalid JSON-LD`);
    }
  }
  if (route !== "/" && route !== "/404.html" && !schemaTypes.includes("BreadcrumbList"))
    failures.push(`${label}: missing BreadcrumbList schema`);
  if (html.includes('class="faq-list"') && !schemaTypes.includes("FAQPage"))
    failures.push(`${label}: visible FAQ content is missing FAQPage schema`);

  const refs = [
    ...html.matchAll(/(?:href|src)="([^"]+)"/g)
  ].map((match) => match[1]);
  for (const href of refs) {
    const cleanHref = href.split("#")[0].split("?")[0];
    if (cleanHref.startsWith("/")) {
      const normalizedRoute =
        cleanHref === "/" ||
        cleanHref.endsWith(".html") ||
        cleanHref.startsWith("/assets/")
          ? cleanHref
          : cleanHref.endsWith("/")
            ? cleanHref
            : `${cleanHref}/`;
      inboundRoutes.set(
        normalizedRoute,
        (inboundRoutes.get(normalizedRoute) || 0) + 1
      );
    }
    const target = targetFor(href);
    if (!target) continue;
    try {
      await access(target);
    } catch {
      failures.push(`${label}: broken internal reference ${href}`);
    }
  }

  if (html.includes("5-star") || html.includes("500+"))
    warnings.push(`${label}: review proof language requires verification`);
}

for (const record of routeRecords) {
  if (
    !record.noindex &&
    record.route !== "/" &&
    !inboundRoutes.has(record.route)
  ) {
    failures.push(`${record.label}: indexable page has no inbound internal link`);
  }
}

// Homepage image payload budget: what ONE visitor actually downloads.
// A <picture> offers several mutually exclusive candidates (art-directed
// mobile crop vs desktop landscape, WebP vs JPEG, srcset widths) and the
// browser fetches exactly one, so each <picture> contributes only its
// heaviest single candidate — summing every variant would measure a download
// that never happens and would penalise adding art direction. Images outside
// a <picture> are counted individually, still deduplicated, and a WebP twin
// supersedes the JPEG/PNG it replaces.
const homepageImageBudgetBytes = 900 * 1024;
const homeHtml = await readFile(join(dist, "index.html"), "utf8");
// The compact homepage must retain the production click-event contract.
const homeServiceLinks = [...homeHtml.matchAll(/<a\b[^>]*class="roof-service-row"[^>]*>/g)];
if (homeServiceLinks.length !== 4 || homeServiceLinks.some(([tag]) =>
  !tag.includes('data-event="service_card_click"') || !tag.includes('data-service="')
)) failures.push("index.html: compact service links must retain service click tracking");
for (const [scheme, event] of [["tel:", "phone_click"], ["mailto:", "email_click"]]) {
  const tag = homeHtml.match(new RegExp(`<a[^>]*href="${scheme}[^>]*data-position="home_contact"[^>]*>`))?.[0];
  if (!tag?.includes(`data-event="${event}"`)) failures.push(`index.html: homepage ${scheme} link must retain tracking`);
}

const imageUrlPattern = /^\/assets\/\S+\.(?:avif|gif|jpe?g|png|webp)$/i;
const urlsIn = (markup) => {
  const found = new Set();
  for (const match of markup.matchAll(/(?<![-\w])(?:src|srcset)\s*=\s*"([^"]*)"/g)) {
    for (const candidate of match[1].split(",")) {
      const url = candidate.trim().split(/\s+/)[0];
      if (imageUrlPattern.test(url)) found.add(url);
    }
  }
  return [...found];
};
const sizeOf = async (url) => {
  try {
    return (await stat(join(dist, url))).size;
  } catch {
    failures.push(`index.html: homepage-referenced image missing from dist: ${url}`);
    return 0;
  }
};

const pictureBlocks = [...homeHtml.matchAll(/<picture\b[\s\S]*?<\/picture>/gi)].map(
  (m) => m[0]
);
const pictureUrls = new Set(pictureBlocks.flatMap(urlsIn));
// Heaviest candidate a MODERN browser would fetch from each <picture>: legacy
// JPEG/PNG fallbacks are excluded when the same picture offers WebP (that is
// the whole point of the derivative pipeline), then the heaviest of the
// remaining art-direction/srcset candidates is charged to the budget.
const pictureRows = [];
for (const block of pictureBlocks) {
  const urls = urlsIn(block);
  const hasWebp = urls.some((url) => /\.webp$/i.test(url));
  const modern = hasWebp ? urls.filter((url) => /\.webp$/i.test(url)) : urls;
  let worst = null;
  for (const url of modern) {
    const bytes = await sizeOf(url);
    if (!worst || bytes > worst.bytes) worst = { url, bytes };
  }
  if (worst) pictureRows.push(worst);
}

const looseUrls = urlsIn(homeHtml).filter((url) => !pictureUrls.has(url));
const countedHomeImages = looseUrls.filter((url) => {
  const webpTwin = url.replace(/\.(?:jpe?g|png)$/i, ".webp");
  return webpTwin === url || !looseUrls.includes(webpTwin);
});
const homepageImageRows = [...pictureRows];
let homepageImageBytes = pictureRows.reduce((sum, row) => sum + row.bytes, 0);
for (const url of countedHomeImages) {
  const bytes = await sizeOf(url);
  homepageImageBytes += bytes;
  homepageImageRows.push({ url, bytes });
}
homepageImageRows.sort((a, b) => b.bytes - a.bytes);
console.log(
  `Homepage image payload: ${(homepageImageBytes / 1024).toFixed(1)} KiB across ${
    homepageImageRows.length
  } file(s), budget ${(homepageImageBudgetBytes / 1024).toFixed(0)} KiB. Top 5:`
);
for (const row of homepageImageRows.slice(0, 5)) {
  console.log(`  ${(row.bytes / 1024).toFixed(1).padStart(7)} KiB  ${row.url}`);
}
if (homepageImageBytes > homepageImageBudgetBytes) {
  failures.push(
    `index.html: homepage image payload ${(homepageImageBytes / 1024).toFixed(1)} KiB exceeds the ${(
      homepageImageBudgetBytes / 1024
    ).toFixed(0)} KiB budget`
  );
}

for (const required of [
  "sitemap.xml",
  "robots.txt",
  "_headers",
  "_redirects",
  "404.html",
  "assets/styles.css",
  "assets/main.js",
  "assets/vendor/vercel-analytics.mjs",
  "assets/vendor/vercel-analytics.LICENSE.txt"
]) {
  try {
    await access(join(dist, required));
  } catch {
    failures.push(`Missing build artifact: ${required}`);
  }
}

const mainScript = await readFile(join(dist, "assets", "main.js"), "utf8");
if (
  !mainScript.includes(
    'import { inject as injectVercelAnalytics } from "/assets/vendor/vercel-analytics.mjs";'
  ) ||
  !mainScript.includes('injectVercelAnalytics({ mode: "production" });')
) {
  failures.push(
    "assets/main.js: Vercel Web Analytics must be injected once outside local development"
  );
}

const generatedRoutes = new Set(routeRecords.map(({ route }) => route));
const redirectFile = await readFile(join(dist, "_redirects"), "utf8");
const vercelConfigPath = join(root, "vercel.json");

try {
  const actualVercelConfig = JSON.parse(
    await readFile(vercelConfigPath, "utf8")
  );
  const expectedVercelConfig = createVercelConfig();
  if (
    JSON.stringify(actualVercelConfig) !== JSON.stringify(expectedVercelConfig)
  ) {
    failures.push(
      "vercel.json is out of sync with the authoritative route and header configuration"
    );
  }
} catch (error) {
  failures.push(`Invalid or missing vercel.json: ${error.message}`);
}

for (const { source, destination, status } of legacyRedirects) {
  const expectedRule = `${source} ${destination} ${status}`;
  if (!redirectFile.split("\n").includes(expectedRule))
    failures.push(`Missing legacy redirect rule: ${expectedRule}`);
  if (generatedRoutes.has(source))
    failures.push(`Legacy redirect source is also generated as a page: ${source}`);
  if (!generatedRoutes.has(destination))
    failures.push(`Legacy redirect destination is not generated: ${destination}`);
}

for (const { source } of legacyRetirements) {
  if (generatedRoutes.has(source))
    failures.push(`Retired WordPress route is still generated: ${source}`);
}

if (warnings.length) {
  console.warn(`Warnings:\n${warnings.map((item) => `- ${item}`).join("\n")}`);
}

if (failures.length) {
  console.error(`Checks failed:\n${failures.map((item) => `- ${item}`).join("\n")}`);
  process.exit(1);
}

console.log(
  `Checked ${htmlFiles.length} HTML files: metadata, headings, structured data, dimensions, claims, and internal references passed.`
);
