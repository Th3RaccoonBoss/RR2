import { inject as injectVercelAnalytics } from "/assets/vendor/vercel-analytics.mjs";
import { track as trackVercelAnalytics } from "/assets/vendor/vercel-analytics.mjs";

const dataLayer = (window.dataLayer = window.dataLayer || []);
document.documentElement.classList.add("js");

const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)");
const FINE_POINTER = window.matchMedia("(hover: hover) and (pointer: fine)");
const ANALYTICS_PROPERTY_MAX_LENGTH = 120;
const CAMPAIGN_PROPERTY_KEYS = new Set([
  "campaign_source",
  "campaign_medium",
  "campaign_name",
  "campaign_landing_path"
]);
const ANALYTICS_PROPERTY_KEYS = new Set([
  "page_path",
  "page_type",
  "device_category",
  "CTA_position",
  "service_interest",
  "intent",
  "resource",
  "form_type",
  "step_number",
  "step_name",
  "field_name",
  "error_type",
  "property_type",
  "referral_source",
  ...CAMPAIGN_PROPERTY_KEYS
]);

function localPath(value) {
  if (typeof value !== "string") return "";
  const path = value.trim().slice(0, ANALYTICS_PROPERTY_MAX_LENGTH);
  return path.startsWith("/") &&
    !path.startsWith("//") &&
    !path.includes("\\") &&
    !/[?#\s]/.test(path)
    ? path
    : "";
}

function containsLikelyPii(value) {
  return (
    /[^\s@]+@[^\s@]+\.[^\s@]+/.test(value) ||
    /(?:^|\D)(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}(?:\D|$)/.test(value)
  );
}

function analyticsScalar(value) {
  if (typeof value === "string") {
    const normalized = value
      .trim()
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .slice(0, ANALYTICS_PROPERTY_MAX_LENGTH);
    return normalized && !containsLikelyPii(normalized) ? normalized : undefined;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === "boolean" || value === null) return value;
  return undefined;
}

function sanitizedAnalyticsProperties(properties = {}) {
  const safe = {};
  Object.entries(properties).forEach(([key, value]) => {
    if (!ANALYTICS_PROPERTY_KEYS.has(key)) return;
    const normalized =
      key === "page_path" || key === "campaign_landing_path"
        ? localPath(value)
        : analyticsScalar(value);
    if (normalized !== undefined && normalized !== "") safe[key] = normalized;
  });
  return safe;
}

function track(eventName, properties = {}) {
  const safeEventName = analyticsScalar(eventName)?.slice(0, 80);
  if (!safeEventName) return;
  const safeProperties = sanitizedAnalyticsProperties({
    page_path: window.location.pathname,
    page_type: document.body.dataset.pageType || "unknown",
    device_category:
      window.matchMedia("(max-width: 560px)").matches ? "mobile" : "desktop",
    ...properties
  });
  dataLayer.push({
    event: safeEventName,
    ...safeProperties
  });
  // Vercel Pro custom events support a plan-limited number of custom fields.
  // The page URL/device are collected by Web Analytics already, so reserve the
  // two portable fields for the most useful conversion/referral dimensions.
  const vercelPropertyPriority =
    safeEventName === "ai_referral_landing"
      ? ["campaign_source", "campaign_landing_path"]
      : [
          "CTA_position",
          "service_interest",
          "intent",
          "resource",
          "form_type",
          "step_number",
          "step_name",
          "error_type",
          "property_type",
          "campaign_source",
          "campaign_landing_path"
        ];
  const vercelProperties = Object.fromEntries(
    vercelPropertyPriority
      .filter((key) => key in safeProperties)
      .slice(0, 2)
      .map((key) => [key, safeProperties[key]])
  );
  try {
    trackVercelAnalytics(safeEventName, vercelProperties);
  } catch {
    // Analytics must never block a visitor action or form flow.
  }
}

function persistCampaign() {
  const params = new URLSearchParams(window.location.search);
  let referrerHost = "";
  try {
    referrerHost = document.referrer
      ? new URL(document.referrer).hostname.toLowerCase()
      : "";
  } catch {
    // Ignore malformed or unavailable referrers.
  }
  const utmSource = analyticsScalar(params.get("utm_source"))?.toLowerCase();
  const isChatGptReferral =
    utmSource === "chatgpt.com" ||
    referrerHost === "chatgpt.com" ||
    referrerHost.endsWith(".chatgpt.com");

  let existing = {};
  try {
    existing = JSON.parse(sessionStorage.getItem("rr_campaign") || "{}");
  } catch {
    // Storage may be unavailable or contain invalid data.
  }

  const incoming = {
    campaign_source:
      utmSource || (isChatGptReferral ? "chatgpt.com" : undefined),
    campaign_medium:
      params.get("utm_medium") ||
      (isChatGptReferral ? "referral" : undefined),
    campaign_name: params.get("utm_campaign")
  };
  const hasIncomingCampaign = Object.values(incoming).some(Boolean);
  const campaign = sanitizedAnalyticsProperties({
    ...existing,
    ...(hasIncomingCampaign ? incoming : {}),
    campaign_landing_path:
      existing.campaign_landing_path ||
      (hasIncomingCampaign ? window.location.pathname : undefined)
  });

  try {
    if (Object.values(campaign).some(Boolean)) {
      sessionStorage.setItem("rr_campaign", JSON.stringify(campaign));
    }
    if (
      isChatGptReferral &&
      sessionStorage.getItem("rr_ai_referral_landing_sent") !== "1"
    ) {
      track("ai_referral_landing", {
        referral_source: "chatgpt.com",
        ...campaign
      });
      sessionStorage.setItem("rr_ai_referral_landing_sent", "1");
    }
  } catch {
    // Storage may be unavailable in privacy-restricted environments.
  }
}

function campaignProperties() {
  try {
    const campaign = JSON.parse(sessionStorage.getItem("rr_campaign") || "{}");
    return Object.fromEntries(
      Object.entries(sanitizedAnalyticsProperties(campaign)).filter(([key]) =>
        CAMPAIGN_PROPERTY_KEYS.has(key)
      )
    );
  } catch {
    return {};
  }
}

function setupMenu() {
  const toggle = document.querySelector("[data-menu-toggle]");
  const menu = document.querySelector("[data-mobile-menu]");
  if (!toggle || !menu) return;

  const background = [
    document.querySelector(".utility"),
    document.querySelector("main"),
    document.querySelector(".site-footer"),
    document.querySelector(".mobile-conversion")
  ].filter(Boolean);
  const desktopBreakpoint = window.matchMedia("(min-width: 1101px)");
  const focusable = () => [
    toggle,
    ...menu.querySelectorAll('a[href], button:not([disabled]), summary')
  ];
  const syncPosition = () => {
    const header = document.querySelector("[data-header]");
    if (!header || menu.hidden) return;
    menu.style.setProperty(
      "--menu-top",
      `${Math.max(0, Math.round(header.getBoundingClientRect().bottom))}px`
    );
  };
  const setBackgroundInert = (inert) => {
    background.forEach((element) => {
      element.inert = inert;
    });
  };

  const close = () => {
    toggle.setAttribute("aria-expanded", "false");
    toggle.querySelector(".sr-only").textContent = "Open menu";
    menu.hidden = true;
    menu.style.removeProperty("--menu-top");
    setBackgroundInert(false);
    document.body.classList.remove("menu-open");
  };

  const open = () => {
    toggle.setAttribute("aria-expanded", "true");
    toggle.querySelector(".sr-only").textContent = "Close menu";
    menu.hidden = false;
    syncPosition();
    setBackgroundInert(true);
    document.body.classList.add("menu-open");
    menu.querySelector("a")?.focus();
  };

  toggle.addEventListener("click", () => {
    toggle.getAttribute("aria-expanded") === "true" ? close() : open();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !menu.hidden) {
      close();
      toggle.focus();
      return;
    }

    if (event.key === "Tab" && !menu.hidden) {
      const items = focusable();
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  menu.addEventListener("click", (event) => {
    if (event.target.closest("a")) close();
  });

  window.addEventListener("scroll", syncPosition, { passive: true });
  window.addEventListener("resize", syncPosition);
  desktopBreakpoint.addEventListener("change", (event) => {
    if (event.matches && !menu.hidden) close();
  });
}

function setupEventTracking() {
  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-event]");
    if (!target) return;
    track(target.dataset.event, {
      CTA_position: target.dataset.position || undefined,
      service_interest: target.dataset.service || undefined,
      intent: target.dataset.intent || undefined,
      resource: target.dataset.resource || undefined,
      ...campaignProperties()
    });
  });
}

