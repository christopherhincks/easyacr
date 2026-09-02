# Role/entitlement matrix and component inventory

## Central entitlement matrix

`src/domain.ts` is the single prototype policy source. The server must enforce the same decisions independently; hiding a route or disabling a control is not authorization.

| Capability | Visitor | Registered, no plan | Trial | Paid | Paid organization admin |
|---|---:|---:|---:|---:|---:|
| Public pages | Yes | Yes | Yes | Yes | Yes |
| Authenticated shell | No | Yes | Yes | Yes | Yes |
| Start scan | No | No | Yes, 25 pages | Yes, 500 pages | Yes, 2,500 pages |
| Schedules | No | No | No | Yes | Yes |
| Draft ACR | No | No | Yes | Yes | Yes |
| WebMCP | No | No | Configurable; off in prototype | Yes | Yes, can manage access |
| Billing options | No | Yes | Yes | Yes | Yes |
| Organization users/roles | No | No | No | No | Yes |

## Component inventory

- Public header, responsive navigation, footer, skip link, supplied logo, theme control.
- Application sidebar, mobile drawer, top bar, demo-role control, account avatar.
- Button variants: primary, secondary, ghost, danger, small, disabled; visible focus and non-hover activation.
- Links: navigation, inline, button-link, external-source, disabled state where appropriate.
- Status badge with icon and text; severity label with icon and text.
- Card, flat card, metric card, feature card, pricing card, deadline card, issue card, locked-content gate.
- Native text, URL, email, password, numeric, checkbox, radio, select, textarea, fieldset, legend, hint, inline error, error summary.
- Wizard steps, tabs, progress bar with equivalent text, bar chart with equivalent data table.
- Responsive table that becomes labeled cards below 640 CSS pixels.
- Dialog with Escape/backdrop dismissal and initial programmatic focus; status toast with dismiss control.
- Callout variants: information, success, warning, error.
- Empty/restricted content panels and system error/not-found/access-denied experiences.

## Representative domain interfaces

- `Role`, `Entitlements`, `ScanStatus`, `Severity`, and `EvidenceKind` are typed in `src/domain.ts`.
- Scan objects include ID, organization target, lifecycle state, page/finding counts, severity count, start time, duration, trend, and progress.
- Issue objects include severity, criterion, page, element, sanitized excerpt, plain-language explanation, remediation, and detection method.
- ACR objects include template edition, document version, update time, unresolved review count, and draft/review status.
- Service adapters expose name, mock mode, and boundary; production implementations must preserve these interfaces and add authenticated organization context.
