import { createHash } from "node:crypto";

const ACCULYNX_API_ROOT = "https://api.acculynx.com/api/v2";
const EXTERNAL_SOURCE = "Raccoon Restoration Website";
const MAX_REQUEST_BYTES = 64 * 1024;
const MAX_FORM_AGE_MS = 24 * 60 * 60 * 1000;
const MIN_FORM_AGE_MS = 2_500;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

const expectedFields = new Set([
  "request_type",
  "form_started_at",
  "submission_id",
  "company_website",
  "street_address",
  "city",
  "postal_code",
  "property_type",
  "service",
  "project_timing",
  "claim_stage",
  "message",
  "first_name",
  "last_name",
  "phone",
  "email",
  "contact_preference",
  "consent",
  "source_page",
  "submitted_at",
  "campaign_source",
  "campaign_medium",
  "campaign_name",
  "campaign_landing_path"
]);

const propertyTypes = new Set([
  "single-family",
  "multifamily",
  "commercial",
  "association",
  "other"
]);
const services = new Set([
  "roof-replacement",
  "roof-repair",
  "storm-damage-restoration",
  "gutters-exteriors",
  "not-sure"
]);
const projectTimings = new Set([
  "urgent",
  "within-30-days",
  "one-to-three-months",
  "planning",
  "not-sure"
]);
const claimStages = new Set([
  "",
  "not-claim-related",
  "storm-no-claim",
  "claim-opened",
  "claim-review",
  "not-sure"
]);
const contactPreferences = new Set(["", "phone", "text", "email"]);

const propertyLabels = {
  "single-family": "Single-family home",
  multifamily: "Multifamily property",
  commercial: "Commercial property",
  association: "HOA or association",
  other: "Other"
};
const serviceLabels = {
  "roof-replacement": "Roof replacement",
  "roof-repair": "Roof repair",
  "storm-damage-restoration": "Storm damage restoration",
  "gutters-exteriors": "Gutters and exteriors",
  "not-sure": "Not sure yet"
};
const timingLabels = {
  urgent: "Urgent active issue",
  "within-30-days": "Within 30 days",
  "one-to-three-months": "1–3 months",
  planning: "Planning ahead",
  "not-sure": "Not sure yet"
};
const claimLabels = {
  "": "Not provided",
  "not-claim-related": "Not related to an insurance claim",
  "storm-no-claim": "Storm damage; no claim started",
  "claim-opened": "Claim already opened",
  "claim-review": "Existing claim needs another review",
  "not-sure": "Not sure yet"
};

class IntakeError extends Error {
  constructor(message, { status = 400, code = "invalid_request", phase } = {}) {
    super(message);
    this.name = "IntakeError";
    this.status = status;
    this.code = code;
    this.phase = phase;
  }
}

const rateBuckets = new Map();

function text(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\u0000/g, "").slice(0, maxLength);
}

function required(value, field, maxLength) {
  const normalized = text(value, maxLength);
  if (!normalized) {
    throw new IntakeError(`Missing required field: ${field}`, {
      code: "validation_failed"
    });
  }
  return normalized;
}

function enumValue(value, field, allowed, { optional = false } = {}) {
  const normalized = text(value, 80);
  if (optional && !normalized) return "";
  if (!allowed.has(normalized)) {
    throw new IntakeError(`Invalid value for ${field}`, {
      code: "validation_failed"
    });
  }
  return normalized;
}

function normalizePhone(value) {
  let digits = text(value, 40).replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (digits.length !== 10) {
    throw new IntakeError("Enter a valid 10-digit phone number.", {
      code: "validation_failed"
    });
  }
  return digits;
}

function normalizeEmail(value) {
  const email = required(value, "email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new IntakeError("Enter a valid email address.", {
      code: "validation_failed"
    });
  }
  return email;
}

function normalizeZip(value) {
  const zipCode = required(value, "postal_code", 10);
  if (!/^\d{5}(?:-\d{4})?$/.test(zipCode)) {
    throw new IntakeError("Enter a valid ZIP code.", {
      code: "validation_failed"
    });
  }
  return zipCode;
}

function validSubmissionId(value) {
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    ) || /^rr-[a-z0-9-]{10,100}$/i.test(value)
  );
}

function parseTimestamp(value, field) {
  const parsed = Date.parse(required(value, field, 80));
  if (!Number.isFinite(parsed)) {
    throw new IntakeError(`Invalid value for ${field}`, {
      code: "validation_failed"
    });
  }
  return parsed;
}

