import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent } from "maplibre-gl";
import { defaultDestination, defaultOrigin, isInsidePilot, nearestGraphNode, pilotGraph } from "./data/cityGraph";
import { findCivicAssetsNearRoute, loadCivicAssetFixture, type CivicAsset, type CivicAssetKind } from "./data/civicAssets";
import { getPilotTransitEndpointCandidates } from "./data/transitEndpoints";
import { buildShadeDetourScenario, type ShadeDetourScenario } from "./detour/shadeScenario";
import { searchNycAddress } from "./geocoding";
import { briefSummary, DEFAULT_BRIEF, mergeTripBrief, type RoutePriority, type TripBrief as UiTripBrief } from "./planning/tripBrief";
import { interpretTripBrief } from "./planning/interpretTripBrief";
import { JourneyPlanningError, planJourney } from "./routing/journey";
import type { Coordinate, JourneyResult, JourneyRoute, TripBrief as RoutingTripBrief } from "./types";
import {
  ArrowIcon,
  BackIcon,
  BenchIcon,
  ChevronIcon,
  ClockIcon,
  CloseIcon,
  DropletIcon,
  LayersIcon,
  LeafIcon,
  LocateIcon,
  RestroomIcon,
  SparkIcon,
  StairsIcon,
  SunIcon,
  TrainIcon,
} from "./components/Icons";

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const nodeById = new Map(pilotGraph.nodes.map((node) => [node.id, node]));
const shadowModules = import.meta.glob("./data/shadows/hour-*.json");
const civicFixture = loadCivicAssetFixture();
const transitEndpoints = getPilotTransitEndpointCandidates({ maxSnapDistanceMeters: 50 });
const allMapAssets = [...civicFixture.assets, ...transitEndpoints.map((candidate) => candidate.asset)];

const SUGGESTIONS = [
  "Less direct sun to Washington Square Park. I can add five minutes.",
  "A green 20-minute loop with places to sit.",
  "Wander north for 25 minutes and end near transit.",
];

const PRIORITY_META: Record<RoutePriority, { label: string; icon: typeof SunIcon }> = {
  shade: { label: "Less direct sun", icon: SunIcon },
  greenery: { label: "Greener", icon: LeafIcon },
  rest: { label: "Places to rest", icon: BenchIcon },
  water: { label: "Water nearby", icon: DropletIcon },
  restroom: { label: "Restroom", icon: RestroomIcon },
  construction: { label: "Less construction", icon: SparkIcon },
};

function formatMinutes(value: number) {
  return `${Math.round(value)} min`;
}

function formatClock(hour: number) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 || 12;
  return `${display}:00 ${suffix}`;
}

function routeGeoJSON(route?: JourneyRoute | null) {
  return {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "LineString" as const, coordinates: route?.coordinates ?? [] },
  };
}

function endpointsGeoJSON(route?: JourneyRoute | null) {
  const coordinates = route?.coordinates ?? [];
  return {
    type: "FeatureCollection" as const,
    features: coordinates.length < 2 ? [] : [
      { type: "Feature" as const, properties: { kind: "origin" }, geometry: { type: "Point" as const, coordinates: coordinates[0] } },
      { type: "Feature" as const, properties: { kind: "destination" }, geometry: { type: "Point" as const, coordinates: coordinates.at(-1)! } },
    ],
  };
}

function assetsGeoJSON(assets: CivicAsset[]) {
  return {
    type: "FeatureCollection" as const,
    features: assets.map((asset) => ({
      type: "Feature" as const,
      properties: { id: asset.id, kind: asset.kind, name: asset.name },
      geometry: { type: "Point" as const, coordinates: asset.coordinate },
    })),
  };
}

function boundsForRoute(route: JourneyRoute) {
  const bounds = new maplibregl.LngLatBounds(route.coordinates[0], route.coordinates[0]);
  route.coordinates.forEach((coordinate) => bounds.extend(coordinate));
  return bounds;
}

function routePriorityKinds(priorities: RoutePriority[]) {
  const kinds: CivicAssetKind[] = [];
  if (priorities.includes("rest")) kinds.push("seating");
  if (priorities.includes("restroom")) kinds.push("restroom");
  if (priorities.includes("water")) kinds.push("drinking_fountain");
  return kinds;
}