function setupDetails() {
  const dropdowns = [...document.querySelectorAll(".nav-dropdown")];
  document.addEventListener("click", (event) => {
    dropdowns.forEach((detail) => {
      if (!detail.contains(event.target)) detail.removeAttribute("open");
    });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    dropdowns.forEach((detail) => {
      if (!detail.open) return;
      detail.removeAttribute("open");
      detail.querySelector("summary")?.focus();
    });
  });
}

function setupActiveNavigation() {
  const path = window.location.pathname;
  document
    .querySelectorAll(
      ".desktop-nav > a, .nav-dropdown__panel a, .mobile-menu a"
    )
    .forEach((link) => {
      const destination = new URL(link.href, window.location.origin);
      const isCurrent = destination.origin === window.location.origin &&
        !destination.hash && destination.pathname === path;
      if (isCurrent) {
        link.classList.add("is-active");
        link.setAttribute("aria-current", "page");
      }
    });

  if (path.startsWith("/services/")) {
    const serviceSummary = document.querySelector(".nav-dropdown > summary");
    serviceSummary?.classList.add("is-active");
    const mobileServiceGroup = document.querySelector(
      "[data-mobile-service-group]"
    );
    if (mobileServiceGroup) mobileServiceGroup.open = true;
  }
}

// Wave 2 signature 1/3 — once per session the hero photo settles from
// scale(1.04), the headline words rise in a 3-step stagger, and a gold rule
// draws under "Standard.". Repeat visits fade in over 300ms. Reduced motion
// (or no JS) keeps the static hero: hidden states hang off classes set here.
function setupHeroSignature() {
  const heading = document.querySelector(".home-hero h1");
  if (!heading || REDUCED_MOTION.matches) return;

  const goldWord = heading.querySelector("span:not(.hero-mobile-break)");
  let played = null;
  try {
    played = sessionStorage.getItem("rr_hero_played");
  } catch {
    // Without storage every visit plays the full sequence.
  }

  if (played) {
    goldWord?.classList.add("hero-word--gold");
    document.documentElement.classList.add("hero-replay");
    return;
  }
  try {
    sessionStorage.setItem("rr_hero_played", "1");
  } catch {
    // Ignore; the flag only trims repeat plays.
  }

  // The photo ease starts only once the image is loaded, so the largest
  // paint always lands on a still layer (LCP-safe on slow connections).
  const photo = document.querySelector(".home-hero__image");
  if (photo) {
    const go = () =>
      requestAnimationFrame(() =>
        document.documentElement.classList.add("hero-photo-go")
      );
    if (photo.complete) go();
    else photo.addEventListener("load", go, { once: true });
  }

  // Wrap headline words so the lines can rise in a stagger.
  let wordIndex = 0;
  [...heading.childNodes].forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (!node.textContent.trim()) return;
      const fragment = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (!part.trim()) {
          fragment.append(part);
          return;
        }
        const word = document.createElement("span");
        word.className = "hero-word";
        word.style.setProperty("--word-index", String(wordIndex++));
        word.textContent = part;
        fragment.append(word);
      });
      node.replaceWith(fragment);
    } else if (node === goldWord) {
      node.classList.add("hero-word--gold");
      node.style.setProperty("--word-index", String(wordIndex++));
    }
  });
  document.documentElement.classList.add("hero-first-run");
}

