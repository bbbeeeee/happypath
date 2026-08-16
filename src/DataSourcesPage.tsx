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
  { label: "Get where you’re going", evidence: "Walkable streets, distance, and travel time", boundary: "Used for every route", role: "route", icon: RouteIcon },
  { label: "Avoid mapped stairs", evidence: "Stairs marked in OpenStreetMap", boundary: "Other barriers may not be mapped", role: "route", icon: StairsIcon },
  { label: "Stay out of direct sun", evidence: "Buildings and estimated shade by hour", boundary: "Shows sun exposure, not heat", role: "route", icon: SunIcon },
  { label: "Walk on greener streets", evidence: "Nearby trees and park edges", boundary: "Shows what is nearby, not canopy coverage", role: "route", icon: LeafIcon },
  { label: "Plan for seating, water, or restrooms", evidence: "City listings for public amenities", boundary: "Some may be closed or unavailable", role: "route", icon: BenchIcon },
  { label: "Connect to the subway", evidence: "Mapped subway entrances and exits", boundary: "Check live service and elevator status", role: "route", icon: TrainIcon },
  { label: "Look for rain cover", evidence: "Covered walkways mapped in OpenStreetMap", boundary: "Unmapped cover may exist", role: "route", icon: UmbrellaIcon },
  { label: "Check long-term flood risk", evidence: "DEP’s 2050 stormwater model", boundary: "Planning context only—not current flooding", role: "context", icon: CloudRainIcon },
  { label: "Plan for heat and weather", evidence: "NWS forecast and hourly shade estimates", boundary: "Representative weather—not block temperature", role: "context", icon: SunIcon },
  { label: "See mobility evidence", evidence: "Ramp corners, crossing signals, phases, and elevators", boundary: "Records do not certify a continuous path", role: "context", icon: StairsIcon },
  { label: "Find a place to cool down", evidence: "NYC Cool Options finder feed", boundary: "Verify activation, hours, and access", role: "context", icon: DropletIcon },
];

const gaps = [
  { title: "Continuous step-free routes", copy: "The map now connects ramp, signal, crossing-phase, elevator, and obstruction records as visible evidence. Sidewalk-side and crossing-arm topology are still needed to expose unknown gaps without certifying accessibility." },
  { title: "Street-level heat", copy: "The NWS forecast adds current representative weather while shade stays separate. Hyperlocal thermal observations and heat-vulnerability context still need careful spatial joins." },
  { title: "Rain and flooding", copy: "Add forecasts and official alerts alongside the long-term flood map, so people can check conditions before leaving." },
  { title: "Live transit access", copy: "Join the mapped elevator inventory to minute-level outage and service feeds, then resolve the ordered street-to-platform path." },
  { title: "Clear width and grade", copy: "Sidewalk polygons do not provide unobstructed clear width, and terrain elevation cannot establish cross-slope. Both need a sidewalk-side network and defensible field evidence." },
  { title: "Street safety and comfort", copy: "Add lighting, crash risk, sidewalk conditions, air quality, noise, crowds, cooling spots, and waterfront access." },
] as const;

const roleLabels: Record<DataSourceProductRole, string> = {
  route: "Can shape routes",
  context: "For context",
  lookup: "Finds locations",
  future: "Future addition",
};

