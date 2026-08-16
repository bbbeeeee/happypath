import { FormEvent, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent } from "maplibre-gl";
import { defaultDestination, defaultOrigin, defaultOriginLabel, ensureGraphCoverage, graphNodeById, isInsidePilot, nearestGraphNode, nearestGraphNodeWithin, pilotGraph } from "./data/cityGraph";
import { shadowTilesIntersectingBounds, supportedArea } from "./data/supportedArea";
import { findCivicAssetsNearRoute, loadCivicAssetFixture, type CivicAsset, type CivicAssetKind } from "./data/civicAssets";
import { createSessionCivicObservation, findCivicTasksNearRoute, listCivicTasks, loadCivicTaskFixture, type CivicTask, type SessionCivicObservation } from "./data/civicTasks";
import { getMapLayerDefinition } from "./data/mapLayerCatalog";
import { sourceRegistryPresentation, type SourceRegistryPresentation } from "./data/sourceRegistry";
import { getPilotTransitEndpointCandidates } from "./data/transitEndpoints";
import { amenitiesForViewport, amenitiesWithinViewport, amenityClusterCellMeters, amenityOverviewGeoJSON, amenityViewportSampleLimit, AMENITY_CLUSTER_COUNT_LAYOUT, type AmenityViewport } from "./amenityOverview";
import { examplePromptForSelectedDestination, HERO_JOURNEYS, HERO_REQUESTS, type ExampleJourney } from "./exampleJourneys";
import { BUILDING_SHADOW_LAYER, buildingShadeDetailVisible } from "./shadeOverlay";
import { rainPromptIntent, routeShadeSegmentsGeoJSON } from "./climatePresentation";
import { buildShadeDetourScenario, evaluateShadeDetourScenario, type ShadeDetourScenario } from "./detour/shadeScenario";
import type { RepresentativeShadeScenarioResult } from "./detour/representativeShadeScenario";
import { coverContextVicinityGeoJSON, coverEvidenceMetadata, loadCoverContextGeoJSON, mappedCoverGeoJSON, mappedCoverShare, pickRainFriendlyRoute, routeCoverSegmentsGeoJSON, routeMappedCoverMeters, type CoverContextFeature } from "./coverEvidence";
import { floodEvidenceMetadata, floodOverlapForRoute, loadFloodContextGeoJSON, type FloodContextCollection } from "./floodEvidence";
import { EMPTY_ACCESS_CONTEXT, loadAccessContext, type AccessContextCollection } from "./data/accessContext";
import { EMPTY_COOL_OPTIONS, loadCoolOptions, type CoolOptionsCollection } from "./data/coolOptions";
import { ambientGreeneryGeoJSON, routeGreeneryGeoJSON } from "./greeneryPresentation";
import { searchNycAddress, searchNycAddresses, type LocationSuggestion } from "./geocoding";
import { briefSummary, DEFAULT_BRIEF, mergeTripBrief, metersToMiles, withDestinationOverride, type RoutePriority, type TripBrief as UiTripBrief } from "./planning/tripBrief";
import { interpretTripBrief } from "./planning/interpretTripBrief";
import { buildRouteCityInsightRequest, requestRouteCityInsight } from "./planning/cityInsight";
import { selectRouteThroughOptionalCivicTask } from "./planning/civicTaskRouting";
import { buildRoutingTripBrief } from "./planning/routePolicy";
import { JourneyPlanningError, planJourney, rerouteJourneyThroughWaypoint, type PlannedJourneyResult } from "./routing/journey";
import { routeComparisonDeltaGeoJSON } from "./routing/routeComparisonPresentation";
import type { Coordinate, JourneyRoute } from "./types";
import type { RouteCityInsight } from "../server/insights";
import { assetAvailabilityCopy, assetMarkerSvg, assetTransitLinesLabel, assetsGeoJSON, assetTypeLabel, civicTaskLayerVisible, civicTaskMarkerSvg, civicTasksGeoJSON, coverContextMarkerSvg, endpointsGeoJSON, routeGeoJSON } from "./mapPresentation";
import { civicAssetEvidence } from "./presentationEvidence";
import { DEFAULT_MAP_OVERLAYS, showRelevantRouteMapOverlays, toggledMapOverlay, type MapOverlays } from "./mapLayerState";
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
import { PreferencesPopover } from "./components/PreferencesPopover";
import { RouteFeedbackCard } from "./components/RouteFeedbackCard";
import { clearUserPreferences, loadUserPreferences, newTripBriefFromPreferences, saveUserPreferences, type UserPreferences } from "./preferences";
import { humanReadableEndpointName } from "./placeLabels";
import { loadWeatherContext, type WeatherContext } from "./weatherContext";
import {
  ROUTE_FEEDBACK_CATEGORY_LABELS,
  addRouteFeedback,
  clearRouteActivity,
  loadRouteActivity,
  recordMappedRoute,
  removeRouteFeedback,
  routeActivityGeoJSON,
  saveRouteActivity,
  summarizeRouteActivity,
  type RouteActivityLog,
  type RouteFeedbackCategory,
  type RouteFeedbackSentiment,
} from "./routeActivity";

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const shadowModules = import.meta.glob("./data/shadows/*-col-*/hour-*.json", { query: "?url", import: "default" });
const civicFixture = loadCivicAssetFixture();
const civicTaskFixture = loadCivicTaskFixture();
const allCivicTasks = listCivicTasks();
const civicTaskLayer = getMapLayerDefinition("civic_tasks");
const transitEndpoints = getPilotTransitEndpointCandidates({ maxSnapDistanceMeters: 50 });
const allMapAssets = [...new Map([...civicFixture.assets, ...transitEndpoints.map((candidate) => candidate.asset)].map((asset) => [asset.id, asset])).values()];
const endpointLandmarks = allMapAssets.flatMap((asset) => {
  const name = asset.kind === "drinking_fountain"
    ? asset.details.propertyName
    : asset.kind === "transit"
      ? `${asset.details.stopName} subway station`
      : null;
  return name ? [{ name, coordinate: asset.coordinate }] : [];
});
const ambientCoverLayer = mappedCoverGeoJSON(pilotGraph);
const EMPTY_COVER_CONTEXT: { type: "FeatureCollection"; features: CoverContextFeature[] } = { type: "FeatureCollection", features: [] };
const EMPTY_FLOOD_CONTEXT: FloodContextCollection = { type: "FeatureCollection", features: [] };

const INITIAL_MAP_VIEWPORT: AmenityViewport = {
  west: supportedArea.envelope.west,
  south: supportedArea.envelope.south,
  east: supportedArea.envelope.east,
  north: supportedArea.envelope.north,
  zoom: supportedArea.defaultView.zoom,
};

type AppMode = "walk" | "planner";
type EndpointKind = "origin" | "destination";
type MapLens = "route" | "shade" | "greenery" | "cover" | "flood" | "amenities" | "access" | "streetWork" | "cooling" | "tasks";
type PlannerView = "routes" | "notes" | "what_if";

interface HumanContextRecord {
  label: string;
  eyebrow: string;
  location: string | null;
  detail: string;
  sourceId: string;
}

const PRIORITY_META: Record<RoutePriority, { label: string; icon: typeof SunIcon }> = {
  shade: { label: "Less direct sun", icon: SunIcon },
  greenery: { label: "Green", icon: LeafIcon },
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

function measurement(value: unknown, suffix: string) {
  return typeof value === "number" && Number.isFinite(value) ? `${value}${suffix}` : null;
}

function accessContextRecord(properties: Record<string, unknown>): HumanContextRecord {
  const kind = String(properties.kind ?? "");
  const label = String(properties.label ?? "Mobility record");
  if (kind === "ramp_survey") {
    const survey = Number(properties.surveyedRamps ?? 0);
    const measurements = [
      measurement(properties.minimumRampWidthInches, " in min ramp width"),
      measurement(properties.maximumRunningSlopePct, "% max running slope"),
      measurement(properties.maximumRampCrossSlopePct, "% max cross-slope"),
    ].filter(Boolean).join(" · ");
    return {
      label,
      eyebrow: "Curb-ramp program corner",
      location: properties.programStatus ? String(properties.programStatus) : null,
      detail: survey > 0
        ? `${survey} historical ramp survey ${survey === 1 ? "record" : "records"}${measurements ? ` · ${measurements}` : ""}. Measurements do not establish ADA compliance or current condition.`
        : "Program-status record; no historical measurement was joined. It does not establish ADA compliance or current condition.",
      sourceId: survey > 0 ? "nyc-pedestrian-ramps" : "nyc-ramp-program-progress",
    };
  }
  if (kind === "accessible_signal") return {
    label,
    eyebrow: "Accessible pedestrian signal",
    location: properties.installedAt ? `Installed ${new Date(String(properties.installedAt)).getUTCFullYear()}` : null,
    detail: "An installed intersection-level asset record, not a live operation check or proof that every crossing arm is served.",
    sourceId: "nyc-accessible-pedestrian-signals",
  };
  if (kind === "exclusive_signal") return {
    label,
    eyebrow: String(properties.treatment ?? "Exclusive pedestrian phase"),
    location: properties.neighborhood ? String(properties.neighborhood) : null,
    detail: "A published crossing treatment; it does not establish signal operation, a safe crossing, or a continuous accessible path.",
    sourceId: "nyc-exclusive-pedestrian-signals",
  };
  return {
    label,
    eyebrow: "Subway elevator asset",
    location: properties.routes ? String(properties.routes) : null,
    detail: `${String(properties.serviceStatus ?? "Published asset status unavailable")}. This daily inventory is not a live outage feed and does not prove a continuous street-to-platform path.`,
    sourceId: "mta-elevator-assets",
  };
}

function coolOptionRecord(properties: Record<string, unknown>): HumanContextRecord {
  const status = properties.finderStatus ? `Finder status: ${String(properties.finderStatus)}. ` : "";
  return {
    label: String(properties.label ?? "Cool option"),
    eyebrow: String(properties.category ?? "NYC cool option"),
    location: properties.address ? String(properties.address) : null,
    detail: `${status}Activation, hours, access, and availability can change; verify in the official NYC finder.`,
    sourceId: "nyc-cool-options",
  };
}

function endpointName(nodeId: string | undefined) {
  if (nodeId === defaultOrigin) return defaultOriginLabel;
  return humanReadableEndpointName(nodeId ? graphNodeById(nodeId) : undefined, pilotGraph.nodes, endpointLandmarks);
}

function friendlyRouteLocation(route: JourneyRoute) {
  const street = route.streets.find((value) => value.trim() && !/^(?:unnamed|unknown|unmapped)|pedestrian\s+(?:way|path)$/i.test(value.trim()));
  return street?.trim() || "This part of the walk";
}

function resetVisibleSheetScroll() {
  window.requestAnimationFrame(() => document.querySelector<HTMLElement>(".sheet")?.scrollTo({ top: 0 }));
}

function representativeScenarioGeoJSON(
  scenario: RepresentativeShadeScenarioResult | null,
  showIntervention: boolean,
  kind: "routes" | "gap",
) {
  const edgeById = new Map(pilotGraph.edges.map((edge) => [edge.id, edge]));
  const nodeById = new Map(pilotGraph.nodes.map((node) => [node.id, node]));
  const geometry = (edgeId: string) => {
    const edge = edgeById.get(edgeId);
    if (!edge) return null;
    return edge.geometry ?? [nodeById.get(edge.from)!.coordinate, nodeById.get(edge.to)!.coordinate];
  };
  if (!scenario) return { type: "FeatureCollection" as const, features: [] };
  if (kind === "gap") {
    return {
      type: "FeatureCollection" as const,
      features: scenario.selectedGap.edgeIds.flatMap((edgeId, order) => {
        const coordinates = geometry(edgeId);
        return coordinates ? [{ type: "Feature" as const, properties: { edgeId, order }, geometry: { type: "LineString" as const, coordinates } }] : [];
      }),
    };
  }
  const primary = scenario.interventions.find((intervention) => intervention.role === "primary");
  return {
    type: "FeatureCollection" as const,
    features: primary?.journeys.flatMap((journey) => {
      const snapshots = [
        { role: "baseline" as const, route: journey.baselineRoute },
        ...(showIntervention ? [{ role: "scenario" as const, route: journey.scenarioRoute }] : []),
      ];
      return snapshots.flatMap(({ role, route }) => route.edgeIds.flatMap((edgeId, order) => {
        const coordinates = geometry(edgeId);
        return coordinates ? [{ type: "Feature" as const, properties: { role, journeyId: journey.journeyId, routeChanged: journey.routeChanged, edgeId, order }, geometry: { type: "LineString" as const, coordinates } }] : [];
      }));
    }) ?? [],
  };
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

function boundsForCoordinates(coordinates: readonly Coordinate[]) {
  if (!coordinates.length) return null;
  const bounds = new maplibregl.LngLatBounds(coordinates[0], coordinates[0]);
  coordinates.forEach((coordinate) => bounds.extend(coordinate));
  return bounds;
}

function routeActivityTitle(route: RouteActivityLog) {
  if (route.journeyShape === "loop") return `${route.originLabel} loop`;
  return `${route.originLabel} to ${route.destinationLabel}`;
}

function localActivityTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Saved locally";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
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

function setupEndpointPinElement(kind: EndpointKind) {
  const element = document.createElement("div");
  element.className = `setup-endpoint-pin setup-endpoint-pin-${kind}`;
  element.setAttribute("aria-hidden", "true");
  element.innerHTML = `<span class="setup-endpoint-pin-body"><b>${kind === "origin" ? "F" : "T"}</b></span>`;
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
    ...(brief.priorities.includes("shade") ? ["nyc-building-footprints", "building-shadow-model"] : []),
    ...(brief.priorities.includes("greenery") ? ["nyc-forestry-tree-points", "nyc-parks-properties", "greenery-edge-model"] : []),
    ...assets.map((asset) => asset.sourceId),
    ...tasks.flatMap((task) => task.sourceIds),
  ]);
}

function referenceSourcePresentations(brief: UiTripBrief, rainContext: boolean) {
  const priorityIds = [
    ...(rainContext || brief.priorities.includes("construction") ? ["nyc-sidewalk-shed-permits", "nyc-street-construction-closures"] : []),
    ...(brief.avoidMappedSteps ? ["nyc-pedestrian-ramps"] : []),
  ];
  return uniqueSourcePresentations([
    ...priorityIds,
    "nyc-pops",
    "nyc-pedestrian-ramps",
    "nyc-sidewalk-shed-permits",
    "nyc-dot-pedestrian-plazas",
  ]).slice(0, 6);
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
    routeValueFrontier: result.routeValueFrontier?.recommendedCandidateId === selected.candidateId
      ? result.routeValueFrontier
      : null,
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
      id: "mapped_overhead_cover",
      weight: 1,
      score: mappedCoverShare,
    } : undefined,
  } as const;
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
  return <div className="brand"><span>Footnote<sup>1</sup></span><small>Manhattan · Battery to 60th</small></div>;
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

interface LocationComboboxProps {
  id: string;
  label: string;
  ariaLabel: string;
  kind: EndpointKind;
  value: string;
  placeholder?: string;
  disabled: boolean;
  mapSelectionActive: boolean;
  onFocus: () => void;
  onEscape: () => void;
  onChange: (value: string) => void;
  onSelect: (suggestion: LocationSuggestion) => void | Promise<void>;
}

