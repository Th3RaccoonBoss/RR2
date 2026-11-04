import assert from "node:assert/strict";
import test from "node:test";
import {
  buildJobNotes,
  createQuoteHandler,
  validateLeadPayload
} from "../src/lead-intake.mjs";

const now = Date.parse("2026-08-03T17:00:00.000Z");
const contactId = "11111111-1111-4111-8111-111111111111";
const jobId = "22222222-2222-4222-8222-222222222222";

function validPayload(overrides = {}) {
  return {
    request_type: "quote_or_inspection",
    form_started_at: String(now - 30_000),
    submission_id: "33333333-3333-4333-8333-333333333333",
    company_website: "",
    street_address: "123 Main Street",
    city: "Barrington",
    postal_code: "60010",
    property_type: "single-family",
    service: "roof-replacement",
    project_timing: "within-30-days",
    claim_stage: "not-claim-related",
    message: "The roof is nearing the end of its service life.",
    first_name: "Alex",
    last_name: "Homeowner",
    phone: "(224) 555-0123",
    email: "alex@example.com",
    contact_preference: "phone",
    consent: "yes",
    source_page: "/contact/",
    submitted_at: new Date(now).toISOString(),
    campaign_source: "google",
    campaign_medium: "paid-search",
    campaign_name: "roof-replacement",
    campaign_landing_path: "/services/roof-replacement/",
    ...overrides
  };
}

function env(overrides = {}) {
  return {
    SITE_URL: "https://www.raccoonrestoration.com",
    FORM_ALLOWED_ORIGINS: "https://www.raccoonrestoration.com",
    ACCULYNX_API_KEY: "test-api-key",
    ACCULYNX_CONTACT_TYPE_ID: "44444444-4444-4444-8444-444444444444",
    ACCULYNX_LEAD_SOURCE_ID: "55555555-5555-4555-8555-555555555555",
    ...overrides
  };
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function request(body, { origin = "https://www.raccoonrestoration.com", ip = "1.2.3.4" } = {}) {
  return new Request("https://www.raccoonrestoration.com/api/quote/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      "X-Forwarded-For": ip
    },
    body: JSON.stringify(body)
  });
}

test("validates and normalizes the website lead contract", () => {
  const lead = validateLeadPayload(validPayload(), { now });
  assert.equal(lead.phone, "2245550123");
  assert.equal(lead.email, "alex@example.com");
  assert.equal(lead.service, "roof-replacement");
  assert.equal(
    lead.campaignLandingPath,
    "/services/roof-replacement/"
  );
  assert.equal(lead.consent.accepted, true);
  assert.match(buildJobNotes(lead), /Submission: 33333333/);
  assert.match(
    buildJobNotes(lead),
    /Campaign landing: \/services\/roof-replacement\//
  );
  assert.ok(buildJobNotes(lead).length <= 1_000);
});

test("rejects unknown fields and impossible form timing", () => {
  assert.throws(
    () => validateLeadPayload(validPayload({ secret_field: "nope" }), { now }),
    /unsupported fields/
  );
  assert.throws(
    () =>
      validateLeadPayload(
        validPayload({ form_started_at: String(now - 100) }),
        { now }
      ),
    /form session/
  );
  assert.throws(
    () =>
      validateLeadPayload(
        validPayload({ campaign_landing_path: "https://malicious.example/" }),
        { now }
      ),
    /campaign_landing_path/
  );
  assert.throws(
    () =>
      validateLeadPayload(
        validPayload({ campaign_landing_path: "//malicious.example/" }),
        { now }
      ),
    /campaign_landing_path/
  );
});

test("silently accepts the honeypot without contacting AccuLynx", async () => {
  let fetchCalls = 0;
  const handler = createQuoteHandler({
    env: env(),
    now: () => now,
    fetchImpl: async () => {
      fetchCalls += 1;
      return json({}, 500);
    },
    logger: { info() {}, warn() {}, error() {} }
  });
  const response = await handler(
    request(validPayload({ company_website: "spam.example" }), {
      ip: "1.2.3.5"
    })
  );
  assert.equal(response.status, 202);
  assert.equal(fetchCalls, 0);
});

