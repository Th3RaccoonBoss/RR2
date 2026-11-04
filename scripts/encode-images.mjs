import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  unlink,
  writeFile
} from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// WebP derivative pipeline.
//
// For every .jpg/.png asset referenced by generated page markup, this module
// produces a sibling .webp derivative using headless Chromium's canvas encoder
// (the repository's approved build-time browser pattern; see
// scripts/capture-screenshots.mjs). Encoding is incremental: a manifest at
// public/assets/webp-manifest.json records the content hash of each source so
// unchanged images are never re-encoded. Derivatives that come out larger than
// their source are discarded and recorded as "kept-original".

const root = fileURLToPath(new URL("..", import.meta.url));
const publicRoot = join(root, "public");
export const manifestPath = join(publicRoot, "assets", "webp-manifest.json");

const PIPELINE_VERSION = 1;
const JPEG_QUALITY = 0.72;
const PNG_QUALITY = 0.9;
const ENCODABLE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png"]);

// Preserve the owner-approved comparison photos and authentic manufacturer
// artwork exactly as supplied. Full-size links and displayed images use the
// same original bytes; all other assets retain the existing WebP pipeline.
const PRESERVE_ORIGINAL_IMAGES = new Set([
  "/assets/credentials/owens-corning-preferred-contractor.png",
  "/assets/credentials/gaf-certified-residential-roofing-contractor.png",
  "/assets/resources/is-it-hail-damage/hail-vs-blistering-horizontal.jpg",
  "/assets/resources/is-it-hail-damage/hail-vs-blistering-vertical.png"
]);

// Sources whose WebP derivative is intentionally capped below intrinsic width
// (rendered slots never need the full-resolution encode). The derivative is
// written as `${basename}-${capWidth}w.webp` and the build transform swaps the
// srcset descriptor accordingly. Keys are asset URLs as they appear in markup.
export const CAPPED_WIDTHS = new Map([]);

const qualityFor = (url) =>
  extname(url).toLowerCase() === ".png" ? PNG_QUALITY : JPEG_QUALITY;

function isEncodableUrl(url) {
  return !PRESERVE_ORIGINAL_IMAGES.has(url) && ENCODABLE_EXTENSIONS.has(extname(url).toLowerCase());
}

export function webpUrlFor(url) {
  const cap = CAPPED_WIDTHS.get(url);
  const base = url.replace(/\.(?:jpe?g|png)$/i, "");
  return cap ? `${base}-${cap}w.webp` : `${base}.webp`;
}

function publicPathFor(assetUrl) {
  const candidate = resolve(publicRoot, assetUrl.replace(/^\/+/, ""));
  if (candidate !== publicRoot && !candidate.startsWith(`${publicRoot}${sep}`)) {
    return null;
  }
  return candidate;
}

// Collect /assets/... jpg+png URLs referenced from src/srcset attributes in
// the given HTML documents. og:image meta tags (content=), CSS backgrounds,
// inline SVG, and favicon links are intentionally out of scope.
export function collectReferencedImages(documents) {
  const urls = new Set();
  for (const html of documents) {
    for (const match of html.matchAll(
      /(?<![-\w])(?:src|srcset)\s*=\s*"([^"]*)"/g
    )) {
      for (const candidate of match[1].split(",")) {
        const url = candidate.trim().split(/\s+/)[0];
        if (url.startsWith("/assets/") && isEncodableUrl(url)) urls.add(url);
      }
    }
  }
  return [...urls].sort();
}

