import {
  aboveStandard,
  assurancePaths,
  business,
  faqs,
  founder,
  navigation,
  processSteps,
  proof,
  selectedWork,
  services,
  trustSignals
} from "./data.mjs";
import { resourceArticles } from "./resources.mjs";

const idPixelScriptSrc =
  "https://cdn.idpixel.app/v1/idp-analytics-6a57c20f5c012440693ab2b9.min.js";

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const plainText = (value = "") =>
  String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const icon = (name, className = "") => {
  const paths = {
    arrow:
      '<path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    phone:
      '<path d="M8.2 4.5 5.9 6.8c-.9.9.3 3.6 2.7 6s5.1 3.6 6 2.7l2.3-2.3-3-2-1.3 1.3c-.7.7-3.3-1.9-2.6-2.6l1.3-1.3-3.1-2.1Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
    shield:
      '<path d="M12 3 5.5 5.5v5.2c0 4.2 2.6 7.9 6.5 9.4 3.9-1.5 6.5-5.2 6.5-9.4V5.5L12 3Z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m9 11.5 2 2 4-4" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    eye:
      '<path d="M3 12s3.2-5 9-5 9 5 9 5-3.2 5-9 5-9-5-9-5Z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    wrench:
      '<path d="M14.5 6.1a4 4 0 0 0-5 5L4 16.6 7.4 20l5.5-5.5a4 4 0 0 0 5-5l-2.5 2.4-2.3-2.3 2.4-2.5Z" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    home:
      '<path d="m3 11 9-7 9 7M6 9.5V20h12V9.5M10 20v-6h4v6" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    target:
      '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="1.25" fill="currentColor"/>',
    clock:
      '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 7v5l3.2 2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
    check:
      '<path d="m5 12 4 4L19 6" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    menu:
      '<path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    close:
      '<path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="1.8"/>'
  };
  return `<svg class="icon ${className}" aria-hidden="true" viewBox="0 0 24 24">${paths[name] || paths.arrow}</svg>`;
};

export const button = ({
  href,
  label,
  variant = "primary",
  event = "inspection_cta_click",
  position = "content",
  intent = ""
}) =>
  `<a class="button button--${variant}" href="${href}" data-event="${event}" data-position="${position}"${intent ? ` data-intent="${escapeHtml(intent)}"` : ""}><span>${escapeHtml(label)}</span>${icon("arrow")}</a>`;

export const quoteHref = "/contact/?intent=quote#inspection-form";

export const quoteCta = ({
  label = "Get My Instant Quote",
  variant = "primary",
  position = "content"
} = {}) =>
  button({
    href: quoteHref,
    label,
    variant,
    event: "quote_cta_click",
    position,
    intent: "quote"
  });

const logo = ({ footer = false } = {}) => `
  <a class="brand-logo${footer ? " brand-logo--footer" : ""}" href="/" aria-label="Raccoon Restoration home">
    <picture>
      <img
        src="/assets/raccoon-restoration-logo-bahnschrift-480.png"
        srcset="/assets/raccoon-restoration-logo-bahnschrift-480.png 480w, /assets/raccoon-restoration-logo-bahnschrift-960.png 960w"
        sizes="${footer ? "320px" : "(max-width: 900px) 190px, 232px"}"
        alt="Raccoon Restoration"
        width="480"
        height="160"${footer ? ' loading="lazy"' : ""}
        decoding="async"
      >
    </picture>
  </a>`;

const serviceDropdown = () => `
  <details class="nav-dropdown">
    <summary>Services <span aria-hidden="true">+</span></summary>
    <div class="nav-dropdown__panel">
      ${services
        .map(
          (service) =>
            `<a href="/services/${service.slug}/"><span>${escapeHtml(service.name)}</span>${icon("arrow")}</a>`
        )
        .join("")}
      <a href="/services/"><span>View all services</span>${icon("arrow")}</a>
    </div>
  </details>`;