function relevantAssets(route: JourneyRoute, brief: UiTripBrief) {
  const kinds = routePriorityKinds(brief.priorities);
  const nearby = kinds.length === 0 ? [] : findCivicAssetsNearRoute(route.coordinates, { kinds, maxDistanceMeters: 90, limit: 8 }).map((item) => item.asset);
  if (brief.endCondition !== "transit") return nearby;
  const endpoint = transitEndpoints.find((candidate) => candidate.graphNodeId === route.endpointNodeId)?.asset;
  return endpoint ? [endpoint, ...nearby.filter((asset) => asset.id !== endpoint.id)] : nearby;
}

function amenityCount(route: JourneyRoute, priorities: RoutePriority[]) {
  const kinds = routePriorityKinds(priorities);
  return kinds.length === 0 ? 0 : findCivicAssetsNearRoute(route.coordinates, { kinds, maxDistanceMeters: 90, limit: 8 }).length;
}

function pickAmenityAwareRoute(result: JourneyResult, priorities: RoutePriority[]) {
  if (routePriorityKinds(priorities).length === 0) return result.recommended;
  const candidates = [result.recommended, ...result.alternatives];
  return [...candidates].sort((a: JourneyRoute, b: JourneyRoute) => amenityCount(b, priorities) - amenityCount(a, priorities) || b.preferenceScore - a.preferenceScore)[0];
}

function makeRoutingBrief(brief: UiTripBrief, originNodeId: string, destinationNodeId: string): RoutingTripBrief {
  const preferences = [
    ...(brief.priorities.includes("shade") ? [{ featureId: "shade" as const, weight: 1 }] : []),
    ...(brief.priorities.includes("greenery") ? [{ featureId: "green" as const, weight: 1 }] : []),
  ];
  const common = {
    originNodeId,
    departureHour: brief.departureHour,
    preferences,
    requirements: { avoidMappedSteps: brief.avoidMappedSteps },
  };
  if (brief.shape === "destination") {
    return { ...common, journeyShape: "destination", destinationNodeId, detourAllowanceMinutes: brief.detourMinutes };
  }
  if (brief.shape === "loop") {
    return { ...common, journeyShape: "loop", walkingBudgetMinutes: brief.walkingMinutes };
  }
  return {
    ...common,
    journeyShape: "wander",
    walkingBudgetMinutes: brief.walkingMinutes,
    direction: brief.direction ?? undefined,
    endCondition: brief.endCondition === "transit"
      ? { nodeIds: [...new Set(transitEndpoints.map((candidate) => candidate.graphNodeId))], label: "near a mapped subway entrance" }
      : undefined,
  };
}

function IconButton({ label, children, onClick, className = "" }: { label: string; children: React.ReactNode; onClick: () => void; className?: string }) {
  return <button type="button" className={`icon-button ${className}`} onClick={onClick} aria-label={label} title={label}>{children}</button>;
}

function Brand() {
  return <div className="brand"><span className="brand-mark"><span /></span><span>Happy Path</span><small>Lower Manhattan preview</small></div>;
}

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; label: string }) {
  return <div className="segmented" aria-label={label}>{options.map((option) => <button type="button" key={option.value} className={value === option.value ? "selected" : ""} onClick={() => onChange(option.value)}>{option.label}</button>)}</div>;
}

interface ComposeSheetProps {
  brief: UiTripBrief;
  setBrief: (brief: UiTripBrief) => void;
  prompt: string;
  setPrompt: (prompt: string) => void;
  originText: string;
  setOriginText: (value: string) => void;
  destinationText: string;
  setDestinationText: (value: string) => void;
  busy: boolean;
  error: string;
  onPlan: () => void;
}

