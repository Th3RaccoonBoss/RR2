export const business = {
  name: "Raccoon Restoration",
  descriptor: "Roofing & Restoration",
  slogan: "We don’t follow industry standards. We set them.",
  supportingStatement:
    "Premium roofing and restoration for homeowners who expect more.",
  phoneDisplay: "(224) 500-6825",
  phoneHref: "+12245006825",
  email: "info@raccoonrestoration.com",
  city: "Barrington",
  state: "IL",
  market: "Greater Chicago",
  serviceAreaName: "Greater Chicago area, with storm-response inquiries across Illinois",
  license: "Illinois Unlimited Roofing License #104.020040",
  siteUrl: process.env.SITE_URL || "https://www.raccoonrestoration.com",
  formEndpoint: process.env.FORM_ENDPOINT || ""
};

export const navigation = [
  { label: "Services", href: "/services/" },
  { label: "Why Us", href: "/about/" },
  { label: "Our Process", href: "/process/" },
  { label: "Reviews", href: "/reviews/" },
  { label: "Blog & Resources", href: "/resources/" }
];

export const trustSignals = [
  { icon: "shield", label: "Free inspections" },
  { icon: "target", label: "Storm damage experts" },
  { icon: "wrench", label: "Quality craftsmanship" },
  { icon: "clock", label: "Fast, reliable service" }
];

