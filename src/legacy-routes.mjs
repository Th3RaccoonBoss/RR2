// Public routes observed on the WordPress site or retained from earlier
// production history. Keep this file platform-neutral: deployment adapters
// should consume the redirect list, while retired routes must remain absent.
export const legacyRedirects = [
  // Temporary public hold while project imagery provenance is confirmed.
  {
    source: "/projects/",
    destination: "/services/",
    status: 302,
    evidence: "Owner-directed project provenance hold, November 4, 2026"
  },
  {
    source: "/projects/tudor-exterior-transformation/",
    destination: "/services/gutters-exteriors/",
    status: 302,
    evidence: "Owner-directed project provenance hold, November 4, 2026"
  },
  {
    source: "/projects/commercial-flat-roof/",
    destination: "/services/",
    status: 302,
    evidence: "Owner-directed project provenance hold, November 4, 2026"
  },

  {
    source: "/contact-us-3/",
    destination: "/contact/",
    status: 301,
    evidence: "WordPress page sitemap and Google result"
  },
  {
    source: "/contact-us/",
    destination: "/contact/",
    status: 301,
    evidence: "WordPress homepage link and live redirect"
  },
  {
    source: "/services/roofing/",
    destination: "/services/",
    status: 301,
    evidence: "Previously preserved production route"
  }
];

export const legacyRetirements = [
  {
    source: "/hello-world/",
    expectedStatus: 404,
    reason: "Off-topic WordPress starter content with no relevant replacement"
  },
  {
    source: "/blog-post-title/",
    expectedStatus: 404,
    reason: "Generic WordPress placeholder content with no relevant replacement"
  },
  {
    source: "/blog-post-title-2/",
    expectedStatus: 404,
    reason: "Generic WordPress placeholder content with no relevant replacement"
  },
  {
    source: "/category/uncategorized/",
    expectedStatus: 404,
    reason: "Archive containing only retired placeholder posts"
  },
  {
    source: "/metform-form/new-form-1742830175/",
    expectedStatus: 404,
    reason: "WordPress form utility URL that must not remain indexable"
  }
];
