import type { ComponentType, SVGProps } from "react";
import {
  BenchIcon,
  ChevronIcon,
  CloudRainIcon,
  DropletIcon,
  ExternalLinkIcon,
  LeafIcon,
  RouteIcon,
  StairsIcon,
  SunIcon,
  TrainIcon,
  UmbrellaIcon,
} from "./components/Icons";
import {
  dataSourceAuditSummary,
  listAuditedDataSources,
  type AuditedDataSource,
  type DataSourceProductRole,
} from "./data/dataSourceAudit";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const humanNeeds: readonly {
  label: string;
  evidence: string;
  boundary: string;
  role: DataSourceProductRole;
  icon: IconComponent;
}[] = [
  { label: "Move through the city", evidence: "Pedestrian streets, distance, and time", boundary: "The base for every route", role: "route", icon: RouteIcon },
  { label: "Avoid mapped stairs", evidence: "Community-mapped step segments", boundary: "Not a verified step-free journey", role: "route", icon: StairsIcon },
  { label: "Find shade, reduce sun", evidence: "Buildings + hourly shadow model", boundary: "Sun exposure, not temperature", role: "route", icon: SunIcon },
  { label: "Choose greener streets", evidence: "Trees + park-edge proximity", boundary: "A proximity signal, not measured canopy", role: "route", icon: LeafIcon },
  { label: "Rest, refill, or find a restroom", evidence: "Official amenity inventories", boundary: "Current operation may differ", role: "route", icon: BenchIcon },
  { label: "Finish near transportation", evidence: "Mapped subway entrances and exits", boundary: "No live service or elevator state", role: "route", icon: TrainIcon },
  { label: "Find cover from rain", evidence: "Explicit covered paths + nearby records", boundary: "Only mapped path geometry shapes routes", role: "route", icon: UmbrellaIcon },
  { label: "Understand flood potential", evidence: "DEP 2050 stormwater scenario", boundary: "Planning context, never live route safety", role: "context", icon: CloudRainIcon },
  { label: "Understand heat & temperature", evidence: "Shade is the proxy available today", boundary: "Weather and thermal data are still a gap", role: "future", icon: SunIcon },
];

const gaps = [
  { title: "Verified step-free movement", copy: "Connect audited curb ramps, crossing signals, sidewalk slope and width, elevators, and temporary obstructions into a continuous network." },
  { title: "Heat and weather now", copy: "Add temperature, humidity, heat index, cloud, and street-level thermal observations. Shade should stay distinct from measured heat." },
  { title: "Live rain and flooding", copy: "Pair forecasts and official alerts with trusted current-condition reporting while keeping the 2050 planning model separate." },
  { title: "Live transportation", copy: "Bring in service changes, elevator and escalator outages, entrance state, and verified accessibility—not just static entrance points." },
  { title: "Real entrances and operating state", copy: "Resolve walking-network access to parks, POPS, amenities, and transit, then verify hours, closures, and current operation." },
  { title: "More of what people feel", copy: "Explore air quality, noise, crowding, lighting, sidewalk condition, cooling infrastructure, waterfront access, and time-bounded public life." },
] as const;

const roleLabels: Record<DataSourceProductRole, string> = {
  route: "Shapes routes",
  context: "Context only",
  lookup: "Finds places",
  future: "On our radar",
};

function BrandLink() {
  return <a className="datasources-brand" href="/" aria-label="Happy Path home"><span className="brand-mark"><span /></span><span><strong>Happy Path</strong><small>Data sources</small></span></a>;
}

function RolePill({ role }: { role: DataSourceProductRole }) {
  return <span className={`source-role source-role-${role}`}>{roleLabels[role]}</span>;
}

function SourceLedger({ title, description, sources }: { title: string; description: string; sources: readonly AuditedDataSource[] }) {
  return <section className="source-ledger-group">
    <header><div><span className="eyebrow">{sources.length} {sources.length === 1 ? "source" : "sources"}</span><h3>{title}</h3></div><p>{description}</p></header>
    <div className="source-ledger">
      {sources.map((source) => <details className="source-ledger-row" key={source.id}>
        <summary>
          <span className="source-ledger-main"><strong>{source.presentation.title}</strong><small>{source.registry.publisher}</small></span>
          <span className="source-ledger-use">{source.contribution}</span>
          <RolePill role={source.productRole} />
          <ChevronIcon />
        </summary>
        <div className="source-ledger-detail">
          <p><strong>Coverage</strong>{source.presentation.coverageLabel}</p>
          <p><strong>Freshness</strong>{source.presentation.freshnessLabel}</p>
          <p><strong>Boundary</strong>{source.presentation.claimBoundary}</p>
          <a href={source.presentation.officialUrl} target="_blank" rel="noreferrer">Open source <ExternalLinkIcon /></a>
        </div>
      </details>)}
    </div>
  </section>;
}