export const services = [
  {
    slug: "roof-replacement",
    name: "Roof Replacement",
    eyebrow: "A complete roofing system",
    summary:
      "A complete roof-system replacement planned around the home, the scope, and the details that protect it.",
    short: "Replace the full system with a clear plan.",
    image:
      "/assets/editorial-v2/roof-replacement-premium-service-card-1280.jpg",
    cardImage:
      "/assets/editorial-v2/roof-replacement-premium-service-card-1280.jpg",
    cardSrcset:
      "/assets/editorial-v2/roof-replacement-premium-service-card-640.jpg 640w, /assets/editorial-v2/roof-replacement-premium-service-card-1280.jpg 1280w",
    cardSizes:
      "(max-width: 800px) calc(100vw - 32px), (max-width: 1100px) 50vw, 25vw",
    cardImageAlt:
      "Upscale stone residence with a dark charcoal architectural-shingle roof, warm interior lighting, and rain-darkened pavement",
    cardImageWidth: 1280,
    cardImageHeight: 720,
    imageAlt:
      "Upscale stone residence with a dark charcoal architectural-shingle roof, warm interior lighting, and rain-darkened pavement",
    imageWidth: 1280,
    imageHeight: 720,
    mediaCaption: "Roof replacement · service illustration",
    signs: [
      "Widespread shingle wear or granule loss",
      "Repeated repairs in multiple roof areas",
      "Age-related deterioration across the roof system",
      "Decking, flashing, or ventilation concerns discovered during inspection"
    ],
    includes: [
      "Roof-system inspection and documented findings",
      "Clear scope and material-option review",
      "Property-protection and site-access planning",
      "Removal, installation, cleanup, and final walkthrough"
    ],
    faq: [
      {
        q: "How do I know whether replacement is actually necessary?",
        a: "Start with the condition of the complete roof system—not age alone. An inspection should distinguish isolated repairable issues from widespread failure and explain the evidence behind either recommendation."
      },
      {
        q: "Will I be able to compare material options?",
        a: "Material selections should be matched to the home, scope, expected service life, and budget. Raccoon Restoration can review available options after the roof has been assessed."
      }
    ]
  },
  {
    slug: "roof-repair",
    name: "Roof Repair",
    eyebrow: "Fix the source",
    summary:
      "Targeted repair for active leaks, damaged roof details, and localized failures—without assuming replacement.",
    short: "Find the source before choosing the fix.",
    image: "/assets/images/roofer-inspection.jpg",
    cardImage: "/assets/images/roof-repair-inspection-card-640.jpg",
    cardImageAlt:
      "Roofing professional inspecting dark architectural shingles",
    cardImageWidth: 640,
    cardImageHeight: 426,
    imageAlt:
      "Roofing professional inspecting dark architectural shingles",
    imageWidth: 1200,
    imageHeight: 800,
    mediaCaption: "Roof inspection · service illustration",
    signs: [
      "Water stains or active interior dripping",
      "Missing, lifted, or damaged shingles",
      "Failed flashing around walls, chimneys, or penetrations",
      "Localized soft spots or recurring moisture"
    ],
    includes: [
      "Interior and exterior symptom review",
      "Inspection of likely water-entry points",
      "Photo documentation when conditions allow",
      "A defined repair recommendation and next step"
    ],
    faq: [
      {
        q: "Does a leak always mean I need a new roof?",
        a: "No. Many leaks begin at a specific detail and may be repairable. The right recommendation depends on the source, surrounding condition, and whether a localized repair can provide a durable result."
      },
      {
        q: "What should I do during an active leak?",
        a: "Move belongings away from the affected area, contain water if it is safe to do so, and avoid climbing onto the roof. Call for an assessment and share where and when the leak appeared."
      }
    ]
  },
  {
    slug: "storm-damage-restoration",
    name: "Storm Damage Restoration",
    eyebrow: "After the storm, start with clarity",
    summary:
      "A documented wind or hail assessment, followed by a clear repair or restoration scope when work is warranted.",
    short: "Document the conditions. Plan the next step.",
    image:
      "/assets/editorial-v2/storm-restoration-assessment-service-card-v2-1280.jpg",
    cardImage:
      "/assets/editorial-v2/storm-restoration-assessment-service-card-v2-1280.jpg",
    cardSrcset:
      "/assets/editorial-v2/storm-restoration-assessment-service-card-v2-640.jpg 640w, /assets/editorial-v2/storm-restoration-assessment-service-card-v2-1280.jpg 1280w",
    cardSizes:
      "(max-width: 800px) calc(100vw - 32px), (max-width: 1100px) 50vw, 25vw",
    cardImageAlt:
      "Roofing professional photographing lifted shingles on a wet residential roof",
    cardImageWidth: 1280,
    cardImageHeight: 720,
    imageAlt:
      "Roofing professional photographing lifted shingles on a wet residential roof",
    imageWidth: 1280,
    imageHeight: 720,
    mediaCaption: "Storm assessment · service illustration",
    signs: [
      "Missing, creased, or displaced shingles",
      "Fresh damage to roof edges, vents, gutters, or siding",
      "New interior moisture after severe weather",
      "Debris impact or fallen-limb concerns"
    ],
    includes: [
      "Storm-related exterior inspection",
      "Photo documentation of observed conditions",
      "A clearly defined repair or restoration scope",
      "Damage documentation and repair-estimate support"
    ],
    faq: [
      {
        q: "Should I climb onto the roof after a storm?",
        a: "No. Wet surfaces, loose materials, and hidden damage make roof access dangerous. A ground-level visual check and professional inspection are safer."
      },
      {
        q: "How do you help after storm damage?",
        a: "We inspect and document visible damage, prepare a repair scope and estimate, and can discuss the property damage and repair options with your insurer’s representative."
      }
    ]
  },
  {
    slug: "gutters-exteriors",
    name: "Gutters & Exteriors",
    eyebrow: "Protection beyond the roof",
    summary:
      "Gutter and exterior work coordinated as part of the home’s drainage and weather-protection system.",
    short: "Protect the roofline and drainage path.",
    image:
      "/assets/editorial-v2/warranty-finished-roof-web-1280.jpg",
    cardImage:
      "/assets/editorial-v2/warranty-finished-roof-web-1280.jpg",
    cardSrcset:
      "/assets/editorial-v2/warranty-finished-roof-web-1280.jpg 1280w",
    cardSizes:
      "(max-width: 800px) calc(100vw - 32px), (max-width: 1100px) 50vw, 25vw",
    cardImageAlt:
      "Aerial view of a gray architectural-shingle roof with white gutters and intersecting rooflines",
    cardImageWidth: 1280,
    cardImageHeight: 720,
    imageAlt:
      "Aerial view of a gray architectural-shingle roof with white gutters and intersecting rooflines",
    imageWidth: 1280,
    imageHeight: 720,
    mediaCaption: "Gutter installation · service illustration",
    signs: [
      "Overflowing, sagging, or separated gutter sections",
      "Water concentrating near the foundation",
      "Damaged fascia, soffit, or exterior trim",
      "Exterior components affected by a roofing or storm project"
    ],
    includes: [
      "Roofline and drainage assessment",
      "Condition review of related exterior components",
      "A coordinated project scope when services are available",
      "Installation details reviewed at final walkthrough"
    ],
    faq: [
      {
        q: "Why evaluate gutters during a roofing project?",
        a: "Roof drainage, edge details, fascia, and gutters work together. Reviewing them as a system can reveal conflicts before installation and help manage water more effectively."
      },
      {
        q: "Which exterior services are available?",
        a: "Availability varies by property and project type. Share the work you are considering, and the team will confirm which services can be coordinated for your home."
      }
    ]
  }
];

