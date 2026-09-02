# Accessibility validation report

**Target:** WCAG 2.2 Level AA, with relevant Revised Section 508 and EN 301 549 interface considerations. This report does not claim full conformance.

## Implemented safeguards

- Semantic header/nav/main/footer/section/article/table/form structures and native controls.
- One visible-on-focus skip link for repeated navigation.
- Logical headings, visible labels, fieldsets/legends, hints, inline errors, and alert-style error summary.
- Keyboard-operable navigation, menus, tabs, dialogs, forms, disclosure widgets, pause/resume, and all primary actions.
- Three-pixel focus indicator; no essential hover-only behavior.
- Status/severity include icon and visible text. Progress includes accessible text and live status copy.
- Chart has an accessible text name and equivalent disclosure table.
- Issue details include plain-language explanation, criterion, page, element, evidence, and remediation.
- Desktop tables convert to labeled mobile cards. Layout supports 320px without page-level horizontal scrolling.
- Light/dark semantic mappings, forced-color handling, text enlargement/zoom-friendly relative units, and reduced-motion override.
- Dialog is labeled, modal, Escape-dismissable, backdrop-dismissable, and receives focus. A production dialog should add a full focus trap and focus restoration utility.

## Automated checks

`tests/accessibility.spec.ts` runs axe-core against public, authenticated, report, wizard, ACR, WebMCP, and mobile/dark examples. `tests/routes.spec.ts` checks primary routes and horizontal overflow at desktop and 390px. Results are recorded below after execution.

## Manual keyboard checklist

1. Tab from browser chrome; skip link becomes visible and moves to main.
2. Traverse public navigation and theme control; activate with Enter/Space as native semantics permit.
3. On mobile, open/close both menus and reach every link.
4. Complete new-scan steps, correct URL error, choose protected access, and reach review without pointer input.
5. Change report tabs, open data-table disclosure, search/filter, and reach pagination.
6. Open cancel dialog, dismiss with Escape, reopen, and reach both actions.
7. Navigate ACR criteria fields and explicit review gate.
8. Copy WebMCP example and hear the status message.
9. At 200% zoom and 320 CSS px, verify no content/action loss and table labels remain associated visually.

## Known gaps and non-claims

- Automated clean results cannot establish complete accessibility conformance.
- Screen-reader testing across NVDA/JAWS/VoiceOver and multiple browser combinations remains required.
- Focus trapping/restoration for production dialogs needs a hardened primitive.
- Complex ACR tables require further usability studies with screen-reader users.
- Satoshi/DM Sans binaries were not supplied, so system fallbacks may change text metrics.
- Legal applicability of Section 508, EN 301 549, and the EAA must be evaluated per customer/product; this interface is not legal advice.

## Verification results

See `docs/VERIFICATION_RESULTS.md`, generated/updated during the final verification pass.