const header = () => `
  <div class="utility">
    <div class="shell utility__inner">
      <span>Serving Greater Chicago from Barrington, Illinois</span>
      <span class="utility__license">${escapeHtml(business.license)}</span>
      <a href="tel:${business.phoneHref}" data-event="phone_click" data-position="utility">${icon("phone")}${business.phoneDisplay}</a>
    </div>
  </div>
  <header class="site-header" data-header>
    <div class="shell site-header__inner">
      ${logo()}
      <nav class="desktop-nav" aria-label="Primary navigation">
        ${serviceDropdown()}
        ${navigation
          .filter((item) => item.label !== "Services")
          .map((item) => `<a href="${item.href}">${escapeHtml(item.label)}</a>`)
          .join("")}
      </nav>
      <div class="site-header__actions">
        ${quoteCta({ position: "header" })}
        <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="mobile-menu" data-menu-toggle>
          <span class="sr-only">Open menu</span>${icon("menu", "menu-open")}${icon("close", "menu-close")}
        </button>
      </div>
    </div>
    <nav class="mobile-menu" id="mobile-menu" aria-label="Mobile navigation" data-mobile-menu hidden>
      <div class="shell mobile-menu__inner">
        <p class="eyebrow">Roofing &amp; Restoration</p>
        <a class="mobile-menu__phone" href="tel:${business.phoneHref}" data-event="phone_click" data-position="mobile_menu">${icon("phone")}<span>Call ${business.phoneDisplay}</span>${icon("arrow")}</a>
        <a class="mobile-menu__quote" href="${quoteHref}" data-event="quote_cta_click" data-position="mobile_menu" data-intent="quote"><span>Get My Instant Quote</span>${icon("arrow")}</a>
        <details class="mobile-menu__group" data-mobile-service-group>
          <summary><span>Services</span>${icon("arrow")}</summary>
          <div>
            <a href="/services/">All Services${icon("arrow")}</a>
            ${services
              .map(
                (service) =>
                  `<a href="/services/${service.slug}/">${escapeHtml(service.name)}${icon("arrow")}</a>`
              )
              .join("")}
          </div>
        </details>
        ${navigation
          .filter((item) => item.label !== "Services")
          .map((item) => `<a href="${item.href}">${escapeHtml(item.label)}${icon("arrow")}</a>`)
          .join("")}
      </div>
    </nav>
  </header>`;

const footer = () => `
  <footer class="site-footer pattern">
    <div class="shell footer-grid">
      <div class="footer-brand">
        ${logo({ footer: true })}
        <p>Premium roofing and restoration across Greater Chicago, headquartered in Barrington, Illinois.</p>
        <p class="footer-license">${escapeHtml(business.license)}</p>
      </div>
      <div>
        <h2>Services</h2>
        ${services
          .map(
            (service) =>
              `<a href="/services/${service.slug}/">${escapeHtml(service.name)}</a>`
          )
          .join("")}
      </div>
      <div>
        <h2>Company</h2>
        <a href="/about/">About</a>
        <a href="/process/">Our Process</a>
        <a href="/projects/">Projects</a>
        <a href="/reviews/">Reviews</a>
        <a href="/resources/">Roofing Resources</a>
        <a href="/service-areas/">Service Areas</a>
        <a href="/warranty/">Warranty</a>
        <a href="/faq/">FAQ</a>
      </div>
      <div>
        <h2>Start here</h2>
        <a href="tel:${business.phoneHref}" data-event="phone_click" data-position="footer">${business.phoneDisplay}</a>
        <a href="mailto:${business.email}" data-event="email_click" data-position="footer">${business.email}</a>
        <span>Greater Chicago · Barrington headquarters</span>
        <a href="${quoteHref}" data-event="quote_cta_click" data-position="footer" data-intent="quote">Get my instant quote</a>
      </div>
    </div>
    <div class="shell footer-bottom">
      <span>© ${new Date().getFullYear()} Raccoon Restoration</span>
      <nav aria-label="Legal">
        <a href="/privacy/">Privacy</a>
        <a href="/terms/">Terms</a>
        <a href="/accessibility/">Accessibility</a>
      </nav>
    </div>
  </footer>
  <nav class="mobile-conversion" aria-label="Quick actions">
    <a href="tel:${business.phoneHref}" data-event="mobile_sticky_call_click" data-position="sticky">${icon("phone")}Call Now</a>
    <a href="${quoteHref}" data-event="quote_cta_click" data-position="sticky" data-intent="quote">${icon("arrow")}Instant Quote</a>
  </nav>`;

