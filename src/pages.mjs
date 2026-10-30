import {
  aboveStandard,
  business,
  claimRegistry,
  faqs,
  processSteps,
  services
} from "./data.mjs";
import { resourceArticles } from "./resources.mjs";
import {
  caseStudyCrossLinks,
  caseStudyPages
} from "./case-study-templates.mjs";
import {
  aboveStandardGrid,
  assuranceBand,
  breadcrumbs,
  button,
  faqList,
  finalCta,
  founderSection,
  icon,
  inspectionForm,
  layout,
  pageHero,
  proofBand,
  quoteCta,
  sectionHeading,
  servicesGrid,
  trustStrip,
  verifiedQuotes,
  workStrip
} from "./templates.mjs";

const resourceCards = (items = resourceArticles) => `
  <div class="resource-grid">
    ${items
      .map(
        (article, index) => `
          <article class="resource-card">
            <div class="resource-card__meta">
              <span>0${index + 1}</span>
              <span>${article.readTime}</span>
            </div>
            <p class="eyebrow">${article.eyebrow}</p>
            <h3><a href="/resources/${article.slug}/">${article.shortTitle}</a></h3>
            <p>${article.dek}</p>
            <a class="text-link" href="/resources/${article.slug}/" data-event="resource_card_click" data-resource="${article.slug}">Read the guide ${icon("arrow")}</a>
          </article>`
      )
      .join("")}
  </div>`;

const resourceSectionId = (heading) =>
  heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const resourceDate = (value) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(Date.UTC(year, month - 1, day)));
};

const resourceLink = (link) => {
  const external = /^https?:\/\//.test(link.href);
  return `<a href="${link.href}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${link.label}${icon("arrow")}</a>`;
};

