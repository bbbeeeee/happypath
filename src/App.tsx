import { FormEvent, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent } from "maplibre-gl";
import { defaultDestination, defaultOrigin, isInsidePilot, nearestGraphNode, pilotGraph } from "./data/cityGraph";
import { findCivicAssetsNearRoute, loadCivicAssetFixture, type CivicAsset, type CivicAssetKind } from "./data/civicAssets";
import { getPilotTransitEndpointCandidates } from "./data/transitEndpoints";
import { amenityOverviewGeoJSON } from "./amenityOverview";
import { rainPromptIntent, routeShadeSegmentsGeoJSON } from "./climatePresentation";
import { buildShadeDetourScenario, evaluateShadeDetourScenario, type ShadeDetourScenario } from "./detour/shadeScenario";
import { demoCoverGeoJSON, pickRainFriendlyRoute, routeCoverSegmentsGeoJSON, routeCoverShare } from "./demoCover";
import { searchNycAddress } from "./geocoding";
import { briefSummary, DEFAULT_BRIEF, mergeTripBrief, type RoutePriority, type TripBrief as UiTripBrief } from "./planning/tripBrief";
import { interpretTripBrief } from "./planning/interpretTripBrief";
import { JourneyPlanningError, planJourney, rerouteJourneyThroughWaypoint, type PlannedJourneyResult } from "./routing/journey";
import type { Coordinate, JourneyRoute, TripBrief as RoutingTripBrief } from "./types";
import { assetAvailabilityCopy, assetMarkerSvg, assetsGeoJSON, assetTypeLabel, endpointsGeoJSON, routeGeoJSON } from "./mapPresentation";
import { civicAssetEvidence } from "./presentationEvidence";
import {
  ArrowIcon,
  BackIcon,
  BenchIcon,
  ChevronIcon,
  CloudRainIcon,
  ClockIcon,
  CloseIcon,
  DropletIcon,
  LayersIcon,
  LeafIcon,
  LocateIcon,
  MapIcon,
  RestroomIcon,
  RouteIcon,
  SparkIcon,
  StairsIcon,
  SunIcon,
  TrainIcon,
  UmbrellaIcon,
} from "./components/Icons";
import { FallbackMap } from "./components/FallbackMap";
import { useTypingPlaceholder } from "./components/useTypingPlaceholder";

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const nodeById = new Map(pilotGraph.nodes.map((node) => [node.id, node]));
const shadowModules = import.meta.glob("./data/shadows/hour-*.json");
const civicFixture = loadCivicAssetFixture();
const transitEndpoints = getPilotTransitEndpointCandidates({ maxSnapDistanceMeters: 50 });
const allMapAssets = [...new Map([...civicFixture.assets, ...transitEndpoints.map((candidate) => candidate.asset)].map((asset) => [asset.id, asset])).values()];
const demoCoverLayer = demoCoverGeoJSON(pilotGraph);
const ambientCoverLayer = {
  ...demoCoverLayer,
  // The overview is deliberately sparse; the selected route still shows the
  // full edge-by-edge signal. This keeps a citywide proof layer readable.
  features: demoCoverLayer.features.filter((feature, index) => feature.properties.coverShare >= 0.8 && index % 3 === 0),
};

const EXAMPLE_REQUESTS = [
  "Take me to Washington Square with less direct sun. I can add five minutes.",
  "A green 20-minute loop with a place to sit halfway.",
  "Wander west for about 30 minutes and finish near a train.",
  "It’s raining. Find me a 25-minute walk with more likely cover.",
] as const;

type AppMode = "walk" | "planner";
type MapLens = "route" | "shade" | "cover" | "amenities";

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

function friendlyRouteLocation(route: JourneyRoute) {
  const street = route.streets.find((value) => value.trim() && !/^(?:unnamed|unknown|unmapped)|pedestrian\s+(?:way|path)$/i.test(value.trim()));
  return street?.trim() || "This part of the walk";
}

function boundsForRoute(route: JourneyRoute) {
  const bounds = new maplibregl.LngLatBounds(route.coordinates[0], route.coordinates[0]);
  route.coordinates.forEach((coordinate) => bounds.extend(coordinate));
  return bounds;
}

function routeHandleElement(kind: "origin" | "destination" | "waypoint") {
  const element = document.createElement("button");
  element.type = "button";
  element.className = `route-handle route-handle-${kind}`;
  element.setAttribute("aria-label", kind === "origin" ? "Drag starting point" : kind === "destination" ? "Drag destination" : "Drag route waypoint");
  element.title = element.getAttribute("aria-label") ?? "Route handle";
  element.innerHTML = kind === "waypoint" ? "<span></span>" : "";
  return element;
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

function durationEligibleRoutes(result: PlannedJourneyResult) {
  const candidates = [result.recommended, ...result.alternatives];
  const range = result.timing.targetRangeMinutes;
  if (range) {
    const inRange = candidates.filter((route) => route.durationMinutes >= range.minimum - 0.0001
      && route.durationMinutes <= range.maximum + 0.0001);
    if (inRange.length) return inRange;
    const requested = result.timing.requestedMinutes!;
    const closest = Math.min(...candidates.map((route) => Math.abs(route.durationMinutes - requested)));
    return candidates.filter((route) => Math.abs(route.durationMinutes - requested) <= closest + 0.25);
  }
  return candidates;
}

function pickAmenityAwareRoute(result: PlannedJourneyResult, priorities: RoutePriority[]) {
  if (routePriorityKinds(priorities).length === 0) return result.recommended;
  const candidates = durationEligibleRoutes(result);
  return [...candidates].sort((a: JourneyRoute, b: JourneyRoute) => amenityCount(b, priorities) - amenityCount(a, priorities) || b.preferenceScore - a.preferenceScore)[0];
}

function resultWithSelectedRoute(result: PlannedJourneyResult, selected: JourneyRoute): PlannedJourneyResult {
  const requested = result.timing.requestedMinutes;
  const range = result.timing.targetRangeMinutes;
  const status = result.timing.intent === "destination"
    ? "destination"
    : result.timing.intent === "maximum"
      ? "within-maximum"
      : range && selected.durationMinutes >= range.minimum - 0.0001 && selected.durationMinutes <= range.maximum + 0.0001
        ? "within-target"
        : "closest-feasible";
  return {
    ...result,
    recommended: selected,
    alternatives: [result.recommended, ...result.alternatives]
      .filter((route, index, routes) => route.candidateId !== selected.candidateId
        && routes.findIndex((candidate) => candidate.candidateId === route.candidateId) === index)
      .slice(0, 2),
    timing: {
      ...result.timing,
      actualMinutes: selected.durationMinutes,
      status,
      differenceMinutes: requested === null ? null : selected.durationMinutes - requested,
    },
  };
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

function planningErrorMessage(caught: unknown) {
  if (caught instanceof JourneyPlanningError) {
    return caught.code === "no-feasible-loop"
      ? "We couldn’t find a satisfying loop in that time. Give us five more minutes and we’ll try again."
      : caught.message;
  }
  return caught instanceof Error ? caught.message : "We couldn’t build that walk yet. Try a nearby destination or a little more time.";
}

function IconButton({ label, children, onClick, className = "" }: { label: string; children: React.ReactNode; onClick: () => void; className?: string }) {
  return <button type="button" className={`icon-button ${className}`} onClick={onClick} aria-label={label} title={label}>{children}</button>;
}

function Brand() {
  return <div className="brand"><span className="brand-mark"><span /></span><span>Happy Path</span><small>Lower Manhattan beta</small></div>;
}

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; label: string }) {
  return <div className="segmented" aria-label={label}>{options.map((option) => <button type="button" key={option.value} className={value === option.value ? "selected" : ""} onClick={() => onChange(option.value)}>{option.label}</button>)}</div>;
}