function LocationCombobox({ id, label, ariaLabel, kind, value, placeholder, disabled, mapSelectionActive, onFocus, onEscape, onChange, onSelect }: LocationComboboxProps) {
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready">("idle");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const listboxId = `${id}-suggestions`;
  const query = value.trim();

  useEffect(() => {
    if (!focused || disabled || query.length < 3) {
      setSuggestions([]);
      setStatus("idle");
      setHighlightedIndex(-1);
      return;
    }
    let cancelled = false;
    setStatus("loading");
    const timer = window.setTimeout(() => {
      void searchNycAddresses(query, 5)
        .then((results) => {
          if (cancelled) return;
          setSuggestions(results.filter((result) => isInsidePilot(result.coordinate)));
          setHighlightedIndex(-1);
          setStatus("ready");
        })
        .catch(() => {
          if (cancelled) return;
          setSuggestions([]);
          setHighlightedIndex(-1);
          setStatus("ready");
        });
    }, 275);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [disabled, focused, query]);

  const expanded = focused && query.length >= 3 && (status === "loading" || suggestions.length > 0);
  const chooseSuggestion = (suggestion: LocationSuggestion) => {
    setFocused(false);
    setSuggestions([]);
    setStatus("idle");
    setHighlightedIndex(-1);
    void onSelect(suggestion);
  };

  return <div className={`location-input location-input-${kind} ${mapSelectionActive ? "map-selection-active" : ""}`} onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
  }}>
    <span className={`location-dot ${kind}-dot`} />
    <label className="field-label" htmlFor={id}>{label}</label>
    <input
      id={id}
      role="combobox"
      aria-label={ariaLabel}
      aria-autocomplete="list"
      aria-expanded={expanded}
      aria-controls={listboxId}
      aria-activedescendant={highlightedIndex >= 0 ? `${listboxId}-${highlightedIndex}` : undefined}
      autoComplete="off"
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onFocus={() => { setFocused(true); onFocus(); }}
      onChange={(event) => { setFocused(true); setHighlightedIndex(-1); onChange(event.target.value); }}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown" && suggestions.length) {
          event.preventDefault();
          setHighlightedIndex((current) => current < suggestions.length - 1 ? current + 1 : 0);
        } else if (event.key === "ArrowUp" && suggestions.length) {
          event.preventDefault();
          setHighlightedIndex((current) => current > 0 ? current - 1 : suggestions.length - 1);
        } else if (event.key === "Enter" && highlightedIndex >= 0) {
          event.preventDefault();
          chooseSuggestion(suggestions[highlightedIndex]);
        } else if (event.key === "Escape") {
          if (expanded) {
            event.preventDefault();
            setFocused(false);
            setSuggestions([]);
          }
          onEscape();
        }
      }}
    />
    {expanded && <div id={listboxId} className="location-suggestions" role="listbox" aria-label={`${label} location suggestions`}>
      {status === "loading"
        ? <div className="location-suggestion-status" role="status">Finding nearby locations…</div>
        : suggestions.map((suggestion, index) => <button
          type="button"
          id={`${listboxId}-${index}`}
          key={`${suggestion.label}-${suggestion.coordinate.join(",")}`}
          role="option"
          aria-selected={index === highlightedIndex}
          className={index === highlightedIndex ? "highlighted" : ""}
          onMouseDown={(event) => event.preventDefault()}
          onMouseEnter={() => setHighlightedIndex(index)}
          onClick={() => chooseSuggestion(suggestion)}
        ><span>{suggestion.label}</span><small>Manhattan</small></button>)}
    </div>}
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
  mapEndpointSelection: "origin" | "destination" | null;
  onMapEndpointSelectionChange: (selection: "origin" | "destination" | null) => void;
  busy: boolean;
  busyMode: ThinkingMode | null;
  error: string;
  onPlan: () => void;
  onSelectExample: (example: ExampleJourney) => void | Promise<void>;
  onSelectLocation: (kind: EndpointKind, suggestion: LocationSuggestion) => void | Promise<void>;
}

function ComposeSheet({ brief, setBrief, prompt, setPrompt, originText, setOriginText, destinationText, setDestinationText, mapEndpointSelection, onMapEndpointSelectionChange, busy, busyMode, error, onPlan, onSelectExample, onSelectLocation }: ComposeSheetProps) {
  const [manualChanged, setManualChanged] = useState(false);
  const animatedPlaceholder = useTypingPlaceholder(HERO_REQUESTS);
  const setManualBrief = (nextBrief: UiTripBrief) => { setManualChanged(true); setBrief(nextBrief); };
  return <section className="sheet compose-sheet" aria-label="Plan a route">
    <div className="sheet-handle" />
    <div className="compose-heading"><span className="eyebrow">Experience the city how you want</span><h1>What’s the plan?</h1></div>
    <div className={`location-stack ${mapEndpointSelection ? "selecting-on-map" : ""}`}>
      <LocationCombobox id="route-origin" label="From" ariaLabel="Starting point" kind="origin" value={originText} disabled={busy} mapSelectionActive={mapEndpointSelection === "origin"} onFocus={() => onMapEndpointSelectionChange("origin")} onEscape={() => onMapEndpointSelectionChange(null)} onChange={(value) => { onMapEndpointSelectionChange(null); setOriginText(value); }} onSelect={(suggestion) => onSelectLocation("origin", suggestion)} />
      <LocationCombobox id="route-destination" label="To" ariaLabel="Destination" kind="destination" value={destinationText} disabled={busy} mapSelectionActive={mapEndpointSelection === "destination"} onFocus={() => onMapEndpointSelectionChange("destination")} onEscape={() => onMapEndpointSelectionChange(null)} onChange={(value) => { onMapEndpointSelectionChange(null); setDestinationText(value); setManualChanged(true); }} onSelect={(suggestion) => { setManualChanged(true); return onSelectLocation("destination", suggestion); }} placeholder="Optional — or ask for a loop or wander" />
    </div>
    <label className="prompt-box">
      <SparkIcon />
      <textarea aria-label="Describe your route" value={prompt} disabled={busy} onChange={(event) => setPrompt(event.target.value)} placeholder={animatedPlaceholder || HERO_REQUESTS[0]} rows={4} />
    </label>
    <div className="prompt-shortcuts" aria-label="Example walk requests"><span>Try</span>{HERO_JOURNEYS.map((example) => <button type="button" key={example.id} title={example.prompt} disabled={busy} onClick={() => void onSelectExample(example)}>{example.label}</button>)}</div>
    <details className="manual-details"><summary>Choose the details instead</summary><WalkControls brief={brief} onChange={setManualBrief} destinationText={destinationText} onDestinationTextChange={(value) => { setManualChanged(true); setDestinationText(value); }} /></details>
    {error && <p className="status-message error" role="alert">{error}</p>}
    {busy && <ThinkingStatus mode={busyMode ?? "plan"} />}
    <button type="button" className="primary-action" disabled={busy || (!prompt.trim() && !manualChanged && !destinationText.trim())} onClick={onPlan}><span>{busy ? "Finding your path…" : "Find my path"}</span><ArrowIcon /></button>
    <p className="privacy-note">Routes, notes, and preferences stay on this device. Clear them anytime in City view.</p>
  </section>;
}

function AssetIcon({ kind }: { kind: CivicAssetKind }) {
  if (kind === "seating") return <BenchIcon />;
  if (kind === "restroom") return <RestroomIcon />;
  if (kind === "transit") return <TrainIcon />;
  return <DropletIcon />;
}

function CivicTaskIcon({ task }: { task: CivicTask }) {
  if (task.action === "photo") return <CameraIcon />;
  if (task.action === "observe") return <SparkIcon />;
  return <CheckCircleIcon />;
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

async function registerCivicTaskMarkerImages(map: MapLibreMap) {
  await Promise.all((["verify", "observe", "photo"] as const).map((action) => new Promise<void>((resolve, reject) => {
    const id = `civic-task-${action}`;
    if (map.hasImage(id)) { resolve(); return; }
    const image = new Image();
    image.onload = () => { if (!map.hasImage(id)) map.addImage(id, image, { pixelRatio: 2 }); resolve(); };
    image.onerror = () => reject(new Error(`Could not load the ${action} task map icon.`));
    image.src = civicTaskMarkerSvg(action);
  })));
}

async function registerCoverContextMarkerImages(map: MapLibreMap) {
  await Promise.all((["sidewalk_shed_permit", "pops_arcade"] as const).map((kind) => new Promise<void>((resolve, reject) => {
    const id = `cover-context-${kind}`;
    if (map.hasImage(id)) { resolve(); return; }
    const image = new Image();
    image.onload = () => { if (!map.hasImage(id)) map.addImage(id, image, { pixelRatio: 2 }); resolve(); };
    image.onerror = () => reject(new Error(`Could not load the ${kind} map icon.`));
    image.src = coverContextMarkerSvg(kind);
  })));
}

function registerFloodPatternImages(map: MapLibreMap) {
  const patterns = [
    { id: "flood-nuisance-pattern", color: [66, 106, 124, 125], background: [66, 106, 124, 34], secondDiagonal: false },
    { id: "flood-deep-pattern", color: [48, 72, 96, 165], background: [48, 72, 96, 52], secondDiagonal: true },
  ] as const;
  for (const pattern of patterns) {
    if (map.hasImage(pattern.id)) continue;
    const width = 12;
    const bytes = new Uint8ClampedArray(width * width * 4);
    for (let y = 0; y < width; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 4;
        bytes.set(pattern.background, offset);
        const diagonal = (x + y) % 8 <= 1;
        const reverse = pattern.secondDiagonal && ((width - x + y) % 8 <= 1);
        if (!diagonal && !reverse) continue;
        bytes.set(pattern.color, offset);
      }
    }
    map.addImage(pattern.id, { width, height: width, data: bytes }, { pixelRatio: 2 });
  }
}

