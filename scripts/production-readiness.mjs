const marketingOrigin = new URL(process.env.EASYACR_MARKETING_ORIGIN || "https://easyacr.com");
const appOrigin = new URL(process.env.EASYACR_APP_ORIGIN || "https://app.easyacr.com");
const wwwOrigin = new URL(process.env.EASYACR_WWW_ORIGIN || "https://www.easyacr.com");

function fail(message) {
  throw new Error(message);
}

async function response(url, options) {
  const result = await fetch(url, { redirect: "manual", ...options });
  return result;
}

const marketing = await response(marketingOrigin);
if (marketing.status !== 200) fail(`Marketing apex returned ${marketing.status}, expected 200.`);
const marketingHtml = await marketing.text();
const bundle = marketingHtml.match(/<script[^>]+src="([^"]+index-[^"]+\.js)"/i)?.[1];
if (!bundle) fail("Marketing apex did not reference an application bundle.");

const marketingBundle = await response(new URL(bundle, marketingOrigin));
if (marketingBundle.status !== 200) fail(`Marketing bundle returned ${marketingBundle.status}, expected 200.`);
const marketingSource = await marketingBundle.text();
if (!marketingSource.includes("Create your easyACR workspace")) {
  fail("Marketing bundle does not contain the public account-creation experience.");
}
if (!marketingSource.includes("https://app.easyacr.com/tools")) {
  fail("Marketing magic-link callback is not pinned to the authenticated app host.");
}

const www = await response(wwwOrigin);
if (![301, 302, 307, 308].includes(www.status)) fail(`www returned ${www.status}, expected a canonical redirect.`);
const location = www.headers.get("location");
if (!location || new URL(location, wwwOrigin).origin !== marketingOrigin.origin) {
  fail(`www redirects to ${location || "nothing"}, expected ${marketingOrigin.origin}.`);
}

const health = await response(new URL("/healthz", appOrigin));
if (health.status !== 200) fail(`App health returned ${health.status}, expected 200.`);
const healthBody = await health.json();
if (healthBody?.ok !== true || healthBody?.scanningEnabled !== true || healthBody?.persistenceEnabled !== true) {
  fail("App health does not report an enabled scanner and durable persistence.");
}

const unauthenticatedScan = await response(new URL("/api/v1/scans", appOrigin), {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ url: "https://example.com", pageLimit: 1, authorizationConfirmed: true }),
});
if (![401, 403].includes(unauthenticatedScan.status)) {
  fail(`Unauthenticated scan creation returned ${unauthenticatedScan.status}, expected 401 or 403.`);
}

console.log(JSON.stringify({
  ok: true,
  marketing: marketingOrigin.origin,
  app: appOrigin.origin,
  wwwRedirect: location,
  appHealth: healthBody,
}));