const structuredData = ({
  pageType,
  title,
  description,
  path,
  service,
  faqItems = [],
  article = null
}) => {
  const graph = [
    {
      "@type": "RoofingContractor",
      "@id": `${business.siteUrl}/#organization`,
      name: business.name,
      url: business.siteUrl,
      logo: {
        "@type": "ImageObject",
        url: `${business.siteUrl}/assets/raccoon-restoration-logo-bahnschrift-960.png`,
        width: 960,
        height: 320
      },
      image: `${business.siteUrl}/assets/images/hero-home.jpg`,
      telephone: business.phoneHref,
      email: business.email,
      slogan: business.slogan,
      contactPoint: {
        "@type": "ContactPoint",
        telephone: business.phoneHref,
        email: business.email,
        contactType: "customer service",
        areaServed: "US-IL",
        availableLanguage: ["English"]
      },
      address: {
        "@type": "PostalAddress",
        addressLocality: business.city,
        addressRegion: business.state,
        addressCountry: "US"
      },
      areaServed: [
        {
          "@type": "AdministrativeArea",
          name: "Greater Chicago Area"
        },
        {
          "@type": "City",
          name: "Barrington, Illinois"
        }
      ],
      hasCredential: {
        "@type": "EducationalOccupationalCredential",
        credentialCategory: "Roofing contractor license",
        name: business.license,
        recognizedBy: {
          "@type": "Organization",
          name: "Illinois Department of Financial and Professional Regulation",
          url: "https://idfpr.illinois.gov/profs/roof.html"
        }
      },
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "Roofing and restoration services",
        itemListElement: services.map((item) => ({
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: item.name,
            url: `${business.siteUrl}/services/${item.slug}/`,
            provider: { "@id": `${business.siteUrl}/#organization` }
          }
        }))
      },
      knowsAbout: [
        "Residential roofing",
        "Commercial roofing",
        "Storm damage restoration",
        "Storm damage assessment",
        "Insurance-related repair estimating",
        "Contractor-side storm documentation",
        "Water and flood damage assessments",
        "Siding and gutters",
        "Interior restoration",
        "Windows and doors"
      ],
      sameAs: [
        "https://www.bbb.org/us/il/barrington/profile/roofing-consultants/raccoon-restoration-0654-90025835",
        "https://www.gaf.com/en-us/roofing-contractors/residential/usa/il/barrington/raccoon-restoration-1151998",
        "https://www.instagram.com/raccoonrestoration/",
        "https://www.facebook.com/Raccoon-Restoration"
      ]
    },
    {
      "@type": "WebSite",
      "@id": `${business.siteUrl}/#website`,
      url: business.siteUrl,
      name: business.name,
      publisher: { "@id": `${business.siteUrl}/#organization` }
    },
    {
      "@type": "WebPage",
      "@id": `${business.siteUrl}${path}#webpage`,
      url: `${business.siteUrl}${path}`,
      name: title,
      description,
      isPartOf: { "@id": `${business.siteUrl}/#website` },
      about: { "@id": `${business.siteUrl}/#organization` }
    }
  ];

  if (path !== "/") {
    const segmentLabels = {
      services: "Services",
      "roof-replacement": "Roof Replacement",
      "roof-repair": "Roof Repair",
      "storm-damage-restoration": "Storm Damage Restoration",
      "gutters-exteriors": "Gutters & Exteriors",
      projects: "Projects",
      reviews: "Reviews",
      about: "About",
      process: "Our Process",
      "service-areas": "Service Areas",
      "barrington-il": "Barrington, IL",
      resources: "Roofing Resources",
      "choose-roofing-contractor-greater-chicago":
        "Choosing a Roofing Contractor",
      "roof-repair-vs-replacement-chicago": "Repair or Replacement",
      "storm-damage-roof-assessment-illinois": "Storm-Damage Assessment",
      "ice-dams-attic-ventilation-chicago": "Ice Dams & Ventilation",
      "roof-replacement-process-what-to-expect":
        "Roof Replacement Process",
      faq: "FAQ",
      warranty: "Warranty",
      financing: "Financing",
      contact: "Contact",
      privacy: "Privacy Policy",
      terms: "Website Terms",
      accessibility: "Accessibility Statement"
    };
    const parts = path.split("/").filter(Boolean).filter((part) => part !== "404.html");
    const itemListElement = [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${business.siteUrl}/`
      },
      ...parts.map((part, index) => ({
        "@type": "ListItem",
        position: index + 2,
        name:
          article && index === parts.length - 1
            ? article.shortTitle
            : segmentLabels[part] || (index === parts.length - 1 ? title : part),
        item: `${business.siteUrl}/${parts.slice(0, index + 1).join("/")}/`
      }))
    ];
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement
    });
  }

  if (service) {
    graph.push({
      "@type": "Service",
      name: service.name,
      description: service.summary,
      url: `${business.siteUrl}${path}`,
      provider: { "@id": `${business.siteUrl}/#organization` },
      areaServed: [
        {
          "@type": "AdministrativeArea",
          name: "Greater Chicago Area"
        },
        {
          "@type": "City",
          name: "Barrington, Illinois"
        }
      ]
    });
  }

  if (article) {
    const citations = article.sections
      .flatMap((section) => section.links || [])
      .map((link) => link.href)
      .filter((href) => /^https?:\/\//.test(href));
    graph.push({
      "@type": "Article",
      headline: article.title,
      description: article.description,
      datePublished: article.datePublished,
      dateModified: article.dateModified,
      image: {
        "@type": "ImageObject",
        url: `${business.siteUrl}/assets/raccoon-restoration-social-preview.png`,
        width: 1200,
        height: 630
      },
      mainEntityOfPage: { "@id": `${business.siteUrl}${path}#webpage` },
      author: {
        "@type": "Organization",
        name: "Raccoon Restoration Editorial Team",
        url: `${business.siteUrl}/about/`
      },
      publisher: { "@id": `${business.siteUrl}/#organization` },
      ...(citations.length ? { citation: citations } : {})
    });
  }

  if (pageType === "services" || pageType === "resources") {
    const items =
      pageType === "services"
        ? services.map((item) => ({
            name: item.name,
            url: `${business.siteUrl}/services/${item.slug}/`
          }))
        : resourceArticles.map((item) => ({
            name: item.title,
            url: `${business.siteUrl}/resources/${item.slug}/`
          }));
    graph.push({
      "@type": "ItemList",
      name:
        pageType === "services"
          ? "Raccoon Restoration Services"
          : "Raccoon Restoration Roofing Resources",
      itemListElement: items.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        url: item.url
      }))
    });
  }

  if (faqItems.length) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: faqItems.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.a
        }
      }))
    });
  }

  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph });
};