function ComposeSheet({ brief, setBrief, prompt, setPrompt, originText, setOriginText, destinationText, setDestinationText, busy, error, onPlan }: ComposeSheetProps) {
  const togglePriority = (priority: RoutePriority) => {
    const priorities = brief.priorities.includes(priority) ? brief.priorities.filter((item) => item !== priority) : [...brief.priorities, priority];
    setBrief(mergeTripBrief(brief, { priorities }, "controls"));
  };
  return <section className="sheet compose-sheet" aria-label="Plan a walk">
    <div className="sheet-handle" />
    <div className="compose-heading"><span className="eyebrow">A better way through the city</span><h1>Where and how would you like to walk?</h1></div>
    <div className="journey-row">
      <Segmented value={brief.shape} label="Journey shape" options={[{ value: "destination", label: "Somewhere" }, { value: "loop", label: "Loop" }, { value: "wander", label: "Wander" }]} onChange={(shape) => setBrief(mergeTripBrief(brief, { shape }, "controls"))} />
    </div>
    <div className="location-stack">
      <label className="location-input"><span className="location-dot origin-dot" /><span className="field-label">From</span><input aria-label="Starting point" value={originText} onChange={(event) => setOriginText(event.target.value)} /></label>
      {brief.shape === "destination" && <label className="location-input"><span className="location-dot destination-dot" /><span className="field-label">To</span><input aria-label="Destination" value={destinationText} onChange={(event) => setDestinationText(event.target.value)} placeholder="Where are you going?" /></label>}
    </div>
    <label className="prompt-box">
      <SparkIcon />
      <textarea aria-label="Describe your walk" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={brief.shape === "destination" ? "Less direct sun, and no more than five minutes longer…" : "Green streets, places to pause, finish near transit…"} rows={3} />
    </label>
    <div className="suggestions" aria-label="Example requests">{SUGGESTIONS.map((suggestion) => <button type="button" key={suggestion} onClick={() => setPrompt(suggestion)}>{suggestion}</button>)}</div>
    <div className="quick-picks" aria-label="Quick preferences">
      {(["shade", "greenery", "rest", "water", "restroom"] as RoutePriority[]).map((priority) => {
        const meta = PRIORITY_META[priority];
        const PriorityIcon = meta.icon;
        return <button type="button" key={priority} className={brief.priorities.includes(priority) ? "active" : ""} aria-pressed={brief.priorities.includes(priority)} onClick={() => togglePriority(priority)}><PriorityIcon />{meta.label}</button>;
      })}
      <button type="button" className={brief.avoidMappedSteps ? "active" : ""} aria-pressed={brief.avoidMappedSteps} onClick={() => setBrief(mergeTripBrief(brief, { avoidMappedSteps: !brief.avoidMappedSteps }, "controls"))}><StairsIcon />Avoid mapped steps</button>
    </div>
    <div className="trip-controls">
      <div><span>{brief.shape === "destination" ? "Extra time" : brief.shape === "loop" ? "Loop length" : "Time limit"}</span>{brief.shape === "destination"
        ? <Segmented value={String(brief.detourMinutes)} label="Extra time allowance" options={[{ value: "0", label: "Fastest" }, { value: "5", label: "+5 min" }, { value: "10", label: "+10 min" }]} onChange={(value) => setBrief(mergeTripBrief(brief, { detourMinutes: Number(value) as 0 | 5 | 10 }, "controls"))} />
        : <Segmented value={String(brief.walkingMinutes)} label="Walking time" options={[{ value: "15", label: "15" }, { value: "20", label: "20" }, { value: "25", label: "25" }, { value: "30", label: "30 min" }]} onChange={(value) => setBrief(mergeTripBrief(brief, { walkingMinutes: Number(value) }, "controls"))} />}</div>
      <label className="departure-control"><span><ClockIcon />Leaving</span><select value={brief.departureHour} onChange={(event) => setBrief(mergeTripBrief(brief, { departureHour: Number(event.target.value) }, "controls"))}><option value={new Date().getHours()}>Now · {formatClock(new Date().getHours())}</option>{[8, 10, 12, 14, 16, 18].filter((hour) => hour !== new Date().getHours()).map((hour) => <option key={hour} value={hour}>{formatClock(hour)}</option>)}</select></label>
    </div>
    <div className="brief-preview"><div><span className="eyebrow">Your walk</span><strong>{briefSummary(brief)[0]}</strong></div><div className="brief-tags">{briefSummary(brief).slice(1).map((item) => <span key={item}>{item}</span>)}{brief.avoidMappedSteps && <span>No mapped steps</span>}{brief.unsupported.map((item) => <span className="unsupported-tag" key={item}>{item}</span>)}</div></div>
    {error && <p className="status-message error" role="alert">{error}</p>}
    <button type="button" className="primary-action" disabled={busy || (!prompt.trim() && brief.priorities.length === 0)} onClick={onPlan}><span>{busy ? "Finding a better way…" : "Find my Happy Path"}</span><ArrowIcon /></button>
    <p className="privacy-note">Your route is not saved. If language interpretation is enabled, the configured model provider receives your request; route facts still come from map and City data.</p>
  </section>;
}