function WalkControls({ brief, onChange, destinationText, onDestinationTextChange }: {
  brief: UiTripBrief;
  onChange: (brief: UiTripBrief) => void;
  destinationText: string;
  onDestinationTextChange: (value: string) => void;
}) {
  const patchBrief = (patch: Parameters<typeof mergeTripBrief>[1]) => onChange(mergeTripBrief(brief, patch, "controls"));
  const changeShape = (shape: UiTripBrief["shape"]) => patchBrief({
    shape,
    destinationQuery: shape === "destination" ? brief.destinationQuery : null,
    walkingTimeIntent: shape === "destination" ? brief.walkingTimeIntent : "target",
    direction: shape === "wander" ? brief.direction : null,
    endCondition: shape === "wander" ? brief.endCondition : null,
  });
  const togglePriority = (priority: RoutePriority) => {
    const priorities = brief.priorities.includes(priority)
      ? brief.priorities.filter((item) => item !== priority)
      : [...brief.priorities, priority];
    patchBrief({ priorities });
  };

  return <div className="walk-controls">
    <div className="control-group"><span>Walk shape</span><Segmented value={brief.shape} label="Walk shape" options={[{ value: "destination", label: "Somewhere" }, { value: "loop", label: "Loop" }, { value: "wander", label: "Wander" }]} onChange={changeShape} /></div>
    {brief.shape === "destination" && <label className="destination-control"><span>Destination</span><input aria-label="Destination" value={destinationText} onChange={(event) => onDestinationTextChange(event.target.value)} placeholder="Where are you going?" /></label>}
    <div className="quick-picks" aria-label="What matters">
      {(["shade", "greenery", "rest", "water", "restroom"] as RoutePriority[]).map((priority) => {
        const meta = PRIORITY_META[priority];
        const PriorityIcon = meta.icon;
        return <button type="button" key={priority} className={brief.priorities.includes(priority) ? "active" : ""} aria-pressed={brief.priorities.includes(priority)} onClick={() => togglePriority(priority)}><PriorityIcon />{meta.label}</button>;
      })}
      <button type="button" className={brief.avoidMappedSteps ? "active" : ""} aria-pressed={brief.avoidMappedSteps} onClick={() => patchBrief({ avoidMappedSteps: !brief.avoidMappedSteps })}><StairsIcon />Fewer mapped steps</button>
    </div>
    <div className="trip-controls">
      <div className="time-control"><span>{brief.shape === "destination" ? "Extra time" : brief.walkingTimeIntent === "maximum" ? "Up to" : "About"}</span>{brief.shape === "destination"
        ? <Segmented value={String(brief.detourMinutes)} label="Extra time allowance" options={[{ value: "0", label: "Fastest" }, { value: "5", label: "+5 min" }, { value: "10", label: "+10 min" }]} onChange={(value) => patchBrief({ detourMinutes: Number(value) as 0 | 5 | 10 })} />
        : <div className="custom-time"><button type="button" onClick={() => patchBrief({ walkingMinutes: 20, walkingTimeIntent: "target" })}>20</button><button type="button" onClick={() => patchBrief({ walkingMinutes: 30, walkingTimeIntent: "target" })}>30</button><label><input type="number" min="10" max="60" inputMode="numeric" aria-label="Custom walking time in minutes" value={brief.walkingMinutes} onChange={(event) => patchBrief({ walkingMinutes: Number(event.target.value), walkingTimeIntent: "target" })} /><span>min</span></label></div>}</div>
      <label className="departure-control"><span><ClockIcon />Leaving</span><select value={brief.departureHour} onChange={(event) => patchBrief({ departureHour: Number(event.target.value) })}><option value={new Date().getHours()}>Now · {formatClock(new Date().getHours())}</option>{[8, 10, 12, 14, 16, 18].filter((hour) => hour !== new Date().getHours()).map((hour) => <option key={hour} value={hour}>{formatClock(hour)}</option>)}</select></label>
    </div>
  </div>;
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
  const [manualChanged, setManualChanged] = useState(false);
  const animatedPlaceholder = useTypingPlaceholder(EXAMPLE_REQUESTS);
  const setManualBrief = (nextBrief: UiTripBrief) => { setManualChanged(true); setBrief(nextBrief); };
  return <section className="sheet compose-sheet" aria-label="Plan a walk">
    <div className="sheet-handle" />
    <div className="compose-heading"><span className="eyebrow">Plan a better walk</span><h1>What are you up to?</h1></div>
    <div className="location-stack">
      <label className="location-input"><span className="location-dot origin-dot" /><span className="field-label">From</span><input aria-label="Starting point" value={originText} onChange={(event) => setOriginText(event.target.value)} /></label>
      <label className="location-input"><span className="location-dot destination-dot" /><span className="field-label">To</span><input aria-label="Destination" value={destinationText} onChange={(event) => { setDestinationText(event.target.value); setManualChanged(true); }} placeholder="Optional — or ask for a loop or wander" /></label>
    </div>
    <label className="prompt-box">
      <SparkIcon />
      <textarea aria-label="Describe your walk" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={animatedPlaceholder || EXAMPLE_REQUESTS[0]} rows={4} />
    </label>
    <button type="button" className="prompt-example" onClick={() => setPrompt(EXAMPLE_REQUESTS[2])}><RouteIcon /><span><strong>Try a wander</strong> “{EXAMPLE_REQUESTS[2]}”</span></button>
    <details className="manual-details"><summary>Choose the details instead</summary><WalkControls brief={brief} onChange={setManualBrief} destinationText={destinationText} onDestinationTextChange={(value) => { setManualChanged(true); setDestinationText(value); }} /></details>
    {error && <p className="status-message error" role="alert">{error}</p>}
    <button type="button" className="primary-action" disabled={busy || (!prompt.trim() && !manualChanged && !destinationText.trim())} onClick={onPlan}><span>{busy ? "Finding a better way…" : "Find my path"}</span><ArrowIcon /></button>
    <p className="privacy-note">Your request and route aren’t saved.</p>
  </section>;
}

function AssetIcon({ kind }: { kind: CivicAssetKind }) {
  if (kind === "seating") return <BenchIcon />;
  if (kind === "restroom") return <RestroomIcon />;
  if (kind === "transit") return <TrainIcon />;
  return <DropletIcon />;
}

const ASSET_KINDS: CivicAssetKind[] = ["seating", "restroom", "drinking_fountain", "transit"];

async function registerAssetMarkerImages(map: MapLibreMap) {
  await Promise.all(ASSET_KINDS.map((kind) => new Promise<void>((resolve, reject) => {
    if (map.hasImage(`asset-${kind}`)) { resolve(); return; }
    const image = new Image();
    image.onload = () => { if (!map.hasImage(`asset-${kind}`)) map.addImage(`asset-${kind}`, image, { pixelRatio: 2 }); resolve(); };
    image.onerror = () => reject(new Error(`Could not load the ${kind} map icon.`));
    image.src = assetMarkerSvg(kind);
  })));
}