async function fileInfo(path) {
  try {
    return await stat(path);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function hashFile(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

export async function loadWebpManifest() {
  try {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    if (manifest?.pipelineVersion === PIPELINE_VERSION && manifest.entries) {
      return manifest;
    }
  } catch {
    // Missing or unreadable manifest simply means everything is stale.
  }
  return { pipelineVersion: PIPELINE_VERSION, entries: {} };
}

async function saveWebpManifest(manifest) {
  const entries = Object.fromEntries(
    Object.entries(manifest.entries).sort(([a], [b]) => a.localeCompare(b))
  );
  await writeFile(
    manifestPath,
    `${JSON.stringify({ pipelineVersion: PIPELINE_VERSION, entries }, null, 2)}\n`,
    "utf8"
  );
}

// Availability map consumed by the build's markup transform:
// source asset URL -> { webpUrl, bytes, width, height }.
export function webpAvailability(manifest) {
  const available = new Map();
  for (const [url, entry] of Object.entries(manifest.entries)) {
    if (entry.status === "encoded" && entry.webp) {
      available.set(url, {
        webpUrl: entry.webp.file,
        bytes: entry.webp.bytes,
        width: entry.webp.width,
        height: entry.webp.height
      });
    }
  }
  return available;
}

async function classifyEntries(referenced, manifest) {
  const stale = [];
  const missingSources = [];
  for (const url of referenced) {
    const sourcePath = publicPathFor(url);
    const info = sourcePath ? await fileInfo(sourcePath) : null;
    if (!info) {
      missingSources.push(url);
      continue;
    }
    const entry = manifest.entries[url];
    if (!entry) {
      stale.push(url);
      continue;
    }
    if (
      entry.sourceBytes !== info.size ||
      entry.hash !== (await hashFile(sourcePath)) ||
      entry.quality !== qualityFor(url) ||
      (entry.capWidth ?? null) !== (CAPPED_WIDTHS.get(url) ?? null)
    ) {
      stale.push(url);
      continue;
    }
    if (entry.status === "encoded") {
      const webpPath = publicPathFor(entry.webp.file);
      const webpInfo = webpPath ? await fileInfo(webpPath) : null;
      if (!webpInfo || webpInfo.size !== entry.webp.bytes) stale.push(url);
    }
  }
  return { stale, missingSources };
}

async function findChromium() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.CHROMIUM_PATH,
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium"
  ].filter(Boolean);

  const browserRoots = [
    "/opt/pw-browsers",
    join(homedir(), ".cache", "ms-playwright"),
    join(homedir(), "Library", "Caches", "ms-playwright")
  ];
  for (const browserRoot of browserRoots) {
    let entries = [];
    try {
      entries = (await readdir(browserRoot)).sort().reverse();
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!/chromium/i.test(entry)) continue;
      candidates.push(
        join(browserRoot, entry, "chrome-linux", "chrome"),
        join(browserRoot, entry, "chrome-linux", "headless_shell"),
        join(
          browserRoot,
          entry,
          "chrome-mac",
          "Chromium.app",
          "Contents",
          "MacOS",
          "Chromium"
        )
      );
    }
  }

  for (const candidate of candidates) {
    if (await fileInfo(candidate)) return candidate;
  }
  return null;
}

function driverHtml(jobs) {
  const payload = JSON.stringify(jobs).replace(/</g, "\\u003c");
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>webp encoder</title></head>
<body>
<script type="application/json" id="jobs">${payload}</script>
<script>
(async () => {
  const jobs = JSON.parse(document.getElementById("jobs").textContent);
  const results = {};
  for (const job of jobs) {
    try {
      const image = new Image();
      const loaded = new Promise((resolveLoad, rejectLoad) => {
        image.onload = resolveLoad;
        image.onerror = () => rejectLoad(new Error("image failed to load"));
      });
      image.src = job.fileUrl;
      await loaded;
      const scale = job.targetWidth ? job.targetWidth / image.naturalWidth : 1;
      const width = job.targetWidth || image.naturalWidth;
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/webp", job.quality);
      if (!dataUrl.startsWith("data:image/webp;base64,")) {
        throw new Error("browser did not produce WebP output");
      }
      results[job.id] = { data: dataUrl.slice(23), width, height };
    } catch (error) {
      results[job.id] = { error: String((error && error.message) || error) };
    }
  }
  const json = JSON.stringify(results);
  const pre = document.createElement("pre");
  pre.textContent =
    "RRWEBP:BEGIN" + btoa(unescape(encodeURIComponent(json))) + "RRWEBP:END";
  document.body.appendChild(pre);
})();
</script>
</body>
</html>
`;
}

function runProcess(command, args, timeoutMs) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    const stdout = [];
    const stderr = [];
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      rejectRun(new Error(`Chromium timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      rejectRun(error);
    });
    child.on("close", () => {
      clearTimeout(timer);
      resolveRun({
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8")
      });
    });
  });
}

