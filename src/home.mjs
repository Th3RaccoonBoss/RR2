// Compact homepage approved November 4, 2026. Shared production layout and intake remain in templates.mjs.
import { icon, quoteCta } from "./templates.mjs";

export const homeBody = () => `
<section class="home-hero">
        <picture class="home-hero__picture">
          <source media="(max-width: 640px)" type="image/webp" srcset="/assets/editorial-v2/home-hero-mobile-800x1000.webp">
<source media="(max-width: 640px)" srcset="/assets/editorial-v2/home-hero-mobile-800x1000.jpg">
          <source type="image/webp" srcset="/assets/images/hero-home.webp">
<img loading="eager" class="home-hero__image" src="/assets/images/hero-home.jpg" alt="" width="1800" height="1013" fetchpriority="high" decoding="async">
        </source>
</source>
</source>
</picture>
        <div class="home-hero__scrim">
</div>
        <div class="shell home-hero__inner">
          <div class="home-hero__copy">
            <p class="eyebrow">Barrington, Illinois · Greater Chicago Roofing</p>
            <h1 class="brand-slogan">
<span class="brand-slogan__setup">We don’t follow<br>industry standards.</span> <span class="brand-slogan__promise">We set them.</span>
</h1>
            <p class="home-hero__lead">Roof repair, replacement, and storm restoration.<br>Based in Barrington. Serving Greater Chicago.</p>
            <div class="button-row">
              <a class="button button--primary" href="/contact/?intent=quote#inspection-form" data-event="quote_cta_click" data-position="hero" data-intent="quote">
<span>Request a Quote</span>
<svg class="icon " aria-hidden="true" viewbox="0 0 24 24">
<path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8">
</path>
</svg>
</a>
              <a class="button button--outline" href="#services" data-event="service_card_click" data-position="hero">
<span>Explore Services</span>
<svg class="icon " aria-hidden="true" viewbox="0 0 24 24">
<path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8">
</path>
</svg>
</a>
            </div>
          </div>
        </div>
      </section>
<section class="credential-strip" id="credentials" aria-label="Contractor credentials">
<div class="shell credential-grid">
<div class="credential-profile">
<img class="credential-logo credential-logo--oc" src="/assets/credentials/owens-corning-preferred-contractor.png" width="366" height="138" alt="Owens Corning Preferred Contractor" loading="lazy" decoding="async">
</div>
<div class="credential-profile">
<img class="credential-logo credential-logo--gaf" src="/assets/credentials/gaf-certified-residential-roofing-contractor.png" width="2810" height="2811" alt="GAF Certified Residential Roofing Contractor" loading="lazy" decoding="async">
</div>
<a class="credential-warranty" href="#warranty">
<span>5-year</span>
<strong>Workmanship warranty</strong>
<small>Backed by Raccoon Restoration</small>
</a>
</div>
<nav class="reputation-links" aria-label="Independent ratings">
<div class="shell reputation-links__inner">
<a class="reputation-link" data-event="review_source_click" data-position="home_proof" href="https://www.bbb.org/us/il/barrington/profile/roofing-consultants/raccoon-restoration-0654-90025835#rating" target="_blank" rel="noopener noreferrer">
<span class="reputation-link__score">A+</span>
<span class="reputation-link__copy">
<strong>BBB rating</strong>
<small>Accredited Business</small>
</span>
<svg class="icon" aria-hidden="true" viewbox="0 0 24 24">
<path d="M6 18L18 6M6 6h12v12" fill="none" stroke="currentColor" stroke-width="1.8">
</path>
</svg>
</a>
<a class="reputation-link" data-event="review_source_click" data-position="home_proof" href="https://www.google.com/maps/place/Raccoon+Restoration/@41.6325274,-88.6188987,9z/data=!3m1!4b1!4m6!3m5!1s0x8b64af637c69da7b:0xd80a48f725dc1060!8m2!3d41.6344115!4d-87.959509!16s%2Fg%2F11x785qcl4?entry=ttu&amp;g_ep=EgoyMDI2MTEwMS4wIKXMDSoASAFQAw%3D%3D" target="_blank" rel="noopener noreferrer">
<span class="reputation-link__score">5.0</span>
<span class="reputation-link__copy">
<strong>Google rating</strong>
<small>Read customer reviews</small>
</span>
<svg class="icon" aria-hidden="true" viewbox="0 0 24 24">
<path d="M6 18L18 6M6 6h12v12" fill="none" stroke="currentColor" stroke-width="1.8">
</path>
</svg>
</a>
</div>
</nav>
</section>
<section class="roof-index" id="services">
<div class="shell roof-index__grid">
<figure class="roof-index__image">
<picture>
<source type="image/webp" srcset="/assets/editorial-v2/warranty-finished-roof-web-1280.webp">
<img src="/assets/editorial-v2/warranty-finished-roof-web-1280.jpg" alt="Aerial view of intersecting architectural-shingle rooflines" width="1280" height="720" loading="lazy" decoding="async">
</source>
</picture>
<figcaption>
<span>Raccoon Restoration</span>
<strong>Built for what’s overhead.</strong>
</figcaption>
</figure>
<div class="roof-index__content">
<p class="eyebrow">Roofing &amp; Restoration</p>
<h2>What does <br>your roof need?</h2>
<nav class="roof-service-list" aria-label="Choose a roofing service">
<a class="roof-service-row" href="/services/roof-replacement/" data-event="service_card_click" data-service="roof-replacement" data-position="home_services">
<span class="roof-service-row__number">01</span>
<span>
<h3>Roof Replacement</h3>
<p>A new roof, planned as a complete system.</p>
</span>
<svg class="icon" aria-hidden="true" viewbox="0 0 24 24">
<path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8">
</path>
</svg>
</a>
<a class="roof-service-row" href="/services/roof-repair/" data-event="service_card_click" data-service="roof-repair" data-position="home_services">
<span class="roof-service-row__number">02</span>
<span>
<h3>Roof Repair</h3>
<p>Find the source. Choose the right repair.</p>
</span>
<svg class="icon" aria-hidden="true" viewbox="0 0 24 24">
<path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8">
</path>
</svg>
</a>
<a class="roof-service-row" href="/services/storm-damage-restoration/" data-event="service_card_click" data-service="storm-damage-restoration" data-position="home_services">
<span class="roof-service-row__number">03</span>
<span>
<h3>Storm Restoration</h3>
<p>Document the damage. Plan the repair.</p>
</span>
<svg class="icon" aria-hidden="true" viewbox="0 0 24 24">
<path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8">
</path>
</svg>
</a>
<a class="roof-service-row" href="/services/gutters-exteriors/" data-event="service_card_click" data-service="gutters-exteriors" data-position="home_services">
<span class="roof-service-row__number">04</span>
<span>
<h3>Gutters &amp; Exteriors</h3>
<p>Care for the roofline and drainage.</p>
</span>
<svg class="icon" aria-hidden="true" viewbox="0 0 24 24">
<path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8">
</path>
</svg>
</a>
</nav>
</div>
</div>
<div class="shell roof-index__foot">
<span>Greater Chicago roofing · Illinois storm inquiries welcome</span>
<a href="/service-areas/">Service areas <svg class="icon link-arrow" aria-hidden="true" viewbox="0 0 24 24">
<path d="M6 18L18 6M6 6h12v12" fill="none" stroke="currentColor" stroke-width="1.8">
</path>
</svg>
</a>
<a href="/reviews/">More reviews <svg class="icon link-arrow" aria-hidden="true" viewbox="0 0 24 24">
<path d="M6 18L18 6M6 6h12v12" fill="none" stroke="currentColor" stroke-width="1.8">
</path>
</svg>
</a>
</div>
</section>
<section class="process-rail" id="process">
<div class="shell">
<div class="compact-heading">
<p class="eyebrow">The process</p>
<h2>From first look to final walkthrough.</h2>
<a href="/process/">See the steps <svg class="icon link-arrow" aria-hidden="true" viewbox="0 0 24 24">
<path d="M6 18L18 6M6 6h12v12" fill="none" stroke="currentColor" stroke-width="1.8">
</path>
</svg>
</a>
</div>
<ol class="process-line">
<li>
<span>01</span>
<div>
<h3>Inspect.</h3>
<p>Review the conditions and your options.</p>
</div>
</li>
<li>
<span>02</span>
<div>
<h3>Plan.</h3>
<p>Agree on the scope, materials, and price.</p>
</div>
</li>
<li>
<span>03</span>
<div>
<h3>Complete.</h3>
<p>Finish the work, cleanup, and walkthrough.</p>
</div>
</li>
</ol>
</div>
</section>
<section class="warranty-edit" id="warranty" aria-label="Workmanship and manufacturer warranties">
<div class="shell warranty-edit__grid">
<div class="workmanship-mark">
<span class="eyebrow">Raccoon Restoration</span>
<div class="workmanship-mark__number">5<span>years</span>
</div>
<h2>Workmanship.<br>Backed.</h2>
<p>Our roofing workmanship is backed for five years.<br>Ask for the written terms with your proposal.</p>
</div>
<div class="manufacturer-cover">
<p class="eyebrow">Optional Owens Corning upgrade</p>
<h2>More protection<br>for the roof you choose.</h2>
<p class="manufacturer-cover__lead">Up to <strong>50 years</strong> of non-prorated coverage for eligible manufacturing defects on qualifying roofing systems.</p>
<p class="manufacturer-cover__terms" id="oc-warranty-copy">For qualifying owner-occupied single-family detached homes. Eligible roofing system, certified installation, and timely registration required. Terms and exclusions apply.</p>
<p class="manufacturer-cover__terms" id="oc-warranty-detail">Manufacturer-defect coverage, not workmanship coverage. The plan, products, coverage, and upgrade price will be confirmed in your proposal.</p>
<a class="text-link" href="https://www.owenscorning.com/en-us/roofing/warranty" target="_blank" rel="noopener noreferrer">Review manufacturer warranties <svg class="icon link-arrow" aria-hidden="true" viewbox="0 0 24 24">
<path d="M6 18L18 6M6 6h12v12" fill="none" stroke="currentColor" stroke-width="1.8">
</path>
</svg>
</a>
</div>
</div>
</section>
<section class="quote-edit" id="request-quote">
  <div class="shell quote-edit__grid">
    <div>
      <p class="eyebrow">Your roof. Let’s talk.</p>
      <h2>Let’s take <br>a look.</h2>
      <p>Tell us where you are and what you’ve noticed.</p>
      <div class="quote-contact">
        <a href="tel:+12245006825" data-event="phone_click" data-position="home_contact">(224) 500-6825</a>
        <a href="mailto:info@raccoonrestoration.com" data-event="email_click" data-position="home_contact">info@raccoonrestoration.com</a>
      </div>
      <a class="text-link" href="/faq/">A few questions first? ${icon("arrow")}</a>
    </div>
    <div class="quote-request-panel">
      <p class="eyebrow">Start with your property</p>
      <h3>Request an inspection.</h3>
      <p>Share the property details and the work you’re considering using our secure quote request form.</p>
      ${quoteCta({ position: "home_contact" })}
    </div>
  </div>
</section>
`;