function ResultSheet({ brief, route, result, assets, destinationText, setDestinationText, delta, error, onBack, onRefine, onAdjust, onShowWhy, onShowAsset, onShowData, onOpenPlanner, detourScenario, showBaseline, setShowBaseline, busy, modelFallback, rainContext }: {
  brief: UiTripBrief;
  route: JourneyRoute;
  result: PlannedJourneyResult;
  assets: CivicAsset[];
  destinationText: string;
  setDestinationText: (value: string) => void;
  delta: string;
  error: string;
  onBack: () => void;
  onRefine: (value: string) => void;
  onAdjust: (brief: UiTripBrief) => Promise<boolean>;
  onShowWhy: () => void;
  onShowAsset: (asset: CivicAsset) => void;
  onShowData: () => void;
  onOpenPlanner: () => void;
  detourScenario: ShadeDetourScenario | null;
  showBaseline: boolean;
  setShowBaseline: (value: boolean) => void;
  busy: boolean;
  modelFallback: boolean;
  rainContext: boolean;
}) {
  const [refinement, setRefinement] = useState("");
  const [showAdjustments, setShowAdjustments] = useState(false);
  const [draftBrief, setDraftBrief] = useState(brief);
  useEffect(() => setDraftBrief(brief), [brief]);
  const primary = brief.priorities[0] ?? "shade";
  const sunSaved = result.baseline ? Math.max(0, result.baseline.directSunMinutes - route.directSunMinutes) : null;
  const greenGain = result.baseline ? Math.max(0, route.greeneryPercent - result.baseline.greeneryPercent) : null;
  const missingAmenities = routePriorityKinds(brief.priorities).filter((kind) => !assets.some((asset) => asset.kind === kind));
  const headline = rainContext
    ? "A rain-friendly route sketch"
    : primary === "shade"
    ? route.directSunMinutes < 0.05
      ? "No direct sun expected at this time"
      : sunSaved !== null && sunSaved >= 0.05
        ? "A little longer, less direct sun"
        : "Shade checked, without an extra detour"
    : primary === "greenery" ? "A greener way through" : assets.length ? "Useful stops, kept close" : "A considered way through";
  const submit = (event: FormEvent) => { event.preventDefault(); if (!refinement.trim()) return; onRefine(refinement); setRefinement(""); };
  const applyAdjustments = async () => { if (await onAdjust(draftBrief)) setShowAdjustments(false); };
  const summary = [...briefSummary(brief), rainContext ? "Rain-friendly" : null, `Leaving ${formatClock(brief.departureHour)}`].filter(Boolean) as string[];
  const roundedExtraMinutes = Math.round(route.extraMinutesVsBaseline ?? 0);
  const destinationTiming = roundedExtraMinutes > 0
    ? `${Math.round(route.durationMinutes)} minutes · ${roundedExtraMinutes} min longer than fastest`
    : `${Math.round(route.durationMinutes)} minutes · same walking time as fastest`;
  const hasDistinctBaseline = Boolean(result.baseline && result.baseline.candidateId !== route.candidateId);
  const timingDifference = Math.abs(Math.round(result.timing.differenceMinutes ?? 0));
  return <section className="sheet result-sheet" aria-label="Your Happy Path">
    <div className="sheet-handle" />
    <div className="result-nav"><IconButton label="Plan a new walk" onClick={onBack}><BackIcon /></IconButton><span>Your Happy Path</span><span className="result-time">{formatMinutes(route.durationMinutes)}</span></div>
    {delta && <div className="route-delta"><SparkIcon />Route updated · {delta}</div>}
    <div className="result-lead"><h1>{headline}</h1><p>{brief.shape === "loop" ? `${Math.round(route.durationMinutes)}-minute loop · about ${brief.walkingMinutes} minutes` : brief.shape === "wander" ? `${Math.round(route.durationMinutes)}-minute wander · ${brief.walkingTimeIntent === "maximum" ? `under ${brief.walkingMinutes} minutes` : `about ${brief.walkingMinutes} minutes`}` : destinationTiming}</p></div>
    {result.timing.status === "closest-feasible" && <div className="timing-note" role="status"><ClockIcon /><span><strong>Closest walk we could make</strong><small>{timingDifference} minutes {route.durationMinutes < (result.timing.requestedMinutes ?? 0) ? "shorter" : "longer"} than requested.</small></span></div>}
    <div className="intent-summary"><div><span className="eyebrow">Your plan</span><strong className="brief-sentence">{summary.slice(0, 3).join(" · ")}</strong><small>{summary.slice(3).join(" · ")}</small></div><button type="button" onClick={() => setShowAdjustments((value) => !value)} aria-expanded={showAdjustments}>{showAdjustments ? "Close" : "Edit"}</button></div>
    {showAdjustments && <div className="adjust-panel"><WalkControls brief={draftBrief} onChange={setDraftBrief} destinationText={destinationText} onDestinationTextChange={setDestinationText} /><button type="button" className="apply-adjustments" disabled={busy} onClick={applyAdjustments}>{busy ? "Updating your walk…" : "Update this walk"}</button></div>}
    <div className="benefit-list">
      {rainContext && <button type="button" onClick={onShowData}><CloudRainIcon /><span><strong>Simulated cover scenario</strong><small>A proof-of-concept cover pattern is visible on the map</small></span><ChevronIcon /></button>}
      {brief.priorities.includes("shade") && <button type="button" onClick={onShowWhy}><SunIcon /><span>{route.directSunMinutes < 0.05 ? <><strong>Nighttime departure</strong><small>No modeled direct sun at {formatClock(brief.departureHour)}</small></> : sunSaved !== null && sunSaved >= 0.05 ? <><strong>{sunSaved.toFixed(1)} fewer min</strong><small>in estimated direct sun</small></> : <><strong>{route.shadePercent.toFixed(0)}% estimated shade</strong><small>along this route at {formatClock(brief.departureHour)}</small></>}</span><ChevronIcon /></button>}
      {brief.priorities.includes("greenery") && <button type="button" onClick={onShowWhy}><LeafIcon /><span>{greenGain !== null && greenGain >= 0.5 ? <><strong>{greenGain.toFixed(0)} points greener</strong><small>than the fastest route</small></> : <><strong>{route.greeneryPercent.toFixed(0)}% mapped greenery</strong><small>from nearby tree and park records</small></>}</span><ChevronIcon /></button>}
      {assets.slice(0, 2).map((asset) => <button type="button" key={asset.id} onClick={() => onShowAsset(asset)}><AssetIcon kind={asset.kind} /><span><strong>{asset.name}</strong><small>Mapped near your route · availability may have changed</small></span><ChevronIcon /></button>)}
      {brief.avoidMappedSteps && <button type="button" onClick={onShowWhy}><StairsIcon /><span><strong>Avoids mapped steps</strong><small>Not an accessibility guarantee</small></span><ChevronIcon /></button>}
    </div>
    {missingAmenities.length > 0 && <div className="coverage-note"><strong>Not found near this route</strong><span>{missingAmenities.map((kind) => ({ seating: "mapped seating", restroom: "a mapped restroom", drinking_fountain: "a mapped drinking fountain", transit: "a mapped subway entrance" })[kind]).join(" or ")} within 90 meters. Inventory coverage and current operation may vary.</span></div>}
    <div className="confidence-row"><span className="confidence-dot" /><p><strong>Built from mapped walking paths</strong><small>{brief.priorities.includes("shade") ? "Shade is estimated from building shapes and the sun’s position." : "Some street and place details may be incomplete."}</small></p></div>
    {result.baseline && hasDistinctBaseline && <button type="button" className="text-action" onClick={() => setShowBaseline(!showBaseline)}><span className="baseline-swatch" />{showBaseline ? "Hide" : "Compare with"} fastest · {formatMinutes(result.baseline.durationMinutes)}</button>}
    {brief.unsupported.length > 0 && <div className="request-limit" role="status"><strong>Kept out of the route score</strong><span>{brief.unsupported.join(" · ")}. You can still use the mapped evidence above.</span></div>}
    <button type="button" className="data-action" onClick={onShowData}><LayersIcon /><span><strong>Built with city and street data</strong><small>{Object.keys(civicFixture.sources).length + 4} sources behind this walk</small></span><ChevronIcon /></button>
    {detourScenario && detourScenario.avoidedDirectSunMinutes >= 0.05 && <button type="button" className="detour-action" onClick={onOpenPlanner}><MapIcon /><span><strong>See what this walk is missing</strong><small>Explore shade, likely cover, and amenities in City what-if</small></span><ChevronIcon /></button>}
    <form className="refine-box" onSubmit={submit}><SparkIcon /><input value={refinement} onChange={(event) => setRefinement(event.target.value)} placeholder="Shorter, but keep the bathroom…" aria-label="Refine this route" /><button disabled={busy || !refinement.trim()} aria-label="Update route"><ArrowIcon /></button></form>
    {error && <p className="status-message error" role="alert">{error}</p>}
    {modelFallback && <p className="status-message subtle">We used built-in trip understanding this time. You can adjust the details above.</p>}
  </section>;
}

type DetailMode = "why" | "data" | "detour" | "asset";

function AssetDetails({ asset }: { asset: CivicAsset }) {
  const evidence = civicAssetEvidence(asset);
  const facts = asset.kind === "seating"
    ? [asset.details.subtype || asset.details.category, asset.details.neighborhood]
    : asset.kind === "restroom"
      ? [asset.details.publishedHours ? `Published hours: ${asset.details.publishedHours}` : null, asset.details.operator, asset.details.season]
      : asset.kind === "drinking_fountain"
        ? [asset.details.fountainType, asset.details.propertyName, asset.details.fountainCount ? `${asset.details.fountainCount} fountain${asset.details.fountainCount === 1 ? "" : "s"} listed here` : null]
        : [asset.details.daytimeRoutes.length ? `Trains: ${asset.details.daytimeRoutes.join(", ")}` : null, asset.details.entranceType, asset.details.publishedEntryAllowed === true ? "Listed as an entrance" : null];
  return <>
    <div className="asset-detail-title"><AssetIcon kind={asset.kind} /><span><span className="eyebrow">{assetTypeLabel(asset)}</span><h2>{asset.name}</h2></span></div>
    <p>{asset.locationLabel}</p>
    <div className="asset-facts">{facts.filter(Boolean).map((fact) => <span key={fact}>{fact}</span>)}</div>
    <div className="asset-caveat"><strong>Good to know</strong><span>{assetAvailabilityCopy(asset)}</span><small>{evidence.statusLabel} · {evidence.freshnessLabel}</small></div>
  </>;
}