export const layout = ({
  title,
  description,
  path,
  body,
  pageType = "content",
  service = null,
  faqItems = [],
  socialImage = "/assets/raccoon-restoration-social-preview.png",
  socialImageAlt =
    "Raccoon Restoration — Built Above Standard, serving Greater Chicago from Barrington, Illinois",
  socialImageWidth = 1200,
  socialImageHeight = 630,
  article = null,
  noindex = false
}) => {
  const fullTitle =
    path === "/"
      ? `Barrington & Greater Chicago Roofing | ${business.name}`
      : `${title} | ${business.name}`;
  const canonical = `${business.siteUrl}${path}`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(fullTitle)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="theme-color" content="#0D0D0D">
  <meta name="robots" content="${noindex ? "noindex,nofollow" : "index,follow,max-image-preview:large"}">
  <link rel="canonical" href="${canonical}">
  <link rel="icon" href="/assets/favicon-48.png" type="image/png" sizes="48x48">
  <link rel="icon" href="/assets/favicon-512.png" type="image/png" sizes="512x512">
  <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png" sizes="180x180">
  <link rel="preload" href="/assets/fonts/bebas-neue-v16-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/assets/fonts/montserrat-v31-latin-wght.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/assets/styles.css">
  <meta property="og:type" content="${article ? "article" : "website"}">
  <meta property="og:locale" content="en_US">
  <meta property="og:site_name" content="${escapeHtml(business.name)}">
  <meta property="og:title" content="${escapeHtml(fullTitle)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${business.siteUrl}${socialImage}">
  <meta property="og:image:alt" content="${escapeHtml(socialImageAlt)}">
  <meta property="og:image:width" content="${socialImageWidth}">
  <meta property="og:image:height" content="${socialImageHeight}">
  ${
    article
      ? `<meta property="article:published_time" content="${article.datePublished}">
  <meta property="article:modified_time" content="${article.dateModified}">`
      : ""
  }
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(fullTitle)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${business.siteUrl}${socialImage}">
  <meta name="twitter:image:alt" content="${escapeHtml(socialImageAlt)}">
  <script defer src="${idPixelScriptSrc}" data-analytics-provider="idpixel"></script>
  <script type="application/ld+json">${structuredData({
    pageType,
    title,
    description,
    path,
    service,
    faqItems,
    article
  })}</script>
</head>
<body data-page-type="${pageType}">
  <a class="skip-link" href="#main">Skip to main content</a>
  ${header()}
  <main id="main">${body}</main>
  ${footer()}
  <script type="module" src="/assets/main.js"></script>
</body>
</html>`;
};

export const sectionHeading = ({
  eyebrow,
  title,
  intro = "",
  align = "left",
  invert = false
}) => `
  <div class="section-heading section-heading--${align}${invert ? " section-heading--invert" : ""}">
    <p class="eyebrow">${escapeHtml(eyebrow)}</p>
    <h2>${title}</h2>
    ${intro ? `<p class="section-heading__intro">${escapeHtml(intro)}</p>` : ""}
  </div>`;

export const trustStrip = () => `
  <section class="trust-strip" aria-label="Customer benefits">
    <div class="shell trust-strip__grid">
      ${trustSignals
        .map(
          ({ icon: iconName, label }) =>
            `<div>${icon(iconName)}<span>${escapeHtml(label)}</span></div>`
        )
        .join("")}
    </div>
  </section>`;

export const servicesGrid = () => `
  <div class="service-grid">
    ${services
      .map(
        (service, index) => `
        <article class="service-card">
          <a class="service-card__image" href="/services/${service.slug}/" data-event="service_card_click" data-service="${service.slug}">
            <picture>
              ${service.cardImageMobile ? `<source media="(max-width: 800px)" srcset="${service.cardImageMobile}" width="${service.cardImageMobileWidth || 800}" height="${service.cardImageMobileHeight || 1000}">` : ""}
              <img
                src="${service.cardImage || service.image}"
                ${service.cardSrcset ? `srcset="${service.cardSrcset}"` : ""}
                ${service.cardSizes ? `sizes="${service.cardSizes}"` : ""}
                alt="${escapeHtml(service.cardImageAlt || service.imageAlt)}"
                width="${service.cardImageWidth || service.imageWidth || 1200}"
                height="${service.cardImageHeight || service.imageHeight || 800}"
                loading="lazy"
                decoding="async"
              >
            </picture>
          </a>
          <div class="service-card__content">
            <span class="service-card__number">0${index + 1}</span>
            <h3><a href="/services/${service.slug}/">${escapeHtml(service.name)}</a></h3>
            <p>${escapeHtml(service.short)}</p>
            <a class="text-link" href="/services/${service.slug}/" data-event="service_card_click" data-service="${service.slug}">Explore service ${icon("arrow")}</a>
          </div>
        </article>`
      )
      .join("")}
  </div>`;

export const processGrid = () => `
  <ol class="process-grid">
    ${processSteps
      .map(
        (step) => `
        <li>
          <span>${step.number}</span>
          <h3>${escapeHtml(step.title)}</h3>
          <p>${escapeHtml(step.text)}</p>
        </li>`
      )
      .join("")}
  </ol>`;

export const aboveStandardGrid = () => `
  <div class="standard-grid">
    ${aboveStandard
      .map(
        (item, index) => `
        <article>
          <span>0${index + 1}</span>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.text)}</p>
        </article>`
      )
      .join("")}
  </div>`;

export const faqList = (items = faqs) => `
  <div class="faq-list">
    ${items
      .map(
        (item, index) => `
        <details class="faq-item"${index === 0 ? " open" : ""}>
          <summary><span>${escapeHtml(item.q)}</span><span aria-hidden="true">+</span></summary>
          <div><p>${escapeHtml(item.a)}</p></div>
        </details>`
      )
      .join("")}
  </div>`;

export const finalCta = ({
  eyebrow = "Expect more from your contractor",
  title = "Ready to build above standard?",
  text = "Tell us what you see. We'll tell you what it means \u2014 and what it doesn't need."
} = {}) => `
  <section class="final-cta pattern">
    <div class="shell final-cta__inner">
      <div>
        <p class="eyebrow">${escapeHtml(eyebrow)}</p>
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(text)}</p>
      </div>
      <div class="button-row">
        ${quoteCta({ position: "final_cta" })}
        ${button({
          href: `tel:${business.phoneHref}`,
          label: `Call ${business.phoneDisplay}`,
          variant: "outline",
          event: "phone_click",
          position: "final_cta"
        })}
      </div>
    </div>
  </section>`;

export const breadcrumbs = (items) => `
  <nav class="breadcrumbs" aria-label="Breadcrumb">
    <ol>
      <li><a href="/">Home</a></li>
      ${items
        .map(
          (item, index) =>
            `<li>${index === items.length - 1 ? `<span aria-current="page">${escapeHtml(item.label)}</span>` : `<a href="${item.href}">${escapeHtml(item.label)}</a>`}</li>`
        )
        .join("")}
    </ol>
  </nav>`;

export const pageHero = ({
  eyebrow,
  title,
  breadcrumbLabel = "",
  breadcrumbItems = null,
  intro,
  primaryHref = quoteHref,
  primaryLabel = "Get My Instant Quote",
  primaryEvent = "quote_cta_click",
  primaryIntent = "quote",
  secondaryHref = `tel:${business.phoneHref}`,
  secondaryLabel = `Call ${business.phoneDisplay}`,
  image = "/assets/images/hero-home.jpg",
  imageMobile = "",
  imageAlt = "",
  imageSrcset = "",
  imageSizes = "",
  imageWidth = 1200,
  imageHeight = 800,
  mediaCaption = "",
  mediaClass = "",
  heroClass = "",
  sidePanel = null,
  proofItems = [],
  compact = false
}) => `
  <section class="page-hero${compact ? " page-hero--compact" : ""}${sidePanel ? " page-hero--with-panel" : ""}${image || sidePanel ? "" : " page-hero--text-only"}${heroClass ? ` ${heroClass}` : ""}">
    <div class="shell">
      ${breadcrumbs(
        breadcrumbItems || [
          { label: breadcrumbLabel || plainText(title), href: "#" }
        ]
      )}
      <div class="page-hero__grid">
        <div class="page-hero__copy">
          <p class="eyebrow">${escapeHtml(eyebrow)}</p>
          <h1>${title}</h1>
          <p>${escapeHtml(intro)}</p>
          <div class="button-row">
            ${button({
              href: primaryHref,
              label: primaryLabel,
              event: primaryEvent,
              position: "page_hero",
              intent: primaryIntent
            })}
            ${button({
              href: secondaryHref,
              label: secondaryLabel,
              variant: "outline",
              event: "phone_click",
              position: "page_hero"
            })}
          </div>
          ${
            proofItems.length
              ? `<ul class="page-hero__proof">
                  ${proofItems.map((item) => `<li>${icon("check")}<span>${escapeHtml(item)}</span></li>`).join("")}
                </ul>`
              : ""
          }
        </div>
        ${
          image
            ? `<figure class="page-hero__media${mediaClass ? ` ${mediaClass}` : ""}">
          <picture>
            ${imageMobile ? `<source media="(max-width: 640px)" srcset="${imageMobile}">` : ""}
            <img
              src="${image}"
              ${imageSrcset ? `srcset="${imageSrcset}"` : ""}
              ${imageSizes ? `sizes="${imageSizes}"` : ""}
              alt="${escapeHtml(imageAlt)}"
              width="${imageWidth}"
              height="${imageHeight}"
              fetchpriority="high"
              decoding="async"
            >
          </picture>
          ${mediaCaption ? `<figcaption>${escapeHtml(mediaCaption)}</figcaption>` : ""}
        </figure>`
            : sidePanel
              ? `<aside class="page-hero__location-panel" aria-label="${escapeHtml(sidePanel.label)}">
          <span class="page-hero__location-mark" aria-hidden="true">${escapeHtml(sidePanel.mark || "B")}</span>
          <div>
            <p class="eyebrow">${escapeHtml(sidePanel.label)}</p>
            <h2>${escapeHtml(sidePanel.title)}</h2>
            <ul>
              ${sidePanel.items
                .map(
                  (item) =>
                    `<li>${icon(item.icon)}<span>${escapeHtml(item.text)}</span></li>`
                )
                .join("")}
            </ul>
          </div>
        </aside>`
            : ""
        }
      </div>
    </div>
  </section>`;

export const inspectionForm = () => {
  const endpointConfigured = Boolean(business.formEndpoint);
  const formAction = endpointConfigured
    ? escapeHtml(business.formEndpoint)
    : "/contact/";

  return `
  <form class="inspection-form" action="${formAction}" method="post" data-form data-form-type="quote_request" data-endpoint-configured="${endpointConfigured}" data-success-path="/thank-you/" novalidate>
    <input type="hidden" name="request_type" value="quote_or_inspection">
    <input type="hidden" name="form_started_at" value="" data-form-started-at>
    <input type="hidden" name="submission_id" value="" data-submission-id>
    <div class="form-honeypot" aria-hidden="true">
      <label for="company-website">Leave this field blank</label>
      <input id="company-website" name="company_website" type="text" tabindex="-1" autocomplete="off">
    </div>

    <ol class="form-progress" aria-label="Quote request progress">
      <li data-progress-step="1"><span>01</span><strong>Property</strong></li>
      <li data-progress-step="2"><span>02</span><strong>Project</strong></li>
      <li data-progress-step="3"><span>03</span><strong>Contact</strong></li>
    </ol>

    <fieldset class="form-step" data-form-step="1" data-step-name="property">
      <legend class="sr-only">Step 1: Property details</legend>
      <div class="form-step__heading">
        <p class="form-step__number">Step 1 of 3</p>
        <h3>Where is the property?</h3>
        <p>The address lets the team confirm service coverage and prepare for the first conversation.</p>
      </div>
      <div class="form-field form-field--full">
        <label for="street-address">Street address <span aria-hidden="true">*</span></label>
        <input id="street-address" name="street_address" type="text" autocomplete="street-address" aria-describedby="street-address-error" required>
        <span class="field-error" id="street-address-error"></span>
      </div>
      <div class="form-field">
        <label for="city">City <span aria-hidden="true">*</span></label>
        <input id="city" name="city" type="text" autocomplete="address-level2" aria-describedby="city-error" required>
        <span class="field-error" id="city-error"></span>
      </div>
      <div class="form-field">
        <label for="postal-code">ZIP code <span aria-hidden="true">*</span></label>
        <input id="postal-code" name="postal_code" type="text" autocomplete="postal-code" inputmode="numeric" maxlength="10" pattern="[0-9]{5}(?:-[0-9]{4})?" aria-describedby="postal-code-error" required>
        <span class="field-error" id="postal-code-error"></span>
      </div>
      <div class="form-field form-field--full">
        <label for="property-type">Property type <span aria-hidden="true">*</span></label>
        <select id="property-type" name="property_type" aria-describedby="property-type-error" required>
          <option value="">Select a property type</option>
          <option value="single-family">Single-family home</option>
          <option value="multifamily">Multifamily property</option>
          <option value="commercial">Commercial property</option>
          <option value="association">HOA or association</option>
          <option value="other">Other</option>
        </select>
        <span class="field-error" id="property-type-error"></span>
      </div>
      <div class="form-step__actions">
        <button class="button button--primary" type="button" data-form-next><span>Continue to Project</span>${icon("arrow")}</button>
      </div>
    </fieldset>

    <fieldset class="form-step" data-form-step="2" data-step-name="project">
      <legend class="sr-only">Step 2: Project details</legend>
      <div class="form-step__heading">
        <p class="form-step__number">Step 2 of 3</p>
        <h3>What can we help with?</h3>
        <p>A few project details help route the request to the right specialist.</p>
      </div>
      <div class="form-field">
        <label for="service">Service needed <span aria-hidden="true">*</span></label>
        <select id="service" name="service" aria-describedby="service-error" required>
          <option value="">Select a service</option>
          ${services.map((service) => `<option value="${service.slug}">${escapeHtml(service.name)}</option>`).join("")}
          <option value="not-sure">I am not sure yet</option>
        </select>
        <span class="field-error" id="service-error"></span>
      </div>
      <div class="form-field">
        <label for="project-timing">Ideal timing <span aria-hidden="true">*</span></label>
        <select id="project-timing" name="project_timing" aria-describedby="project-timing-error" required>
          <option value="">Select timing</option>
          <option value="urgent">Urgent active issue</option>
          <option value="within-30-days">Within 30 days</option>
          <option value="one-to-three-months">1–3 months</option>
          <option value="planning">Planning ahead</option>
          <option value="not-sure">Not sure yet</option>
        </select>
        <span class="field-error" id="project-timing-error"></span>
      </div>
      <div class="form-field form-field--full">
        <label for="claim-stage">Storm or insurance situation <span class="field-optional">(optional)</span></label>
        <select id="claim-stage" name="claim_stage">
          <option value="">Select what best describes it</option>
          <option value="not-claim-related">Not related to an insurance claim</option>
          <option value="storm-no-claim">Storm damage; no claim started</option>
          <option value="claim-opened">A claim has already been opened</option>
          <option value="claim-review">An existing claim needs another review</option>
          <option value="not-sure">I am not sure yet</option>
        </select>
      </div>
      <div class="form-field form-field--full">
        <label for="message">Project details <span class="field-optional">(optional)</span></label>
        <textarea id="message" name="message" rows="4" placeholder="Leak location, roof age, storm date, visible damage, or another useful detail"></textarea>
      </div>
      <div class="form-step__actions form-step__actions--split">
        <button class="button form-back" type="button" data-form-back>${icon("arrow")}<span>Back</span></button>
        <button class="button button--primary" type="button" data-form-next><span>Continue to Contact</span>${icon("arrow")}</button>
      </div>
    </fieldset>

    <fieldset class="form-step" data-form-step="3" data-step-name="contact">
      <legend class="sr-only">Step 3: Contact details</legend>
      <div class="form-step__heading">
        <p class="form-step__number">Step 3 of 3</p>
        <h3>How should we reach you?</h3>
        <p>Enter the contact details for the person coordinating the project.</p>
      </div>
      <div class="form-field">
        <label for="first-name">First name <span aria-hidden="true">*</span></label>
        <input id="first-name" name="first_name" type="text" autocomplete="given-name" aria-describedby="first-name-error" required>
        <span class="field-error" id="first-name-error"></span>
      </div>
      <div class="form-field">
        <label for="last-name">Last name <span aria-hidden="true">*</span></label>
        <input id="last-name" name="last_name" type="text" autocomplete="family-name" aria-describedby="last-name-error" required>
        <span class="field-error" id="last-name-error"></span>
      </div>
      <div class="form-field">
        <label for="phone">Phone number <span aria-hidden="true">*</span></label>
        <input id="phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" aria-describedby="phone-error" required>
        <span class="field-error" id="phone-error"></span>
      </div>
      <div class="form-field">
        <label for="email">Email address <span aria-hidden="true">*</span></label>
        <input id="email" name="email" type="email" autocomplete="email" inputmode="email" aria-describedby="email-error" required>
        <span class="field-error" id="email-error"></span>
      </div>
      <div class="form-field form-field--full">
        <label for="contact-preference">Preferred first response <span class="field-optional">(optional)</span></label>
        <select id="contact-preference" name="contact_preference">
          <option value="">No preference</option>
          <option value="phone">Phone call</option>
          <option value="text">Text message</option>
          <option value="email">Email</option>
        </select>
      </div>
      <div class="form-field form-field--full form-consent">
        <label><input id="consent" type="checkbox" name="consent" value="yes" aria-describedby="consent-error" required> <span>I agree that Raccoon Restoration may contact me by phone, text, or email about this request. Consent is not a condition of purchase. Message and data rates may apply. <span aria-hidden="true">*</span></span></label>
        <span class="field-error" id="consent-error"></span>
      </div>
      <div class="form-step__actions form-step__actions--split">
        <button class="button form-back" type="button" data-form-back>${icon("arrow")}<span>Back</span></button>
        <button class="button button--primary" type="submit" data-form-submit${endpointConfigured ? "" : " data-disabled-until-enhanced disabled"}><span data-submit-label>Submit Quote Request</span>${icon("arrow")}</button>
      </div>
    </fieldset>

    <p class="form-assurance">Secure request. No obligation. Your details are used only to respond to this project.</p>
    <noscript><p class="form-status form-status--noscript">Online delivery requires JavaScript. Please call <a href="tel:${business.phoneHref}">${business.phoneDisplay}</a> to start your request.</p></noscript>
    <div class="form-status" role="status" aria-live="polite" tabindex="-1" data-form-status></div>
  </form>`;
};

export const safeExternalLink = (href, label) =>
  `<a class="text-link" href="${href}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}${icon("arrow")}</a>`;

