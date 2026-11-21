# MYRYRA MVP2 — Privacy & consent implementation contract (P0)

Status: design specification only. No production deployment or legal approval implied.

## Legal architecture
- **Terms of Use**: record affirmative contractual acceptance, separately from consent; Terms are not a blanket LGPD consent.
- **Privacy Notice**: display with version and effective date, with an acknowledgment of access; do not characterize every processing activity as consent-based.
- **Optional consent**: independent, unchecked-by-default purposes for non-essential analytics, optional AI personalization and marketing; explain purpose, categories, recipients, retention and withdrawal effects in plain pt-BR.
- **Essential processing**: identify and document appropriate legal basis per operation (contract, legal obligation, legitimate interest when justified, or consent). Do not require optional consent to use the core product.
- **Contextual permissions**: Google Calendar OAuth scopes, location for Concierge, financial data used by MIKA, notifications, and any sensitive data require just-in-time disclosures, data minimization and legal review. Browser/OS permissions do not replace LGPD transparency.
- **Cookies**: separate essential cookies from non-essential trackers; reject/accept/configure with equivalent ease and persist preferences. Do not load optional trackers before valid choice.
- **Rights**: self-service view/change/withdraw optional consents, request access/correction/export/deletion, explain lawful retention exceptions, and provide privacy contact and response tracking.
- **Minors**: confirm product age policy and legal requirements before implementation; avoid assuming a single consent rule applies to all ages.
- **AI**: distinguish data processing needed to answer a user prompt from optional cross-feature personalization and any model-training use. No model training on user content by default unless separately justified and disclosed.

## UX
1. Registration screen links to current Terms and Privacy Notice. Require an explicit, non-prechecked Terms acceptance; show optional consents independently, default off. Never block registration for refusal of optional choices.
2. For Google login, do not treat OAuth authorization as Terms acceptance. On first login route to the same onboarding gate before access to authenticated application features.
3. Settings > Privacidade e dados: cards for optional consents, linked legal documents, integration authorizations, export/delete requests, history and contact.
4. On material document changes, present versioned notice and re-accept only when legally/contractually necessary; retain prior evidence.

## Data design (proposed, NOT migrated)
- `privacy_document_versions`: id, document_type, version, effective_at, published_at, content_hash, public_url, status; immutable published versions.
- `user_legal_acceptances`: id, user_id, document_version_id, action ('accepted'|'acknowledged'), occurred_at, evidence_source, ui_locale, request_id; append-only.
- `privacy_purposes`: purpose_key, purpose_version, display_name, description, legal_basis, required, active.
- `user_privacy_choices`: id, user_id, purpose_key, purpose_version, granted, occurred_at, source, notice_version_id, request_id; append-only events (withdrawal creates a new event).
- `privacy_rights_requests`: id, user_id, request_type, status, created_at, closed_at, resolution_note; protect confidential details.
- Keep user identifiers and timestamps server-generated; deduplicate request_id for retry safety; enforce owner RLS for reads, service-only writes for audit records, no client UPDATE/DELETE on evidence. Restrict internal service access. Limit access to IP/UA evidence and retention by necessity; avoid collecting IP if not needed.
- Define retention schedule, subprocessors, international transfers, security controls and incident-response process before release.

## Server API acceptance criteria
- Verify authenticated Supabase identity server-side; reject forged user_id and client timestamps.
- Resolve only currently published document/purpose versions on server.
- Commit document acceptance and optional choice events atomically where appropriate; return idempotent result on retry.
- Server authorization gate for Terms acceptance; privacy notice acknowledgment should not become an unlawful forced consent.
- Deny optional analytics/marketing/personalization until explicitly granted; enforce withdrawal on subsequent processing and downstream processors.
- RLS and privileges: no anonymous access to user records; each user sees only own choices; append-only evidence through trusted service/RPC, no direct client mutation.
- Export and deletion workflows need verified identity, confirmation, audit trail, retention exceptions and asynchronous status.

## Tests (P0)
- Password and Google OAuth first login: gate shown exactly when needed.
- Terms unchecked blocks continuation; optional consents unchecked do not.
- Independent choices, rejections, withdrawals and version updates persist across sessions/devices.
- RLS cross-user reads/writes denied; unauthenticated writes denied; spoofed user_id and timestamp ignored.
- Retry/replay produces no duplicate acceptance; race conditions do not bypass gate.
- Optional trackers are not loaded before opt-in; withdrawal stops new processing.
- Document history remains immutable; rights request visible only to owner and authorized privacy team.
- Mobile viewport and accessibility labels/keyboard navigation.
- No production rollout until legal review, staging tests, SSO-authenticated E2E and explicit approval.

## Legal review checklist
Brazil LGPD (Lei 13.709/2018), ANPD guidance, Marco Civil and consumer rules as applicable. Validate actual controller identity, DPO/privacy contact, data map, processors (Supabase, OpenAI, Google, Vercel etc.), cross-border transfers, data subject rights, cancellation/billing terms and applicable age restrictions. Legal counsel must approve published wording.