function ResultSheet({ brief, route, result, assets, tasks, destinationText, setDestinationText, delta, error, feedback, activityPersisted, onBack, onRefine, onAdjust, onShowWhy, onShowAsset, onShowTask, onShowData, onSaveFeedback, onRemoveFeedback, showBaseline, setShowBaseline, busy, busyMode, modelFallback, rainContext }: {
  brief: UiTripBrief;
  route: JourneyRoute;
  result: PlannedJourneyResult;
  assets: CivicAsset[];
  tasks: CivicTask[];
  destinationText: string;
  setDestinationText: (value: string) => void;
  delta: string;
  error: string;
  feedback: RouteActivityLog["feedback"];
  activityPersisted: boolean;
  onBack: () => void;
  onRefine: (value: string) => Promise<boolean>;
  onAdjust: (brief: UiTripBrief) => Promise<boolean>;
  onShowWhy: () => void;
  onShowAsset: (asset: CivicAsset) => void;
  onShowTask: (task: CivicTask) => void;
  onShowData: () => void;
  onSaveFeedback: (input: { sentiment: RouteFeedbackSentiment; category: RouteFeedbackCategory | null; body: string }) => void;
  onRemoveFeedback: (feedbackId: string) => void;
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
  const mappedCoverMeters = routeMappedCoverMeters(route, pilotGraph);
  const headline = rainContext
    ? mappedCoverMeters >= 25 ? "A route with more mapped cover" : "Cover checked without inventing gaps"
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
  const summary = [...briefSummary(brief), rainContext ? "Mapped-cover preference" : null, `Leaving ${formatClock(brief.departureHour)}`].filter(Boolean) as string[];
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
  const frontier = result.routeValueFrontier?.status === "meaningful_alternative" ? result.routeValueFrontier : null;
  const frontierPoint = frontier?.points.find((point) => point.candidateId === route.candidateId) ?? null;
  const frontierGain = frontier?.metric === "direct_sun_minutes"
    ? `${(frontierPoint?.benefit ?? 0).toFixed(1)} fewer minutes in direct sun`
    : frontier?.metric === "greenery_points"
      ? `${(frontierPoint?.benefit ?? 0).toFixed(0)} points greener`
      : `${Math.round((frontierPoint?.benefit ?? 0) * 100)}% better preference fit`;
  const timingDifference = Math.abs(Math.round(result.timing.differenceMinutes ?? 0));
  return <section className="sheet result-sheet" aria-label="Your Footnote">
    <div className="sheet-handle" />
    <div className="result-nav"><IconButton label="Plan a new route" onClick={onBack}><BackIcon /></IconButton><span>Your Footnote</span><span className="result-time">{brief.distanceMiles !== null ? `${formatMiles(routeMiles)} mi` : formatMinutes(route.durationMinutes)}</span></div>
    {busy && <ThinkingStatus mode={busyMode ?? "refine"} />}
    {delta && <div className="route-delta"><SparkIcon />Route updated · {delta}</div>}
    <div className="result-lead"><h1>{headline}</h1><p>{routeTiming}</p></div>
    {frontier && frontierPoint && result.baseline && <section className="route-value-summary" aria-label="What extra time buys"><span className="eyebrow">What extra time buys</span><strong>{frontierGain}</strong><p>for {frontierPoint.extraMinutes.toFixed(1)} extra minutes · captures {Math.round(frontierPoint.capturedBenefitRatio * 100)}% of the best measured gain</p><div><span><small>Fastest</small><strong>{formatMinutes(result.baseline.durationMinutes)}</strong></span><span><small>Footnote</small><strong>{formatMinutes(route.durationMinutes)}</strong></span></div>{brief.avoidMappedSteps && <small className="retained-requirement">Still avoids mapped steps</small>}</section>}
    {result.timing.status === "closest-feasible" && <div className="timing-note" role="status">{brief.distanceMiles !== null ? <RouteIcon /> : <ClockIcon />}<span><strong>Closest route we could make</strong><small>{brief.distanceMiles !== null && distanceDifferenceMiles !== null ? `${Math.abs(distanceDifferenceMiles).toFixed(1)} miles ${distanceDifferenceMiles < 0 ? "shorter" : "longer"} than requested.` : `${timingDifference} minutes ${route.durationMinutes < (result.timing.requestedMinutes ?? 0) ? "shorter" : "longer"} than requested.`}</small></span></div>}
    <div className="intent-summary"><div><span className="eyebrow">Your plan</span><strong className="brief-sentence">{summary[0]}</strong><small>{summary.slice(1).join(" · ")}</small></div><button type="button" onClick={() => setShowAdjustments((value) => !value)} aria-expanded={showAdjustments}>{showAdjustments ? "Close" : "Edit"}</button></div>
    {showAdjustments && <div className="adjust-panel"><WalkControls brief={draftBrief} onChange={setDraftBrief} destinationText={destinationText} onDestinationTextChange={(value) => { setDestinationText(value); setDraftBrief((current) => mergeTripBrief(current, { destinationQuery: value.trim() || null }, "controls")); }} /><button type="button" className="apply-adjustments" disabled={busy} onClick={applyAdjustments}>{busy ? "Updating your walk…" : "Update this walk"}</button></div>}
    <div className="benefit-list">
      {rainContext && <button type="button" onClick={onShowData}><CloudRainIcon /><span><strong>{mappedCoverMeters >= 1 ? `About ${Math.round(mappedCoverMeters)} m mapped with overhead cover` : "No mapped cover found on this path"}</strong><small>{mappedCoverMeters >= 1 ? "Community-mapped stretches are highlighted; conditions may have changed" : "Most streets are unassessed, not confirmed open to rain"}</small></span><ChevronIcon /></button>}
      {brief.priorities.includes("shade") && <button type="button" onClick={onShowWhy}><SunIcon /><span>{route.directSunMinutes < 0.05 ? <><strong>A naturally cool departure</strong><small>No direct sun expected at {formatClock(brief.departureHour)}</small></> : sunSaved !== null && sunSaved >= 0.05 ? <><strong>{sunSaved.toFixed(1)} fewer min in the sun</strong><small>compared with the quickest route</small></> : <><strong>{route.shadePercent.toFixed(0)}% in shade</strong><small>around {formatClock(brief.departureHour)}, based on sun and buildings</small></>}</span><ChevronIcon /></button>}
      {brief.priorities.includes("greenery") && <button type="button" onClick={onShowWhy}><LeafIcon /><span>{greenGain !== null && greenGain >= 0.5 ? <><strong>{greenGain.toFixed(0)} points greener</strong><small>than the quickest route</small></> : <><strong>Trees and parks along {route.greeneryPercent.toFixed(0)}% of the way</strong><small>drawn from nearby city listings</small></>}</span><ChevronIcon /></button>}
      {assets.slice(0, 2).map((asset) => <button type="button" key={asset.id} onClick={() => onShowAsset(asset)}><AssetIcon kind={asset.kind} /><span><strong>{asset.name}</strong><small>{assetTransitLinesLabel(asset) ? `${assetTransitLinesLabel(asset)} · ` : ""}Right along your route · details may have changed</small></span><ChevronIcon /></button>)}
      {brief.avoidMappedSteps && <button type="button" onClick={onShowWhy}><StairsIcon /><span><strong>Skips known stairs</strong><small>Check curb ramps and street conditions as you go</small></span><ChevronIcon /></button>}
    </div>
    {tasks[0] && <button type="button" className="civic-task-card" onClick={() => onShowTask(tasks[0])}><span className="task-icon"><CivicTaskIcon task={tasks[0]} /></span><span><small>Optional stop · {tasks[0].estimatedMinutes} min</small><strong>{tasks[0].title}</strong><span>{tasks[0].locationLabel}</span></span><ChevronIcon /></button>}
    {brief.civicTaskIntent && tasks.length === 0 && <div className="coverage-note task-miss"><strong>No quick data check fit this walk</strong><span>Your path stays the same. Add a little time if you’d like one along the way.</span></div>}
    {missingAmenities.length > 0 && <div className="coverage-note"><strong>No {missingAmenities.map((kind) => ({ seating: "place to sit", restroom: "restroom", drinking_fountain: "water stop", transit: "subway entrance" })[kind]).join(" or ")} spotted along this path</strong><span>Nearby listings can miss recent changes.</span></div>}
    <div className="confidence-row"><span className="confidence-dot" /><p><strong>Made around what matters to you</strong><small>{brief.priorities.includes("shade") ? "Shade, timing, and useful stops are folded into this path." : "Timing and useful stops are folded into this path."}</small></p></div>
    {result.baseline && hasDistinctBaseline && <button type="button" className="text-action" onClick={() => setShowBaseline(!showBaseline)}><span className="baseline-swatch" />{showBaseline ? "Hide" : "Compare with"} fastest · {formatMinutes(result.baseline.durationMinutes)}</button>}
    {brief.unsupported.length > 0 && <details className="request-limit"><summary>{limitationHeading(brief.unsupported)}</summary><p>{brief.unsupported.map(friendlyLimitation).join(" ")}</p></details>}
    <div className="result-tools">
      <RouteFeedbackCard feedback={feedback} persisted={activityPersisted} onSave={onSaveFeedback} onRemove={onRemoveFeedback} />
    </div>
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
        : [assetTransitLinesLabel(asset), asset.details.entranceType, asset.details.publishedEntryAllowed === true ? "Listed as an entrance" : null];
  return <>
    <div className="asset-detail-title"><AssetIcon kind={asset.kind} /><span><span className="eyebrow">{assetTypeLabel(asset)}</span><h2>{asset.name}</h2></span></div>
    <p>{asset.kind === "transit" ? asset.details.entranceType ?? "Mapped subway entrance" : asset.locationLabel}</p>
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
        {assets.map((asset) => <article key={asset.id}><AssetIcon kind={asset.kind} /><span><strong>{asset.name}</strong><small>{assetTransitLinesLabel(asset) ? `${assetTransitLinesLabel(asset)}. ` : ""}{asset.kind === "transit" ? asset.details.entranceType ?? "Mapped subway entrance" : asset.locationLabel}. From a city listing; details may have changed.</small></span></article>)}
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

function PlannerSheet({ route, scenario, floodOverlap, floodLoaded, insight, insightBusy, insightError, lens, onLensChange, targetShade, onTargetShadeChange, onBack, onUseSample, onPlannerPrompt, activity, activityPersisted, view, onViewChange, selectedActivityRouteId, onSelectActivityRoute, onClearActivity }: {
  route: JourneyRoute | null;
  scenario: ShadeDetourScenario | null;
  floodOverlap: ReturnType<typeof floodOverlapForRoute> | null;
  floodLoaded: boolean;
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
  activity: RouteActivityLog[];
  activityPersisted: boolean;
  view: PlannerView;
  onViewChange: (view: PlannerView) => void;
  selectedActivityRouteId: string | null;
  onSelectActivityRoute: (routeId: string) => void;
  onClearActivity: () => void;
}) {
  const [plannerPrompt, setPlannerPrompt] = useState("");
  const counts = civicFixture.counts;
  const coverMeters = route ? Math.round(routeMappedCoverMeters(route, pilotGraph)) : 0;
  const activitySummary = summarizeRouteActivity(activity);
  const feedbackRows = activity
    .flatMap((activityRoute) => activityRoute.feedback.map((feedback) => ({ activityRoute, feedback })))
    .sort((a, b) => b.feedback.createdAt.localeCompare(a.feedback.createdAt));
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
    <div className="result-nav"><IconButton label="Back to walk" onClick={onBack}><BackIcon /></IconButton><span>City view</span><span className="local-data-pill">Local data</span></div>
    <div className="planner-lead"><span className="eyebrow">{view === "routes" ? "Route activity" : view === "notes" ? "Resident feedback" : "See what’s missing"}</span><h1>{view === "routes" ? (activity.length ? `${activitySummary.mappedEvents} ${activitySummary.mappedEvents === 1 ? "route" : "routes"} mapped here` : "No routes saved here yet") : view === "notes" ? (activitySummary.feedbackCount ? `${activitySummary.feedbackCount} ${activitySummary.feedbackCount === 1 ? "note" : "notes"} from these routes` : "No route notes yet") : route ? "What could make this walk feel better?" : "Where could the city feel more comfortable?"}</h1><p>{view === "routes" ? "See the paths explored in this browser, without turning them into a neighborhood score." : view === "notes" ? "Read lived observations alongside the path they describe." : route ? "Use the map layers, then try one small planning change." : "Start with a representative walk, then inspect comfort gaps."}</p></div>
    <div className="planner-sections" role="tablist" aria-label="City view sections">
      <button type="button" role="tab" aria-selected={view === "routes"} className={view === "routes" ? "active" : ""} onClick={() => onViewChange("routes")}><RouteIcon />Routes</button>
      <button type="button" role="tab" aria-selected={view === "notes"} className={view === "notes" ? "active" : ""} onClick={() => onViewChange("notes")}><CheckCircleIcon />Notes{activitySummary.feedbackCount ? <span>{activitySummary.feedbackCount}</span> : null}</button>
      <button type="button" role="tab" aria-selected={view === "what_if"} className={view === "what_if" ? "active" : ""} onClick={() => onViewChange("what_if")}><SparkIcon />What-if</button>
    </div>
    {view === "routes" && <div className="planner-activity-panel" role="tabpanel">
      {activity.length ? <>
        <div className="planner-overview-stats"><span><strong>{activitySummary.uniqueRoutes}</strong> distinct paths</span><span><strong>{activitySummary.mappedEvents}</strong> times mapped</span><span><strong>{activitySummary.totalMiles.toFixed(1)}</strong> total mi</span></div>
        <div className="activity-route-list" aria-label="Recent route activity">{activity.slice(0, 12).map((activityRoute) => <button type="button" key={activityRoute.id} className={selectedActivityRouteId === activityRoute.id ? "selected" : ""} aria-pressed={selectedActivityRouteId === activityRoute.id} onClick={() => onSelectActivityRoute(activityRoute.id)}><span><strong>{routeActivityTitle(activityRoute)}</strong><small>{localActivityTime(activityRoute.lastMappedAt)} · {formatMiles(metersToMiles(activityRoute.distanceMeters))} mi · {Math.round(activityRoute.durationMinutes)} min</small></span><span>{activityRoute.timesMapped > 1 ? `${activityRoute.timesMapped}×` : ""}{activityRoute.feedback.length ? `${activityRoute.feedback.length} ${activityRoute.feedback.length === 1 ? "note" : "notes"}` : ""}</span></button>)}</div>
      </> : <><div className="planner-empty"><RouteIcon /><div><strong>Map a route to start the local log</strong><span>Different paths will appear here as traces planners can inspect.</span></div></div><button type="button" className="primary-action" onClick={onUseSample}><span>Use a sample walk</span><ArrowIcon /></button></>}
      <div className="local-activity-scope"><strong>{activityPersisted ? "Only this browser" : "This session only"}</strong><span>{activityPersisted ? "Routes and notes stay on this device. They are not shared or representative of citywide demand." : "Browser storage is unavailable, so this activity will disappear when the page closes."}</span>{activity.length > 0 && <button type="button" onClick={onClearActivity}>Clear local activity</button>}</div>
    </div>}
    {view === "notes" && <div className="planner-activity-panel" role="tabpanel">
      {feedbackRows.length ? <>
        <div className="planner-overview-stats"><span><strong>{activitySummary.feedbackCount}</strong> notes</span><span><strong>{activitySummary.needsAttentionCount}</strong> need attention</span><span><strong>{activity.filter((item) => item.feedback.length).length}</strong> paths</span></div>
        {activitySummary.categories.length > 0 && <div className="feedback-signal-bars"><span className="eyebrow">What notes mention</span>{activitySummary.categories.map((item) => <div key={item.category}><span><strong>{ROUTE_FEEDBACK_CATEGORY_LABELS[item.category]}</strong><small>{item.count}</small></span><i><b style={{ width: `${Math.max(8, item.share * 100)}%` }} /></i></div>)}</div>}
        <div className="activity-note-list">{feedbackRows.slice(0, 12).map(({ activityRoute, feedback }) => <button type="button" key={feedback.id} className={selectedActivityRouteId === activityRoute.id ? "selected" : ""} onClick={() => onSelectActivityRoute(activityRoute.id)}><span><strong>{feedback.sentiment === "needs_attention" ? "Needs attention" : feedback.sentiment === "worked_well" ? "Worked well" : "Route note"}{feedback.category ? ` · ${ROUTE_FEEDBACK_CATEGORY_LABELS[feedback.category]}` : ""}</strong><small>{routeActivityTitle(activityRoute)} · {localActivityTime(feedback.createdAt)}</small></span><p>{feedback.body}</p></button>)}</div>
      </> : <div className="planner-empty"><CheckCircleIcon /><div><strong>Notes will appear with their routes</strong><span>Open a mapped route and choose “Add a route note.”</span></div></div>}
      <div className="local-activity-scope"><strong>Context, not a score</strong><span>These notes describe individual routes saved in this browser. They do not measure population need.</span></div>
    </div>}
    {view === "what_if" && <div className="planner-what-if" role="tabpanel">{!route ? <>
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
      {lens === "greenery" && <div className="planner-gap-list greenery-gap-list"><div><LeafIcon /><span><strong>Trees and parks shape about {Math.round(route.greeneryPercent)}% of this walk</strong><small>The moss ribbons follow street edges with nearby public tree or park listings, not measured canopy.</small></span></div><div><LayersIcon /><span><strong>{route.nearbyTreeCount} tree listings near the route</strong><small>{route.adjacentParkNames.length ? `Park context includes ${route.adjacentParkNames.slice(0, 3).join(", ")}.` : "No adjacent park listing appears on this route."} Conditions and access can change.</small></span></div></div>}
      {lens === "cover" && <div className="planner-gap-list"><div><UmbrellaIcon /><span><strong>{coverMeters ? `About ${coverMeters} m of this route are mapped with overhead cover` : "No explicit covered-way tags on this route"}</strong><small>Indigo marks mapped passages. Streets without a mark are unassessed.</small></span></div><div><CloudRainIcon /><span><strong>{coverEvidenceMetadata.counts.sidewalk_shed_permits} shed locations · {coverEvidenceMetadata.counts.pops_arcades} arcade listing · {coverEvidenceMetadata.counts.construction_closures} construction records</strong><small>These nearby City records are context only and do not create covered route meters. Awnings are not inferred.</small></span></div></div>}
      {lens === "flood" && <div className="planner-gap-list flood-gap-list"><div><CloudRainIcon /><span><strong>{!floodLoaded ? "Loading DEP’s flood model…" : floodOverlap && floodOverlap.totalMeters > 0 ? `About ${Math.round(floodOverlap.totalMeters)} m of this walk cross modeled flood-potential areas` : "This walk does not cross areas shown in this model"}</strong><small>{floodOverlap && floodOverlap.deepContiguousMeters > 0 ? `${Math.round(floodOverlap.deepContiguousMeters)} m overlap the model’s deeper category. ` : ""}No overlap is not proof that a street will stay dry.</small></span></div><div><LayersIcon /><span><strong>{floodEvidenceMetadata.counts.nuisance_ponding_areas} nuisance-ponding areas · {floodEvidenceMetadata.counts.deep_contiguous_areas} deeper areas</strong><small>DEP’s 2.13-inch-per-hour scenario with projected 2050 sea-level rise. This is a planning model, not live flooding.</small></span></div><div><ExternalLinkIcon /><span><strong>Conditions can change quickly</strong><small>Never walk through standing water. Check official alerts before heading out.</small><a href="https://a858-nycnotify.nyc.gov/notifynyc/" target="_blank" rel="noreferrer">Open Notify NYC</a></span></div><InsightSourceLinks sourceIds={["nyc-stormwater-flood-map-2050"]} label="Model source" /></div>}
      {lens === "amenities" && <div className="planner-gap-list"><div><BenchIcon /><span><strong>{counts.seating} places to sit nearby</strong><small>Bench icons and counted clusters keep the inventory readable at each zoom.</small></span></div><div><RestroomIcon /><span><strong>{counts.restroom} public restrooms nearby</strong><small>Tap a place to see when the listing was refreshed.</small></span></div><div><DropletIcon /><span><strong>{counts.drinking_fountain} water stops nearby</strong><small>Open status can change.</small></span></div></div>}
      {lens === "tasks" && <div className="planner-gap-list task-gap-list"><div><CheckCircleIcon /><span><strong>{allCivicTasks.length} small ways to help nearby</strong><small>Quick partner prompts help fill in what has changed.</small></span></div><div><CameraIcon /><span><strong>Verify, observe, or add one focused photo</strong><small>Responses stay separate from city records and expire after a short window.</small></span></div><div><LayersIcon /><span><strong>Checks, never neighborhood scores</strong><small>Each check asks for one fact without ranking a block or community.</small></span></div></div>}
      {lens !== "tasks" && lens !== "flood" && <div className="planner-insights">
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
    </div>}
  </section>;
}

function RepresentativePlannerSheet({ scenario, showIntervention, onShowIntervention, onBack, activity, activityPersisted, view, onViewChange, selectedActivityRouteId, onSelectActivityRoute, onClearActivity }: {
  scenario: RepresentativeShadeScenarioResult | null;
  showIntervention: boolean;
  onShowIntervention: () => void;
  onBack: () => void;
  activity: RouteActivityLog[];
  activityPersisted: boolean;
  view: PlannerView;
  onViewChange: (view: PlannerView) => void;
  selectedActivityRouteId: string | null;
  onSelectActivityRoute: (routeId: string) => void;
  onClearActivity: () => void;
}) {
  const primary = scenario?.interventions.find((intervention) => intervention.role === "primary") ?? null;
  const alternative = scenario?.interventions.find((intervention) => intervention.role === "alternative") ?? null;
  const summary = summarizeRouteActivity(activity);
  const feedbackRows = activity
    .flatMap((activityRoute) => activityRoute.feedback.map((feedback) => ({ activityRoute, feedback })))
    .sort((a, b) => b.feedback.createdAt.localeCompare(a.feedback.createdAt));
  return <section className="sheet planner-sheet" aria-label="City route activity and planning analysis">
    <div className="sheet-handle" />
    <div className="result-nav"><IconButton label="Back to walk" onClick={onBack}><BackIcon /></IconButton><span>City view</span><span className="local-data-pill">Local data</span></div>
    <div className="planner-lead"><span className="eyebrow">{view === "routes" ? "Route activity" : view === "notes" ? "Resident feedback" : "Across representative journeys"}</span><h1>{view === "routes" ? (activity.length ? `${summary.mappedEvents} ${summary.mappedEvents === 1 ? "route" : "routes"} mapped here` : "No routes saved here yet") : view === "notes" ? (summary.feedbackCount ? `${summary.feedbackCount} ${summary.feedbackCount === 1 ? "route note" : "route notes"}` : "No route notes yet") : scenario?.question ?? "Looking across representative journeys…"}</h1><p>{view === "routes" ? "Inspect paths explored in this browser without turning them into a neighborhood score." : view === "notes" ? "Read lived observations alongside the routes they describe." : `${scenario?.geography ?? "Loading the planning sample"}. This sample uses public anchors, not observed demand.`}</p></div>
    <div className="planner-sections" role="tablist" aria-label="City view sections">
      <button type="button" role="tab" aria-selected={view === "routes"} className={view === "routes" ? "active" : ""} onClick={() => onViewChange("routes")}><RouteIcon />Routes</button>
      <button type="button" role="tab" aria-selected={view === "notes"} className={view === "notes" ? "active" : ""} onClick={() => onViewChange("notes")}><CheckCircleIcon />Notes{summary.feedbackCount ? <span>{summary.feedbackCount}</span> : null}</button>
      <button type="button" role="tab" aria-selected={view === "what_if"} className={view === "what_if" ? "active" : ""} onClick={() => onViewChange("what_if")}><SparkIcon />What-if</button>
    </div>
    {view === "routes" && <div className="planner-activity-panel" role="tabpanel">
      {activity.length ? <><div className="planner-overview-stats"><span><strong>{summary.uniqueRoutes}</strong> distinct paths</span><span><strong>{summary.mappedEvents}</strong> times mapped</span><span><strong>{summary.totalMiles.toFixed(1)}</strong> total mi</span></div><div className="activity-route-list" aria-label="Recent route activity">{activity.slice(0, 12).map((activityRoute) => <button type="button" key={activityRoute.id} className={selectedActivityRouteId === activityRoute.id ? "selected" : ""} aria-pressed={selectedActivityRouteId === activityRoute.id} onClick={() => onSelectActivityRoute(activityRoute.id)}><span><strong>{routeActivityTitle(activityRoute)}</strong><small>{localActivityTime(activityRoute.lastMappedAt)} · {formatMiles(metersToMiles(activityRoute.distanceMeters))} mi · {Math.round(activityRoute.durationMinutes)} min</small></span><span>{activityRoute.timesMapped > 1 ? `${activityRoute.timesMapped}×` : ""}{activityRoute.feedback.length ? `${activityRoute.feedback.length} ${activityRoute.feedback.length === 1 ? "note" : "notes"}` : ""}</span></button>)}</div></> : <><div className="planner-empty"><RouteIcon /><div><strong>Map a route to start the local log</strong><span>Different paths will appear here as traces planners can inspect.</span></div></div><button type="button" className="primary-action" onClick={onBack}><span>Plan a route</span><ArrowIcon /></button></>}
      <div className="local-activity-scope"><strong>{activityPersisted ? "Only this browser" : "This session only"}</strong><span>{activityPersisted ? "Routes and notes stay on this device. They are not shared or representative of citywide demand." : "Browser storage is unavailable, so this activity will disappear when the page closes."}</span>{activity.length > 0 && <button type="button" onClick={onClearActivity}>Clear local activity</button>}</div>
    </div>}
    {view === "notes" && <div className="planner-activity-panel" role="tabpanel">
      {feedbackRows.length ? <><div className="planner-overview-stats"><span><strong>{summary.feedbackCount}</strong> notes</span><span><strong>{summary.needsAttentionCount}</strong> need attention</span><span><strong>{activity.filter((item) => item.feedback.length).length}</strong> paths</span></div>{summary.categories.length > 0 && <div className="feedback-signal-bars"><span className="eyebrow">What notes mention</span>{summary.categories.map((item) => <div key={item.category}><span><strong>{ROUTE_FEEDBACK_CATEGORY_LABELS[item.category]}</strong><small>{item.count}</small></span><i><b style={{ width: `${Math.max(8, item.share * 100)}%` }} /></i></div>)}</div>}<div className="activity-note-list">{feedbackRows.slice(0, 12).map(({ activityRoute, feedback }) => <button type="button" key={feedback.id} className={selectedActivityRouteId === activityRoute.id ? "selected" : ""} onClick={() => onSelectActivityRoute(activityRoute.id)}><span><strong>{feedback.sentiment === "needs_attention" ? "Needs attention" : feedback.sentiment === "worked_well" ? "Worked well" : "Route note"}{feedback.category ? ` · ${ROUTE_FEEDBACK_CATEGORY_LABELS[feedback.category]}` : ""}</strong><small>{routeActivityTitle(activityRoute)} · {localActivityTime(feedback.createdAt)}</small></span><p>{feedback.body}</p></button>)}</div></> : <div className="planner-empty"><CheckCircleIcon /><div><strong>Notes will appear with their routes</strong><span>Open a mapped route and choose “Add a route note.”</span></div></div>}
      <div className="local-activity-scope"><strong>Context, not a score</strong><span>These notes describe individual routes saved in this browser. They do not measure population need.</span></div>
    </div>}
    {view === "what_if" && <div className="planner-what-if" role="tabpanel">{!scenario ? <ThinkingStatus mode="planner" /> : <>
      <div className="representative-gap"><span className="scenario-dot" /><div><strong>{scenario.selectedGap.label}</strong><small>{Math.round(scenario.selectedGap.totalLengthMeters)} m appears in all {scenario.cohort.journeyCount} equal-weight walks. Every shade edge is modeled; missing coverage is not counted as exposure.</small></div></div>
      <details className="cohort-method"><summary>How these journeys were chosen</summary><p>Six distinct published subway entrances, roughly 350–1,050 m away, route to the same mapped Seward Park public-amenity anchor at 3 PM. Each journey has weight 1.</p><ul>{primary?.journeys.map((journey) => <li key={journey.journeyId}>{journey.label}</li>)}</ul></details>
      {!showIntervention ? <button type="button" className="primary-action planner-test-action" onClick={onShowIntervention}><span>Test 80% modeled shade here</span><ArrowIcon /></button> : primary && <><span className="hypothetical-badge">Impact model · not a design or City proposal</span><div className="scenario-metrics compact"><article><span>Average now</span><strong>{primary.summary.averageBaseline.toFixed(1)} min</strong><small>in direct sun</small></article><ArrowIcon /><article><span>With this idea</span><strong>{primary.summary.averageScenario.toFixed(1)} min</strong><small>{primary.summary.averageAvoided.toFixed(1)} min less</small></article></div><div className="beneficiary-summary"><strong>{primary.summary.improved} improved · {primary.summary.unchanged} unchanged · {primary.summary.worsened} worsened</strong><span>{primary.summary.routesChanged} routes change geometry; {primary.summary.routesUnchanged} stay on the same path. {primary.summary.remaining.toFixed(1)} weighted direct-sun minutes remain.</span></div><div className="representative-journeys">{primary.journeys.map((journey) => <article key={journey.journeyId}><span className={`effect-dot ${journey.effect}`} /><div><strong>{journey.label}</strong><small>{journey.baselineDirectSunMinutes.toFixed(1)} → {journey.scenarioDirectSunMinutes.toFixed(1)} min in direct sun · {journey.routeChanged ? "route changes" : "same route"}</small></div></article>)}</div>{alternative && <div className="lower-impact"><span className="eyebrow">Lower-impact comparison</span><strong>60% modeled shade avoids {alternative.summary.averageAvoided.toFixed(1)} min per walk on average</strong><small>{alternative.summary.remaining.toFixed(1)} weighted direct-sun minutes remain.</small></div>}<div className="verify-next"><CheckCircleIcon /><div><span className="eyebrow">What to verify next</span><strong>Check the corridor in person before discussing a design.</strong><p>Confirm shade conditions, pedestrian movement, site ownership, constructability, maintenance, and who may still not benefit.</p></div></div></>}
      <details className="planner-assumptions"><summary>Sources and limits</summary><InsightSourceLinks sourceIds={scenario.evidence.sourceIds} label="Evidence" />{scenario.evidence.limitations.map((limitation) => <p key={limitation}>{limitation}</p>)}</details>
    </>}</div>}
  </section>;
}

function MapLensControl({ overlays, onToggle, hour, onHourChange, weather, planner, hasRoute, shadeDetailVisible, canEdit, editing, onEditingChange }: {
  overlays: MapOverlays;
  onToggle: (layer: keyof MapOverlays) => void;
  hour: number;
  onHourChange: (hour: number) => void;
  weather: WeatherContext | null;
  planner: boolean;
  hasRoute: boolean;
  shadeDetailVisible: boolean;
  canEdit: boolean;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
}) {
  const layerSummary = overlays.flood
    ? "Model · not live"
    : overlays.greenery
    ? "Tree & park signal"
    : overlays.shade
    ? hasRoute || shadeDetailVisible ? formatClock(hour) : "Zoom in for shade"
    : hasRoute ? "Path stays visible" : "Nearby now";
  return <div className="map-lens-control" aria-label="Map view">
    <div className="map-lens-header"><span><LayersIcon />Map layers</span><output>{weather ? <><strong>{weather.temperatureF}°</strong><small>{weather.feelsLikeF !== weather.temperatureF ? `feels ${weather.feelsLikeF}°` : weather.summary}</small></> : layerSummary}</output></div>
    <div className="map-lens-groups">
      <fieldset><legend>Street conditions</legend><div className="map-lens-options ambient-options">
        <button type="button" aria-pressed={overlays.shade} className={overlays.shade ? "active" : ""} onClick={() => onToggle("shade")}><SunIcon />Shade</button>
        <button type="button" aria-pressed={overlays.greenery} className={overlays.greenery ? "active" : ""} onClick={() => onToggle("greenery")}><LeafIcon />Green</button>
        <button type="button" aria-pressed={overlays.flood} className={overlays.flood ? "active" : ""} onClick={() => onToggle("flood")}><CloudRainIcon />Flood</button>
      </div></fieldset>
      <fieldset><legend>Along the way</legend><div className="map-lens-options context-options">
        <button type="button" aria-pressed={overlays.cover} className={overlays.cover ? "active" : ""} onClick={() => onToggle("cover")}><UmbrellaIcon />Cover</button>
        <button type="button" aria-pressed={overlays.amenities} className={overlays.amenities ? "active" : ""} onClick={() => onToggle("amenities")}><MapIcon />Places</button>
        <button type="button" aria-pressed={overlays.access} className={overlays.access ? "active" : ""} onClick={() => onToggle("access")}><StairsIcon />Access</button>
      </div></fieldset>
    </div>
    <details className="map-lens-more"><summary>More city layers <ChevronIcon /></summary><div className="map-lens-options more-options">
      <button type="button" aria-pressed={overlays.streetWork} className={overlays.streetWork ? "active" : ""} onClick={() => onToggle("streetWork")}><SparkIcon />Street work</button>
      <button type="button" aria-pressed={overlays.cooling} className={overlays.cooling ? "active" : ""} onClick={() => onToggle("cooling")}><DropletIcon />Cool spots</button>
      <button type="button" aria-pressed={overlays.tasks} className={overlays.tasks ? "active" : ""} onClick={() => onToggle("tasks")}><CheckCircleIcon />Checks</button>
    </div>{weather && <p className="map-weather-detail">{weather.summary} · {weather.precipitationChance ?? 0}% rain · NWS representative Manhattan forecast</p>}{overlays.shade && <label className="shade-time-control"><span>7 AM</span><input type="range" min="7" max="19" step="1" value={hour} onChange={(event) => onHourChange(Number(event.target.value))} aria-label="Shade time" /><span>7 PM</span></label>}</details>
    {!planner && hasRoute && canEdit && <button type="button" className={`edit-path-control ${editing ? "active" : ""}`} onClick={() => onEditingChange(!editing)}><RouteIcon />{editing ? "Click the path to place a handle" : "Edit path on map"}</button>}
  </div>;
}

export function App() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const composeOriginMarkerRef = useRef<maplibregl.Marker | null>(null);
  const composeDestinationMarkerRef = useRef<maplibregl.Marker | null>(null);
  const originMarkerRef = useRef<maplibregl.Marker | null>(null);
  const destinationMarkerRef = useRef<maplibregl.Marker | null>(null);
  const waypointMarkerRef = useRef<maplibregl.Marker | null>(null);
  const dragEndpointRef = useRef<(kind: "origin" | "destination", coordinate: Coordinate) => void>(() => undefined);
  const routeSteerRef = useRef<(coordinate: Coordinate) => void>(() => undefined);
  const routeFeatureClickRef = useRef<(edgeId: string | null, coordinate: Coordinate) => void>(() => undefined);
  const endpointMapClickRef = useRef<(coordinate: Coordinate) => void>(() => undefined);
  const mapEndpointSelectionRef = useRef<"origin" | "destination" | null>(null);
  const overlayVisibilityRef = useRef<MapOverlays>(DEFAULT_MAP_OVERLAYS);
  const [preferences, setPreferences] = useState<UserPreferences | null>(() => loadUserPreferences());
  const [brief, setBrief] = useState<UiTripBrief>(() => newTripBriefFromPreferences(preferences));
  const [prompt, setPrompt] = useState("");
  const [originNodeId, setOriginNodeId] = useState(defaultOrigin);
  const [destinationNodeId, setDestinationNodeId] = useState(defaultDestination);
  const [originText, setOriginText] = useState(endpointName(defaultOrigin));
  const [destinationText, setDestinationText] = useState("");
  const [composeEndpointCoordinates, setComposeEndpointCoordinates] = useState<Record<EndpointKind, Coordinate | null>>(() => ({
    origin: graphNodeById(defaultOrigin)?.coordinate ?? null,
    destination: null,
  }));
  const selectedEndpointRef = useRef<Record<EndpointKind, { nodeId: string; text: string } | null>>({ origin: null, destination: null });
  const endpointEditVersionRef = useRef<Record<EndpointKind, number>>({ origin: 0, destination: 0 });
  const [mapEndpointSelection, setMapEndpointSelection] = useState<"origin" | "destination" | null>(null);
  mapEndpointSelectionRef.current = mapEndpointSelection;
  const setupEndpointPresentation = useMemo(() => endpointsGeoJSON(null, {
    origin: composeEndpointCoordinates.origin,
    destination: composeEndpointCoordinates.destination,
    active: mapEndpointSelection,
  }), [composeEndpointCoordinates, mapEndpointSelection]);
  const [result, setResult] = useState<PlannedJourneyResult | null>(null);
  const [route, setRoute] = useState<JourneyRoute | null>(null);
  const [routeActivity, setRouteActivity] = useState<RouteActivityLog[]>(() => loadRouteActivity());
  const routeActivityRef = useRef(routeActivity);
  routeActivityRef.current = routeActivity;
  const lastRecordedRouteRef = useRef<JourneyRoute | null>(null);
  const [activityPersisted, setActivityPersisted] = useState(true);
  const [activeRouteLogId, setActiveRouteLogId] = useState<string | null>(null);
  const [plannerView, setPlannerView] = useState<PlannerView>("routes");
  const [selectedActivityRouteId, setSelectedActivityRouteId] = useState<string | null>(null);
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
  const [activeCover, setActiveCover] = useState<{ label: string; locationLabel: string; detail: string; sourceId: string | null; taskId: string | null } | null>(null);
  const [activeCoverPoint, setActiveCoverPoint] = useState<{ x: number; y: number } | null>(null);
  const [activeFlood, setActiveFlood] = useState<{ label: string; depthBand: string; detail: string } | null>(null);
  const [activeFloodPoint, setActiveFloodPoint] = useState<{ x: number; y: number } | null>(null);
  const [activeHumanContext, setActiveHumanContext] = useState<HumanContextRecord | null>(null);
  const [activeHumanContextPoint, setActiveHumanContextPoint] = useState<{ x: number; y: number } | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [appMode, setAppMode] = useState<AppMode>("walk");
  const [mapLens, setMapLens] = useState<MapLens>("route");
  const [mapOverlays, setMapOverlays] = useState<MapOverlays>(DEFAULT_MAP_OVERLAYS);
  const [coverContextLayer, setCoverContextLayer] = useState(EMPTY_COVER_CONTEXT);
  const [floodContextLayer, setFloodContextLayer] = useState<FloodContextCollection>(EMPTY_FLOOD_CONTEXT);
  const [accessContextLayer, setAccessContextLayer] = useState<AccessContextCollection>(EMPTY_ACCESS_CONTEXT);
  const [coolOptionsLayer, setCoolOptionsLayer] = useState<CoolOptionsCollection>(EMPTY_COOL_OPTIONS);
  const [weather, setWeather] = useState<WeatherContext | null>(null);
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
  const [representativeScenario, setRepresentativeScenario] = useState<RepresentativeShadeScenarioResult | null>(null);
  const [showRepresentativeIntervention, setShowRepresentativeIntervention] = useState(false);
  const activeAssets = useMemo(() => route ? relevantAssets(route, brief) : [], [route, brief]);
  const routeTasks = useMemo(() => route ? relevantCivicTasks(route, brief) : [], [route, brief]);
  const activeRouteActivity = useMemo(() => routeActivity.find((item) => item.id === activeRouteLogId)
    ?? routeActivity.find((item) => item.candidateId === route?.candidateId)
    ?? null, [activeRouteLogId, route, routeActivity]);
  useEffect(() => {
    let cancelled = false;
    void loadWeatherContext().then((context) => { if (!cancelled) setWeather(context); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!route || lastRecordedRouteRef.current === route) return;
    lastRecordedRouteRef.current = route;
    const next = recordMappedRoute(routeActivityRef.current, route, brief, {
      origin: endpointName(originNodeId),
      destination: brief.shape === "loop" ? `Back to ${endpointName(originNodeId)}` : endpointName(route.endpointNodeId),
    });
    routeActivityRef.current = next;
    setRouteActivity(next);
    setActiveRouteLogId(next[0].id);
    setSelectedActivityRouteId(next[0].id);
    setActivityPersisted(saveRouteActivity(next));
    // Recording is tied to a newly mapped route; editing labels alone should not create another event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);
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
  const ambientCoverLayer = useMemo(() => mappedCoverGeoJSON(pilotGraph), [route, mapViewport.zoom]);
  const coverRouteSegments = useMemo(() => routeCoverSegmentsGeoJSON(route, pilotGraph), [route]);
  const ambientGreeneryLayer = useMemo(() => ambientGreeneryGeoJSON(pilotGraph), [route, mapViewport.zoom]);
  const greeneryRouteSegments = useMemo(() => routeGreeneryGeoJSON(route, pilotGraph), [route]);
  const comparisonDelta = useMemo(() => route && result?.baseline && result.routeValueFrontier?.status === "meaningful_alternative"
    ? routeComparisonDeltaGeoJSON(route, result.baseline, pilotGraph)
    : { type: "FeatureCollection" as const, features: [] }, [result, route]);
  const representativeRoutes = useMemo(() => representativeScenarioGeoJSON(representativeScenario, showRepresentativeIntervention, "routes"), [representativeScenario, showRepresentativeIntervention]);
  const representativeGap = useMemo(() => representativeScenarioGeoJSON(representativeScenario, showRepresentativeIntervention, "gap"), [representativeScenario, showRepresentativeIntervention]);
  const floodOverlap = useMemo(() => floodContextLayer.features.length > 0
    ? floodOverlapForRoute(route, floodContextLayer)
    : null, [floodContextLayer, route]);
  const viewportAssets = useMemo(() => amenitiesForViewport(allMapAssets, mapViewport, {
    selectedAssetId: activeAsset?.id,
    prominentAssetIds: activeAssets.map((asset) => asset.id),
    maximumAssets: amenityViewportSampleLimit(mapViewport.zoom, appMode === "planner" ? "planner" : route ? "route" : "nearby"),
  }), [activeAsset?.id, activeAssets, appMode, mapViewport, route]);
  const overviewViewportAssets = useMemo(() => amenitiesWithinViewport(allMapAssets, mapViewport, {
    selectedAssetId: activeAsset?.id,
    prominentAssetIds: activeAssets.map((asset) => asset.id),
  }), [activeAsset?.id, activeAssets, mapViewport]);
  const overviewAssets = useMemo(() => amenityOverviewGeoJSON(overviewViewportAssets, {
    selectedAssetId: activeAsset?.id,
    prominentAssetIds: activeAssets.map((asset) => asset.id),
    clusterCellMeters: amenityClusterCellMeters(mapViewport.zoom),
    clusterAcrossCategories: mapViewport.zoom < 13.5,
    minimumClusterSize: mapViewport.zoom >= 16.25 ? Number.MAX_SAFE_INTEGER : 2,
  }), [activeAsset?.id, activeAssets, mapViewport.zoom, overviewViewportAssets]);
  const coverContextVicinities = useMemo(() => coverContextVicinityGeoJSON(coverContextLayer), [coverContextLayer]);
  const taskFeatures = useMemo(() => civicTasksGeoJSON(visibleTasks, {
    selectedTaskId: activeTask?.id,
    completedTaskIds: Object.keys(taskObservations),
  }), [activeTask?.id, taskObservations, visibleTasks]);
  const plannerInsightRequest = useMemo(() => route ? buildRouteCityInsightRequest({
    brief,
    route,
    scenario: plannerScenario,
    nearbyAssets: plannerNearbyAssets,
    mappedCoverMeters: routeMappedCoverMeters(route, pilotGraph),
  }) : null, [brief, route, plannerScenario, plannerNearbyAssets]);
  const activityMapData = useMemo(() => routeActivityGeoJSON(routeActivity, selectedActivityRouteId), [routeActivity, selectedActivityRouteId]);

  useEffect(() => {
    if (!route) return;
    setMapOverlays((current) => showRelevantRouteMapOverlays(current, {
      shade: brief.priorities.includes("shade"),
      greenery: brief.priorities.includes("greenery"),
      cover: rainContext,
      amenities: activeAssets.length > 0,
      tasks: routeTasks.length > 0,
    }));
  }, [route, brief.priorities, rainContext, activeAssets.length, routeTasks.length]);

  useEffect(() => {
    resetVisibleSheetScroll();
  }, [appMode, mapLens, route?.candidateId]);

  useEffect(() => {
    if ((!mapOverlays.cover && !mapOverlays.streetWork) || coverContextLayer.features.length > 0) return;
    let cancelled = false;
    void loadCoverContextGeoJSON().then((context) => {
      if (!cancelled) setCoverContextLayer(context);
    });
    return () => { cancelled = true; };
  }, [coverContextLayer.features.length, mapOverlays.cover, mapOverlays.streetWork]);

  useEffect(() => {
    if (!mapOverlays.access || accessContextLayer.features.length > 0) return;
    let cancelled = false;
    void loadAccessContext().then((context) => { if (!cancelled) setAccessContextLayer(context); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [accessContextLayer.features.length, mapOverlays.access]);

  useEffect(() => {
    if (!mapOverlays.cooling || coolOptionsLayer.features.length > 0) return;
    let cancelled = false;
    void loadCoolOptions().then((context) => { if (!cancelled) setCoolOptionsLayer(context); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [coolOptionsLayer.features.length, mapOverlays.cooling]);

  useEffect(() => {
    if (!mapOverlays.flood || floodContextLayer.features.length > 0) return;
    let cancelled = false;
    void loadFloodContextGeoJSON().then((context) => {
      if (!cancelled) setFloodContextLayer(context);
    });
    return () => { cancelled = true; };
  }, [floodContextLayer.features.length, mapOverlays.flood]);

  useEffect(() => {
    if (appMode !== "planner" || representativeScenario) return;
    let cancelled = false;
    void import("./detour/frozenRepresentativeShadeScenario").then(({ frozenRepresentativeShadeScenario }) => {
      if (!cancelled) setRepresentativeScenario(frozenRepresentativeShadeScenario);
    });
    return () => { cancelled = true; };
  }, [appMode, representativeScenario]);

  function changeEndpointText(kind: EndpointKind, value: string) {
    endpointEditVersionRef.current[kind] += 1;
    selectedEndpointRef.current[kind] = null;
    setComposeEndpointCoordinates((current) => ({ ...current, [kind]: null }));
    if (kind === "origin") setOriginText(value);
    else setDestinationText(value);
  }

  async function selectLocationSuggestion(kind: EndpointKind, suggestion: LocationSuggestion) {
    const editVersion = endpointEditVersionRef.current[kind] + 1;
    endpointEditVersionRef.current[kind] = editVersion;
    selectedEndpointRef.current[kind] = null;
    setMapEndpointSelection(null);
    setError("");
    if (kind === "origin") setOriginText(suggestion.label);
    else setDestinationText(suggestion.label);
    try {
      if (!isInsidePilot(suggestion.coordinate)) throw new Error(`Footnote is exploring ${supportedArea.label} for now.`);
      await ensureGraphCoverage([suggestion.coordinate]);
      if (endpointEditVersionRef.current[kind] !== editVersion) return;
      const node = nearestGraphNodeWithin(suggestion.coordinate);
      if (!node) throw new Error("That location is inside the preview area, but it is not close enough to the checked walking network yet.");
      selectedEndpointRef.current[kind] = { nodeId: node.id, text: suggestion.label.trim() };
      setComposeEndpointCoordinates((current) => ({ ...current, [kind]: node.coordinate }));
      if (kind === "origin") setOriginNodeId(node.id);
      else {
        setDestinationNodeId(node.id);
        setBrief((current) => withDestinationOverride(current, suggestion.label));
      }
    } catch (caught) {
      if (endpointEditVersionRef.current[kind] === editVersion) setError(planningErrorMessage(caught));
    }
  }

  async function resolveEndpoint(query: string, currentNodeId: string, kind: EndpointKind) {
    const selected = selectedEndpointRef.current[kind];
    if (selected && selected.nodeId === currentNodeId && selected.text === query.trim()) return selected.nodeId;
    const current = graphNodeById(currentNodeId);
    if (!query.trim() || query.trim() === current?.name || query.trim() === endpointName(currentNodeId)) return currentNodeId;
    const found = await searchNycAddress(query);
    if (!found) throw new Error(`We couldn’t find “${query}”. Try a nearby street or landmark.`);
    if (!isInsidePilot(found.coordinate)) throw new Error(`Footnote is exploring ${supportedArea.label} for now.`);
    await ensureGraphCoverage([found.coordinate]);
    const node = nearestGraphNodeWithin(found.coordinate);
    if (!node) throw new Error("That location is inside the preview area, but it is not close enough to the checked walking network yet.");
    return node.id;
  }

  async function selectEndpointFromMap(kind: "origin" | "destination", coordinate: Coordinate) {
    endpointEditVersionRef.current[kind] += 1;
    selectedEndpointRef.current[kind] = null;
    setComposeEndpointCoordinates((current) => ({ ...current, [kind]: null }));
    setMapEndpointSelection(null);
    setError("");
    setDetail(null);
    setActiveAsset(null);
    setActiveAssetPoint(null);
    setActiveTask(null);
    setActiveTaskPoint(null);
    setActiveCover(null);
    setActiveCoverPoint(null);
    setActiveFlood(null);
    setActiveFloodPoint(null);
    try {
      if (!isInsidePilot(coordinate)) throw new Error(`Footnote is exploring ${supportedArea.label} for now.`);
      await ensureGraphCoverage([coordinate]);
      const node = nearestGraphNodeWithin(coordinate);
      if (!node) throw new Error("Choose a place a little closer to a mapped walking street.");
      const label = endpointName(node.id);
      selectedEndpointRef.current[kind] = { nodeId: node.id, text: label };
      setComposeEndpointCoordinates((current) => ({ ...current, [kind]: node.coordinate }));
      if (kind === "origin") {
        setOriginNodeId(node.id);
        setOriginText(label);
        return;
      }
      setDestinationNodeId(node.id);
      setDestinationText(label);
      setBrief((current) => withDestinationOverride(current, label));
    } catch (caught) {
      setError(planningErrorMessage(caught));
    }
  }

  async function compute(nextBrief: UiTripBrief, isRefinement = false, options: { rainFriendly?: boolean; originId?: string; destinationId?: string; originQuery?: string; destinationQuery?: string; wanderEndpointId?: string | null; preserveWaypoint?: boolean } = {}) {
    const oldRoute = route;
    const plannedBrief = nextBrief.priorities.includes("construction")
      ? mergeTripBrief(nextBrief, {
        priorities: nextBrief.priorities.filter((priority) => priority !== "construction"),
        unsupported: [...nextBrief.unsupported, "Current construction evidence is unavailable in this preview"],
      }, nextBrief.interpretedBy)
      : nextBrief;
    const resolvedOrigin = options.originId ?? await resolveEndpoint(options.originQuery ?? originText, originNodeId, "origin");
    let resolvedDestination = options.destinationId ?? destinationNodeId;
    if (plannedBrief.shape === "destination") {
      const query = plannedBrief.destinationQuery ?? options.destinationQuery ?? destinationText;
      if (!options.destinationId && !query.trim()) throw new Error("Add a destination so Footnote knows where you’re headed.");
      if (!options.destinationId) resolvedDestination = await resolveEndpoint(query, destinationNodeId, "destination");
      if (query.trim()) setDestinationText(query);
    }
    const coverageCoordinates = [resolvedOrigin, resolvedDestination]
      .map((nodeId) => graphNodeById(nodeId)?.coordinate)
      .filter((coordinate): coordinate is Coordinate => Boolean(coordinate));
    await ensureGraphCoverage(coverageCoordinates);
    let routingBrief = buildRoutingTripBrief(plannedBrief, resolvedOrigin, resolvedDestination);
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
    setComposeEndpointCoordinates({
      origin: graphNodeById(resolvedOrigin)?.coordinate ?? null,
      destination: plannedBrief.shape === "destination" ? graphNodeById(resolvedDestination)?.coordinate ?? null : null,
    });
    setBrief(plannedBrief);
    const selectedResult = resultWithSelectedRoute(nextResult, nextRoute);
    setResult(selectedResult);
    setRoute(nextRoute);
    setShadeHour(Math.max(7, Math.min(19, Math.round(plannedBrief.departureHour))));
    setShowBaseline(selectedResult.routeValueFrontier?.status === "meaningful_alternative");
    setActiveAsset(null);
    setActiveAssetPoint(null);
    setActiveTask(null);
    setActiveTaskPoint(null);
    setDetail(null);
    setActiveCover(null);
    setActiveCoverPoint(null);
    setActiveFlood(null);
    setActiveFloodPoint(null);
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
    setMapEndpointSelection(null);
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
      else if (interpreted.priorities.includes("greenery")) { setMapLens("greenery"); setMapOverlays((current) => ({ ...current, greenery: true })); }
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

  async function selectExample(example: ExampleJourney) {
    setMapEndpointSelection(null);
    try {
      const preserveOrigin = Boolean(originText.trim());
      const preserveDestination = Boolean(destinationText.trim());
      const coverageCoordinates = [
        ...(!preserveOrigin ? [example.originCoordinate] : []),
        ...(!preserveDestination && example.destinationCoordinate ? [example.destinationCoordinate] : []),
      ];
      if (coverageCoordinates.length) await ensureGraphCoverage(coverageCoordinates);
      const origin = preserveOrigin ? null : graphNodeById(example.originNodeId);
      const destination = preserveDestination || !example.destinationNodeId ? null : graphNodeById(example.destinationNodeId);
      if ((!preserveOrigin && !origin) || (!preserveDestination && example.destinationNodeId && !destination)) throw new Error("missing sample endpoint");
      if (origin) {
        endpointEditVersionRef.current.origin += 1;
        selectedEndpointRef.current.origin = null;
        setOriginNodeId(origin.id);
        setOriginText(endpointName(origin.id));
        setComposeEndpointCoordinates((current) => ({ ...current, origin: origin.coordinate }));
      }
      if (!preserveDestination) {
        endpointEditVersionRef.current.destination += 1;
        selectedEndpointRef.current.destination = null;
        setDestinationNodeId(destination?.id ?? defaultDestination);
        setDestinationText(destination ? endpointName(destination.id) : "");
        setComposeEndpointCoordinates((current) => ({ ...current, destination: destination?.coordinate ?? null }));
      }
      setPrompt(examplePromptForSelectedDestination(example, preserveDestination ? destinationText : ""));
      setBrief({ ...DEFAULT_BRIEF, priorities: [], departureHour: brief.departureHour });
      setError("");
      setModelFallback(false);
      setRainContext(false);
    } catch {
      setError("That sample walk is outside the current map. Try another example.");
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
    setBrief(newTripBriefFromPreferences(preferences));
    setDestinationNodeId(defaultDestination);
    endpointEditVersionRef.current.destination += 1;
    selectedEndpointRef.current.destination = null;
    setDestinationText("");
    setComposeEndpointCoordinates((current) => ({ ...current, destination: null }));
    setMapEndpointSelection(null);
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
    setActiveFlood(null);
    setActiveFloodPoint(null);
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
    else if (/flood|stormwater|ponding|standing water/i.test(value)) { setMapLens("flood"); setMapOverlays((current) => toggledMapOverlay({ ...current, flood: false }, "flood")); }
    else if (/green|tree|park|canopy/i.test(value)) { setMapLens("greenery"); setMapOverlays((current) => toggledMapOverlay({ ...current, greenery: false }, "greenery")); }
    else if (/cover|rain|awning|shed/i.test(value)) { setMapLens("cover"); setMapOverlays((current) => ({ ...current, cover: true })); }
    else if (/seat|restroom|bathroom|water|amenit/i.test(value)) { setMapLens("amenities"); setMapOverlays((current) => ({ ...current, amenities: true })); }
    else { setMapLens("shade"); setMapOverlays((current) => toggledMapOverlay({ ...current, shade: false }, "shade")); }
  }

  async function steerRoute(coordinate: Coordinate) {
    if (!route || !result) return;
    const waypoint = nearestGraphNode(coordinate);
    try {
      const steeringBrief = brief.civicTaskIntent
        ? mergeTripBrief(brief, { civicTaskIntent: null }, "controls")
        : brief;
      const routingBrief = buildRoutingTripBrief(steeringBrief, originNodeId, destinationNodeId);
      const steered = rerouteJourneyThroughWaypoint(pilotGraph, routingBrief, route, waypoint.id, routingOptions(brief, rainContext));
      if (brief.civicTaskIntent) setBrief(steeringBrief);
      setWaypointNodeId(waypoint.id);
      setRoute(steered);
      setResult((current) => current ? resultWithSelectedRoute(current, steered) : current);
      setDelta(`path steered near ${endpointName(waypoint.id).replace(/^Near /, "")}${brief.civicTaskIntent ? " · optional data check unpinned" : ""}`);
      setError("");
    } catch (caught) {
      setError(planningErrorMessage(caught));
    }
  }

  dragEndpointRef.current = (kind, coordinate) => {
    const node = nearestGraphNode(coordinate);
    endpointEditVersionRef.current[kind] += 1;
    const endpointLabel = endpointName(node.id);
    selectedEndpointRef.current[kind] = { nodeId: node.id, text: endpointLabel };
    setComposeEndpointCoordinates((current) => ({ ...current, [kind]: node.coordinate }));
    if (kind === "origin") {
      setOriginNodeId(node.id);
      setOriginText(endpointLabel);
      void compute(brief, true, { rainFriendly: rainContext, originId: node.id });
      return;
    }
    if (route?.journeyShape === "wander") {
      const nextBrief = mergeTripBrief(brief, { direction: null, endCondition: null }, "controls");
      setDestinationNodeId(node.id);
      setDestinationText(endpointLabel);
      void compute(nextBrief, true, { rainFriendly: rainContext, destinationId: node.id, wanderEndpointId: node.id });
      return;
    }
    setDestinationNodeId(node.id);
    const destinationName = endpointLabel;
    setDestinationText(destinationName);
    void compute({ ...brief, destinationQuery: destinationName, interpretedBy: "controls" }, true, { rainFriendly: rainContext, destinationId: node.id });
  };
  routeSteerRef.current = (coordinate) => { void steerRoute(coordinate); };
  endpointMapClickRef.current = (coordinate) => {
    if (!mapEndpointSelection || route || appMode !== "walk" || busy) return;
    void selectEndpointFromMap(mapEndpointSelection, coordinate);
  };
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
      map = new maplibregl.Map({ container: mapContainer.current, style: MAP_STYLE, center: supportedArea.defaultView.center, zoom: supportedArea.defaultView.zoom, attributionControl: false });
    } catch {
      setMapError(true);
      return;
    }
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    const captureViewport = () => {
      const bounds = map.getBounds();
      setMapViewport({ west: bounds.getWest(), south: bounds.getSouth(), east: bounds.getEast(), north: bounds.getNorth(), zoom: map.getZoom() });
    };
    map.on("moveend", captureViewport);
    map.on("click", (event) => endpointMapClickRef.current([event.lngLat.lng, event.lngLat.lat]));
    map.on("load", () => {
      setMapReady(true);
      setMapError(false);
      captureViewport();
      map.addSource("building-shadows", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer(BUILDING_SHADOW_LAYER);
      map.addSource("ambient-greenery", { type: "geojson", data: ambientGreeneryLayer });
      map.addLayer({ id: "ambient-greenery", type: "line", source: "ambient-greenery", minzoom: 13.2, paint: {
        "line-color": ["match", ["get", "greeneryBand"], "park_edge", "#3F7650", "#6FA07C"],
        "line-width": ["interpolate", ["linear"], ["zoom"], 13.2, 2.5, 16, 7],
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 13.2, 0.12, 15, 0.32],
      }, layout: { visibility: "none", "line-cap": "round", "line-join": "round" } });
      map.addSource("mapped-cover", { type: "geojson", data: ambientCoverLayer });
      map.addLayer({ id: "mapped-cover-casing", type: "line", source: "mapped-cover", minzoom: 13.2, paint: {
        "line-color": "#7284A2",
        "line-width": ["interpolate", ["linear"], ["zoom"], 13, 8, 17, 18],
        "line-opacity": 0.24,
      }, layout: { visibility: "none", "line-cap": "round", "line-join": "round" } });
      map.addLayer({ id: "mapped-cover", type: "line", source: "mapped-cover", minzoom: 13.2, paint: {
        "line-color": "#536A91",
        "line-width": ["interpolate", ["linear"], ["zoom"], 13, 2.5, 17, 5],
        "line-opacity": ["interpolate", ["linear"], ["get", "coverShare"], 0.5, 0.7, 1, 0.96],
      }, layout: { visibility: "none", "line-cap": "round", "line-join": "round" } });
      map.addSource("cover-context", { type: "geojson", data: EMPTY_COVER_CONTEXT });
      map.addSource("cover-context-vicinities", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "cover-context-vicinities", type: "fill", source: "cover-context-vicinities", minzoom: 14, filter: ["==", ["get", "kind"], "pops_arcade"], paint: {
        "fill-color": ["match", ["get", "kind"], "pops_arcade", "#536A91", "#9B8051"],
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0.14, 17, 0.28],
      }, layout: { visibility: "none" } });
      map.addLayer({ id: "street-work-vicinities", type: "fill", source: "cover-context-vicinities", minzoom: 14, filter: ["==", ["get", "kind"], "sidewalk_shed_permit"], paint: {
        "fill-color": "#9B8051",
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0.11, 17, 0.24],
      }, layout: { visibility: "none" } });
      map.addLayer({ id: "cover-construction", type: "line", source: "cover-context", filter: ["==", ["get", "kind"], "construction_closure"], paint: { "line-color": "#C66A4B", "line-width": 3, "line-dasharray": [1, 1.5], "line-opacity": 0.72 }, layout: { visibility: "none" } });
      registerFloodPatternImages(map);
      map.addSource("flood-context", { type: "geojson", data: EMPTY_FLOOD_CONTEXT });
      map.addLayer({ id: "flood-nuisance", type: "fill", source: "flood-context", filter: ["==", ["get", "categoryCode"], 1], paint: {
        "fill-pattern": "flood-nuisance-pattern",
        "fill-opacity": 0.82,
      }, layout: { visibility: "none" } });
      map.addLayer({ id: "flood-deep", type: "fill", source: "flood-context", filter: ["==", ["get", "categoryCode"], 2], paint: {
        "fill-pattern": "flood-deep-pattern",
        "fill-opacity": 0.9,
      }, layout: { visibility: "none" } });
      map.addLayer({ id: "flood-nuisance-outline", type: "line", source: "flood-context", filter: ["==", ["get", "categoryCode"], 1], paint: {
        "line-color": "#426A7C",
        "line-width": 1,
        "line-opacity": 0.65,
      }, layout: { visibility: "none" } });
      map.addLayer({ id: "flood-deep-outline", type: "line", source: "flood-context", filter: ["==", ["get", "categoryCode"], 2], paint: {
        "line-color": "#304860",
        "line-width": 1.5,
        "line-opacity": 0.78,
      }, layout: { visibility: "none" } });
      map.addSource("access-context", { type: "geojson", data: EMPTY_ACCESS_CONTEXT, cluster: true, clusterRadius: 38, clusterMaxZoom: 16 });
      map.addLayer({ id: "access-clusters", type: "circle", source: "access-context", minzoom: 12.5, filter: ["has", "point_count"], paint: {
        "circle-radius": ["step", ["get", "point_count"], 11, 30, 14, 150, 18],
        "circle-color": ["step", ["get", "point_count"], "#F0EBF7", 30, "#D8CFEA", 150, "#B7A7D1"],
        "circle-stroke-color": "#6D5F91",
        "circle-stroke-width": 1.5,
        "circle-opacity": 0.92,
      }, layout: { visibility: "none" } });
      map.addLayer({ id: "access-cluster-count", type: "symbol", source: "access-context", minzoom: 12.5, filter: ["has", "point_count"], layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-size": 10,
        "text-font": ["Open Sans Bold"],
        visibility: "none",
      }, paint: { "text-color": "#493F64" } });
      map.addLayer({ id: "access-records", type: "circle", source: "access-context", minzoom: 14.2, filter: ["all", ["!", ["has", "point_count"]], ["!=", ["get", "kind"], "ramp_survey"]], paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 14.2, 4.5, 17, 7],
        "circle-color": ["match", ["get", "kind"], "accessible_signal", "#6D5F91", "exclusive_signal", "#C17A55", "transit_elevator", "#4D7593", "#6D5F91"],
        "circle-stroke-color": "#FFFDF8",
        "circle-stroke-width": 2,
        "circle-opacity": 0.94,
      }, layout: { visibility: "none" } });
      map.addLayer({ id: "access-ramps", type: "circle", source: "access-context", minzoom: 16.7, filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "kind"], "ramp_survey"]], paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 16.7, 3, 19, 6],
        "circle-color": "#7D6D9D",
        "circle-stroke-color": "#FFFDF8",
        "circle-stroke-width": 1.5,
        "circle-opacity": 0.86,
      }, layout: { visibility: "none" } });
      map.addSource("cool-options", { type: "geojson", data: EMPTY_COOL_OPTIONS, cluster: true, clusterRadius: 45, clusterMaxZoom: 14 });
      map.addLayer({ id: "cool-clusters", type: "circle", source: "cool-options", filter: ["has", "point_count"], paint: {
        "circle-radius": ["step", ["get", "point_count"], 12, 8, 16, 30, 20],
        "circle-color": "#D8EFF1",
        "circle-stroke-color": "#2E7182",
        "circle-stroke-width": 1.5,
      }, layout: { visibility: "none" } });
      map.addLayer({ id: "cool-cluster-count", type: "symbol", source: "cool-options", filter: ["has", "point_count"], layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-size": 10,
        "text-font": ["Open Sans Bold"],
        visibility: "none",
      }, paint: { "text-color": "#245B68" } });
      map.addLayer({ id: "cool-options", type: "circle", source: "cool-options", minzoom: 13.5, filter: ["!", ["has", "point_count"]], paint: {
        "circle-radius": ["match", ["get", "kind"], "spray_shower", 5, "pool", 6, "cooling_center", 7, 5],
        "circle-color": ["match", ["get", "kind"], "spray_shower", "#4BA9B3", "pool", "#337E9B", "cooling_center", "#2E7182", "#6BA7A0"],
        "circle-stroke-color": "#FFFDF8",
        "circle-stroke-width": 2,
        "circle-opacity": 0.94,
      }, layout: { visibility: "none" } });
      map.addSource("baseline", { type: "geojson", data: routeGeoJSON() });
      map.addLayer({ id: "baseline", type: "line", source: "baseline", paint: { "line-color": "#6D716C", "line-width": 3, "line-dasharray": [2, 2], "line-opacity": 0.68 }, layout: { visibility: "none" } });
      map.addSource("route-comparison-delta", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "baseline-delta", type: "line", source: "route-comparison-delta", filter: ["==", ["get", "routeRole"], "baseline_only"], paint: { "line-color": "#8B8074", "line-width": 7, "line-dasharray": [1, 1.5], "line-opacity": 0.38 }, layout: { visibility: "none", "line-cap": "round" } });
      map.addLayer({ id: "recommended-delta", type: "line", source: "route-comparison-delta", filter: ["==", ["get", "routeRole"], "recommended_only"], paint: { "line-color": "#6478B8", "line-width": 10, "line-opacity": 0.34 }, layout: { visibility: "none", "line-cap": "round" } });
      map.addSource("happy", { type: "geojson", data: routeGeoJSON() });
      map.addLayer({ id: "happy-casing", type: "line", source: "happy", paint: { "line-color": "#FFFFFF", "line-width": 11, "line-opacity": 0.95 } });
      map.addLayer({ id: "happy", type: "line", source: "happy", paint: { "line-color": "#F05A47", "line-width": 6 } });
      map.addSource("route-shade", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "route-shade", type: "line", source: "route-shade", paint: {
        "line-color": ["match", ["get", "shadeBand"], "mostly_shaded", "#294E43", "mixed", "#8A7C4A", "#E86248"],
        "line-width": 3.5,
        "line-offset": -5,
        "line-opacity": 0.9,
      }, layout: { visibility: "none", "line-cap": "round", "line-join": "round" } });
      map.addSource("route-greenery", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "route-greenery", type: "line", source: "route-greenery", paint: {
        "line-color": ["match", ["get", "greeneryBand"], "park_edge", "#3F7650", "#6FA07C"],
        "line-width": 3.5,
        "line-offset": -5,
        "line-opacity": 0.9,
      }, layout: { visibility: "none", "line-cap": "round", "line-join": "round" } });
      map.addSource("route-cover", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "route-cover", type: "line", source: "route-cover", paint: {
        "line-color": ["match", ["get", "coverBand"], "mapped", "#3D587F", "#7284A2"],
        "line-width": 5,
        "line-offset": 4,
        "line-dasharray": [1.2, 1],
        "line-opacity": 0.9,
      }, layout: { visibility: "none", "line-cap": "round", "line-join": "round" } });
      map.addSource("planner-selection", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "planner-selection-casing", type: "line", source: "planner-selection", paint: { "line-color": "#FFFFFF", "line-width": 15, "line-opacity": 0.95 }, layout: { visibility: "none" } });
      map.addLayer({ id: "planner-selection", type: "line", source: "planner-selection", paint: { "line-color": "#6478B8", "line-width": 9, "line-opacity": 0.95 }, layout: { visibility: "none" } });
      map.addSource("representative-routes", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "representative-baseline", type: "line", source: "representative-routes", filter: ["==", ["get", "role"], "baseline"], paint: { "line-color": "#6D716C", "line-width": 3, "line-opacity": 0.26 }, layout: { visibility: "none", "line-cap": "round" } });
      map.addLayer({ id: "representative-scenario", type: "line", source: "representative-routes", filter: ["==", ["get", "role"], "scenario"], paint: { "line-color": ["case", ["get", "routeChanged"], "#F05A47", "#6478B8"], "line-width": 4, "line-opacity": 0.56 }, layout: { visibility: "none", "line-cap": "round" } });
      map.addSource("route-activity", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "route-activity-casing", type: "line", source: "route-activity", filter: ["==", ["get", "kind"], "route"], paint: { "line-color": "#FFFFFF", "line-width": ["case", ["get", "selected"], 10, 7], "line-opacity": 0.84 }, layout: { visibility: "none", "line-cap": "round", "line-join": "round" } });
      map.addLayer({ id: "route-activity-lines", type: "line", source: "route-activity", filter: ["==", ["get", "kind"], "route"], paint: {
        "line-color": ["case", ["get", "selected"], "#F05A47", ["get", "needsAttention"], "#B86149", [">", ["get", "feedbackCount"], 0], "#6478B8", "#567563"],
        "line-width": ["case", ["get", "selected"], 6, ["interpolate", ["linear"], ["get", "timesMapped"], 1, 2.5, 5, 5]],
        "line-opacity": ["case", ["get", "selected"], 0.96, 0.54],
      }, layout: { visibility: "none", "line-cap": "round", "line-join": "round" } });
      map.addLayer({ id: "route-activity-notes", type: "circle", source: "route-activity", filter: ["==", ["get", "kind"], "feedback"], paint: {
        "circle-radius": ["interpolate", ["linear"], ["get", "feedbackCount"], 1, 6, 5, 10],
        "circle-color": ["case", ["get", "needsAttention"], "#B86149", "#344A3E"],
        "circle-stroke-color": "#FFFFFF",
        "circle-stroke-width": 2,
        "circle-opacity": 0.94,
      }, layout: { visibility: "none" } });
      ["route-activity-lines", "route-activity-notes"].forEach((layerId) => {
        map.on("mouseenter", layerId, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", layerId, () => { map.getCanvas().style.cursor = ""; });
        map.on("click", layerId, (event) => {
          if (mapEndpointSelectionRef.current) return;
          const routeId = event.features?.[0]?.properties?.routeId;
          if (routeId) setSelectedActivityRouteId(String(routeId));
        });
      });
      const showAssetPopover = (event: MapLayerMouseEvent) => {
        if (mapEndpointSelectionRef.current) return;
        const id = event.features?.[0]?.properties?.id;
        setDetail(null);
        setActiveFlood(null);
        setActiveFloodPoint(null);
        setActiveAsset(allMapAssets.find((asset) => asset.id === id) ?? null);
        setActiveAssetPoint({ x: event.point.x, y: event.point.y });
      };
      const showTaskPopover = (event: MapLayerMouseEvent) => {
        if (mapEndpointSelectionRef.current) return;
        const id = event.features?.[0]?.properties?.id;
        setDetail(null);
        setActiveAsset(null);
        setActiveAssetPoint(null);
        setActiveFlood(null);
        setActiveFloodPoint(null);
        setActiveTask(allCivicTasks.find((task) => task.id === id) ?? null);
        setActiveTaskPoint({ x: event.point.x, y: event.point.y });
      };
      const showCoverPopover = (event: MapLayerMouseEvent) => {
        if (mapEndpointSelectionRef.current) return;
        const feature = event.features?.[0];
        const properties = feature?.properties;
        const targetKind = properties?.evidenceKind === "mapped_geometry" ? "mapped_cover_way" : "cover_feature";
        const targetId = targetKind === "mapped_cover_way"
          ? String(properties?.wayId ?? "")
          : String(feature?.id ?? "");
        const task = allCivicTasks.find((candidate) => candidate.target.kind === targetKind && candidate.target.id === targetId);
        setActiveAsset(null);
        setActiveAssetPoint(null);
        setActiveTask(null);
        setActiveTaskPoint(null);
        setActiveFlood(null);
        setActiveFloodPoint(null);
        setDetail(null);
        setActiveCover(properties ? {
          label: String(properties.label ?? "Cover evidence"),
          locationLabel: String(properties.locationLabel ?? properties.street ?? "Mapped location"),
          detail: String(properties.detail ?? properties.proofLabel ?? "Conditions may have changed."),
          sourceId: properties.sourceId ? String(properties.sourceId) : null,
          taskId: task?.id ?? null,
        } : null);
        setActiveCoverPoint({ x: event.point.x, y: event.point.y });
      };
      const showFloodPopover = (event: MapLayerMouseEvent) => {
        if (mapEndpointSelectionRef.current) return;
        const properties = event.features?.[0]?.properties;
        setActiveAsset(null);
        setActiveAssetPoint(null);
        setActiveTask(null);
        setActiveTaskPoint(null);
        setActiveCover(null);
        setActiveCoverPoint(null);
        setDetail(null);
        setActiveFlood(properties ? {
          label: String(properties.label ?? "Modeled flood potential"),
          depthBand: String(properties.depthBand ?? "Modeled depth category"),
          detail: String(properties.detail ?? "This is a planning model, not a live street condition."),
        } : null);
        setActiveFloodPoint({ x: event.point.x, y: event.point.y });
      };
      const showHumanContextPopover = (event: MapLayerMouseEvent) => {
        if (mapEndpointSelectionRef.current) return;
        const properties = event.features?.[0]?.properties;
        if (!properties) return;
        setActiveAsset(null);
        setActiveAssetPoint(null);
        setActiveTask(null);
        setActiveTaskPoint(null);
        setActiveCover(null);
        setActiveCoverPoint(null);
        setActiveFlood(null);
        setActiveFloodPoint(null);
        setDetail(null);
        setActiveHumanContext(properties.sourceId === "nyc-cool-options"
          ? coolOptionRecord(properties)
          : accessContextRecord(properties));
        setActiveHumanContextPoint({ x: event.point.x, y: event.point.y });
      };
      void registerCoverContextMarkerImages(map).then(() => {
        const symbolLayers = [
          { id: "cover-arcade-icons", kind: "pops_arcade", image: "cover-context-pops_arcade", minzoom: 15.6 },
          { id: "cover-shed-icons", kind: "sidewalk_shed_permit", image: "cover-context-sidewalk_shed_permit", minzoom: 16.2 },
        ] as const;
        for (const layer of symbolLayers) {
          if (map.getLayer(layer.id)) continue;
          map.addLayer({ id: layer.id, type: "symbol", source: "cover-context", minzoom: layer.minzoom, filter: ["==", ["get", "kind"], layer.kind], layout: {
            "icon-image": layer.image,
            "icon-size": ["interpolate", ["linear"], ["zoom"], layer.minzoom, 0.62, 17, 0.9],
            "icon-allow-overlap": false,
            "icon-padding": 7,
            visibility: (layer.kind === "sidewalk_shed_permit" ? overlayVisibilityRef.current.streetWork : overlayVisibilityRef.current.cover) ? "visible" : "none",
          } });
          map.on("mouseenter", layer.id, () => { map.getCanvas().style.cursor = "pointer"; });
          map.on("mouseleave", layer.id, () => { map.getCanvas().style.cursor = ""; });
          map.on("click", layer.id, showCoverPopover);
        }
      }).catch(() => { /* Low-opacity context halos remain if icon art cannot load. */ });
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
      map.addLayer({ id: "overview-clusters", type: "circle", source: "overview-assets", filter: ["==", ["get", "featureType"], "cluster"], paint: {
        "circle-radius": ["interpolate", ["linear"], ["get", "count"], 2, 13, 8, 18],
        "circle-color": "#FFFDF8",
        "circle-stroke-color": ["match", ["get", "kind"], "mixed", "#68776E", "seating", "#4F8963", "restroom", "#6478B8", "drinking_fountain", "#2E6F85", "#D94C3B"],
        "circle-stroke-width": 2,
        "circle-opacity": 0.96,
      }, layout: { visibility: "none" } });
      map.addLayer({ id: "overview-cluster-count", type: "symbol", source: "overview-assets", filter: ["==", ["get", "featureType"], "cluster"], layout: AMENITY_CLUSTER_COUNT_LAYOUT, paint: { "text-color": "#1E2A24" } });
      const expandAmenityCluster = (event: MapLayerMouseEvent) => {
        if (mapEndpointSelectionRef.current) return;
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
        "circle-radius": ["case", ["get", "selected"], 27, 15],
        "circle-color": ["case", ["get", "selected"], "#F9DDD6", "#FFFDF8"],
        "circle-opacity": ["case", ["get", "selected"], 0.78, 0.01],
        "circle-stroke-color": civicTaskLayer.color,
        "circle-stroke-width": ["case", ["get", "selected"], 5, 0],
        "circle-stroke-opacity": ["case", ["get", "selected"], 1, 0],
        "circle-translate": [0, -23],
      }, layout: { visibility: "none" } });
      void registerCivicTaskMarkerImages(map).then(() => {
        if (map.getLayer("civic-task-icons")) return;
        map.addLayer({ id: "civic-task-icons", type: "symbol", source: "civic-tasks", layout: {
          "icon-image": ["match", ["get", "action"], "photo", "civic-task-photo", "observe", "civic-task-observe", "civic-task-verify"],
          "icon-size": ["case", ["get", "selected"], 1.45, 1.05],
          "icon-anchor": "bottom",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          visibility: overlayVisibilityRef.current.tasks ? "visible" : "none",
        } });
        map.addLayer({ id: "civic-task-focus-label", type: "symbol", source: "civic-tasks", filter: ["==", ["get", "selected"], true], layout: {
          "text-field": ["get", "focusLabel"],
          "text-size": 12,
          "text-anchor": "bottom",
          "text-offset": [0, -4.6],
          "text-letter-spacing": 0.08,
          "text-allow-overlap": true,
          "text-ignore-placement": true,
          visibility: "none",
        }, paint: {
          "text-color": "#8F3E33",
          "text-halo-color": "#FFFDF8",
          "text-halo-width": 3,
          "text-halo-blur": 0.5,
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
        if (mapEndpointSelectionRef.current) return;
        const edgeId = event.features?.[0]?.properties?.edgeId ?? null;
        routeFeatureClickRef.current(edgeId, [event.lngLat.lng, event.lngLat.lat]);
      };
      ["happy", "route-shade", "route-greenery", "route-cover"].forEach((layer) => {
        map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
        map.on("click", layer, routeFeatureClick);
      });
      ["mapped-cover", "cover-construction", "cover-context-vicinities", "street-work-vicinities"].forEach((layer) => {
        map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
        map.on("click", layer, showCoverPopover);
      });
      ["flood-nuisance", "flood-deep"].forEach((layer) => {
        map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
        map.on("click", layer, showFloodPopover);
      });
      ["access-records", "access-ramps", "cool-options"].forEach((layer) => {
        map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
        map.on("click", layer, showHumanContextPopover);
      });
      ["access-clusters", "access-cluster-count", "cool-clusters", "cool-cluster-count"].forEach((layer) => {
        map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "zoom-in"; });
        map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
        map.on("click", layer, (event) => map.easeTo({ center: event.lngLat, zoom: Math.min(17, map.getZoom() + 1.8), duration: 380 }));
      });
      map.on("click", "assets", showAssetPopover);
    });
    map.on("error", () => { if (!map.isStyleLoaded()) setMapError(true); });
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const removeComposeMarkers = () => {
      composeOriginMarkerRef.current?.remove();
      composeDestinationMarkerRef.current?.remove();
      composeOriginMarkerRef.current = null;
      composeDestinationMarkerRef.current = null;
    };
    if (!mapReady || !map || route || appMode !== "walk") {
      removeComposeMarkers();
      return;
    }

    const syncPin = (
      kind: EndpointKind,
      coordinate: Coordinate | null,
      ref: typeof composeOriginMarkerRef,
    ) => {
      if (!coordinate) {
        ref.current?.remove();
        ref.current = null;
        return;
      }
      if (!ref.current) {
        ref.current = new maplibregl.Marker({ element: setupEndpointPinElement(kind), anchor: "bottom" })
          .setLngLat(coordinate)
          .addTo(map);
      }
      ref.current.setLngLat(coordinate);
      ref.current.getElement().classList.toggle("is-active", mapEndpointSelection === kind);
    };

    syncPin("origin", composeEndpointCoordinates.origin, composeOriginMarkerRef);
    syncPin("destination", composeEndpointCoordinates.destination, composeDestinationMarkerRef);
  }, [appMode, composeEndpointCoordinates, mapEndpointSelection, mapReady, route]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || route || appMode !== "walk") return;
    const coordinates = [composeEndpointCoordinates.origin, composeEndpointCoordinates.destination]
      .filter((coordinate): coordinate is Coordinate => Boolean(coordinate));
    if (!coordinates.length) return;
    const frame = window.requestAnimationFrame(() => {
      if (window.innerWidth <= 800) {
        const padding = {
          top: 40,
          right: Math.round(window.innerWidth * .58),
          bottom: Math.round(window.innerHeight * .62),
          left: 20,
        };
        if (coordinates.length === 1) {
          map.easeTo({ center: coordinates[0], zoom: Math.max(14, map.getZoom()), padding, duration: 450 });
        } else {
          map.fitBounds(boundsForCoordinates(coordinates)!, { padding, maxZoom: 14.8, duration: 500 });
        }
      } else if (coordinates.length > 1) {
        map.fitBounds(boundsForCoordinates(coordinates)!, {
          padding: { top: 100, right: 80, bottom: 100, left: 470 },
          maxZoom: 15.5,
          duration: 500,
        });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [appMode, composeEndpointCoordinates, mapReady, route]);

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

    const waypoint = waypointNodeId ? graphNodeById(waypointNodeId) : null;
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
    (map.getSource("route-comparison-delta") as GeoJSONSource | undefined)?.setData(comparisonDelta);
    (map.getSource("route-shade") as GeoJSONSource | undefined)?.setData(shadeSegments);
    (map.getSource("ambient-greenery") as GeoJSONSource | undefined)?.setData(ambientGreeneryLayer);
    (map.getSource("route-greenery") as GeoJSONSource | undefined)?.setData(greeneryRouteSegments);
    (map.getSource("mapped-cover") as GeoJSONSource | undefined)?.setData(ambientCoverLayer);
    (map.getSource("route-cover") as GeoJSONSource | undefined)?.setData(coverRouteSegments);
    (map.getSource("cover-context") as GeoJSONSource | undefined)?.setData(coverContextLayer);
    (map.getSource("cover-context-vicinities") as GeoJSONSource | undefined)?.setData(coverContextVicinities);
    (map.getSource("flood-context") as GeoJSONSource | undefined)?.setData(floodContextLayer);
    (map.getSource("access-context") as GeoJSONSource | undefined)?.setData(accessContextLayer);
    (map.getSource("cool-options") as GeoJSONSource | undefined)?.setData(coolOptionsLayer);
    (map.getSource("planner-selection") as GeoJSONSource | undefined)?.setData(appMode === "planner" ? representativeGap : plannerScenario?.selection.geojson ?? { type: "FeatureCollection", features: [] });
    (map.getSource("representative-routes") as GeoJSONSource | undefined)?.setData(representativeRoutes);
    (map.getSource("route-activity") as GeoJSONSource | undefined)?.setData(activityMapData);
    (map.getSource("endpoints") as GeoJSONSource | undefined)?.setData(route ? endpointsGeoJSON(route) : setupEndpointPresentation);
    (map.getSource("assets") as GeoJSONSource | undefined)?.setData(assetsGeoJSON(activeAssets, activeAsset?.id));
    (map.getSource("overview-assets") as GeoJSONSource | undefined)?.setData(overviewAssets);
    (map.getSource("civic-tasks") as GeoJSONSource | undefined)?.setData(taskFeatures);
    const visibility = (layer: string, visible: boolean) => {
      if (map.getLayer(layer)) map.setLayoutProperty(layer, "visibility", visible ? "visible" : "none");
    };
    const hasRoute = Boolean(route);
    const showWhatIf = appMode === "planner" && plannerView === "what_if";
    const showCurrentRoute = hasRoute && !(appMode === "planner" && plannerView !== "what_if");
    visibility("baseline", showCurrentRoute && showBaseline && Boolean(result?.baseline));
    visibility("baseline-delta", showCurrentRoute && showBaseline && comparisonDelta.features.length > 0);
    visibility("recommended-delta", showCurrentRoute && showBaseline && comparisonDelta.features.length > 0);
    visibility("endpoints", false);
    visibility("happy-casing", showCurrentRoute);
    visibility("happy", showCurrentRoute);
    visibility("route-shade", showCurrentRoute && mapOverlays.shade);
    visibility("ambient-greenery", mapOverlays.greenery);
    visibility("route-greenery", showCurrentRoute && mapOverlays.greenery);
    visibility("route-cover", showCurrentRoute && mapOverlays.cover);
    visibility("mapped-cover", mapOverlays.cover);
    visibility("mapped-cover-casing", mapOverlays.cover);
    visibility("cover-context-vicinities", mapOverlays.cover);
    visibility("cover-arcade-icons", mapOverlays.cover);
    visibility("street-work-vicinities", mapOverlays.streetWork);
    visibility("cover-shed-icons", mapOverlays.streetWork);
    visibility("cover-construction", mapOverlays.streetWork);
    ["flood-nuisance", "flood-deep", "flood-nuisance-outline", "flood-deep-outline"]
      .forEach((layer) => visibility(layer, mapOverlays.flood));
    ["access-clusters", "access-cluster-count", "access-records", "access-ramps"]
      .forEach((layer) => visibility(layer, mapOverlays.access));
    ["cool-clusters", "cool-cluster-count", "cool-options"]
      .forEach((layer) => visibility(layer, mapOverlays.cooling));
    const showLocalActivity = appMode === "planner" && plannerView !== "what_if" && activityMapData.features.length > 0;
    const showSelection = showWhatIf && representativeGap.features.length > 0;
    visibility("planner-selection", showSelection);
    visibility("planner-selection-casing", showSelection);
    visibility("representative-baseline", showWhatIf && representativeRoutes.features.length > 0);
    visibility("representative-scenario", showWhatIf && showRepresentativeIntervention && representativeRoutes.features.length > 0);
    visibility("route-activity-casing", showLocalActivity);
    visibility("route-activity-lines", showLocalActivity);
    visibility("route-activity-notes", showLocalActivity && plannerView === "notes");
    ["overview-clusters", "overview-cluster-count", "overview-icons", "assets", "asset-icons"].forEach((layer) => visibility(layer, mapOverlays.amenities));
    const showCivicTasks = civicTaskLayerVisible(mapOverlays.tasks, activeTask?.id);
    ["civic-task-halo", "civic-task-hit", "civic-task-icons"].forEach((layer) => visibility(layer, showCivicTasks));
    visibility("civic-task-focus-label", Boolean(activeTask));
  }, [route, result, showBaseline, comparisonDelta, representativeGap, representativeRoutes, showRepresentativeIntervention, activityMapData, plannerView, activeAssets, activeAsset?.id, activeTask?.id, overviewAssets, taskFeatures, shadeSegments, ambientGreeneryLayer, greeneryRouteSegments, ambientCoverLayer, coverRouteSegments, coverContextLayer, coverContextVicinities, floodContextLayer, accessContextLayer, coolOptionsLayer, plannerScenario, mapLens, mapOverlays, appMode, mapReady, setupEndpointPresentation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!route || !map || !mapReady || (appMode === "planner" && plannerView !== "what_if")) return;
    const frame = window.requestAnimationFrame(() => {
      map.resize();
      map.fitBounds(boundsForRoute(route), { padding: { top: 90, right: 70, bottom: 90, left: window.innerWidth > 800 ? 460 : 70 }, maxZoom: appMode === "planner" ? 15.3 : 16, duration: 650 });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [route, appMode, plannerView, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (appMode !== "planner" || plannerView !== "what_if" || !map || !mapReady || representativeRoutes.features.length === 0) return;
    const coordinates = representativeRoutes.features.flatMap((feature) => feature.geometry.coordinates);
    const west = Math.min(...coordinates.map(([longitude]) => longitude));
    const east = Math.max(...coordinates.map(([longitude]) => longitude));
    const south = Math.min(...coordinates.map(([, latitude]) => latitude));
    const north = Math.max(...coordinates.map(([, latitude]) => latitude));
    const frame = window.requestAnimationFrame(() => map.fitBounds([[west, south], [east, north]], {
      padding: { top: 90, right: 70, bottom: 90, left: window.innerWidth > 800 ? 480 : 70 },
      maxZoom: 15.7,
      duration: 650,
    }));
    return () => window.cancelAnimationFrame(frame);
  }, [appMode, plannerView, mapReady, representativeRoutes]);

  useEffect(() => {
    if (!mapOverlays.shade || !buildingShadeDetailVisible(mapViewport.zoom)) {
      if (mapRef.current?.getLayer("building-shadows")) mapRef.current.setLayoutProperty("building-shadows", "visibility", "none");
      return;
    }
    const roundedHour = Math.max(7, Math.min(19, Math.round(shadeHour)));
    const loads = shadowTilesIntersectingBounds(mapViewport)
      .map((tileId) => shadowModules[`./data/shadows/${tileId}/hour-${roundedHour}.json`])
      .filter((load): load is NonNullable<typeof load> => Boolean(load));
    if (!loads.length || !mapRef.current?.getSource("building-shadows")) return;
    let cancelled = false;
    const timer = window.setTimeout(() => void Promise.all(loads.map(async (load) => {
      const url = await load() as string;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Shadow tile failed to load: ${response.status}`);
      return response.json() as Promise<{ features: never[] }>;
    })).then((modules) => {
      if (cancelled) return;
      mapRef.current?.setLayoutProperty("building-shadows", "visibility", "visible");
      (mapRef.current?.getSource("building-shadows") as GeoJSONSource | undefined)?.setData({
        type: "FeatureCollection",
        features: modules.flatMap((module) => module.features),
      });
    }).catch(() => {
      if (mapRef.current?.getLayer("building-shadows")) mapRef.current.setLayoutProperty("building-shadows", "visibility", "none");
    }), 90);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [shadeHour, mapOverlays.shade, mapViewport, mapReady]);

  const assetPopoverOpensLeft = Boolean(activeAssetPoint && activeAssetPoint.x > window.innerWidth - 320);
  const assetPopoverStyle = activeAssetPoint ? {
    "--asset-popover-left": `${Math.max(16, assetPopoverOpensLeft ? activeAssetPoint.x - 296 : activeAssetPoint.x + 18)}px`,
    "--asset-popover-top": `${Math.max(72, Math.min(window.innerHeight - 190, activeAssetPoint.y - 34))}px`,
  } as CSSProperties : undefined;

  const coverPopoverStyle = activeCoverPoint ? {
    "--asset-popover-left": `${Math.max(16, activeCoverPoint.x > window.innerWidth - 320 ? activeCoverPoint.x - 296 : activeCoverPoint.x + 18)}px`,
    "--asset-popover-top": `${Math.max(72, Math.min(window.innerHeight - 190, activeCoverPoint.y - 34))}px`,
  } as CSSProperties : undefined;

  const floodPopoverStyle = activeFloodPoint ? {
    "--asset-popover-left": `${Math.max(16, activeFloodPoint.x > window.innerWidth - 320 ? activeFloodPoint.x - 296 : activeFloodPoint.x + 18)}px`,
    "--asset-popover-top": `${Math.max(72, Math.min(window.innerHeight - 220, activeFloodPoint.y - 34))}px`,
  } as CSSProperties : undefined;

  const humanContextPopoverStyle = activeHumanContextPoint ? {
    "--asset-popover-left": `${Math.max(16, activeHumanContextPoint.x > window.innerWidth - 320 ? activeHumanContextPoint.x - 296 : activeHumanContextPoint.x + 18)}px`,
    "--asset-popover-top": `${Math.max(72, Math.min(window.innerHeight - 220, activeHumanContextPoint.y - 34))}px`,
  } as CSSProperties : undefined;

  const taskPopoverOpensLeft = Boolean(activeTaskPoint && activeTaskPoint.x > window.innerWidth - 320);
  const taskPopoverStyle = activeTaskPoint ? {
    "--asset-popover-left": `${Math.max(16, taskPopoverOpensLeft ? activeTaskPoint.x - 296 : activeTaskPoint.x + 18)}px`,
    "--asset-popover-top": `${Math.max(72, Math.min(window.innerHeight - 210, activeTaskPoint.y - 34))}px`,
  } as CSSProperties : undefined;

  const switchMode = (mode: AppMode) => {
    setMapEndpointSelection(null);
    setAppMode(mode);
    setDetail(null);
    setActiveAsset(null);
    setActiveAssetPoint(null);
    setActiveTask(null);
    setActiveTaskPoint(null);
    setActiveCover(null);
    setActiveCoverPoint(null);
    setActiveFlood(null);
    setActiveFloodPoint(null);
    setActiveHumanContext(null);
    setActiveHumanContextPoint(null);
    setEditRoute(false);
    if (mode === "planner") {
      setShowRepresentativeIntervention(false);
      setPlannerView("what_if");
    }
    const nextLens: MapLens = mode === "planner" ? (route ? "shade" : "amenities") : rainContext ? "cover" : "route";
    setMapLens(nextLens);
    setMapOverlays({
      ...DEFAULT_MAP_OVERLAYS,
      shade: mode === "planner" && Boolean(route),
      cover: mode === "walk" && rainContext,
      amenities: !route,
    });
  };

  const focusMapLens = (lens: MapLens) => {
    setMapLens(lens);
    setMapOverlays(lens === "route" ? DEFAULT_MAP_OVERLAYS : { ...DEFAULT_MAP_OVERLAYS, [lens]: true });
    setEditRoute(false);
  };

  const toggleMapOverlay = (layer: keyof MapOverlays) => {
    setMapOverlays((current) => toggledMapOverlay(current, layer));
    setMapLens(layer);
    setEditRoute(false);
  };

  const savePreferences = (nextPreferences: UserPreferences) => {
    setPreferences(nextPreferences);
    saveUserPreferences(nextPreferences);
    if (!route) {
      const preferenceBrief = newTripBriefFromPreferences(nextPreferences, brief.departureHour);
      setBrief((current) => ({
        ...current,
        priorities: [...preferenceBrief.priorities],
        detourMinutes: nextPreferences.detourMinutes,
        interpretedBy: "controls",
      }));
    }
  };

  const resetPreferences = () => {
    setPreferences(null);
    clearUserPreferences();
    if (!route) {
      setBrief((current) => ({ ...current, priorities: [], detourMinutes: DEFAULT_BRIEF.detourMinutes, interpretedBy: "controls" }));
    }
  };

  const saveActiveRouteFeedback = (input: { sentiment: RouteFeedbackSentiment; category: RouteFeedbackCategory | null; body: string }) => {
    if (!activeRouteActivity) return;
    const next = addRouteFeedback(routeActivityRef.current, activeRouteActivity.id, input);
    routeActivityRef.current = next;
    setRouteActivity(next);
    setActivityPersisted(saveRouteActivity(next));
  };

  const removeActiveRouteFeedback = (feedbackId: string) => {
    if (!activeRouteActivity) return;
    const next = removeRouteFeedback(routeActivityRef.current, activeRouteActivity.id, feedbackId);
    routeActivityRef.current = next;
    setRouteActivity(next);
    setActivityPersisted(saveRouteActivity(next));
  };

  const selectActivityRoute = (routeId: string) => {
    setSelectedActivityRouteId(routeId);
    const selected = routeActivityRef.current.find((item) => item.id === routeId);
    const bounds = selected ? boundsForCoordinates(selected.coordinates) : null;
    if (bounds && mapRef.current) mapRef.current.fitBounds(bounds, { padding: { top: 100, right: 80, bottom: 100, left: window.innerWidth > 800 ? 470 : 70 }, maxZoom: 16, duration: 500 });
  };

  const clearLocalRouteActivity = () => {
    if (!window.confirm("Clear every route and note saved in this browser? This cannot be undone.")) return;
    routeActivityRef.current = [];
    setRouteActivity([]);
    setActiveRouteLogId(null);
    setSelectedActivityRouteId(null);
    setActivityPersisted(clearRouteActivity());
  };

  return <main className={`${route ? "has-result" : "is-compose"} mode-${appMode} ${mapEndpointSelection ? "map-picking" : ""}`}>
    <div className="map-shell"><div className="map" ref={mapContainer} /><div className="map-wash" />{mapError && <FallbackMap graph={pilotGraph} route={route} setupEndpoints={route ? undefined : setupEndpointPresentation} baseline={showBaseline ? result?.baseline ?? null : null} comparisonDelta={comparisonDelta} representativeRoutes={representativeRoutes} activity={routeActivity} showActivity={appMode === "planner" && plannerView !== "what_if"} selectedActivityRouteId={selectedActivityRouteId} onActivityRouteClick={selectActivityRoute} lens={mapLens} overlays={mapOverlays} shadeSegments={shadeSegments} greenerySegments={greeneryRouteSegments} ambientGreenery={ambientGreeneryLayer} coverSegments={coverRouteSegments} ambientCover={ambientCoverLayer} coverContext={coverContextLayer} floodContext={floodContextLayer} accessContext={accessContextLayer} coolOptions={coolOptionsLayer} selection={appMode === "planner" ? representativeGap : null} assets={viewportAssets} prominentAssetIds={activeAssets.map((asset) => asset.id)} selectedAssetId={activeAsset?.id} onMapClick={mapEndpointSelection && !route && appMode === "walk" ? (coordinate) => void selectEndpointFromMap(mapEndpointSelection, coordinate) : undefined} onAssetClick={(asset) => { setActiveTask(null); setActiveTaskPoint(null); setActiveFlood(null); setActiveFloodPoint(null); setActiveAsset(asset); setActiveAssetPoint({ x: Math.round(window.innerWidth * .68), y: 160 }); }} tasks={visibleTasks} selectedTaskId={activeTask?.id} completedTaskIds={Object.keys(taskObservations)} onTaskClick={(task) => { setActiveAsset(null); setActiveAssetPoint(null); setActiveFlood(null); setActiveFloodPoint(null); setActiveTask(task); setActiveTaskPoint({ x: Math.round(window.innerWidth * .68), y: 160 }); }} />}</div>
    <div className="top-bar"><div className="brand-cluster"><Brand /><PreferencesPopover preferences={preferences} onSave={savePreferences} onReset={resetPreferences} appliesNow={!route} /><div className="mode-switch" aria-label="Product view"><button type="button" className={appMode === "walk" ? "active" : ""} aria-pressed={appMode === "walk"} onClick={() => switchMode("walk")}>Walk</button><button type="button" className={appMode === "planner" ? "active" : ""} aria-pressed={appMode === "planner"} onClick={() => switchMode("planner")}>City view</button></div><a className="data-sources-nav-link" href="/datasources"><LayersIcon /><span>Data</span></a></div><div className="map-actions">{!mapError && <IconButton label="Center map" onClick={() => mapRef.current?.easeTo({ center: graphNodeById(originNodeId)?.coordinate, zoom: 14.5 })}><LocateIcon /></IconButton>}{route && appMode === "walk" && <IconButton label="Map details" onClick={() => { setActiveAsset(null); setActiveAssetPoint(null); setActiveTask(null); setActiveTaskPoint(null); setDetail("data"); }}><LayersIcon /></IconButton>}</div></div>
    {appMode === "planner"
      ? <RepresentativePlannerSheet scenario={representativeScenario} showIntervention={showRepresentativeIntervention} onShowIntervention={() => setShowRepresentativeIntervention(true)} onBack={() => switchMode("walk")} activity={routeActivity} activityPersisted={activityPersisted} view={plannerView} onViewChange={setPlannerView} selectedActivityRouteId={selectedActivityRouteId} onSelectActivityRoute={selectActivityRoute} onClearActivity={clearLocalRouteActivity} />
      : !route
        ? <ComposeSheet brief={brief} setBrief={setBrief} prompt={prompt} setPrompt={setPrompt} originText={originText} setOriginText={(value) => changeEndpointText("origin", value)} destinationText={destinationText} setDestinationText={(value) => changeEndpointText("destination", value)} mapEndpointSelection={mapEndpointSelection} onMapEndpointSelectionChange={setMapEndpointSelection} busy={busy} busyMode={busyMode} error={error} onPlan={() => void plan()} onSelectExample={selectExample} onSelectLocation={selectLocationSuggestion} />
        : result && <ResultSheet brief={brief} route={route} result={result} assets={activeAssets} tasks={routeTasks} destinationText={destinationText} setDestinationText={(value) => changeEndpointText("destination", value)} delta={delta} error={error} feedback={activeRouteActivity?.feedback ?? []} activityPersisted={activityPersisted} onBack={startNewWalk} onRefine={(value) => plan(value, true)} onAdjust={adjust} onShowWhy={() => { setActiveAsset(null); setActiveAssetPoint(null); setActiveTask(null); setActiveTaskPoint(null); setDetail("why"); }} onShowAsset={(asset) => { setActiveTask(null); setActiveTaskPoint(null); setActiveAsset(asset); setActiveAssetPoint(null); setDetail("asset"); }} onShowTask={(task) => { setActiveAsset(null); setActiveAssetPoint(null); setActiveTask(task); setActiveTaskPoint(null); setDetail("task"); }} onShowData={() => { setActiveAsset(null); setActiveAssetPoint(null); setActiveTask(null); setActiveTaskPoint(null); setDetail("data"); }} onSaveFeedback={saveActiveRouteFeedback} onRemoveFeedback={removeActiveRouteFeedback} showBaseline={showBaseline} setShowBaseline={setShowBaseline} busy={busy} busyMode={busyMode} modelFallback={modelFallback} rainContext={rainContext} />}
    {appMode === "walk" && detail && route && <DetailPanel mode={detail} brief={brief} route={route} assets={activeAssets} tasks={routeTasks} activeAsset={activeAsset} activeTask={activeTask} taskObservation={activeTask ? taskObservations[activeTask.id] ?? null : null} detourScenario={detourScenario} rainContext={rainContext} onCompleteTask={(response) => { if (!activeTask) return; setTaskObservations((current) => ({ ...current, [activeTask.id]: createSessionCivicObservation(activeTask, response) })); }} onRemoveTaskObservation={() => { if (!activeTask) return; setTaskObservations((current) => { const next = { ...current }; delete next[activeTask.id]; return next; }); }} onClose={() => { setDetail(null); if (detail === "asset") { setActiveAsset(null); setActiveAssetPoint(null); } if (detail === "task") { setActiveTask(null); setActiveTaskPoint(null); } }} />}
    {activeAsset && detail !== "asset" && <aside className={`asset-popover ${assetPopoverOpensLeft ? "opens-left" : ""}`} style={assetPopoverStyle} role="dialog" aria-label={assetTypeLabel(activeAsset)}><div><AssetIcon kind={activeAsset.kind} /><IconButton label="Close" onClick={() => { setActiveAsset(null); setActiveAssetPoint(null); }}><CloseIcon /></IconButton></div><span className="eyebrow">{appMode === "planner" ? "Place on the map" : "Near your walk"}</span><h3>{activeAsset.kind === "transit" ? activeAsset.details.stopName : assetTypeLabel(activeAsset)}</h3>{assetTransitLinesLabel(activeAsset) && <strong className="asset-transit-lines">{assetTransitLinesLabel(activeAsset)}</strong>}<p>{activeAsset.kind === "transit" ? activeAsset.details.entranceType ?? "Mapped subway entrance" : activeAsset.locationLabel}</p><small>{assetAvailabilityCopy(activeAsset)}</small><small className="source-freshness">{civicAssetEvidence(activeAsset).freshnessLabel}</small>{appMode === "walk" && <button type="button" className="asset-more" onClick={() => setDetail("asset")}>See details</button>}</aside>}
    {activeTask && detail !== "task" && <aside className={`asset-popover civic-task-popover ${taskPopoverOpensLeft ? "opens-left" : ""}`} style={taskPopoverStyle} role="dialog" aria-label={activeTask.title}><div><CivicTaskIcon task={activeTask} /><IconButton label="Close" onClick={() => { setActiveTask(null); setActiveTaskPoint(null); }}><CloseIcon /></IconButton></div><span className="eyebrow">Optional · {activeTask.estimatedMinutes} min</span><h3>{activeTask.title}</h3><p>{activeTask.locationLabel}</p><small>A quick check that can help keep the map useful.</small>{taskObservations[activeTask.id] && <small className="task-complete-label"><CheckCircleIcon />Checked in this session</small>}{appMode === "walk" && <button type="button" className="asset-more" onClick={() => setDetail("task")}>{taskObservations[activeTask.id] ? "See observation" : "View check"}</button>}</aside>}
    {activeCover && <aside className="asset-popover cover-popover" style={coverPopoverStyle} role="dialog" aria-label="Cover evidence"><div><UmbrellaIcon /><IconButton label="Close" onClick={() => { setActiveCover(null); setActiveCoverPoint(null); }}><CloseIcon /></IconButton></div><span className="eyebrow">Cover evidence</span><h3>{activeCover.label}</h3><p>{activeCover.locationLabel}</p><small>{activeCover.detail}</small>{activeCover.taskId && <button type="button" className="asset-more" onClick={() => { const task = allCivicTasks.find((candidate) => candidate.id === activeCover.taskId); if (!task) return; setAppMode("walk"); setActiveCover(null); setActiveCoverPoint(null); setActiveTask(task); setActiveTaskPoint(null); setDetail("task"); }}>Help verify this</button>}{activeCover.sourceId && sourceRegistryPresentation(activeCover.sourceId) && <a className="asset-more" href={sourceRegistryPresentation(activeCover.sourceId)!.officialUrl} target="_blank" rel="noreferrer">Open source</a>}</aside>}
    {activeFlood && <aside className="asset-popover flood-popover" style={floodPopoverStyle} role="dialog" aria-label="Modeled flood potential"><div><CloudRainIcon /><IconButton label="Close" onClick={() => { setActiveFlood(null); setActiveFloodPoint(null); }}><CloseIcon /></IconButton></div><span className="eyebrow">2050 model · not live</span><h3>{activeFlood.label}</h3><p>{activeFlood.depthBand}</p><small>{activeFlood.detail}</small><a className="asset-more" href={floodEvidenceMetadata.source.datasetUrl} target="_blank" rel="noreferrer">Open DEP model source</a></aside>}
    {activeHumanContext && <aside className="asset-popover human-context-popover" style={humanContextPopoverStyle} role="dialog" aria-label={activeHumanContext.label}><div>{activeHumanContext.sourceId === "nyc-cool-options" ? <DropletIcon /> : <StairsIcon />}<IconButton label="Close" onClick={() => { setActiveHumanContext(null); setActiveHumanContextPoint(null); }}><CloseIcon /></IconButton></div><span className="eyebrow">{activeHumanContext.eyebrow}</span><h3>{activeHumanContext.label}</h3>{activeHumanContext.location && <p>{activeHumanContext.location}</p>}<small>{activeHumanContext.detail}</small><a className="asset-more" href={sourceRegistryPresentation(activeHumanContext.sourceId)?.officialUrl} target="_blank" rel="noreferrer">Open official source</a></aside>}
    <MapLensControl overlays={mapOverlays} onToggle={toggleMapOverlay} hour={shadeHour} onHourChange={setShadeHour} weather={weather} planner={appMode === "planner"} hasRoute={Boolean(route)} shadeDetailVisible={buildingShadeDetailVisible(mapViewport.zoom)} canEdit={!mapError} editing={editRoute} onEditingChange={(editing) => { setEditRoute(editing); if (editing) setMapLens("route"); }} />
    <div className="map-key" role="list" aria-label="Visible map layers">{appMode === "planner" && plannerView !== "what_if" && routeActivity.length > 0 && <><span role="listitem"><i className="activity-route-key" />Mapped routes</span>{routeActivity.some((item) => item.feedback.length) && <span role="listitem"><i className="activity-note-key" />Route notes</span>}</>}{route && !(appMode === "planner" && plannerView !== "what_if") && <span role="listitem"><i className="route-key" />Footnote</span>}{showBaseline && result?.baseline && !(appMode === "planner" && plannerView !== "what_if") && <span role="listitem"><i className="baseline-key" />Fastest route</span>}{mapOverlays.shade && ((appMode === "planner" && plannerView === "what_if") || detail === "data") && <span role="listitem"><i className="shade-deep-key" />{route || buildingShadeDetailVisible(mapViewport.zoom) ? `Shade at ${formatClock(shadeHour)}` : "Zoom in for shade"}</span>}{mapOverlays.greenery && ((appMode === "planner" && plannerView === "what_if") || detail === "data") && <span role="listitem"><i className="greenery-key" />Trees &amp; parks nearby</span>}{mapOverlays.cover && ((appMode === "planner" && plannerView === "what_if") || detail === "data") && <><span role="listitem"><i className="cover-key" />Mapped cover</span><span role="listitem"><i className="cover-context-key" />Arcade record vicinity</span></>}{mapOverlays.streetWork && <span role="listitem"><i className="street-work-key" />Street work · possible disruption</span>}{mapOverlays.access && <span role="listitem"><i className="access-key" />Access records · incomplete</span>}{mapOverlays.cooling && <span role="listitem"><i className="cooling-key" />Cool options · verify status</span>}{mapOverlays.flood && ((appMode === "planner" && plannerView === "what_if") || detail === "data") && <span role="listitem"><i className="flood-key" />Flood potential · 2050 model</span>}{mapOverlays.amenities && ((appMode === "planner" && plannerView === "what_if") || detail === "data") && <span role="listitem"><i className="amenity-key" />Nearby places</span>}{mapOverlays.tasks && ((appMode === "planner" && plannerView === "what_if") || detail === "data") && <span role="listitem"><i className="task-key" />Optional check</span>}</div>
  </main>;
}