function DetailPanel({ mode, brief, route, assets, activeAsset, detourScenario, onClose }: { mode: DetailMode; brief: UiTripBrief; route: JourneyRoute; assets: CivicAsset[]; activeAsset: CivicAsset | null; detourScenario: ShadeDetourScenario | null; onClose: () => void }) {
  const label = mode === "why" ? "Why this way" : mode === "data" ? "City data behind this walk" : mode === "asset" ? activeAsset?.name ?? "Place details" : "City planning what-if";
  return <aside className="detail-panel" role="dialog" aria-modal="true" aria-label={label}>
    <div className="detail-header"><span className="eyebrow">{mode === "why" ? "Why this way?" : mode === "data" ? "Behind your walk" : mode === "asset" ? "Along your walk" : "A planning what-if"}</span><IconButton label="Close" onClick={onClose}><CloseIcon /></IconButton></div>
    {mode === "why" ? <>
      <h2>{friendlyRouteLocation(route)} fits what you asked for.</h2>
      <p>{brief.priorities.includes("shade") ? `About ${Math.round(route.shadePercent)}% of this walk is in estimated building shade at ${formatClock(brief.departureHour)}.` : "The route favors the mapped qualities in your Trip Brief while staying inside your time budget."}</p>
      <div className="evidence-cards">
        {brief.priorities.includes("shade") && <article><SunIcon /><span><strong>Estimated building shade</strong><small>Derived from building footprints, roof heights, and deterministic sun position. It is not measured temperature.</small></span></article>}
        {brief.priorities.includes("greenery") && <article><LeafIcon /><span><strong>Mapped greenery</strong><small>{route.nearbyTreeCount} nearby tree records{route.adjacentParkNames.length ? ` and ${route.adjacentParkNames.slice(0, 2).join(", ")}` : ""}. Tree points do not prove canopy or shade.</small></span></article>}
        {assets.map((asset) => <article key={asset.id}><AssetIcon kind={asset.kind} /><span><strong>{asset.name}</strong><small>{asset.locationLabel}. Listed by NYC; availability may have changed.</small></span></article>)}
      </div>
    </> : mode === "data" ? <>
      <h2>Public data, translated into one useful walk.</h2>
      <p>The route uses only the layers relevant to this request. Technical detail stays here so the map can stay calm.</p>
      <div className="source-list">
        <article><span>Community map</span><strong>OpenStreetMap pedestrian paths</strong><small>Connectivity and mapped steps · coverage varies</small></article>
        <article><span>NYC Open Data</span><strong>Building footprints and roof heights</strong><small>Used for estimated shade · not measured temperature</small></article>
        <article><span>NYC Parks</span><strong>Trees and park properties</strong><small>Used for mapped greenery · not current shade</small></article>
        {Object.values(civicFixture.sources).map((source) => <article key={source.sourceId}><span>{source.publisher}</span><strong>{source.datasetName}</strong><small>{source.recordCount} records in this pilot · operation unverified</small></article>)}
      </div>
    </> : mode === "asset" && activeAsset ? <AssetDetails asset={activeAsset} /> : detourScenario ? <>
      <span className="hypothetical-badge">Planning sketch · not a City proposal</span>
      <h2>{detourScenario.title}</h2>
      <p>Try one shade idea and compare the same walk before and after. The estimate is here to make a possibility visible, not to claim a finished design.</p>
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

function PlannerSheet({ route, scenario, lens, onLensChange, targetShade, onTargetShadeChange, onBack, onUseSample, onPlannerPrompt }: {
  route: JourneyRoute | null;
  scenario: ShadeDetourScenario | null;
  lens: MapLens;
  onLensChange: (lens: MapLens) => void;
  targetShade: number;
  onTargetShadeChange: (value: number) => void;
  onBack: () => void;
  onUseSample: () => void;
  onPlannerPrompt: (value: string) => void;
}) {
  const [plannerPrompt, setPlannerPrompt] = useState("");
  const counts = civicFixture.counts;
  const coverPercent = route ? Math.round(routeCoverShare(route, pilotGraph) * 100) : 0;
  const averageBurden = scenario ? {
    baseline: scenario.burden.baseline / scenario.journeyCounts.totalWeight,
    scenario: scenario.burden.scenario / scenario.journeyCounts.totalWeight,
    avoided: scenario.burden.avoided / scenario.journeyCounts.totalWeight,
  } : null;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!plannerPrompt.trim()) return;
    onPlannerPrompt(plannerPrompt);
    setPlannerPrompt("");
  };
  return <section className="sheet planner-sheet" aria-label="City what-if">
    <div className="sheet-handle" />
    <div className="result-nav"><IconButton label="Back to walk" onClick={onBack}><BackIcon /></IconButton><span>City what-if</span><span className="prototype-pill">Prototype</span></div>
    <div className="planner-lead"><span className="eyebrow">See what’s missing</span><h1>{route ? "What could make this walk feel better?" : "Where could the city feel more comfortable?"}</h1><p>{route ? "Inspect a comfort gap, then sketch one small improvement." : "Amenities and climate signals stay visible across the neighborhood."}</p></div>
    <div className="planner-lenses" aria-label="Planner map view">
      <button type="button" className={lens === "shade" ? "active" : ""} onClick={() => onLensChange("shade")}><SunIcon />Shade gaps</button>
      <button type="button" className={lens === "cover" ? "active" : ""} onClick={() => onLensChange("cover")}><UmbrellaIcon />Likely cover</button>
      <button type="button" className={lens === "amenities" ? "active" : ""} onClick={() => onLensChange("amenities")}><BenchIcon />Amenities</button>
    </div>
    {!route ? <>
      <div className="planner-overview-stats"><span><strong>{counts.seating}</strong> seats</span><span><strong>{counts.drinking_fountain}</strong> fountains</span><span><strong>{counts.restroom}</strong> restrooms</span></div>
      <div className="planner-empty"><MapIcon /><div><strong>Start with a representative walk</strong><span>We’ll draw a 30-minute loop, then show where shade, cover, and useful places thin out.</span></div></div>
      <button type="button" className="primary-action" onClick={onUseSample}><span>Use a sample walk</span><ArrowIcon /></button>
    </> : <>
      {lens === "shade" && scenario && <>
        <div className="planner-callout"><span className="scenario-dot" /><div><strong>{scenario.selection.locationNames[0]}</strong><small>{scenario.summary}</small></div></div>
        <label className="intervention-control"><span><strong>Try more shade here</strong><output>{targetShade}%</output></span><input type="range" min="40" max="95" step="5" value={targetShade} onChange={(event) => onTargetShadeChange(Number(event.target.value))} /></label>
        <div className="scenario-metrics compact"><article><span>Average walk now</span><strong>{averageBurden!.baseline.toFixed(1)} min</strong><small>in direct sun</small></article><ArrowIcon /><article><span>With this idea</span><strong>{averageBurden!.scenario.toFixed(1)} min</strong><small>{averageBurden!.avoided.toFixed(1)} min less</small></article></div>
        <p className="planner-proof">{scenario.journeyCounts.withChangedBurden} of {scenario.journeyCounts.evaluated} route options improve. Each path is held still so the shade change stays easy to compare.</p>
      </>}
      {lens === "cover" && <div className="planner-gap-list"><div><UmbrellaIcon /><span><strong>{coverPercent}% of this route is highlighted in the simulation</strong><small>Dashed indigo segments are generated for this proof of concept. Gaps stay warm coral.</small></span></div><div><CloudRainIcon /><span><strong>Useful for testing a rain scenario</strong><small>Production would need current shed, arcade, awning, and construction records.</small></span></div></div>}
      {lens === "amenities" && <div className="planner-gap-list"><div><BenchIcon /><span><strong>{counts.seating} mapped places to sit</strong><small>Coverage halos make the empty blocks easier to see.</small></span></div><div><RestroomIcon /><span><strong>Only {counts.restroom} mapped restrooms</strong><small>Click any icon for source and freshness details.</small></span></div><div><DropletIcon /><span><strong>{counts.drinking_fountain} drinking-water records</strong><small>Current operation is not verified in this prototype.</small></span></div></div>}
      <span className="hypothetical-badge">Planning sketch · not a City proposal</span>
    </>}
    <form className="refine-box planner-prompt" onSubmit={submit}><SparkIcon /><input value={plannerPrompt} onChange={(event) => setPlannerPrompt(event.target.value)} placeholder="What if this block had 85% shade?" aria-label="Describe a planning what-if" /><button disabled={!plannerPrompt.trim()} aria-label="Try planning idea"><ArrowIcon /></button></form>
    <button type="button" className="planner-back" onClick={onBack}>Back to my walk</button>
  </section>;
}

