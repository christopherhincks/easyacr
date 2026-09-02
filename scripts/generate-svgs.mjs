import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve('design/screens');
fs.mkdirSync(out, { recursive: true });
function logoSymbol(file, id) {
  return fs.readFileSync(path.resolve(file), 'utf8')
    .replace(/^<\?xml[^>]+>\s*/, '')
    .replace(/<svg[^>]*>/, `<symbol id="${id}" viewBox="0 0 944 404">`)
    .replace('</svg>', '</symbol>');
}

const logo = [
  logoSymbol('easyacrlogo.svg', 'easyacr-logo-normal'),
  logoSymbol('easyacrlogo-reversed.svg', 'easyacr-logo-reversed'),
].join('');

const screens = [
  ['home-desktop-light','/','desktop','light','Visitor','Marketing home','Scan evidence, organized'],
  ['features-desktop-dark','/features','desktop','dark','Visitor','Product capabilities','Scan · Review · Draft · Connect'],
  ['pricing-mobile-light','/pricing','mobile','light','Visitor','Draft pricing','Starter · Team · Organization'],
  ['about-desktop-light','/about','desktop','light','Visitor','About easyACR','Evidence, not certification'],
  ['sign-up-mobile-dark','/sign-up','mobile','dark','Visitor','Create your account','14-day prototype trial'],
  ['sign-in-desktop-light','/sign-in','desktop','light','Visitor','Welcome back','Continue the accessibility work'],
  ['password-recovery-mobile-light','/password-recovery','mobile','light','Visitor','Recover your account','Time-limited recovery link'],
  ['checkout-result-desktop-dark','/checkout/success','desktop','dark','Registered','Trial ready','No payment processed'],
  ['onboarding-mobile-light','/onboarding','mobile','light','Registered','Workspace setup','Context · Team · Ready'],
  ['dashboard-desktop-light','/dashboard','desktop','light','Paid','Good afternoon, Avery','313 pages · 95 violations · scan running'],
  ['dashboard-mobile-dark','/dashboard','mobile','dark','Trial','Trial overview','3 days · 9 pages remain'],
  ['new-scan-desktop-light','/scans/new','desktop','light','Paid','Configure a site scan','Target · Access · Scope · Review'],
  ['scan-history-mobile-light','/scans','mobile','light','Paid','Scan history','Running · Completed · Partial · Failed'],
  ['scan-report-desktop-dark','/scans/SCN-1047','desktop','dark','Paid','app.northstar.example','64% · 31 findings · 18 manual reviews'],
  ['schedules-desktop-light','/schedules','desktop','light','Paid','Scan schedules','Next runs shown in CDT'],
  ['acr-library-mobile-dark','/acrs','mobile','dark','Trial','Draft ACR library','Versions and unresolved review'],
  ['acr-wizard-desktop-light','/acrs/new','desktop','light','Paid','Create from scan evidence','VPAT 2.5Rev · 508 / EU / INT / WCAG'],
  ['acr-editor-desktop-dark','/acrs/northstar-federal','desktop','dark','Paid','Northstar Platform — Federal','Draft v0.7 · human review required'],
  ['webmcp-mobile-light','/tools','mobile','light','Paid','Tools · WebMCP','Experimental mock adapter'],
  ['account-desktop-light','/account','desktop','light','Paid','Account and profile','Timezone · market · notifications'],
  ['billing-desktop-dark','/billing','desktop','dark','Admin','Subscription and billing','Draft plan assumptions'],
  ['organization-mobile-light','/organization','mobile','light','Admin','Organization administration','Users · roles · WebMCP access'],
  ['access-denied-desktop-dark','/access-denied','desktop','dark','Restricted','Access denied','Server-enforced permission state'],
  ['not-found-mobile-light','/missing','mobile','light','Any','Page not found','Return to dashboard'],
  ['general-error-desktop-light','/error','desktop','light','Any','Something went wrong','Recoverable error EACR-520'],
];

const esc = (value) => value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');

