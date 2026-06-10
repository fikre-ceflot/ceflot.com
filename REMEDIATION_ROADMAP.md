# Ceflot Enterprise Remediation Cybersecurity & Architecture Roadmap
**Benchmarked Against Procore & Autodesk Construction Cloud (ACC)**

This document defines a strict, phased architectural remediation strategy for the Ceflot enterprise application. It lists the 15 core vulnerabilities identified during the architecture audit, analyzes their structural mechanics, and details the step-by-step remediation roadmap to bring Ceflot to production-grade SaaS security and SOC 2 compliance.

---

## Part 1: Comprehensive Vulnerability Registry & Analysis

### Domain A: Authorization & Edge Security (SOC 2 CC6.1, CC6.2, CC6.3)

#### 1. Unauthenticated Chatbot Gateway & API Abuse
*   **Vulnerability Name**: `/api/chat` Missing Server-Side Session Verification.
*   **Technical Trigger**: Direct, unauthenticated POST calls to `/api/chat` allowing raw payloads with client-claimed roles (e.g. `userRole: "platform_god"`).
*   **Risk Level**: **Critical** (Single Point of Failure).
*   **Technical Impact**: Any external actor could POST arbitrary commands directly to the endpoint. If the Gemini API key or simulator acts on client-claimed variables, unauthorized changes (simulated or real) and database reads could be requested. Furthermore, this serves as an open billing gateway for infinite unauthenticated LLM token synthesis.
*   **Mitigation Strategy (Step 1.1 - 1.3)**: Implement Supabase JWT bearer token verification inside an Express middleware (`requireAuth`). Intercept the `Authorization` header, verify the token signature via Supabase’s authentication server, load the real verified profile parameters directly from the linked `user_profiles` table, and overwrite request-body claimed roles.

#### 2. Client-Privilege Escalation via Permission Strategy
*   **Vulnerability Name**: `permission_strategy` Stored in Mutable Client Storage.
*   **Technical Trigger**: Client-side read of `permission_strategy_${userId}` from `localStorage`.
*   **Risk Level**: **Critical**.
*   **Technical Impact**: A user can open browser DevTools, set the localStorage value to `'user'`, self-grant any custom capabilities locally, and bypass UI-level role checks.
*   **Mitigation Strategy (Step 2.1)**: Migrate permission strategy configurations to a real backend database column under user profile or system configurations. Banish local capability spoofing.

#### 3. Overzealous LocalStorage Cache Purges
*   **Vulnerability Name**: Unsegmented Session Storage Wipes.
*   **Technical Trigger**: Client-side auth error handlers running `localStorage.clear()` or wiping all keys matching `"supabase"`.
*   **Risk Level**: **High**.
*   **Technical Impact**: Client UI states, offline log drafts, localized theme options, and custom UI preferences are wiped out unexpectedly, degrading user experience.
*   **Mitigation Strategy (Step 2.4)**: Namespace and prefix all keys clearly: prefix auth-related credentials with `ceflot_auth_*` and application state keys with `ceflot_app_*`. Keep them isolated.

---

### Domain B: Financial Integrity, Transact-SQL Integrity (SOC 2 PI1.1, CC7.2)

#### 4. Mutable Client Storage as Primary Authority for Approvals
*   **Vulnerability Name**: Approval Signatures & Chains Stored In client-side Cache.
*   **Technical Trigger**: Writing signatures to `localStorage` first, and treating Supabase database sync as "best effort".
*   **Risk Level**: **Critical**.
*   **Technical Impact**: If the network drops or requests timeout, approvals are committed locally anyway. Two supervisors on different devices will view conflicting, un-synchronized, and mutable approval states, failing basic accounting auditability.
*   **Mitigation Strategy (Step 2.2)**: Invert the hierarchy: database is the absolute write path. Block local progression on write failures and show descriptive connectivity states.

#### 5. Non-Atomic Purchase Order Generation
*   **Vulnerability Name**: PO Header and Line-item Orphans.
*   **Technical Trigger**: Sequential async execution of separate writes for PO header and item rows.
*   **Risk Level**: **Critical**.
*   **Technical Impact**: Mid-flight data disconnects leave empty purchase order parent shells with no child lines, corrupting logistics ledgers.
*   **Mitigation Strategy (Step 3.1)**: Enforce a database-level transaction via a multi-record PostgreSQL store function (Supabase RPC wrapping header and lines inside a `BEGIN / COMMIT ... ROLLBACK` block).