function AssetIcon({ kind }: { kind: CivicAssetKind }) {
  if (kind === "seating") return <BenchIcon />;
  if (kind === "restroom") return <RestroomIcon />;
  if (kind === "transit") return <TrainIcon />;
  return <DropletIcon />;
}

function ResultSheet({ brief, route, result, assets, delta, onBack, onRefine, onShowWhy, onShowData, onShowDetour, detourScenario, showBaseline, setShowBaseline, busy, modelFallback }: {
  brief: UiTripBrief;
  route: JourneyRoute;
  result: JourneyResult;
  assets: CivicAsset[];
  delta: string;
  onBack: () => void;
  onRefine: (value: string) => void;
  onShowWhy: () => void;
  onShowData: () => void;
  onShowDetour: () => void;
  detourScenario: ShadeDetourScenario | null;
  showBaseline: boolean;
  setShowBaseline: (value: boolean) => void;
  busy: boolean;
  modelFallback: boolean;
}) {
  const [refinement, setRefinement] = useState("");
  const primary = brief.priorities[0] ?? "shade";
  const sunSaved = result.baseline ? Math.max(0, result.baseline.directSunMinutes - route.directSunMinutes) : null;
  const greenGain = result.baseline ? Math.max(0, route.greeneryPercent - result.baseline.greeneryPercent) : null;
  const missingAmenities = routePriorityKinds(brief.priorities).filter((kind) => !assets.some((asset) => asset.kind === kind));
  const headline = primary === "shade"
    ? route.directSunMinutes < 0.05
      ? "No direct sun expected at this time"
      : sunSaved !== null && sunSaved >= 0.05
        ? "A little longer, less direct sun"
        : "Shade checked, without an extra detour"
    : primary === "greenery" ? "A greener way through" : assets.length ? "Useful stops, kept close" : "A considered way through";
  const submit = (event: FormEvent) => { event.preventDefault(); if (!refinement.trim()) return; onRefine(refinement); setRefinement(""); };
  return <section className="sheet result-sheet" aria-label="Your Happy Path">
    <div className="sheet-handle" />
    <div className="result-nav"><IconButton label="Plan another walk" onClick={onBack}><BackIcon /></IconButton><span>Your Happy Path</span><span className="result-time">{formatMinutes(route.durationMinutes)}</span></div>
    {delta && <div className="route-delta"><SparkIcon />Route updated · {delta}</div>}
    <div className="result-lead"><p>{headline}</p><h2>{brief.shape === "loop" ? `${Math.round(route.durationMinutes)}-minute loop` : brief.shape === "wander" ? `${Math.round(route.durationMinutes)}-minute wander · within your ${brief.walkingMinutes}-minute limit` : `${Math.round(route.durationMinutes)} minutes · ${Math.round(route.extraMinutesVsBaseline ?? 0)} longer`}</h2></div>
    <div className="benefit-list">
      {brief.priorities.includes("shade") && <button type="button" onClick={onShowWhy}><SunIcon /><span>{route.directSunMinutes < 0.05 ? <><strong>Nighttime departure</strong><small>No modeled direct sun at {formatClock(brief.departureHour)}</small></> : sunSaved !== null && sunSaved >= 0.05 ? <><strong>{sunSaved.toFixed(1)} fewer min</strong><small>in estimated direct sun</small></> : <><strong>{route.shadePercent.toFixed(0)}% estimated shade</strong><small>along this route at {formatClock(brief.departureHour)}</small></>}</span><ChevronIcon /></button>}
      {brief.priorities.includes("greenery") && <button type="button" onClick={onShowWhy}><LeafIcon /><span>{greenGain !== null && greenGain >= 0.5 ? <><strong>{greenGain.toFixed(0)} points greener</strong><small>than the fastest route</small></> : <><strong>{route.greeneryPercent.toFixed(0)}% mapped greenery</strong><small>from nearby tree and park records</small></>}</span><ChevronIcon /></button>}
      {assets.slice(0, 2).map((asset) => <button type="button" key={asset.id} onClick={onShowWhy}><AssetIcon kind={asset.kind} /><span><strong>{asset.name}</strong><small>mapped nearby · operation unverified</small></span><ChevronIcon /></button>)}
      {brief.avoidMappedSteps && <button type="button" onClick={onShowWhy}><StairsIcon /><span><strong>Avoids mapped steps</strong><small>Not an accessibility guarantee</small></span><ChevronIcon /></button>}
    </div>
    {missingAmenities.length > 0 && <div className="coverage-note"><strong>Not found near this route</strong><span>{missingAmenities.map((kind) => ({ seating: "mapped seating", restroom: "a mapped restroom", drinking_fountain: "a mapped drinking fountain", transit: "a mapped subway entrance" })[kind]).join(" or ")} within 90 meters. Inventory coverage and current operation may vary.</span></div>}
    <div className="confidence-row"><span className="confidence-dot" /><p><strong>Good confidence for route and time</strong><small>{brief.priorities.includes("shade") ? "Shade is an estimate from building shapes and sun position." : "Some street and asset details may be incomplete."}</small></p></div>
    {result.baseline && <button type="button" className="text-action" onClick={() => setShowBaseline(!showBaseline)}><span className="baseline-swatch" />{showBaseline ? "Hide" : "Compare with"} fastest · {formatMinutes(result.baseline.durationMinutes)}</button>}
    {brief.unsupported.length > 0 && <div className="request-limit" role="status"><strong>Kept out of the route score</strong><span>{brief.unsupported.join(" · ")}. You can still use the mapped evidence above.</span></div>}
    <button type="button" className="data-action" onClick={onShowData}><LayersIcon /><span><strong>City data used</strong><small>{Object.keys(civicFixture.sources).length + 4} mapped and derived sources</small></span><ChevronIcon /></button>
    {detourScenario && detourScenario.avoidedDirectSunMinutes >= 0.05 && <button type="button" className="detour-action" onClick={onShowDetour}><span className="detour-mark">D</span><span><strong>Detour planning proof</strong><small>What if one exposed block had more shade?</small></span><ChevronIcon /></button>}
    <form className="refine-box" onSubmit={submit}><SparkIcon /><input value={refinement} onChange={(event) => setRefinement(event.target.value)} placeholder="Shorter, but keep the bathroom…" aria-label="Refine this route" /><button disabled={busy || !refinement.trim()} aria-label="Update route"><ArrowIcon /></button></form>
    {modelFallback && <p className="status-message subtle">Language service is unavailable, so Happy Path used its built-in trip controls.</p>}
  </section>;
}

