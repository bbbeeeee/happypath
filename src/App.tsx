import { FormEvent, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent } from "maplibre-gl";
import { defaultDestination, defaultOrigin, isInsidePilot, nearestGraphNode, pilotGraph } from "./data/cityGraph";
import { findCivicAssetsNearRoute, loadCivicAssetFixture, type CivicAsset, type CivicAssetKind } from "./data/civicAssets";
import { createSessionCivicObservation, findCivicTasksNearRoute, listCivicTasks, loadCivicTaskFixture, type CivicTask, type SessionCivicObservation } from "./data/civicTasks";
import { getMapLayerDefinition } from "./data/mapLayerCatalog";
import { sourceRegistryPresentation, type SourceRegistryPresentation } from "./data/sourceRegistry";
import { getPilotTransitEndpointCandidates } from "./data/transitEndpoints";
import { amenitiesForViewport, amenityClusterCellMeters, amenityOverviewGeoJSON, AMENITY_CLUSTER_COUNT_LAYOUT, type AmenityViewport } from "./amenityOverview";
import { rainPromptIntent, routeShadeSegmentsGeoJSON } from "./climatePresentation";
import { buildShadeDetourScenario, evaluateShadeDetourScenario, type ShadeDetourScenario } from "./detour/shadeScenario";
import { demoCoverGeoJSON, demoCoverShare, pickRainFriendlyRoute, routeCoverSegmentsGeoJSON, routeCoverShare } from "./demoCover";
import { searchNycAddress } from "./geocoding";
import { briefSummary, DEFAULT_BRIEF, distanceMilesToRoutingMinutes, mergeTripBrief, metersToMiles, withDestinationOverride, type RoutePriority, type TripBrief as UiTripBrief } from "./planning/tripBrief";
import { interpretTripBrief } from "./planning/interpretTripBrief";
import { buildRouteCityInsightRequest, requestRouteCityInsight } from "./planning/cityInsight";
import { selectRouteThroughOptionalCivicTask } from "./planning/civicTaskRouting";
import { JourneyPlanningError, planJourney, rerouteJourneyThroughWaypoint, type PlannedJourneyResult } from "./routing/journey";
import type { Coordinate, JourneyRoute, TripBrief as RoutingTripBrief } from "./types";
import type { RouteCityInsight } from "../server/insights";
import { assetAvailabilityCopy, assetMarkerSvg, assetsGeoJSON, assetTypeLabel, civicTaskMarkerSvg, civicTasksGeoJSON, endpointsGeoJSON, routeGeoJSON } from "./mapPresentation";
import { civicAssetEvidence } from "./presentationEvidence";
import { DEFAULT_MAP_OVERLAYS, toggledMapOverlay, type MapOverlays } from "./mapLayerState";
import {
  ArrowIcon,
  BackIcon,
  BenchIcon,
  CameraIcon,
  CheckCircleIcon,
  ChevronIcon,
  CloudRainIcon,
  ClockIcon,
  CloseIcon,
  DropletIcon,
  ExternalLinkIcon,
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
import { ThinkingStatus, type ThinkingMode } from "./components/ThinkingStatus";

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const nodeById = new Map(pilotGraph.nodes.map((node) => [node.id, node]));
const shadowModules = import.meta.glob("./data/shadows/hour-*.json");
const civicFixture = loadCivicAssetFixture();
const civicTaskFixture = loadCivicTaskFixture();
const allCivicTasks = listCivicTasks();
const civicTaskLayer = getMapLayerDefinition("civic_tasks");
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
  "I have 20 minutes. Walk me to Washington Square with less direct sun.",
  "I’m free for half an hour. Give me a green loop with somewhere to sit.",
  "I have 30 minutes. Let me wander west and finish near a train.",
  "It’s raining and I have 25 minutes. Find a walk with more cover.",
  "I have 25 minutes. Find a walk where I can help verify city data.",
  "Map me a shaded 2-mile run that loops back here.",
] as const;

const EXAMPLE_SHORTCUTS = [
  { label: "Get somewhere", prompt: EXAMPLE_REQUESTS[0] },
  { label: "Take a loop", prompt: EXAMPLE_REQUESTS[1] },
  { label: "Just wander", prompt: EXAMPLE_REQUESTS[2] },
  { label: "Stay drier", prompt: EXAMPLE_REQUESTS[3] },
  { label: "Help the map", prompt: EXAMPLE_REQUESTS[4] },
  { label: "Go for a run", prompt: EXAMPLE_REQUESTS[5] },
] as const;

const INITIAL_MAP_VIEWPORT: AmenityViewport = {
  west: -74.014,
  south: 40.716,
  east: -73.98,
  north: 40.746,
  zoom: 14.2,
};

type AppMode = "walk" | "planner";
type MapLens = "route" | "shade" | "cover" | "amenities" | "tasks";

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

function formatMiles(value: number) {
  return value.toFixed(1);
}

function formatClock(hour: number) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 || 12;
  return `${display}:00 ${suffix}`;
}

function friendlyNodeName(value: string | undefined) {
  if (!value) return "Start here";
  const eastWestJoin = value.match(/^(?:West|East) (.+?) & (?:East|West) \1$/i);
  return eastWestJoin ? `${eastWestJoin[1]} & 5th Avenue` : value;
}

function friendlyRouteLocation(route: JourneyRoute) {
  const street = route.streets.find((value) => value.trim() && !/^(?:unnamed|unknown|unmapped)|pedestrian\s+(?:way|path)$/i.test(value.trim()));
  return street?.trim() || "This part of the walk";
}

function friendlyLimitation(value: string) {
  const item = value.replace(/[.\s]+$/g, "");
  if (/curb ramps|ADA|accessib|wheelchair|mobility|stroller/i.test(item)) {
    return "Known stairs are avoided. Curb ramps, slopes, and temporary obstacles can change.";
  }
  if (/safe(?:st|ty)|safety ranking/i.test(item)) {
    return "We don’t rate streets by safety yet.";
  }
  if (/quiet|noise|crowd/i.test(item)) {
    return "Crowd and noise levels aren’t live yet.";
  }
  if (/amenity operation|open now|current operation/i.test(item)) {
    return "Opening hours and current availability may have changed.";
  }
  if (/construction/i.test(item)) {
    return "Construction details aren’t live yet.";
  }
  if (/0\.25 to 5 miles/i.test(item)) {
    return "For now, routes can be planned from 0.25 to 5 miles.";
  }
  if (/fixed destination and exact distance/i.test(item)) {
    return "When a destination and exact distance conflict, the destination comes first.";
  }
  return `${item}.`;
}