#### 6. Payment Certificate Fallback Abuse
*   **Vulnerability Name**: Payment State Bypass.
*   **Technical Trigger**: Silent fallback of financial certificates to local cache when table schemas are absent or DB fails.
*   **Risk Level**: **High**.
*   **Technical Impact**: Large financial obligations can be cleared or approved in isolated device silos with zero enterprise oversight.
*   **Mitigation Strategy (Step 3.2)**: Fail fast and handle errors transparently. Banish localStorage as a sandbox for ledger models.

#### 7. Company Name Branding Export Hard-coding
*   **Vulnerability Name**: Hard-coded Static Header Export Branding.
*   **Technical Trigger**: File `exportUtils.ts` containing the hard-coded string `"SUNSHINE TE. CO. LTD"`.
*   **Risk Level**: **Medium**.
*   **Technical Impact**: Multi-tenant isolation is visually shattered; every business tenant exports documents stamped with another enterprise's corporate identity.
*   **Mitigation Strategy (Step 3.4)**: Pull legal tenant parameters dynamically from the backend settings.

---

### Domain C: Scale Potential & Quadratic Performance (SOC 2 CC7.1)

#### 8. Quadratic Client-Side BOQ Progress Recalculation
*   **Vulnerability Name**: Quadratic O(N²) BOQ Tree Search loop.
*   **Technical Trigger**: Recalculating deep structures by executing linear child lookups on every single node.
*   **Risk Level**: **Critical**.
*   **Technical Impact**: At 500+ items, the browser UI tab halts.
*   **Mitigation Strategy (Step 4.1)**: Build a linear `Map<string, string[]>` child index map on launch, lowering recalculations to O(N).

#### 9. N+1 Write Inefficiencies
*   **Vulnerability Name**: High DB Latency on Recalculations.
*   **Technical Trigger**: Updating N node calculations via parallel `Promise.all` requests.
*   **Risk Level**: **Critical**.
*   **Technical Impact**: 500 parallel queries exhaust database network connection pools and trigger rate limits.
*   **Mitigation Strategy (Step 4.2)**: Implement a SQL multi-row bulk update RPC using `unnest($1::jsonb[])` to execute recalculation writes in one database trip.

#### 10. Client-Side Subcontractor Cross-join Analysis
*   **Vulnerability Name**: Browser-based cross-join computation.
*   **Technical Trigger**: Downloading multiple unstructured tables and matching rows in React state.
*   **Risk Level**: **Critical**.
*   **Technical Impact**: Unbounded payload overhead causing browser crashes at higher volume.
*   **Mitigation Strategy (Step 4.3)**: Implement Postgres Views or RPC queries that perform the joins server-side and server-paginate flat result sheets.

---

### Domain D: Edge Ingress Hardening & Compliance (SOC 2 A1.1)

#### 11. Security Header Ingress Deficiencies
*   **Vulnerability Name**: Missing CSP and Security Standard Ingress Parameters.
*   **Technical Trigger**: Direct Express execution lacking basic security header profiles.
*   **Risk Level**: **High**.
*   **Technical Impact**: Vulnerability to click-jacking, CSRF, and exfiltration vectors.
*   **Mitigation Strategy (Step 1.2)**: Configure Helmet middleware with customized policies permitting sandboxed iframe execution as required by AI Studio.

#### 12. Rate Limiting Laxity
*   **Vulnerability Name**: Denial of Service (DoS) vulnerability on API.
*   **Technical Trigger**: Absence of query thresholds on endpoints.
*   **Risk Level**: **High**.
*   **Technical Impact**: Gemini API billing overrun or service outages.
*   **Mitigation Strategy (Step 1.2)**: Apply `express-rate-limit` allowing maximum 30 operations per minute.