function setupRevealMotion() {
  const targets = document.querySelectorAll(
    [
      ".section-heading",
      ".intent-grid > a",
      ".service-card",
      ".standard-grid article",
      ".process-grid li",
      ".proof-layout",
      ".storm-panel__copy > *",
      ".reputation-card",
      ".about-preview__grid > div",
      ".service-area-preview__grid",
      ".faq-item",
      ".project-index a",
      ".project-chapter__header",
      ".project-figure",
      ".project-proof-note",
      ".project-field__copy > *",
      ".project-field__media",
      ".reviews-hero__copy > *",
      ".reviews-source-panel > *",
      ".final-cta__inner"
    ].join(",")
  );

  if (
    !("IntersectionObserver" in window) ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    targets.forEach((target) => target.classList.add("is-revealed"));
    return;
  }

  document.documentElement.classList.add("motion-ready");
  targets.forEach((target, index) => {
    target.classList.add("reveal");
    target.style.setProperty("--reveal-order", String(index % 5));
  });

  // Wave 2 signature 2/3 — as each major section enters, a gold line draws
  // along its top edge; the eyebrow and gold numerals follow. Rule elements
  // exist only on this motion path, so static renders are untouched.
  const dividerSections = document.querySelectorAll(
    "main > .section, main > .storm-panel, main > .final-cta"
  );
  dividerSections.forEach((section) => {
    section.classList.add("section-divider");
    section.insertAdjacentHTML(
      "afterbegin",
      '<span class="section-rule" aria-hidden="true"></span>'
    );
  });

  // Edge-triggered (threshold 0): a divider draws as its section's top edge
  // enters, independent of section height — the reveal observer's area
  // threshold would stall on tall sections.
  const dividerObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-drawn");
        dividerObserver.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0 }
  );

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-revealed");
        observer.unobserve(entry.target);
        const cleanup = () => {
          entry.target.classList.remove("reveal");
          entry.target.style.removeProperty("--reveal-order");
          entry.target.removeEventListener("transitionend", onTransitionEnd);
        };
        const onTransitionEnd = (event) => {
          if (event.propertyName === "translate") cleanup();
        };
        entry.target.addEventListener("transitionend", onTransitionEnd);
        window.setTimeout(cleanup, 1200);
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
  );

  targets.forEach((target) => observer.observe(target));
  dividerSections.forEach((section) => dividerObserver.observe(section));
}