export const processSteps = [
  {
    number: "01",
    title: "Inspect",
    text: "Assess the property and document the conditions that can be observed."
  },
  {
    number: "02",
    title: "Explain",
    text: "Translate the findings into plain language and practical options."
  },
  {
    number: "03",
    title: "Plan",
    text: "Define the scope, materials, property protection, and next steps."
  },
  {
    number: "04",
    title: "Build",
    text: "Complete approved work with disciplined coordination and care."
  },
  {
    number: "05",
    title: "Verify",
    text: "Review the finished scope, cleanup, and remaining questions."
  }
];

export const aboveStandard = [
  {
    title: "Clear before work begins",
    text: "Understand the findings, scope, and next step before approving work."
  },
  {
    title: "Built right where it matters",
    text: "Critical details receive the same attention as the finished surface."
  },
  {
    title: "Communication without chasing",
    text: "Know who is responsible, where the project stands, and what comes next."
  },
  {
    title: "Respect for the property",
    text: "Access, landscaping, and cleanup are built into the plan."
  },
  {
    title: "Verified before completion",
    text: "Finish with a walkthrough and a clear record of completed work."
  }
];

export const faqs = [
  {
    q: "What happens during a free inspection?",
    a: "We review the concern, inspect accessible roof and exterior conditions, document findings, and explain the next step. Scope varies with weather, access, and the service requested."
  },
  {
    q: "Do you serve my town?",
    a: "We serve Greater Chicago from Barrington, including Darien, Tinley Park and Orland Park, and welcome storm-damage inquiries statewide. Share your city or ZIP code to confirm availability."
  },
  {
    q: "How do you help with storm-damage documentation?",
    a: "We document visible damage, prepare the repair estimate, and can discuss the damage and repair options with your insurer’s representative."
  },
  {
    q: "Are financing and warranty options available?",
    a: "Programs and terms vary by project. Ask what applies to your scope and review the written details before deciding."
  },
  {
    q: "Which services do you provide?",
    a: "Our capabilities include roofing, siding, gutters, interior restoration, paint and wallcoverings, windows and doors, project estimating, design guidance, water and flood-damage assessments, and storm-damage documentation. Availability is confirmed for each property and scope."
  }
];

export const proof = {
  eyebrow: "Local accountability",
  title: "Trust is easier to verify.",
  microcopy:
    "Don't take our word for it \u2014 check the sources yourself.",
  marks: [
    {
      id: "bbb",
      verified: true,
      mark: "BBB",
      title: "BBB Accredited · A+ rating",
      href: "https://www.bbb.org/us/il/barrington/profile/roofing-consultants/raccoon-restoration-0654-90025835"
    },
    {
      id: "il-roofing-license",
      verified: true,
      icon: "shield",
      title: "Illinois Unlimited Roofing License #104.020040"
    }
  ],
  quotes: [
    {
      verified: true,
      initial: "J",
      quote:
        "The job was completed in a timely manner, and communication throughout the entire process was smooth.",
      name: "Julian K.",
      context: "Commercial roofing review"
    },
    {
      verified: true,
      initial: "M",
      quote: "The experience was excellent from start to finish.",
      name: "Matthew B.",
      context: "Roof replacement review"
    }
  ],
  link: { href: "/reviews/", label: "View independent sources" }
};

export const selectedWork = [
  {
    caption: "Residential · Aerial View",
    image: "/assets/projects/project-modern-residence-roof-aerial-640.jpg",
    srcset: "/assets/projects/project-modern-residence-roof-aerial-640.jpg 640w",
    alt:
      "Top-down drone view of a large dark multi-plane roof over a modern white residence and attached garage, surrounded by lawn and trees",
    width: 640,
    height: 360
  },
  {
    caption: "Commercial Flat Roof Installation",
    image:
      "/assets/projects/project-low-slope-roof-aerial-enhanced-v3-640.jpg",
    srcset: "/assets/projects/project-low-slope-roof-aerial-enhanced-v3-640.jpg 640w",
    alt:
      "Aerial view of a large commercial building during flat roof installation, with a bright white low-slope roofing system, rooftop equipment, and workers",
    width: 640,
    height: 360
  },
  {
    caption: "Tudor-Inspired Residence · Exterior",
    image:
      "/assets/projects/project-tudor-residence-exterior-polished-v7-640.jpg",
    srcset:
      "/assets/projects/project-tudor-residence-exterior-polished-v7-640.jpg 640w",
    alt:
      "Polished completed view of a large Tudor-inspired home with dark roof planes, a round stone tower, black-and-white trim, a clean entry, defined planting beds, and a manicured lawn",
    width: 640,
    height: 360
  }
];