function localPath(value, field, { optional = false } = {}) {
  const normalized = text(value, 200);
  if (optional && !normalized) return "";
  if (
    !normalized ||
    !normalized.startsWith("/") ||
    normalized.startsWith("//") ||
    normalized.includes("\\") ||
    /[?#\s]/.test(normalized)
  ) {
    throw new IntakeError(`Invalid value for ${field}`, {
      code: "validation_failed"
    });
  }
  return normalized;
}

export function validateLeadPayload(raw, { now = Date.now() } = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new IntakeError("The request body must be a JSON object.", {
      code: "invalid_json"
    });
  }

  const unknown = Object.keys(raw).filter((key) => !expectedFields.has(key));
  if (unknown.length) {
    throw new IntakeError("The request contains unsupported fields.", {
      code: "validation_failed"
    });
  }

  const honeypot = text(raw.company_website, 200);
  if (honeypot) return { spam: true };

  const formStartedAt = Number(required(raw.form_started_at, "form_started_at", 20));
  if (!Number.isFinite(formStartedAt)) {
    throw new IntakeError("Invalid value for form_started_at.", {
      code: "validation_failed"
    });
  }
  const formAge = now - formStartedAt;
  if (formAge < MIN_FORM_AGE_MS || formAge > MAX_FORM_AGE_MS) {
    throw new IntakeError("The form session has expired. Please try again.", {
      code: "form_timing_rejected"
    });
  }

  const submittedAt = parseTimestamp(raw.submitted_at, "submitted_at");
  if (Math.abs(now - submittedAt) > MAX_FORM_AGE_MS) {
    throw new IntakeError("The submission timestamp is outside the allowed window.", {
      code: "form_timing_rejected"
    });
  }

  const submissionId = required(raw.submission_id, "submission_id", 100);
  if (!validSubmissionId(submissionId)) {
    throw new IntakeError("Invalid submission identifier.", {
      code: "validation_failed"
    });
  }

  const sourcePage = localPath(raw.source_page, "source_page");

  if (raw.consent !== "yes") {
    throw new IntakeError("Consent is required to submit this request.", {
      code: "validation_failed"
    });
  }

  return {
    spam: false,
    requestType: required(raw.request_type, "request_type", 50),
    submissionId,
    submittedAt: new Date(submittedAt).toISOString(),
    formStartedAt: new Date(formStartedAt).toISOString(),
    firstName: required(raw.first_name, "first_name", 80),
    lastName: required(raw.last_name, "last_name", 80),
    phone: normalizePhone(raw.phone),
    email: normalizeEmail(raw.email),
    streetAddress: required(raw.street_address, "street_address", 150),
    city: required(raw.city, "city", 80),
    postalCode: normalizeZip(raw.postal_code),
    propertyType: enumValue(raw.property_type, "property_type", propertyTypes),
    service: enumValue(raw.service, "service", services),
    projectTiming: enumValue(
      raw.project_timing,
      "project_timing",
      projectTimings
    ),
    claimStage: enumValue(raw.claim_stage, "claim_stage", claimStages, {
      optional: true
    }),
    message: text(raw.message, 1_500),
    contactPreference: enumValue(
      raw.contact_preference,
      "contact_preference",
      contactPreferences,
      { optional: true }
    ),
    sourcePage,
    campaignSource: text(raw.campaign_source, 100),
    campaignMedium: text(raw.campaign_medium, 100),
    campaignName: text(raw.campaign_name, 150),
    campaignLandingPath: localPath(
      raw.campaign_landing_path,
      "campaign_landing_path",
      { optional: true }
    ),
    consent: {
      accepted: true,
      acceptedAt: new Date(submittedAt).toISOString(),
      text:
        "I agree that Raccoon Restoration may contact me by phone, text, or email about this request. Consent is not a condition of purchase. Message and data rates may apply."
    }
  };
}

function getItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function crmDiagnosticMessage(payload, requestBody) {
  let message =
    typeof payload === "string"
      ? payload
      : typeof payload?.detail === "string"
        ? payload.detail
        : typeof payload?.message === "string"
          ? payload.message
          : "";
  if (!message) return undefined;

  const privateValues = [];
  const collect = (value) => {
    if (typeof value === "string") {
      privateValues.push(
        value,
        ...value.split(/\r?\n/),
        ...value.split(/\s+/)
      );
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }
    if (value && typeof value === "object") {
      Object.values(value).forEach(collect);
    }
  };
  collect(requestBody);

  for (const value of privateValues
    .map((item) => item.trim())
    .filter((item) => item.length >= 2)
    .sort((a, b) => b.length - a.length)) {
    message = message.replaceAll(value, "[redacted]");
  }
  message = message
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[redacted-email]")
    .replace(/\b(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g, "[redacted-phone]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, "[redacted-id]");
  return text(message, 240) || undefined;
}

function extractId(payload, keys = ["id"]) {
  for (const key of keys) {
    if (typeof payload?.[key] === "string" && payload[key]) return payload[key];
  }
  if (payload?.data && typeof payload.data === "object") {
    const nested = extractId(payload.data, keys);
    if (nested) return nested;
  }
  const link =
    typeof payload?._link === "string"
      ? payload._link
      : payload?._link?.href || payload?.link?.href;
  return typeof link === "string"
    ? link.match(/[0-9a-f]{8}-[0-9a-f-]{27,}/i)?.[0] || ""
    : "";
}

function flattenContactValues(contact, keys) {
  return keys
    .flatMap((key) => {
      const value = contact?.[key];
      if (Array.isArray(value)) return value;
      if (value && typeof value === "object") return [value];
      return typeof value === "string" ? [value] : [];
    })
    .map((value) =>
      typeof value === "string"
        ? value
        : value.address || value.number || value.value || ""
    )
    .filter(Boolean);
}

function sameContact(contact, lead) {
  const emails = flattenContactValues(contact, [
    "emailAddresses",
    "emailAddress",
    "emails"
  ]).map((value) => String(value).toLowerCase());
  const phones = flattenContactValues(contact, [
    "phoneNumbers",
    "phoneNumber",
    "phones"
  ]).map((value) => String(value).replace(/\D/g, "").slice(-10));
  return emails.includes(lead.email) || phones.includes(lead.phone);
}

function buildContactNote(lead) {
  return [
    "Website quote request",
    `Submission: ${lead.submissionId}`,
    `Service: ${serviceLabels[lead.service]}`,
    `Source page: ${lead.sourcePage}`,
    `Consent recorded: ${lead.consent.acceptedAt}`
  ].join("\n");
}

export function buildJobNotes(lead) {
  const lines = [
    "WEBSITE LEAD: Raccoon Restoration website form",
    "SALES ACTION: Call the lead immediately to schedule an inspection and prepare an estimate.",
    `Source page: ${lead.sourcePage}`,
    `Submission: ${lead.submissionId}`,
    `Service: ${serviceLabels[lead.service]}`,
    `Property: ${propertyLabels[lead.propertyType]}`,
    `Timing: ${timingLabels[lead.projectTiming]}`,
    `Insurance/claim: ${claimLabels[lead.claimStage]}`,
    `Preferred response: ${lead.contactPreference || "No preference"}`,
    `Submitted: ${lead.submittedAt}`,
    `Consent: Yes (${lead.consent.acceptedAt})`
  ];
  if (lead.campaignSource) lines.push(`Campaign source: ${lead.campaignSource}`);
  if (lead.campaignMedium) lines.push(`Campaign medium: ${lead.campaignMedium}`);
  if (lead.campaignName) lines.push(`Campaign name: ${lead.campaignName}`);
  if (lead.campaignLandingPath) {
    lines.push(`Campaign landing: ${lead.campaignLandingPath}`);
  }
  if (lead.message) lines.push(`Customer details: ${lead.message}`);
  return lines.join("\n").slice(0, 1_000);
}

function priorityFor(lead) {
  if (lead.projectTiming === "urgent") return "Urgent";
  if (
    lead.service === "storm-damage-restoration" ||
    ["storm-no-claim", "claim-opened", "claim-review"].includes(lead.claimStage)
  ) {
    return "High";
  }
  return "Normal";
}

function optionalNumericId(value, field) {
  if (!value) return undefined;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw new IntakeError(`${field} must be a positive integer.`, {
      status: 503,
      code: "integration_not_configured",
      phase: "configuration"
    });
  }
  return number;
}

function integrationConfig(env) {
  const apiKey = text(env.ACCULYNX_API_KEY, 1_000);
  const contactTypeId = text(env.ACCULYNX_CONTACT_TYPE_ID, 80);
  if (!apiKey || !contactTypeId) {
    throw new IntakeError("Lead delivery is not configured.", {
      status: 503,
      code: "integration_not_configured",
      phase: "configuration"
    });
  }
  return {
    apiKey,
    contactTypeId,
    leadSourceId: text(env.ACCULYNX_LEAD_SOURCE_ID, 80),
    jobCategoryId: optionalNumericId(
      env.ACCULYNX_JOB_CATEGORY_ID,
      "ACCULYNX_JOB_CATEGORY_ID"
    ),
    workTypeId: optionalNumericId(
      env.ACCULYNX_WORK_TYPE_ID,
      "ACCULYNX_WORK_TYPE_ID"
    ),
    tradeTypeId: text(env.ACCULYNX_TRADE_TYPE_ID, 80),
    slackWebhookUrl: text(env.SLACK_LEADS_WEBHOOK_URL, 2_000)
  };
}

export class AccuLynxClient {
  constructor({ apiKey, fetchImpl = fetch, timeoutMs = 12_000 } = {}) {
    this.apiKey = apiKey;
    this.fetch = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async request(path, { method = "GET", body, allowNotFound = false } = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let response;
    try {
      response = await this.fetch(`${ACCULYNX_API_ROOT}${path}`, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          ...(body ? { "Content-Type": "application/json" } : {})
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal
      });
    } catch (error) {
      throw new IntakeError("AccuLynx could not be reached.", {
        status: 503,
        code: error?.name === "AbortError" ? "crm_timeout" : "crm_unavailable",
        phase: "acculynx_request"
      });
    } finally {
      clearTimeout(timeout);
    }

    if (allowNotFound && response.status === 404) return null;

    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("json")
      ? await response.json().catch(() => ({}))
      : await response.text().catch(() => "");

    if (!response.ok) {
      const code =
        response.status === 401
          ? "crm_auth_failed"
          : response.status === 429
            ? "crm_rate_limited"
            : response.status >= 500
              ? "crm_unavailable"
              : "crm_rejected";
      const error = new IntakeError("AccuLynx rejected the lead request.", {
        status: response.status === 429 || response.status >= 500 ? 503 : 502,
        code,
        phase: `acculynx_${method.toLowerCase()}_${path.split("?")[0]}`
      });
      error.crmStatus = response.status;
      error.crmTitle = text(payload?.title, 120) || undefined;
      error.crmMessage = crmDiagnosticMessage(payload, body);
      error.crmValidationFields =
        payload?.errors && typeof payload.errors === "object"
          ? Object.keys(payload.errors).slice(0, 20)
          : undefined;
      throw error;
    }
    return payload;
  }

  async findExternalReference(submissionId) {
    const query = new URLSearchParams({
      source: EXTERNAL_SOURCE,
      projectId: submissionId
    });
    return this.request(`/jobs/external-references?${query}`, {
      allowNotFound: true
    });
  }

  async findContacts(lead) {
    const end = new Date(Date.now() + 5 * 60 * 1000);
    const start = new Date("2000-01-01T00:00:00.000Z");
    const payload = await this.request(
      "/contacts/search?pageSize=25&pageStartIndex=0",
      {
        method: "POST",
        body: {
          searchTerm: `${lead.firstName} ${lead.lastName}`,
          startDate: start.toISOString().slice(0, 10),
          endDate: end.toISOString().slice(0, 10),
          sort: {
            sortDirection: "Descending",
            sortColumn: "CreatedDate"
          }
        }
      }
    );
    return getItems(payload);
  }

  createContact(lead, contactTypeId) {
    return this.request("/contacts", {
      method: "POST",
      body: {
        contactTypeIds: [contactTypeId],
        firstName: lead.firstName,
        lastName: lead.lastName,
        crossReference: lead.submissionId,
        note: buildContactNote(lead),
        phoneNumbers: [
          {
            number: lead.phone,
            primary: true,
            hasTextingAvailable: lead.contactPreference === "text",
            type: "Mobile"
          }
        ],
        emailAddresses: [
          {
            address: lead.email,
            primary: true,
            type: "Personal"
          }
        ]
      }
    });
  }

  getContactJobs(contactId) {
    return this.request(`/contacts/${encodeURIComponent(contactId)}/jobs?pageSize=50`);
  }

  createJob(lead, contactId, config) {
    const body = {
      contact: { id: contactId },
      locationAddress: {
        street1: lead.streetAddress,
        city: lead.city,
        state: "IL",
        country: "US",
        zipCode: lead.postalCode
      },
      priority: priorityFor(lead),
      notes: buildJobNotes(lead)
    };
    if (config.leadSourceId) body.leadSource = { id: config.leadSourceId };
    if (config.jobCategoryId) body.jobCategory = { id: config.jobCategoryId };
    if (config.workTypeId) body.workType = { id: config.workTypeId };
    if (config.tradeTypeId) body.tradeTypes = [{ id: config.tradeTypeId }];
    return this.request("/jobs", { method: "POST", body });
  }

  createExternalReference(jobId, submissionId) {
    return this.request("/jobs/external-references", {
      method: "POST",
      body: {
        jobId,
        source: EXTERNAL_SOURCE,
        projectId: submissionId
      }
    });
  }
}

function hashIdentifier(value) {
  return createHash("sha256").update(String(value || "unknown")).digest("hex");
}

function rateLimit(ip, now = Date.now()) {
  const key = hashIdentifier(ip);
  const current = rateBuckets.get(key);
  if (!current || now - current.startedAt >= RATE_LIMIT_WINDOW_MS) {
    rateBuckets.set(key, { startedAt: now, count: 1 });
    return;
  }
  current.count += 1;
  if (current.count > RATE_LIMIT_MAX) {
    throw new IntakeError("Too many requests. Please try again shortly.", {
      status: 429,
      code: "rate_limited",
      phase: "rate_limit"
    });
  }
  if (rateBuckets.size > 5_000) {
    for (const [bucketKey, bucket] of rateBuckets) {
      if (now - bucket.startedAt >= RATE_LIMIT_WINDOW_MS) {
        rateBuckets.delete(bucketKey);
      }
    }
  }
}

function allowedOrigins(env) {
  const origins = new Set(
    text(env.FORM_ALLOWED_ORIGINS, 4_000)
      .split(",")
      .map((origin) => origin.trim().replace(/\/$/, ""))
      .filter(Boolean)
  );
  for (const value of [
    env.SITE_URL,
    env.VERCEL_URL ? `https://${env.VERCEL_URL}` : "",
    env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
      : ""
  ]) {
    if (value) origins.add(String(value).replace(/\/$/, ""));
  }
  origins.add("https://www.raccoonrestoration.com");
  origins.add("https://raccoonrestoration.com");
  return origins;
}

function corsHeaders(origin, env) {
  const headers = {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    Vary: "Origin"
  };
  if (origin && allowedOrigins(env).has(origin.replace(/\/$/, ""))) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function safeLog(logger, level, event) {
  const method = typeof logger?.[level] === "function" ? level : "log";
  logger?.[method]?.(JSON.stringify(event));
}

async function notifySlack(url, lead, jobId, fetchImpl, logger) {
  if (!url) return;
  const textBody = [
    "New website lead accepted in AccuLynx",
    `Job: ${jobId}`,
    `Service: ${serviceLabels[lead.service]}`,
    `Market: ${lead.city}, IL ${lead.postalCode}`,
    `Timing: ${timingLabels[lead.projectTiming]}`,
    `Submission: ${lead.submissionId}`
  ].join("\n");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: textBody }),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Notification returned ${response.status}`);
  } catch {
    safeLog(logger, "warn", {
      event: "lead_notification_failed",
      submissionId: lead.submissionId,
      jobId
    });
  } finally {
    clearTimeout(timeout);
  }
}

function externalJobId(payload) {
  const direct = extractId(payload, ["jobId", "id"]);
  if (direct) return direct;
  for (const item of getItems(payload)) {
    const id = extractId(item, ["jobId", "id"]);
    if (id) return id;
  }
  return "";
}

export async function deliverLeadToAccuLynx(
  lead,
  { env = process.env, fetchImpl = fetch, logger = console } = {}
) {
  const config = integrationConfig(env);
  const client = new AccuLynxClient({
    apiKey: config.apiKey,
    fetchImpl
  });

  let existingReference = null;
  try {
    existingReference = await client.findExternalReference(lead.submissionId);
  } catch (error) {
    if (error?.code !== "crm_rejected") throw error;
    safeLog(logger, "warn", {
      event: "external_reference_lookup_unavailable",
      submissionId: lead.submissionId
    });
  }
  const referencedJobId = externalJobId(existingReference);
  if (referencedJobId) {
    return { jobId: referencedJobId, duplicate: true };
  }

  const contacts = await client.findContacts(lead);
  const retryContact = contacts.find(
    (contact) => contact?.crossReference === lead.submissionId
  );
  const matchedContact = retryContact || contacts.find((contact) => sameContact(contact, lead));

  let contactId = extractId(matchedContact, ["contactId", "id"]);
  if (retryContact && contactId) {
    const jobs = getItems(await client.getContactJobs(contactId));
    const existingJobId = extractId(jobs[0], ["jobId", "id"]);
    if (existingJobId) return { jobId: existingJobId, duplicate: true };
  }

  if (!contactId) {
    const contact = await client.createContact(lead, config.contactTypeId);
    contactId = extractId(contact, ["contactId", "id"]);
    if (!contactId) {
      throw new IntakeError("AccuLynx did not return a contact identifier.", {
        status: 502,
        code: "crm_invalid_response",
        phase: "create_contact"
      });
    }
  }

  const job = await client.createJob(lead, contactId, config);
  const jobId = extractId(job, ["jobId", "id"]);
  if (!jobId) {
    throw new IntakeError("AccuLynx did not return a job identifier.", {
      status: 502,
      code: "crm_invalid_response",
      phase: "create_job"
    });
  }

  try {
    await client.createExternalReference(jobId, lead.submissionId);
  } catch {
    safeLog(logger, "warn", {
      event: "external_reference_create_failed",
      submissionId: lead.submissionId,
      jobId
    });
  }

  await notifySlack(config.slackWebhookUrl, lead, jobId, fetchImpl, logger);
  return { jobId, duplicate: false };
}

function responseJson(body, status, origin, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(origin, env)
  });
}

function requestIp(request) {
  return (
    request.headers.get("x-vercel-forwarded-for") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function createQuoteHandler({
  env = process.env,
  fetchImpl = fetch,
  logger = console,
  now = () => Date.now()
} = {}) {
  return async function handle(request) {
    const origin = request.headers.get("origin") || "";
    const headers = corsHeaders(origin, env);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          ...headers,
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Max-Age": "600"
        }
      });
    }
    if (request.method !== "POST") {
      return responseJson(
        { ok: false, error: "method_not_allowed" },
        405,
        origin,
        env
      );
    }
    if (!origin || !allowedOrigins(env).has(origin.replace(/\/$/, ""))) {
      return responseJson(
        { ok: false, error: "origin_not_allowed" },
        403,
        origin,
        env
      );
    }

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_REQUEST_BYTES) {
      return responseJson(
        { ok: false, error: "request_too_large" },
        413,
        origin,
        env
      );
    }
    if (!(request.headers.get("content-type") || "").includes("application/json")) {
      return responseJson(
        { ok: false, error: "unsupported_media_type" },
        415,
        origin,
        env
      );
    }

    let raw;
    try {
      raw = await request.json();
      if (JSON.stringify(raw).length > MAX_REQUEST_BYTES) {
        throw new IntakeError("The request is too large.", {
          status: 413,
          code: "request_too_large"
        });
      }
      rateLimit(requestIp(request), now());
      const lead = validateLeadPayload(raw, { now: now() });
      if (lead.spam) {
        return responseJson({ ok: true }, 202, origin, env);
      }

      const result = await deliverLeadToAccuLynx(lead, {
        env,
        fetchImpl,
        logger
      });
      safeLog(logger, "info", {
        event: result.duplicate ? "lead_duplicate_confirmed" : "lead_accepted",
        submissionId: lead.submissionId,
        jobId: result.jobId
      });
      return responseJson(
        {
          ok: true,
          submissionId: lead.submissionId,
          jobId: result.jobId,
          duplicate: result.duplicate
        },
        result.duplicate ? 200 : 201,
        origin,
        env
      );
    } catch (error) {
      const known = error instanceof IntakeError;
      safeLog(logger, "error", {
        event: "lead_delivery_failed",
        submissionId: text(raw?.submission_id, 100) || undefined,
        code: known ? error.code : "internal_error",
        phase: known ? error.phase : "unhandled",
        crmStatus: known ? error.crmStatus : undefined,
        crmTitle: known ? error.crmTitle : undefined,
        crmMessage: known ? error.crmMessage : undefined,
        crmValidationFields: known ? error.crmValidationFields : undefined
      });
      return responseJson(
        {
          ok: false,
          error: known ? error.code : "delivery_failed",
          message:
            known && error.status < 500
              ? error.message
              : "We could not confirm delivery. Please call (224) 500-6825."
        },
        known ? error.status : 500,
        origin,
        env
      );
    }
  };
}
