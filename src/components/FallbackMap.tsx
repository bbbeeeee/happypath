import type { CivicAsset } from "../data/civicAssets";
import type { CivicTask } from "../data/civicTasks";
import type { Coordinate, JourneyRoute, PilotGraph } from "../types";

type FallbackLens = "route" | "shade" | "cover" | "amenities" | "tasks";

interface LineFeature {
  properties: Record<string, unknown>;
  geometry: { type: "LineString"; coordinates: Coordinate[] };
}

interface LineCollection {
  features: LineFeature[];
}

export function FallbackMap({ graph, route, lens, shadeSegments, coverSegments, ambientCover, selection, assets, prominentAssetIds, selectedAssetId, onAssetClick, tasks, selectedTaskId, completedTaskIds, onTaskClick }: {
  graph: PilotGraph;
  route: JourneyRoute | null;
  lens: FallbackLens;
  shadeSegments: LineCollection;
  coverSegments: LineCollection;
  ambientCover: LineCollection;
  selection?: LineCollection | null;
  assets: readonly CivicAsset[];
  prominentAssetIds: readonly string[];
  selectedAssetId?: string | null;
  onAssetClick: (asset: CivicAsset) => void;
  tasks: readonly CivicTask[];
  selectedTaskId?: string | null;
  completedTaskIds: readonly string[];
  onTaskClick: (task: CivicTask) => void;
}) {
  const bbox = graph.metadata?.pilotBbox ?? [40.7, -74.03, 40.76, -73.97];
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
  const prominent = new Set(prominentAssetIds);
  const streetEdges = graph.edges
    .filter((edge, index) => edge.distanceMeters > 18 && index % 3 === 0)
    .slice(0, 1_100);
  const labels = [...graph.edges]
    .filter((edge) => edge.street && !/^unnamed/i.test(edge.street) && edge.distanceMeters > 80)
    .sort((a, b) => b.distanceMeters - a.distanceMeters)
    .filter((edge, index, candidates) => candidates.findIndex((candidate) => candidate.street === edge.street) === index)
    .slice(0, 11);
  const visibleAssets = assets
    .filter((asset) => asset.id === selectedAssetId || prominent.has(asset.id) || stableNumber(asset.id) % (lens === "amenities" ? 2 : 6) === 0)
    .slice(0, lens === "amenities" ? 60 : 26);
  const completedTasks = new Set(completedTaskIds);

  return <div className="fallback-map" aria-label="Street map preview">
    <svg viewBox={`${viewX} 0 ${viewWidth} ${height}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label="Happy Path route and neighborhood amenities">
      <defs>
        <pattern id="fallback-grid" width="70" height="70" patternUnits="userSpaceOnUse"><path d="M70 0H0V70" fill="none" stroke="#dcded9" strokeWidth="1" /></pattern>
        <filter id="route-shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#344038" floodOpacity=".22" /></filter>
      </defs>
      <rect x={viewX} width={viewWidth} height={height} fill="#f2f1ed" />
      <rect x={viewX} width={viewWidth} height={height} fill="url(#fallback-grid)" opacity=".48" />
      <g className="fallback-parks" aria-hidden="true"><ellipse cx="1050" cy="110" rx="180" ry="120" /><ellipse cx="380" cy="670" rx="120" ry="80" /><ellipse cx="720" cy="350" rx="85" ry="58" /></g>
      <g className="fallback-streets" aria-hidden="true">{streetEdges.map((edge) => <polyline key={edge.id} points={points(edge.geometry ?? [graph.nodes.find((node) => node.id === edge.from)!.coordinate, graph.nodes.find((node) => node.id === edge.to)!.coordinate])} />)}</g>
      <g className="fallback-labels" aria-hidden="true">{labels.map((edge) => {
        const geometry = edge.geometry ?? [];
        const center = geometry.length ? geometry[Math.floor(geometry.length / 2)] : graph.nodes.find((node) => node.id === edge.from)!.coordinate;
        const [x, y] = point(center);
        return <text key={edge.id} x={x} y={y}>{edge.street}</text>;
      })}</g>

      {lens === "shade" && <g className="fallback-evidence-lines shade-lines">{shadeSegments.features.map((feature, index) => <polyline key={`${String(feature.properties.edgeId)}-${index}`} className={String(feature.properties.shadeBand)} points={points(feature.geometry.coordinates)}><title>{String(feature.properties.label)}</title></polyline>)}</g>}
      {lens === "cover" && <g className="ambient-cover-lines">{ambientCover.features.map((feature, index) => <polyline key={`${String(feature.properties.edgeId)}-${index}`} className={Number(feature.properties.coverShare) >= .7 ? "more" : "some"} points={points(feature.geometry.coordinates)}><title>{String(feature.properties.label)}</title></polyline>)}</g>}
      {lens === "cover" && <g className="fallback-evidence-lines cover-lines">{coverSegments.features.map((feature, index) => <polyline key={`${String(feature.properties.edgeId)}-${index}`} className={String(feature.properties.coverBand)} points={points(feature.geometry.coordinates)}><title>{String(feature.properties.label)}</title></polyline>)}</g>}
      {route && lens !== "shade" && lens !== "cover" && <g className="fallback-route" filter="url(#route-shadow)"><polyline className="route-casing" points={points(route.coordinates)} /><polyline className="route-line" points={points(route.coordinates)} /></g>}
      {selection && <g className="fallback-selection">{selection.features.map((feature, index) => <polyline key={`${String(feature.properties.edgeId)}-${index}`} points={points(feature.geometry.coordinates)} />)}</g>}

      <g className="fallback-assets">{visibleAssets.map((asset) => {
        const [x, y] = point(asset.coordinate as Coordinate);
        const isProminent = prominent.has(asset.id);
        const isSelected = asset.id === selectedAssetId;
        return <g key={asset.id} className={`fallback-asset asset-${asset.kind} ${isProminent ? "prominent" : ""} ${isSelected ? "selected" : ""}`} transform={`translate(${x} ${y})`} role="button" tabIndex={0} aria-label={asset.name} onClick={() => onAssetClick(asset)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onAssetClick(asset); }}>
          <circle r={prominent.has(asset.id) ? 14 : 10} />
          <AssetGlyph kind={asset.kind} />
          <title>{asset.name}</title>
        </g>;
      })}</g>
      <g className="fallback-tasks">{tasks.map((task) => {
        const [x, y] = point(task.coordinate as Coordinate);
        const selected = task.id === selectedTaskId;
        const completed = completedTasks.has(task.id);
        return <g key={task.id} className={`${selected ? "selected" : ""} ${completed ? "completed" : ""}`} transform={`translate(${x} ${y})`} role="button" tabIndex={0} aria-label={task.title} onClick={() => onTaskClick(task)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onTaskClick(task); }}>
          <circle r={selected ? 15 : 12} />
          <path d="m-5 0 3.2 3.2L5-4" />
          <title>{task.title}</title>
        </g>;
      })}</g>
      {route && <g className="fallback-endpoints"><circle cx={point(route.coordinates[0])[0]} cy={point(route.coordinates[0])[1]} r="9" />{route.journeyShape !== "loop" && <rect x={point(route.coordinates.at(-1)!)[0] - 8} y={point(route.coordinates.at(-1)!)[1] - 8} width="16" height="16" rx="3" />}</g>}
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

function stableNumber(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) | 0;
  return Math.abs(hash);
}
