import { useCallback, useEffect, useRef } from "react";
import OpenSeadragon from "openseadragon";
import { Compass, MousePointer2, Navigation, ScanSearch } from "lucide-react";
import { streetTilesUrl } from "../config";

const TILE_SIZE = 256;
const MIN_STREET_ZOOM = 2;
const MAX_STREET_ZOOM = 19;
const WORLD_SIZE = TILE_SIZE * 2 ** MAX_STREET_ZOOM;
const MAX_LATITUDE = 85.05112878;

export interface MapLocation {
  latitude: number;
  longitude: number;
}

export interface StreetViewState extends MapLocation {
  zoom: number;
}

interface StreetMapProps {
  viewState: StreetViewState;
  onViewStateChange: (viewState: StreetViewState) => void;
  userLocation?: MapLocation | null;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function longitudeToWorldX(longitude: number): number {
  return (longitude + 180) / 360;
}

function latitudeToWorldY(latitude: number): number {
  const safeLatitude = clamp(latitude, -MAX_LATITUDE, MAX_LATITUDE);
  const radians = (safeLatitude * Math.PI) / 180;
  return (1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2;
}

function worldXToLongitude(x: number): number {
  return x * 360 - 180;
}

function worldYToLatitude(y: number): number {
  return (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;
}

function tileUrl(level: number, x: number, y: number): string {
  const tileCount = 2 ** level;
  if (y < 0 || y >= tileCount) return "";

  // Longitude wraps around the earth; latitude stops at the Mercator limit.
  const wrappedX = ((x % tileCount) + tileCount) % tileCount;
  return streetTilesUrl
    .replace("{z}", String(level))
    .replace("{x}", String(wrappedX))
    .replace("{y}", String(y));
}

export function StreetMap({
  viewState,
  onViewStateChange,
  userLocation,
}: StreetMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<OpenSeadragon.Viewer | null>(null);
  const lastViewerState = useRef<StreetViewState | null>(null);
  const lastEmittedState = useRef<StreetViewState>(viewState);
  const isUpdatingFromProps = useRef(false);
  const positionValueRef = useRef<HTMLSpanElement>(null);
  const pendingPositionFrame = useRef<number | null>(null);

  const streetToOsd = useCallback((state: StreetViewState) => {
    const containerWidth = containerRef.current?.clientWidth || window.innerWidth;
    return {
      center: new OpenSeadragon.Point(
        longitudeToWorldX(state.longitude),
        latitudeToWorldY(state.latitude),
      ),
      zoom: (TILE_SIZE * 2 ** state.zoom) / containerWidth,
    };
  }, []);

  const osdToStreet = useCallback((viewer: OpenSeadragon.Viewer): StreetViewState => {
    const center = viewer.viewport.getCenter();
    const containerWidth = containerRef.current?.clientWidth || window.innerWidth;
    const zoom = Math.log2((viewer.viewport.getZoom() * containerWidth) / TILE_SIZE);

    return {
      latitude: worldYToLatitude(clamp(center.y, 0, 1)),
      longitude: worldXToLongitude(center.x),
      zoom: clamp(zoom, MIN_STREET_ZOOM, MAX_STREET_ZOOM),
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    const initialView = streetToOsd(viewState);
    const viewer = OpenSeadragon({
      element: containerRef.current,
      prefixUrl: "",
      showNavigationControl: false,
      showNavigator: false,
      crossOriginPolicy: "Anonymous",
      animationTime: 0.14,
      blendTime: 0,
      imageLoaderLimit: 6,
      maxImageCacheCount: 140,
      minZoomImageRatio: 0.1,
      maxZoomPixelRatio: 1,
      visibilityRatio: 0.65,
      constrainDuringPan: true,
      imageSmoothingEnabled: true,
      gestureSettingsMouse: {
        scrollToZoom: true,
        clickToZoom: false,
        dblClickToZoom: true,
        flickEnabled: true,
      },
      gestureSettingsTouch: {
        scrollToZoom: false,
        clickToZoom: false,
        dblClickToZoom: true,
        flickEnabled: true,
        pinchToZoom: true,
      },
      tileSources: {
        width: WORLD_SIZE,
        height: WORLD_SIZE,
        tileSize: TILE_SIZE,
        tileOverlap: 0,
        minLevel: 0,
        maxLevel: MAX_STREET_ZOOM,
        getTileUrl: tileUrl,
      },
    });

    viewer.addHandler("open", () => {
      viewer.viewport.zoomTo(initialView.zoom, undefined, true);
      viewer.viewport.panTo(initialView.center, true);
    });

    const readView = () => osdToStreet(viewer);

    const updatePositionReadout = (nextView: StreetViewState) => {
      lastViewerState.current = nextView;
      if (pendingPositionFrame.current !== null) return;

      pendingPositionFrame.current = window.requestAnimationFrame(() => {
        pendingPositionFrame.current = null;
        if (!positionValueRef.current || !lastViewerState.current) return;
        const current = lastViewerState.current;
        positionValueRef.current.textContent =
          `${current.latitude.toFixed(5)}, ${current.longitude.toFixed(5)} · ` +
          `z${current.zoom.toFixed(1)}`;
      });
    };

    const commitView = () => {
      const nextView = readView();
      updatePositionReadout(nextView);
      const previous = lastEmittedState.current;
      if (
        Math.abs(previous.latitude - nextView.latitude) < 0.000001 &&
        Math.abs(previous.longitude - nextView.longitude) < 0.000001 &&
        Math.abs(previous.zoom - nextView.zoom) < 0.001
      ) {
        return;
      }
      lastEmittedState.current = nextView;
      onViewStateChange(nextView);
    };

    // Keep the small coordinate readout current without rerendering the entire
    // React tree for every animation frame. Commit shared state when motion ends.
    viewer.addHandler("viewport-change", () => {
      if (isUpdatingFromProps.current) return;
      updatePositionReadout(readView());
    });
    viewer.addHandler("animation-finish", commitView);
    viewer.addHandler("canvas-release", commitView);

    viewerRef.current = viewer;
    return () => {
      if (pendingPositionFrame.current !== null) {
        window.cancelAnimationFrame(pendingPositionFrame.current);
      }
      viewer.destroy();
      viewerRef.current = null;
    };
  }, [onViewStateChange, osdToStreet, streetToOsd]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer?.viewport) return;

    const previous = lastViewerState.current;
    if (
      previous &&
      Math.abs(previous.latitude - viewState.latitude) < 0.000001 &&
      Math.abs(previous.longitude - viewState.longitude) < 0.000001 &&
      Math.abs(previous.zoom - viewState.zoom) < 0.001
    ) {
      return;
    }

    const nextView = streetToOsd(viewState);
    lastEmittedState.current = viewState;
    isUpdatingFromProps.current = true;
    viewer.viewport.zoomTo(nextView.zoom, undefined, false);
    viewer.viewport.panTo(nextView.center, false);
    isUpdatingFromProps.current = false;
  }, [streetToOsd, viewState]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !userLocation) return;

    const marker = document.createElement("div");
    marker.className = "street-map-user-location";
    marker.setAttribute("aria-label", "Your location");
    marker.title = "Your location";
    viewer.addOverlay({
      element: marker,
      location: new OpenSeadragon.Point(
        longitudeToWorldX(userLocation.longitude),
        latitudeToWorldY(userLocation.latitude),
      ),
      placement: OpenSeadragon.Placement.CENTER,
      checkResize: false,
    });

    return () => {
      viewer.removeOverlay(marker);
    };
  }, [userLocation]);