// Wave 2 signature 3/3 — primary gold CTAs lean toward a fine pointer (max
// 6px, lerped) and spring back on leave; the arrow nudges via is-magnetic.
// Touch gets only the CSS press state; reduced motion disables it entirely.
function setupCtaMagnet() {
  if (!FINE_POINTER.matches || REDUCED_MOTION.matches) return;
  const clamp = (value) => Math.max(-6, Math.min(6, value));

  document.querySelectorAll(".button--primary").forEach((button) => {
    let frame = 0;
    let engaged = false;
    let rect = null;
    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;

    const step = () => {
      x += (targetX - x) * 0.16;
      y += (targetY - y) * 0.16;
      if (!engaged && Math.abs(x) < 0.12 && Math.abs(y) < 0.12) {
        button.style.transform = "";
        frame = 0;
        return;
      }
      button.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
      frame = requestAnimationFrame(step);
    };
    const run = () => {
      if (!frame) frame = requestAnimationFrame(step);
    };
    const release = () => {
      engaged = false;
      targetX = 0;
      targetY = 0;
      button.classList.remove("is-magnetic");
      run();
    };

    button.addEventListener("pointerenter", (event) => {
      if (event.pointerType !== "mouse" || REDUCED_MOTION.matches) return;
      engaged = true;
      // Measure once while untransformed so the pull has a stable origin.
      rect = button.getBoundingClientRect();
      button.classList.add("is-magnetic");
      run();
    });
    button.addEventListener("pointermove", (event) => {
      if (!engaged || !rect) return;
      targetX = clamp(((event.clientX - rect.left) / rect.width - 0.5) * 12);
      targetY = clamp(((event.clientY - rect.top) / rect.height - 0.5) * 12);
      run();
    });
    button.addEventListener("pointerleave", release);
    button.addEventListener("pointercancel", release);
  });
}

