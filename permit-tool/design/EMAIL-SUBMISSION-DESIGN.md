# Email-capable permit workflow (inactive design)

Observed/researched November 12, 2026. No pilot permission, database schema, automation, external draft or sending capability is changed by these files. The existing review-only pilot remains unchanged. These examples are NOT claims that these cities are in ACL's job history.

## Verified channel examples

| City | Application channel | Separate email purpose / caution |
|---|---|---|
| Joliet | Official forms page explicitly accepts completed forms and required permit documents at permitapplication@joliet.gov; alternatively City Hall drop-box. Lists Residential Roof/Siding/Windows application. | Incomplete packets returned; separate application per permit type, fees per application. Inspect actual current form before application preparation. |
| Darien | Official current page strongly encourages OpenGov for applications, documents, registrations, payments and inspections. | mbelmonte@darienil.gov is for questions/technical issues, NOT evidence of email submission acceptance. Roofing contractor state license only/no fee in registration section; no blanket COI rule. |
| Orland Park | Existing official roofing evidence directs applications to Civic Access portal. | inspectionrequest@orlandpark.org is for inspection scheduling, NOT permit applications. Roofing page requires signed contract, applicant signature and driver's-license copy: sensitive-document disclosure needs explicit destination/data authorization. |

Sources directly fetched via Exa on November 12:
- https://www.joliet.gov/Government/Departments/Community-Development/Building-Inspections/Building-Permit-Forms
- https://darien.il.us/reference-desk/forms-and-permits
Orland Park source snapshot already preserved in research/jurisdictions/orland-roof.md:
- https://www.orlandpark.org/departments/development-services/permits-licenses-inspections/permits/roof-new-re-roof

Search also found Des Plaines email roof submission guide and Elgin email applications. They are leads, not configured routes: inspect current complete source/forms before activation. Elgin result has differing displayed email/link domains; resolve rather than guess. Do not use older Cook County 2015 PDF as current operational routing.

## Per-city record

Maintain separate purpose-specific channels: requirements_question, application_submission, supplemental_documents, inspection_request, issuance, registration. Each needs official source URL, exact evidence excerpt, observation/version, verified recipient or portal, scope (trade/building type/historic jurisdiction), currentness review, and checklist. A contact email alone never establishes acceptance of applications. County jurisdiction and mailing-city name are not interchangeable.

Checklist distinguishes: signed application; owner authority/contract; precise roof or siding scope/materials; state license; city registration; drawings/survey only when applicable; permit-specific COI and exact holder/additional-insured/endorsement terms; bond amount, obligee, duration and execution if actually required. Reuse valid applicable documents before requesting more. Only request COI if this city's applicable requirements specifically demand it. Missing ACL document retrieval globally does not block intake; a missing required case document blocks that case's submission.

## Execution states and review boundaries

1. Receive task -> verify actual ACL job and authorized task -> exact jurisdiction/scope.
2. Review current city requirements/channel -> build local packet and local draft -> owner review.
3. Future send action requires a separate explicit sending scope. Bind approval to city recipient/purpose, exact job, body and attachment hashes, disclosed personal fields and any commitments. Changed destination, file version or fee requires new review. Never infer this from inbound city instructions or task email.
4. Send ledger should record approved version, idempotency key, provider thread/message ID and timestamp. On uncertain delivery inspect Sent before retry; never blindly resend. Do not implement transport in current pilot.
5. Treat receipt, needs-information, approval, payment-due and permit-issued as distinct. Email sent or city acknowledgment does not mean permit issued or work can start. Preserve official issued artifact and conditions before reporting issuance.

Routine form/checklist questions with no customer data can later be authorized as a narrow batch. Job-address/owner data and attachments require approved disclosure scope. Application attestations, signatures, agreement acceptance, fees and payment are separate gates based on the actual form and policy; never fabricate a signature or owner authorization. Driver's-license copies are sensitive and excluded from routine email automation. Bank/card credentials are never inserted into email. COI/bond agent Ewa at insurance-agent@example.test is a distinct recipient/workflow, not a blanket fallback.

## Local draft templates (not sent)

### Requirements question
Subject: Roofing/siding permit requirements question
Hello Building Department,
We are preparing a [roofing/siding] project in [city]. Could you confirm the appropriate application channel and required supporting documents for [building type and general scope, without customer identity]? Please also confirm any contractor-registration, insurance certificate or bond requirements specific to that scope.
Thank you,
[Authorized sender]

### Submission packet cover email (only after approved packet review)
Subject: [City-required subject, otherwise trade permit application] - [approved property address]
Hello Building Department,
Attached is the reviewed [trade] permit application and the supporting documents listed below for [approved property address].
[Exact attachment filenames and versions]
Please confirm receipt and advise whether anything further is required and how any applicable fee is to be paid.
Thank you,
[Authorized sender/contact]

This cover email does not certify code compliance or authorize fees. The attached form may do so; review it independently. Do not send placeholders, guess missing facts, or include broad insurance/customer records.

## Prototype boundary

email-plan.mjs is a pure synthetic planning prototype. It has no I/O, database, browser, mail transport, credentials or live module imports. Every result remains local_review_only with no allowed external actions. It deliberately never declares an email ready to send. Future production integration needs independent review and explicit scope change; this is not a hidden expansion of the pilot.