async function encodeWithChromium(chromium, jobs) {
  const workDir = await mkdtemp(join(tmpdir(), "rr-webp-"));
  try {
    const driverPath = join(workDir, "encode.html");
    await writeFile(driverPath, driverHtml(jobs), "utf8");
    let lastStderr = "";
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const args = [
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-background-networking",
        "--disable-component-update",
        "--disable-sync",
        "--disable-crash-reporter",
        "--disable-dev-shm-usage",
        "--hide-scrollbars",
        "--allow-file-access-from-files",
        "--force-color-profile=srgb",
        `--user-data-dir=${join(workDir, `profile-${attempt}`)}`,
        `--virtual-time-budget=${30000 * attempt}`,
        "--dump-dom",
        pathToFileURL(driverPath).href
      ];
      if (typeof process.getuid === "function" && process.getuid() === 0) {
        args.unshift("--no-sandbox");
      }
      const { stdout, stderr } = await runProcess(chromium, args, 180000);
      lastStderr = stderr;
      const match = stdout.match(/RRWEBP:BEGIN([A-Za-z0-9+/=]+)RRWEBP:END/);
      if (match) {
        return JSON.parse(Buffer.from(match[1], "base64").toString("utf8"));
      }
    }
    throw new Error(
      `Chromium did not return encoder output. stderr tail: ${lastStderr
        .split("\n")
        .slice(-4)
        .join(" ")}`
    );
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

const WEBP_MAGIC = (buffer) =>
  buffer.length > 16 &&
  buffer.toString("ascii", 0, 4) === "RIFF" &&
  buffer.toString("ascii", 8, 12) === "WEBP";

// Ensure every referenced .jpg/.png has a fresh WebP derivative (or a
// recorded kept-original decision). Cheap when nothing changed: only content
// hashes are compared. Returns a summary; never throws for a missing browser
// so `npm run build` stays usable — callers decide how loud to be.
export async function ensureWebpDerivatives({
  documents,
  force = false,
  log = console
} = {}) {
  const referenced = collectReferencedImages(documents);
  const manifest = await loadWebpManifest();
  const { stale, missingSources } = await classifyEntries(referenced, manifest);
  for (const url of missingSources) {
    log.warn(`encode-images: referenced image missing on disk: ${url}`);
  }
  const queue = force ? referenced.filter((url) => !missingSources.includes(url)) : stale;

  const summary = {
    referenced: referenced.length,
    stale: queue.length,
    encoded: 0,
    keptOriginal: 0,
    failed: 0,
    chromium: null,
    skippedNoChromium: false
  };
  if (!queue.length) return summary;

  const chromium = await findChromium();
  if (!chromium) {
    summary.skippedNoChromium = true;
    log.warn(
      `encode-images: ${queue.length} image(s) need WebP derivatives but no Chromium/Chrome binary was found. ` +
        "Set CHROME_PATH and run `npm run encode:images`."
    );
    return summary;
  }
  summary.chromium = chromium;

  const jobs = queue.map((url) => ({
    id: url,
    fileUrl: pathToFileURL(publicPathFor(url)).href,
    quality: qualityFor(url),
    targetWidth: CAPPED_WIDTHS.get(url) ?? null
  }));
  log.log(
    `encode-images: encoding ${jobs.length} image(s) with ${chromium}`
  );
  const results = await encodeWithChromium(chromium, jobs);

  for (const url of queue) {
    const result = results[url];
    const sourcePath = publicPathFor(url);
    const sourceInfo = await fileInfo(sourcePath);
    if (!result || result.error || !sourceInfo) {
      summary.failed += 1;
      log.warn(
        `encode-images: failed to encode ${url}: ${result?.error || "no result"}`
      );
      continue;
    }
    const buffer = Buffer.from(result.data, "base64");
    if (!WEBP_MAGIC(buffer)) {
      summary.failed += 1;
      log.warn(`encode-images: output for ${url} was not valid WebP; skipped`);
      continue;
    }
    const entry = {
      hash: await hashFile(sourcePath),
      sourceBytes: sourceInfo.size,
      quality: qualityFor(url),
      capWidth: CAPPED_WIDTHS.get(url) ?? null
    };
    const webpUrl = webpUrlFor(url);
    const webpPath = publicPathFor(webpUrl);
    if (buffer.length >= sourceInfo.size) {
      // The derivative would be heavier than the source; keep the original.
      const existing = await fileInfo(webpPath);
      if (existing) await unlink(webpPath);
      manifest.entries[url] = { ...entry, status: "kept-original", webp: null };
      summary.keptOriginal += 1;
      log.log(
        `encode-images: kept-original ${url} (webp ${buffer.length} B >= source ${sourceInfo.size} B)`
      );
    } else {
      await writeFile(webpPath, buffer);
      manifest.entries[url] = {
        ...entry,
        status: "encoded",
        webp: {
          file: webpUrl,
          bytes: buffer.length,
          width: result.width,
          height: result.height
        }
      };
      summary.encoded += 1;
      log.log(
        `encode-images: ${url} ${sourceInfo.size} B -> ${webpUrl} ${buffer.length} B ` +
          `(${Math.round((buffer.length / sourceInfo.size) * 100)}%)`
      );
    }
  }

  // Drop manifest entries for sources that are no longer referenced.
  for (const url of Object.keys(manifest.entries)) {
    if (!referenced.includes(url)) delete manifest.entries[url];
  }
  await saveWebpManifest(manifest);
  return summary;
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  const force = process.argv.includes("--force");
  const { pages } = await import("../src/pages.mjs");
  const summary = await ensureWebpDerivatives({
    documents: pages.map((page) => page.html),
    force
  });
  if (summary.skippedNoChromium) process.exitCode = 1;
  if (summary.failed) process.exitCode = 1;
  const manifest = await loadWebpManifest();
  let sourceTotal = 0;
  let webpTotal = 0;
  let kept = 0;
  for (const entry of Object.values(manifest.entries)) {
    sourceTotal += entry.sourceBytes;
    if (entry.status === "encoded") webpTotal += entry.webp.bytes;
    else {
      webpTotal += entry.sourceBytes;
      kept += 1;
    }
  }
  console.log(
    `encode-images: ${summary.referenced} referenced image(s), ` +
      `${summary.stale} (re)encoded this run, ${kept} kept-original. ` +
      `Source total ${(sourceTotal / 1024).toFixed(1)} KiB, ` +
      `WebP-preferred total ${(webpTotal / 1024).toFixed(1)} KiB.`
  );
}