// Quiet utility motion: one shared gold underline slides between desktop
// nav items under a fine pointer; the CSS per-link underline stands in
// otherwise, and is-active stays the resting marker.
function setupNavUnderline() {
  const nav = document.querySelector(".desktop-nav");
  if (!nav || !FINE_POINTER.matches || REDUCED_MOTION.matches) return;
  const items = [
    ...nav.querySelectorAll(":scope > a, .nav-dropdown > summary")
  ];
  if (!items.length) return;

  const line = document.createElement("span");
  line.className = "nav-underline";
  line.setAttribute("aria-hidden", "true");
  nav.append(line);
  document.documentElement.classList.add("nav-slide");

  let visible = false;
  const place = (item, instant) => {
    const navBox = nav.getBoundingClientRect();
    const box = item.getBoundingClientRect();
    if (instant) line.classList.add("nav-underline--jump");
    line.style.transform = `translate(${(box.left - navBox.left).toFixed(1)}px, ${(
      box.bottom - navBox.top + 12
    ).toFixed(1)}px) scaleX(${box.width.toFixed(1)})`;
    if (instant) {
      void line.offsetWidth;
      line.classList.remove("nav-underline--jump");
    }
  };

  items.forEach((item) => {
    item.addEventListener("pointerenter", () => {
      place(item, !visible);
      visible = true;
      line.style.opacity = "1";
    });
  });
  nav.addEventListener("pointerleave", () => {
    const active = nav.querySelector(
      ":scope > a.is-active, .nav-dropdown > summary.is-active"
    );
    if (active && visible) place(active, false);
    visible = false;
    line.style.opacity = "0";
  });
}

function setupImageFallbacks() {
  document.querySelectorAll("img").forEach((image) => {
    image.addEventListener("error", () => {
      image.hidden = true;
      image.parentElement?.classList.add("image-missing");
    });
  });
}

function setupMobileConversion() {
  const bar = document.querySelector(".mobile-conversion");
  if (!bar) return;

  const mobile = window.matchMedia("(max-width: 560px)");
  const sync = () => {
    if (!mobile.matches) {
      bar.classList.remove("is-managed", "is-visible");
      return;
    }

    bar.classList.add("is-managed");
    const hero = document.querySelector(
      ".home-hero, .project-hero, .page-hero, .reviews-hero, .contact-hero"
    );
    const revealPoint = hero
      ? Math.min(hero.offsetHeight * 0.55, 620)
      : 320;
    bar.classList.toggle("is-visible", window.scrollY > revealPoint);
  };

  window.addEventListener("scroll", sync, { passive: true });
  window.addEventListener("resize", sync);
  mobile.addEventListener("change", sync);
  sync();
}