  return (
    <div className="map-container street-map">
      <div ref={containerRef} className="street-map-canvas" />

      <section className="street-map-hud" aria-label="Street navigation help">
        <div className="street-map-hud-title">
          <span className="street-map-hud-icon" aria-hidden="true">
            <Navigation size={14} />
          </span>
          <div>
            <strong>Street Navigator</strong>
            <span>
              <i aria-hidden="true" /> Live 2D map
            </span>
          </div>
        </div>
        <div className="street-map-hud-help">
          <span>
            <MousePointer2 size={11} aria-hidden="true" /> Drag to explore
          </span>
          <span>Scroll to zoom</span>
        </div>
      </section>

      <div className="street-map-compass" title="Map is north-up" aria-label="North">
        <Compass size={19} aria-hidden="true" />
        <span>N</span>
      </div>

      <div className="street-map-center" aria-hidden="true">
        <span className="street-map-pin"><i /></span>
        <span className="street-map-focus-label">
          <ScanSearch size={10} /> City OS focus
        </span>
      </div>
      <div className="street-map-position" aria-live="polite">
        <span className="street-map-position-icon" aria-hidden="true">
          <Navigation size={12} />
        </span>
        <div className="street-map-position-copy">
          <strong>Navigation center</strong>
          <span ref={positionValueRef}>
            {viewState.latitude.toFixed(5)}, {viewState.longitude.toFixed(5)} · z
            {viewState.zoom.toFixed(1)}
          </span>
        </div>
      </div>
      <div className="street-map-attribution">
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
        >
          © OpenStreetMap contributors
        </a>
        <span aria-hidden="true">·</span>
        <a
          href="https://carto.com/attribution"
          target="_blank"
          rel="noopener noreferrer"
        >
          © CARTO
        </a>
        <span aria-hidden="true">·</span>
        <a
          href="https://www.openstreetmap.org/fixthemap"
          target="_blank"
          rel="noopener noreferrer"
        >
          Report a map issue
        </a>
      </div>
    </div>
  );
}
