import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const outputDir = join(root, "screenshots");
const chromePath =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const debugPort = 9333;
const preview = process.env.PREVIEW_URL || "http://127.0.0.1:4173";

await mkdir(outputDir, { recursive: true });

const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    "--disable-gpu",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-sync",
    "--disable-crash-reporter",
    "--no-first-run",
    "--no-default-browser-check",
    "--hide-scrollbars",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=/private/tmp/rr2-cdp-${Date.now()}`,
    "about:blank"
  ],
  { stdio: "ignore" }
);

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitForDebugger() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
      if (response.ok) return;
    } catch {
      // Chrome is still starting.
    }
    await delay(100);
  }
  throw new Error("Chrome debugging endpoint did not become available.");
}

class Cdp {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.id = 0;
    this.pending = new Map();
    this.events = new Map();
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result || {});
        return;
      }
      if (message.method && this.events.has(message.method)) {
        for (const resolve of this.events.get(message.method)) resolve(message.params);
        this.events.delete(message.method);
      }
    });
  }

  async ready() {
    if (this.socket.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  once(method) {
    return new Promise((resolve) => {
      const listeners = this.events.get(method) || [];
      listeners.push(resolve);
      this.events.set(method, listeners);
    });
  }

  close() {
    this.socket.close();
  }
}

async function createPage(url) {
  const response = await fetch(
    `http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(url)}`,
    { method: "PUT" }
  );
  const target = await response.json();
  const cdp = new Cdp(target.webSocketDebuggerUrl);
  await cdp.ready();
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Network.enable");
  return { cdp, targetId: target.id };
}

async function prepare(cdp, url, width, height) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width <= 560,
    screenWidth: width,
    screenHeight: height
  });
  const loaded = cdp.once("Page.loadEventFired");
  await cdp.send("Page.navigate", { url });
  await loaded;
  await cdp.send("Runtime.evaluate", {
    expression:
      "document.fonts && document.fonts.ready ? document.fonts.ready.then(() => true) : true",
    awaitPromise: true,
    returnByValue: true
  });
  await cdp.send("Runtime.evaluate", {
    expression: `new Promise((resolve) => {
      const started = Date.now();
      const ready = () => {
        if (Array.isArray(window.dataLayer)) return resolve(true);
        if (Date.now() - started > 3000) return resolve(false);
        setTimeout(ready, 25);
      };
      ready();
    })`,
    awaitPromise: true,
    returnByValue: true
  });
  await delay(250);
}

async function capture(cdp, target) {
  await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      document.body.classList.add("page-ready");
      const style = document.createElement("style");
      style.dataset.qaCapture = "true";
      style.textContent =
        "*,*::before,*::after{animation:none!important;transition:none!important}" +
        ".reveal{opacity:1!important;transform:none!important;translate:none!important}";
      document.head.appendChild(style);
      document
        .querySelectorAll(".reveal")
        .forEach((element) => element.classList.add("is-revealed"));
      return true;
    })()`,
    returnByValue: true
  });
  await delay(80);

  if (target.fullPage || target.selector) {
    await cdp.send("Runtime.evaluate", {
      expression: `(async () => {
        document.documentElement.style.scrollBehavior = "auto";
        document.querySelectorAll("img[loading='lazy']").forEach((image) => {
          image.loading = "eager";
        });
        for (
          let y = 0;
          y < document.documentElement.scrollHeight;
          y += Math.max(500, window.innerHeight * 0.8)
        ) {
          window.scrollTo(0, y);
          await new Promise((resolve) => setTimeout(resolve, 35));
        }
        window.scrollTo(0, 0);
        await Promise.all(
          [...document.images].map((image) => {
            if (image.complete) return image.decode?.().catch(() => undefined);
            return new Promise((resolve) => {
              image.addEventListener("load", resolve, { once: true });
              image.addEventListener("error", resolve, { once: true });
            });
          })
        );
        return true;
      })()`,
      awaitPromise: true,
      returnByValue: true
    });
    await delay(120);
  }

  if (target.action) {
    await cdp.send("Runtime.evaluate", {
      expression: target.action,
      awaitPromise: true
    });
    await delay(150);
  }

  let clip;
  if (target.fullPage) {
    const metrics = await cdp.send("Page.getLayoutMetrics");
    clip = {
      x: 0,
      y: 0,
      width: Math.ceil(metrics.cssContentSize.width),
      height: Math.ceil(metrics.cssContentSize.height),
      scale: 1
    };
  } else if (target.selector) {
    const result = await cdp.send("Runtime.evaluate", {
      expression: `(() => {
        const element = document.querySelector(${JSON.stringify(target.selector)});
        if (!element) throw new Error("Missing selector");
        const rect = element.getBoundingClientRect();
        return {
          x: Math.max(0, rect.left + window.scrollX),
          y: Math.max(0, rect.top + window.scrollY),
          width: rect.width,
          height: rect.height
        };
      })()`,
      returnByValue: true
    });
    clip = { ...result.result.value, scale: 1 };
  }

  const result = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: Boolean(clip),
    ...(clip ? { clip } : {})
  });
  await writeFile(
    join(outputDir, target.name),
    Buffer.from(result.data, "base64")
  );
  console.log(`Captured ${target.name}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(`Browser smoke check failed: ${message}`);
}

const targets = [
  {
    name: "home-mobile-390.png",
    path: "/",
    width: 390,
    height: 844
  },
  {
    name: "mobile-menu-390.png",
    path: "/",
    width: 390,
    height: 844,
    action: "document.querySelector('[data-menu-toggle]').click(); true"
  },
  {
    name: "home-tablet-768.png",
    path: "/",
    width: 768,
    height: 1024
  },
  {
    name: "home-desktop-1440.png",
    path: "/",
    width: 1440,
    height: 1000
  },
  {
    name: "home-full-1440.png",
    path: "/",
    width: 1440,
    height: 1000,
    fullPage: true
  },
  {
    name: "services-section-1440.png",
    path: "/",
    width: 1440,
    height: 1000,
    selector: ".services-section"
  },
  {
    name: "above-standard-1440.png",
    path: "/",
    width: 1440,
    height: 1000,
    selector: ".standard-section"
  },
  {
    name: "services-index-1440.png",
    path: "/services/",
    width: 1440,
    height: 1000
  },
  {
    name: "services-index-mobile-390.png",
    path: "/services/",
    width: 390,
    height: 844
  },
  {
    name: "roof-replacement-page-1440.png",
    path: "/services/roof-replacement/",
    width: 1440,
    height: 1000
  },
  {
    name: "roof-replacement-page-mobile-390.png",
    path: "/services/roof-replacement/",
    width: 390,
    height: 844
  },
  {
    name: "service-guide-band-1440.png",
    path: "/services/roof-replacement/",
    width: 1440,
    height: 1000,
    selector: ".service-guide-band"
  },
  {
    name: "service-guide-band-mobile-390.png",
    path: "/services/roof-replacement/",
    width: 390,
    height: 844,
    selector: ".service-guide-band"
  },
  {
    name: "service-page-1440.png",
    path: "/services/roof-repair/",
    width: 1440,
    height: 1000
  },
  {
    name: "storm-service-mobile-390.png",
    path: "/services/storm-damage-restoration/",
    width: 390,
    height: 844
  },
  {
    name: "gutters-service-1440.png",
    path: "/services/gutters-exteriors/",
    width: 1440,
    height: 1000
  },
  {
    name: "gutters-service-mobile-390.png",
    path: "/services/gutters-exteriors/",
    width: 390,
    height: 844
  },
  {
    name: "service-page-mobile-390.png",
    path: "/services/roof-repair/",
    width: 390,
    height: 844
  },
  {
    name: "storm-service-1440.png",
    path: "/services/storm-damage-restoration/",
    width: 1440,
    height: 1000
  },
  {
    name: "projects-page-1440.png",
    path: "/projects/",
    width: 1440,
    height: 1000
  },
  {
    name: "projects-full-1440.png",
    path: "/projects/",
    width: 1440,
    height: 1000,
    fullPage: true
  },
  {
    name: "projects-residential-1440.png",
    path: "/projects/",
    width: 1440,
    height: 1000,
    selector: "#residential-projects"
  },
  {
    name: "projects-commercial-1440.png",
    path: "/projects/",
    width: 1440,
    height: 1000,
    selector: "#commercial-projects"
  },
  {
    name: "projects-field-1440.png",
    path: "/projects/",
    width: 1440,
    height: 1000,
    selector: ".project-field"
  },
  {
    name: "projects-field-mobile-390.png",
    path: "/projects/",
    width: 390,
    height: 844,
    selector: ".project-field"
  },
  {
    name: "projects-mobile-first-390.png",
    path: "/projects/",
    width: 390,
    height: 844
  },
  {
    name: "projects-mobile-390.png",
    path: "/projects/",
    width: 390,
    height: 844,
    fullPage: true
  },
  {
    name: "reviews-page-1440.png",
    path: "/reviews/",
    width: 1440,
    height: 1000
  },
  {
    name: "reviews-page-mobile-390.png",
    path: "/reviews/",
    width: 390,
    height: 844
  },
  {
    name: "about-page-1440.png",
    path: "/about/",
    width: 1440,
    height: 1000
  },
  {
    name: "about-page-mobile-390.png",
    path: "/about/",
    width: 390,
    height: 844
  },
  {
    name: "about-team-expertise-1440.png",
    path: "/about/",
    width: 1440,
    height: 1000,
    selector: ".team-expertise"
  },
  {
    name: "about-team-expertise-mobile-390.png",
    path: "/about/",
    width: 390,
    height: 844,
    selector: ".team-expertise"
  },
  {
    name: "process-page-1440.png",
    path: "/process/",
    width: 1440,
    height: 1000
  },
  {
    name: "process-page-mobile-390.png",
    path: "/process/",
    width: 390,
    height: 844
  },
  {
    name: "service-areas-page-1440.png",
    path: "/service-areas/",
    width: 1440,
    height: 1000
  },
  {
    name: "service-areas-page-mobile-390.png",
    path: "/service-areas/",
    width: 390,
    height: 844
  },
  {
    name: "barrington-page-1440.png",
    path: "/service-areas/barrington-il/",
    width: 1440,
    height: 1000
  },
  {
    name: "barrington-page-mobile-390.png",
    path: "/service-areas/barrington-il/",
    width: 390,
    height: 844
  },
  {
    name: "resources-page-1440.png",
    path: "/resources/",
    width: 1440,
    height: 1000
  },
  {
    name: "resources-page-mobile-390.png",
    path: "/resources/",
    width: 390,
    height: 844
  },
  {
    name: "resources-index-1440.png",
    path: "/resources/",
    width: 1440,
    height: 1000,
    selector: ".resources-index"
  },
  {
    name: "resources-index-mobile-390.png",
    path: "/resources/",
    width: 390,
    height: 844,
    selector: ".resources-index"
  },
  {
    name: "resource-contractor-guide-1440.png",
    path: "/resources/choose-roofing-contractor-greater-chicago/",
    width: 1440,
    height: 1000
  },
  {
    name: "resource-contractor-guide-mobile-390.png",
    path: "/resources/choose-roofing-contractor-greater-chicago/",
    width: 390,
    height: 844
  },
  {
    name: "resource-repair-or-replace-1440.png",
    path: "/resources/roof-repair-vs-replacement-chicago/",
    width: 1440,
    height: 1000
  },
  {
    name: "resource-roof-replacement-process-1440.png",
    path: "/resources/roof-replacement-process-what-to-expect/",
    width: 1440,
    height: 1000
  },
  {
    name: "resource-roof-replacement-process-mobile-390.png",
    path: "/resources/roof-replacement-process-what-to-expect/",
    width: 390,
    height: 844
  },
  {
    name: "resource-storm-guide-1440.png",
    path: "/resources/storm-damage-roof-assessment-illinois/",
    width: 1440,
    height: 1000
  },
  {
    name: "resource-attic-ventilation-1440.png",
    path: "/resources/attic-ventilation-roof-replacement/",
    width: 1440,
    height: 1000
  },
  {
    name: "resource-attic-ventilation-mobile-390.png",
    path: "/resources/attic-ventilation-roof-replacement/",
    width: 390,
    height: 844
  },
  {
    name: "resource-ice-dam-guide-1440.png",
    path: "/resources/ice-dams-attic-ventilation-chicago/",
    width: 1440,
    height: 1000
  },
  {
    name: "faq-page-1440.png",
    path: "/faq/",
    width: 1440,
    height: 1000
  },
  {
    name: "faq-page-mobile-390.png",
    path: "/faq/",
    width: 390,
    height: 844
  },
  {
    name: "warranty-page-1440.png",
    path: "/warranty/",
    width: 1440,
    height: 1000
  },
  {
    name: "warranty-page-mobile-390.png",
    path: "/warranty/",
    width: 390,
    height: 844
  },
  {
    name: "financing-page-1440.png",
    path: "/financing/",
    width: 1440,
    height: 1000
  },
  {
    name: "contact-page-1440.png",
    path: "/contact/",
    width: 1440,
    height: 1000
  },
  {
    name: "contact-page-mobile-390.png",
    path: "/contact/",
    width: 390,
    height: 844
  },
  {
    name: "lead-form-768.png",
    path: "/contact/",
    width: 768,
    height: 1024,
    selector: ".form-panel"
  },
  {
    name: "lead-form-mobile-390.png",
    path: "/contact/?intent=quote#inspection-form",
    width: 390,
    height: 844,
    selector: ".form-panel"
  },
  {
    name: "lead-form-step-2-768.png",
    path: "/contact/",
    width: 768,
    height: 1024,
    selector: ".form-panel",
    action: `(() => {
      const form = document.querySelector("[data-form]");
      form.elements.street_address.value = "123 Test Street";
      form.elements.city.value = "Barrington";
      form.elements.postal_code.value = "60010";
      form.elements.property_type.value = "single-family";
      form.querySelector('[data-form-step="1"] [data-form-next]').click();
      return true;
    })()`
  },
  {
    name: "lead-form-step-3-768.png",
    path: "/contact/",
    width: 768,
    height: 1024,
    selector: ".form-panel",
    action: `(() => {
      const form = document.querySelector("[data-form]");
      form.elements.street_address.value = "123 Test Street";
      form.elements.city.value = "Barrington";
      form.elements.postal_code.value = "60010";
      form.elements.property_type.value = "single-family";
      form.querySelector('[data-form-step="1"] [data-form-next]').click();
      form.elements.service.value = "roof-replacement";
      form.elements.project_timing.value = "planning";
      form.querySelector('[data-form-step="2"] [data-form-next]').click();
      return true;
    })()`
  },
  {
    name: "thank-you-1440.png",
    path: "/thank-you/",
    width: 1440,
    height: 1000,
    selector: ".thank-you"
  },
  {
    name: "privacy-page-1440.png",
    path: "/privacy/",
    width: 1440,
    height: 1000
  },
  {
    name: "terms-page-1440.png",
    path: "/terms/",
    width: 1440,
    height: 1000
  },
  {
    name: "accessibility-page-1440.png",
    path: "/accessibility/",
    width: 1440,
    height: 1000
  },
  {
    name: "not-found-page-1440.png",
    path: "/404.html",
    width: 1440,
    height: 1000
  },
  {
    name: "footer-1440.png",
    path: "/",
    width: 1440,
    height: 1000,
    selector: ".site-footer"
  },
  {
    name: "footer-mobile-390.png",
    path: "/",
    width: 390,
    height: 844,
    selector: ".site-footer"
  }
];

const requiredCapturePaths = [
  "/",
  "/services/",
  "/services/roof-replacement/",
  "/services/roof-repair/",
  "/services/storm-damage-restoration/",
  "/services/gutters-exteriors/",
  "/projects/",
  "/reviews/",
  "/about/",
  "/process/",
  "/service-areas/",
  "/service-areas/barrington-il/",
  "/resources/",
  "/resources/choose-roofing-contractor-greater-chicago/",
  "/resources/roof-repair-vs-replacement-chicago/",
  "/resources/roof-replacement-process-what-to-expect/",
  "/resources/storm-damage-roof-assessment-illinois/",
  "/resources/ice-dams-attic-ventilation-chicago/",
  "/resources/attic-ventilation-roof-replacement/",
  "/faq/",
  "/warranty/",
  "/financing/",
  "/contact/",
  "/thank-you/",
  "/privacy/",
  "/terms/",
  "/accessibility/",
  "/404.html"
];

for (const path of requiredCapturePaths) {
  assert(
    targets.some((target) => target.path === path),
    `screenshot coverage is missing ${path}`
  );
}

try {
  await waitForDebugger();
  const { cdp } = await createPage("about:blank");
  for (const target of targets) {
    await prepare(cdp, `${preview}${target.path}`, target.width, target.height);
    await capture(cdp, target);
  }

  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.setBlockedURLs", { urls: ["*assets/main.js*"] });
  await prepare(cdp, `${preview}/?qa-nojs=${Date.now()}`, 1440, 900);
  const noJavaScriptHero = await cdp.send("Runtime.evaluate", {
    expression: `(() => ({
      headlineOpacity: Number(getComputedStyle(document.querySelector(".home-hero h1")).opacity),
      leadOpacity: Number(getComputedStyle(document.querySelector(".home-hero__lead")).opacity),
      actionsOpacity: Number(getComputedStyle(document.querySelector(".home-hero .button-row")).opacity),
      headlineVisible: document.querySelector(".home-hero h1").getBoundingClientRect().height > 0
    }))()`,
    returnByValue: true
  });
  assert(
    noJavaScriptHero.result.value.headlineOpacity === 1 &&
      noJavaScriptHero.result.value.leadOpacity === 1 &&
      noJavaScriptHero.result.value.actionsOpacity === 1 &&
      noJavaScriptHero.result.value.headlineVisible,
    "hero content depended on JavaScript to remain visible"
  );
  await cdp.send("Network.setBlockedURLs", { urls: [] });
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: false });

  await prepare(cdp, `${preview}/`, 390, 844);
  const menuState = await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const toggle = document.querySelector("[data-menu-toggle]");
      toggle.click();
      const menu = document.querySelector("[data-mobile-menu]");
      return {
        expanded: toggle.getAttribute("aria-expanded"),
        hidden: menu.hidden,
        bodyLocked: document.body.classList.contains("menu-open"),
        backgroundInert: document.querySelector("main").inert,
        firstLinkFocused: document.activeElement === menu.querySelector("a"),
        topDelta: Math.abs(
          menu.getBoundingClientRect().top -
            document.querySelector("[data-header]").getBoundingClientRect().bottom
        )
      };
    })()`,
    returnByValue: true
  });
  assert(menuState.result.value.expanded === "true", "mobile menu did not expand");
  assert(menuState.result.value.hidden === false, "mobile menu remained hidden");
  assert(menuState.result.value.bodyLocked === true, "mobile menu did not lock the page");
  assert(menuState.result.value.backgroundInert === true, "mobile menu did not make page content inert");
  assert(menuState.result.value.firstLinkFocused === true, "mobile menu did not move focus into navigation");
  assert(menuState.result.value.topDelta <= 1, "mobile menu did not align beneath the sticky header");

  const trappedFocus = await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const toggle = document.querySelector("[data-menu-toggle]");
      const menu = document.querySelector("[data-mobile-menu]");
      const links = [...menu.querySelectorAll("a[href]")];
      toggle.focus();
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Tab",
          shiftKey: true,
          bubbles: true,
          cancelable: true
        })
      );
      return document.activeElement === links.at(-1);
    })()`,
    returnByValue: true
  });
  assert(trappedFocus.result.value === true, "mobile menu did not contain keyboard focus");

  const escapedMenu = await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const toggle = document.querySelector("[data-menu-toggle]");
      const menu = document.querySelector("[data-mobile-menu]");
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
      return {
        hidden: menu.hidden,
        expanded: toggle.getAttribute("aria-expanded"),
        focusReturned: document.activeElement === toggle,
        backgroundRestored: document.querySelector("main").inert === false
      };
    })()`,
    returnByValue: true
  });
  assert(
    escapedMenu.result.value.hidden &&
      escapedMenu.result.value.expanded === "false" &&
      escapedMenu.result.value.focusReturned &&
      escapedMenu.result.value.backgroundRestored,
    "Escape did not close the mobile menu and restore focus/background access"
  );

  await prepare(cdp, `${preview}/`, 768, 900);
  const tabletMenu = await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      document.querySelector("[data-menu-toggle]").click();
      const menu = document.querySelector("[data-mobile-menu]");
      return {
        topDelta: Math.abs(
          menu.getBoundingClientRect().top -
            document.querySelector("[data-header]").getBoundingClientRect().bottom
        ),
        bottom: menu.getBoundingClientRect().bottom,
        viewport: window.innerHeight
      };
    })()`,
    returnByValue: true
  });
  assert(tabletMenu.result.value.topDelta <= 1, "tablet menu did not start below the complete header");
  assert(tabletMenu.result.value.bottom <= tabletMenu.result.value.viewport + 1, "tablet menu exceeded the viewport");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1200,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
    screenWidth: 1200,
    screenHeight: 900
  });
  await delay(100);
  const resizedMenu = await cdp.send("Runtime.evaluate", {
    expression: "document.querySelector('[data-mobile-menu]').hidden",
    returnByValue: true
  });
  assert(resizedMenu.result.value === true, "mobile menu stayed open beyond its desktop breakpoint");

  await prepare(cdp, `${preview}/`, 1440, 900);
  const quoteTracking = await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const links = [...document.querySelectorAll('[data-event="quote_cta_click"]')];
      const headerLink = links.find((link) => link.dataset.position === "header");
      headerLink.addEventListener("click", (event) => event.preventDefault(), {
        once: true
      });
      headerLink.click();
      const tracked = window.dataLayer.at(-1);
      return {
        count: links.length,
        destinationsValid: links.every((link) => {
          const url = new URL(link.href, window.location.origin);
          return (
            url.pathname === "/contact/" &&
            url.searchParams.get("intent") === "quote" &&
            url.hash === "#inspection-form"
          );
        }),
        intentsValid: links.every((link) => link.dataset.intent === "quote"),
        trackedEvent: tracked?.event,
        trackedPosition: tracked?.CTA_position,
        trackedIntent: tracked?.intent
      };
    })()`,
    returnByValue: true
  });
  assert(
    quoteTracking.result.value.count >= 6 &&
      quoteTracking.result.value.destinationsValid &&
      quoteTracking.result.value.intentsValid &&
      quoteTracking.result.value.trackedEvent === "quote_cta_click" &&
      quoteTracking.result.value.trackedPosition === "header" &&
      quoteTracking.result.value.trackedIntent === "quote",
    "quote CTAs did not expose a consistent destination and analytics event"
  );

  await prepare(cdp, `${preview}/contact/`, 390, 844);
  const formMode = await cdp.send("Runtime.evaluate", {
    expression: `(() => ({
      hasForm: Boolean(document.querySelector("[data-form]")),
      endpointConfigured: document.querySelector("[data-form]")?.dataset.endpointConfigured,
      stepCount: document.querySelectorAll("[data-form-step]").length,
      activeStep: document.querySelector("[data-progress-step].is-active")?.dataset.progressStep,
      fieldsPresent: [
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
        "claim_stage",
        "message",
        "consent"
      ].every((name) => document.querySelector('[name="' + name + '"]'))
    }))()`,
    returnByValue: true
  });
  assert(formMode.result.value.hasForm, "structured quote form was missing");
  assert(
    formMode.result.value.endpointConfigured === "false",
    "local quote form unexpectedly reported a configured delivery endpoint"
  );
  assert(
    formMode.result.value.stepCount === 3 &&
      formMode.result.value.activeStep === "1" &&
      formMode.result.value.fieldsPresent,
    "quote form did not expose the complete three-step lead schema"
  );

  const invalidForm = await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const form = document.querySelector("[data-form]");
      form.querySelector("[data-form-next]").click();
      return {
        invalid: form.querySelectorAll('[aria-invalid="true"]').length,
        status: form.querySelector("[data-form-status]").textContent,
        activeStep: form.querySelector("[data-progress-step].is-active")?.dataset.progressStep
      };
    })()`,
    returnByValue: true
  });
  assert(
    invalidForm.result.value.invalid === 4 &&
      invalidForm.result.value.activeStep === "1",
    "property-step validation did not hold the incomplete form"
  );
  assert(
    invalidForm.result.value.status.includes("highlighted fields"),
    "form validation recovery message was missing"
  );

  const unconfiguredDelivery = await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const form = document.querySelector("[data-form]");
      const setValue = (name, value) => {
        const field = form.elements[name];
        field.value = value;
        field.dispatchEvent(new Event("input", { bubbles: true }));
      };
      setValue("street_address", "123 Test Street");
      setValue("city", "Barrington");
      setValue("postal_code", "60010");
      setValue("property_type", "single-family");
      form.querySelector('[data-form-step="1"] [data-form-next]').click();
      setValue("service", "roof-replacement");
      setValue("project_timing", "planning");
      setValue("claim_stage", "not-claim-related");
      form.querySelector('[data-form-step="2"] [data-form-next]').click();
      setValue("first_name", "Test");
      setValue("last_name", "Homeowner");
      setValue("phone", "2245550100");
      setValue("email", "test@example.com");
      form.elements.consent.checked = true;
      form.elements.consent.dispatchEvent(new Event("input", { bubbles: true }));
      form.requestSubmit();
      const tracked = window.dataLayer.at(-1);
      return {
        activeStep: form.querySelector("[data-progress-step].is-active")?.dataset.progressStep,
        status: form.querySelector("[data-form-status]").textContent,
        hasEmailFallback: Boolean(form.querySelector("[data-form-status] a[href^='mailto:']")),
        path: window.location.pathname,
        trackedEvent: tracked?.event,
        trackedError: tracked?.error_type
      };
    })()`,
    returnByValue: true
  });
  assert(
    unconfiguredDelivery.result.value.activeStep === "3" &&
      unconfiguredDelivery.result.value.status.includes("not been sent") &&
      !unconfiguredDelivery.result.value.hasEmailFallback &&
      unconfiguredDelivery.result.value.path === "/contact/" &&
      unconfiguredDelivery.result.value.trackedEvent === "form_submit_error" &&
      unconfiguredDelivery.result.value.trackedError === "endpoint_not_configured",
    "unconfigured delivery did not preserve the form and fail honestly"
  );

  await prepare(cdp, `${preview}/contact/`, 390, 844);
  const confirmedDelivery = await cdp.send("Runtime.evaluate", {
    expression: `(async () => {
      const form = document.querySelector("[data-form]");
      const setValue = (name, value) => {
        form.elements[name].value = value;
      };
      setValue("street_address", "123 Test Street");
      setValue("city", "Barrington");
      setValue("postal_code", "60010");
      setValue("property_type", "single-family");
      setValue("service", "roof-replacement");
      setValue("project_timing", "planning");
      setValue("first_name", "Test");
      setValue("last_name", "Homeowner");
      setValue("phone", "2245550100");
      setValue("email", "test@example.com");
      form.elements.consent.checked = true;
      form.dataset.endpointConfigured = "true";
      form.dataset.successPath = "#submitted";
      form.action = "/mock-lead";
      const baseline = window.dataLayer.length;
      let resolveFetch;
      window.fetch = () => new Promise((resolve) => {
        resolveFetch = resolve;
      });
      form.requestSubmit();
      await new Promise((resolve) => setTimeout(resolve, 20));
      const before = window.dataLayer.slice(baseline).map((entry) => entry.event);
      resolveFetch(new Response(null, { status: 204 }));
      await new Promise((resolve) => setTimeout(resolve, 40));
      const after = window.dataLayer.slice(baseline).map((entry) => entry.event);
      return {
        attemptBeforeConfirmation: before.includes("form_submit_attempt"),
        successBeforeConfirmation: before.includes("form_submit_success"),
        successAfterConfirmation: after.includes("form_submit_success"),
        hash: window.location.hash
      };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  assert(
    confirmedDelivery.result.value.attemptBeforeConfirmation &&
      !confirmedDelivery.result.value.successBeforeConfirmation &&
      confirmedDelivery.result.value.successAfterConfirmation &&
      confirmedDelivery.result.value.hash === "#submitted",
    "quote form did not wait for confirmed endpoint success before conversion"
  );

  await cdp.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }]
  });
  await prepare(cdp, `${preview}/`, 390, 844);
  const reducedMotion = await cdp.send("Runtime.evaluate", {
    expression: `(() => ({
      motionReady: document.documentElement.classList.contains("motion-ready"),
      hiddenRevealCount: [...document.querySelectorAll(".reveal")].filter(
        (element) => getComputedStyle(element).opacity === "0"
      ).length,
      headlineOpacity: Number(getComputedStyle(document.querySelector(".home-hero h1")).opacity),
      actionsOpacity: Number(getComputedStyle(document.querySelector(".home-hero .button-row")).opacity)
    }))()`,
    returnByValue: true
  });
  assert(
    reducedMotion.result.value.motionReady === false,
    "reduced-motion mode still enabled reveal choreography"
  );
  assert(
    reducedMotion.result.value.hiddenRevealCount === 0,
    "reduced-motion mode left content hidden"
  );
  assert(
    reducedMotion.result.value.headlineOpacity === 1 &&
      reducedMotion.result.value.actionsOpacity === 1,
    "reduced-motion mode left hero content hidden"
  );
  await cdp.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "no-preference" }]
  });

  await prepare(cdp, `${preview}/`, 1440, 900);
  const revealBeforeScroll = await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const card = document.querySelector(".services-section .service-card");
      return {
        pending: card.classList.contains("reveal"),
        opacity: Number(getComputedStyle(card).opacity)
      };
    })()`,
    returnByValue: true
  });
  assert(
    revealBeforeScroll.result.value.pending &&
      revealBeforeScroll.result.value.opacity === 0,
    "below-fold content did not enter the reveal queue"
  );
  await cdp.send("Runtime.evaluate", {
    expression:
      'document.querySelector(".services-section .service-card").scrollIntoView({ block: "center" })'
  });
  await delay(1400);
  const revealAfterScroll = await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const card = document.querySelector(".services-section .service-card");
      return {
        pending: card.classList.contains("reveal"),
        opacity: Number(getComputedStyle(card).opacity),
        translate: getComputedStyle(card).translate
      };
    })()`,
    returnByValue: true
  });
  assert(
    !revealAfterScroll.result.value.pending &&
      revealAfterScroll.result.value.opacity === 1 &&
      ["none", "0px", "0px 0px"].includes(revealAfterScroll.result.value.translate),
    `IntersectionObserver reveal did not complete cleanly: ${JSON.stringify(revealAfterScroll.result.value)}`
  );

  await prepare(cdp, `${preview}/services/roof-repair/`, 1440, 900);
  const activeNavigation = await cdp.send("Runtime.evaluate", {
    expression: `(() => ({
      summaryActive: document.querySelector(".nav-dropdown > summary")?.classList.contains("is-active"),
      desktopHref: document.querySelector('.nav-dropdown__panel a[aria-current="page"]')?.pathname,
      mobileHref: document.querySelector('.mobile-menu a[aria-current="page"]')?.pathname
    }))()`,
    returnByValue: true
  });
  assert(
    activeNavigation.result.value.summaryActive === true &&
      activeNavigation.result.value.desktopHref === "/services/roof-repair/" &&
      activeNavigation.result.value.mobileHref === "/services/roof-repair/",
    "service navigation did not expose the active section"
  );
  const serviceMenuEscape = await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const detail = document.querySelector(".nav-dropdown");
      const summary = detail.querySelector("summary");
      detail.open = true;
      summary.focus();
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      return {
        open: detail.open,
        focusReturned: document.activeElement === summary
      };
    })()`,
    returnByValue: true
  });
  assert(
    serviceMenuEscape.result.value.open === false &&
      serviceMenuEscape.result.value.focusReturned === true,
    "desktop service disclosure did not close and restore focus on Escape"
  );

  const overflowMatrix = [
    ...requiredCapturePaths.map((path) => [path, 390]),
    ["/", 768],
    ["/", 1440],
    ["/services/roof-repair/", 1440],
    ["/projects/", 1440],
    ["/contact/", 320],
    ["/contact/", 375],
    ["/contact/", 430],
    ["/contact/", 768],
    ["/contact/", 1024],
    ["/contact/", 1280],
    ["/contact/", 1440]
  ];
  for (const [path, width] of overflowMatrix) {
    await prepare(cdp, `${preview}${path}`, width, 900);
    const overflow = await cdp.send("Runtime.evaluate", {
      expression: `(() => {
        const width = document.documentElement.clientWidth;
        const offenders = [...document.querySelectorAll("body *")]
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              tag: element.tagName,
              className: typeof element.className === "string" ? element.className : "",
              left: Math.round(rect.left * 10) / 10,
              right: Math.round(rect.right * 10) / 10
            };
          })
          .filter((item) => item.left < -1 || item.right > width + 1)
          .slice(0, 8);
        return {
          delta: document.documentElement.scrollWidth - width,
          offenders
        };
      })()`,
      returnByValue: true
    });
    assert(
      overflow.result.value.delta <= 1,
      `${path} has ${overflow.result.value.delta}px horizontal overflow at ${width}px: ${JSON.stringify(overflow.result.value.offenders)}`
    );
  }

  const missingResponse = await fetch(`${preview}/definitely-not-a-page`);
  assert(missingResponse.status === 404, "unknown route did not return HTTP 404");
  console.log(
    "Browser smoke checks passed: no-JavaScript hero, mobile focus/resize behavior, quote CTA tracking, contact conversion/form readiness, reduced motion, IntersectionObserver reveals, exact active navigation, responsive overflow, and 404 behavior."
  );
  cdp.close();
} finally {
  chrome.kill("SIGTERM");
}