function setupForm() {
  const form = document.querySelector("[data-form]");
  if (!form) return;
  const status = form.querySelector("[data-form-status]");
  const formType = form.dataset.formType || "project_request";
  const steps = [...form.querySelectorAll("[data-form-step]")];
  const progress = [...form.querySelectorAll("[data-progress-step]")];
  const submitButton = form.querySelector("[data-form-submit]");
  const submitLabel = form.querySelector("[data-submit-label]");
  const startedAt = form.querySelector("[data-form-started-at]");
  const submissionId = form.querySelector("[data-submission-id]");
  let started = false;
  let currentStep = 0;
  let submitting = false;

  if (startedAt) startedAt.value = String(Date.now());
  if (submitButton?.hasAttribute("data-disabled-until-enhanced")) {
    submitButton.disabled = false;
  }

  const stepProperties = (index) => ({
    form_type: formType,
    step_number: index + 1,
    step_name: steps[index]?.dataset.stepName || `step_${index + 1}`
  });

  const setStatus = (message = "", state = "") => {
    if (!status) return;
    status.innerHTML = message;
    if (state) status.dataset.state = state;
    else delete status.dataset.state;
  };

  const showStep = (index, { focus = false, trackView = false } = {}) => {
    if (!steps.length) return;
    currentStep = Math.max(0, Math.min(index, steps.length - 1));
    steps.forEach((step, stepIndex) => {
      step.hidden = stepIndex !== currentStep;
    });
    progress.forEach((item, itemIndex) => {
      item.classList.toggle("is-active", itemIndex === currentStep);
      item.classList.toggle("is-complete", itemIndex < currentStep);
      if (itemIndex === currentStep) item.setAttribute("aria-current", "step");
      else item.removeAttribute("aria-current");
    });
    setStatus();
    if (trackView) {
      track("quote_form_step_view", {
        ...stepProperties(currentStep),
        ...campaignProperties()
      });
    }
    if (focus) {
      steps[currentStep]
        ?.querySelector("input:not([type='hidden']), select, textarea")
        ?.focus();
    }
  };

  const validationMessage = (field) => {
    if (field.type === "checkbox" && !field.checked) {
      return "Please confirm before submitting.";
    }
    if (field.required && !field.value.trim()) {
      return "This field is required.";
    }
    if (
      field.type === "email" &&
      field.value.trim() &&
      !field.validity.valid
    ) {
      return "Enter a valid email address.";
    }
    if (
      field.type === "tel" &&
      field.value.replace(/\D/g, "").length < 10
    ) {
      return "Enter a 10-digit phone number.";
    }
    if (field.validity?.patternMismatch && field.name === "postal_code") {
      return "Enter a valid 5-digit ZIP code.";
    }
    return "";
  };

  const renderFieldError = (field, message, { trackError = false } = {}) => {
    const error = form.querySelector(`#${field.id || field.name}-error`);
    field.setAttribute("aria-invalid", message ? "true" : "false");
    if (error) error.textContent = message;
    if (message && trackError) {
      track("form_field_error", {
        form_type: formType,
        field_name: field.name
      });
    }
  };

  form.addEventListener("input", (event) => {
    if (!started) {
      started = true;
      track("form_start", { form_type: formType, ...campaignProperties() });
      if (steps.length) {
        track("quote_form_step_view", {
          ...stepProperties(currentStep),
          ...campaignProperties()
        });
      }
    }
    if (event.target.matches("input, select, textarea")) {
      renderFieldError(event.target, validationMessage(event.target));
    }
  });

  const validate = (scope = form) => {
    let valid = true;
    const fields = [
      ...new Set([
        ...scope.querySelectorAll("[required]"),
        ...scope.querySelectorAll('input[type="email"]'),
        ...scope.querySelectorAll('input[type="tel"]'),
        ...scope.querySelectorAll("input[pattern]")
      ])
    ];
    fields.forEach((field) => {
      const message = validationMessage(field);
      renderFieldError(field, message, { trackError: true });
      if (message) {
        valid = false;
      }
    });
    return valid;
  };

  form.classList.add("is-enhanced");
  showStep(0);

  form.querySelectorAll("[data-form-next]").forEach((button) => {
    button.addEventListener("click", () => {
      const step = button.closest("[data-form-step]");
      const index = steps.indexOf(step);
      setStatus();
      if (!validate(step)) {
        setStatus(
          "Please complete the highlighted fields before continuing.",
          "error"
        );
        step.querySelector('[aria-invalid="true"]')?.focus();
        return;
      }
      track("quote_form_step_complete", {
        ...stepProperties(index),
        ...campaignProperties()
      });
      showStep(index + 1, { focus: true, trackView: true });
    });
  });

  form.querySelectorAll("[data-form-back]").forEach((button) => {
    button.addEventListener("click", () => {
      const step = button.closest("[data-form-step]");
      showStep(steps.indexOf(step) - 1, { focus: true, trackView: true });
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submitting) return;
    setStatus();

    if (!validate()) {
      const firstInvalid = form.querySelector('[aria-invalid="true"]');
      const invalidStep = firstInvalid?.closest("[data-form-step]");
      const invalidIndex = steps.indexOf(invalidStep);
      if (invalidIndex >= 0) showStep(invalidIndex);
      setStatus(
        "Please review the highlighted fields and try again.",
        "error"
      );
      firstInvalid?.focus();
      return;
    }

    if (form.dataset.endpointConfigured !== "true") {
      track("form_submit_error", {
        form_type: formType,
        error_type: "endpoint_not_configured"
      });
      setStatus(
        'Secure lead delivery is not connected in this preview. Your information has not been sent. Please call <a href="tel:+12245006825" data-event="phone_click" data-position="form_error">(224) 500-6825</a> to start the request.',
        "error"
      );
      status?.focus();
      return;
    }

    submitting = true;
    form.setAttribute("aria-busy", "true");
    if (submitButton) submitButton.disabled = true;
    if (submitLabel) submitLabel.textContent = "Sending Securely…";
    setStatus("Sending your request securely…", "loading");

    if (submissionId) {
      submissionId.value =
        globalThis.crypto?.randomUUID?.() ||
        `rr-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    const formData = new FormData(form);
    Object.entries(campaignProperties()).forEach(([key, value]) => {
      if (value) formData.set(key, value);
    });
    formData.set("source_page", window.location.pathname);
    formData.set("submitted_at", new Date().toISOString());
    const payload = Object.fromEntries(formData.entries());

    track("form_submit_attempt", {
      form_type: formType,
      service_interest: form.elements.service?.value || undefined,
      ...campaignProperties()
    });

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(form.action, {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        credentials: "same-origin",
        signal: controller.signal
      });
      if (!response.ok) {
        throw new Error(`Lead endpoint returned ${response.status}`);
      }

      track("form_submit_success", {
        form_type: formType,
        service_interest: form.elements.service?.value || undefined,
        property_type: form.elements.property_type?.value || undefined,
        ...campaignProperties()
      });
      setStatus("Your request was received. Opening confirmation…", "success");
      window.location.assign(form.dataset.successPath || "/thank-you/");
    } catch (error) {
      track("form_submit_error", {
        form_type: formType,
        error_type:
          error?.name === "AbortError" ? "delivery_timeout" : "delivery_failed"
      });
      setStatus(
        'We could not confirm secure delivery, so your request is not marked as sent. Please call <a href="tel:+12245006825" data-event="phone_click" data-position="form_error">(224) 500-6825</a> and the team will help directly.',
        "error"
      );
      status?.focus();
      submitting = false;
      form.removeAttribute("aria-busy");
      if (submitButton) submitButton.disabled = false;
      if (submitLabel) submitLabel.textContent = "Submit Quote Request";
    } finally {
      window.clearTimeout(timeout);
    }
  });
}

if (!["localhost", "127.0.0.1"].includes(window.location.hostname)) {
  injectVercelAnalytics({ mode: "production" });
}
persistCampaign();
setupMenu();
setupEventTracking();
setupDetails();
setupActiveNavigation();
setupHeroSignature();
setupRevealMotion();
setupCtaMagnet();
setupNavUnderline();
setupImageFallbacks();
setupMobileConversion();
setupForm();
// Double-rAF: the first frame commits the pre-reveal state (rAF callbacks
// run before style recalc, so a single rAF would land in the same recalc as
// the classes set above and skip every hero transition); the second starts
// the choreography.
requestAnimationFrame(() =>
  requestAnimationFrame(() => document.body.classList.add("page-ready"))
);