function MapLensControl({ lens, onChange, hour, onHourChange, showCover, planner, canEdit, editing, onEditingChange }: {
  lens: MapLens;
  onChange: (lens: MapLens) => void;
  hour: number;
  onHourChange: (hour: number) => void;
  showCover: boolean;
  planner: boolean;
  canEdit: boolean;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
}) {
  return <div className="map-lens-control" aria-label="Map view">
    <div><span><SunIcon />Sun &amp; cover</span><output>{formatClock(hour)}</output></div>
    <div className="map-lens-options">
      <button type="button" className={lens === "route" ? "active" : ""} onClick={() => onChange("route")}>Path</button>
      <button type="button" className={lens === "shade" ? "active" : ""} onClick={() => onChange("shade")}>Shade</button>
      {(showCover || planner) && <button type="button" className={lens === "cover" ? "active" : ""} onClick={() => onChange("cover")}>Cover</button>}
      {planner && <button type="button" className={lens === "amenities" ? "active" : ""} onClick={() => onChange("amenities")}>Places</button>}
    </div>
    {!planner && canEdit && <button type="button" className={`edit-path-control ${editing ? "active" : ""}`} onClick={() => onEditingChange(!editing)}><RouteIcon />{editing ? "Click the path to place a handle" : "Edit path on map"}</button>}
    {lens === "shade" && <label><span>7 AM</span><input type="range" min="7" max="19" step="1" value={hour} onChange={(event) => onHourChange(Number(event.target.value))} aria-label="Shade time" /><span>7 PM</span></label>}
  </div>;
}