export const assurancePaths = [
  {
    label: "Financing",
    title: "Ask what fits this project.",
    href: "/financing/"
  },
  {
    label: "Warranty",
    title: "Clear terms before the work begins.",
    href: "/warranty/"
  }
];

export const founder = {
  // Stays hidden until every field is filled with client-approved values and
  // a real released portrait. Never activate with stock or generated people.
  verified: false,
  eyebrow: "Leadership",
  name: "",
  role: "",
  quote: "",
  portrait: "",
  portraitAlt: "",
  portraitWidth: 0,
  portraitHeight: 0
};

export const claimRegistry = [
  {
    claim: "Serves the Greater Chicago area",
    status: "client_confirmed",
    source: "Client confirmation, July 30, 2026"
  },
  {
    claim: "Barrington, Illinois location",
    status: "verified",
    source: "Existing public website and BBB profile"
  },
  {
    claim: "(224) 500-6825",
    status: "verified",
    source: "Existing public website, BBB, and GAF profile"
  },
  {
    claim: "info@raccoonrestoration.com",
    status: "verified",
    source: "Existing public website"
  },
  {
    claim: "Illinois Unlimited Roofing License #104.020040",
    status: "verified",
    source: "https://data.illinois.gov/Business-and-Workforce/Professional-Licensing/pzzh-kp68/data_preview",
    verifiedOn: "2026-11-04",
    sourceUpdatedOn: "2026-11-02",
    licenseStatus: "ACTIVE",
    classification: "UNLIMITED",
    registeredBusiness: "ALPHA RESTORATION INC DBA RACCOON RESTORATION",
    expiration: "2027-12-31"
  },
  {
    claim: "GAF Certified contractor",
    status: "verified_external_not_promoted",
    source: "GAF contractor profile; client approval and asset requested"
  },
  {
    claim: "Insured",
    status: "client_confirmed",
    source: "Owner direction, November 4, 2026. Coverage not independently verified."
  },
  {
    claim: "Financing",
    status: "unverified",
    source: "Program details required"
  },
  {
    claim: "Warranty details",
    status: "unverified",
    source: "Written warranty terms required"
  },
  {
    claim: "Google rating and review count",
    status: "verified",
    source: "https://www.google.com/maps/place/Raccoon+Restoration/@41.6325274,-88.6188987,9z/data=!3m1!4b1!4m6!3m5!1s0x8b64af637c69da7b:0xd80a48f725dc1060!8m2!3d41.6344115!4d-87.959509!16s%2Fg%2F11x785qcl4?entry=ttu&g_ep=EgoyMDI2MTEwMS4wIKXMDSoASAFQAw%3D%3D",
    rating: 5.0,
    reviewCount: 29,
    verifiedOn: "2026-11-04"
  },
  {
    claim: "Free inspections",
    status: "client_directed_pending_operational_confirmation",
    source: "Client direction, July 28, 2026"
  },
  {
    claim: "Storm damage experts",
    status: "client_approved_brand_statement",
    source: "Client correction and approval, August 4, 2026"
  },
  {
    claim: "Storm-damage documentation and repair estimating",
    status: "client_confirmed",
    source: "Client correction, August 4, 2026"
  },
  {
    claim: "Quality craftsmanship",
    status: "client_approved_brand_statement",
    source: "Client direction, July 28, 2026"
  },
  {
    claim: "Fast, reliable service",
    status: "client_approved_pending_operational_review",
    source: "Client direction, July 28, 2026"
  },
  {
    claim: "BBB A+ rating and accreditation",
    status: "verified",
    source: "https://www.bbb.org/us/il/barrington/profile/roofing-consultants/raccoon-restoration-0654-90025835#rating",
    verifiedOn: "2026-11-04"
  },
  {
    claim: "Bonded",
    status: "client_confirmed",
    source: "Owner direction, November 4, 2026. Coverage not independently verified."
  }
];
