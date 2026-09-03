import { FormEvent, ReactNode, useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  CircleDot,
  Copy,
  Globe2,
  LayoutDashboard,
  Menu,
  Moon,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sun,
  TerminalSquare,
  TriangleAlert,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import logoLightUrl from "../easyacrlogo.svg";
import logoDarkUrl from "../easyacrlogo-reversed.svg";
import type { ScanStatus, Severity } from "./domain";
import {
  getEasyAcrSession,
  getWebMcpSession,
  registerEasyAcrWebMcpTools,
  type WebMcpRegistrationStatus,
  type WebMcpSession,
} from "./webmcp";
import {
  exchangeSupabaseSession,
  getSupabaseAccountEmail,
  getWorkspaceProfile,
  saveWorkspaceProfile,
  sendMagicLink,
  signOutOfSupabase,
  supabaseEnabled,
  type WorkspaceProfile,
} from "./supabase";

type Navigate = (path: string) => void;
type WebMcpUiStatus = WebMcpRegistrationStatus | "registering";
type Scan = {
  id: string;
  target: string;
  status: string;
  createdAt: string;
  pagesCrawled: number;
  summary: { violationCount: number };
  draftEvidenceAvailable?: boolean;
};
type Finding = {
  id: string;
  impact: string;
  page: string;
  help: string;
  target: string[];
  ruleId?: string;
  helpUrl?: string;
  failureSummary?: string;
};
type Evidence = {
  id?: string;
  state?: string;
  template?: string;
  content?: { automatedEvidence?: { totalFindings?: number } };
};

function useRouter() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const navigate: Navigate = (next) => {
    window.history.pushState({}, "", next);
    setPath(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  return { path, navigate };
}
function Link({
  to,
  navigate,
  children,
  className,
  current,
  ariaLabel,
}: {
  to: string;
  navigate: Navigate;
  children: ReactNode;
  className?: string;
  current?: boolean;
  ariaLabel?: string;
}) {
  return (
    <a
      href={to}
      className={className}
      aria-current={current ? "page" : undefined}
      aria-label={ariaLabel}
      onClick={(event) => {
        if (!event.metaKey && !event.ctrlKey) {
          event.preventDefault();
          navigate(to);
        }
      }}
    >
      {children}
    </a>
  );
}
function Logo({ navigate }: { navigate: Navigate }) {
  return (
    <Link to="/" navigate={navigate} className="brand-lockup">
      <img className="logo logo-on-light" src={logoLightUrl} alt="easyACR" />
      <img className="logo logo-on-dark" src={logoDarkUrl} alt="easyACR" />
    </Link>
  );
}
function ThemeButton({
  theme,
  setTheme,
}: {
  theme: "light" | "dark";
  setTheme: (value: "light" | "dark") => void;
}) {
  return (
    <button
      className="theme-button"
      type="button"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      aria-label={`Use ${theme === "light" ? "dark" : "light"} theme`}
    >
      {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
    </button>
  );
}

function PublicShell({
  path,
  navigate,
  theme,
  setTheme,
  signedIn,
  accountEmail,
  onSignOut,
  children,
}: {
  path: string;
  navigate: Navigate;
  theme: "light" | "dark";
  setTheme: (value: "light" | "dark") => void;
  signedIn: boolean;
  accountEmail: string | null;
  onSignOut: () => Promise<void>;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountError, setAccountError] = useState("");
  const button = useRef<HTMLButtonElement>(null);
  const accountButton = useRef<HTMLButtonElement>(null);
  const accountMenu = useRef<HTMLDivElement>(null);
  const items = [
    ["/tools", "Tools"],
    ["/scans", "Scans"],
    ["/terms", "Terms"],
  ] as const;
  const initials = (accountEmail || "easyACR")
    .split("@")[0]
    .split(/[.\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "EA";
  useEffect(() => {
    if (!open && !accountOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (accountOpen) {
          setAccountOpen(false);
          accountButton.current?.focus();
        } else {
          setOpen(false);
          button.current?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, accountOpen]);
  useEffect(() => {
    if (!accountOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!accountMenu.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [accountOpen]);
  const signOut = async () => {
    setAccountError("");
    try {
      await onSignOut();
      setAccountOpen(false);
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "Could not sign you out. Try again.");
    }
  };
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <header className="public-header">
        <div className="container">
          <Logo navigate={navigate} />
          <nav
            id="public-menu"
            className={`public-nav ${open ? "open" : ""}`}
            aria-label="Primary"
            onClick={() => setOpen(false)}
          >
            {items.map(([to, label]) => (
              <Link
                key={to}
                to={to}
                navigate={navigate}
                current={
                  path === to || (to === "/scans" && path.startsWith("/scans/"))
                }
              >
                {label}
              </Link>
            ))}
            {signedIn ? null : <>
              <Link to="/account" navigate={navigate}>Sign in</Link>
              <Link to="/account" navigate={navigate} className="button small">Create account</Link>
            </>}
          </nav>
          <div className="header-actions">
            <ThemeButton theme={theme} setTheme={setTheme} />
            {signedIn && <div className="account-menu" ref={accountMenu}>
              <button
                ref={accountButton}
                className="account-trigger"
                type="button"
                aria-label={accountEmail ? `Open account menu for ${accountEmail}` : "Open account menu"}
                aria-expanded={accountOpen}
                aria-controls="account-popover"
                onClick={() => {
                  setAccountError("");
                  setAccountOpen((value) => !value);
                }}
              >
                <span aria-hidden="true">{initials}</span>
              </button>
              {accountOpen && <div id="account-popover" className="account-popover" role="group" aria-label="Account menu">
                <div className="account-identity">
                  <span className="account-avatar" aria-hidden="true">{initials}</span>
                  <div>
                    <strong>{accountEmail || "Your easyACR account"}</strong>
                    <span>Personal workspace</span>
                  </div>
                </div>
                <div className="account-menu-links" onClick={() => setAccountOpen(false)}>
                  <Link to="/account" navigate={navigate}>Account</Link>
                  <Link to="/scans" navigate={navigate}>Scan history</Link>
                  <Link to="/tools" navigate={navigate}>Open tools</Link>
                </div>
                <div className="account-menu-footer">
                  <button type="button" onClick={() => void signOut()}>Sign out</button>
                  {accountError && <p role="alert">{accountError}</p>}
                </div>
              </div>}
            </div>}
            <button
              ref={button}
              className="menu-button"
              type="button"
              aria-expanded={open}
              aria-controls="public-menu"
              onClick={() => setOpen(!open)}
            >
              <span className="sr-only">Menu</span>
              {open ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="footer">
        <div className="container spaced">
          <Logo navigate={navigate} />
          <p className="muted">
            Automated accessibility evidence for public websites. Not a
            certification service.
          </p>
          <nav className="cluster" aria-label="Footer">
            <Link to="/tools" navigate={navigate}>
              Tools
            </Link>
            <Link to="/scans" navigate={navigate}>
              Scans
            </Link>
            <Link to="/terms" navigate={navigate}>
              Terms
            </Link>
            <Link to="/privacy" navigate={navigate}>
              Privacy
            </Link>
            <Link to="/acceptable-use" navigate={navigate}>
              Acceptable use
            </Link>
            <a href="mailto:support@easyacr.com">Support</a>
          </nav>
        </div>
      </footer>
    </>
  );
}

function AuthenticatedShell({
  path,
  navigate,
  theme,
  setTheme,
  accountEmail,
  workspaceName,
  children,
}: {
  path: string;
  navigate: Navigate;
  theme: "light" | "dark";
  setTheme: (value: "light" | "dark") => void;
  accountEmail: string | null;
  workspaceName: string | null;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const items = [
    ["/dashboard", "Dashboard", LayoutDashboard],
    ["/scans", "Scans", Globe2],
    ["/tools", "Tools · WebMCP", TerminalSquare],
  ] as const;
  const initials = (accountEmail || "easyACR")
    .split("@")[0]
    .split(/[.\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "EA";
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">Skip to main content</a>
      <aside className={`sidebar ${open ? "open" : ""}`} aria-label="Application navigation">
        <div className="spaced">
          <Logo navigate={navigate} />
          {open && <button className="icon-button" type="button" onClick={() => setOpen(false)} aria-label="Close navigation"><X size={20} /></button>}
        </div>
        <nav className="app-nav" aria-label="Product">
          {items.map(([to, label, Icon]) => <Link key={to} to={to} navigate={(next) => { setOpen(false); navigate(next); }} current={path === to || (to === "/scans" && path.startsWith("/scans/"))}>
            <Icon size={19} aria-hidden="true" />{label}
          </Link>)}
        </nav>
        <div className="sidebar-footer">
          <p className="hint">Public-scan beta<br />Automated evidence only</p>
          <Link to="/account" navigate={navigate} className="account-sidebar-link"><UserRound size={18} /> Account</Link>
        </div>
      </aside>
      <div className="app-main">
        <header className="app-topbar">
          <div className="cluster">
            <button className="menu-button" type="button" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu size={22} /></button>
            <strong>{workspaceName || "Personal workspace"}</strong>
          </div>
          <div className="cluster">
            <ThemeButton theme={theme} setTheme={setTheme} />
            <Link to="/account" navigate={navigate} className="avatar" ariaLabel="Open account">{initials}</Link>
          </div>
        </header>
        <main id="main" className="app-content">{children}</main>
      </div>
    </div>
  );
}

function Home({ navigate }: { navigate: Navigate }) {
  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="stack">
            <span className="eyebrow">Public scan beta</span>
            <h1>Let your agent start a bounded accessibility scan.</h1>
            <p>
              easyACR gives compatible WebMCP agents a narrow way to scan a
              public HTTPS website, read automated findings, and create WCAG 2.2
              draft evidence.
            </p>
            <div className="cluster">
              <Link className="button" to="/tools" navigate={navigate}>
                Open WebMCP tools <ArrowRight size={18} />
              </Link>
              <Link
                className="button secondary"
                to="/tools"
                navigate={navigate}
              >
                Start scan beta
              </Link>
            </div>
            <small>
              Magic-link sign-in and terms acceptance required. Automated output
              always needs human review.
            </small>
          </div>
          <div className="hero-card stack">
            <div>
              <span className="eyebrow">What is available now</span>
              <h2>One focused workflow</h2>
            </div>
            {[
              "Public HTTPS targets only",
              "Same-origin crawl, capped at 10 pages",
              "Four agent tools and browser fallback",
            ].map((item) => (
              <div className="workflow-item" key={item}>
                <CheckCircle2
                  color="var(--success)"
                  size={20}
                  aria-hidden="true"
                />
                <span>{item}</span>
              </div>
            ))}
            <div className="callout warning">
              <strong>Not a conformance result</strong>
              <p>
                Automated checks identify some barriers; qualified human
                evaluation remains necessary.
              </p>
            </div>
          </div>
        </div>
      </section>
      <section className="section section-alt">
        <div className="container">
          <div className="section-heading">
            <span className="eyebrow">Designed for a narrow beta</span>
            <h2>Clear boundaries, useful evidence</h2>
            <p>
              The public service deliberately excludes credentials,
              authenticated areas, schedules, billing, and completed ACRs.
            </p>
          </div>
          <div className="grid-3">
            <article className="card">
              <Globe2 />
              <h3>Public targets only</h3>
              <p>
                Submit a website you own or are authorized to test. Private
                networks, IP literals, credentials, and cross-origin crawl
                expansion are refused.
              </p>
            </article>
            <article className="card">
              <TerminalSquare />
              <h3>Agent-ready tools</h3>
              <p>
                A compatible browser agent can start a scan, check status,
                inspect untrusted findings, and create draft WCAG evidence.
              </p>
            </article>
            <article className="card">
              <ShieldCheck />
              <h3>Evidence, not promises</h3>
              <p>
                Findings are automated and source-derived content is untrusted.
                Nothing in this beta certifies accessibility conformance.
              </p>
            </article>
          </div>
        </div>
      </section>
    </>
  );
}

function LegalPage({ kind }: { kind: "terms" | "privacy" | "acceptable-use" }) {
  const content = {
    terms: {
      eyebrow: "Terms of Service · 2026-09-02",
      title: "Public automated-scan terms",
      paragraphs: [
        "Use easyACR only for a website you own or are expressly authorized to test. The beta scans public HTTPS pages only; it does not accept credentials or test authenticated areas.",
        "Automated results are preliminary technical evidence. They are not an accessibility certification, a completed Accessibility Conformance Report, legal advice, or a substitute for qualified human evaluation.",
        "We may cap, delay, reject, or remove scans to protect the service, third parties, and our infrastructure. These public-beta terms may change; a new acceptance may be required for material revisions.",
      ],
    },
    privacy: {
      eyebrow: "Privacy Notice · 2026-09-02",
      title: "How this beta handles scan data",
      paragraphs: [
        "The beta uses a signed browser session to authorize a scan. Depending on its configured access mode, it may also use an external sign-in provider. Do not submit sensitive, personal, confidential, or regulated information through a scan target.",
        "The service processes the submitted URL, scan status, and structured automated findings to run and display a requested scan. It does not accept submitted credentials or intentionally retain raw page HTML. Hosted durable scan records are configured for deletion after 30 days; local invite-compatibility work may instead be cleared when the service restarts.",
      ],
    },
    "acceptable-use": {
      eyebrow: "Acceptable Use · 2026-09-02",
      title: "Use the scanner responsibly",
      paragraphs: [
        "Do not scan a target without permission; evade controls; use easyACR for denial-of-service, security testing, data collection, or credential harvesting; or make unsupported accessibility or legal claims from automated findings.",
        "Do not use easyACR to collect personal data, proprietary content, credentials, or confidential information. We may suspend access, cancel work, and preserve necessary security records when we reasonably believe this policy has been violated.",
      ],
    },
  }[kind];
  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 860 }}>
        <div className="section-heading">
          <span className="eyebrow">{content.eyebrow}</span>
          <h1>{content.title}</h1>
        </div>
        <article className="card stack">
          {content.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {kind === "privacy" && (
            <p>
              For retention, deletion, or security questions, contact{" "}
              <a href="mailto:support@easyacr.com">support@easyacr.com</a>.
            </p>
          )}
        </article>
      </div>
    </section>
  );
}

function Status({ value }: { value: ScanStatus | string }) {
  const icon =
    value === "completed" || value === "Active" ? (
      <CheckCircle2 size={14} />
    ) : value === "running" ? (
      <RefreshCw size={14} />
    ) : value === "failed" || value === "canceled" ? (
      <XCircle size={14} />
    ) : (
      <AlertCircle size={14} />
    );
  return (
    <span className={`status ${value.replace(" ", "-")}`}>
      {icon}
      <span>
        {value === "partial" ? "Partial result" : value.replace("-", " ")}
      </span>
    </span>
  );
}
function SeverityLabel({ value }: { value: Severity }) {
  return (
    <span className={`severity ${value}`}>
      {value === "critical" || value === "serious" ? (
        <TriangleAlert size={17} />
      ) : (
        <CircleDot size={17} />
      )}
      {value}
    </span>
  );
}
function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="metric-value" style={{ fontSize: "1.7rem" }}>
        {value}
      </div>
      <div className="metric-label">{label}</div>
    </div>
  );
}
function PageHeading({
  eyebrow,
  title,
  copy,
  action,
}: {
  eyebrow?: string;
  title: string;
  copy?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-heading spaced">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {copy && <p>{copy}</p>}
      </div>
      {action}
    </header>
  );
}
function MobileLabel({ children }: { children: ReactNode }) {
  return <span className="mobile-label">{children}</span>;
}
async function errorMessage(response: Response, fallback: string) {
  try {
    const body = await response.json();
    return typeof body?.error?.message === "string"
      ? body.error.message
      : fallback;
  } catch {
    return fallback;
  }
}
function safeExternalUrl(value: unknown) {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}
function normalizeFinding(value: Record<string, unknown>): Finding {
  return {
    id: String(value.id ?? ""),
    impact: String(value.impact ?? "minor"),
    page: String(value.page ?? ""),
    help: String(value.help ?? ""),
    target: Array.isArray(value.target) ? value.target.map(String) : [],
    ruleId:
      typeof value.ruleId === "string"
        ? value.ruleId
        : typeof value.rule_id === "string"
          ? value.rule_id
          : undefined,
    helpUrl: safeExternalUrl(value.helpUrl ?? value.help_url),
    failureSummary:
      typeof value.failureSummary === "string"
        ? value.failureSummary
        : typeof value.failure_summary === "string"
          ? value.failure_summary
          : undefined,
  };
}

function ScanTable({ scans, navigate }: { scans: Scan[]; navigate: Navigate }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Scan</th>
            <th>Status</th>
            <th>Pages</th>
            <th>Findings</th>
            <th>Started</th>
            <th>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {scans.map((scan) => (
            <tr key={scan.id}>
              <td>
                <MobileLabel>Scan</MobileLabel>
                <strong>{scan.target}</strong>
                <br />
                <small>{scan.id}</small>
              </td>
              <td>
                <MobileLabel>Status</MobileLabel>
                <Status value={scan.status} />
              </td>
              <td>
                <MobileLabel>Pages</MobileLabel>
                {scan.pagesCrawled}
              </td>
              <td>
                <MobileLabel>Findings</MobileLabel>
                {scan.summary.violationCount}
              </td>
              <td>
                <MobileLabel>Started</MobileLabel>
                {new Date(scan.createdAt).toLocaleString()}
              </td>
              <td>
                <MobileLabel>Actions</MobileLabel>
                <button
                  className="text-link"
                  onClick={() => navigate(`/scans/${scan.id}`)}
                >
                  View scan
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DashboardPage({ navigate }: { navigate: Navigate }) {
  const [scans, setScans] = useState<Scan[] | null>(null);
  const [message, setMessage] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    let active = true;
    void fetch("/api/v1/scans", { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) throw new Error(await errorMessage(response, "Your dashboard could not be loaded."));
        return response.json();
      })
      .then((payload) => {
        if (!active) return;
        setScans(Array.isArray(payload.scans) ? payload.scans : []);
        setMessage("");
      })
      .catch((error) => {
        if (!active) return;
        setScans([]);
        setMessage(error instanceof Error ? error.message : "Your dashboard could not be loaded.");
      });
    return () => { active = false; };
  }, [refreshKey]);
  const completed = scans?.filter((scan) => ["completed", "partial"].includes(scan.status)) || [];
  const pages = completed.reduce((total, scan) => total + scan.pagesCrawled, 0);
  const findings = completed.reduce((total, scan) => total + scan.summary.violationCount, 0);
  const activeScans = scans?.filter((scan) => ["queued", "running"].includes(scan.status)).length || 0;
  return (
    <>
      <PageHeading eyebrow="Personal workspace" title="Dashboard" copy="Your authorized public-site scans and automated evidence, in one place." action={<div className="cluster"><button className="button secondary" onClick={() => setRefreshKey((value) => value + 1)}><RefreshCw size={18} /> Refresh</button><button className="button" onClick={() => navigate("/tools")}><Plus size={18} /> New scan</button></div>} />
      {message && <div className="callout warning"><strong>Dashboard unavailable</strong><p>{message}</p></div>}
      {scans === null ? <div className="card"><p>Loading your workspace…</p></div> : scans.length === 0 ? <section className="card stack dashboard-empty"><span className="eyebrow">Start here</span><h2>Your workspace is ready for its first scan.</h2><p>Authorize a public HTTPS website, then let easyACR collect bounded automated evidence for your review.</p><div><button className="button" onClick={() => navigate("/tools")}>Start a public scan <ArrowRight size={18} /></button></div></section> : <>
        <section className="grid-3 dashboard-metrics" aria-label="Workspace summary">
          <article className="card metric"><span className="metric-label">Scans</span><span className="metric-value">{scans.length}</span><span className="muted">{activeScans ? `${activeScans} active now` : "No active scans"}</span></article>
          <article className="card metric"><span className="metric-label">Pages evaluated</span><span className="metric-value">{pages}</span><span className="muted">Completed or partial scans</span></article>
          <article className="card metric"><span className="metric-label">Automated findings</span><span className="metric-value">{findings}</span><span className="muted">Human review still required</span></article>
        </section>
        <section className="stack dashboard-recent"><div className="spaced"><div><h2>Recent scans</h2><p className="muted">Only scans in your personal workspace appear here.</p></div><button className="text-link" onClick={() => navigate("/scans")}>View all scans</button></div><ScanTable scans={scans.slice(0, 5)} navigate={navigate} /></section>
      </>}
      <div className="callout warning dashboard-disclosure"><strong>Evidence, not certification</strong><p>easyACR reports automated technical evidence. A completed Accessibility Conformance Report requires qualified human review.</p></div>
    </>
  );
}
function ScansPage({ navigate }: { navigate: Navigate }) {
  const [scans, setScans] = useState<Scan[] | null>(null);
  const [message, setMessage] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    let active = true;
    void fetch("/api/v1/scans", { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            await errorMessage(response, "Scan history is unavailable."),
          );
        const payload = await response.json();
        if (active) {
          setScans(payload.scans || []);
          setMessage("");
        }
      })
      .catch((error) => {
        if (active) {
          setScans([]);
          setMessage(
            error instanceof Error
              ? error.message
              : "Scan history is unavailable for this session.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [refreshKey]);
  return (
    <section className="section">
      <div className="container">
        <PageHeading
          eyebrow="Public scan beta"
          title="Scan history"
          copy="View scans available to your current session. Public results are automated evidence, not a conformance determination."
          action={
            <div className="cluster">
              <button
                className="button secondary"
                onClick={() => setRefreshKey((value) => value + 1)}
              >
                <RefreshCw size={18} /> Refresh
              </button>
              <button className="button" onClick={() => navigate("/tools")}>
                <Plus size={18} /> New scan
              </button>
            </div>
          }
        />
        {message && (
          <div className="callout warning">
            <strong>Scan history unavailable</strong>
            <p>{message}</p>
          </div>
        )}
        {scans === null ? (
          <div className="card">
            <p>Loading scan history…</p>
          </div>
        ) : scans.length ? (
          <ScanTable scans={scans} navigate={navigate} />
        ) : (
          <div className="card stack">
            <h2>No scans available</h2>
            <p>
              Use Tools to create an authorized session and queue a public HTTPS
              scan.
            </p>
            <button className="button" onClick={() => navigate("/tools")}>
              Open tools
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function LiveScanDetail({
  navigate,
  scanId,
}: {
  navigate: Navigate;
  scanId: string;
}) {
  const [scan, setScan] = useState<Scan | null>(null);
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [severity, setSeverity] = useState("");
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [evidenceMessage, setEvidenceMessage] = useState("");
  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({
      limit: "50",
      ...(severity ? { severity } : {}),
    });
    void Promise.all([
      fetch(`/api/v1/scans/${encodeURIComponent(scanId)}`, {
        credentials: "same-origin",
      }),
      fetch(`/api/v1/scans/${encodeURIComponent(scanId)}/findings?${query}`, {
        credentials: "same-origin",
      }),
    ])
      .then(async ([scanResponse, findingsResponse]) => {
        if (!scanResponse.ok)
          throw new Error(
            await errorMessage(scanResponse, "This scan could not be loaded."),
          );
        if (!findingsResponse.ok)
          throw new Error(
            await errorMessage(
              findingsResponse,
              "Findings could not be loaded.",
            ),
          );
        const scanPayload = await scanResponse.json();
        const findingsPayload = await findingsResponse.json();
        if (active) {
          setScan(scanPayload.scan);
          setFindings((findingsPayload.findings || []).map(normalizeFinding));
          setTotal(Number(findingsPayload.total || 0));
          setNextCursor(
            typeof findingsPayload.nextCursor === "string"
              ? findingsPayload.nextCursor
              : null,
          );
          setLastUpdated(new Date());
          setError("");
        }
      })
      .catch((loadError) => {
        if (active)
          setError(
            loadError instanceof Error
              ? loadError.message
              : "This scan could not be loaded.",
          );
      });
    return () => {
      active = false;
    };
  }, [scanId, severity, refreshKey]);
  useEffect(() => {
    if (!scan || !["queued", "running"].includes(scan.status)) return;
    const timer = window.setTimeout(
      () => setRefreshKey((value) => value + 1),
      5_000,
    );
    return () => window.clearTimeout(timer);
  }, [scan]);
  const loadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const query = new URLSearchParams({
        limit: "50",
        cursor: nextCursor,
        ...(severity ? { severity } : {}),
      });
      const response = await fetch(
        `/api/v1/scans/${encodeURIComponent(scanId)}/findings?${query}`,
        { credentials: "same-origin" },
      );
      if (!response.ok)
        throw new Error(
          await errorMessage(response, "More findings could not be loaded."),
        );
      const payload = await response.json();
      setFindings((current) => [
        ...(current || []),
        ...(payload.findings || []).map(normalizeFinding),
      ]);
      setNextCursor(
        typeof payload.nextCursor === "string" ? payload.nextCursor : null,
      );
      setTotal(Number(payload.total || total));
      setLastUpdated(new Date());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "More findings could not be loaded.",
      );
    } finally {
      setLoadingMore(false);
    }
  };
  const createEvidence = async () => {
    setEvidenceMessage("");
    try {
      const session = await getWebMcpSession();
      const response = await fetch(
        `/api/v1/scans/${encodeURIComponent(scanId)}/draft-evidence`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "content-type": "application/json",
            "x-csrf-token": session.csrfToken,
          },
          body: JSON.stringify({ template: "WCAG_2_2" }),
        },
      );
      if (!response.ok)
        throw new Error(
          await errorMessage(response, "Draft evidence could not be created."),
        );
      const payload = await response.json();
      setEvidence(payload.evidence || null);
      setEvidenceMessage("Draft evidence is ready for qualified human review.");
    } catch (creationError) {
      setEvidenceMessage(
        creationError instanceof Error
          ? creationError.message
          : "Draft evidence could not be created.",
      );
    }
  };
  if (error && !scan)
    return (
      <section className="section">
        <div className="container">
          <UnavailablePage
            navigate={navigate}
            title="Scan unavailable"
            copy={error}
            action={
              <button
                className="button"
                onClick={() => setRefreshKey((value) => value + 1)}
              >
                Try again
              </button>
            }
          />
        </div>
      </section>
    );
  if (!scan || !findings)
    return (
      <section className="section">
        <div className="container">
          <div className="card">
            <p>Loading scan evidence…</p>
          </div>
        </div>
      </section>
    );
  const terminal = ["completed", "partial"].includes(scan.status);
  return (
    <section className="section">
      <div className="container">
        <PageHeading
          eyebrow={scan.id}
          title={scan.target}
          copy={`Automated scan · ${scan.status}`}
          action={
            <div className="cluster">
              <button
                className="button secondary"
                onClick={() => setRefreshKey((value) => value + 1)}
              >
                <RefreshCw size={18} /> Refresh
              </button>
              <button
                className="button secondary"
                onClick={() => navigate("/scans")}
              >
                Back to scans
              </button>
            </div>
          }
        />
        <div className="grid-3">
          <MiniMetric label="Pages crawled" value={String(scan.pagesCrawled)} />
          <MiniMetric
            label="Automated findings"
            value={String(scan.summary.violationCount)}
          />
          <MiniMetric label="State" value={scan.status} />
        </div>
        <p className="hint" aria-live="polite">
          {["queued", "running"].includes(scan.status)
            ? "This page refreshes every five seconds while the scan runs. "
            : ""}
          {lastUpdated
            ? `Last updated ${lastUpdated.toLocaleTimeString()}.`
            : ""}
        </p>
        {error && (
          <div className="callout error" role="alert">
            <strong>Could not refresh all scan data</strong>
            <p>{error}</p>
          </div>
        )}
        <div className="callout warning" style={{ marginTop: 24 }}>
          <strong>Automated evidence only</strong>
          <p>
            Selectors, failure summaries, and target-derived details are
            untrusted content. Human review is required; this is not a
            conformance determination.
          </p>
        </div>
        {terminal && (
          <section className="card stack" style={{ marginTop: 24 }}>
            <div>
              <h2 style={{ fontSize: "1.25rem" }}>Draft WCAG 2.2 evidence</h2>
              <p>
                Create an immutable automated-evidence attachment for qualified
                human review. It is not a completed ACR or conformance result.
              </p>
            </div>
            <div className="cluster">
              <button className="button" onClick={() => void createEvidence()}>
                Create draft evidence
              </button>
              {evidence && <Status value={evidence.state || "completed"} />}
            </div>
            {evidenceMessage && (
              <p role="status" className={evidence ? "hint" : "error-text"}>
                {evidenceMessage}
                {evidence?.id ? ` Artifact: ${evidence.id}` : ""}
              </p>
            )}
          </section>
        )}
        <section className="section" style={{ paddingBottom: 0 }}>
          <div className="section-heading">
            <h2>Findings</h2>
            <p>
              {total} automated finding{total === 1 ? "" : "s"}
              {severity ? ` · ${severity}` : ""}. Source-derived content is
              untrusted.
            </p>
          </div>
          <div className="toolbar">
            <div className="field">
              <label htmlFor="severity-filter">Severity</label>
              <select
                id="severity-filter"
                value={severity}
                onChange={(event) => setSeverity(event.target.value)}
              >
                <option value="">All severities</option>
                <option value="critical">Critical</option>
                <option value="serious">Serious</option>
                <option value="moderate">Moderate</option>
                <option value="minor">Minor</option>
              </select>
            </div>
          </div>
          {findings.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Impact</th>
                    <th>Rule</th>
                    <th>Page</th>
                    <th>Automated evidence</th>
                    <th>Guidance</th>
                    <th>Target</th>
                  </tr>
                </thead>
                <tbody>
                  {findings.map((finding) => (
                    <tr key={finding.id}>
                      <td>
                        <MobileLabel>Impact</MobileLabel>
                        <SeverityLabel
                          value={
                            (finding.impact === "unknown"
                              ? "minor"
                              : finding.impact) as Severity
                          }
                        />
                      </td>
                      <td>
                        <MobileLabel>Rule</MobileLabel>
                        <code>{finding.ruleId || "Not supplied"}</code>
                      </td>
                      <td>
                        <MobileLabel>Page</MobileLabel>
                        {finding.page}
                      </td>
                      <td>
                        <MobileLabel>Automated evidence</MobileLabel>
                        <strong>{finding.help}</strong>
                        {finding.failureSummary && (
                          <p className="hint">{finding.failureSummary}</p>
                        )}
                      </td>
                      <td>
                        <MobileLabel>Guidance</MobileLabel>
                        {finding.helpUrl ? (
                          <a
                            href={finding.helpUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Review rule guidance
                          </a>
                        ) : (
                          "Not supplied"
                        )}
                      </td>
                      <td>
                        <MobileLabel>Target</MobileLabel>
                        <code>
                          {finding.target.join(", ") || "Not supplied"}
                        </code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card">
              <p>
                {["queued", "running"].includes(scan.status)
                  ? "No findings are available yet. This page will refresh while the scan runs."
                  : "No findings match this filter."}
              </p>
            </div>
          )}
          {nextCursor && (
            <div style={{ marginTop: 16 }}>
              <button
                className="button secondary"
                onClick={() => void loadMore()}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading findings…" : "Load more findings"}
              </button>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

function ToolsPage({
  registrationStatus,
  navigate,
  onSessionChange,
}: {
  registrationStatus: WebMcpUiStatus;
  navigate: Navigate;
  onSessionChange: (session: WebMcpSession) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [invite, setInvite] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [localTermsChecked, setLocalTermsChecked] = useState(false);
  const [revokeError, setRevokeError] = useState("");
  const [email, setEmail] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [session, setSession] = useState<WebMcpSession | null>(null);
  const [termsChecked, setTermsChecked] = useState(false);
  const [termsMessage, setTermsMessage] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [targetAuthorized, setTargetAuthorized] = useState(false);
  const [scanMessage, setScanMessage] = useState("");
  const [queuedScanId, setQueuedScanId] = useState("");
  const registered = registrationStatus === "registered";
  const origin = window.location.origin;
  const canUseBrowserFallback = Boolean(
    session?.active && (session.termsAccepted || !supabaseEnabled),
  );
  const updateSession = useCallback((next: WebMcpSession) => {
    setSession(next);
    onSessionChange(next);
  }, [onSessionChange]);
  const enableBeta = async (event: FormEvent) => {
    event.preventDefault();
    setInviteError("");
    if (!localTermsChecked)
      return setInviteError(
        "Accept the current public-scan terms to continue.",
      );
    try {
      const response = await fetch("/api/v1/session", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "x-easyacr-invite": invite,
          "x-easyacr-terms-version": "2026-09-02",
        },
      });
      if (!response.ok)
        throw new Error(
          await errorMessage(
            response,
            "This invitation could not enable the local compatibility session.",
          ),
        );
      window.location.reload();
    } catch (error) {
      setInviteError(
        error instanceof Error
          ? error.message
          : "This invitation could not enable the local compatibility session.",
      );
    }
  };
  const enableSupabase = async (event: FormEvent) => {
    event.preventDefault();
    setAuthMessage("");
    try {
      await sendMagicLink(email);
      setAuthMessage(
        "Check your email for a secure link to create or access your workspace.",
      );
    } catch (error) {
      setAuthMessage(
        error instanceof Error
          ? error.message
          : "We could not send a sign-in link. Try again shortly.",
      );
    }
  };
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const current = await getEasyAcrSession();
        if (!active) return;
        if (current.active) {
          updateSession(current);
          return;
        }
        if (!supabaseEnabled) return;

        const exchanged = await exchangeSupabaseSession();
        if (!active || !exchanged) return;
        const next = await getEasyAcrSession();
        if (active) updateSession(next);
      } catch {
        if (active)
          setAuthMessage(
            "Your sign-in link could not create an easyACR session. Try signing in again.",
          );
      }
    })();
    return () => {
      active = false;
    };
  }, [updateSession]);
  const acceptTerms = async (event: FormEvent) => {
    event.preventDefault();
    setTermsMessage("");
    if (!termsChecked || !session?.csrfToken)
      return setTermsMessage(
        "Confirm that you accept the scan terms to continue.",
      );
    try {
      const response = await fetch("/api/v1/terms/accept", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": session.csrfToken,
        },
        body: JSON.stringify({ version: "2026-09-02" }),
      });
      if (!response.ok)
        throw new Error(
          await errorMessage(response, "We could not record your acceptance."),
        );
      window.location.replace("/tools");
    } catch (error) {
      setTermsMessage(
        error instanceof Error
          ? error.message
          : "We could not record your acceptance. Refresh and try again.",
      );
    }
  };
  const startBrowserScan = async (event: FormEvent) => {
    event.preventDefault();
    setScanMessage("");
    setQueuedScanId("");
    if (!targetAuthorized)
      return setScanMessage(
        "Confirm that you own or are authorized to test this public website before queuing a scan.",
      );
    try {
      const current = await getWebMcpSession();
      const response = await fetch("/api/v1/scans", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": current.csrfToken,
        },
        body: JSON.stringify({
          url: targetUrl,
          pageLimit: 10,
          authorizationConfirmed: true,
        }),
      });
      if (!response.ok)
        throw new Error(
          await errorMessage(response, "The scan could not be queued."),
        );
      const payload = await response.json();
      if (typeof payload?.scan?.id !== "string")
        throw new Error("The scan was accepted without a scan identifier.");
      setQueuedScanId(payload.scan.id);
      setScanMessage(
        `Scan queued: ${payload.scan.id}. This scan is capped at 10 same-origin public pages.`,
      );
    } catch (error) {
      setScanMessage(
        error instanceof Error
          ? error.message
          : "The scan could not be queued.",
      );
    }
  };
  const revokeBeta = async () => {
    setRevokeError("");
    try {
      const current = await getWebMcpSession();
      const response = await fetch("/api/v1/session/revoke", {
        method: "POST",
        credentials: "same-origin",
        headers: { "x-csrf-token": current.csrfToken },
      });
      if (!response.ok)
        throw new Error(
          await errorMessage(response, "Could not revoke this scan session."),
        );
      await signOutOfSupabase();
      window.location.reload();
    } catch (error) {
      setRevokeError(
        error instanceof Error
          ? error.message
          : "Could not revoke this scan session. Refresh and try again.",
      );
    }
  };
  const availableTools = [
    {
      name: "get-scan-status",
      mode: "Read only",
      copy: "Returns state, page counts, finding count, and draft-evidence availability for one of your scans.",
    },
    {
      name: "start_accessibility_scan",
      mode: "Starts scan",
      copy: "Queues an authorized public HTTPS, same-origin scan with a maximum of 10 pages. Credentials are never accepted.",
    },
    {
      name: "list_accessibility_issues",
      mode: "Read only",
      copy: "Returns paginated automated findings. Page-derived details are marked untrusted.",
    },
    {
      name: "create_draft_acr",
      mode: "Creates evidence",
      copy: "Creates a WCAG 2.2 draft evidence attachment; it does not issue a conformance result.",
    },
  ];
  return (
    <section className="section">
      <div className="container">
        <PageHeading
          eyebrow="Public scan beta"
          title="Tools · WebMCP"
          copy="Compatible agents can start a capped public-site automated scan, inspect its findings, and create a WCAG 2.2 draft evidence attachment."
          action={
            <span className="badge warning">
              Automated evidence · human review required
            </span>
          }
        />
        <div className={`callout ${registered ? "success" : "warning"}`}>
          <strong>
            {registered
              ? "Four easyACR tools are registered for this session."
              : session?.active && !session.termsAccepted && supabaseEnabled
                ? "Accept the public-scan terms to enable WebMCP."
              : registrationStatus === "registering"
                ? "Checking your scan session and registering tools…"
                : registrationStatus === "unsupported"
                  ? "WebMCP is not available in this browser."
                  : registrationStatus === "failed"
                    ? "WebMCP registration failed; no partial tool set remains active."
                    : "WebMCP is unavailable for this scan session."}
          </strong>
          <p>
            {registered
              ? "Tools call the same-origin scan API. Public HTTPS pages only; credentials and authenticated targets are refused."
              : session?.active && !session.termsAccepted && supabaseEnabled
                ? "Accept the public-scan terms below before tools can be registered."
                : supabaseEnabled
                  ? "Sign in with your work email to connect a compatible WebMCP client. If WebMCP is unsupported, use the browser scan form after sign-in."
                  : "This local invite-compatibility mode is not the hosted public beta."}
          </p>
        </div>
        {!registered && supabaseEnabled && !session?.active && (
          <form
            className="card stack"
            style={{ marginTop: 20 }}
            onSubmit={enableSupabase}
          >
            <div>
              <h2 style={{ fontSize: "1.25rem" }}>
                Create or sign in to your easyACR account
              </h2>
              <p>
                Enter your work email. If it is new to easyACR, the secure
                link creates your personal workspace; returning users sign in
                without a password. Terms acceptance is required before an
                agent can register or invoke WebMCP tools.
              </p>
            </div>
            <div className="field">
              <label htmlFor="sign-in-email">Work email</label>
              <input
                id="sign-in-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </div>
            {authMessage && (
              <p role="status" className="muted">
                {authMessage}
              </p>
            )}
            <div>
              <button className="button" type="submit">
                Continue with email
              </button>
            </div>
          </form>
        )}
        {!registered && !supabaseEnabled && (
          <form
            className="card stack"
            style={{ marginTop: 20 }}
            onSubmit={enableBeta}
          >
            <div>
              <h2 style={{ fontSize: "1.25rem" }}>
                Local invite compatibility
              </h2>
              <p>
                This path exists for operator-controlled local testing. It is
                not a public sign-up flow and is not shown when hosted Supabase
                access is configured.
              </p>
            </div>
            <div className="field">
              <label htmlFor="beta-invite">Operator invitation</label>
              <input
                id="beta-invite"
                type="password"
                value={invite}
                onChange={(event) => setInvite(event.target.value)}
                autoComplete="one-time-code"
                required
              />
            </div>
            <label className="cluster">
              <input
                type="checkbox"
                checked={localTermsChecked}
                onChange={(event) => setLocalTermsChecked(event.target.checked)}
              />{" "}
              I accept the current{" "}
              <a href="/terms" target="_blank" rel="noreferrer">
                public-scan terms
              </a>
              .
            </label>
            {inviteError && (
              <p role="alert" className="error-copy">
                {inviteError}
              </p>
            )}
            <div>
              <button className="button" type="submit">
                Enable local scan session
              </button>
            </div>
          </form>
        )}
        {session?.active && !session.termsAccepted && supabaseEnabled && (
          <form
            className="card stack"
            style={{ marginTop: 20 }}
            onSubmit={acceptTerms}
          >
            <div>
              <h2 style={{ fontSize: "1.25rem" }}>
                Accept the public-scan terms
              </h2>
              <p>
                Only scan websites you own or have permission to test. Scans are
                capped at 10 public HTTPS pages. Findings are automated
                evidence, not a certification or legal advice.
              </p>
            </div>
            <label className="cluster">
              <input
                type="checkbox"
                checked={termsChecked}
                onChange={(event) => setTermsChecked(event.target.checked)}
              />{" "}
              I accept the{" "}
              <a href="/terms" target="_blank" rel="noreferrer">
                Terms of Service
              </a>
              ,{" "}
              <a href="/acceptable-use" target="_blank" rel="noreferrer">
                Acceptable Use Policy
              </a>
              , and{" "}
              <a href="/privacy" target="_blank" rel="noreferrer">
                Privacy Notice
              </a>
              .
            </label>
            {termsMessage && (
              <p role="alert" className="error-copy">
                {termsMessage}
              </p>
            )}
            <div>
              <button className="button" type="submit">
                Enable scanning
              </button>
            </div>
          </form>
        )}
        {canUseBrowserFallback && (
          <form
            className="card stack"
            style={{ marginTop: 20 }}
            onSubmit={startBrowserScan}
          >
            <div>
              <h2 style={{ fontSize: "1.25rem" }}>Run a browser scan</h2>
              <p>
                This is the fallback when your browser or agent does not support
                WebMCP. It uses the identical server-authorized queue.
              </p>
            </div>
            <div className="field">
              <label htmlFor="scan-url">Public HTTPS website</label>
              <input
                id="scan-url"
                type="url"
                placeholder="https://example.com"
                value={targetUrl}
                onChange={(event) => setTargetUrl(event.target.value)}
                required
              />
              <p className="hint">
                No credentials, IP literals, private/internal hosts, fragments,
                custom ports, forms, downloads, or authenticated pages. The
                public beta allows up to 3 scans per calendar day and one
                10-page scan at a time.
              </p>
            </div>
            <label className="cluster">
              <input
                type="checkbox"
                checked={targetAuthorized}
                onChange={(event) => setTargetAuthorized(event.target.checked)}
              />{" "}
              I own this public website or am expressly authorized to test it.
            </label>
            <div>
              <button className="button" type="submit">
                Queue scan
              </button>
            </div>
            {scanMessage && (
              <p
                role="status"
                className={queuedScanId ? "muted" : "error-text"}
              >
                {scanMessage}
              </p>
            )}
            {queuedScanId && (
              <div>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => navigate(`/scans/${queuedScanId}`)}
                >
                  View queued scan
                </button>
              </div>
            )}
          </form>
        )}
        <div className="grid-3" style={{ marginTop: 20 }}>
          <article className="card">
            <h3>Registration</h3>
            <p>
              <Status value={registered ? "Active" : "Paused"} />
            </p>
            <p>
              {registered
                ? "Session verified · 4 tools registered"
                : "Feature and session checks required"}
            </p>
          </article>
          <article className="card">
            <h3>Scan limits</h3>
            <p>
              Public HTTPS only
              <br />
              Same-origin crawl · 10 pages maximum
              <br />
              Up to 3 scans per calendar day
              <br />
              No credentials, forms, or downloads
            </p>
          </article>
          <article className="card">
            <h3>Evidence boundary</h3>
            <p>
              Automated findings only
              <br />
              Source-derived details are untrusted
              <br />
              Human review remains required
            </p>
          </article>
        </div>
        <section className="section" style={{ paddingBottom: 0 }}>
          <div className="section-heading">
            <h2>Available tools</h2>
            <p>
              The browser mediates discovery and invocation. Tool descriptions
              and schemas are capabilities, not authorization grants.
            </p>
          </div>
          <div className="grid-2">
            {availableTools.map((tool) => (
              <article className="card" key={tool.name}>
                <TerminalSquare />
                <h3>
                  <code>{tool.name}</code>
                </h3>
                <p>{tool.copy}</p>
                <div className="cluster">
                  <span className="badge info">{tool.mode}</span>
                  <span className="badge warning">Live beta API</span>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="card stack" style={{ marginTop: 24 }}>
          <div className="spaced">
            <div>
              <h2 style={{ fontSize: "1.5rem" }}>Connection details</h2>
              <p>
                Use ChatGPT’s in-app browser or Chrome with WebMCP enabled. If
                tools do not register, use the browser fallback above.
              </p>
            </div>
            <div className="cluster">
              <button
                className="button secondary"
                onClick={() => {
                  void navigator.clipboard?.writeText(`${origin}/tools`);
                  setCopied(true);
                }}
              >
                <Copy size={18} /> Copy tools URL
              </button>
              {registered && (
                <button
                  className="button secondary"
                  onClick={() => {
                    void revokeBeta();
                  }}
                >
                  Revoke scan session
                </button>
              )}
            </div>
          </div>
          <code className="code">{`Mode: same-origin WebMCP scan adapter\nOrigin: ${origin}\nAuthorization: server-issued scan session\nStatus: ${registered ? "4 tools registered" : registrationStatus}`}</code>
          {revokeError && (
            <p role="alert" className="error-copy">
              {revokeError}
            </p>
          )}
        </section>
        {copied && (
          <Toast onClose={() => setCopied(false)}>Tools URL copied.</Toast>
        )}
      </div>
    </section>
  );
}
function Toast({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="toast" role="status">
      <div className="spaced">
        <span>{children}</span>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Dismiss message"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}

function OnboardingPage({
  profile,
  onComplete,
}: {
  profile: WorkspaceProfile;
  onComplete: (profile: WorkspaceProfile) => void;
}) {
  const [displayName, setDisplayName] = useState(profile.displayName || "");
  const [workspaceName, setWorkspaceName] = useState(profile.workspaceName || "");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    setSaving(true);
    try {
      const next = await saveWorkspaceProfile({ displayName, workspaceName, completeOnboarding: true });
      if (!next) throw new Error("Your workspace profile could not be loaded.");
      onComplete(next);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Your workspace could not be saved.");
    } finally {
      setSaving(false);
    }
  };
  return <section className="onboarding-page"><div className="onboarding-card stack"><span className="eyebrow">Workspace setup</span><h1>Make this workspace yours.</h1><p>These details label your personal easyACR workspace. You can change them later in Account.</p><form className="stack" onSubmit={(event) => void submit(event)}><div className="field"><label htmlFor="display-name">Your name</label><input id="display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" maxLength={120} required /></div><div className="field"><label htmlFor="workspace-name">Workspace name</label><input id="workspace-name" value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} maxLength={120} required /></div><div className="callout warning"><strong>Public-scan beta</strong><p>Only scan public HTTPS sites that you own or are authorized to test. Automated results require human review.</p></div>{message && <p role="alert" className="error-text">{message}</p>}<div><button className="button" type="submit" disabled={saving}>{saving ? "Saving workspace…" : "Open dashboard"} <ArrowRight size={18} /></button></div></form></div></section>;
}
function AccountPage({
  navigate,
  onSessionChange,
  onSignOut,
  workspaceProfile,
  onProfileChange,
}: {
  navigate: Navigate;
  onSessionChange: (session: WebMcpSession) => void;
  onSignOut: () => Promise<void>;
  workspaceProfile: WorkspaceProfile | null;
  onProfileChange: (profile: WorkspaceProfile) => void;
}) {
  const [session, setSession] = useState<WebMcpSession | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [displayName, setDisplayName] = useState(workspaceProfile?.displayName || "");
  const [workspaceName, setWorkspaceName] = useState(workspaceProfile?.workspaceName || "");
  const [savingProfile, setSavingProfile] = useState(false);
  useEffect(() => {
    setDisplayName(workspaceProfile?.displayName || "");
    setWorkspaceName(workspaceProfile?.workspaceName || "");
  }, [workspaceProfile]);
  useEffect(() => {
    let active = true;
    void Promise.all([
      getEasyAcrSession(),
      supabaseEnabled ? getSupabaseAccountEmail() : Promise.resolve(null),
    ])
      .then(([nextSession, nextEmail]) => {
        if (!active) return;
        setSession(nextSession);
        setEmail(nextEmail);
        onSessionChange(nextSession);
      })
      .catch(() => {
        if (active) setMessage("We could not load your account right now. Refresh and try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [onSessionChange]);
  const signOut = async () => {
    setMessage("");
    try {
      await onSignOut();
      setSession({ active: false, webMcpEnabled: false, termsAccepted: false });
      setEmail(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not sign you out. Refresh and try again.");
    }
  };
  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    setSavingProfile(true);
    try {
      const next = await saveWorkspaceProfile({ displayName, workspaceName });
      if (!next) throw new Error("Your workspace profile could not be loaded.");
      onProfileChange(next);
      setMessage("Your workspace details were saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Your workspace details could not be saved.");
    } finally {
      setSavingProfile(false);
    }
  };
  return (
    <section className="section">
      <div className="container stack">
        <PageHeading eyebrow="Personal workspace" title="Account" copy="Manage your signed-in scan session and review your access." />
        {loading ? (
          <div className="card"><p>Loading your account…</p></div>
        ) : session?.active ? (
          <div className="card stack">
            <div>
              <span className="eyebrow">Signed in</span>
              <h2>{email || "Your easyACR account"}</h2>
              <p>Your personal workspace is active for public accessibility scans.</p>
              {session.expiresAt && <p className="muted">Session expires {new Date(session.expiresAt).toLocaleString()}.</p>}
            </div>
            <div className="callout success">
              <strong>{session.termsAccepted ? "Public-scan terms accepted" : "Terms acceptance required"}</strong>
              <p>{session.termsAccepted ? "Your WebMCP tools and browser scan form can be used for authorized public HTTPS targets." : "Accept the current public-scan terms in Tools before starting a scan."}</p>
            </div>
            {workspaceProfile && <form className="card-flat stack" onSubmit={(event) => void saveProfile(event)}>
              <h3>Workspace details</h3>
              <div className="grid-2">
                <div className="field"><label htmlFor="account-display-name">Your name</label><input id="account-display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" maxLength={120} required /></div>
                <div className="field"><label htmlFor="account-workspace-name">Workspace name</label><input id="account-workspace-name" value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} maxLength={120} required /></div>
              </div>
              <div><button className="button secondary" type="submit" disabled={savingProfile}>{savingProfile ? "Saving…" : "Save workspace details"}</button></div>
            </form>}
            <div className="cluster">
              <button className="button" onClick={() => navigate("/scans")}>View scan history</button>
              <button className="button secondary" onClick={() => navigate("/tools")}>Open tools</button>
              <button className="text-link" onClick={() => void signOut()}>Sign out</button>
            </div>
          </div>
        ) : (
          <div className="card stack">
            <span className="eyebrow">Not signed in</span>
            <h2>Access your personal workspace</h2>
            <p>Use your work email to receive a magic link. Your scan history and terms acceptance stay connected to that account.</p>
            <div><button className="button" onClick={() => navigate("/tools")}>Create or sign in</button></div>
          </div>
        )}
        {message && <div className="callout warning"><p>{message}</p></div>}
      </div>
    </section>
  );
}

function UnavailablePage({
  navigate,
  title = "Page unavailable",
  copy = "This route is not part of the public beta. Use Tools to start an authorized public-site scan.",
  action,
}: {
  navigate: Navigate;
  title?: string;
  copy?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card upgrade-panel stack">
      <AlertCircle size={48} />
      <span className="eyebrow">Public beta</span>
      <h1>{title}</h1>
      <p>{copy}</p>
      <div className="cluster" style={{ justifyContent: "center" }}>
        {action}
        <button className="button" onClick={() => navigate("/tools")}>
          Open tools
        </button>
        <button className="button secondary" onClick={() => navigate("/")}>
          Home
        </button>
      </div>
    </div>
  );
}
function App() {
  const { path, navigate } = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">(
    () =>
      (localStorage.getItem("easyacr-theme") as "light" | "dark") ||
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
  );
  const [webMcpRegistrationStatus, setWebMcpRegistrationStatus] =
    useState<WebMcpUiStatus>("disabled");
  const [accountSession, setAccountSession] = useState<WebMcpSession | null>(null);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [workspaceProfile, setWorkspaceProfile] = useState<WorkspaceProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("easyacr-theme", theme);
  }, [theme]);
  useEffect(() => {
    let active = true;
    void getEasyAcrSession()
      .then((session) => {
        if (!active) return;
        setAccountSession(session);
        if (session.active && supabaseEnabled) {
          void getSupabaseAccountEmail()
            .then((email) => { if (active) setAccountEmail(email); })
            .catch(() => { if (active) setAccountEmail(null); });
        } else {
          setAccountEmail(null);
        }
      })
      .catch(() => {
        if (active) {
          setAccountSession(null);
          setAccountEmail(null);
        }
      });
    return () => {
      active = false;
    };
  }, [path]);
  useEffect(() => {
    if (!accountSession?.active || !accountSession.termsAccepted || !supabaseEnabled) {
      setWorkspaceProfile(null);
      setProfileLoading(false);
      return;
    }
    let active = true;
    setProfileLoading(true);
    void getWorkspaceProfile()
      .then((profile) => { if (active) setWorkspaceProfile(profile); })
      .catch(() => { if (active) setWorkspaceProfile(null); })
      .finally(() => { if (active) setProfileLoading(false); });
    return () => { active = false; };
  }, [accountSession?.active, accountSession?.termsAccepted]);
  const signOut = useCallback(async () => {
    const session = await getEasyAcrSession();
    if (session.active && session.csrfToken) {
      const response = await fetch("/api/v1/session/revoke", {
        method: "POST",
        credentials: "same-origin",
        headers: { "x-csrf-token": session.csrfToken },
      });
      if (!response.ok) throw new Error(await errorMessage(response, "Could not sign you out."));
    }
    await signOutOfSupabase();
    setAccountSession(null);
    setAccountEmail(null);
    setWorkspaceProfile(null);
    navigate("/account");
  }, [navigate]);
  useEffect(() => {
    if (path !== "/tools") {
      setWebMcpRegistrationStatus("disabled");
      return;
    }
    const registration = new AbortController();
    let active = true;
    setWebMcpRegistrationStatus("registering");
    void getWebMcpSession(registration.signal)
      .then(() => registerEasyAcrWebMcpTools(document, registration))
      .then((status) => {
        if (active) setWebMcpRegistrationStatus(status);
      })
      .catch((error) => {
        if (!active) return;
        setWebMcpRegistrationStatus(
          error instanceof Error && error.message.includes("Accept the scan terms")
            ? "disabled"
            : "failed",
        );
      });
    return () => {
      active = false;
      registration.abort(
        new DOMException("WebMCP registration revoked.", "AbortError"),
      );
    };
  }, [path]);
  const scanId = path.startsWith("/scans/") ? path.slice("/scans/".length) : "";
  const isScanRoute =
    /^scan_[0-9a-f-]+$/i.test(scanId) || /^[0-9a-f-]{36}$/i.test(scanId);
  const authenticatedProduct = Boolean(accountSession?.active && accountSession.termsAccepted);
  const onboardingRequired = Boolean(authenticatedProduct && supabaseEnabled && workspaceProfile && !workspaceProfile.onboardingCompletedAt);
  const page =
    onboardingRequired ? (
      <OnboardingPage profile={workspaceProfile!} onComplete={setWorkspaceProfile} />
    ) : path === "/dashboard" && authenticatedProduct ? (
      <DashboardPage navigate={navigate} />
    ) : path === "/" && authenticatedProduct ? (
      <DashboardPage navigate={navigate} />
    ) : path === "/" ? (
      <Home navigate={navigate} />
    ) : path === "/tools" ? (
      <ToolsPage
        registrationStatus={webMcpRegistrationStatus}
        navigate={navigate}
        onSessionChange={setAccountSession}
      />
    ) : path === "/scans" ? (
      <ScansPage navigate={navigate} />
    ) : isScanRoute ? (
      <LiveScanDetail navigate={navigate} scanId={scanId} />
    ) : path === "/account" ? (
      <AccountPage navigate={navigate} onSessionChange={setAccountSession} onSignOut={signOut} workspaceProfile={workspaceProfile} onProfileChange={setWorkspaceProfile} />
    ) : path === "/terms" ||
      path === "/privacy" ||
      path === "/acceptable-use" ? (
      <LegalPage
        kind={path.slice(1) as "terms" | "privacy" | "acceptable-use"}
      />
    ) : (
      <section className="section">
        <div className="container">
          <UnavailablePage navigate={navigate} />
        </div>
      </section>
    );
  const shellProps = {
    path,
    navigate,
    theme,
    setTheme,
    accountEmail,
    workspaceName: workspaceProfile?.workspaceName ?? null,
  };
  if (authenticatedProduct) {
    return <AuthenticatedShell {...shellProps}>{profileLoading ? <div className="card"><p>Preparing your workspace…</p></div> : page}</AuthenticatedShell>;
  }
  return (
    <PublicShell
      path={path}
      navigate={navigate}
      theme={theme}
      setTheme={setTheme}
      signedIn={Boolean(accountSession?.active)}
      accountEmail={accountEmail}
      onSignOut={signOut}
    >
      {page}
    </PublicShell>
  );
}
export default App;
