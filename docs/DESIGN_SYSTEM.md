# easyACR design system

## Source and precedence

`eacrds.zip` was inspected before implementation. It contains the supplied easyACR logo, token-manager screenshots, palette presentations, and button/link examples. Archive content was treated only as visual reference. When the presentation palette conflicts with the named token-manager collections, the token-manager Brand/Alias/Mapped/Responsive values take precedence because they expose explicit variable names and references.

The supplied horizontal `easyacrlogo.svg` and `easyacrlogo-reversed.svg` lockups are reused directly in the app and embedded into the generated SVG catalog. The normal black lockup is used on light surfaces; the reversed white lockup is used on dark surfaces. The application sidebar centers the 140 × 60px lockup to match the approved desktop composition, while public and mobile headers use smaller proportional instances.

## Token architecture

1. **Brand:** raw palettes (blue, pink, yellow, green, purple, red, grey) and the source spacing scale.
2. **Alias:** primary light/medium/dark, fresh/vibrant accents, neutral, success, warning, error, border widths/radii, and shadow geometry.
3. **Mapped:** light/dark semantic roles for text, icon, surface, border, action, hover, disabled, focus, status, and gradients.
4. **Responsive:** desktop/mobile device width, h1–h6, paragraph/caption sizes and line heights, and base spacing aliases.

All implemented raw values are at the top of `src/styles.css`. Representative exact values include:

| Token | Value |
|---|---|
| `brand.pink.default` | `#42213D` |
| `brand.blue.default` | `#07004D` |
| `brand.green.default` | `#376A41` |
| `brand.purple.default` | `#331832` |
| `brand.grey.25 / 900` | `#F9F9F9 / #1A1A1A` |
| `alias.borderRadius xs/sm/md/lg/xl/full` | `4/8/12/16/20/120px` |
| `responsive.device desktop/mobile` | `1440/390px` |
| `responsive.h1 desktop/mobile` | `48/56px line / 32/40px line` |
| `responsive.paragraph` | `16/24px` |
| `responsive.paragraphSm` | `14/20px` |

## Interaction states

Buttons and links include default, hover, visible focus, active-compatible native activation, and disabled states in both themes. Focus uses a three-pixel `#42213D` control ring with a three-pixel offset; high-contrast mode preserves system outlines. Status and severity always include visible text and an icon.

## Responsive behavior

- Desktop app uses a 248px persistent sidebar; mobile uses a controlled drawer.
- Four-column metrics collapse to two and then one column.
- Wide tables become labeled cards below 640px and do not require horizontal reading.
- Wizard steps and tabs use controlled horizontal overflow only within their local navigation, while primary tasks stay available.
- Modal width and height are viewport constrained.
- 320 CSS pixel reflow, browser zoom, enlarged text, reduced motion, forced colors, and theme preference are considered in CSS.

## Typography

Archive typography names Satoshi for headings and DM Sans for body copy. The CSS requests those families and uses robust system fallbacks. Font files were not included in the source archive and are not fetched from a third party in this offline prototype.
