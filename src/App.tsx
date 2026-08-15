import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import { defaultDestination, defaultOrigin, isInsidePilot, nearestGraphNode, pilotGraph } from "./data/cityGraph";
import { searchNycAddress } from "./geocoding";
import { compareRoutes } from "./routing/route";
import { shadeMetadata } from "./routing/shade";
import { greeneryMetadata } from "./routing/greenery";
import type { Coordinate, RouteMode, RouteResult } from "./types";

const style = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const formatMinutes = (value: number) => `${Math.round(value)} min`;
const formatDistance = (value: number) => `${(value / 1000).toFixed(1)} km`;
const nodeById = new Map(pilotGraph.nodes.map((node) => [node.id, node]));
const shadowModules = import.meta.glob("./data/shadows/hour-*.json");

function routeGeoJSON(route: RouteResult) {
  return { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: route.coordinates } };
}

function endpointGeoJSON(origin: Coordinate, destination: Coordinate) {
  return {
    type: "FeatureCollection" as const,
    features: [
      { type: "Feature" as const, properties: { endpoint: "From" }, geometry: { type: "Point" as const, coordinates: origin } },
      { type: "Feature" as const, properties: { endpoint: "To" }, geometry: { type: "Point" as const, coordinates: destination } },
    ],
  };
}

interface AddressFieldProps {
  kind: "origin" | "destination";
  label: string;
  value: string;
  active: boolean;
  busy: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onPickMap: () => void;
  onActivate: () => void;
}

function AddressField({ kind, label, value, active, busy, onChange, onSubmit, onPickMap, onActivate }: AddressFieldProps) {
  return (
    <form className={`address-field ${active ? "active" : ""}`} onSubmit={(event: FormEvent) => { event.preventDefault(); onSubmit(); }}>
      <label htmlFor={`${kind}-address`}>{label}</label>
      <div className="address-row">
        <input id={`${kind}-address`} value={value} onFocus={onActivate} onClick={onActivate} onChange={(event) => onChange(event.target.value)} placeholder="Enter an NYC address" />
        <button type="submit" disabled={busy || !value.trim()}>{busy ? "…" : "Find"}</button>
      </div>
      <button className="map-pick" type="button" onClick={onPickMap}>{active ? "Click the map now" : `Set ${label.toLowerCase()} on map`}</button>
    </form>
  );
}