function desktopBody(title, detail, isReport) {
  const cards = isReport ? ['Pages scanned 78','Violations 31','Severe issues 9','Needs review 18'] : ['Primary action','Current status','Evidence summary','Next step'];
  return `
    <g id="content" transform="translate(292 104)">
      <text class="eyebrow" x="0" y="18">WORKSPACE · REPRESENTATIVE STATE</text>
      <text class="h1" x="0" y="78">${esc(title)}</text>
      <text class="body muted" x="0" y="114">${esc(detail)}</text>
      <g id="primary-action" transform="translate(940 28)"><rect class="action" width="156" height="46" rx="8"/><text class="buttonText" x="78" y="29" text-anchor="middle">Primary action</text></g>
      ${cards.map((label, i) => `<g id="metric-${i+1}" transform="translate(${(i%4)*274} 158)"><rect class="card" width="252" height="126" rx="12"/><text class="label" x="18" y="34">${esc(label.split(' ').slice(0,-1).join(' ') || label)}</text><text class="metric" x="18" y="88">${esc(label.split(' ').at(-1))}</text></g>`).join('')}
      <g id="main-panel" transform="translate(0 316)"><rect class="card" width="720" height="480" rx="12"/><text class="h2" x="24" y="48">${isReport ? 'Issue evidence' : 'Workspace detail'}</text>${[0,1,2,3].map((i)=>`<g transform="translate(24 ${84+i*86})"><rect class="row" width="672" height="68" rx="8"/><circle class="status${i}" cx="24" cy="22" r="8"/><text class="label" x="44" y="27">${['Clear labels and evidence','Automatic or manual method','WCAG criterion and page','Suggested remediation'][i]}</text><text class="small muted" x="44" y="50">Representative, fictional product data</text></g>`).join('')}</g>
      <g id="side-panel" transform="translate(744 316)"><rect class="card" width="352" height="480" rx="12"/><text class="h2" x="24" y="48">What happens next</text><text class="body" x="24" y="92">Automatic findings inform</text><text class="body" x="24" y="118">the evaluation. A person</text><text class="body" x="24" y="144">must complete the review.</text><rect class="warning" x="24" y="188" width="304" height="132" rx="8"/><text class="label" x="44" y="224">Needs review</text><text class="small" x="44" y="252">Missing evidence is never</text><text class="small" x="44" y="274">turned into a passing result.</text></g>
    </g>`;
}

function mobileBody(title, detail) {
  return `<g id="mobile-content" transform="translate(16 92)"><text class="eyebrow" x="0" y="16">REPRESENTATIVE STATE</text><text class="h1 mobile" x="0" y="58">${esc(title)}</text><text class="body muted" x="0" y="90">${esc(detail)}</text><g transform="translate(0 122)"><rect class="action" width="358" height="48" rx="8"/><text class="buttonText" x="179" y="30" text-anchor="middle">Primary action</text></g>${['Current status','Evidence summary','Needs review','Next step'].map((label,i)=>`<g id="mobile-card-${i+1}" transform="translate(0 ${194+i*132})"><rect class="card" width="358" height="112" rx="12"/><circle class="status${i}" cx="24" cy="30" r="8"/><text class="label" x="44" y="35">${label}</text><text class="small muted" x="20" y="70">Clearly labeled detail with no color-only meaning.</text><text class="small muted" x="20" y="92">Human review remains required.</text></g>`).join('')}</g>`;
}