type DetailMode = "why" | "data" | "detour";

function DetailPanel({ mode, brief, route, assets, detourScenario, onClose }: { mode: DetailMode; brief: UiTripBrief; route: JourneyRoute; assets: CivicAsset[]; detourScenario: ShadeDetourScenario | null; onClose: () => void }) {
  const label = mode === "why" ? "Why this way" : mode === "data" ? "City data used" : "Detour planning proof";
  return <aside className="detail-panel" role="dialog" aria-modal="true" aria-label={label}>
    <div className="detail-header"><span className="eyebrow">{mode === "why" ? "Why this way?" : mode === "data" ? "Behind your walk" : "Guided planning proof"}</span><IconButton label="Close" onClick={onClose}><CloseIcon /></IconButton></div>
    {mode === "why" ? <>
      <h2>{route.streets[0] || "This part of the route"} fits what you asked for.</h2>
      <p>{brief.priorities.includes("shade") ? `About ${Math.round(route.shadePercent)}% of this walk is in estimated building shade at ${formatClock(brief.departureHour)}.` : "The route favors the mapped qualities in your Trip Brief while staying inside your time budget."}</p>
      <div className="evidence-cards">
        {brief.priorities.includes("shade") && <article><SunIcon /><span><strong>Estimated building shade</strong><small>Derived from building footprints, roof heights, and deterministic sun position. It is not measured temperature.</small></span></article>}
        {brief.priorities.includes("greenery") && <article><LeafIcon /><span><strong>Mapped greenery</strong><small>{route.nearbyTreeCount} nearby tree records{route.adjacentParkNames.length ? ` and ${route.adjacentParkNames.slice(0, 2).join(", ")}` : ""}. Tree points do not prove canopy or shade.</small></span></article>}
        {assets.map((asset) => <article key={asset.id}><AssetIcon kind={asset.kind} /><span><strong>{asset.name}</strong><small>{asset.locationLabel}. The inventory record is official; current operation is unknown.</small></span></article>)}
      </div>
    </> : mode === "data" ? <>
      <h2>Public data, translated into one useful walk.</h2>
      <p>The route uses only the layers relevant to this request. Technical detail stays here so the map can stay calm.</p>
      <div className="source-list">
        <article><span>Community map</span><strong>OpenStreetMap pedestrian paths</strong><small>Connectivity and mapped steps · coverage varies</small></article>
        <article><span>NYC Open Data</span><strong>Building footprints and roof heights</strong><small>Used for estimated shade · validation pending</small></article>
        <article><span>NYC Parks</span><strong>Trees and park properties</strong><small>Used for mapped greenery · not current shade</small></article>
        {Object.values(civicFixture.sources).map((source) => <article key={source.sourceId}><span>{source.publisher}</span><strong>{source.datasetName}</strong><small>{source.recordCount} records in this pilot · operation unverified</small></article>)}
      </div>
    </> : detourScenario ? <>
      <span className="hypothetical-badge">Hypothetical · not a project proposal</span>
      <h2>{detourScenario.title}</h2>
      <p>Detour reuses the resident route’s shade evidence to show one bounded planning scenario. It does not rank or recommend a real capital project.</p>
      <div className="scenario-metrics">
        <article><span>Current route estimate</span><strong>{detourScenario.baselineDirectSunMinutes.toFixed(1)} min</strong><small>in direct sun</small></article>
        <ArrowIcon />
        <article><span>With modeled shade</span><strong>{detourScenario.scenarioDirectSunMinutes.toFixed(1)} min</strong><small>{detourScenario.avoidedDirectSunMinutes.toFixed(1)} min avoided</small></article>
      </div>
      <div className="scenario-assumptions"><strong>{detourScenario.intervention}</strong>{detourScenario.assumptions.map((assumption) => <p key={assumption}>{assumption}</p>)}</div>
    </> : null}
    <button type="button" className="secondary-action" onClick={onClose}>Back to the route</button>
  </aside>;
}