test("creates a contact, job, and external reference in AccuLynx", async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(url);
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ path: parsed.pathname, search: parsed.search, method: options.method, body });

    if (
      parsed.pathname.endsWith("/jobs/external-references") &&
      (!options.method || options.method === "GET")
    ) {
      return json({}, 404);
    }
    if (parsed.pathname.endsWith("/contacts/search")) {
      return json({ items: [] });
    }
    if (parsed.pathname.endsWith("/contacts") && options.method === "POST") {
      return json({ id: contactId }, 201);
    }
    if (parsed.pathname.endsWith("/jobs") && options.method === "POST") {
      return json({ id: jobId }, 201);
    }
    if (
      parsed.pathname.endsWith("/jobs/external-references") &&
      options.method === "POST"
    ) {
      return json({ id: "66666666-6666-4666-8666-666666666666" }, 201);
    }
    return json({ error: "unexpected mock request" }, 500);
  };

  const handler = createQuoteHandler({
    env: env(),
    now: () => now,
    fetchImpl,
    logger: { info() {}, warn() {}, error() {} }
  });
  const response = await handler(request(validPayload(), { ip: "1.2.3.6" }));
  const result = await response.json();
  assert.equal(response.status, 201);
  assert.equal(result.ok, true);
  assert.equal(result.jobId, jobId);

  const createContact = calls.find(
    (call) => call.path.endsWith("/contacts") && call.method === "POST"
  );
  const searchContacts = calls.find((call) =>
    call.path.endsWith("/contacts/search")
  );
  assert.equal(searchContacts.body.contactTypes, undefined);
  assert.equal(searchContacts.body.startDate, "2000-01-01");
  assert.match(searchContacts.body.endDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(searchContacts.body.sort.sortDirection, "Descending");
  assert.equal(searchContacts.body.sort.sortColumn, "CreatedDate");
  assert.deepEqual(createContact.body.contactTypeIds, [
    "44444444-4444-4444-8444-444444444444"
  ]);
  assert.equal(createContact.body.crossReference, validPayload().submission_id);
  assert.equal(createContact.body.phoneNumbers[0].number, "2245550123");

  const createJob = calls.find(
    (call) => call.path.endsWith("/jobs") && call.method === "POST"
  );
  assert.deepEqual(createJob.body.contact, { id: contactId });
  assert.deepEqual(createJob.body.leadSource, {
    id: "55555555-5555-4555-8555-555555555555"
  });
  assert.equal(createJob.body.locationAddress.city, "Barrington");
  assert.equal(createJob.body.priority, "Normal");
  assert.match(createJob.body.notes, /Campaign landing: \/services\/roof-replacement\//);
  assert.doesNotMatch(JSON.stringify(result), /alex@example|224555|Main Street/);
});

test("returns the existing AccuLynx job for a repeated submission", async () => {
  let calls = 0;
  const handler = createQuoteHandler({
    env: env(),
    now: () => now,
    fetchImpl: async (url, options = {}) => {
      calls += 1;
      assert.equal(options.method || "GET", "GET");
      assert.match(url, /external-references/);
      return json({ jobId });
    },
    logger: { info() {}, warn() {}, error() {} }
  });
  const response = await handler(
    request(validPayload(), { ip: "1.2.3.7" })
  );
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.duplicate, true);
  assert.equal(result.jobId, jobId);
  assert.equal(calls, 1);
});

test("logs only privacy-safe AccuLynx validation diagnostics", async () => {
  const errors = [];
  const handler = createQuoteHandler({
    env: env(),
    now: () => now,
    fetchImpl: async (url) => {
      if (url.includes("/jobs/external-references")) {
        return json({}, 404);
      }
      return json(
        {
          title: "Validation failed",
          detail:
            "searchTerm Alex Homeowner for alex@example.com and 2245550123 was rejected",
          errors: {
            contactTypes: ["Invalid contact type for Alex Homeowner"]
          }
        },
        400
      );
    },
    logger: {
      info() {},
      warn() {},
      error(message) {
        errors.push(message);
      }
    }
  });
  const response = await handler(
    request(validPayload(), { ip: "1.2.3.9" })
  );
  assert.equal(response.status, 502);
  assert.equal(errors.length, 1);
  const diagnostic = JSON.parse(errors[0]);
  assert.equal(diagnostic.crmStatus, 400);
  assert.equal(diagnostic.crmTitle, "Validation failed");
  assert.equal(
    diagnostic.crmMessage,
    "searchTerm [redacted] for [redacted-email] and [redacted-phone] was rejected"
  );
  assert.deepEqual(diagnostic.crmValidationFields, ["contactTypes"]);
  assert.doesNotMatch(
    errors[0],
    /Alex Homeowner|alex@example|224555|Invalid contact type/
  );
});

test("rejects cross-origin intake before reading customer data", async () => {
  const handler = createQuoteHandler({
    env: env(),
    now: () => now,
    fetchImpl: async () => {
      throw new Error("should not be called");
    },
    logger: { info() {}, warn() {}, error() {} }
  });
  const response = await handler(
    request(validPayload(), {
      origin: "https://malicious.example",
      ip: "1.2.3.8"
    })
  );
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "origin_not_allowed");
});


test("website job note identifies source and requires an immediate inspection call", () => {
  const lead = validateLeadPayload(validPayload({ message: "Details ".repeat(200) }), { now });
  const notes = buildJobNotes(lead);
  assert.ok(notes.startsWith("WEBSITE LEAD: Raccoon Restoration website form\n"));
  assert.match(notes, /SALES ACTION: Call the lead immediately to schedule an inspection and prepare an estimate\./);
  assert.match(notes, /Source page: \/contact\//);
  assert.ok(notes.length <= 1000);
  assert.ok(notes.indexOf("SALES ACTION:") < notes.indexOf("Customer details:"));
});
