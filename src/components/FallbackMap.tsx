import type { CivicAsset } from "../data/civicAssets";
import type { CivicTask } from "../data/civicTasks";
import type { AccessContextCollection } from "../data/accessContext";
import type { CoolOptionsCollection } from "../data/coolOptions";
import type { FloodContextCollection } from "../floodEvidence";
import { civicTaskLayerVisible, type EndpointFeatureCollection } from "../mapPresentation";
import type { RouteActivityLog } from "../routeActivity";
import type { Coordinate, JourneyRoute, PilotGraph } from "../types";

type FallbackLens = "route" | "shade" | "greenery" | "cover" | "flood" | "amenities" | "access" | "streetWork" | "cooling" | "tasks";

interface LineFeature {
  properties: Record<string, unknown>;
  geometry: { type: "LineString"; coordinates: Coordinate[] };
}

interface LineCollection {
  features: LineFeature[];
}

interface CoverContextCollection {
  features: Array<{
    properties: { kind: string; label: string };
    geometry:
      | { type: "Point"; coordinates: Coordinate }
      | { type: "MultiLineString"; coordinates: Coordinate[][] };
  }>;
}

type FallbackBbox = readonly [south: number, west: number, north: number, east: number];

export function fallbackMapBounds(graph: PilotGraph, route: JourneyRoute | null, additionalCoordinates: readonly Coordinate[] = []): FallbackBbox {
  const coordinates = [...(route?.coordinates ?? []), ...additionalCoordinates];
  if (!coordinates.length) return graph.metadata?.pilotBbox ?? [40.7, -74.03, 40.76, -73.97];
  const longitudes = coordinates.map(([longitude]) => longitude);
  const latitudes = coordinates.map(([, latitude]) => latitude);
  const west = Math.min(...longitudes);
  const east = Math.max(...longitudes);
  const south = Math.min(...latitudes);
  const north = Math.max(...latitudes);
  const longitudePadding = Math.max((east - west) * 0.16, 0.0012);
  const latitudePadding = Math.max((north - south) * 0.16, 0.0009);
  return [south - latitudePadding, west - longitudePadding, north + latitudePadding, east + longitudePadding];
}

export function fallbackMapCoordinate([x, y]: readonly [number, number], [south, west, north, east]: FallbackBbox): Coordinate {
  return [west + x / 1200 * (east - west), south + (820 - y) / 820 * (north - south)];
}