export function App() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [brief, setBrief] = useState<UiTripBrief>({ ...DEFAULT_BRIEF, departureHour: new Date().getHours() });
  const [prompt, setPrompt] = useState("");
  const [originNodeId, setOriginNodeId] = useState(defaultOrigin);
  const [destinationNodeId, setDestinationNodeId] = useState(defaultDestination);
  const [originText, setOriginText] = useState(nodeById.get(defaultOrigin)?.name ?? "Start here");
  const [destinationText, setDestinationText] = useState(nodeById.get(defaultDestination)?.name ?? "Destination");
  const [result, setResult] = useState<JourneyResult | null>(null);
  const [route, setRoute] = useState<JourneyRoute | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showBaseline, setShowBaseline] = useState(false);
  const [detail, setDetail] = useState<DetailMode | null>(null);
  const [delta, setDelta] = useState("");
  const [modelFallback, setModelFallback] = useState(false);
  const [activeAsset, setActiveAsset] = useState<CivicAsset | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const activeAssets = useMemo(() => route ? relevantAssets(route, brief) : [], [route, brief]);
  const detourScenario = useMemo(() => route ? buildShadeDetourScenario(pilotGraph, route, brief.departureHour) : null, [route, brief.departureHour]);

  async function resolveEndpoint(query: string, currentNodeId: string) {
    const current = nodeById.get(currentNodeId);
    if (!query.trim() || query.trim() === current?.name) return currentNodeId;
    const found = await searchNycAddress(query);
    if (!found) throw new Error(`We couldn’t find “${query}”. Try a nearby street or landmark.`);
    if (!isInsidePilot(found.coordinate)) throw new Error("That place is outside this Lower Manhattan preview. Try somewhere between Canal Street and Washington Square.");
    return nearestGraphNode(found.coordinate).id;
  }

  async function compute(nextBrief: UiTripBrief, isRefinement = false) {
    const oldRoute = route;
    const plannedBrief = nextBrief.priorities.includes("construction")
      ? mergeTripBrief(nextBrief, {
        priorities: nextBrief.priorities.filter((priority) => priority !== "construction"),
        unsupported: [...nextBrief.unsupported, "Current construction evidence is unavailable in this preview"],
      }, nextBrief.interpretedBy)
      : nextBrief;
    const resolvedOrigin = await resolveEndpoint(originText, originNodeId);
    let resolvedDestination = destinationNodeId;
    if (plannedBrief.shape === "destination") {
      const query = plannedBrief.destinationQuery ?? destinationText;
      if (!query.trim()) throw new Error("Add a destination so Happy Path knows where you’re headed.");
      resolvedDestination = await resolveEndpoint(query, destinationNodeId);
      setDestinationText(query);
    }
    const routingBrief = makeRoutingBrief(plannedBrief, resolvedOrigin, resolvedDestination);
    const nextResult = planJourney(pilotGraph, routingBrief);
    const nextRoute = pickAmenityAwareRoute(nextResult, plannedBrief.priorities);
    setOriginNodeId(resolvedOrigin);
    setDestinationNodeId(resolvedDestination);
    setBrief(plannedBrief);
    setResult(nextResult);
    setRoute(nextRoute);
    setShowBaseline(false);
    if (isRefinement && oldRoute) {
      const minuteChange = Math.round(nextRoute.durationMinutes - oldRoute.durationMinutes);
      const sunChange = nextRoute.directSunMinutes - oldRoute.directSunMinutes;
      const timeChange = minuteChange === 0 ? "same walking time" : `${Math.abs(minuteChange)} min ${minuteChange < 0 ? "shorter" : "longer"}`;
      setDelta(`${timeChange}${Math.abs(sunChange) >= 0.5 ? ` · ${Math.abs(sunChange).toFixed(1)} ${sunChange <= 0 ? "fewer" : "more"} min in estimated sun` : ""}`);
    } else setDelta("");
  }

  async function plan(value = prompt, isRefinement = false) {
    setBusy(true);
    setError("");
    try {
      const interpreted = value.trim() ? await interpretTripBrief(value, brief) : brief;
      setModelFallback(Boolean(value.trim()) && interpreted.interpretedBy === "fallback");
      await compute(interpreted, isRefinement);
    } catch (caught) {
      const message = caught instanceof JourneyPlanningError
        ? caught.code === "no-feasible-loop" ? "This starting point does not have a good loop inside that time. Try five more minutes." : caught.message
        : caught instanceof Error ? caught.message : "Happy Path could not build that walk yet.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    if (!document.createElement("canvas").getContext("webgl2")) {
      setMapError(true);
      return;
    }
    let map: MapLibreMap;
    try {
      map = new maplibregl.Map({ container: mapContainer.current, style: MAP_STYLE, center: [-73.997, 40.731], zoom: 14.2, attributionControl: false });
    } catch {
      setMapError(true);
      return;
    }
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    map.on("load", () => {
      setMapReady(true);
      setMapError(false);
      map.addSource("building-shadows", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "building-shadows", type: "fill", source: "building-shadows", paint: { "fill-color": "#6478B8", "fill-opacity": 0.18 } });
      map.addSource("baseline", { type: "geojson", data: routeGeoJSON() });
      map.addLayer({ id: "baseline", type: "line", source: "baseline", paint: { "line-color": "#6D716C", "line-width": 3, "line-dasharray": [2, 2], "line-opacity": 0.68 }, layout: { visibility: "none" } });
      map.addSource("happy", { type: "geojson", data: routeGeoJSON() });
      map.addLayer({ id: "happy-casing", type: "line", source: "happy", paint: { "line-color": "#FFFFFF", "line-width": 11, "line-opacity": 0.95 } });
      map.addLayer({ id: "happy", type: "line", source: "happy", paint: { "line-color": "#F05A47", "line-width": 6 } });
      map.addSource("assets", { type: "geojson", data: assetsGeoJSON([]) });
      map.addLayer({ id: "assets", type: "circle", source: "assets", paint: { "circle-radius": 13, "circle-color": "#FFFDF8", "circle-stroke-color": ["match", ["get", "kind"], "seating", "#4F8963", "restroom", "#6478B8", "transit", "#D94C3B", "#2E6F85"], "circle-stroke-width": 2 } });
      map.addLayer({ id: "asset-labels", type: "symbol", source: "assets", layout: { "text-field": ["match", ["get", "kind"], "seating", "S", "restroom", "R", "transit", "T", "W"], "text-size": 10, "text-font": ["Open Sans Bold"] }, paint: { "text-color": "#1E2A24" } });
      map.addSource("endpoints", { type: "geojson", data: endpointsGeoJSON() });
      map.addLayer({ id: "endpoints", type: "circle", source: "endpoints", paint: { "circle-radius": ["match", ["get", "kind"], "origin", 6, 8], "circle-color": ["match", ["get", "kind"], "origin", "#FFFDF8", "#1E2A24"], "circle-stroke-color": "#1E2A24", "circle-stroke-width": 2.5 } });
      map.on("mouseenter", "happy", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "happy", () => { map.getCanvas().style.cursor = ""; });
      map.on("click", "happy", () => setDetail("why"));
      map.on("click", "assets", (event: MapLayerMouseEvent) => {
        const id = event.features?.[0]?.properties?.id;
        setActiveAsset(allMapAssets.find((asset) => asset.id === id) ?? null);
      });
    });
    map.on("error", () => { if (!map.isStyleLoaded()) setMapError(true); });
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    (map.getSource("happy") as GeoJSONSource | undefined)?.setData(routeGeoJSON(route));
    (map.getSource("baseline") as GeoJSONSource | undefined)?.setData(routeGeoJSON(result?.baseline));
    (map.getSource("endpoints") as GeoJSONSource | undefined)?.setData(endpointsGeoJSON(route));
    (map.getSource("assets") as GeoJSONSource | undefined)?.setData(assetsGeoJSON(activeAssets));
    map.setLayoutProperty("baseline", "visibility", showBaseline && result?.baseline ? "visible" : "none");
    if (route) map.fitBounds(boundsForRoute(route), { padding: { top: 100, right: 80, bottom: 100, left: window.innerWidth > 800 ? 500 : 80 }, maxZoom: 16, duration: 700 });
  }, [route, result, showBaseline, activeAssets, mapReady]);

  useEffect(() => {
    if (!brief.priorities.includes("shade")) {
      if (mapRef.current?.getLayer("building-shadows")) mapRef.current.setLayoutProperty("building-shadows", "visibility", "none");
      return;
    }
    const roundedHour = Math.round(brief.departureHour);
    const load = shadowModules[`./data/shadows/hour-${roundedHour}.json`];
    if (!load || !mapRef.current?.isStyleLoaded()) return;
    let cancelled = false;
    load().then((module) => {
      if (cancelled) return;
      mapRef.current?.setLayoutProperty("building-shadows", "visibility", "visible");
      (mapRef.current?.getSource("building-shadows") as GeoJSONSource | undefined)?.setData((module as { default: never }).default);
    });
    return () => { cancelled = true; };
  }, [brief.departureHour, brief.priorities, mapReady]);

  return <main className={route ? "has-result" : "is-compose"}>
    <div className="map-shell"><div className="map" ref={mapContainer} /><div className="map-wash" />{mapError && <div className="map-fallback" role="status"><strong>The map could not load.</strong><span>You can still plan a route and review its receipt. Check your connection to restore the map.</span></div>}</div>
    <div className="top-bar"><Brand /><div className="map-actions"><IconButton label="Center map" onClick={() => mapRef.current?.easeTo({ center: nodeById.get(originNodeId)?.coordinate, zoom: 14.5 })}><LocateIcon /></IconButton><IconButton label="Map details" onClick={() => setDetail("data")}><LayersIcon /></IconButton></div></div>
    {!route ? <ComposeSheet brief={brief} setBrief={setBrief} prompt={prompt} setPrompt={setPrompt} originText={originText} setOriginText={setOriginText} destinationText={destinationText} setDestinationText={setDestinationText} busy={busy} error={error} onPlan={() => plan()} />
      : result && <ResultSheet brief={brief} route={route} result={result} assets={activeAssets} delta={delta} onBack={() => { setRoute(null); setResult(null); setDetail(null); setActiveAsset(null); setError(""); }} onRefine={(value) => plan(value, true)} onShowWhy={() => setDetail("why")} onShowData={() => setDetail("data")} onShowDetour={() => setDetail("detour")} detourScenario={detourScenario} showBaseline={showBaseline} setShowBaseline={setShowBaseline} busy={busy} modelFallback={modelFallback} />}
    {detail && route && <DetailPanel mode={detail} brief={brief} route={route} assets={activeAssets} detourScenario={detourScenario} onClose={() => setDetail(null)} />}
    {activeAsset && <aside className="asset-popover" role="dialog" aria-label={activeAsset.name}><div><AssetIcon kind={activeAsset.kind} /><IconButton label="Close" onClick={() => setActiveAsset(null)}><CloseIcon /></IconButton></div><span className="eyebrow">Mapped nearby</span><h3>{activeAsset.name}</h3><p>{activeAsset.locationLabel}</p><small>Official inventory record. Current operation is unknown.</small></aside>}
    {!mapError && <div className="map-key" aria-hidden="true"><span><i className="route-key" />Happy Path</span>{brief.priorities.includes("shade") && <span><i className="shade-key" />Estimated shade</span>}</div>}
  </main>;
}