function limitationHeading(values: readonly string[]) {
  const joined = values.join(" ");
  if (/curb ramps|ADA|accessib|wheelchair|mobility|stroller/i.test(joined)) return "A quick note about step-free access";
  if (/safe(?:st|ty)|quiet|noise|crowd|operation|open now|construction/i.test(joined)) return "A quick note about live conditions";
  return "One thing to know";
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

function relevantCivicTasks(route: JourneyRoute, brief: UiTripBrief) {
  return findCivicTasksNearRoute(route.coordinates, {
    intent: brief.civicTaskIntent,
    maxDistanceMeters: brief.civicTaskIntent ? 70 : 45,
    limit: brief.civicTaskIntent ? 3 : 1,
  }).map((candidate) => candidate.task);
}

function uniqueSourcePresentations(sourceIds: readonly string[]) {
  return [...new Set(sourceIds)]
    .map((sourceId) => sourceRegistryPresentation(sourceId))
    .filter((source): source is SourceRegistryPresentation => Boolean(source));
}

function usedSourcePresentations(brief: UiTripBrief, assets: readonly CivicAsset[], rainContext = false, tasks: readonly CivicTask[] = []) {
  return uniqueSourcePresentations([
    "openstreetmap",
    ...(rainContext ? ["demo-cover-simulation"] : []),
    ...(brief.priorities.includes("shade") ? ["nyc-building-footprints", "building-shadow-model"] : []),
    ...(brief.priorities.includes("greenery") ? ["nyc-forestry-tree-points", "nyc-parks-properties", "greenery-edge-model"] : []),
    ...assets.map((asset) => asset.sourceId),
    ...tasks.flatMap((task) => task.sourceIds),
  ]);
}

function referenceSourcePresentations(brief: UiTripBrief, rainContext: boolean) {
  const priorityIds = [
    ...(rainContext || brief.priorities.includes("construction") ? ["nyc-sidewalk-shed-permits"] : []),
    ...(brief.avoidMappedSteps ? ["nyc-pedestrian-ramps"] : []),
  ];
  return uniqueSourcePresentations([
    ...priorityIds,
    "nyc-pedestrian-ramps",
    "nyc-sidewalk-shed-permits",
    "nyc-dot-pedestrian-plazas",
    "nyc-pops",
  ]).slice(0, 4);
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

function routingOptions(brief: UiTripBrief, rainFriendly: boolean) {
  return {
    walkingTimeIntent: brief.walkingTimeIntent,
    edgePreference: rainFriendly ? {
      id: "likely_cover_demo",
      weight: 1,
      score: demoCoverShare,
    } : undefined,
  } as const;
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
    return { ...common, journeyShape: "loop", walkingBudgetMinutes: brief.distanceMiles === null ? brief.walkingMinutes : distanceMilesToRoutingMinutes(brief.distanceMiles) };
  }
  return {
    ...common,
    journeyShape: "wander",
    walkingBudgetMinutes: brief.distanceMiles === null ? brief.walkingMinutes : distanceMilesToRoutingMinutes(brief.distanceMiles),
    direction: brief.direction ?? undefined,
    endCondition: brief.endCondition === "transit"
      ? { nodeIds: [...new Set(transitEndpoints.map((candidate) => candidate.graphNodeId))], label: "near a subway entrance" }
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
    distanceMiles: shape === "destination" ? null : brief.distanceMiles,
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
    <div className="control-group"><span>Route shape</span><Segmented value={brief.shape} label="Route shape" options={[{ value: "destination", label: "Somewhere" }, { value: "loop", label: "Loop" }, { value: "wander", label: "Wander" }]} onChange={changeShape} /></div>
    {brief.shape === "destination" && <label className="destination-control"><span>Destination</span><input aria-label="Destination" value={destinationText} onChange={(event) => onDestinationTextChange(event.target.value)} placeholder="Where are you going?" /></label>}
    <div className="quick-picks" aria-label="What matters">
      {(["shade", "greenery", "rest", "water", "restroom"] as RoutePriority[]).map((priority) => {
        const meta = PRIORITY_META[priority];
        const PriorityIcon = meta.icon;
        return <button type="button" key={priority} className={brief.priorities.includes(priority) ? "active" : ""} aria-pressed={brief.priorities.includes(priority)} onClick={() => togglePriority(priority)}><PriorityIcon />{meta.label}</button>;
      })}
      <button type="button" className={brief.avoidMappedSteps ? "active" : ""} aria-pressed={brief.avoidMappedSteps} onClick={() => patchBrief({ avoidMappedSteps: !brief.avoidMappedSteps })}><StairsIcon />Avoid known stairs</button>
    </div>
    <div className="trip-controls">
      <div className="time-control"><span>{brief.shape === "destination" ? "Extra time" : brief.distanceMiles !== null ? "Distance" : brief.walkingTimeIntent === "maximum" ? "Up to" : "About"}</span>{brief.shape === "destination"
        ? <Segmented value={String(brief.detourMinutes)} label="Extra time allowance" options={[{ value: "0", label: "Fastest" }, { value: "5", label: "+5 min" }, { value: "10", label: "+10 min" }]} onChange={(value) => patchBrief({ detourMinutes: Number(value) as 0 | 5 | 10 })} />
        : <>{brief.distanceMiles !== null
          ? <div className="custom-time distance-time"><button type="button" onClick={() => patchBrief({ distanceMiles: 1 })}>1</button><button type="button" onClick={() => patchBrief({ distanceMiles: 2 })}>2</button><label><input type="number" min="0.25" max="5" step="0.25" inputMode="decimal" aria-label="Custom route distance in miles" value={brief.distanceMiles} onChange={(event) => patchBrief({ distanceMiles: Number(event.target.value), walkingTimeIntent: "target" })} /><span>mi</span></label></div>
          : <div className="custom-time"><button type="button" onClick={() => patchBrief({ walkingMinutes: 20, walkingTimeIntent: "target", distanceMiles: null })}>20</button><button type="button" onClick={() => patchBrief({ walkingMinutes: 30, walkingTimeIntent: "target", distanceMiles: null })}>30</button><label><input type="number" min="10" max="60" inputMode="numeric" aria-label="Custom walking time in minutes" value={brief.walkingMinutes} onChange={(event) => patchBrief({ walkingMinutes: Number(event.target.value), walkingTimeIntent: "target", distanceMiles: null })} /><span>min</span></label></div>}
          <button type="button" className="constraint-switch" onClick={() => patchBrief({ distanceMiles: brief.distanceMiles === null ? 2 : null, walkingTimeIntent: "target" })}>{brief.distanceMiles === null ? "Use distance" : "Use time"}</button></>}</div>
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
  busyMode: ThinkingMode | null;
  error: string;
  onPlan: () => void;
}

function ComposeSheet({ brief, setBrief, prompt, setPrompt, originText, setOriginText, destinationText, setDestinationText, busy, busyMode, error, onPlan }: ComposeSheetProps) {
  const [manualChanged, setManualChanged] = useState(false);
  const animatedPlaceholder = useTypingPlaceholder(EXAMPLE_REQUESTS);
  const setManualBrief = (nextBrief: UiTripBrief) => { setManualChanged(true); setBrief(nextBrief); };
  return <section className="sheet compose-sheet" aria-label="Plan a route">
    <div className="sheet-handle" />
    <div className="compose-heading"><span className="eyebrow">Plan a better walk</span><h1>What are you up to?</h1></div>
    <div className="location-stack">
      <label className="location-input"><span className="location-dot origin-dot" /><span className="field-label">From</span><input aria-label="Starting point" value={originText} disabled={busy} onChange={(event) => setOriginText(event.target.value)} /></label>
      <label className="location-input"><span className="location-dot destination-dot" /><span className="field-label">To</span><input aria-label="Destination" value={destinationText} disabled={busy} onChange={(event) => { setDestinationText(event.target.value); setManualChanged(true); }} placeholder="Optional — or ask for a loop or wander" /></label>
    </div>
    <label className="prompt-box">
      <SparkIcon />
      <textarea aria-label="Describe your route" value={prompt} disabled={busy} onChange={(event) => setPrompt(event.target.value)} placeholder={animatedPlaceholder || EXAMPLE_REQUESTS[0]} rows={4} />
    </label>
    <div className="prompt-shortcuts" aria-label="Example walk requests"><span>Try</span>{EXAMPLE_SHORTCUTS.map((example) => <button type="button" key={example.label} title={example.prompt} disabled={busy} onClick={() => setPrompt(example.prompt)}>{example.label}</button>)}</div>
    <details className="manual-details"><summary>Choose the details instead</summary><WalkControls brief={brief} onChange={setManualBrief} destinationText={destinationText} onDestinationTextChange={(value) => { setManualChanged(true); setDestinationText(value); }} /></details>
    {error && <p className="status-message error" role="alert">{error}</p>}
    {busy && <ThinkingStatus mode={busyMode ?? "plan"} />}
    <button type="button" className="primary-action" disabled={busy || (!prompt.trim() && !manualChanged && !destinationText.trim())} onClick={onPlan}><span>{busy ? "Finding your path…" : "Find my path"}</span><ArrowIcon /></button>
    <p className="privacy-note">Your request and route aren’t saved.</p>
  </section>;
}

function AssetIcon({ kind }: { kind: CivicAssetKind }) {
  if (kind === "seating") return <BenchIcon />;
  if (kind === "restroom") return <RestroomIcon />;
  if (kind === "transit") return <TrainIcon />;
  return <DropletIcon />;
}

function CivicTaskIcon({ task }: { task: CivicTask }) {
  return task.action === "photo" ? <CameraIcon /> : <CheckCircleIcon />;
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

async function registerCivicTaskMarkerImage(map: MapLibreMap) {
  if (map.hasImage("civic-task")) return;
  await new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.onload = () => { if (!map.hasImage("civic-task")) map.addImage("civic-task", image, { pixelRatio: 2 }); resolve(); };
    image.onerror = () => reject(new Error("Could not load the civic task map icon."));
    image.src = civicTaskMarkerSvg();
  });
}

function ResultSheet({ brief, route, result, assets, tasks, destinationText, setDestinationText, delta, error, onBack, onRefine, onAdjust, onShowWhy, onShowAsset, onShowTask, onShowData, onOpenPlanner, detourScenario, showBaseline, setShowBaseline, busy, busyMode, modelFallback, rainContext }: {
  brief: UiTripBrief;
  route: JourneyRoute;
  result: PlannedJourneyResult;
  assets: CivicAsset[];
  tasks: CivicTask[];
  destinationText: string;
  setDestinationText: (value: string) => void;
  delta: string;
  error: string;
  onBack: () => void;
  onRefine: (value: string) => Promise<boolean>;
  onAdjust: (brief: UiTripBrief) => Promise<boolean>;
  onShowWhy: () => void;
  onShowAsset: (asset: CivicAsset) => void;
  onShowTask: (task: CivicTask) => void;
  onShowData: () => void;
  onOpenPlanner: () => void;
  detourScenario: ShadeDetourScenario | null;
  showBaseline: boolean;
  setShowBaseline: (value: boolean) => void;
  busy: boolean;
  busyMode: ThinkingMode | null;
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
  const routeMiles = metersToMiles(route.distanceMeters);
  const distanceDifferenceMiles = brief.distanceMiles === null ? null : routeMiles - brief.distanceMiles;
  const headline = rainContext
    ? "A little more cover for a rainy day"
    : brief.civicTaskIntent && tasks.length
      ? "A route with one small way to help"
    : brief.activity === "run"
      ? brief.distanceMiles !== null
        ? brief.priorities.includes("shade") ? "A shaded run, right around your goal" : "A run that fits your distance"
        : brief.priorities.includes("shade") ? "A shaded run that fits your time" : "A run planned around your time"
    : primary === "shade"
    ? route.directSunMinutes < 0.05
      ? "No direct sun expected at this time"
      : sunSaved !== null && sunSaved >= 0.05
        ? "A little longer, less direct sun"
        : "Shade checked, without an extra detour"
    : primary === "greenery" ? "A greener way through" : assets.length ? "Useful stops, kept close" : "A considered way through";
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!refinement.trim()) return; if (await onRefine(refinement)) setRefinement(""); };
  const applyAdjustments = async () => { if (await onAdjust(draftBrief)) setShowAdjustments(false); };
  const summary = [...briefSummary(brief), rainContext ? "Rain-friendly" : null, `Leaving ${formatClock(brief.departureHour)}`].filter(Boolean) as string[];
  const roundedExtraMinutes = Math.round(route.extraMinutesVsBaseline ?? 0);
  const destinationTiming = roundedExtraMinutes > 0
    ? `${Math.round(route.durationMinutes)} minutes · ${roundedExtraMinutes} min longer than fastest`
    : `${Math.round(route.durationMinutes)} minutes · same walking time as fastest`;
  const routeTiming = brief.distanceMiles !== null
    ? `${formatMiles(routeMiles)}-mile ${brief.activity} · ${result.timing.status === "closest-feasible" ? `closest to your ${brief.distanceMiles}-mile goal` : `about your ${brief.distanceMiles}-mile goal`}`
    : brief.shape === "loop"
      ? `${Math.round(route.durationMinutes)}-minute loop · about ${brief.walkingMinutes} minutes`
    : brief.shape === "wander"
        ? `${Math.round(route.durationMinutes)}-minute walk · ${brief.walkingTimeIntent === "maximum" ? `under ${brief.walkingMinutes} minutes` : `planned for about ${brief.walkingMinutes} minutes`}`
        : destinationTiming;
  const hasDistinctBaseline = Boolean(result.baseline && result.baseline.candidateId !== route.candidateId);
  const timingDifference = Math.abs(Math.round(result.timing.differenceMinutes ?? 0));
  const usedSourceCount = usedSourcePresentations(brief, assets, rainContext, tasks).length;
  return <section className="sheet result-sheet" aria-label="Your Happy Path">
    <div className="sheet-handle" />
    <div className="result-nav"><IconButton label="Plan a new route" onClick={onBack}><BackIcon /></IconButton><span>Your Happy Path</span><span className="result-time">{brief.distanceMiles !== null ? `${formatMiles(routeMiles)} mi` : formatMinutes(route.durationMinutes)}</span></div>
    {busy && <ThinkingStatus mode={busyMode ?? "refine"} />}
    {delta && <div className="route-delta"><SparkIcon />Route updated · {delta}</div>}
    <div className="result-lead"><h1>{headline}</h1><p>{routeTiming}</p></div>
    {result.timing.status === "closest-feasible" && <div className="timing-note" role="status">{brief.distanceMiles !== null ? <RouteIcon /> : <ClockIcon />}<span><strong>Closest route we could make</strong><small>{brief.distanceMiles !== null && distanceDifferenceMiles !== null ? `${Math.abs(distanceDifferenceMiles).toFixed(1)} miles ${distanceDifferenceMiles < 0 ? "shorter" : "longer"} than requested.` : `${timingDifference} minutes ${route.durationMinutes < (result.timing.requestedMinutes ?? 0) ? "shorter" : "longer"} than requested.`}</small></span></div>}
    <div className="intent-summary"><div><span className="eyebrow">Your plan</span><strong className="brief-sentence">{summary[0]}</strong><small>{summary.slice(1).join(" · ")}</small></div><button type="button" onClick={() => setShowAdjustments((value) => !value)} aria-expanded={showAdjustments}>{showAdjustments ? "Close" : "Edit"}</button></div>
    {showAdjustments && <div className="adjust-panel"><WalkControls brief={draftBrief} onChange={setDraftBrief} destinationText={destinationText} onDestinationTextChange={(value) => { setDestinationText(value); setDraftBrief((current) => mergeTripBrief(current, { destinationQuery: value.trim() || null }, "controls")); }} /><button type="button" className="apply-adjustments" disabled={busy} onClick={applyAdjustments}>{busy ? "Updating your walk…" : "Update this walk"}</button></div>}
    <div className="benefit-list">
      {rainContext && <button type="button" onClick={onShowData}><CloudRainIcon /><span><strong>More cover along the way</strong><small>Likely-covered stretches are highlighted on the map</small></span><ChevronIcon /></button>}
      {brief.priorities.includes("shade") && <button type="button" onClick={onShowWhy}><SunIcon /><span>{route.directSunMinutes < 0.05 ? <><strong>A naturally cool departure</strong><small>No direct sun expected at {formatClock(brief.departureHour)}</small></> : sunSaved !== null && sunSaved >= 0.05 ? <><strong>{sunSaved.toFixed(1)} fewer min in the sun</strong><small>compared with the quickest route</small></> : <><strong>{route.shadePercent.toFixed(0)}% in shade</strong><small>around {formatClock(brief.departureHour)}, based on sun and buildings</small></>}</span><ChevronIcon /></button>}
      {brief.priorities.includes("greenery") && <button type="button" onClick={onShowWhy}><LeafIcon /><span>{greenGain !== null && greenGain >= 0.5 ? <><strong>{greenGain.toFixed(0)} points greener</strong><small>than the quickest route</small></> : <><strong>Trees and parks along {route.greeneryPercent.toFixed(0)}% of the way</strong><small>drawn from nearby city listings</small></>}</span><ChevronIcon /></button>}
      {assets.slice(0, 2).map((asset) => <button type="button" key={asset.id} onClick={() => onShowAsset(asset)}><AssetIcon kind={asset.kind} /><span><strong>{asset.name}</strong><small>Right along your route · details may have changed</small></span><ChevronIcon /></button>)}
      {brief.avoidMappedSteps && <button type="button" onClick={onShowWhy}><StairsIcon /><span><strong>Skips known stairs</strong><small>Check curb ramps and street conditions as you go</small></span><ChevronIcon /></button>}
    </div>
    {tasks[0] && <button type="button" className="civic-task-card" onClick={() => onShowTask(tasks[0])}><span className="task-icon"><CivicTaskIcon task={tasks[0]} /></span><span><small>Optional stop · {tasks[0].estimatedMinutes} min</small><strong>{tasks[0].title}</strong><span>{tasks[0].locationLabel}</span></span><ChevronIcon /></button>}
    {brief.civicTaskIntent && tasks.length === 0 && <div className="coverage-note task-miss"><strong>No quick data check fit this walk</strong><span>Your path stays the same. Add a little time if you’d like one along the way.</span></div>}
    {missingAmenities.length > 0 && <div className="coverage-note"><strong>No {missingAmenities.map((kind) => ({ seating: "place to sit", restroom: "restroom", drinking_fountain: "water stop", transit: "subway entrance" })[kind]).join(" or ")} spotted along this path</strong><span>Nearby listings can miss recent changes.</span></div>}
    <div className="confidence-row"><span className="confidence-dot" /><p><strong>Made around what matters to you</strong><small>{brief.priorities.includes("shade") ? "Shade, timing, and useful stops are folded into this path." : "Timing and useful stops are folded into this path."}</small></p></div>
    {result.baseline && hasDistinctBaseline && <button type="button" className="text-action" onClick={() => setShowBaseline(!showBaseline)}><span className="baseline-swatch" />{showBaseline ? "Hide" : "Compare with"} fastest · {formatMinutes(result.baseline.durationMinutes)}</button>}
    {brief.unsupported.length > 0 && <details className="request-limit"><summary>{limitationHeading(brief.unsupported)}</summary><p>{brief.unsupported.map(friendlyLimitation).join(" ")}</p></details>}
    <button type="button" className="data-action" onClick={onShowData}><LayersIcon /><span><strong>What shaped this path</strong><small>Shade, places, and street details from {usedSourceCount} linked {usedSourceCount === 1 ? "source" : "sources"}</small></span><ChevronIcon /></button>
    {detourScenario && detourScenario.avoidedDirectSunMinutes >= 0.05 && <button type="button" className="detour-action" onClick={onOpenPlanner}><MapIcon /><span><strong>Imagine an even better block</strong><small>See where more shade, cover, or useful places could change the walk</small></span><ChevronIcon /></button>}
    <form className="refine-box" onSubmit={submit}><SparkIcon /><input value={refinement} disabled={busy} onChange={(event) => setRefinement(event.target.value)} placeholder="Shorter, but keep the bathroom…" aria-label="Refine this route" /><button disabled={busy || !refinement.trim()} aria-label="Update route"><ArrowIcon /></button></form>
    {error && <p className="status-message error" role="alert">{error}</p>}
    {modelFallback && <p className="status-message subtle">We used built-in trip understanding this time. You can adjust the details above.</p>}
  </section>;
}