const proofMark = (mark) => {
  const inner = `
      <span class="reputation-card__mark${mark.icon ? " reputation-card__mark--icon" : ""}" aria-hidden="true">${mark.icon ? icon(mark.icon) : escapeHtml(mark.mark)}</span>
      <div class="proof-mark__body"><h3>${escapeHtml(mark.title)}</h3></div>`;
  return mark.href
    ? `<a class="reputation-card proof-mark proof-mark--link" href="${mark.href}" target="_blank" rel="noopener noreferrer" data-event="review_source_click" data-position="home_proof">${inner}${icon("arrow", "proof-mark__arrow")}</a>`
    : `<div class="reputation-card proof-mark">${inner}</div>`;
};

export const proofQuote = (quote) => `
  <figure class="reputation-card proof-quote">
    <span class="proof-quote__avatar" aria-hidden="true">${escapeHtml(quote.initial)}</span>
    <div class="proof-quote__body">
      <blockquote>“${escapeHtml(quote.quote)}”</blockquote>
      <figcaption>${escapeHtml(quote.name)} · ${escapeHtml(quote.context)}</figcaption>
    </div>
  </figure>`;

export const verifiedQuotes = () =>
  proof.quotes.filter((quote) => quote.verified);

export const proofBand = () => {
  const marks = proof.marks.filter((mark) => mark.verified);
  const quotes = verifiedQuotes();
  if (!marks.length && !quotes.length) return "";
  return `
  <section class="section proof-band">
    <div class="shell">
      ${sectionHeading({
        eyebrow: proof.eyebrow,
        title: proof.title,
        intro: proof.microcopy
      })}
      <div class="proof-band__grid">
        ${marks.length ? `<div class="proof-band__marks">${marks.map(proofMark).join("")}</div>` : ""}
        ${quotes.map(proofQuote).join("")}
      </div>
      <div class="proof-band__footer">
        <a class="text-link" href="${proof.link.href}" data-event="review_source_click" data-position="home_proof">${escapeHtml(proof.link.label)} ${icon("arrow")}</a>
      </div>
    </div>
  </section>`;
};