for (const [name, route, viewport, theme, role, title, detail] of screens) {
  const mobile = viewport === 'mobile';
  const width = mobile ? 390 : 1440;
  const height = mobile ? 844 : 1024;
  const dark = theme === 'dark';
  const colors = dark
    ? { page:'#42213D', surface:'#331832', card:'#412643', text:'#FFFFFF', muted:'#DDD6DF', action:'#3788BB', actionText:'#000000', border:'#683257', warning:'#5A4214' }
    : { page:'#F9F9F9', surface:'#FFFFFF', card:'#FFFFFF', text:'#000000', muted:'#626072', action:'#42213D', actionText:'#FFFFFF', border:'#E6E6E6', warning:'#F7ECDE' };
  const shell = mobile
    ? `<g id="mobile-header"><rect class="surface" width="390" height="72"/><use href="#easyacr-logo-${dark?'reversed':'normal'}" x="16" y="15" width="98" height="42"/><rect class="row" x="334" y="16" width="40" height="40" rx="8"/><path d="M345 28h18M345 34h18M345 40h18" stroke="${colors.text}" stroke-width="2"/></g>`
    : `<g id="desktop-shell"><rect class="surface" width="248" height="1024"/><use href="#easyacr-logo-${dark?'reversed':'normal'}" x="46" y="27" width="140" height="60"/>${['Dashboard','Scans','Schedules','Draft ACRs','Tools · WebMCP','Account'].map((item,i)=>`<g transform="translate(16 ${112+i*54})"><rect class="${i===0?'selected':'surface'}" width="216" height="44" rx="8"/><text class="nav" x="18" y="28">${item}</text></g>`).join('')}<text class="small muted" x="24" y="964">Mock mode · ${role}</text><rect class="surface" x="248" width="1192" height="72"/><text class="label" x="276" y="43">Northstar Labs</text><text class="small muted" x="1280" y="43">${role}</text></g>`;
  const body = mobile ? mobileBody(title, detail) : desktopBody(title, detail, route.includes('/scans/') || route.includes('/acrs/'));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">easyACR ${esc(title)} — ${viewport} ${theme}</title><desc id="desc">Editable ${viewport} composition for ${esc(route)}, ${theme} theme, ${esc(role)} role. ${esc(detail)}.</desc>
  <defs>${logo}<style>.page{fill:${colors.page}}.surface{fill:${colors.surface}}.card{fill:${colors.card};stroke:${colors.border};stroke-width:1}.row{fill:${dark?'#4E3354':'#F2F2F2'}}.selected{fill:${dark?'#4E3354':'#EDF7FC'}}.action{fill:${colors.action}}.warning{fill:${colors.warning}}.status0{fill:#781C1B}.status1{fill:#E0AC57}.status2{fill:#376A41}.status3{fill:#24629D}.brand,.h1,.h2,.metric{font-family:Satoshi,Arial,sans-serif;font-weight:700;fill:${colors.text}}.brand{font-size:20px}.h1{font-size:40px}.h1.mobile{font-size:29px}.h2{font-size:22px}.metric{font-size:34px}.body,.nav,.label,.small,.buttonText,.eyebrow{font-family:"DM Sans",Arial,sans-serif;fill:${colors.text}}.body{font-size:16px}.nav{font-size:15px;font-weight:600}.label{font-size:15px;font-weight:700}.small{font-size:13px}.buttonText{font-size:14px;font-weight:700;fill:${colors.actionText}}.eyebrow{font-size:11px;font-weight:700;letter-spacing:1.2px;fill:${dark?'#F7C371':'#683257'}}.muted{fill:${colors.muted}}</style></defs>
  <rect class="page" width="${width}" height="${height}"/>${shell}${body}
  <g id="metadata" transform="translate(${mobile?16:292} ${height-20})"><text class="small muted" x="0" y="0">Route ${esc(route)} · ${viewport} ${width}px · ${theme} · ${role}</text></g>
</svg>`;
  fs.writeFileSync(path.join(out, `${name}.svg`), svg);
}

const lines = screens.map(([name, route, viewport, theme, role, title]) => `| [${name}.svg](./${name}.svg) | \`${route}\` | ${viewport} | ${theme} | ${role} | ${title} |`).join('\n');
fs.writeFileSync(path.join(out, 'README.md'), `# easyACR SVG screen index\n\nGenerated from editable SVG primitives, token values, text nodes, reusable groups, and the supplied logo. These files do not contain page screenshots and have no proprietary external dependencies.\n\n| File | Route | Viewport | Theme | Role/state | Screen |\n|---|---|---|---|---|---|\n${lines}\n`);
console.log(`Generated ${screens.length} SVG screens in ${out}`);