type DetailMode = "why" | "data" | "detour" | "asset" | "task";

function AssetDetails({ asset }: { asset: CivicAsset }) {
  const evidence = civicAssetEvidence(asset);
  const source = sourceRegistryPresentation(asset.sourceId);
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
    {source && <a className="asset-source-link" href={source.officialUrl} target="_blank" rel="noreferrer"><span>View the official dataset</span><ExternalLinkIcon /></a>}
  </>;
}

function SourceRow({ source }: { source: SourceRegistryPresentation }) {
  return <article className="source-row">
    <a href={source.officialUrl} target="_blank" rel="noreferrer">
      <span>{source.publisher}</span>
      <strong>{source.title}<ExternalLinkIcon /></strong>
      <small>{source.availabilityLabel} · {source.freshnessLabel}</small>
    </a>
    <details><summary>Coverage &amp; limits</summary><p>{source.coverageLabel} {source.claimBoundary}</p></details>
  </article>;
}

function CivicTaskDetails({ task, observation, onComplete, onRemove }: {
  task: CivicTask;
  observation: SessionCivicObservation | null;
  onComplete: (response: string) => void;
  onRemove: () => void;
}) {
  const [photoName, setPhotoName] = useState("");
  const sources = uniqueSourcePresentations(task.sourceIds);
  return <>
    <div className="asset-detail-title task-detail-title"><CivicTaskIcon task={task} /><span><span className="eyebrow">Optional city data check</span><h2>{task.title}</h2></span></div>
    <p>{task.locationLabel} · about {task.estimatedMinutes} {task.estimatedMinutes === 1 ? "minute" : "minutes"}</p>
    <div className="task-prompt"><strong>{task.prompt}</strong></div>
    <div className="task-safety"><small>Before you start</small><p>{task.safetyNote}</p>{task.photoGuidance && <p>{task.photoGuidance}</p>}</div>
    {observation ? <div className="task-thanks" role="status"><CheckCircleIcon /><span><strong>Thanks—that helps.</strong><p>Saved for this demo session. Not sent to NYC.</p><button type="button" onClick={onRemove}>Remove my observation</button></span></div> : task.action === "photo" ? <div className="task-response photo-response">
      <label><CameraIcon /><span><strong>{photoName || "Choose a photo"}</strong><small>The file stays on this device and is discarded when this panel closes.</small></span><input type="file" accept="image/*" capture="environment" onChange={(event) => setPhotoName(event.target.files?.[0]?.name ?? "")} /></label>
      <button type="button" className="apply-adjustments" disabled={!photoName} onClick={() => onComplete(task.responseOptions[0])}>Use for this demo check</button>
    </div> : <div className="task-response"><span>What did you notice?</span>{task.responseOptions.map((response) => <button type="button" key={response} onClick={() => onComplete(response)}>{response}</button>)}</div>}
    <details className="task-about"><summary>Why this check is here</summary><div><strong>{task.purpose}</strong><p>{task.downstreamUse}</p><small>Demo check from {civicTaskFixture.publisher.name}. Not an NYC request, work order, or reported problem.</small>{observation && <small>This session observation expires {new Date(observation.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}.</small>}<div className="task-source-list">{sources.map((source) => <SourceRow key={source.id} source={source} />)}</div></div></details>
    <p className="task-emergency-note">For hazards, use 311—or 911 in an emergency.</p>
  </>;
}

function DetailPanel({ mode, brief, route, assets, tasks, activeAsset, activeTask, taskObservation, detourScenario, rainContext, onCompleteTask, onRemoveTaskObservation, onClose }: { mode: DetailMode; brief: UiTripBrief; route: JourneyRoute; assets: CivicAsset[]; tasks: CivicTask[]; activeAsset: CivicAsset | null; activeTask: CivicTask | null; taskObservation: SessionCivicObservation | null; detourScenario: ShadeDetourScenario | null; rainContext: boolean; onCompleteTask: (response: string) => void; onRemoveTaskObservation: () => void; onClose: () => void }) {
  const label = mode === "why" ? "Why this way" : mode === "data" ? "What shaped this path" : mode === "asset" ? activeAsset?.name ?? "Place details" : mode === "task" ? activeTask?.title ?? "City data check" : "City planning what-if";
  const usedSources = usedSourcePresentations(brief, assets, rainContext, tasks);
  const referenceSources = referenceSourcePresentations(brief, rainContext);
  return <aside className="detail-panel" role="dialog" aria-modal="true" aria-label={label}>
    <div className="detail-header"><span className="eyebrow">{mode === "why" ? "Why this way?" : mode === "data" ? "What shaped this path" : mode === "asset" ? "Along your walk" : mode === "task" ? "Help along the way" : "A planning what-if"}</span><IconButton label="Close" onClick={onClose}><CloseIcon /></IconButton></div>
    {mode === "why" ? <>
      <h2>{friendlyRouteLocation(route)} fits what you asked for.</h2>
      <p>{brief.priorities.includes("shade") ? `About ${Math.round(route.shadePercent)}% of this walk should be shaded around ${formatClock(brief.departureHour)}.` : "This path balances your timing with the places and qualities you asked for."}</p>
      <div className="evidence-cards">
        {brief.priorities.includes("shade") && <article><SunIcon /><span><strong>Shade around {formatClock(brief.departureHour)}</strong><small>Estimated from the sun and nearby buildings. Open the sources below to see how it was made.</small></span></article>}
        {brief.priorities.includes("greenery") && <article><LeafIcon /><span><strong>Trees and parks nearby</strong><small>{route.nearbyTreeCount} tree listings{route.adjacentParkNames.length ? ` plus ${route.adjacentParkNames.slice(0, 2).join(", ")}` : ""}. Street conditions can change.</small></span></article>}
        {assets.map((asset) => <article key={asset.id}><AssetIcon kind={asset.kind} /><span><strong>{asset.name}</strong><small>{asset.locationLabel}. From a city listing; details may have changed.</small></span></article>)}
      </div>
    </> : mode === "data" ? <>
      <h2>A few city clues became one useful path.</h2>
      <p>See what influenced your route, when it was refreshed, and where the picture is still incomplete.</p>
      <h3 className="source-group-title">Used for this path</h3>
      <div className="source-list">{usedSources.map((source) => <SourceRow key={source.id} source={source} />)}</div>
      <h3 className="source-group-title">Worth exploring next</h3>
      <p className="source-group-note">Useful city context for future versions. These sources do not change today’s route.</p>
      <div className="source-list reference-sources">{referenceSources.map((source) => <SourceRow key={source.id} source={source} />)}</div>
    </> : mode === "asset" && activeAsset ? <AssetDetails asset={activeAsset} /> : mode === "task" && activeTask ? <CivicTaskDetails task={activeTask} observation={taskObservation} onComplete={onCompleteTask} onRemove={onRemoveTaskObservation} /> : detourScenario ? <>
      <span className="hypothetical-badge">Planning sketch · not a City proposal</span>
      <h2>{detourScenario.title}</h2>
      <p>Try one shade idea and compare the same walk before and after.</p>
      <div className="scenario-metrics">
        <article><span>Current walk</span><strong>{detourScenario.baselineDirectSunMinutes.toFixed(1)} min</strong><small>in direct sun</small></article>
        <ArrowIcon />
        <article><span>With more shade</span><strong>{detourScenario.scenarioDirectSunMinutes.toFixed(1)} min</strong><small>{detourScenario.avoidedDirectSunMinutes.toFixed(1)} min less</small></article>
      </div>
      <div className="scenario-assumptions"><strong>Try about {detourScenario.modeledIntervention.targetShadePercent}% shade near {detourScenario.selection.locationNames[0]}</strong><details><summary>What this assumes</summary><p>The path stays the same while shade changes in this one area. The site, design, cost, care, and approvals still need study.</p></details></div>
    </> : null}
    <button type="button" className="secondary-action" onClick={onClose}>Back to the route</button>
  </aside>;
}

function InsightSourceLinks({ sourceIds, label }: { sourceIds: readonly string[]; label?: string }) {
  const sources = uniqueSourcePresentations(sourceIds);
  if (sources.length === 0) return null;
  return <div className="insight-source-links">{label && <span>{label}</span>}{sources.map((source) => <a key={source.id} href={source.officialUrl} target="_blank" rel="noreferrer">{source.title}<ExternalLinkIcon /></a>)}</div>;
}

function PlannerSheet({ route, scenario, insight, insightBusy, insightError, lens, onLensChange, targetShade, onTargetShadeChange, onBack, onUseSample, onPlannerPrompt }: {
  route: JourneyRoute | null;
  scenario: ShadeDetourScenario | null;
  insight: RouteCityInsight | null;
  insightBusy: boolean;
  insightError: string;
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
    <div className="planner-lead"><span className="eyebrow">See what’s missing</span><h1>{route ? "What could make this walk feel better?" : "Where could the city feel more comfortable?"}</h1><p>{route ? "Pick a comfort gap, then try one small change." : "Useful places and climate clues stay visible across the neighborhood."}</p></div>
    <div className="planner-lenses" aria-label="Planner map view">
      <button type="button" className={lens === "shade" ? "active" : ""} onClick={() => onLensChange("shade")}><SunIcon />Shade gaps</button>
      <button type="button" className={lens === "cover" ? "active" : ""} onClick={() => onLensChange("cover")}><UmbrellaIcon />Likely cover</button>
      <button type="button" className={lens === "amenities" ? "active" : ""} onClick={() => onLensChange("amenities")}><BenchIcon />Amenities</button>
      <button type="button" className={lens === "tasks" ? "active" : ""} onClick={() => onLensChange("tasks")}><CheckCircleIcon />Data checks</button>
    </div>
    {!route ? <>
      <div className="planner-overview-stats"><span><strong>{counts.seating}</strong> seats</span><span><strong>{counts.drinking_fountain}</strong> fountains</span><span><strong>{counts.restroom}</strong> restrooms</span></div>
      <div className="planner-empty"><MapIcon /><div><strong>Start with a representative walk</strong><span>We’ll draw a 30-minute loop, then show where shade, cover, and useful places thin out.</span></div></div>
      <button type="button" className="primary-action" onClick={onUseSample}><span>Use a sample walk</span><ArrowIcon /></button>
    </> : <>
      {lens === "shade" && scenario && <>
        <div className="planner-callout"><span className="scenario-dot" /><div><strong>{scenario.selection.locationNames[0]}</strong><small>{scenario.journeyCounts.withChangedBurden} sample {scenario.journeyCounts.withChangedBurden === 1 ? "walk spends" : "walks spend"} less time in the sun with this change.</small></div></div>
        <label className="intervention-control"><span><strong>Try more shade here</strong><output>{targetShade}%</output></span><input type="range" min="40" max="95" step="5" value={targetShade} onChange={(event) => onTargetShadeChange(Number(event.target.value))} /></label>
        <div className="scenario-metrics compact"><article><span>Average walk now</span><strong>{averageBurden!.baseline.toFixed(1)} min</strong><small>in direct sun</small></article><ArrowIcon /><article><span>With this idea</span><strong>{averageBurden!.scenario.toFixed(1)} min</strong><small>{averageBurden!.avoided.toFixed(1)} min less</small></article></div>
        <p className="planner-proof">{scenario.journeyCounts.withChangedBurden} of {scenario.journeyCounts.evaluated} sample walks get more shade here. Each path stays the same, so the difference comes from shade alone.</p>
      </>}
      {lens === "cover" && <div className="planner-gap-list"><div><UmbrellaIcon /><span><strong>{coverPercent}% of this route follows likely-covered stretches</strong><small>Indigo shows the planning preview; coral shows open gaps.</small></span></div><div><CloudRainIcon /><span><strong>A starting point for rainy-day planning</strong><small>A live version would add current sheds, arcades, awnings, and construction.</small></span></div></div>}
      {lens === "amenities" && <div className="planner-gap-list"><div><BenchIcon /><span><strong>{counts.seating} places to sit nearby</strong><small>The circles show where each listing could help a walk.</small></span></div><div><RestroomIcon /><span><strong>{counts.restroom} public restrooms nearby</strong><small>Tap a place to see when the listing was refreshed.</small></span></div><div><DropletIcon /><span><strong>{counts.drinking_fountain} water stops nearby</strong><small>Open status can change.</small></span></div></div>}
      {lens === "tasks" && <div className="planner-gap-list task-gap-list"><div><CheckCircleIcon /><span><strong>{allCivicTasks.length} small ways to help nearby</strong><small>Quick partner prompts help fill in what has changed.</small></span></div><div><CameraIcon /><span><strong>Verify, observe, or add one focused photo</strong><small>Responses stay separate from city records and expire after a short window.</small></span></div><div><LayersIcon /><span><strong>Checks, never neighborhood scores</strong><small>Each check asks for one fact without ranking a block or community.</small></span></div></div>}
      {lens !== "tasks" && <div className="planner-insights">
        <div className="planner-insights-heading"><span><strong>Best next ideas</strong><small>{insight?.generatedBy === "model" ? "Ideas ranked for this route" : "Ideas shaped by this route"}</small></span><SparkIcon /></div>
        {insightBusy && <ThinkingStatus mode="planner" compact />}
        {!insightBusy && insightError && <p className="planner-insight-error">{insightError}</p>}
        {!insightBusy && insight?.interventions.map((idea) => <article key={idea.candidateId} className="planner-insight-card">
          <span className="insight-rank">{idea.rank}</span>
          <div><small>{idea.locationLabel}</small><strong>{idea.proposedAction}</strong><p>{idea.rationale}</p><InsightSourceLinks sourceIds={idea.sourceIds} /><InsightSourceLinks sourceIds={idea.referenceSourceIds} label="Explore next" /><details><summary>What this assumes</summary><p>{idea.caveat}</p></details></div>
        </article>)}
      </div>}
      <span className="hypothetical-badge">Planning sketch · not a City proposal</span>
    </>}
    <form className="refine-box planner-prompt" onSubmit={submit}><SparkIcon /><input value={plannerPrompt} onChange={(event) => setPlannerPrompt(event.target.value)} placeholder="What if this block had 85% shade?" aria-label="Describe a planning what-if" /><button disabled={!plannerPrompt.trim()} aria-label="Try planning idea"><ArrowIcon /></button></form>
    <button type="button" className="planner-back" onClick={onBack}>Back to my walk</button>
  </section>;
}

function MapLensControl({ overlays, onToggle, hour, onHourChange, planner, hasRoute, canEdit, editing, onEditingChange }: {
  overlays: MapOverlays;
  onToggle: (layer: keyof MapOverlays) => void;
  hour: number;
  onHourChange: (hour: number) => void;
  planner: boolean;
  hasRoute: boolean;
  canEdit: boolean;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
}) {
  return <div className="map-lens-control" aria-label="Map view">
    <div><span><LayersIcon />Map layers</span><output>{overlays.shade ? formatClock(hour) : hasRoute ? "Path stays visible" : "Nearby now"}</output></div>
    <div className="map-lens-options">
      <button type="button" aria-pressed={overlays.shade} className={overlays.shade ? "active" : ""} onClick={() => onToggle("shade")}>Shade</button>
      <button type="button" aria-pressed={overlays.cover} className={overlays.cover ? "active" : ""} onClick={() => onToggle("cover")}>Cover</button>
      <button type="button" aria-pressed={overlays.amenities} className={overlays.amenities ? "active" : ""} onClick={() => onToggle("amenities")}>Places</button>
      <button type="button" aria-pressed={overlays.tasks} className={overlays.tasks ? "active" : ""} onClick={() => onToggle("tasks")}>Checks</button>
    </div>
    {!planner && hasRoute && canEdit && <button type="button" className={`edit-path-control ${editing ? "active" : ""}`} onClick={() => onEditingChange(!editing)}><RouteIcon />{editing ? "Click the path to place a handle" : "Edit path on map"}</button>}
    {overlays.shade && <label><span>7 AM</span><input type="range" min="7" max="19" step="1" value={hour} onChange={(event) => onHourChange(Number(event.target.value))} aria-label="Shade time" /><span>7 PM</span></label>}
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
  const overlayVisibilityRef = useRef<MapOverlays>(DEFAULT_MAP_OVERLAYS);
  const [brief, setBrief] = useState<UiTripBrief>({ ...DEFAULT_BRIEF, priorities: [], departureHour: new Date().getHours() });
  const [prompt, setPrompt] = useState("");
  const [originNodeId, setOriginNodeId] = useState(defaultOrigin);
  const [destinationNodeId, setDestinationNodeId] = useState(defaultDestination);
  const [originText, setOriginText] = useState(friendlyNodeName(nodeById.get(defaultOrigin)?.name));
  const [destinationText, setDestinationText] = useState("");
  const [result, setResult] = useState<PlannedJourneyResult | null>(null);
  const [route, setRoute] = useState<JourneyRoute | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyMode, setBusyMode] = useState<ThinkingMode | null>(null);
  const [error, setError] = useState("");
  const [showBaseline, setShowBaseline] = useState(false);
  const [detail, setDetail] = useState<DetailMode | null>(null);
  const [delta, setDelta] = useState("");
  const [modelFallback, setModelFallback] = useState(false);
  const [activeAsset, setActiveAsset] = useState<CivicAsset | null>(null);
  const [activeAssetPoint, setActiveAssetPoint] = useState<{ x: number; y: number } | null>(null);
  const [activeTask, setActiveTask] = useState<CivicTask | null>(null);
  const [activeTaskPoint, setActiveTaskPoint] = useState<{ x: number; y: number } | null>(null);
  const [taskObservations, setTaskObservations] = useState<Record<string, SessionCivicObservation>>({});
  const [activeCover, setActiveCover] = useState<{ label: string; street: string; proofLabel: string } | null>(null);
  const [activeCoverPoint, setActiveCoverPoint] = useState<{ x: number; y: number } | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [appMode, setAppMode] = useState<AppMode>("walk");
  const [mapLens, setMapLens] = useState<MapLens>("route");
  const [mapOverlays, setMapOverlays] = useState<MapOverlays>(DEFAULT_MAP_OVERLAYS);
  const [mapViewport, setMapViewport] = useState<AmenityViewport>(INITIAL_MAP_VIEWPORT);
  overlayVisibilityRef.current = mapOverlays;
  const [shadeHour, setShadeHour] = useState(Math.max(7, Math.min(19, new Date().getHours())));
  const [rainContext, setRainContext] = useState(false);
  const [plannerShadeTarget, setPlannerShadeTarget] = useState(80);
  const [selectedPlannerEdgeId, setSelectedPlannerEdgeId] = useState<string | null>(null);
  const [waypointNodeId, setWaypointNodeId] = useState<string | null>(null);
  const [manualWanderEndpointId, setManualWanderEndpointId] = useState<string | null>(null);
  const [editRoute, setEditRoute] = useState(false);
  const [plannerInsight, setPlannerInsight] = useState<RouteCityInsight | null>(null);
  const [plannerInsightBusy, setPlannerInsightBusy] = useState(false);
  const [plannerInsightError, setPlannerInsightError] = useState("");
  const activeAssets = useMemo(() => route ? relevantAssets(route, brief) : [], [route, brief]);
  const routeTasks = useMemo(() => route ? relevantCivicTasks(route, brief) : [], [route, brief]);
  const visibleTasks = useMemo(() => {
    const tasks = mapOverlays.tasks && (appMode === "planner" || !route) ? allCivicTasks : routeTasks;
    return activeTask && !tasks.some((task) => task.id === activeTask.id) ? [activeTask, ...tasks] : tasks;
  }, [activeTask, appMode, mapOverlays.tasks, route, routeTasks]);
  const plannerNearbyAssets = useMemo(() => route
    ? findCivicAssetsNearRoute(route.coordinates, { maxDistanceMeters: 120, limit: 80 }).map((item) => item.asset)
    : [], [route]);
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
  const viewportAssets = useMemo(() => amenitiesForViewport(allMapAssets, mapViewport, {
    selectedAssetId: activeAsset?.id,
    prominentAssetIds: activeAssets.map((asset) => asset.id),
    maximumAssets: appMode === "planner" ? 36 : route ? 28 : 20,
  }), [activeAsset?.id, activeAssets, appMode, mapViewport, route]);
  const overviewAssets = useMemo(() => amenityOverviewGeoJSON(viewportAssets, {
    selectedAssetId: activeAsset?.id,
    prominentAssetIds: activeAssets.map((asset) => asset.id),
    clusterCellMeters: amenityClusterCellMeters(mapViewport.zoom),
    minimumClusterSize: mapViewport.zoom >= 16.25 ? Number.MAX_SAFE_INTEGER : 2,
  }), [activeAsset?.id, activeAssets, mapViewport.zoom, viewportAssets]);
  const taskFeatures = useMemo(() => civicTasksGeoJSON(visibleTasks, {
    selectedTaskId: activeTask?.id,
    completedTaskIds: Object.keys(taskObservations),
  }), [activeTask?.id, taskObservations, visibleTasks]);
  const plannerInsightRequest = useMemo(() => route ? buildRouteCityInsightRequest({
    brief,
    route,
    scenario: plannerScenario,
    nearbyAssets: plannerNearbyAssets,
    simulatedCoverPercent: routeCoverShare(route, pilotGraph) * 100,
  }) : null, [brief, route, plannerScenario, plannerNearbyAssets]);

  useEffect(() => {
    if (appMode !== "planner" || !plannerInsightRequest) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setPlannerInsightBusy(true);
      setPlannerInsightError("");
      void requestRouteCityInsight(plannerInsightRequest)
        .then((insight) => { if (!cancelled) setPlannerInsight(insight); })
        .catch(() => { if (!cancelled) { setPlannerInsight(null); setPlannerInsightError("We couldn’t rank the planning tests right now. The measured map layers still work."); } })
        .finally(() => { if (!cancelled) setPlannerInsightBusy(false); });
    }, 450);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [appMode, plannerInsightRequest]);

  async function resolveEndpoint(query: string, currentNodeId: string) {
    const current = nodeById.get(currentNodeId);
    if (!query.trim() || query.trim() === current?.name || query.trim() === friendlyNodeName(current?.name)) return currentNodeId;
    const found = await searchNycAddress(query);
    if (!found) throw new Error(`We couldn’t find “${query}”. Try a nearby street or landmark.`);
    if (!isInsidePilot(found.coordinate)) throw new Error("Happy Path is exploring Lower Manhattan for now. Try a start and destination between Canal Street and Union Square.");
    return nearestGraphNode(found.coordinate).id;
  }

  async function compute(nextBrief: UiTripBrief, isRefinement = false, options: { rainFriendly?: boolean; originId?: string; destinationId?: string; originQuery?: string; destinationQuery?: string; wanderEndpointId?: string | null; preserveWaypoint?: boolean } = {}) {
    const oldRoute = route;
    const plannedBrief = nextBrief.priorities.includes("construction")
      ? mergeTripBrief(nextBrief, {
        priorities: nextBrief.priorities.filter((priority) => priority !== "construction"),
        unsupported: [...nextBrief.unsupported, "Current construction evidence is unavailable in this preview"],
      }, nextBrief.interpretedBy)
      : nextBrief;
    const resolvedOrigin = options.originId ?? await resolveEndpoint(options.originQuery ?? originText, originNodeId);
    let resolvedDestination = options.destinationId ?? destinationNodeId;
    if (plannedBrief.shape === "destination") {
      const query = plannedBrief.destinationQuery ?? options.destinationQuery ?? destinationText;
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
    const nextResult = planJourney(pilotGraph, routingBrief, routingOptions(plannedBrief, Boolean(options.rainFriendly)));
    const preferredRoute = options.rainFriendly
      ? pickRainFriendlyRoute(nextResult, pilotGraph)
      : pickAmenityAwareRoute(nextResult, plannedBrief.priorities);
    const nextRoute = selectRouteThroughOptionalCivicTask({
      graph: pilotGraph,
      routingBrief,
      result: nextResult,
      preferredRoute,
      tasks: plannedBrief.civicTaskIntent ? listCivicTasks({ intent: plannedBrief.civicTaskIntent }) : [],
      planningOptions: routingOptions(plannedBrief, Boolean(options.rainFriendly)),
    }).route;
    setOriginNodeId(resolvedOrigin);
    setDestinationNodeId(resolvedDestination);
    setBrief(plannedBrief);
    setResult(resultWithSelectedRoute(nextResult, nextRoute));
    setRoute(nextRoute);
    setShadeHour(Math.max(7, Math.min(19, Math.round(plannedBrief.departureHour))));
    setShowBaseline(false);
    setActiveAsset(null);
    setActiveAssetPoint(null);
    setActiveTask(null);
    setActiveTaskPoint(null);
    setDetail(null);
    setActiveCover(null);
    setActiveCoverPoint(null);
    setSelectedPlannerEdgeId(null);
    if (plannedBrief.shape !== "wander" || plannedBrief.endCondition !== null) setManualWanderEndpointId(null);
    else if (options.wanderEndpointId !== undefined) setManualWanderEndpointId(options.wanderEndpointId);
    if (!options.preserveWaypoint) setWaypointNodeId(null);
    if (isRefinement && oldRoute) {
      const minuteChange = Math.round(nextRoute.durationMinutes - oldRoute.durationMinutes);
      const mileChange = metersToMiles(nextRoute.distanceMeters - oldRoute.distanceMeters);
      const sunChange = nextRoute.directSunMinutes - oldRoute.directSunMinutes;
      const sizeChange = plannedBrief.distanceMiles !== null
        ? Math.abs(mileChange) < 0.05 ? "same distance" : `${Math.abs(mileChange).toFixed(1)} mi ${mileChange < 0 ? "shorter" : "longer"}`
        : minuteChange === 0 ? "same walking time" : `${Math.abs(minuteChange)} min ${minuteChange < 0 ? "shorter" : "longer"}`;
      setDelta(`${sizeChange}${Math.abs(sunChange) >= 0.5 ? ` · ${Math.abs(sunChange).toFixed(1)} ${sunChange <= 0 ? "fewer" : "more"} min in estimated sun` : ""}`);
    } else setDelta("");
  }

  async function plan(value = prompt, isRefinement = false) {
    setBusy(true);
    setBusyMode(isRefinement ? "refine" : "plan");
    setError("");
    const requestOriginText = originText;
    const requestDestinationText = destinationText;
    try {
      const rainIntent = rainPromptIntent(value);
      const nextRainContext = rainIntent === "on" ? true : rainIntent === "off" ? false : rainContext;
      const modelBrief = value.trim() ? await interpretTripBrief(value, brief) : brief;
      const interpreted = !isRefinement ? withDestinationOverride(modelBrief, destinationText) : modelBrief;
      setModelFallback(Boolean(value.trim()) && interpreted.interpretedBy === "fallback");
      setRainContext(nextRainContext);
      if (interpreted.civicTaskIntent) { setMapLens("tasks"); setMapOverlays((current) => ({ ...current, tasks: true })); }
      if (interpreted.priorities.includes("shade")) { setMapLens("shade"); setMapOverlays((current) => ({ ...current, shade: true })); }
      if (nextRainContext) { setMapLens("cover"); setMapOverlays((current) => ({ ...current, cover: true })); }
      else if (rainIntent === "off") setMapOverlays((current) => ({ ...current, cover: false }));
      await compute(interpreted, isRefinement, { rainFriendly: nextRainContext, originQuery: requestOriginText, destinationQuery: requestDestinationText });
      return true;
    } catch (caught) {
      setError(planningErrorMessage(caught));
      return false;
    } finally {
      setBusy(false);
      setBusyMode(null);
    }
  }

  async function adjust(nextBrief: UiTripBrief) {
    setBusy(true);
    setBusyMode("adjust");
    setError("");
    try {
      await compute(nextBrief, true, { rainFriendly: rainContext });
      return true;
    } catch (caught) {
      setError(planningErrorMessage(caught));
      return false;
    } finally {
      setBusy(false);
      setBusyMode(null);
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
    setActiveTask(null);
    setActiveTaskPoint(null);
    setError("");
    setDelta("");
    setModelFallback(false);
    setRainContext(false);
    setMapLens("route");
    setMapOverlays(DEFAULT_MAP_OVERLAYS);
    setAppMode("walk");
    setSelectedPlannerEdgeId(null);
    setWaypointNodeId(null);
    setManualWanderEndpointId(null);
    setEditRoute(false);
    setPlannerInsight(null);
    setPlannerInsightError("");
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
    setBusyMode("planner");
    setError("");
    try {
      await compute(sample, false);
      setAppMode("planner");
      setMapLens("shade");
      setMapOverlays((current) => ({ ...current, shade: true, amenities: true }));
    } catch (caught) {
      setError(planningErrorMessage(caught));
    } finally {
      setBusy(false);
      setBusyMode(null);
    }
  }

  function handlePlannerPrompt(value: string) {
    const requestedShade = value.match(/\b(\d{2,3})\s*%?\s*shade\b/i)?.[1];
    if (requestedShade) setPlannerShadeTarget(Math.max(40, Math.min(95, Number(requestedShade))));
    if (/verify|check|contribut|task|ground.?truth|city data/i.test(value)) { setMapLens("tasks"); setMapOverlays((current) => ({ ...current, tasks: true })); }
    else if (/cover|rain|awning|shed/i.test(value)) { setMapLens("cover"); setMapOverlays((current) => ({ ...current, cover: true })); }
    else if (/seat|restroom|bathroom|water|amenit/i.test(value)) { setMapLens("amenities"); setMapOverlays((current) => ({ ...current, amenities: true })); }
    else { setMapLens("shade"); setMapOverlays((current) => ({ ...current, shade: true })); }
  }

  async function steerRoute(coordinate: Coordinate) {
    if (!route || !result) return;
    const waypoint = nearestGraphNode(coordinate);
    try {
      const steeringBrief = brief.civicTaskIntent
        ? mergeTripBrief(brief, { civicTaskIntent: null }, "controls")
        : brief;
      const routingBrief = makeRoutingBrief(steeringBrief, originNodeId, destinationNodeId);
      const steered = rerouteJourneyThroughWaypoint(pilotGraph, routingBrief, route, waypoint.id, routingOptions(brief, rainContext));
      if (brief.civicTaskIntent) setBrief(steeringBrief);
      setWaypointNodeId(waypoint.id);
      setRoute(steered);
      setResult((current) => current ? resultWithSelectedRoute(current, steered) : current);
      setDelta(`path steered near ${waypoint.name}${brief.civicTaskIntent ? " · optional data check unpinned" : ""}`);
      setError("");
    } catch (caught) {
      setError(planningErrorMessage(caught));
    }
  }

  dragEndpointRef.current = (kind, coordinate) => {
    const node = nearestGraphNode(coordinate);
    if (kind === "origin") {
      setOriginNodeId(node.id);
      setOriginText(friendlyNodeName(node.name));
      void compute(brief, true, { rainFriendly: rainContext, originId: node.id });
      return;
    }
    if (route?.journeyShape === "wander") {
      const nextBrief = mergeTripBrief(brief, { direction: null, endCondition: null }, "controls");
      setDestinationNodeId(node.id);
      setDestinationText(friendlyNodeName(node.name));
      void compute(nextBrief, true, { rainFriendly: rainContext, destinationId: node.id, wanderEndpointId: node.id });
      return;
    }
    setDestinationNodeId(node.id);
    const destinationName = friendlyNodeName(node.name);
    setDestinationText(destinationName);
    void compute({ ...brief, destinationQuery: destinationName, interpretedBy: "controls" }, true, { rainFriendly: rainContext, destinationId: node.id });
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
    const captureViewport = () => {
      const bounds = map.getBounds();
      setMapViewport({ west: bounds.getWest(), south: bounds.getSouth(), east: bounds.getEast(), north: bounds.getNorth(), zoom: map.getZoom() });
    };
    map.on("moveend", captureViewport);
    map.on("load", () => {
      setMapReady(true);
      setMapError(false);
      captureViewport();
      map.addSource("building-shadows", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "building-shadows", type: "fill", source: "building-shadows", paint: { "fill-color": "#516785", "fill-opacity": 0.24, "fill-opacity-transition": { duration: 140, delay: 0 } }, layout: { visibility: "none" } });
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
        "line-width": 5,
        "line-offset": 4,
        "line-dasharray": [1.2, 1],
        "line-opacity": 0.9,
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
      const showTaskPopover = (event: MapLayerMouseEvent) => {
        const id = event.features?.[0]?.properties?.id;
        setDetail(null);
        setActiveAsset(null);
        setActiveAssetPoint(null);
        setActiveTask(allCivicTasks.find((task) => task.id === id) ?? null);
        setActiveTaskPoint({ x: event.point.x, y: event.point.y });
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
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 13, 9, 16, 17],
        "circle-color": ["match", ["get", "kind"], "seating", "#6FA07C", "restroom", "#7586BB", "drinking_fountain", "#4D8797", "#D96A58"],
        "circle-opacity": 0.08,
        "circle-stroke-width": 1,
        "circle-stroke-opacity": 0.18,
      }, layout: { visibility: "none" } });
      map.addLayer({ id: "overview-clusters", type: "circle", source: "overview-assets", filter: ["==", ["get", "featureType"], "cluster"], paint: {
        "circle-radius": ["interpolate", ["linear"], ["get", "count"], 2, 13, 8, 18],
        "circle-color": "#FFFDF8",
        "circle-stroke-color": ["match", ["get", "kind"], "seating", "#4F8963", "restroom", "#6478B8", "drinking_fountain", "#2E6F85", "#D94C3B"],
        "circle-stroke-width": 2,
        "circle-opacity": 0.96,
      }, layout: { visibility: "none" } });
      map.addLayer({ id: "overview-cluster-count", type: "symbol", source: "overview-assets", filter: ["==", ["get", "featureType"], "cluster"], layout: AMENITY_CLUSTER_COUNT_LAYOUT, paint: { "text-color": "#1E2A24" } });
      const expandAmenityCluster = (event: MapLayerMouseEvent) => {
        map.easeTo({ center: event.lngLat, zoom: Math.min(17.2, Math.max(16.35, map.getZoom() + 1.8)), duration: 420 });
      };
      ["overview-clusters", "overview-cluster-count"].forEach((layer) => {
        map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "zoom-in"; });
        map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
        map.on("click", layer, expandAmenityCluster);
      });
      void registerAssetMarkerImages(map).then(() => {
        if (map.getLayer("asset-icons")) return;
        map.addLayer({ id: "asset-icons", type: "symbol", source: "assets", layout: {
          "icon-image": ["match", ["get", "kind"], "seating", "asset-seating", "restroom", "asset-restroom", "transit", "asset-transit", "asset-drinking_fountain"],
          "icon-size": ["case", ["get", "selected"], 1.35, 1.2],
          "icon-anchor": "bottom",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          visibility: overlayVisibilityRef.current.amenities ? "visible" : "none",
        } });
        map.addLayer({ id: "overview-icons", type: "symbol", source: "overview-assets", filter: ["all", ["==", ["get", "featureType"], "asset"], ["!", ["get", "prominent"]]], layout: {
          "icon-image": ["match", ["get", "kind"], "seating", "asset-seating", "restroom", "asset-restroom", "transit", "asset-transit", "asset-drinking_fountain"],
          "icon-size": 0.72,
          "icon-anchor": "bottom",
          "icon-allow-overlap": false,
          "icon-padding": 5,
          visibility: overlayVisibilityRef.current.amenities ? "visible" : "none",
        } });
        map.on("mouseenter", "asset-icons", () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", "asset-icons", () => { map.getCanvas().style.cursor = ""; });
        map.on("click", "asset-icons", showAssetPopover);
        map.on("mouseenter", "overview-icons", () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", "overview-icons", () => { map.getCanvas().style.cursor = ""; });
        map.on("click", "overview-icons", showAssetPopover);
      }).catch(() => { /* The selectable marker hit areas remain available if icon art cannot load. */ });
      map.addSource("civic-tasks", { type: "geojson", data: civicTasksGeoJSON([]) });
      map.addLayer({ id: "civic-task-halo", type: "circle", source: "civic-tasks", paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 13, 9, 16, 16],
        "circle-color": ["case", ["get", "completed"], "#4F8963", civicTaskLayer.color],
        "circle-opacity": 0.12,
        "circle-stroke-width": 1,
        "circle-stroke-opacity": 0.22,
      }, layout: { visibility: "none" } });
      map.addLayer({ id: "civic-task-hit", type: "circle", source: "civic-tasks", paint: {
        "circle-radius": ["case", ["get", "selected"], 19, 15],
        "circle-color": "#FFFDF8",
        "circle-opacity": 0.01,
        "circle-stroke-color": civicTaskLayer.color,
        "circle-stroke-width": ["case", ["get", "selected"], 3, 0],
        "circle-translate": [0, -23],
      }, layout: { visibility: "none" } });
      void registerCivicTaskMarkerImage(map).then(() => {
        if (map.getLayer("civic-task-icons")) return;
        map.addLayer({ id: "civic-task-icons", type: "symbol", source: "civic-tasks", layout: {
          "icon-image": "civic-task",
          "icon-size": ["case", ["get", "selected"], 1.3, 1.05],
          "icon-anchor": "bottom",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          visibility: overlayVisibilityRef.current.tasks ? "visible" : "none",
        } });
        map.on("mouseenter", "civic-task-icons", () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", "civic-task-icons", () => { map.getCanvas().style.cursor = ""; });
        map.on("click", "civic-task-icons", showTaskPopover);
      }).catch(() => { /* The task hit area remains selectable if icon art cannot load. */ });
      map.on("click", "civic-task-hit", showTaskPopover);
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
    if (!mapReady || !map || !route || route.coordinates.length === 0) {
      originMarkerRef.current?.remove();
      destinationMarkerRef.current?.remove();
      waypointMarkerRef.current?.remove();
      originMarkerRef.current = null;
      destinationMarkerRef.current = null;
      waypointMarkerRef.current = null;
      return;
    }

    if (!originMarkerRef.current) {
      const marker = new maplibregl.Marker({ element: routeHandleElement("origin"), draggable: true, anchor: "center" }).setLngLat(route.coordinates[0]).addTo(map);
      marker.on("dragend", () => {
        const point = marker.getLngLat();
        dragEndpointRef.current("origin", [point.lng, point.lat]);
      });
      originMarkerRef.current = marker;
    }
    originMarkerRef.current.setLngLat(route.coordinates[0]);

    if (route.journeyShape !== "loop") {
      if (!destinationMarkerRef.current) {
        const marker = new maplibregl.Marker({ element: routeHandleElement("destination"), draggable: true, anchor: "center" }).setLngLat(route.coordinates.at(-1)!).addTo(map);
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
        const marker = new maplibregl.Marker({ element: routeHandleElement("waypoint"), draggable: true, anchor: "center" }).setLngLat(waypoint.coordinate).addTo(map);
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
    if (!mapReady || !map) return;
    (map.getSource("happy") as GeoJSONSource | undefined)?.setData(routeGeoJSON(route));
    (map.getSource("baseline") as GeoJSONSource | undefined)?.setData(routeGeoJSON(result?.baseline));
    (map.getSource("route-shade") as GeoJSONSource | undefined)?.setData(shadeSegments);
    (map.getSource("route-cover") as GeoJSONSource | undefined)?.setData(coverRouteSegments);
    (map.getSource("planner-selection") as GeoJSONSource | undefined)?.setData(plannerScenario?.selection.geojson ?? { type: "FeatureCollection", features: [] });
    (map.getSource("endpoints") as GeoJSONSource | undefined)?.setData(endpointsGeoJSON(route));
    (map.getSource("assets") as GeoJSONSource | undefined)?.setData(assetsGeoJSON(activeAssets, activeAsset?.id));
    (map.getSource("overview-assets") as GeoJSONSource | undefined)?.setData(overviewAssets);
    (map.getSource("civic-tasks") as GeoJSONSource | undefined)?.setData(taskFeatures);
    const visibility = (layer: string, visible: boolean) => {
      if (map.getLayer(layer)) map.setLayoutProperty(layer, "visibility", visible ? "visible" : "none");
    };
    const hasRoute = Boolean(route);
    visibility("baseline", hasRoute && showBaseline && Boolean(result?.baseline));
    visibility("endpoints", false);
    visibility("happy-casing", hasRoute);
    visibility("happy", hasRoute);
    visibility("route-shade", hasRoute && mapOverlays.shade);
    visibility("route-cover", hasRoute && mapOverlays.cover);
    visibility("demo-cover", mapOverlays.cover);
    visibility("demo-cover-casing", mapOverlays.cover);
    const showSelection = appMode === "planner" && mapLens === "shade" && mapOverlays.shade && Boolean(plannerScenario);
    visibility("planner-selection", showSelection);
    visibility("planner-selection-casing", showSelection);
    ["overview-clusters", "overview-cluster-count", "overview-icons", "assets", "asset-icons"].forEach((layer) => visibility(layer, mapOverlays.amenities));
    visibility("amenity-coverage", appMode === "planner" && mapOverlays.amenities && mapLens === "amenities");
    ["civic-task-halo", "civic-task-hit", "civic-task-icons"].forEach((layer) => visibility(layer, mapOverlays.tasks));
  }, [route, result, showBaseline, activeAssets, activeAsset?.id, overviewAssets, taskFeatures, shadeSegments, coverRouteSegments, plannerScenario, mapLens, mapOverlays, appMode, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!route || !map?.isStyleLoaded()) return;
    map.fitBounds(boundsForRoute(route), { padding: { top: 90, right: 70, bottom: 90, left: window.innerWidth > 800 ? 460 : 70 }, maxZoom: appMode === "planner" ? 15.3 : 16, duration: 650 });
  }, [route?.candidateId, appMode, mapReady]);

  useEffect(() => {
    if (!mapOverlays.shade) {
      if (mapRef.current?.getLayer("building-shadows")) mapRef.current.setLayoutProperty("building-shadows", "visibility", "none");
      return;
    }
    const roundedHour = Math.max(7, Math.min(19, Math.round(shadeHour)));
    const load = shadowModules[`./data/shadows/hour-${roundedHour}.json`];
    if (!load || !mapRef.current?.getSource("building-shadows")) return;
    let cancelled = false;
    const timer = window.setTimeout(() => void load().then((module) => {
      if (cancelled) return;
      mapRef.current?.setLayoutProperty("building-shadows", "visibility", "visible");
      (mapRef.current?.getSource("building-shadows") as GeoJSONSource | undefined)?.setData((module as { default: never }).default);
    }), 90);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [shadeHour, mapOverlays.shade, mapReady]);

  const assetPopoverOpensLeft = Boolean(activeAssetPoint && activeAssetPoint.x > window.innerWidth - 320);
  const assetPopoverStyle = activeAssetPoint ? {
    "--asset-popover-left": `${Math.max(16, assetPopoverOpensLeft ? activeAssetPoint.x - 296 : activeAssetPoint.x + 18)}px`,
    "--asset-popover-top": `${Math.max(72, Math.min(window.innerHeight - 190, activeAssetPoint.y - 34))}px`,
  } as CSSProperties : undefined;

  const coverPopoverStyle = activeCoverPoint ? {
    "--asset-popover-left": `${Math.max(16, activeCoverPoint.x > window.innerWidth - 320 ? activeCoverPoint.x - 296 : activeCoverPoint.x + 18)}px`,
    "--asset-popover-top": `${Math.max(72, Math.min(window.innerHeight - 190, activeCoverPoint.y - 34))}px`,
  } as CSSProperties : undefined;

  const taskPopoverOpensLeft = Boolean(activeTaskPoint && activeTaskPoint.x > window.innerWidth - 320);
  const taskPopoverStyle = activeTaskPoint ? {
    "--asset-popover-left": `${Math.max(16, taskPopoverOpensLeft ? activeTaskPoint.x - 296 : activeTaskPoint.x + 18)}px`,
    "--asset-popover-top": `${Math.max(72, Math.min(window.innerHeight - 210, activeTaskPoint.y - 34))}px`,
  } as CSSProperties : undefined;

  const switchMode = (mode: AppMode) => {
    setAppMode(mode);
    setDetail(null);
    setActiveAsset(null);
    setActiveAssetPoint(null);
    setActiveTask(null);
    setActiveTaskPoint(null);
    setActiveCover(null);
    setActiveCoverPoint(null);
    setEditRoute(false);
    const nextLens: MapLens = mode === "planner" ? (route ? "shade" : "amenities") : rainContext ? "cover" : "route";
    setMapLens(nextLens);
    setMapOverlays((current) => ({ ...current, amenities: true, shade: mode === "planner" && Boolean(route) ? true : current.shade, cover: rainContext ? true : current.cover }));
  };

  const focusMapLens = (lens: MapLens) => {
    setMapLens(lens);
    if (lens !== "route") setMapOverlays((current) => ({ ...current, [lens]: true }));
  };

  const toggleMapOverlay = (layer: keyof MapOverlays) => {
    setMapOverlays((current) => toggledMapOverlay(current, layer));
    setMapLens(layer);
    setEditRoute(false);
  };

  return <main className={`${route ? "has-result" : "is-compose"} mode-${appMode}`}>
    <div className="map-shell"><div className="map" ref={mapContainer} /><div className="map-wash" />{mapError && <FallbackMap graph={pilotGraph} route={route} lens={mapLens} overlays={mapOverlays} shadeSegments={shadeSegments} coverSegments={coverRouteSegments} ambientCover={ambientCoverLayer} selection={appMode === "planner" ? plannerScenario?.selection.geojson : null} assets={viewportAssets} prominentAssetIds={activeAssets.map((asset) => asset.id)} selectedAssetId={activeAsset?.id} onAssetClick={(asset) => { setActiveTask(null); setActiveTaskPoint(null); setActiveAsset(asset); setActiveAssetPoint({ x: Math.round(window.innerWidth * .68), y: 160 }); }} tasks={visibleTasks} selectedTaskId={activeTask?.id} completedTaskIds={Object.keys(taskObservations)} onTaskClick={(task) => { setActiveAsset(null); setActiveAssetPoint(null); setActiveTask(task); setActiveTaskPoint({ x: Math.round(window.innerWidth * .68), y: 160 }); }} />}</div>
    <div className="top-bar"><div className="brand-cluster"><Brand /><nav className="mode-switch" aria-label="Happy Path mode"><button type="button" className={appMode === "walk" ? "active" : ""} onClick={() => switchMode("walk")}>Walk</button><button type="button" className={appMode === "planner" ? "active" : ""} onClick={() => switchMode("planner")}>City what-if</button></nav></div><div className="map-actions">{!mapError && <IconButton label="Center map" onClick={() => mapRef.current?.easeTo({ center: nodeById.get(originNodeId)?.coordinate, zoom: 14.5 })}><LocateIcon /></IconButton>}{route && appMode === "walk" && <IconButton label="Map details" onClick={() => { setActiveAsset(null); setActiveAssetPoint(null); setActiveTask(null); setActiveTaskPoint(null); setDetail("data"); }}><LayersIcon /></IconButton>}</div></div>
    {appMode === "planner"
      ? <PlannerSheet route={route} scenario={plannerScenario} insight={plannerInsight} insightBusy={plannerInsightBusy} insightError={plannerInsightError} lens={mapLens} onLensChange={focusMapLens} targetShade={plannerShadeTarget} onTargetShadeChange={setPlannerShadeTarget} onBack={() => switchMode("walk")} onUseSample={() => void usePlannerSample()} onPlannerPrompt={handlePlannerPrompt} />
      : !route
        ? <ComposeSheet brief={brief} setBrief={setBrief} prompt={prompt} setPrompt={setPrompt} originText={originText} setOriginText={setOriginText} destinationText={destinationText} setDestinationText={setDestinationText} busy={busy} busyMode={busyMode} error={error} onPlan={() => void plan()} />
        : result && <ResultSheet brief={brief} route={route} result={result} assets={activeAssets} tasks={routeTasks} destinationText={destinationText} setDestinationText={setDestinationText} delta={delta} error={error} onBack={startNewWalk} onRefine={(value) => plan(value, true)} onAdjust={adjust} onShowWhy={() => { setActiveAsset(null); setActiveAssetPoint(null); setActiveTask(null); setActiveTaskPoint(null); setDetail("why"); }} onShowAsset={(asset) => { setActiveTask(null); setActiveTaskPoint(null); setActiveAsset(asset); setActiveAssetPoint(null); setDetail("asset"); }} onShowTask={(task) => { setActiveAsset(null); setActiveAssetPoint(null); setActiveTask(task); setActiveTaskPoint(null); setDetail("task"); }} onShowData={() => { setActiveAsset(null); setActiveAssetPoint(null); setActiveTask(null); setActiveTaskPoint(null); setDetail("data"); }} onOpenPlanner={() => switchMode("planner")} detourScenario={detourScenario} showBaseline={showBaseline} setShowBaseline={setShowBaseline} busy={busy} busyMode={busyMode} modelFallback={modelFallback} rainContext={rainContext} />}
    {appMode === "walk" && detail && route && <DetailPanel mode={detail} brief={brief} route={route} assets={activeAssets} tasks={routeTasks} activeAsset={activeAsset} activeTask={activeTask} taskObservation={activeTask ? taskObservations[activeTask.id] ?? null : null} detourScenario={detourScenario} rainContext={rainContext} onCompleteTask={(response) => { if (!activeTask) return; setTaskObservations((current) => ({ ...current, [activeTask.id]: createSessionCivicObservation(activeTask, response) })); }} onRemoveTaskObservation={() => { if (!activeTask) return; setTaskObservations((current) => { const next = { ...current }; delete next[activeTask.id]; return next; }); }} onClose={() => { setDetail(null); if (detail === "asset") { setActiveAsset(null); setActiveAssetPoint(null); } if (detail === "task") { setActiveTask(null); setActiveTaskPoint(null); } }} />}
    {activeAsset && detail !== "asset" && <aside className={`asset-popover ${assetPopoverOpensLeft ? "opens-left" : ""}`} style={assetPopoverStyle} role="dialog" aria-label={assetTypeLabel(activeAsset)}><div><AssetIcon kind={activeAsset.kind} /><IconButton label="Close" onClick={() => { setActiveAsset(null); setActiveAssetPoint(null); }}><CloseIcon /></IconButton></div><span className="eyebrow">{appMode === "planner" ? "Place on the map" : "Near your walk"}</span><h3>{assetTypeLabel(activeAsset)}</h3><p>{activeAsset.locationLabel}</p><small>{assetAvailabilityCopy(activeAsset)}</small><small className="source-freshness">{civicAssetEvidence(activeAsset).freshnessLabel}</small>{appMode === "walk" && <button type="button" className="asset-more" onClick={() => setDetail("asset")}>See details</button>}</aside>}
    {activeTask && detail !== "task" && <aside className={`asset-popover civic-task-popover ${taskPopoverOpensLeft ? "opens-left" : ""}`} style={taskPopoverStyle} role="dialog" aria-label={activeTask.title}><div><CivicTaskIcon task={activeTask} /><IconButton label="Close" onClick={() => { setActiveTask(null); setActiveTaskPoint(null); }}><CloseIcon /></IconButton></div><span className="eyebrow">Optional · {activeTask.estimatedMinutes} min</span><h3>{activeTask.title}</h3><p>{activeTask.locationLabel}</p><small>A quick check that can help keep the map useful.</small>{taskObservations[activeTask.id] && <small className="task-complete-label"><CheckCircleIcon />Checked in this session</small>}{appMode === "walk" && <button type="button" className="asset-more" onClick={() => setDetail("task")}>{taskObservations[activeTask.id] ? "See observation" : "View check"}</button>}</aside>}
    {activeCover && <aside className="asset-popover cover-popover" style={coverPopoverStyle} role="dialog" aria-label="Likely cover"><div><UmbrellaIcon /><IconButton label="Close" onClick={() => { setActiveCover(null); setActiveCoverPoint(null); }}><CloseIcon /></IconButton></div><span className="eyebrow">Cover along this stretch</span><h3>{activeCover.label}</h3><p>{activeCover.street}</p><small>Shown as a planning preview. A live version would add current sheds, awnings, arcades, and construction.</small></aside>}
    <MapLensControl overlays={mapOverlays} onToggle={toggleMapOverlay} hour={shadeHour} onHourChange={setShadeHour} planner={appMode === "planner"} hasRoute={Boolean(route)} canEdit={!mapError} editing={editRoute} onEditingChange={(editing) => { setEditRoute(editing); if (editing) setMapLens("route"); }} />
    <div className="map-key" aria-hidden="true">{route && <span><i className="route-key" />Happy Path</span>}{mapOverlays.shade && <span><i className="shade-deep-key" />Shade at {formatClock(shadeHour)}</span>}{mapOverlays.cover && <span><i className="cover-key" />Likely cover</span>}{mapOverlays.amenities && <span><i className="amenity-key" />Nearby places</span>}{mapOverlays.tasks && <span><i className="task-key" />Optional check</span>}</div>
  </main>;
}