#### 13. Open Cross-Origin Access Policies
*   **Vulnerability Name**: Missing CORS restraints.
*   **Technical Trigger**: Permissive wildcard policy headers.
*   **Risk Level**: **High**.
*   **Technical Impact**: Cross-origin scripts stealing local authorization parameters.
*   **Mitigation Strategy (Step 1.2)**: Restrict origin resolution strictly to the configured `APP_URL`.

#### 14. Brittle Validation and Import Coercion
*   **Vulnerability Name**: Lax Number Parsing.
*   **Technical Trigger**: Coercing strings using `parseFloat` directly.
*   **Risk Level**: **High**.
*   **Technical Impact**: Localized number standards (e.g. standard English comma separators like `"1,500.00"`) corrupt into `"1"`, destroying BOQ correctness.
*   **Mitigation Strategy**: Implement structured numeric sanitizers stripping standard separators before validation.

#### 15. Stale Storage Manifest Declarations
*   **Vulnerability Name**: Missing offline synchronizers.
*   **Technical Trigger**: Setting `standalone` options in manifest with no Service Workers or Structured IndexedDB.
*   **Risk Level**: **High**.
*   **Technical Impact**: Disconnects cause silent, unnotified field data loss.
*   **Mitigation Strategy**: Integrate custom Service Worker sync workflows.

---

## Part 2: Phased Implementation Roadmap

```
+--------------------------------------------------------------------------+
|  PHASE 1: AUTHENTICATION, INGRESS POLICIES & EDGE SECURITY               |
|  * Step 1.1: Server-Side JWT Verification & Extracting Claims (COMPLETED) |
|  * Step 1.2: Server-Side Hardening: Helmet, CORS, Rate Limit (COMPLETED)  |
|  * Step 1.3: Safe Client JWT Transmission (COMPLETED)                    |
+--------------------------------------------------------------------------+
                                     |
                                     v
+--------------------------------------------------------------------------+
|  PHASE 2: CLIENT-SIDE STORAGE AND STATE SANITIZATION (COMPLETED)          |
|  * Step 2.1: Structural User Settings & Permission Strategy DB Mode      |
|  * Step 2.2: Hardened DB-first approvals & removal of LocalStorage write |
|  * Step 2.3: Removal of client-side local fallback on Payment Certs      |
|  * Step 2.4: Unified client state and token store namespacing           |
+--------------------------------------------------------------------------+
                                     |
                                     v
+--------------------------------------------------------------------------+
|  PHASE 3: TRANSACTIONAL AND SAFETY ASSURANCES (COMPLETED)               |
|  * Step 3.1: Transactional RPC for atomic Purchase Order creation        |
|  * Step 3.2: Database Optimistic Concurrency and version triggers        |
|  * Step 3.3: Server-side managed Audit Logs using Postgres triggers      |
|  * Step 3.4: Dynamic export configuration (replaces hard-coded Sunshine)|
+--------------------------------------------------------------------------+
                                     |
                                     v
+--------------------------------------------------------------------------+
|  PHASE 4: EXTREME PERFORMANCE SCALING (COMPLETED)                        |
| * Step 4.1: Fast, Linear O(N) parent-child relational maps in React     |
| * Step 4.2: SQL bulk update RPC recalculation for BOQ Trees              |
| * Step 4.3: Flat Postgres Subcontractor Views & pre-aggregated logic    |
+--------------------------------------------------------------------------+
```

---

## Part 3: Phase 1 Deep-Dive (Steps 1.1, 1.2, 1.3)

### Verification Checklist & Integrity Analysis

#### 1. Security Ingress Hardening Verification
*   **Helmet Headers**: Active. Frame protection relaxed dynamically for development preview contexts, while blocking cross-site injection vectors.
*   **CORS Management**: Restricted with reflection capabilities. No untrusted third-party origins can call `/api/chat` directly from their domains.
*   **Rate Limits**: Configured. Maximum 30 queries per minute per origin prevents resource drainage on Gemini.

#### 2. Fully Decoupled Token Processing & Authorization flow
*   The API layer reads and verifies identity token parameters instead of trusting body parameters.
*   The server extracts the core subject identity, parses their verified role fields, and queries state values securely from the Supabase tables.

*Roadmap generated & committed on June 10, 2026.*