export const workStrip = () => `
  <section class="section section--dark work-strip">
    <div class="shell">
      <div class="work-strip__header">
        ${sectionHeading({
          eyebrow: "Selected work",
          title: "See the system taking shape.",
          invert: true
        })}
        ${button({
          href: "/projects/",
          label: "Explore Our Projects",
          variant: "outline",
          event: "project_gallery_click",
          position: "home_work_strip"
        })}
      </div>
      <div class="work-strip__row">
        ${selectedWork
          .map(
            (item) => `
          <a class="work-strip__item" href="/projects/" data-event="project_gallery_click" data-position="home_work_strip">
            <span class="work-strip__media">
              <img src="${item.image}" srcset="${item.srcset}" sizes="(max-width: 800px) 78vw, (max-width: 1400px) 31vw, 417px" alt="${escapeHtml(item.alt)}" width="${item.width}" height="${item.height}" loading="lazy" decoding="async">
            </span>
            <span class="work-strip__caption">${escapeHtml(item.caption)}</span>
          </a>`
          )
          .join("")}
      </div>
    </div>
  </section>`;

export const assuranceBand = () => `
  <section class="section section--cream assurance-band" aria-label="Financing and warranty guidance">
    <div class="shell">
      <div class="assurance-band__grid">
        ${assurancePaths
          .map(
            (item) => `
          <a href="${item.href}">
            <span>${escapeHtml(item.label)}</span>
            <h3>${escapeHtml(item.title)}</h3>
            ${icon("arrow")}
          </a>`
          )
          .join("")}
      </div>
    </div>
  </section>`;

export const founderSection = () => {
  const ready =
    founder.verified &&
    founder.name &&
    founder.role &&
    founder.quote &&
    founder.portrait &&
    founder.portraitAlt &&
    founder.portraitWidth > 0 &&
    founder.portraitHeight > 0;
  if (!ready) return "";
  return `
  <section class="section section--dark founder-section">
    <div class="shell founder-section__grid">
      <figure class="founder-section__media">
        <img src="${founder.portrait}" alt="${escapeHtml(founder.portraitAlt)}" width="${founder.portraitWidth}" height="${founder.portraitHeight}" loading="lazy" decoding="async">
      </figure>
      <div class="founder-section__copy">
        <p class="eyebrow">${escapeHtml(founder.eyebrow)}</p>
        <blockquote class="founder-section__quote">“${escapeHtml(founder.quote)}”</blockquote>
        <p class="founder-section__name">${escapeHtml(founder.name)}<span> · ${escapeHtml(founder.role)}</span></p>
      </div>
    </div>
  </section>`;
};
