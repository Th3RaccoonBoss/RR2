const image = "/assets/resources/attic-ventilation-roof-replacement/attic-airflow-cutaway.webp";
const imageAlt = "Conventional attic ventilation diagram: outside air enters through soffit vents at both eaves and exits through a ridge vent.";

export const ventilationArticle = {
  slug: "attic-ventilation-roof-replacement",
  eyebrow: "Attic ventilation guide",
  title: "Why an aging roof deserves a roof-and-attic assessment",
  seoTitle: "Attic Ventilation & Roof Replacement",
  shortTitle: "Check attic ventilation before a roof replacement",
  description: "Planning a Northern Illinois roof replacement? See how we check attic ventilation, soffit intake, and ridge exhaust before recommending roof vents.",
  dek: "What we check about attic ventilation, soffit vents, and ridge exhaust before recommending changes during a roof replacement.",
  readTime: "3 min read",
  datePublished: "2026-11-27",
  dateModified: "2026-11-27",
  sourceReviewed: "2026-11-27",
  image,
  imageAlt,
  imageWidth: 1920,
  imageHeight: 1280,
  sections: [
    {
      heading: "First, find out how the attic was built",
      paragraphs: [
        "You notice shingles curling or wearing sooner than expected. Or you’re planning a roof replacement and someone asks if you want to add a ridge vent. Before recommending more vents, we look at what’s going on underneath. From the driveway alone, you can’t tell whether you’re seeing storm damage, ordinary aging, or an airflow problem.",
        "In a conventional vented attic, outside air moves through the space above the ceiling insulation. A purposely unvented attic is designed differently, with insulation and air control at the roofline. If we don’t see obvious roof vents, we check which assembly we’re looking at before recommending any new openings."
      ],
      links: [
        { href: "https://basc.pnnl.gov/resource-guides/vented-versus-unvented-attic", label: "Building America: Vented and unvented attics" }
      ]
    },
    {
      heading: "Follow the air from soffit intake to roof exhaust",
      paragraphs: [
        "On a vented roof, we check where air gets in, whether insulation blocks its path, and where it gets out. A perforated soffit can look like it’s venting even when the opening behind it is blocked. If there are gable vents, we check how they fit into the existing setup rather than counting them automatically as intake.",
        "Some roofs need more exhaust. Others already have adequate exhaust but need more intake, through soffit vents or, where the roof is suited to it, a roof-deck intake vent like Lomanco Deck-Air. Some need both. That’s why we look at the whole air path before adding another vent."
      ],
      figure: { src: image, alt: imageAlt, width: 1920, height: 1280, caption: "Illustration: airflow in a conventional vented attic." },
      links: [
        { href: "https://www.lomanco.com/vents/specialty-vents/deckair-vent/", label: "Lomanco: Deck-Air roof-deck intake vent" }
      ]
    },
    {
      heading: "Separate the signs from the cause",
      paragraphs: [
        "Staining on the underside of the roof deck tells us where to look, not what caused it. Rain getting in, warm indoor air leaking into a cold attic, and a bath fan dumping moist air into the attic are different problems. Adding vents won’t fix a roof leak or reroute a bath fan."
      ],
      links: [
        { href: "https://basc.pnnl.gov/resource-guides/condensation-control-attics-and-roofs-cold-weather", label: "Building America: Attic condensation in cold weather" },
        { href: "https://basc.pnnl.gov/resource-guides/bathroom-exhaust-fans", label: "Building America: Bathroom exhaust fans" },
        { href: "/resources/is-it-hail-damage/", label: "Compare hail damage and shingle blistering" },
        { href: "/resources/ice-dams-attic-ventilation-chicago/", label: "Read the Chicago-area guide to ice dams and attic ventilation" }
      ]
    },
    {
      heading: "Three questions to ask at your roof estimate",
      paragraphs: [],
      bullets: [
        "What kind of attic or roof assembly did you find?",
        "Where does the air come in and go out, and did you check that the path is clear?",
        "What did you see that supports the work you’re recommending?"
      ]
    }
  ],
  relatedServices: ["roof-replacement", "roof-repair"]
};