function BrandLink() {
  return <a className="datasources-brand" href="/" aria-label="Footnote home"><span><strong>Footnote<sup>1</sup></strong><small>Data sources</small></span></a>;
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
          <p><strong>What to know</strong>{source.presentation.claimBoundary}</p>
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
        <span className="eyebrow">Why these data sources matter</span>
        <h1>Plan around more than distance.</h1>
        <p>Footnote uses city and map data to help people avoid mapped stairs, find shade and greener streets, plan for restrooms or seating, connect to transit, and check rain or flood context—not just take the shortest path.</p>
        <div className="datasources-scope"><span>Available now</span><strong>Manhattan · Battery to 60th Street</strong></div>
      </div>

      <div className="source-stack-visual" aria-label={`${summary.total} data sources and methods`}>
        <div className="source-stack-route"><span className="route-node" /><i /><i /><i /><i /><span className="route-node route-node-end" /></div>
        <div className="source-stack-layer layer-streets"><span>Access</span><small>ramps · signals · lifts</small></div>
        <div className="source-stack-layer layer-climate"><span>Comfort</span><small>weather · shade · flood</small></div>
        <div className="source-stack-layer layer-nature"><span>Enjoyment</span><small>trees · parks</small></div>
        <div className="source-stack-layer layer-people"><span>Daily needs</span><small>rest · water · transit · cooling</small></div>
      </div>

      <div className="source-counts" aria-label="Source audit summary">
        <div><strong>{summary.total}</strong><span>data sources<br />and methods</span></div>
        <div><strong>{summary.current}</strong><span>sources used<br />now</span></div>
        <div><strong>{summary.derived}</strong><span>Footnote<br />estimates</span></div>
        <div><strong>{summary.future}</strong><span>sources for<br />later</span></div>
      </div>
      <div className="source-count-bar" aria-hidden="true"><span className="count-current" /><span className="count-derived" /><span className="count-future" /></div>
    </section>

    <section className="datasources-section human-evidence-section">
      <header className="section-heading"><span className="eyebrow">What Footnote helps with</span><h2>Choose a walk that works better for you</h2><p>Each source supports a real need. The label shows whether it can change your route today or only add context.</p></header>
      <div className="human-evidence-matrix" role="table" aria-label="Human needs and available evidence">
        <div className="matrix-head" role="row"><span role="columnheader">What you need</span><span role="columnheader">What we use</span><span role="columnheader">How it helps</span></div>
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
      <header className="section-heading"><span className="eyebrow">How it works</span><h2>From city data to a route</h2><p>We only use data that can support a route choice. When the data does not tell us something, we say so.</p></header>
      <div className="method-flow" aria-label="Data processing flow">
        <article><span>01</span><strong>Collect</strong><p>Gather City and MTA data, OpenStreetMap, and the address you enter.</p></article>
        <i aria-hidden="true" />
        <article><span>02</span><strong>Connect</strong><p>Match shade, greenery, amenities, and other useful information to walkable streets.</p></article>
        <i aria-hidden="true" />
        <article><span>03</span><strong>Plan &amp; explain</strong><p>Compare valid routes, follow your preferences, and show what shaped the result.</p></article>
      </div>
      <aside className="method-note"><strong>AI helps understand what you ask for. The route itself is calculated from the map and source data.</strong><span>It cannot make up streets, distances, accessibility details, or other city facts.</span></aside>
    </section>

    <section className="datasources-section all-sources-section">
      <header className="section-heading"><span className="eyebrow">Sources in use</span><h2>Where the route data comes from</h2><p>Open any source to see where it covers, when it was updated, and what it cannot tell us.</p></header>
      <SourceLedger title="City and open data" description="Public sources we use to plan routes, find places, or add helpful map context." sources={currentSources} />
      <SourceLedger title="Footnote calculations" description="Estimates we calculate from source data, such as shade and greenery. They describe the map, not current street conditions." sources={derivedSources} />

      <div className="supporting-services">
        <header><span className="eyebrow">Supporting services</span><h3>Other tools we use</h3></header>
        <a href="https://carto.com/basemaps" target="_blank" rel="noreferrer"><span><strong>CARTO Positron</strong><small>Provides the background map. It does not choose the route.</small></span><ExternalLinkIcon /></a>
        <a href="https://openrouter.ai/" target="_blank" rel="noreferrer"><span><strong>OpenRouter</strong><small>Helps understand a written request. It does not create the route or city facts.</small></span><ExternalLinkIcon /></a>
      </div>
    </section>

    <section className="datasources-future">
      <div className="future-intro"><span className="eyebrow">Future additions</span><h2>More needs Footnote could plan for</h2><p>There are many useful city datasets we have not added yet. Adding them could help more people plan around accessibility, safety, comfort, and enjoyment as conditions change.</p></div>
      <div className="future-gaps">
        {gaps.map((gap, index) => <article key={gap.title}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{gap.title}</h3><p>{gap.copy}</p></div></article>)}
      </div>
      <SourceLedger title="Datasets we’re considering" description="We have reviewed these City sources, but they do not affect routes yet." sources={futureSources} />
      <footer className="datasources-footer"><span><DropletIcon />Data does not update in real time.</span><p>Check current conditions before you go. A dataset or model cannot guarantee that a place is open, comfortable, accessible, or safe.</p><a href="/">Plan another walk <RouteIcon /></a></footer>
    </section>
  </main>;
}