const resourceHasExternalSources = (article) =>
  article.sections.some((section) =>
    (section.links || []).some((link) => /^https?:\/\//.test(link.href))
  );

const serviceGuideMap = {
  "roof-replacement": "roof-replacement-process-what-to-expect",
  "roof-repair": "roof-repair-vs-replacement-chicago",
  "storm-damage-restoration": "storm-damage-roof-assessment-illinois",
  "gutters-exteriors": "ice-dams-attic-ventilation-chicago"
};

const serviceGuide = (serviceSlug) =>
  resourceArticles.find((article) => article.slug === serviceGuideMap[serviceSlug]);

const home = {
  path: "/",
  lastModified: "2026-10-30",
  html: layout({
    title: "Roofing Contractor in Barrington & Greater Chicago",
    description:
      "Roof repair, roof replacement, and storm damage restoration in Barrington and Greater Chicago. Contact Raccoon Restoration for a free roof inspection.",
    path: "/",
    pageType: "home",
    faqItems: faqs.slice(0, 3),
    body: `
      <section class="home-hero">
        <picture class="home-hero__picture">
          <source media="(max-width: 640px)" srcset="/assets/editorial-v2/home-hero-mobile-800x1000.jpg">
          <img class="home-hero__image" src="/assets/images/hero-home.jpg" alt="" width="1800" height="1013" fetchpriority="high" decoding="async">
        </picture>
        <div class="home-hero__scrim"></div>
        <div class="shell home-hero__inner">
          <div class="home-hero__copy">
            <p class="eyebrow">Barrington, Illinois · Greater Chicago Roofing</p>
            <h1>Built<span class="hero-mobile-break"><br></span> Above<br><span>Standard.</span></h1>
            <p class="home-hero__lead">Roof repair, roof replacement, and storm damage restoration in Barrington and Greater Chicago.</p>
            <p class="home-hero__support">Clear findings. Straightforward options. One accountable local team from inspection through final walkthrough.</p>
            <div class="button-row">
              ${quoteCta({ position: "hero" })}
              ${button({
                href: "/services/",
                label: "Explore Our Services",
                variant: "outline",
                event: "service_card_click",
                position: "hero"
              })}
            </div>
          </div>
          <a class="hero-scroll" href="#intent" aria-label="Explore the homepage">
            <span>Explore</span><i aria-hidden="true"></i>
          </a>
        </div>
      </section>
      ${trustStrip()}

      <section class="section intent-section" id="intent">
        <div class="shell">
          ${sectionHeading({
            eyebrow: "Start with what you need",
            title: "What brings you here?"
          })}
          <div class="intent-grid">
            <a href="/services/roof-repair/" data-event="intent_selector_click" data-intent="active-leak"><span>01</span><h3>I have an active leak</h3><p>Protect the interior and locate the source.</p>${icon("arrow")}</a>
            <a href="/services/roof-repair/" data-event="intent_selector_click" data-intent="aging-roof"><span>02</span><h3>My roof is getting older</h3><p>Understand condition before deciding repair or replacement.</p>${icon("arrow")}</a>
            <a href="/services/storm-damage-restoration/" data-event="intent_selector_click" data-intent="storm"><span>03</span><h3>My home was hit by a storm</h3><p>Document conditions and plan the next step.</p>${icon("arrow")}</a>
            <a href="/services/roof-replacement/" data-event="intent_selector_click" data-intent="replacement"><span>04</span><h3>I am planning a replacement</h3><p>Compare the complete system, scope, and process.</p>${icon("arrow")}</a>
            <a href="/services/gutters-exteriors/" data-event="intent_selector_click" data-intent="exteriors"><span>05</span><h3>I need gutter or exterior work</h3><p>Review drainage and connected exterior components.</p>${icon("arrow")}</a>
          </div>
        </div>
      </section>

      <section class="section section--dark services-section pattern">
        <div class="shell">
          ${sectionHeading({
            eyebrow: "Roofing & Restoration",
            title: "Roofing services in Barrington &amp; Greater Chicago.",
            intro: "Focused services for the parts of your home that face weather first.",
            invert: true
          })}
          ${servicesGrid()}
        </div>
      </section>

      ${workStrip()}

      <section class="section section--cream standard-section">
        <div class="shell">
          ${sectionHeading({
            eyebrow: "Our working standard",
            title: "What above standard looks like.",
            intro: "Clear scope, careful execution, and accountable closeout."
          })}
          ${aboveStandardGrid()}
          <div class="centered-action">
            ${button({
              href: "/process/",
              label: "See Our Process",
              variant: "dark",
              position: "process"
            })}
          </div>
        </div>
      </section>

      <section class="storm-panel">
        <div class="storm-protocol" aria-label="Four-step storm response protocol">
          <div class="storm-protocol__header">
            <p class="eyebrow">Field protocol</p>
            <strong>Observe safely.<br>Document clearly.</strong>
          </div>
          <ol>
            <li><span>01</span><div><strong>Ground check</strong><p>Look for visible changes without climbing onto the roof.</p></div></li>
            <li><span>02</span><div><strong>Interior protection</strong><p>Move belongings and contain water only where it is safe.</p></div></li>
            <li><span>03</span><div><strong>Photo record</strong><p>Capture visible conditions, timing, and affected areas.</p></div></li>
            <li><span>04</span><div><strong>Professional assessment</strong><p>Separate observed evidence from assumptions about coverage.</p></div></li>
          </ol>
        </div>
        <div class="storm-panel__copy pattern">
          <p class="eyebrow">Storm guidance</p>
          <h2>Storm damage is stressful.<br><span>Your contractor should not be.</span></h2>
          <p>We document visible storm damage, prepare the repair estimate, and can discuss the damage and repair options with your insurer’s representative. Raccoon Restoration is your contractor—not a public adjuster.</p>
          ${button({
            href: "/services/storm-damage-restoration/",
            label: "Get Storm Guidance",
            position: "storm",
            event: "storm_damage_cta_click"
          })}
        </div>
      </section>

      ${proofBand()}
      ${founderSection()}
      ${assuranceBand()}

      <section class="section section--dark faq-section pattern">
        <div class="shell faq-layout">
          ${sectionHeading({
            eyebrow: "Straight answers",
            title: "Answers before the inspection.",
            invert: true
          })}
          <div class="faq-column">
            ${faqList(faqs.slice(0, 3))}
            <a class="text-link faq-more-link" href="/faq/">All questions ${icon("arrow")}</a>
          </div>
        </div>
      </section>
      ${finalCta()}
    `
  })
};

const serviceIndex = {
  path: "/services/",
  html: layout({
    title: "Greater Chicago Roofing Services",
    description:
      "Explore roof replacement, roof repair, storm-damage restoration, gutters, and exterior services across the Greater Chicago area.",
    path: "/services/",
    pageType: "services",
    body: `
      ${pageHero({
        eyebrow: "Roofing & Restoration",
        title: "Services built around the home.",
        breadcrumbLabel: "Services",
        intro: "Start with the condition, then define the right scope.",
        image: ""
      })}
      <section class="section section--cream">
        <div class="shell">
          <h2 class="sr-only">Roofing and exterior services</h2>
          ${servicesGrid()}
        </div>
      </section>
      <section class="section">
        <div class="shell content-grid">
          ${sectionHeading({
            eyebrow: "Not sure where to start?",
            title: "Describe what you see.",
            intro: "A leak, missing shingle, overflow, or recent storm is enough to begin."
          })}
          <div class="content-card">
            <h3>Have another exterior concern?</h3>
            <p>Share the scope and the team will confirm current availability.</p>
          </div>
        </div>
      </section>
      ${finalCta()}
    `
  })
};

const servicePages = services.map((service) => ({
  path: `/services/${service.slug}/`,
  lastModified: "2026-10-30",
  html: layout({
    title: `Greater Chicago ${service.name}`,
    description: `${service.name} in Barrington and Greater Chicago from Raccoon Restoration. Request a free inspection and a clear, documented scope for your property.`,
    path: `/services/${service.slug}/`,
    pageType: "service",
    service,
    faqItems: service.faq,
    body: `
      ${pageHero({
        eyebrow: service.eyebrow,
        title: `${service.name} in<br>Greater Chicago`,
        breadcrumbLabel: service.name,
        breadcrumbItems: [
          { label: "Services", href: "/services/" },
          { label: service.name, href: "#" }
        ],
        intro: service.summary,
        image: service.image,
        imageMobile: service.imageMobile,
        imageAlt: service.imageAlt,
        imageWidth: service.imageWidth,
        imageHeight: service.imageHeight,
        mediaCaption: service.mediaCaption,
        proofItems: [
          "Photo-documented findings",
          "Defined scope",
          "Clear options"
        ]
      })}
      <section class="section section--cream">
        <div class="shell two-column">
          <div>
            ${sectionHeading({
              eyebrow: "Start with the evidence",
              title: "Common signs worth assessing.",
              intro: "These signs help define what to inspect; they do not determine the answer."
            })}
          </div>
          <ul class="detail-list">
            ${service.signs.map((sign) => `<li>${icon("eye")}<span>${sign}</span></li>`).join("")}
          </ul>
        </div>
      </section>
      <section class="section">
        <div class="shell two-column two-column--media">
          <aside class="service-evidence-panel" aria-label="${service.name} documentation framework">
            <div class="service-evidence-panel__header">
              <p class="eyebrow">The evidence record</p>
              <h2>Document before recommending.</h2>
              <p>A useful inspection turns observations into a clear scope.</p>
            </div>
            <ol>
              <li><span>01</span><p>Observe the condition</p></li>
              <li><span>02</span><p>Record the context</p></li>
              <li><span>03</span><p>Define the scope</p></li>
            </ol>
            <p class="service-evidence-panel__note">${icon("shield")}The property determines the recommendation.</p>
          </aside>
          <div>
            ${sectionHeading({
              eyebrow: "Inspection and scope",
              title: "What the service can include.",
              intro: "Final scope depends on condition, access, and approved work."
            })}
            <ul class="check-list">
              ${service.includes.map((item) => `<li>${icon("check")}${item}</li>`).join("")}
            </ul>
            ${button({
              href: "/contact/#inspection-form",
              label: `Ask About ${service.name}`,
              variant: "dark",
              position: "service_detail"
            })}
          </div>
        </div>
      </section>
      <section class="section section--cream">
        <div class="shell faq-layout faq-layout--light">
          ${sectionHeading({
            eyebrow: `${service.name} FAQ`,
            title: "A clearer first decision."
          })}
          ${faqList(service.faq)}
        </div>
      </section>
      <aside class="service-guide-band">
        <div class="shell service-guide-band__inner">
          <div>
            <p class="eyebrow">Related homeowner guide</p>
            <h2>${serviceGuide(service.slug).shortTitle}</h2>
          </div>
          <a class="button button--dark" href="/resources/${serviceGuide(service.slug).slug}/" data-event="resource_card_click" data-position="service_detail"><span>Read the Guide</span>${icon("arrow")}</a>
        </div>
      </aside>
      <section class="section related-services">
        <div class="shell">
          ${sectionHeading({
            eyebrow: "Related services",
            title: "See the connected systems."
          })}
          <div class="related-grid">
            ${services
              .filter((item) => item.slug !== service.slug)
              .slice(0, 3)
              .map(
                (item) =>
                  `<a href="/services/${item.slug}/"><span>${item.eyebrow}</span><h3>${item.name}</h3>${icon("arrow")}</a>`
              )
              .join("")}
          </div>
          <p class="related-services__location">
            Headquartered in Barrington and serving Greater Chicago.
            <a class="text-link" href="/service-areas/barrington-il/">Roofing in Barrington ${icon("arrow")}</a>
            <a class="text-link" href="/service-areas/">Greater Chicago service areas ${icon("arrow")}</a>
          </p>
        </div>
      </section>
      ${finalCta({
        eyebrow: service.name,
        title: "Start with a clear assessment.",
        text: "Tell us what you see and where the property is located."
      })}
    `
  })
}));

const projectFigure = ({
  src,
  srcset,
  sizes = "(max-width: 800px) calc(100vw - 32px), (max-width: 1100px) 50vw, 58vw",
  width = 1920,
  height = 1080,
  eyebrow,
  title,
  alt,
  className = ""
}) => `
  <figure class="project-figure${className ? ` ${className}` : ""}">
    <div class="project-figure__media">
      <img src="${src}"${srcset ? ` srcset="${srcset}" sizes="${sizes}"` : ""} alt="${alt}" width="${width}" height="${height}" loading="lazy" decoding="async">
    </div>
    <figcaption>
      <span>${eyebrow}</span>
      <h3>${title}</h3>
    </figcaption>
  </figure>`;

const projects = {
  path: "/projects/",
  html: layout({
    title: "Roofing Project Portfolio",
    description:
      "Explore residential roof replacements, commercial flat roof installations, exterior transformations, and field work from Raccoon Restoration.",
    path: "/projects/",
    pageType: "projects",
    body: `
      <section class="project-hero">
        <picture>
          <source media="(max-width: 640px)" srcset="/assets/projects/project-tudor-residence-exterior-polished-v7-mobile-800x1000.jpg">
          <img class="project-hero__image" src="/assets/projects/project-tudor-residence-exterior-polished-v7-1600.jpg" srcset="/assets/projects/project-tudor-residence-exterior-polished-v7-640.jpg 640w, /assets/projects/project-tudor-residence-exterior-polished-v7-1280.jpg 1280w, /assets/projects/project-tudor-residence-exterior-polished-v7-1600.jpg 1600w" sizes="100vw" alt="Polished completed view of a large Tudor-inspired home with dark roof planes, a round stone tower, black-and-white trim, a clean entry, defined planting beds, and a manicured lawn" width="1600" height="900" fetchpriority="high" decoding="async">
        </picture>
        <div class="project-hero__scrim"></div>
        <div class="shell project-hero__inner">
          ${breadcrumbs([{ label: "Projects", href: "#" }])}
          <div class="project-hero__copy">
            <p class="eyebrow">Raccoon Restoration Project Portfolio</p>
            <h1>Real work.<br><span>Built above standard.</span></h1>
            <p>Residential roof replacements, commercial flat roofing, exterior transformations, and documented field work.</p>
            <div class="button-row">
              ${button({
                href: "#residential-projects",
                label: "Explore Selected Work",
                event: "project_gallery_click",
                position: "projects_hero"
              })}
              ${button({
                href: "/contact/#inspection-form",
                label: "Discuss Your Project",
                variant: "outline",
                event: "project_cta_click",
                position: "projects_hero"
              })}
            </div>
          </div>
        </div>
      </section>

      <section class="project-index-section" aria-label="Project categories">
        <div class="shell">
          <nav class="project-index" aria-label="Jump to a project category">
            <a href="#residential-projects">
              <span>01</span>
              <strong>Residential</strong>
              <small>Installation · Completed · Detail</small>
            </a>
            <a href="#commercial-projects">
              <span>02</span>
              <strong>Commercial</strong>
              <small>Low-Slope · Crew · Logistics</small>
            </a>
            <a href="#transformations">
              <span>03</span>
              <strong>Transformations</strong>
              <small>Finished Work · Detail</small>
            </a>
            <a href="#field-presence">
              <span>04</span>
              <strong>Field Presence</strong>
              <small>Branded Fleet · On-Site</small>
            </a>
          </nav>
        </div>
      </section>

      <section class="section project-chapter" id="residential-projects">
        <div class="shell">
          <header class="project-chapter__header">
            <span>01</span>
            <div>
              <p class="eyebrow">Residential roofing</p>
              <h2>Every roof tells the story from above.</h2>
              <p>Installation, complex roof plans, transitions, and finished details.</p>
            </div>
          </header>
          <div class="project-mosaic project-mosaic--residential">
            ${projectFigure({
              src: "/assets/projects/project-modern-residence-roof-aerial-1280.jpg",
              srcset:
                "/assets/projects/project-modern-residence-roof-aerial-640.jpg 640w, /assets/projects/project-modern-residence-roof-aerial-960.jpg 960w, /assets/projects/project-modern-residence-roof-aerial-1280.jpg 1280w",
              sizes:
                "(max-width: 800px) calc(100vw - 32px), (max-width: 1400px) calc(100vw - 64px), 1280px",
              width: 1280,
              height: 720,
              eyebrow: "Residential · Aerial View",
              title: "Modern Residential Roofline",
              alt: "Top-down drone view of a large dark multi-plane roof over a modern white residence and attached garage, surrounded by lawn and trees",
              className: "project-figure--span-12 project-figure--cinema"
            })}
            ${projectFigure({
              src: "/assets/projects/project-residential-installation-aerial-1020.jpg",
              srcset:
                "/assets/projects/project-residential-installation-aerial-640.jpg 640w, /assets/projects/project-residential-installation-aerial-1020.jpg 1020w",
              width: 1020,
              height: 1020,
              eyebrow: "Residential · In Progress",
              title: "Residential Roof Installation From Above",
              alt: "Drone view of a large residence during roof installation, with exposed wood decking, underlayment, workers, and protective tarps around the property",
              className: "project-figure--span-5"
            })}
            ${projectFigure({
              src: "/assets/projects/project-brick-residence-roof-aerial-1280.jpg",
              srcset:
                "/assets/projects/project-brick-residence-roof-aerial-640.jpg 640w, /assets/projects/project-brick-residence-roof-aerial-960.jpg 960w, /assets/projects/project-brick-residence-roof-aerial-1280.jpg 1280w",
              width: 1280,
              height: 720,
              eyebrow: "Residential · Architectural View",
              title: "Brick Residence Roofline",
              alt: "Drone view of a large brick residence with a brown multi-plane roof, two dormers, twin chimneys, copper-toned accents, and adjoining low-slope roof sections",
              className: "project-figure--span-7 project-figure--position-brick"
            })}
            ${projectFigure({
              src: "/assets/projects/project-roof-detail-dormers-1020.jpg",
              srcset:
                "/assets/projects/project-roof-detail-dormers-640.jpg 640w, /assets/projects/project-roof-detail-dormers-1020.jpg 1020w",
              width: 1020,
              height: 1020,
              eyebrow: "Residential · Roof Detail",
              title: "Architectural Roof Detail",
              alt: "Close aerial view of a steep dark patterned roof with two dormers, a brick chimney, and a flat-roof transition",
              className: ""
            })}
            <article class="project-proof-note project-proof-note--compact">
              <p class="eyebrow">Documented from the field</p>
              <h3>Scale. Shape. Finish.</h3>
              <p>Aerial records make roof geometry, transitions, and the finished system easier to examine.</p>
            </article>
          </div>
        </div>
      </section>

      <section class="section project-chapter project-chapter--dark" id="commercial-projects">
        <div class="shell">
          <header class="project-chapter__header">
            <span>02</span>
            <div>
              <p class="eyebrow">Commercial roofing</p>
              <h2>Commercial flat roofing at full scale.</h2>
              <p>One low-slope roof installation documented from crew level to full-building aerial view.</p>
            </div>
          </header>
          <article class="project-case-study" aria-labelledby="commercial-flat-roof-title">
            <header class="project-case-study__header">
              <div>
                <p class="eyebrow">Commercial roofing project</p>
                <h3 id="commercial-flat-roof-title">Commercial Flat Roof Installation</h3>
              </div>
              <p>Three field views show installation detail, building context, and full-roof coverage.</p>
            </header>
            <ul class="project-case-study__facts" aria-label="Commercial project record details">
              <li><span>System</span><strong>Low-slope roofing</strong></li>
              <li><span>Record</span><strong>Three field views</strong></li>
              <li><span>Coverage</span><strong>Crew to aerial</strong></li>
            </ul>
            <div class="project-case-study__sequence">
              ${projectFigure({
                src: "/assets/projects/project-low-slope-installation-crew-enhanced-v3-1280.jpg",
                srcset:
                  "/assets/projects/project-low-slope-installation-crew-enhanced-v3-640.jpg 640w, /assets/projects/project-low-slope-installation-crew-enhanced-v3-1280.jpg 1280w",
                width: 1280,
                height: 720,
                eyebrow: "Sequence 01 · Surface Installation",
                title: "Commercial Roof Installation",
                alt: "Roofing crew in high-visibility vests installing a white low-slope roofing system on a commercial building",
                className: "project-figure--case-step project-figure--case-lead"
              })}
              ${projectFigure({
                src: "/assets/projects/project-low-slope-roof-aerial-enhanced-v3-1280.jpg",
                srcset:
                  "/assets/projects/project-low-slope-roof-aerial-enhanced-v3-640.jpg 640w, /assets/projects/project-low-slope-roof-aerial-enhanced-v3-1280.jpg 1280w",
                width: 1280,
                height: 720,
                eyebrow: "Sequence 02 · Building Context",
                title: "Full Commercial Roof View",
                alt: "Aerial view of a large commercial building during flat roof installation, with a bright white low-slope roofing system, rooftop equipment, and workers",
                className: "project-figure--case-step"
              })}
              ${projectFigure({
                src: "/assets/projects/project-low-slope-installation-topdown-enhanced-v3-1280.jpg",
                srcset:
                  "/assets/projects/project-low-slope-installation-topdown-enhanced-v3-640.jpg 640w, /assets/projects/project-low-slope-installation-topdown-enhanced-v3-1280.jpg 1280w",
                width: 1280,
                height: 720,
                eyebrow: "Sequence 03 · Overhead Verification",
                title: "Low-Slope Roof Installation From Above",
                alt: "Top-down drone view of an active commercial flat roof installation with a white low-slope roofing system, workers, tools, and rooftop equipment",
                className: "project-figure--case-step"
              })}
            </div>
          </article>
          <div class="project-mosaic project-mosaic--logistics">
            ${projectFigure({
              src: "/assets/projects/project-material-delivery-clear-v2-1020.jpg",
              srcset:
                "/assets/projects/project-material-delivery-clear-v2-640.jpg 640w, /assets/projects/project-material-delivery-clear-v2-1020.jpg 1020w",
              width: 1020,
              height: 1020,
              eyebrow: "Commercial · Material Delivery",
              title: "Materials Moving Up",
              alt: "Crane lifting packaged roofing materials to the top of a multi-story brick commercial building",
              className: "project-figure--span-7 project-figure--contained"
            })}
            <article class="project-proof-note project-proof-note--logistics">
              <p class="eyebrow">Supporting field record</p>
              <h3>Logistics are part of the work.</h3>
              <p>Coordinated delivery keeps materials, access, and installation moving. This field record shows rooftop staging on an active commercial site.</p>
            </article>
          </div>
        </div>
      </section>

      <section class="section section--cream project-chapter" id="transformations">
        <div class="shell">
          <header class="project-chapter__header">
            <span>03</span>
            <div>
              <p class="eyebrow">Verified outcomes</p>
              <h2>Finished work should stand on its own.</h2>
              <p>Completed roofs are shown at useful scale, with matched views when a comparison is available.</p>
            </div>
          </header>
          <div class="project-transformation-proof">
            ${projectFigure({
              src: "/assets/projects/project-residential-roofline-aerial-1270.jpg",
              srcset:
                "/assets/projects/project-residential-roofline-aerial-640.jpg 640w, /assets/projects/project-residential-roofline-aerial-1270.jpg 1270w",
              sizes:
                "(max-width: 800px) calc(100vw - 32px), (max-width: 1100px) calc(100vw - 64px), 62vw",
              width: 1270,
              height: 1080,
              eyebrow: "Verified Record · Completed Roof",
              title: "Finished Residential Roofline",
              alt: "Aerial view of a completed dark multi-plane roof across a large white residence and attached garage",
              className: "project-figure--transformation-outcome"
            })}
            <aside class="project-evidence-card" aria-labelledby="comparison-source-title">
              <p class="eyebrow">Proof standard</p>
              <h3 id="comparison-source-title">Documented. Matched. Traceable.</h3>
              <p>Before-and-after views should come from the same property and preserve a clear comparison.</p>
              <ul>
                <li><span>Published now</span><strong>Completed project photography</strong></li>
                <li><span>Comparison rule</span><strong>Matched original views</strong></li>
                <li><span>Presentation</span><strong>No baked labels or artificial upscaling</strong></li>
              </ul>
            </aside>
          </div>
        </div>
      </section>

      <section class="section project-field" id="field-presence">
        <div class="shell project-field__grid">
          <div class="project-field__copy">
            <p class="eyebrow">04 · Brand in motion</p>
            <h2>A brand that shows up.</h2>
            <p>The Raccoon Restoration identity carries into the field through a recognizable service vehicle and full-length ladder rack.</p>
            <p class="project-field__note">Share your roof type, concern, and location to ask about similar work.</p>
            ${button({
              href: "/contact/#inspection-form",
              label: "Discuss a Similar Project",
              variant: "dark",
              event: "project_cta_click",
              position: "projects_field"
            })}
          </div>
          <figure class="project-field__media">
            <picture>
              <source media="(max-width: 640px)" srcset="/assets/editorial-v2/contact-branded-service-truck-editorial-mobile-landscape-800x450.jpg">
              <img src="/assets/editorial-v2/contact-branded-service-truck-web-1280.jpg" alt="Black Raccoon Restoration pickup truck with a full-length ladder rack parked on a residential street" width="1280" height="720" loading="lazy" decoding="async">
            </picture>
            <figcaption>Raccoon Restoration fleet presentation</figcaption>
          </figure>
        </div>
      </section>
      ${caseStudyCrossLinks()}
      ${finalCta({
        eyebrow: "Planning your next project?",
        title: "Put your property in the next chapter.",
        text: "Start with a clear conversation about the work in front of you."
      })}
    `
  })
};

const reviews = {
  path: "/reviews/",
  html: layout({
    title: "Reviews & Reputation",
    description:
      "Read recent Raccoon Restoration customer feedback and verify its BBB rating, accreditation, and contractor profiles at the original sources.",
    path: "/reviews/",
    pageType: "reviews",
    body: `
      <section class="reviews-hero">
        <div class="shell">
          ${breadcrumbs([{ label: "Reviews", href: "#" }])}
          <div class="reviews-hero__grid">
            <div class="reviews-hero__copy">
              <p class="eyebrow">Local reputation</p>
              <h1>Trust is easier to verify.</h1>
              <p>Review independent profiles and customer feedback at the original source.</p>
              <div class="button-row">
                ${quoteCta({ position: "reviews_hero" })}
                ${button({
                  href: "#review-sources",
                  label: "View Independent Sources",
                  variant: "outline",
                  event: "review_source_click",
                  position: "reviews_hero"
                })}
              </div>
            </div>
            <aside class="reviews-source-panel" id="review-sources" aria-label="Independent business profiles">
              <div class="reviews-source-panel__heading">
                <p class="eyebrow">Independent feedback</p>
                <h2>Public reviews. Direct source.</h2>
              </div>
              <div class="reviews-source-panel__rating">
                <span class="reviews-source-panel__mark">BBB</span>
                <div><strong>A+ BBB rating</strong><span>BBB Accredited Business</span></div>
              </div>
              ${verifiedQuotes()
                .map(
                  (quote) => `
              <figure class="reviews-source-panel__quote">
                <blockquote>“${quote.quote}”</blockquote>
                <figcaption>${quote.name} · ${quote.context}</figcaption>
              </figure>`
                )
                .join("")}
              <div class="reviews-source-panel__links">
                <a href="https://www.bbb.org/us/il/barrington/profile/roofing-consultants/raccoon-restoration-0654-90025835" target="_blank" rel="noopener noreferrer" data-event="review_source_click" data-position="reviews_hero">Read reviews on BBB ${icon("arrow")}</a>
                <a href="https://www.gaf.com/en-us/roofing-contractors/residential/usa/il/barrington/raccoon-restoration-1151998" target="_blank" rel="noopener noreferrer" data-event="review_source_click" data-position="reviews_hero">View GAF profile ${icon("arrow")}</a>
              </div>
            </aside>
          </div>
        </div>
      </section>
      <section class="section">
        <div class="shell content-grid">
          ${sectionHeading({
            eyebrow: "Read beyond the rating",
            title: "Look for the details that matter.",
            intro: "The most useful reviews describe communication, workmanship, cleanup, and the final result."
          })}
          <div class="content-card">
            <h3>Verify feedback at the source</h3>
            <p>Use the linked profiles to see current ratings, recent comments, and the platform that published them.</p>
            ${button({
              href: "#review-sources",
              label: "View Independent Sources",
              variant: "dark",
              event: "review_source_click",
              position: "reviews"
            })}
          </div>
        </div>
      </section>
      ${finalCta()}
    `
  })
};

const about = {
  path: "/about/",
  html: layout({
    title: "About Raccoon Restoration",
    description:
      "Meet the Greater Chicago roofing, restoration, storm-damage, estimating, design, and skilled-trades team at Raccoon Restoration.",
    path: "/about/",
    pageType: "about",
    body: `
      ${pageHero({
        eyebrow: "About Raccoon Restoration",
        title: "Local by reputation.<br>Professional by design.",
        breadcrumbLabel: "About",
        intro:
          "A Barrington-headquartered roofing and restoration company serving Greater Chicago with clear decisions and accountable delivery.",
        image:
          "/assets/editorial-v2/about-branded-fleet-rain-web-1254-optimized.jpg",
        imageMobile:
          "/assets/editorial-v2/about-branded-fleet-rain-mobile-800-optimized.jpg",
        imageAlt:
          "Black branded Raccoon Restoration Rivian SUV and Ford work truck parked together on wet pavement",
        imageWidth: 1254,
        imageHeight: 1254,
        mediaCaption: "Raccoon Restoration fleet in the field"
      })}
      <section class="section section--cream">
        <div class="shell editorial-grid">
          <div class="pull-quote">“Built Above Standard” should be visible in every step—not only in the finished roof.</div>
          <div class="prose">
            <p>Homeowners should understand what was found, what is being recommended, and why it fits the property.</p>
            <p>That means a defined scope, reliable communication, respect for the home, and a complete final walkthrough.</p>
            <p>The goal is straightforward: make supportable promises, execute the approved work carefully, and earn confidence through the experience.</p>
          </div>
        </div>
      </section>
      <section class="section section--dark pattern">
        <div class="shell">
          ${sectionHeading({
            eyebrow: "The customer commitment",
            title: "What the experience should deliver.",
            invert: true
          })}
          ${aboveStandardGrid()}
        </div>
      </section>
      <section class="section team-expertise" aria-labelledby="team-expertise-title">
        <div class="shell">
          <header class="team-expertise__header">
            <div>
              <p class="eyebrow">Storm expertise + construction clarity</p>
              <h2 id="team-expertise-title">We make the repair scope clear.<br><span>You focus on moving forward.</span></h2>
            </div>
            <div class="team-expertise__lede">
              <p>Property damage can leave you managing inspections, estimates, technical questions, and repeated conversations with the insurance company. You should not have to explain the construction scope alone.</p>
              <strong>Our storm-damage specialists document visible conditions, prepare detailed repair estimates, and stand behind the construction scope when discussing property damage and repair options with the insurance company’s representative.</strong>
            </div>
          </header>

          <div class="team-expertise__grid">
            <article class="team-expertise__card team-expertise__card--claims">
              <p class="eyebrow">Contractor-side expertise</p>
              <h3>Construction facts at the table.</h3>
              <p>We organize the documentation, estimate, and repair options so the construction scope is clear—without acting as your public adjuster or insurer.</p>
              <ul>
                <li>${icon("check")}<span>Storm-damage inspections and documentation</span></li>
                <li>${icon("check")}<span>Detailed repair scopes and estimates</span></li>
                <li>${icon("check")}<span>Insurance-adjuster site meetings</span></li>
                <li>${icon("check")}<span>Retail and restoration estimators</span></li>
                <li>${icon("check")}<span>Water and flood-damage assessments</span></li>
              </ul>
              ${button({
                href: "/contact/#inspection-form",
                label: "Talk to a Storm Specialist",
                event: "claim_support_click",
                position: "about_team_expertise"
              })}
            </article>

            <article class="team-expertise__card team-expertise__card--trades">
              <p class="eyebrow">Skilled trades</p>
              <h3>One coordinated team for the property.</h3>
              <p>Estimating, design, and field execution stay connected across the approved restoration scope.</p>
              <ul>
                <li>${icon("check")}<span>Roofing</span></li>
                <li>${icon("check")}<span>Siding</span></li>
                <li>${icon("check")}<span>Gutters</span></li>
                <li>${icon("check")}<span>Interior restoration</span></li>
                <li>${icon("check")}<span>Paint and wallcoverings</span></li>
                <li>${icon("check")}<span>Windows and doors</span></li>
                <li>${icon("check")}<span>Design guidance</span></li>
                <li>${icon("check")}<span>Project estimating</span></li>
              </ul>
            </article>
          </div>

          <p class="team-expertise__disclosure">Raccoon Restoration is a roofing and restoration contractor, not a public adjuster. We do not interpret policy coverage, file claims on a customer’s behalf, or negotiate claim settlements. If a customer separately retains a licensed public adjuster, we can coordinate on construction documentation while that professional handles claim representation. Coverage decisions remain with the insurer.</p>
        </div>
      </section>
      <section class="section">
        <div class="shell content-grid">
          ${sectionHeading({
            eyebrow: "Local foundation",
            title: "Barrington headquarters. Greater Chicago service.",
            intro: "Direct contact, an Illinois roofing license, and independent business profiles."
          })}
          <ul class="detail-list detail-list--compact">
            <li>${icon("home")}<span>Serving the Greater Chicago area</span></li>
            <li>${icon("target")}<span>Headquartered in Barrington, Illinois</span></li>
            <li>${icon("phone")}<span>${business.phoneDisplay}</span></li>
            <li>${icon("shield")}<span>${business.license}</span></li>
            <li>${icon("eye")}<span>${business.email}</span></li>
          </ul>
        </div>
      </section>
      ${finalCta()}
    `
  })
};

const process = {
  path: "/process/",
  html: layout({
    title: "Our Roofing Process",
    description:
      "A clear roofing and restoration process from inspection and explanation through planning, installation, and final verification.",
    path: "/process/",
    pageType: "process",
    body: `
      ${pageHero({
        eyebrow: "Our process",
        title: "From first look to final walkthrough.",
        breadcrumbLabel: "Our Process",
        intro: "Clarity before work, visibility during it, and accountability at completion.",
        image: "",
        proofItems: ["Inspect", "Explain", "Plan", "Build", "Verify"]
      })}
      <section class="section">
        <div class="shell process-detail">
          ${processSteps
            .map(
              (step) => `
              <article id="${step.title.toLowerCase()}">
                <span>${step.number}</span>
                <div><p class="eyebrow">${step.title}</p><h2>${step.text}</h2></div>
                <div><p>${{
                  Inspect:
                    "Share what you noticed, when it started, and where it appears. We review accessible areas and document what can be observed.",
                  Explain:
                    "We explain what is urgent, what can wait, what remains uncertain, and why a recommendation fits.",
                  Plan:
                    "The approved scope identifies work areas, materials, exclusions, access, property protection, and next steps.",
                  Build:
                    "The field plan guides coordination. Any change is surfaced, explained, and approved.",
                  Verify:
                    "Closeout reviews the finished scope, cleanup, follow-up items, and approved documentation."
                }[step.title]}</p></div>
              </article>`
            )
            .join("")}
        </div>
      </section>
      <section class="section section--cream">
        <div class="shell content-grid">
          ${sectionHeading({
            eyebrow: "Planning a full replacement?",
            title: "Know what happens before the first shingle comes off.",
            intro: "Review scope, preparation, tear-off, installation, cleanup, warranties, and closeout before work begins."
          })}
          <div class="content-card">
            <h3>The roof replacement process, explained.</h3>
            <p>Use the homeowner guide to prepare useful questions and understand the milestones of a well-managed roofing project.</p>
            ${button({
              href: "/resources/roof-replacement-process-what-to-expect/",
              label: "Read the Roof Replacement Guide",
              variant: "dark",
              event: "resource_card_click",
              position: "process"
            })}
          </div>
        </div>
      </section>
      ${finalCta({
        eyebrow: "Step one",
        title: "Start with a free inspection.",
        text: "Tell the team what you see. The first visit begins with the condition."
      })}
    `
  })
};

const serviceAreas = {
  path: "/service-areas/",
  lastModified: "2026-10-30",
  html: layout({
    title: "Greater Chicago Roofing Service Area",
    description:
      "Raccoon Restoration serves the Greater Chicago area from its Barrington headquarters. Check roofing and restoration availability by city or ZIP code.",
    path: "/service-areas/",
    pageType: "location",
    body: `
      ${pageHero({
        eyebrow: "Barrington headquarters · Greater Chicago service",
        title: "Roofing service areas<br>across Greater Chicago.",
        breadcrumbLabel: "Service Areas",
        intro: "Residential and commercial roofing and restoration across the Greater Chicago area. Share the property city or ZIP code to confirm scheduling for your address.",
        image:
          "/assets/editorial-v2/service-areas-residential-project-aerial-optimized-1600x900.jpg",
        imageMobile:
          "/assets/editorial-v2/service-areas-residential-project-aerial-optimized-800x1000.jpg",
        imageAlt:
          "Aerial view of a completed residential roofing project on a large home",
        imageWidth: 1600,
        imageHeight: 900,
        mediaCaption: "Residential roofing project",
        heroClass: "page-hero--regional",
        primaryLabel: "Check My Address",
        primaryHref: "/contact/#inspection-form",
        primaryEvent: "location_page_cta_click",
        primaryIntent: "service_area",
        proofItems: [
          "Greater Chicago coverage",
          "Barrington headquarters",
          "Address-level confirmation"
        ]
      })}
      <section class="section section--cream regional-coverage">
        <div class="shell">
          ${sectionHeading({
            eyebrow: "Greater Chicago service region",
            title: "Built for the property—not a ZIP-code list.",
            intro: "Coverage is organized around the region, while scheduling is confirmed for the exact address and scope."
          })}
          <div class="region-grid" aria-label="Greater Chicago roofing service regions">
            <article><span>01</span><h3>Chicago</h3><p>Roofing and restoration inquiries across the city.</p></article>
            <article><span>02</span><h3>Northwest Suburbs</h3><p>Including the Barrington headquarters region and surrounding communities.</p></article>
            <article><span>03</span><h3>North Shore &amp; North Suburbs</h3><p>Residential and commercial property assessments across the northern market.</p></article>
            <article><span>04</span><h3>Western Suburbs</h3><p>Project-specific service for roofing, storm, and exterior needs.</p></article>
            <article><span>05</span><h3>Southwest Suburbs</h3><p>Availability confirmed by property address, scope, and schedule.</p></article>
          </div>
          <p class="regional-coverage__note">Service availability can vary by project type, address, access, and schedule. Submit the city or ZIP code for confirmation before planning work.</p>
        </div>
      </section>
      <section class="section">
        <div class="shell service-area-anchor">
          <div class="location-feature">
            <div class="location-mark">B</div>
            <div>
              <p class="eyebrow">Verified headquarters</p>
              <h2>Barrington, Illinois</h2>
              <p>Barrington is the home base and local trust anchor for a team serving properties throughout Greater Chicago.</p>
              <a class="text-link" href="/service-areas/barrington-il/">Roofing services in Barrington, IL ${icon("arrow")}</a>
            </div>
          </div>
          <aside class="address-check">
            <p class="eyebrow">Check current availability</p>
            <h2>Where is the property?</h2>
            <p>Send the city or ZIP code, the service you need, and a short description of the concern.</p>
            ${button({
              href: "/contact/#inspection-form",
              label: "Check My Address",
              variant: "dark",
              event: "location_page_cta_click",
              position: "location"
            })}
          </aside>
        </div>
      </section>
      ${finalCta({
        eyebrow: "Greater Chicago roofing",
        title: "Start with your address.",
        text: "The team will confirm coverage and the next useful step for the property."
      })}
    `
  })
};

const barrington = {
  path: "/service-areas/barrington-il/",
  lastModified: "2026-10-30",
  html: layout({
    title: "Roofing Contractor in Barrington, IL",
    description:
      "Barrington roof repair, roof replacement, and storm damage restoration from Raccoon Restoration. Request a free inspection from our Barrington-based team.",
    path: "/service-areas/barrington-il/",
    pageType: "location",
    body: `
      ${pageHero({
        eyebrow: "Barrington, Illinois",
        title: "Roofing contractor<br>in Barrington, IL.",
        breadcrumbLabel: "Barrington, IL",
        breadcrumbItems: [
          { label: "Service Areas", href: "/service-areas/" },
          { label: "Barrington, IL", href: "#" }
        ],
        intro: "From leaks and aging roofs to storm concerns, start with a property-specific assessment from a Barrington company.",
        image: "",
        sidePanel: {
          label: "Local point of contact",
          mark: "B",
          title: "Barrington, Illinois",
          items: [
            { icon: "home", text: "Barrington home base" },
            { icon: "phone", text: business.phoneDisplay },
            { icon: "shield", text: business.license }
          ]
        }
      })}
      ${trustStrip()}
      <section class="section section--cream">
        <div class="shell">
          ${sectionHeading({
            eyebrow: "Services in focus",
            title: "Start with the part of the home that needs attention."
          })}
          <div class="related-grid related-grid--four" aria-label="Services available from the Barrington team">
            ${services
              .map(
                (service) =>
                  `<a href="/services/${service.slug}/"><span>${service.eyebrow}</span><h3>${service.name}</h3>${icon("arrow")}</a>`
              )
              .join("")}
          </div>
        </div>
      </section>
      <section class="section">
        <div class="shell content-grid">
          ${sectionHeading({
            eyebrow: "A useful first conversation",
            title: "Start with the property in front of you.",
            intro: "Share what you see, when it started, and where it appears."
          })}
          <div class="content-card">
            <h3>Before your inspection</h3>
            <p>Note where you see the issue, when it appeared, whether weather changed it, and any safe-to-capture photos. Do not climb onto the roof.</p>
          </div>
        </div>
      </section>
      ${finalCta()}
    `
  })
};

const resources = {
  path: "/resources/",
  html: layout({
    title: "Roofing Resources for Greater Chicago",
    description:
      "Original Greater Chicago roofing guides about hiring a contractor, repair versus replacement, storm damage, ice dams, and attic ventilation.",
    path: "/resources/",
    pageType: "resources",
    body: `
      ${pageHero({
        eyebrow: "Greater Chicago roofing resources",
        title: "Useful guidance.<br>Before the sales pitch.",
        breadcrumbLabel: "Roofing Resources",
        intro: "Practical, property-first guidance for hiring, roof decisions, storm response, and Chicago-area winter conditions.",
        image: "",
        compact: true,
        primaryLabel: "Request an Inspection",
        primaryHref: "/contact/#inspection-form",
        primaryEvent: "inspection_cta_click",
        primaryIntent: "inspection",
        proofItems: [
          "Written for homeowners",
          "Illinois-specific sources",
          "No universal diagnosis"
        ]
      })}
      <section class="section section--cream resources-index">
        <div class="shell">
          ${sectionHeading({
            eyebrow: "Start with the question",
            title: "Four decisions worth getting right.",
            intro: "Each guide separates useful evidence from shortcuts and pressure."
          })}
          ${resourceCards()}
        </div>
      </section>
      <section class="section resource-principles">
        <div class="shell resource-principles__grid">
          <div>
            <p class="eyebrow">Editorial standard</p>
            <h2>Clear enough to use.<br>Careful enough to trust.</h2>
          </div>
          <div class="resource-principles__list">
            <article><span>01</span><div><h3>Property first</h3><p>No article can replace an inspection of the actual roof and building.</p></div></article>
            <article><span>02</span><div><h3>Roles explained</h3><p>Contractor, carrier, and public-adjusting responsibilities stay distinct.</p></div></article>
            <article><span>03</span><div><h3>Sources linked</h3><p>Illinois licensing and consumer guidance are linked at the original source.</p></div></article>
          </div>
        </div>
      </section>
      ${finalCta({
        eyebrow: "Need property-specific guidance?",
        title: "Start with the roof in front of you.",
        text: "Share the address and concern so the team can confirm the next useful step."
      })}
    `
  })
};

const resourcePages = resourceArticles.map((article) => {
  const relatedArticles = resourceArticles
    .filter((item) => item.slug !== article.slug)
    .slice(0, 2);
  const relatedServices = article.relatedServices
    .map((slug) => services.find((service) => service.slug === slug))
    .filter(Boolean);

  return {
    path: `/resources/${article.slug}/`,
    lastModified: article.dateModified,
    html: layout({
      title: article.seoTitle,
      description: article.description,
      path: `/resources/${article.slug}/`,
      pageType: "article",
      article,
      body: `
        <section class="resource-article-hero pattern">
          <div class="shell">
            ${breadcrumbs([
              { label: "Roofing Resources", href: "/resources/" },
              { label: article.shortTitle, href: "#" }
            ])}
            <div class="resource-article-hero__grid">
              <div>
                <p class="eyebrow">${article.eyebrow}</p>
                <h1>${article.title}</h1>
                <p>${article.dek}</p>
              </div>
              <aside aria-label="Article details">
                <span>${article.readTime}</span>
                <span>Updated <time datetime="${article.dateModified}">${resourceDate(article.dateModified)}</time></span>
                <span>${resourceHasExternalSources(article) ? "Official sources reviewed" : "Editorially reviewed"} <time datetime="${article.sourceReviewed}">${resourceDate(article.sourceReviewed)}</time></span>
                <span>Raccoon Restoration Editorial Team</span>
              </aside>
            </div>
          </div>
        </section>
        <section class="section section--cream">
          <div class="shell resource-article-layout">
            <nav class="resource-toc" aria-label="On this page">
              <p class="eyebrow">On this page</p>
              <ol>
                ${article.sections
                  .map(
                    (section, index) =>
                      `<li><a href="#${resourceSectionId(section.heading)}"><span>0${index + 1}</span>${section.heading}</a></li>`
                  )
                  .join("")}
              </ol>
              <a class="text-link" href="/contact/#inspection-form">Ask about your property ${icon("arrow")}</a>
            </nav>
            <article class="resource-prose">
              <p class="resource-prose__dek">${article.dek}</p>
              ${article.sections
                .map(
                  (section) => `
                    <section id="${resourceSectionId(section.heading)}">
                      <h2>${section.heading}</h2>
                      ${section.paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join("")}
                      ${
                        section.bullets
                          ? `<ul>${section.bullets.map((item) => `<li>${item}</li>`).join("")}</ul>`
                          : ""
                      }
                      ${
                        section.links
                          ? `<div class="resource-source-links">
                              ${section.links
                                .map(resourceLink)
                                .join("")}
                            </div>`
                          : ""
                      }
                    </section>`
                )
                .join("")}
              <aside class="resource-disclaimer">
                <strong>Property-specific decisions need property-specific evidence.</strong>
                <p>This guide is general information, not a roof diagnosis, engineering opinion, legal advice, policy interpretation, or promise of insurance coverage.</p>
              </aside>
            </article>
          </div>
        </section>
        <section class="section resource-related">
          <div class="shell">
            ${sectionHeading({
              eyebrow: "Connected services",
              title: "Continue with the relevant scope."
            })}
            <div class="related-grid">
              ${relatedServices
                .map(
                  (service) =>
                    `<a href="/services/${service.slug}/"><span>${service.eyebrow}</span><h3>${service.name}</h3>${icon("arrow")}</a>`
                )
                .join("")}
              <a href="/service-areas/"><span>Greater Chicago</span><h3>Check Service Availability</h3>${icon("arrow")}</a>
            </div>
          </div>
        </section>
        <section class="section section--dark pattern resource-more">
          <div class="shell">
            ${sectionHeading({
              eyebrow: "Read next",
              title: "More practical roofing guidance.",
              invert: true
            })}
            ${resourceCards(relatedArticles)}
          </div>
        </section>
        ${finalCta({
          eyebrow: article.eyebrow,
          title: "Bring the question to the property.",
          text: "Request a clear assessment from the Greater Chicago team."
        })}
      `
    })
  };
});

const faq = {
  path: "/faq/",
  html: layout({
    title: "Roofing FAQ",
    description:
      "Straight answers about roof inspections, repair versus replacement, storm-damage assessments, service areas, financing, and warranties.",
    path: "/faq/",
    pageType: "faq",
    faqItems: faqs,
    body: `
      ${pageHero({
        eyebrow: "Frequently asked questions",
        title: "Clear answers before the first step.",
        breadcrumbLabel: "FAQ",
        intro: "Answers about inspections, roofing work, service areas, warranties, and financing.",
        image: "",
        compact: true
      })}
      <section class="section section--cream">
        <div class="shell faq-layout faq-layout--light">
          ${sectionHeading({
            eyebrow: "Inspection, service, and process",
            title: "What homeowners ask first."
          })}
          ${faqList(faqs)}
        </div>
      </section>
      ${finalCta()}
    `
  })
};

const warranty = {
  path: "/warranty/",
  html: layout({
    title: "Roofing Warranty Guidance",
    description:
      "Understand the questions to ask about roofing material and workmanship warranties. Raccoon Restoration project-specific terms require written verification.",
    path: "/warranty/",
    pageType: "education",
    body: `
      ${pageHero({
        eyebrow: "Warranty guidance",
        title: "Clear terms before the work begins.",
        breadcrumbLabel: "Warranty",
        intro: "Material and workmanship warranties cover different things. Confirm who provides each one and which terms apply.",
        image: "/assets/editorial-v2/warranty-finished-roof-web-1280.jpg",
        imageMobile:
          "/assets/editorial-v2/warranty-finished-roof-web-mobile-800.jpg",
        imageAlt:
          "Aerial view of a finished residential roof with dimensional shingles",
        imageWidth: 1280,
        imageHeight: 720,
        mediaCaption: "Review material and workmanship terms separately"
      })}
      <section class="section section--cream">
        <div class="shell project-standard">
          <h2 class="sr-only">Warranty questions to review</h2>
          ${[
            ["01", "Who provides it?", "Separate manufacturer coverage from contractor workmanship coverage."],
            ["02", "What is covered?", "Ask which materials, defects, installation issues, and labor costs are included."],
            ["03", "How long does it last?", "Confirm duration, start date, transferability, and registration requirements."],
            ["04", "What can void it?", "Review ventilation, maintenance, modification, weather, and notification exclusions."],
            ["05", "How is a claim started?", "Keep the contract, product documents, photos, and written claim instructions."]
          ]
            .map(
              ([number, title, text]) =>
                `<article><span>${number}</span><h3>${title}</h3><p>${text}</p></article>`
            )
            .join("")}
        </div>
      </section>
      ${finalCta({
        eyebrow: "Before approval",
        title: "Request the written warranty terms.",
        text:
          "Ask which coverage applies to your exact material selection and approved scope."
      })}
    `
  })
};

const financing = {
  path: "/financing/",
  html: layout({
    title: "Roofing Financing Information",
    description:
      "Compare written roofing payment terms after the project scope is defined. Contact Raccoon Restoration to confirm current financing availability.",
    path: "/financing/",
    pageType: "education",
    noindex: true,
    body: `
      ${pageHero({
        eyebrow: "Project-planning guidance",
        title: "Plan the scope. Then compare payment options.",
        breadcrumbLabel: "Financing",
        intro: "Compare payment options only after the scope and written terms are clear.",
        image: ""
      })}
      <section class="section section--cream">
        <div class="shell content-grid">
          ${sectionHeading({
            eyebrow: "Questions to ask",
            title: "Know the full cost of the option.",
            intro: "If financing is available, compare more than the monthly payment."
          })}
          <ul class="detail-list">
            <li>${icon("check")}<span>Annual percentage rate and total repayment amount</span></li>
            <li>${icon("check")}<span>Term length, payment timing, and prepayment rules</span></li>
            <li>${icon("check")}<span>Fees, promotional periods, and what changes afterward</span></li>
            <li>${icon("check")}<span>Whether the financing provider pays the contractor directly</span></li>
          </ul>
        </div>
      </section>
      ${finalCta({
        eyebrow: "Current options",
        title: "Ask what fits this project.",
        text: "The team can confirm availability and provide official terms for review."
      })}
    `
  })
};

const contact = {
  path: "/contact/",
  html: layout({
    title: "Greater Chicago Roof Inspection",
    description:
      "Start a free roofing quote or request an exterior inspection across Greater Chicago from Barrington-headquartered Raccoon Restoration.",
    path: "/contact/",
    pageType: "contact",
    body: `
      <section class="contact-hero">
        <div class="shell">
          ${breadcrumbs([{ label: "Contact", href: "#" }])}
          <div class="contact-grid">
            <div class="contact-copy">
              <p class="eyebrow">Free quote &amp; inspection request</p>
              <h1>Tell us what is happening.</h1>
              <p>Share the concern, property location, and the best way to reach you. A clear quote starts with understanding the property and scope.</p>
              <div class="contact-methods">
                <a href="tel:${business.phoneHref}" data-event="phone_click" data-position="contact"><span>${icon("phone")}</span><div><small>Call</small><strong>${business.phoneDisplay}</strong></div></a>
                <a href="mailto:${business.email}" data-event="email_click" data-position="contact"><span>${icon("arrow")}</span><div><small>Email</small><strong>${business.email}</strong></div></a>
                <div><span>${icon("home")}</span><div><small>Service area</small><strong>Greater Chicago</strong></div></div>
                <div><span>${icon("target")}</span><div><small>Headquarters</small><strong>Barrington, Illinois</strong></div></div>
              </div>
              <p class="contact-license">${business.license}</p>
            </div>
            <div class="form-panel" id="inspection-form">
              <p class="eyebrow">Get your instant quote</p>
              <h2>Start with the property.</h2>
              ${inspectionForm()}
            </div>
          </div>
        </div>
      </section>
    `
  })
};

const thankYou = {
  path: "/thank-you/",
  html: layout({
    title: business.formEndpoint
      ? "Inspection Request Received"
      : "Contact Raccoon Restoration",
    description: business.formEndpoint
      ? "Thank you for contacting Raccoon Restoration. For immediate roofing help, call (224) 500-6825."
      : "Call or email Raccoon Restoration to request roofing and restoration service across Greater Chicago.",
    path: "/thank-you/",
    pageType: "thank-you",
    noindex: true,
    body: `
      <section class="thank-you pattern">
        <div class="shell thank-you__inner">
          <span class="thank-you__icon">${icon(business.formEndpoint ? "check" : "phone")}</span>
          <p class="eyebrow">${business.formEndpoint ? "Your request is in" : "Direct contact required"}</p>
          <h1>${business.formEndpoint ? "Thank you for reaching out." : "Call or email the team."}</h1>
          <p>${
            business.formEndpoint
              ? "We will review the details you shared and follow up with the next step. If the issue is urgent, please call."
              : "Online request delivery is not active yet. No quote request was sent from this page. Call Raccoon Restoration so the team can confirm the next useful step."
          }</p>
          <div class="button-row">
            ${button({
              href: `tel:${business.phoneHref}`,
              label: `Call ${business.phoneDisplay}`,
              event: "thank_you_call_click",
              position: "thank_you"
            })}
            ${button({
              href: "/",
              label: "Return Home",
              variant: "outline",
              position: "thank_you"
            })}
          </div>
        </div>
      </section>
    `
  })
};

const privacy = {
  path: "/privacy/",
  html: layout({
    title: "Privacy Policy",
    description:
      "Privacy policy for the Raccoon Restoration website and inspection-request form.",
    path: "/privacy/",
    pageType: "legal",
    body: legalPage(
      "Privacy Policy",
      "How website and inquiry information is handled.",
      [
        ["Information you provide", "When you use the quote form, you may provide your name, phone number, email address, property address and type, service interest, project timing, storm or claim context, response preference, and a description of the concern."],
        ["How information is used", "Inquiry information is used to respond to your request, determine service availability, route the request to the appropriate team member, schedule next steps, and improve the customer experience. Personal details entered in inquiry fields are not included in analytics events."],
        ["Website data", "The site uses Vercel Web Analytics and IDPixel, a third-party analytics and advertising technology. These services may receive browser, device, page, referral, campaign, network, identifier, and interaction information used to understand website activity and support marketing measurement. Raccoon Restoration’s custom analytics events are limited to approved page, referral, campaign, and interaction labels and do not intentionally include personal details entered in quote-form fields."],
        ["Service providers", "Hosting, form delivery, analytics and advertising, spam protection, scheduling, and customer-relationship providers may process information as needed to operate the site, measure activity, and respond to requests."],
        ["Tracking choices", "Browser privacy controls, content blockers, and applicable consent controls may limit website tracking. You may also contact Raccoon Restoration with privacy questions or requests."],
        ["Your choices", `You may request access, correction, or deletion of inquiry information by emailing ${business.email}. Legal, security, and recordkeeping obligations may limit some requests.`],
        ["Contact", `${business.name}, Barrington, Illinois · ${business.email} · ${business.phoneDisplay}`]
      ],
      { updated: "August 3, 2026" }
    )
  })
};

const terms = {
  path: "/terms/",
  html: layout({
    title: "Website Terms",
    description:
      "Terms governing use of the Raccoon Restoration website, service information, estimates, and project inquiries.",
    path: "/terms/",
    pageType: "legal",
    body: legalPage(
      "Website Terms",
      "General conditions for using this website.",
      [
        ["Informational purpose", "Website content is general information and does not replace a property inspection, written proposal, contract, manufacturer document, insurance policy, legal advice, or engineering advice."],
        ["Service availability", "Services, geographic coverage, scheduling, financing, materials, certifications, and warranty options may change and should be confirmed in writing for each project."],
        ["Insurance", "Raccoon Restoration is a roofing and restoration contractor, not a public adjuster. The company may inspect and document visible damage, prepare a repair estimate, and confer with an insurance company’s representative about property damage and repair options. Raccoon Restoration does not interpret policy coverage, file claims on a customer’s behalf, or negotiate claim settlements. Coverage decisions belong to the insurance carrier."],
        ["Estimates and contracts", "No website statement creates a binding project scope or price. Approved work is governed by the signed written agreement and incorporated documents."],
        ["Intellectual property", "Site copy, design, and approved brand assets may not be reused in a way that implies affiliation or endorsement."],
        ["Contact", `Questions about these terms may be sent to ${business.email}.`]
      ],
      { updated: "August 4, 2026" }
    )
  })
};

const accessibility = {
  path: "/accessibility/",
  html: layout({
    title: "Accessibility Statement",
    description:
      "Raccoon Restoration is committed to an accessible website experience and welcomes accessibility feedback.",
    path: "/accessibility/",
    pageType: "legal",
    body: legalPage(
      "Accessibility Statement",
      "A practical commitment to usable access.",
      [
        ["Our approach", "This site is designed toward WCAG 2.2 Level AA practices, including semantic structure, keyboard access, visible focus, labeled forms, responsive text, sufficient contrast, and reduced-motion support."],
        ["Known limitations", "Third-party destinations, including public review profiles, are outside this site’s direct control. Contact us if you encounter a barrier on this website."],
        ["Feedback", `If you have difficulty using any part of the site, call ${business.phoneDisplay} or email ${business.email}. Include the page address and a short description of the problem if possible.`],
        ["Ongoing work", "Accessibility is an ongoing operational requirement. New pages, project stories, integrations, and media should be reviewed before publication."]
      ]
    )
  })
};

function legalPage(
  title,
  intro,
  sections,
  { updated = "July 30, 2026" } = {}
) {
  return `
    <section class="legal-hero pattern">
      <div class="shell">
        ${breadcrumbs([{ label: title, href: "#" }])}
        <p class="eyebrow">Raccoon Restoration</p>
        <h1>${title}</h1>
        <p>${intro}</p>
      </div>
    </section>
    <section class="section section--cream">
      <article class="shell prose prose--legal">
        <p class="legal-date">Last updated ${updated}</p>
        ${sections.map(([heading, text]) => `<h2>${heading}</h2><p>${text}</p>`).join("")}
      </article>
    </section>
  `;
}

const notFound = {
  path: "/404.html",
  output: "404.html",
  noSitemap: true,
  html: layout({
    title: "Page Not Found",
    description: "The page you requested could not be found.",
    path: "/404.html",
    pageType: "error",
    noindex: true,
    body: `
      <section class="thank-you pattern">
        <div class="shell thank-you__inner">
          <p class="eyebrow">404 · Page not found</p>
          <h1>This page is off the roofline.</h1>
          <p>The link may be outdated, or the page may have moved. Start again with a service or contact the team directly.</p>
          <div class="button-row">
            ${button({ href: "/", label: "Return Home", position: "404" })}
            ${button({ href: "/services/", label: "View Services", variant: "outline", position: "404" })}
          </div>
        </div>
      </section>
    `
  })
};

export const pages = [
  home,
  serviceIndex,
  ...servicePages,
  projects,
  ...caseStudyPages,
  reviews,
  about,
  process,
  serviceAreas,
  barrington,
  resources,
  ...resourcePages,
  faq,
  warranty,
  financing,
  contact,
  thankYou,
  privacy,
  terms,
  accessibility,
  notFound
];

export const buildManifest = {
  services,
  aboveStandard,
  processSteps,
  claims: claimRegistry,
  faqs,
  resources: resourceArticles
};