export function FallbackMap({ graph, route, setupEndpoints, baseline, comparisonDelta, representativeRoutes, activity = [], showActivity = false, selectedActivityRouteId, lens, overlays, shadeSegments, greenerySegments, ambientGreenery, coverSegments, ambientCover, coverContext, floodContext, accessContext, coolOptions, selection, assets, prominentAssetIds, selectedAssetId, onMapClick, onAssetClick, tasks, selectedTaskId, completedTaskIds, onTaskClick, onActivityRouteClick }: {
  graph: PilotGraph;
  route: JourneyRoute | null;
  setupEndpoints?: EndpointFeatureCollection;
  baseline?: JourneyRoute | null;
  comparisonDelta?: LineCollection;
  representativeRoutes?: LineCollection;
  activity?: readonly RouteActivityLog[];
  showActivity?: boolean;
  selectedActivityRouteId?: string | null;
  lens: FallbackLens;
  overlays: { shade: boolean; greenery: boolean; cover: boolean; flood: boolean; amenities: boolean; access: boolean; streetWork: boolean; cooling: boolean; tasks: boolean };
  shadeSegments: LineCollection;
  greenerySegments: LineCollection;
  ambientGreenery: LineCollection;
  coverSegments: LineCollection;
  ambientCover: LineCollection;
  coverContext: CoverContextCollection;
  floodContext: FloodContextCollection;
  accessContext: AccessContextCollection;
  coolOptions: CoolOptionsCollection;
  selection?: LineCollection | null;
  assets: readonly CivicAsset[];
  prominentAssetIds: readonly string[];
  selectedAssetId?: string | null;
  onMapClick?: (coordinate: Coordinate) => void;
  onAssetClick: (asset: CivicAsset) => void;
  tasks: readonly CivicTask[];
  selectedTaskId?: string | null;
  completedTaskIds: readonly string[];
  onTaskClick: (task: CivicTask) => void;
  onActivityRouteClick?: (routeId: string) => void;
}) {
  const activityCoordinates = showActivity ? activity.flatMap((item) => item.coordinates) : [];
  const setupEndpointCoordinates = !route && !showActivity
    ? setupEndpoints?.features.map((feature) => feature.geometry.coordinates) ?? []
    : [];
  const bbox = fallbackMapBounds(graph, showActivity ? null : route, [
    ...(setupEndpointCoordinates.length > 1 ? setupEndpointCoordinates : []),
    ...(showActivity ? [] : representativeRoutes?.features.flatMap((feature) => feature.geometry.coordinates) ?? []),
    ...activityCoordinates,
  ]);
  const [south, west, north, east] = bbox;
  const width = 1200;
  const height = 820;
  const viewX = -130;
  const viewWidth = 1460;
  const point = ([lng, lat]: Coordinate) => [
    (lng - west) / (east - west) * width,
    height - (lat - south) / (north - south) * height,
  ] as const;
  const points = (coordinates: readonly Coordinate[]) => coordinates.map((coordinate) => point(coordinate).join(",")).join(" ");
  const floodPath = (rings: readonly Coordinate[][]) => rings
    .map((ring) => `M ${ring.map((coordinate) => point(coordinate).join(" ")).join(" L ")} Z`)
    .join(" ");
  const prominent = new Set(prominentAssetIds);
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const edgeCoordinates = (edge: PilotGraph["edges"][number]) => edge.geometry ?? [nodeById.get(edge.from)!.coordinate, nodeById.get(edge.to)!.coordinate];
  const coordinateInView = ([longitude, latitude]: Coordinate) => longitude >= west && longitude <= east && latitude >= south && latitude <= north;
  const streetEdges = graph.edges
    .filter((edge, index) => edge.distanceMeters > 18 && index % 3 === 0 && edgeCoordinates(edge).some(coordinateInView))
    .slice(0, 1_100);
  const labels = [...graph.edges]
    .filter((edge) => edge.street && !/^unnamed/i.test(edge.street) && edge.distanceMeters > 80)
    .filter((edge) => edgeCoordinates(edge).some(coordinateInView))
    .sort((a, b) => b.distanceMeters - a.distanceMeters)
    .filter((edge, index, candidates) => candidates.findIndex((candidate) => candidate.street === edge.street) === index)
    .slice(0, 11);
  const visibleAssets = assets
    .filter((asset) => overlays.amenities && (asset.id === selectedAssetId || prominent.has(asset.id) || stableNumber(asset.id) % 5 === 0))
    .slice(0, 28);
  const visibleAccess = accessContext.features
    .filter((feature) => coordinateInView(feature.geometry.coordinates as Coordinate))
    .filter((feature) => feature.properties.kind !== "ramp_survey" || stableNumber(feature.properties.id) % 31 === 0)
    .slice(0, 180);
  const visibleCoolOptions = coolOptions.features
    .filter((feature) => coordinateInView(feature.geometry.coordinates as Coordinate))
    .slice(0, 100);
  const completedTasks = new Set(completedTaskIds);

  return <div className="fallback-map" aria-label="Street map preview">
    <svg viewBox={`${viewX} 0 ${viewWidth} ${height}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label="Footnote route and neighborhood amenities" onClick={onMapClick ? (event) => {
      const svg = event.currentTarget;
      const matrix = svg.getScreenCTM();
      if (!matrix) return;
      const screenPoint = svg.createSVGPoint();
      screenPoint.x = event.clientX;
      screenPoint.y = event.clientY;
      const viewPoint = screenPoint.matrixTransform(matrix.inverse());
      onMapClick(fallbackMapCoordinate([viewPoint.x, viewPoint.y], bbox));
    } : undefined}>
      <defs>
        <pattern id="fallback-grid" width="70" height="70" patternUnits="userSpaceOnUse"><path d="M70 0H0V70" fill="none" stroke="#dcded9" strokeWidth="1" /></pattern>
        <pattern id="fallback-flood-nuisance" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#d8e4e8" fillOpacity=".5" /><path d="M-3 3 3-3M0 12 12 0M9 15 15 9" stroke="#426a7c" strokeWidth="2" strokeOpacity=".7" /></pattern>
        <pattern id="fallback-flood-deep" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#bfcfd8" fillOpacity=".62" /><path d="M-3 3 3-3M0 12 12 0M9 15 15 9M9-3 15 3M0 0 12 12M-3 9 3 15" stroke="#304860" strokeWidth="1.8" strokeOpacity=".8" /></pattern>
        <filter id="route-shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#344038" floodOpacity=".22" /></filter>
      </defs>
      <rect x={viewX} width={viewWidth} height={height} fill="#f2f1ed" />
      <rect x={viewX} width={viewWidth} height={height} fill="url(#fallback-grid)" opacity=".48" />
      <g className="fallback-parks" aria-hidden="true"><ellipse cx="1050" cy="110" rx="180" ry="120" /><ellipse cx="380" cy="670" rx="120" ry="80" /><ellipse cx="720" cy="350" rx="85" ry="58" /></g>
      <g className="fallback-streets" aria-hidden="true">{streetEdges.map((edge) => <polyline key={edge.id} points={points(edgeCoordinates(edge))} />)}</g>
      <g className="fallback-labels" aria-hidden="true">{labels.map((edge) => {
        const geometry = edgeCoordinates(edge);
        const center = geometry[Math.floor(geometry.length / 2)];
        const [x, y] = point(center);
        return <text key={edge.id} x={x} y={y}>{edge.street}</text>;
      })}</g>

      {!showActivity && overlays.flood && <g className="fallback-flood-context" aria-label="Modeled 2050 flood potential">{floodContext.features.flatMap((feature) => feature.geometry.coordinates.map((rings, index) => <path key={`${feature.id}-${index}`} d={floodPath(rings)} fill={feature.properties.category === "deep_contiguous" ? "url(#fallback-flood-deep)" : "url(#fallback-flood-nuisance)"} fillRule="evenodd" stroke={feature.properties.category === "deep_contiguous" ? "#304860" : "#426a7c"} strokeWidth={feature.properties.category === "deep_contiguous" ? 1.5 : 1}><title>{feature.properties.label} · 2050 model, not live</title></path>))}</g>}

      {!showActivity && overlays.greenery && <g className="ambient-greenery-lines">{ambientGreenery.features.map((feature, index) => <polyline key={`${String(feature.properties.edgeId)}-${index}`} className={String(feature.properties.greeneryBand)} points={points(feature.geometry.coordinates)}><title>{String(feature.properties.label)}</title></polyline>)}</g>}
      {!showActivity && overlays.shade && <g className="fallback-evidence-lines shade-lines">{shadeSegments.features.map((feature, index) => <polyline key={`${String(feature.properties.edgeId)}-${index}`} className={String(feature.properties.shadeBand)} points={points(feature.geometry.coordinates)}><title>{String(feature.properties.label)}</title></polyline>)}</g>}
      {!showActivity && overlays.greenery && <g className="fallback-evidence-lines greenery-lines">{greenerySegments.features.map((feature, index) => <polyline key={`${String(feature.properties.edgeId)}-${index}`} className={String(feature.properties.greeneryBand)} points={points(feature.geometry.coordinates)}><title>{String(feature.properties.label)}</title></polyline>)}</g>}
      {!showActivity && overlays.cover && <g className="ambient-cover-lines">{ambientCover.features.map((feature, index) => <polyline key={`${String(feature.properties.edgeId)}-${index}`} className={Number(feature.properties.coverShare) >= .7 ? "more" : "some"} points={points(feature.geometry.coordinates)}><title>{String(feature.properties.label)}</title></polyline>)}</g>}
      {!showActivity && overlays.cover && <g className="fallback-evidence-lines cover-lines">{coverSegments.features.map((feature, index) => <polyline key={`${String(feature.properties.edgeId)}-${index}`} className={String(feature.properties.coverBand)} points={points(feature.geometry.coordinates)}><title>{String(feature.properties.label)}</title></polyline>)}</g>}
      {!showActivity && overlays.streetWork && <g className="fallback-construction-lines">{coverContext.features.flatMap((feature, index) => feature.geometry.type === "MultiLineString" ? feature.geometry.coordinates.map((line, lineIndex) => <polyline key={`construction-${index}-${lineIndex}`} points={points(line)}><title>{String(feature.properties.label)}</title></polyline>) : [])}</g>}
      {!showActivity && (overlays.cover || overlays.streetWork) && <g className="fallback-cover-context">{coverContext.features.flatMap((feature, index) => {
        if (feature.geometry.type !== "Point") return [];
        if (feature.properties.kind === "pops_arcade" ? !overlays.cover : !overlays.streetWork) return [];
        const [x, y] = point(feature.geometry.coordinates);
        return [<g key={`cover-context-${index}`} className={String(feature.properties.kind)} transform={`translate(${x} ${y})`}><rect x="-10" y="-10" width="20" height="20" rx="5" /><CoverContextGlyph kind={feature.properties.kind} /><title>{String(feature.properties.label)}</title></g>];
      })}</g>}
      {!showActivity && overlays.access && <g className="fallback-access-context" aria-label="Access records, incomplete">{visibleAccess.map((feature) => {
        const [x, y] = point(feature.geometry.coordinates as Coordinate);
        return <circle key={feature.properties.id} className={feature.properties.kind} cx={x} cy={y} r={feature.properties.kind === "ramp_survey" ? 4 : 7}><title>{feature.properties.label} · record only, not an accessible-route guarantee</title></circle>;
      })}</g>}
      {!showActivity && overlays.cooling && <g className="fallback-cool-options" aria-label="NYC cool options">{visibleCoolOptions.map((feature) => {
        const [x, y] = point(feature.geometry.coordinates as Coordinate);
        return <circle key={feature.properties.id} className={feature.properties.kind} cx={x} cy={y} r={feature.properties.kind === "cooling_center" ? 8 : 6}><title>{feature.properties.label} · verify activation and hours</title></circle>;
      })}</g>}
      {!showActivity && selection && lens === "shade" && overlays.shade && <g className="fallback-selection">{selection.features.map((feature, index) => <polyline key={`${String(feature.properties.edgeId)}-${index}`} points={points(feature.geometry.coordinates)} />)}</g>}
      {!showActivity && baseline && <polyline className="fallback-baseline" points={points(baseline.coordinates)} />}
      {!showActivity && comparisonDelta && <g className="fallback-route-delta">{comparisonDelta.features.map((feature, index) => <polyline key={`${String(feature.properties.routeRole)}-${index}`} className={String(feature.properties.routeRole)} points={points(feature.geometry.coordinates)} />)}</g>}
      {!showActivity && representativeRoutes && <g className="fallback-representative-routes">{representativeRoutes.features.map((feature, index) => <polyline key={`${String(feature.properties.role)}-${index}`} className={String(feature.properties.role)} points={points(feature.geometry.coordinates)} />)}</g>}
      {showActivity && <g className="fallback-route-activity" aria-label="Locally mapped routes">{activity.map((item) => {
        const selected = item.id === selectedActivityRouteId;
        const hasAttention = item.feedback.some((feedback) => feedback.sentiment === "needs_attention");
        const midpoint = point(item.coordinates[Math.floor((item.coordinates.length - 1) / 2)]);
        return <g key={item.id} className={`${selected ? "selected" : ""} ${hasAttention ? "needs-attention" : ""}`} role="button" tabIndex={0} aria-label={`${item.originLabel} to ${item.destinationLabel}`} onClick={() => onActivityRouteClick?.(item.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onActivityRouteClick?.(item.id); }}>
          <polyline className="activity-casing" points={points(item.coordinates)} />
          <polyline className="activity-line" points={points(item.coordinates)} />
          {item.feedback.length > 0 && <circle className="activity-note" cx={midpoint[0]} cy={midpoint[1]} r={selected ? 11 : 8}><title>{item.feedback.length} route {item.feedback.length === 1 ? "note" : "notes"}</title></circle>}
        </g>;
      })}</g>}
      {!showActivity && route && <g className="fallback-route" filter="url(#route-shadow)"><polyline className="route-casing" points={points(route.coordinates)} /><polyline className="route-line" points={points(route.coordinates)} /></g>}

      {!showActivity && !route && setupEndpoints && <g className="fallback-setup-endpoints" aria-label="Selected route endpoints">{setupEndpoints.features.map((feature) => {
        const kind = feature.properties.kind;
        const [x, y] = point(feature.geometry.coordinates);
        const label = kind === "origin" ? "F" : "T";
        return <g key={kind} className={`fallback-setup-endpoint fallback-setup-endpoint-${kind} ${feature.properties.active ? "is-active" : ""}`} transform={`translate(${x} ${y})`} aria-label={kind === "origin" ? "From marker" : "To marker"}>
          <path className="fallback-setup-pin-shape" d="M0 0C-5-7-13-14-13-24a13 13 0 1 1 26 0C13-14 5-7 0 0Z" />
          <circle cx="0" cy="-24" r="7" />
          <text x="0" y="-21.5" textAnchor="middle">{label}</text>
        </g>;
      })}</g>}

      {!showActivity && <g className="fallback-assets">{visibleAssets.map((asset) => {
        const [x, y] = point(asset.coordinate as Coordinate);
        const isProminent = prominent.has(asset.id);
        const isSelected = asset.id === selectedAssetId;
        return <g key={asset.id} className={`fallback-asset asset-${asset.kind} ${isProminent ? "prominent" : ""} ${isSelected ? "selected" : ""}`} transform={`translate(${x} ${y})`} role="button" tabIndex={0} aria-label={asset.name} onClick={(event) => { event.stopPropagation(); if (onMapClick) onMapClick(asset.coordinate as Coordinate); else onAssetClick(asset); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onAssetClick(asset); }}>
          <circle r={prominent.has(asset.id) ? 14 : 10} />
          <AssetGlyph kind={asset.kind} />
          <title>{asset.name}</title>
        </g>;
      })}</g>}
      {!showActivity && civicTaskLayerVisible(overlays.tasks, selectedTaskId) && <g className="fallback-tasks">{tasks.map((task) => {
        const [x, y] = point(task.coordinate as Coordinate);
        const selected = task.id === selectedTaskId;
        const completed = completedTasks.has(task.id);
        return <g key={task.id} className={`${selected ? "selected" : ""} ${completed ? "completed" : ""}`} transform={`translate(${x} ${y})`} role="button" tabIndex={0} aria-label={task.title} onClick={(event) => { event.stopPropagation(); if (onMapClick) onMapClick(task.coordinate as Coordinate); else onTaskClick(task); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onTaskClick(task); }}>
          {selected && <><circle className="task-focus-ring" r="27" /><text className="task-focus-label" y="-33" textAnchor="middle">Open check</text></>}
          <circle className="task-marker" r={selected ? 17 : 12} />
          <TaskGlyph action={task.action} />
          <title>{task.title}</title>
        </g>;
      })}</g>}
      {!showActivity && route && <g className="fallback-endpoints"><circle cx={point(route.coordinates[0])[0]} cy={point(route.coordinates[0])[1]} r="9" />{route.journeyShape !== "loop" && <rect x={point(route.coordinates.at(-1)!)[0] - 8} y={point(route.coordinates.at(-1)!)[1] - 8} width="16" height="16" rx="3" />}</g>}
    </svg>
    <span className="fallback-map-note">Map preview mode · routes and city data still work</span>
  </div>;
}

function AssetGlyph({ kind }: { kind: CivicAsset["kind"] }) {
  if (kind === "seating") return <path d="M-6-1H6V3H-6ZM-4 3v5M4 3v5M-5-4v3M5-4v3" />;
  if (kind === "restroom") return <><circle cx="-3" cy="-4" r="1.5" /><circle cx="3" cy="-4" r="1.5" /><path d="M-5 6v-6c0-2 4-2 4 0v6M1 6l1-6c.3-2 2-2 2.3 0L5 6" /></>;
  if (kind === "transit") return <path d="M-6-6H6V6H-6ZM-3 3V-3l3 4 3-4v6" />;
  return <path d="M0-7C4-2 5 0 5 3a5 5 0 0 1-10 0c0-3 1-5 5-10Z" />;
}

function CoverContextGlyph({ kind }: { kind: string }) {
  if (kind === "pops_arcade") return <path d="M-6 6V-6H6V6M-3 6V0a3 3 0 0 1 6 0v6M-6-3H6" />;
  return <path d="M-7-3H7L5-7H-5ZM-5-3V7M5-3V7M-7 1H7" />;
}

function TaskGlyph({ action }: { action: CivicTask["action"] }) {
  if (action === "photo") return <><path d="M-6-3h3l1.5-2h3L3-3h3V5H-6Z" /><circle cx="0" cy="1" r="2.4" /></>;
  if (action === "observe") return <><path d="M-7 0s2.7-4 7-4 7 4 7 4-2.7 4-7 4-7-4-7-4Z" /><circle cx="0" cy="0" r="1.8" /></>;
  return <path d="m-5 0 3.2 3.2L5-4" />;
}

function stableNumber(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) | 0;
  return Math.abs(hash);
}