export function DataSourcesPage() {
  const sources = listAuditedDataSources();
  const summary = dataSourceAuditSummary();
  const currentSources = sources.filter((source) => source.group === "current");
  const derivedSources = sources.filter((source) => source.group === "derived");
  const futureSources = sources.filter((source) => source.group === "future");

  return <main className="datasources-page">
    <nav className="datasources-nav" aria-label="Primary navigation">
      <BrandLink />
      <div><span aria-current="page">Data sources</span><a href="/">Plan a walk <RouteIcon /></a></div>
    </nav>

    <section className="datasources-hero">
      <div className="datasources-hero-copy">
        <span className="eyebrow">The evidence behind Happy Path</span>
        <h1>A city, read in layers.</h1>
        <p>Happy Path combines streets, buildings, trees, public amenities, transit, and climate context to route around what matters to a person—not just what is shortest.</p>
        <div className="datasources-scope"><span>Current pilot</span><strong>Manhattan · Battery to 60th Street</strong></div>
      </div>

      <div className="source-stack-visual" aria-label={`${summary.total} registered sources and methods`}>
        <div className="source-stack-route"><span className="route-node" /><i /><i /><i /><i /><span className="route-node route-node-end" /></div>
        <div className="source-stack-layer layer-streets"><span>Streets</span><small>walk · stairs · cover</small></div>
        <div className="source-stack-layer layer-climate"><span>Climate</span><small>shade · flood context</small></div>
        <div className="source-stack-layer layer-nature"><span>Nature</span><small>trees · parks</small></div>
        <div className="source-stack-layer layer-people"><span>Human needs</span><small>rest · water · transit</small></div>
      </div>

      <div className="source-counts" aria-label="Source audit summary">
        <div><strong>{summary.total}</strong><span>registered sources<br />and methods</span></div>
        <div><strong>{summary.current}</strong><span>active upstream<br />inputs</span></div>
        <div><strong>{summary.derived}</strong><span>derived by<br />Happy Path</span></div>
        <div><strong>{summary.future}</strong><span>cataloged next<br />integrations</span></div>
      </div>
      <div className="source-count-bar" aria-hidden="true"><span className="count-current" /><span className="count-derived" /><span className="count-future" /></div>
    </section>

    <section className="datasources-section human-evidence-section">
      <header className="section-heading"><span className="eyebrow">Human-scale routing</span><h2>What the data helps us see</h2><p>Each layer answers a different human question. The label at right shows whether it can change a route today.</p></header>
      <div className="human-evidence-matrix" role="table" aria-label="Human needs and available evidence">
        <div className="matrix-head" role="row"><span role="columnheader">Human need</span><span role="columnheader">Evidence today</span><span role="columnheader">Role</span></div>
        {humanNeeds.map((need) => {
          const NeedIcon = need.icon;
          return <div className="matrix-row" role="row" key={need.label}>
            <span className="matrix-need" role="cell"><i><NeedIcon /></i><strong>{need.label}</strong></span>
            <span className="matrix-evidence" role="cell"><strong>{need.evidence}</strong><small>{need.boundary}</small></span>
            <span role="cell"><RolePill role={need.role} /></span>
          </div>;
        })}
      </div>
    </section>

    <section className="datasources-section method-section">
      <header className="section-heading"><span className="eyebrow">From record to route</span><h2>Public data in. Inspectable choices out.</h2><p>Only bounded, route-ready evidence is allowed to influence the path. Missing data stays unknown—it never becomes a favorable score.</p></header>
      <div className="method-flow" aria-label="Data processing flow">
        <article><span>01</span><strong>Collect</strong><p>Official City and MTA records, OpenStreetMap, and explicit address lookup.</p></article>
        <i aria-hidden="true" />
        <article><span>02</span><strong>Connect</strong><p>Normalize geometry, attach evidence to walkable edges, and derive shade or greenery.</p></article>
        <i aria-hidden="true" />
        <article><span>03</span><strong>Route &amp; explain</strong><p>Honor hard constraints, rank valid choices, and keep source boundaries visible.</p></article>
      </div>
      <aside className="method-note"><strong>AI interprets the request. Deterministic code computes the path.</strong><span>The language layer cannot invent geometry, city facts, route distance, or accessibility evidence.</span></aside>
    </section>

    <section className="datasources-section all-sources-section">
      <header className="section-heading"><span className="eyebrow">Full audit</span><h2>Every source we use today</h2><p>The ledger distinguishes upstream evidence from Happy Path’s own derived signals. Open any row for coverage, freshness, and the most important claim boundary.</p></header>
      <SourceLedger title="Active upstream inputs" description="Official or open records used in the walking experience—some shape routes; others remain map context or address lookup." sources={currentSources} />
      <SourceLedger title="Derived by Happy Path" description="Transparent calculations and demo fixtures built from upstream evidence. These are methods, not independent observations of the street." sources={derivedSources} />

      <div className="supporting-services">
        <header><span className="eyebrow">Not counted as route evidence</span><h3>Supporting services</h3></header>
        <a href="https://carto.com/basemaps" target="_blank" rel="noreferrer"><span><strong>CARTO Positron</strong><small>Visual basemap tiles only. It does not determine the route.</small></span><ExternalLinkIcon /></a>
        <a href="https://openrouter.ai/" target="_blank" rel="noreferrer"><span><strong>OpenRouter</strong><small>Optional request interpretation. It cannot create geometry or route facts.</small></span><ExternalLinkIcon /></a>
      </div>
    </section>

    <section className="datasources-future">
      <div className="future-intro"><span className="eyebrow">Where the map grows next</span><h2>Useful gaps, honestly named.</h2><p>The breadth is real, but so are the limits. The next integrations focus on continuity, freshness, and conditions that people actually feel.</p></div>
      <div className="future-gaps">
        {gaps.map((gap, index) => <article key={gap.title}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{gap.title}</h3><p>{gap.copy}</p></div></article>)}
      </div>
      <SourceLedger title="Already cataloged for next" description="These official sources are registered and researched, but they do not calculate today’s routes." sources={futureSources} />
      <footer className="datasources-footer"><span><DropletIcon />Evidence is refreshed deliberately, not continuously.</span><p>An inventory or model can guide a route without guaranteeing current street conditions, access, comfort, or safety.</p><a href="/">Return to Happy Path <RouteIcon /></a></footer>
    </section>
  </main>;
}