export function App() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const originMarkerRef = useRef<maplibregl.Marker | null>(null);
  const destinationMarkerRef = useRef<maplibregl.Marker | null>(null);
  const waypointMarkerRef = useRef<maplibregl.Marker | null>(null);
  const dragEndpointRef = useRef<(kind: "origin" | "destination", coordinate: Coordinate) => void>(() => undefined);
  const routeSteerRef = useRef<(coordinate: Coordinate) => void>(() => undefined);
  const routeFeatureClickRef = useRef<(edgeId: string | null, coordinate: Coordinate) => void>(() => undefined);
  const [brief, setBrief] = useState<UiTripBrief>({ ...DEFAULT_BRIEF, priorities: [], departureHour: new Date().getHours() });
  const [prompt, setPrompt] = useState("");
  const [originNodeId, setOriginNodeId] = useState(defaultOrigin);
  const [destinationNodeId, setDestinationNodeId] = useState(defaultDestination);
  const [originText, setOriginText] = useState(nodeById.get(defaultOrigin)?.name ?? "Start here");
  const [destinationText, setDestinationText] = useState("");
  const [result, setResult] = useState<PlannedJourneyResult | null>(null);
  const [route, setRoute] = useState<JourneyRoute | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showBaseline, setShowBaseline] = useState(false);
  const [detail, setDetail] = useState<DetailMode | null>(null);
  const [delta, setDelta] = useState("");
  const [modelFallback, setModelFallback] = useState(false);
  const [activeAsset, setActiveAsset] = useState<CivicAsset | null>(null);
  const [activeAssetPoint, setActiveAssetPoint] = useState<{ x: number; y: number } | null>(null);
  const [activeCover, setActiveCover] = useState<{ label: string; street: string; proofLabel: string } | null>(null);
  const [activeCoverPoint, setActiveCoverPoint] = useState<{ x: number; y: number } | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [appMode, setAppMode] = useState<AppMode>("walk");
  const [mapLens, setMapLens] = useState<MapLens>("route");
  const [shadeHour, setShadeHour] = useState(Math.max(7, Math.min(19, new Date().getHours())));
  const [rainContext, setRainContext] = useState(false);
  const [plannerShadeTarget, setPlannerShadeTarget] = useState(80);
  const [selectedPlannerEdgeId, setSelectedPlannerEdgeId] = useState<string | null>(null);
  const [waypointNodeId, setWaypointNodeId] = useState<string | null>(null);
  const [manualWanderEndpointId, setManualWanderEndpointId] = useState<string | null>(null);
  const [editRoute, setEditRoute] = useState(false);
  const activeAssets = useMemo(() => route ? relevantAssets(route, brief) : [], [route, brief]);
  const detourScenario = useMemo(() => route ? buildShadeDetourScenario(pilotGraph, route, brief.departureHour) : null, [route, brief.departureHour]);
  const plannerScenario = useMemo(() => {
    if (!route) return null;
    const journeys = [route, result?.baseline, ...(result?.alternatives ?? [])]
      .filter((candidate): candidate is JourneyRoute => Boolean(candidate))
      .filter((candidate, index, candidates) => candidates.findIndex((item) => item.candidateId === candidate.candidateId) === index)
      .map((candidate, index) => ({ id: candidate.candidateId, route: candidate, label: index === 0 ? "Current route" : `Route option ${index + 1}`, weight: 1 }));
    return evaluateShadeDetourScenario(pilotGraph, {
      departureHour: shadeHour,
      journeys,
      intervention: {
        targetShadePercent: plannerShadeTarget,
        edgeIds: selectedPlannerEdgeId ? [selectedPlannerEdgeId] : undefined,
        label: "A shade idea for this block",
      },
    });
  }, [route, result, shadeHour, plannerShadeTarget, selectedPlannerEdgeId]);
  const shadeSegments = useMemo(() => routeShadeSegmentsGeoJSON(route, pilotGraph, shadeHour), [route, shadeHour]);
  const coverRouteSegments = useMemo(() => routeCoverSegmentsGeoJSON(route, pilotGraph), [route]);
  const overviewAssets = useMemo(() => amenityOverviewGeoJSON(allMapAssets, {
    selectedAssetId: activeAsset?.id,
    prominentAssetIds: activeAssets.map((asset) => asset.id),
    clusterCellMeters: appMode === "planner" ? 90 : 120,
  }), [activeAsset?.id, activeAssets, appMode]);

  async function resolveEndpoint(query: string, currentNodeId: string) {
    const current = nodeById.get(currentNodeId);
    if (!query.trim() || query.trim() === current?.name) return currentNodeId;
    const found = await searchNycAddress(query);
    if (!found) throw new Error(`We couldn’t find “${query}”. Try a nearby street or landmark.`);
    if (!isInsidePilot(found.coordinate)) throw new Error("Happy Path is exploring Lower Manhattan for now. Try a start and destination between Canal Street and Union Square.");
    return nearestGraphNode(found.coordinate).id;
  }

  async function compute(nextBrief: UiTripBrief, isRefinement = false, options: { rainFriendly?: boolean; originId?: string; destinationId?: string; wanderEndpointId?: string | null; preserveWaypoint?: boolean } = {}) {
    const oldRoute = route;
    const plannedBrief = nextBrief.priorities.includes("construction")
      ? mergeTripBrief(nextBrief, {
        priorities: nextBrief.priorities.filter((priority) => priority !== "construction"),
        unsupported: [...nextBrief.unsupported, "Current construction evidence is unavailable in this preview"],
      }, nextBrief.interpretedBy)
      : nextBrief;
    const resolvedOrigin = options.originId ?? await resolveEndpoint(originText, originNodeId);
    let resolvedDestination = options.destinationId ?? destinationNodeId;
    if (plannedBrief.shape === "destination") {
      const query = plannedBrief.destinationQuery ?? destinationText;
      if (!options.destinationId && !query.trim()) throw new Error("Add a destination so Happy Path knows where you’re headed.");
      if (!options.destinationId) resolvedDestination = await resolveEndpoint(query, destinationNodeId);
      if (query.trim()) setDestinationText(query);
    }
    let routingBrief = makeRoutingBrief(plannedBrief, resolvedOrigin, resolvedDestination);
    const fixedWanderEndpoint = options.wanderEndpointId !== undefined
      ? options.wanderEndpointId
      : plannedBrief.shape === "wander" && plannedBrief.endCondition === null
        ? manualWanderEndpointId
        : null;
    if (routingBrief.journeyShape === "wander" && fixedWanderEndpoint) {
      routingBrief = {
        ...routingBrief,
        direction: undefined,
        endCondition: { nodeIds: [fixedWanderEndpoint], label: "at the adjusted map endpoint" },
      };
    }
    const nextResult = planJourney(pilotGraph, routingBrief, { walkingTimeIntent: plannedBrief.walkingTimeIntent });
    const nextRoute = options.rainFriendly
      ? pickRainFriendlyRoute(nextResult, pilotGraph)
      : pickAmenityAwareRoute(nextResult, plannedBrief.priorities);
    setOriginNodeId(resolvedOrigin);
    setDestinationNodeId(resolvedDestination);
    setBrief(plannedBrief);
    setResult(resultWithSelectedRoute(nextResult, nextRoute));
    setRoute(nextRoute);
    setShadeHour(Math.max(7, Math.min(19, Math.round(plannedBrief.departureHour))));
    setShowBaseline(false);
    setActiveAsset(null);
    setActiveAssetPoint(null);
    setDetail(null);
    setActiveCover(null);
    setActiveCoverPoint(null);
    setSelectedPlannerEdgeId(null);
    if (plannedBrief.shape !== "wander" || plannedBrief.endCondition !== null) setManualWanderEndpointId(null);
    else if (options.wanderEndpointId !== undefined) setManualWanderEndpointId(options.wanderEndpointId);
    if (!options.preserveWaypoint) setWaypointNodeId(null);
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
      const rainIntent = rainPromptIntent(value);
      const nextRainContext = rainIntent === "on" ? true : rainIntent === "off" ? false : rainContext;
      const interpreted = value.trim() ? await interpretTripBrief(value, brief) : brief;
      setModelFallback(Boolean(value.trim()) && interpreted.interpretedBy === "fallback");
      setRainContext(nextRainContext);
      if (nextRainContext) setMapLens("cover");
      else if (rainIntent === "off") setMapLens("route");
      await compute(interpreted, isRefinement, { rainFriendly: nextRainContext });
    } catch (caught) {
      setError(planningErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function adjust(nextBrief: UiTripBrief) {
    setBusy(true);
    setError("");
    try {
      await compute(nextBrief, true, { rainFriendly: rainContext });
      return true;
    } catch (caught) {
      setError(planningErrorMessage(caught));
      return false;
    } finally {
      setBusy(false);
    }
  }

  function startNewWalk() {
    setPrompt("");
    setBrief({ ...DEFAULT_BRIEF, priorities: [], departureHour: new Date().getHours() });
    setDestinationNodeId(defaultDestination);
    setDestinationText("");
    setRoute(null);
    setResult(null);
    setDetail(null);
    setActiveAsset(null);
    setActiveAssetPoint(null);
    setError("");
    setDelta("");
    setModelFallback(false);
    setRainContext(false);
    setMapLens("route");
    setAppMode("walk");
    setSelectedPlannerEdgeId(null);
    setWaypointNodeId(null);
    setManualWanderEndpointId(null);
    setEditRoute(false);
    setActiveCover(null);
    setActiveCoverPoint(null);
  }

  async function usePlannerSample() {
    const sample = mergeTripBrief(DEFAULT_BRIEF, {
      shape: "loop",
      walkingMinutes: 30,
      walkingTimeIntent: "target",
      priorities: ["shade", "rest"],
      departureHour: shadeHour,
      destinationQuery: null,
    }, "controls");
    setBusy(true);
    setError("");
    try {
      await compute(sample, false);
      setAppMode("planner");
      setMapLens("shade");
    } catch (caught) {
      setError(planningErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  function handlePlannerPrompt(value: string) {
    const requestedShade = value.match(/\b(\d{2,3})\s*%?\s*shade\b/i)?.[1];
    if (requestedShade) setPlannerShadeTarget(Math.max(40, Math.min(95, Number(requestedShade))));
    if (/cover|rain|awning|shed/i.test(value)) setMapLens("cover");
    else if (/seat|restroom|bathroom|water|amenit/i.test(value)) setMapLens("amenities");
    else setMapLens("shade");
  }

  async function steerRoute(coordinate: Coordinate) {
    if (!route || !result) return;
    const waypoint = nearestGraphNode(coordinate);
    try {
      const routingBrief = makeRoutingBrief(brief, originNodeId, destinationNodeId);
      const steered = rerouteJourneyThroughWaypoint(pilotGraph, routingBrief, route, waypoint.id, { walkingTimeIntent: brief.walkingTimeIntent });
      setWaypointNodeId(waypoint.id);
      setRoute(steered);
      setResult((current) => current ? resultWithSelectedRoute(current, steered) : current);
      setDelta(`path steered near ${waypoint.name}`);
      setError("");
    } catch (caught) {
      setError(planningErrorMessage(caught));
    }
  }

  dragEndpointRef.current = (kind, coordinate) => {
    const node = nearestGraphNode(coordinate);
    if (kind === "origin") {
      setOriginNodeId(node.id);
      setOriginText(node.name);
      void compute(brief, true, { rainFriendly: rainContext, originId: node.id });
      return;
    }
    if (route?.journeyShape === "wander") {
      const nextBrief = mergeTripBrief(brief, { direction: null, endCondition: null }, "controls");
      setDestinationNodeId(node.id);
      setDestinationText(node.name);
      void compute(nextBrief, true, { rainFriendly: rainContext, destinationId: node.id, wanderEndpointId: node.id });
      return;
    }
    setDestinationNodeId(node.id);
    setDestinationText(node.name);
    void compute({ ...brief, destinationQuery: node.name, interpretedBy: "controls" }, true, { rainFriendly: rainContext, destinationId: node.id });
  };
  routeSteerRef.current = (coordinate) => { void steerRoute(coordinate); };
  routeFeatureClickRef.current = (edgeId, coordinate) => {
    if (appMode === "planner") {
      if (edgeId) setSelectedPlannerEdgeId(edgeId);
      setMapLens("shade");
      return;
    }
    if (editRoute) {
      void steerRoute(coordinate);
      return;
    }
    setDetail("why");
  };

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
      map.addLayer({ id: "building-shadows", type: "fill", source: "building-shadows", paint: { "fill-color": "#566C91", "fill-opacity": 0.2 }, layout: { visibility: "none" } });
      map.addSource("demo-cover", { type: "geojson", data: ambientCoverLayer });
      map.addLayer({ id: "demo-cover-casing", type: "line", source: "demo-cover", paint: { "line-color": "#FFFFFF", "line-width": 8, "line-opacity": 0.8 }, layout: { visibility: "none" } });
      map.addLayer({ id: "demo-cover", type: "line", source: "demo-cover", paint: { "line-color": "#536A91", "line-width": 4, "line-dasharray": [2, 1], "line-opacity": 0.82 }, layout: { visibility: "none" } });
      map.addSource("baseline", { type: "geojson", data: routeGeoJSON() });
      map.addLayer({ id: "baseline", type: "line", source: "baseline", paint: { "line-color": "#6D716C", "line-width": 3, "line-dasharray": [2, 2], "line-opacity": 0.68 }, layout: { visibility: "none" } });
      map.addSource("happy", { type: "geojson", data: routeGeoJSON() });
      map.addLayer({ id: "happy-casing", type: "line", source: "happy", paint: { "line-color": "#FFFFFF", "line-width": 11, "line-opacity": 0.95 } });
      map.addLayer({ id: "happy", type: "line", source: "happy", paint: { "line-color": "#F05A47", "line-width": 6 } });
      map.addSource("route-shade", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "route-shade", type: "line", source: "route-shade", paint: {
        "line-color": ["match", ["get", "shadeBand"], "mostly_shaded", "#294E43", "mixed", "#8A7C4A", "#E86248"],
        "line-width": 6,
        "line-opacity": 0.98,
      }, layout: { visibility: "none", "line-cap": "round", "line-join": "round" } });
      map.addSource("route-cover", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "route-cover", type: "line", source: "route-cover", paint: {
        "line-color": ["match", ["get", "coverBand"], "more", "#3D587F", "some", "#7284A2", "#E86248"],
        "line-width": 6,
        "line-opacity": 0.98,
      }, layout: { visibility: "none", "line-cap": "round", "line-join": "round" } });
      map.addSource("planner-selection", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "planner-selection-casing", type: "line", source: "planner-selection", paint: { "line-color": "#FFFFFF", "line-width": 15, "line-opacity": 0.95 }, layout: { visibility: "none" } });
      map.addLayer({ id: "planner-selection", type: "line", source: "planner-selection", paint: { "line-color": "#6478B8", "line-width": 9, "line-opacity": 0.95 }, layout: { visibility: "none" } });
      const showAssetPopover = (event: MapLayerMouseEvent) => {
        const id = event.features?.[0]?.properties?.id;
        setDetail(null);
        setActiveAsset(allMapAssets.find((asset) => asset.id === id) ?? null);
        setActiveAssetPoint({ x: event.point.x, y: event.point.y });
      };
      map.addSource("assets", { type: "geojson", data: assetsGeoJSON([]) });
      map.addLayer({ id: "assets", type: "circle", source: "assets", paint: {
        "circle-radius": ["case", ["get", "selected"], 18, 15],
        "circle-color": "#FFFDF8",
        "circle-opacity": ["case", ["get", "selected"], 0.98, 0],
        "circle-stroke-color": "#F05A47",
        "circle-stroke-width": ["case", ["get", "selected"], 3, 0],
        "circle-translate": [0, -23],
      } });
      map.addSource("overview-assets", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "amenity-coverage", type: "circle", source: "overview-assets", filter: ["==", ["get", "featureType"], "asset"], paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 13, 18, 16, 48],
        "circle-color": ["match", ["get", "kind"], "seating", "#6FA07C", "restroom", "#7586BB", "drinking_fountain", "#4D8797", "#D96A58"],
        "circle-opacity": 0.1,
        "circle-stroke-width": 1,
        "circle-stroke-opacity": 0.18,
      }, layout: { visibility: "none" } });
      map.addLayer({ id: "overview-clusters", type: "circle", source: "overview-assets", filter: ["==", ["get", "featureType"], "cluster"], paint: {
        "circle-radius": ["interpolate", ["linear"], ["get", "count"], 2, 15, 8, 21],
        "circle-color": "#FFFDF8",
        "circle-stroke-color": ["match", ["get", "kind"], "seating", "#4F8963", "restroom", "#6478B8", "drinking_fountain", "#2E6F85", "#D94C3B"],
        "circle-stroke-width": 2,
        "circle-opacity": 0.96,
      }, layout: { visibility: "none" } });
      map.addLayer({ id: "overview-cluster-count", type: "symbol", source: "overview-assets", filter: ["==", ["get", "featureType"], "cluster"], layout: {
        "text-field": ["to-string", ["get", "count"]],
        "text-size": 11,
        "text-font": ["Open Sans Bold"],
        visibility: "none",
      }, paint: { "text-color": "#1E2A24" } });
      void registerAssetMarkerImages(map).then(() => {
        if (map.getLayer("asset-icons")) return;
        map.addLayer({ id: "asset-icons", type: "symbol", source: "assets", layout: {
          "icon-image": ["match", ["get", "kind"], "seating", "asset-seating", "restroom", "asset-restroom", "transit", "asset-transit", "asset-drinking_fountain"],
          "icon-size": ["case", ["get", "selected"], 1.35, 1.2],
          "icon-anchor": "bottom",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        } });
        map.addLayer({ id: "overview-icons", type: "symbol", source: "overview-assets", filter: ["all", ["==", ["get", "featureType"], "asset"], ["!", ["get", "prominent"]]], layout: {
          "icon-image": ["match", ["get", "kind"], "seating", "asset-seating", "restroom", "asset-restroom", "transit", "asset-transit", "asset-drinking_fountain"],
          "icon-size": 0.72,
          "icon-anchor": "bottom",
          "icon-allow-overlap": false,
          "icon-padding": 5,
          visibility: "visible",
        } });
        map.on("mouseenter", "asset-icons", () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", "asset-icons", () => { map.getCanvas().style.cursor = ""; });
        map.on("click", "asset-icons", showAssetPopover);
        map.on("mouseenter", "overview-icons", () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", "overview-icons", () => { map.getCanvas().style.cursor = ""; });
        map.on("click", "overview-icons", showAssetPopover);
      }).catch(() => { /* The selectable marker hit areas remain available if icon art cannot load. */ });
      map.addSource("endpoints", { type: "geojson", data: endpointsGeoJSON() });
      map.addLayer({ id: "endpoints", type: "circle", source: "endpoints", paint: {
        "circle-radius": ["match", ["get", "kind"], "origin", 6, "start_finish", 9, 8],
        "circle-color": ["match", ["get", "kind"], "destination", "#1E2A24", "#FFFDF8"],
        "circle-stroke-color": ["match", ["get", "kind"], "start_finish", "#F05A47", "#1E2A24"],
        "circle-stroke-width": ["match", ["get", "kind"], "start_finish", 3.5, 2.5],
      } });
      const routeFeatureClick = (event: MapLayerMouseEvent) => {
        const edgeId = event.features?.[0]?.properties?.edgeId ?? null;
        routeFeatureClickRef.current(edgeId, [event.lngLat.lng, event.lngLat.lat]);
      };
      ["happy", "route-shade", "route-cover"].forEach((layer) => {
        map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
        map.on("click", layer, routeFeatureClick);
      });
      map.on("mouseenter", "demo-cover", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "demo-cover", () => { map.getCanvas().style.cursor = ""; });
      map.on("click", "demo-cover", (event) => {
        const properties = event.features?.[0]?.properties;
        setActiveAsset(null);
        setDetail(null);
        setActiveCover(properties ? { label: properties.label, street: properties.street, proofLabel: properties.proofLabel } : null);
        setActiveCoverPoint({ x: event.point.x, y: event.point.y });
      });
      map.on("click", "assets", showAssetPopover);
    });
    map.on("error", () => { if (!map.isStyleLoaded()) setMapError(true); });
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !route) {
      originMarkerRef.current?.remove();
      destinationMarkerRef.current?.remove();
      waypointMarkerRef.current?.remove();
      originMarkerRef.current = null;
      destinationMarkerRef.current = null;
      waypointMarkerRef.current = null;
      return;
    }

    if (!originMarkerRef.current) {
      const marker = new maplibregl.Marker({ element: routeHandleElement("origin"), draggable: true, anchor: "center" }).addTo(map);
      marker.on("dragend", () => {
        const point = marker.getLngLat();
        dragEndpointRef.current("origin", [point.lng, point.lat]);
      });
      originMarkerRef.current = marker;
    }
    originMarkerRef.current.setLngLat(route.coordinates[0]);

    if (route.journeyShape !== "loop") {
      if (!destinationMarkerRef.current) {
        const marker = new maplibregl.Marker({ element: routeHandleElement("destination"), draggable: true, anchor: "center" }).addTo(map);
        marker.on("dragend", () => {
          const point = marker.getLngLat();
          dragEndpointRef.current("destination", [point.lng, point.lat]);
        });
        destinationMarkerRef.current = marker;
      }
      destinationMarkerRef.current.setLngLat(route.coordinates.at(-1)!);
      destinationMarkerRef.current.setDraggable(true);
    } else {
      destinationMarkerRef.current?.remove();
      destinationMarkerRef.current = null;
    }

    const waypoint = waypointNodeId ? nodeById.get(waypointNodeId) : null;
    if (waypoint) {
      if (!waypointMarkerRef.current) {
        const marker = new maplibregl.Marker({ element: routeHandleElement("waypoint"), draggable: true, anchor: "center" }).addTo(map);
        marker.on("dragend", () => {
          const point = marker.getLngLat();
          routeSteerRef.current([point.lng, point.lat]);
        });
        waypointMarkerRef.current = marker;
      }
      waypointMarkerRef.current.setLngLat(waypoint.coordinate);
    } else {
      waypointMarkerRef.current?.remove();
      waypointMarkerRef.current = null;
    }
  }, [route, waypointNodeId, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    (map.getSource("happy") as GeoJSONSource | undefined)?.setData(routeGeoJSON(route));
    (map.getSource("baseline") as GeoJSONSource | undefined)?.setData(routeGeoJSON(result?.baseline));
    (map.getSource("route-shade") as GeoJSONSource | undefined)?.setData(shadeSegments);
    (map.getSource("route-cover") as GeoJSONSource | undefined)?.setData(coverRouteSegments);
    (map.getSource("planner-selection") as GeoJSONSource | undefined)?.setData(plannerScenario?.selection.geojson ?? { type: "FeatureCollection", features: [] });
    (map.getSource("endpoints") as GeoJSONSource | undefined)?.setData(endpointsGeoJSON(route));
    (map.getSource("assets") as GeoJSONSource | undefined)?.setData(assetsGeoJSON(activeAssets, activeAsset?.id));
    (map.getSource("overview-assets") as GeoJSONSource | undefined)?.setData(overviewAssets);
    map.setLayoutProperty("baseline", "visibility", showBaseline && result?.baseline && mapLens === "route" ? "visible" : "none");
    map.setLayoutProperty("endpoints", "visibility", "none");
    map.setLayoutProperty("happy", "visibility", mapLens === "route" ? "visible" : "none");
    map.setLayoutProperty("route-shade", "visibility", route && mapLens === "shade" ? "visible" : "none");
    map.setLayoutProperty("route-cover", "visibility", route && mapLens === "cover" ? "visible" : "none");
    map.setLayoutProperty("demo-cover", "visibility", mapLens === "cover" ? "visible" : "none");
    map.setLayoutProperty("demo-cover-casing", "visibility", mapLens === "cover" ? "visible" : "none");
    const showSelection = appMode === "planner" && mapLens === "shade" && Boolean(plannerScenario);
    map.setLayoutProperty("planner-selection", "visibility", showSelection ? "visible" : "none");
    map.setLayoutProperty("planner-selection-casing", "visibility", showSelection ? "visible" : "none");
    const showAmenityClusters = appMode === "planner" && mapLens === "amenities";
    ["overview-clusters", "overview-cluster-count"].forEach((layer) => map.getLayer(layer) && map.setLayoutProperty(layer, "visibility", showAmenityClusters ? "visible" : "none"));
    if (map.getLayer("overview-icons")) map.setLayoutProperty("overview-icons", "visibility", "visible");
    map.setLayoutProperty("amenity-coverage", "visibility", appMode === "planner" && mapLens === "amenities" ? "visible" : "none");
  }, [route, result, showBaseline, activeAssets, activeAsset?.id, overviewAssets, shadeSegments, coverRouteSegments, plannerScenario, mapLens, appMode, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!route || !map?.isStyleLoaded()) return;
    map.fitBounds(boundsForRoute(route), { padding: { top: 90, right: 70, bottom: 90, left: window.innerWidth > 800 ? 460 : 70 }, maxZoom: appMode === "planner" ? 15.3 : 16, duration: 650 });
  }, [route?.candidateId, appMode, mapReady]);

  useEffect(() => {
    if (mapLens !== "shade" || (!route && appMode !== "planner")) {
      if (mapRef.current?.getLayer("building-shadows")) mapRef.current.setLayoutProperty("building-shadows", "visibility", "none");
      return;
    }
    const roundedHour = Math.max(7, Math.min(19, Math.round(shadeHour)));
    const load = shadowModules[`./data/shadows/hour-${roundedHour}.json`];
    if (!load || !mapRef.current?.isStyleLoaded()) return;
    let cancelled = false;
    load().then((module) => {
      if (cancelled) return;
      mapRef.current?.setLayoutProperty("building-shadows", "visibility", "visible");
      (mapRef.current?.getSource("building-shadows") as GeoJSONSource | undefined)?.setData((module as { default: never }).default);
    });
    return () => { cancelled = true; };
  }, [route, shadeHour, mapLens, appMode, mapReady]);

  const assetPopoverOpensLeft = Boolean(activeAssetPoint && activeAssetPoint.x > window.innerWidth - 320);
  const assetPopoverStyle = activeAssetPoint ? {
    "--asset-popover-left": `${Math.max(16, assetPopoverOpensLeft ? activeAssetPoint.x - 296 : activeAssetPoint.x + 18)}px`,
    "--asset-popover-top": `${Math.max(72, Math.min(window.innerHeight - 190, activeAssetPoint.y - 34))}px`,
  } as CSSProperties : undefined;

  const coverPopoverStyle = activeCoverPoint ? {
    "--asset-popover-left": `${Math.max(16, activeCoverPoint.x > window.innerWidth - 320 ? activeCoverPoint.x - 296 : activeCoverPoint.x + 18)}px`,
    "--asset-popover-top": `${Math.max(72, Math.min(window.innerHeight - 190, activeCoverPoint.y - 34))}px`,
  } as CSSProperties : undefined;

  const switchMode = (mode: AppMode) => {
    setAppMode(mode);
    setDetail(null);
    setActiveAsset(null);
    setActiveAssetPoint(null);
    setActiveCover(null);
    setActiveCoverPoint(null);
    setEditRoute(false);
    setMapLens(mode === "planner" ? (route ? "shade" : "amenities") : rainContext ? "cover" : "route");
  };

  return <main className={`${route ? "has-result" : "is-compose"} mode-${appMode}`}>
    <div className="map-shell"><div className="map" ref={mapContainer} /><div className="map-wash" />{mapError && <FallbackMap graph={pilotGraph} route={route} lens={mapLens} shadeSegments={shadeSegments} coverSegments={coverRouteSegments} ambientCover={ambientCoverLayer} selection={appMode === "planner" ? plannerScenario?.selection.geojson : null} assets={allMapAssets} prominentAssetIds={activeAssets.map((asset) => asset.id)} selectedAssetId={activeAsset?.id} onAssetClick={(asset) => { setActiveAsset(asset); setActiveAssetPoint({ x: Math.round(window.innerWidth * .68), y: 160 }); }} />}</div>
    <div className="top-bar"><div className="brand-cluster"><Brand /><nav className="mode-switch" aria-label="Happy Path mode"><button type="button" className={appMode === "walk" ? "active" : ""} onClick={() => switchMode("walk")}>Walk</button><button type="button" className={appMode === "planner" ? "active" : ""} onClick={() => switchMode("planner")}>City what-if</button></nav></div><div className="map-actions">{!mapError && <IconButton label="Center map" onClick={() => mapRef.current?.easeTo({ center: nodeById.get(originNodeId)?.coordinate, zoom: 14.5 })}><LocateIcon /></IconButton>}{route && appMode === "walk" && <IconButton label="Map details" onClick={() => { setActiveAsset(null); setActiveAssetPoint(null); setDetail("data"); }}><LayersIcon /></IconButton>}</div></div>
    {appMode === "planner"
      ? <PlannerSheet route={route} scenario={plannerScenario} lens={mapLens} onLensChange={setMapLens} targetShade={plannerShadeTarget} onTargetShadeChange={setPlannerShadeTarget} onBack={() => switchMode("walk")} onUseSample={() => void usePlannerSample()} onPlannerPrompt={handlePlannerPrompt} />
      : !route
        ? <ComposeSheet brief={brief} setBrief={setBrief} prompt={prompt} setPrompt={setPrompt} originText={originText} setOriginText={setOriginText} destinationText={destinationText} setDestinationText={setDestinationText} busy={busy} error={error} onPlan={() => plan()} />
        : result && <ResultSheet brief={brief} route={route} result={result} assets={activeAssets} destinationText={destinationText} setDestinationText={setDestinationText} delta={delta} error={error} onBack={startNewWalk} onRefine={(value) => plan(value, true)} onAdjust={adjust} onShowWhy={() => { setActiveAsset(null); setActiveAssetPoint(null); setDetail("why"); }} onShowAsset={(asset) => { setActiveAsset(asset); setActiveAssetPoint(null); setDetail("asset"); }} onShowData={() => { setActiveAsset(null); setActiveAssetPoint(null); setDetail("data"); }} onOpenPlanner={() => switchMode("planner")} detourScenario={detourScenario} showBaseline={showBaseline} setShowBaseline={setShowBaseline} busy={busy} modelFallback={modelFallback} rainContext={rainContext} />}
    {appMode === "walk" && detail && route && <DetailPanel mode={detail} brief={brief} route={route} assets={activeAssets} activeAsset={activeAsset} detourScenario={detourScenario} onClose={() => { setDetail(null); if (detail === "asset") { setActiveAsset(null); setActiveAssetPoint(null); } }} />}
    {activeAsset && detail !== "asset" && <aside className={`asset-popover ${assetPopoverOpensLeft ? "opens-left" : ""}`} style={assetPopoverStyle} role="dialog" aria-label={assetTypeLabel(activeAsset)}><div><AssetIcon kind={activeAsset.kind} /><IconButton label="Close" onClick={() => { setActiveAsset(null); setActiveAssetPoint(null); }}><CloseIcon /></IconButton></div><span className="eyebrow">{appMode === "planner" ? "Mapped place" : "Near your walk"}</span><h3>{assetTypeLabel(activeAsset)}</h3><p>{activeAsset.locationLabel}</p><small>{assetAvailabilityCopy(activeAsset)}</small><small className="source-freshness">{civicAssetEvidence(activeAsset).freshnessLabel}</small>{appMode === "walk" && (activeAsset.kind === "restroom" || activeAsset.kind === "transit") && <button type="button" className="asset-more" onClick={() => setDetail("asset")}>See details</button>}</aside>}
    {activeCover && <aside className="asset-popover cover-popover" style={coverPopoverStyle} role="dialog" aria-label="Simulated cover"><div><UmbrellaIcon /><IconButton label="Close" onClick={() => { setActiveCover(null); setActiveCoverPoint(null); }}><CloseIcon /></IconButton></div><span className="eyebrow">Simulated cover scenario</span><h3>{activeCover.label}</h3><p>{activeCover.street}</p><small>{activeCover.proofLabel}. A production route would need current shed, awning, arcade, and construction data.</small></aside>}
    {(route || appMode === "planner") && <MapLensControl lens={mapLens} onChange={(lens) => { setMapLens(lens); setEditRoute(false); }} hour={shadeHour} onHourChange={setShadeHour} showCover={rainContext} planner={appMode === "planner"} canEdit={!mapError} editing={editRoute} onEditingChange={(editing) => { setEditRoute(editing); if (editing) setMapLens("route"); }} />}
    {route && <div className="map-key" aria-hidden="true">{mapLens === "route" ? <span><i className="route-key" />Happy Path</span> : mapLens === "shade" ? <><span><i className="shade-deep-key" />More shade</span><span><i className="sun-key" />More sun</span></> : mapLens === "cover" ? <><span><i className="cover-key" />Simulated cover</span><span><i className="sun-key" />No simulated cover</span></> : <span><i className="amenity-key" />Mapped places</span>}</div>}
  </main>;
}