export function App() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const activeEndpointRef = useRef<"origin" | "destination">("destination");
  const [origin, setOrigin] = useState(defaultOrigin);
  const [destination, setDestination] = useState(defaultDestination);
  const [originText, setOriginText] = useState(nodeById.get(defaultOrigin)?.name ?? "Starting point");
  const [destinationText, setDestinationText] = useState(nodeById.get(defaultDestination)?.name ?? "Destination");
  const [activeEndpoint, setActiveEndpoint] = useState<"origin" | "destination">("destination");
  const [busyEndpoint, setBusyEndpoint] = useState<"origin" | "destination" | null>(null);
  const [locationError, setLocationError] = useState("");
  const [hour, setHour] = useState(15);
  const [routeMode, setRouteMode] = useState<RouteMode>("shade");
  const [avoidMappedSteps, setAvoidMappedSteps] = useState(false);
  const [showFastest, setShowFastest] = useState(true);
  const routeState = useMemo(() => {
    try {
      return { comparison: compareRoutes(pilotGraph, origin, destination, hour, 0.25, avoidMappedSteps, routeMode), error: "" };
    } catch {
      return { comparison: null, error: avoidMappedSteps ? "No connected route avoids every mapped step between these points." : "No connected walking route was found between these points." };
    }
  }, [origin, destination, hour, avoidMappedSteps, routeMode]);
  const comparison = routeState.comparison;

  function activate(kind: "origin" | "destination") {
    activeEndpointRef.current = kind;
    setActiveEndpoint(kind);
    setLocationError("");
  }

  function setEndpoint(kind: "origin" | "destination", coordinate: Coordinate, label: string) {
    if (!isInsidePilot(coordinate)) {
      setLocationError("That location is outside the current Lower Manhattan pilot area.");
      return;
    }
    const node = nearestGraphNode(coordinate);
    if (kind === "origin") { setOrigin(node.id); setOriginText(label); }
    else { setDestination(node.id); setDestinationText(label); }
    setLocationError("");
  }

  async function geocode(kind: "origin" | "destination") {
    const query = kind === "origin" ? originText : destinationText;
    setBusyEndpoint(kind);
    setLocationError("");
    try {
      const result = await searchNycAddress(query);
      if (!result) setLocationError("We couldn’t find that address.");
      else setEndpoint(kind, result.coordinate, result.label);
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : "Address search failed.");
    } finally { setBusyEndpoint(null); }
  }

  useEffect(() => {
    if (!mapContainer.current || mapRef.current || !comparison) return;
    const map = new maplibregl.Map({ container: mapContainer.current, style, center: [-73.9974, 40.7307], zoom: 14.2 });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    map.on("click", (event: MapMouseEvent) => {
      const coordinate: Coordinate = [event.lngLat.lng, event.lngLat.lat];
      const kind = activeEndpointRef.current;
      setEndpoint(kind, coordinate, `Dropped pin near ${nearestGraphNode(coordinate).name}`);
    });
    map.on("load", () => {
      map.addSource("fastest", { type: "geojson", data: routeGeoJSON(comparison.fastest) });
      map.addLayer({ id: "fastest", type: "line", source: "fastest", paint: { "line-color": "#6f766f", "line-width": 5, "line-dasharray": [1.5, 1.5], "line-opacity": 0.75 } });
      map.addSource("happy", { type: "geojson", data: routeGeoJSON(comparison.recommended) });
      map.addLayer({ id: "happy-outline", type: "line", source: "happy", paint: { "line-color": "#fffdf5", "line-width": 10 } });
      map.addLayer({ id: "happy", type: "line", source: "happy", paint: { "line-color": "#116149", "line-width": 6 } });
      map.addSource("building-shadows", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "building-shadows", type: "fill", source: "building-shadows", paint: { "fill-color": "#263b59", "fill-opacity": 0.16 } }, "fastest");
      map.addSource("endpoints", { type: "geojson", data: endpointGeoJSON(nodeById.get(origin)!.coordinate, nodeById.get(destination)!.coordinate) });
      map.addLayer({ id: "endpoints", type: "circle", source: "endpoints", paint: { "circle-radius": 8, "circle-color": ["match", ["get", "endpoint"], "From", "#fffdf7", "#116149"], "circle-stroke-color": "#116149", "circle-stroke-width": 3 } });
    });
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    if (!comparison) {
      map.setLayoutProperty("fastest", "visibility", "none");
      map.setLayoutProperty("happy", "visibility", "none");
      map.setLayoutProperty("happy-outline", "visibility", "none");
      return;
    }
    map.setLayoutProperty("happy", "visibility", "visible");
    map.setLayoutProperty("happy-outline", "visibility", "visible");
    (map.getSource("fastest") as GeoJSONSource | undefined)?.setData(routeGeoJSON(comparison.fastest));
    (map.getSource("happy") as GeoJSONSource | undefined)?.setData(routeGeoJSON(comparison.recommended));
    (map.getSource("endpoints") as GeoJSONSource | undefined)?.setData(endpointGeoJSON(nodeById.get(origin)!.coordinate, nodeById.get(destination)!.coordinate));
    map.setLayoutProperty("fastest", "visibility", showFastest ? "visible" : "none");
    map.setLayoutProperty("building-shadows", "visibility", routeMode === "shade" ? "visible" : "none");
  }, [comparison, origin, destination, showFastest, hour, routeMode]);

  useEffect(() => {
    if (routeMode !== "shade") return;
    let cancelled = false;
    const load = shadowModules[`./data/shadows/hour-${hour}.json`];
    load?.().then((module) => {
      if (!cancelled) (mapRef.current?.getSource("building-shadows") as GeoJSONSource | undefined)?.setData((module as { default: never }).default);
    });
    return () => { cancelled = true; };
  }, [hour, routeMode]);

  return (
    <main>
      <section className="panel">
        <header><span className="eyebrow">Manhattan pilot</span><h1>Happy Path</h1><p>Enter an address or choose a point directly on the map.</p></header>
        <div className="field-row">
          <AddressField kind="origin" label="From" value={originText} active={activeEndpoint === "origin"} busy={busyEndpoint === "origin"} onChange={setOriginText} onSubmit={() => geocode("origin")} onPickMap={() => activate("origin")} onActivate={() => activate("origin")} />
          <AddressField kind="destination" label="To" value={destinationText} active={activeEndpoint === "destination"} busy={busyEndpoint === "destination"} onChange={setDestinationText} onSubmit={() => geocode("destination")} onPickMap={() => activate("destination")} onActivate={() => activate("destination")} />
          {locationError && <p className="location-error" role="alert">{locationError}</p>}
        </div>
        <div className="mode-switch" aria-label="Route preference"><button className={routeMode === "shade" ? "selected" : ""} onClick={() => setRouteMode("shade")}>Shade</button><button className={routeMode === "green" ? "selected" : ""} onClick={() => setRouteMode("green")}>Greener</button></div>
        <label className="constraint-control"><input type="checkbox" checked={avoidMappedSteps} onChange={(event) => setAvoidMappedSteps(event.target.checked)} /><span><b>Avoid mapped steps</b><small>Hard exclusion where OpenStreetMap identifies steps</small></span></label>
        {routeMode === "shade" && <label className="time-control"><span><b>Departure · Aug 15</b><output>{hour.toString().padStart(2, "0")}:00</output></span><input type="range" min="7" max="19" value={hour} onChange={(event) => setHour(Number(event.target.value))} /><small>Projected building shadows update with departure time</small></label>}
        {comparison ? <article className="receipt">
          <div className="receipt-title"><span>Your Happy Path</span><strong>{formatMinutes(comparison.recommended.durationMinutes)}</strong></div>
          <div className="benefit"><strong>{routeMode === "shade" ? `${comparison.sunMinutesSaved.toFixed(1)} min` : `+${comparison.greeneryGainPoints.toFixed(0)} pts`}</strong><span>{routeMode === "shade" ? "less estimated direct sun" : "more mapped greenery than fastest"}</span></div>
          {routeMode === "shade" ? <dl><div><dt>Est. shade</dt><dd>{Math.round(comparison.recommended.shadePercent)}%</dd></div><div><dt>Longest exposed</dt><dd>{comparison.recommended.longestExposedMinutes.toFixed(1)} min</dd></div><div><dt>Extra time</dt><dd>+{comparison.extraMinutes.toFixed(1)} min</dd></div></dl> : <dl><div><dt>Greenery</dt><dd>{Math.round(comparison.recommended.greeneryPercent)}%</dd></div><div><dt>Nearby trees</dt><dd>{comparison.recommended.nearbyTreeCount}</dd></div><div><dt>Extra time</dt><dd>+{comparison.extraMinutes.toFixed(1)} min</dd></div></dl>}
          <div className="reason"><b>Why it fits</b><p>{routeMode === "shade" ? "Uses projected NYC building shadows and mapped pedestrian geometry while staying within 25% of the fastest route." : "Favors adjacency to official tree points and mapped park properties while staying within 25% of the fastest route."}</p>{routeMode === "green" && comparison.recommended.adjacentParkNames.length > 0 && <p>Near {comparison.recommended.adjacentParkNames.slice(0, 2).join(" and ")}</p>}{avoidMappedSteps && <p className="constraint-proof">✓ All {pilotGraph.metadata?.audit.mappedStairEdges} mapped-step edges were excluded from route search</p>}<small>{routeMode === "shade" ? `Derived from NYC BUILDING · ${shadeMetadata.solarMethod}` : `Derived from ${greeneryMetadata.treeCount} NYC Forestry Tree Points and mapped parks`} · Validation pending</small></div>
        </article> : <article className="receipt no-route" role="status"><span className="eyebrow">Route unavailable</span><h2>No route found</h2><p>{routeState.error}</p>{avoidMappedSteps && <button onClick={() => setAvoidMappedSteps(false)}>Allow mapped steps</button>}</article>}
        {comparison && <button className="compare" onClick={() => setShowFastest((value) => !value)}><span className="dash" />{showFastest ? "Hide" : "Show"} fastest route · {formatMinutes(comparison.fastest.durationMinutes)}</button>}
        <footer>Mapped-step avoidance is not an accessibility guarantee. Shade and Greener are derived estimates with validation pending.</footer>
      </section>
      <section className={`map-wrap picking-${activeEndpoint}`}><div className="map" ref={mapContainer} /><div className="map-hint">Click map to set <b>{activeEndpoint === "origin" ? "From" : "To"}</b></div><div className="legend"><span className="happy-line" /> Happy Path <span className="fast-line" /> Fastest</div></section>
    </main>
  );
}
