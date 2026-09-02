# Product, scope, assumptions, and unresolved decisions

## Product summary

easyACR supports software companies preparing accessibility evidence for US government and EU procurement. The product connects site scanning, issue investigation, schedule management, and current VPAT-based draft ACR work. It separates automatic findings from manual evaluation and never presents a scan as certification.

## In-scope prototype

- Responsive public marketing and account-entry experience.
- Role-aware authenticated application with centralized entitlements.
- Scan configuration for public or protected sites, including URL, scope, pattern, limit, schedule, review, and lifecycle states.
- Executive report, detailed issue exploration, sanitized excerpts, search/filter/sort/group/export affordances, and mobile card tables.
- Scan history, rerun/duplicate affordances, cancel confirmation, and schedule pause/resume.
- Draft ACR library, setup flow, evidence mapping, allowed VPAT terminology, remarks, manual-review queue, versions, and export gate.
- Experimental WebMCP tool catalog, connection state, authorization, activity, revocation, and safe mock mode.
- Account, subscription, billing, customer-organization administration, and system states.

## Assumptions

1. Draft pricing is $79 Starter, $199 Team, and $499 Organization per month. Amounts, names, quotas, tax treatment, annual terms, and overages are product assumptions in one data structure.
2. Trial configuration is 14 days, 25 pages per scan, draft-ACR access, no schedules, and no WebMCP unless a future entitlement enables it.
3. “Paid administrator” means the customer organization’s administrator, never an easyACR platform operator.
4. The token-manager screenshots in `eacrds.zip` are authoritative where the later presentation palette conflicts with them. The former explicitly expose Brand, Alias, Mapped, and Responsive collection values.
5. The specified Satoshi and DM Sans families are expressed in the font stack; font binaries were not present in the archive and are not fetched at runtime. System fallbacks preserve local, credential-free operation.
6. Current report template is ITI VPAT 2.5Rev (April 2025). “Needs review” is an easyACR workflow state—not a fifth VPAT conformance level.
7. Deadline cards are informational and market-filtered. Applicability remains a legal/product decision.

## Unresolved product decisions

- Exact pricing, overage, seat, retention, support, and trial rules.
- Supported protected-site login recipes and the policy for saved scheduled-scan credentials.
- Scanner depth, JavaScript execution, rate controls, evidence retention, and permitted customer targets.
- ACR export formats, review-signature policy, approval roles, version retention, and template licensing/mark usage.
- WebMCP browser support, stable API surface, consent UX, client allowlist, invocation confirmation, and production SDK choice.
- Regional data residency, subprocessors, deletion windows, SSO/SCIM, audit retention, and contractual security commitments.

## Current authoritative references (verified September 1, 2026)

- [ITI VPAT 2.5Rev and four editions](https://www.itic.org/policy/accessibility/vpat)
- [W3C WCAG 2.2 Recommendation](https://www.w3.org/TR/WCAG22/)
- [US Access Board ICT / Revised Section 508](https://www.access-board.gov/ict/about/)
- [ETSI EN 301 549 V3.2.1](https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_20/en_301549v030201a.pdf)
- [US DOJ Title II web rule and updated compliance dates](https://www.ada.gov/title-ii-web-rule/)
- [European Commission: European Accessibility Act](https://commission.europa.eu/strategy-and-policy/policies/justice-and-fundamental-rights/disability/european-accessibility-act-eaa_en)
- [WebMCP Draft Community Group Report](https://webmachinelearning.github.io/webmcp/)
