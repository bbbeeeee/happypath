import { useState, useCallback, useEffect, useRef } from "react";
import {
  Building2,
  Globe,
  LocateFixed,
  Map as MapIcon,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { IsometricMap } from "./components/IsometricMap";
import {
  StreetMap,
  type MapLocation,
  type StreetViewState,
} from "./components/StreetMap";
import { ControlPanel } from "./components/ControlPanel";
import { TileInfo } from "./components/TileInfo";
import { CityStatus } from "./components/CityStatus";
import { CityOS } from "./components/CityOS";
import { defaultShaderParams } from "./shaders/water";
import { tilesBaseUrl, exportDir, showDebugUI } from "./config";

interface TileConfig {
  gridWidth: number;
  gridHeight: number;
  originalWidth: number;
  originalHeight: number;
  tileSize: number;
  maxZoomLevel: number;
  // Origin offset: (0,0) corresponds to database (originX, originY)
  // Used to translate between tile coords and generation database coords
  originX: number;
  originY: number;
  // DZI source (preferred - native OpenSeadragon support)
  dziUrl?: string;
  // Legacy file-based tiles
  tileUrlPattern?: string;
  // Default view position and zoom from generation config
  appDefaults?: {
    x: number;
    y: number;
    zoom: number;
  };
}

// DZI metadata sidecar format (tiles_metadata.json)
interface DziMetadata {
  gridWidth: number;
  gridHeight: number;
  originX: number;
  originY: number;
  tileSize: number;
  maxZoom: number;
  imageWidth: number;
  imageHeight: number;
  format: string;
  appDefaults?: {
    x: number;
    y: number;
    zoom: number;
  };
}

// Legacy manifest format (for backward compatibility)
interface TileManifest {
  gridWidth: number;
  gridHeight: number;
  originalWidth?: number;
  originalHeight?: number;
  tileSize: number;
  totalTiles: number;
  maxZoomLevel: number;
  generated: string;
  urlPattern: string;
}

export interface ViewState {
  target: [number, number, number];
  zoom: number;
}

const VIEW_STATE_STORAGE_KEY = "isometric-nyc-view-state";

// Zoom constraints (log2 scale: 0 = 1:1 pixels, positive = zoom in, negative = zoom out)
// Example: -2 = 0.25x (zoomed out), 0 = 1x, 2 = 4x (zoomed in)
const MIN_ZOOM = 6.6; // Most zoomed out (shows large area)
const DEFAULT_ZOOM = 11.03;
const MAP_MODE_STORAGE_KEY = "happy-path-map-mode";
const STREET_VIEW_STORAGE_KEY = "happy-path-street-view";
const DEFAULT_STREET_VIEW: StreetViewState = {
  latitude: 40.7128,
  longitude: -74.006,
  zoom: 15,
};

type MapMode = "isometric" | "street";

function loadMapMode(): MapMode {
  const requestedMode = new URLSearchParams(window.location.search).get("mode");
  if (requestedMode === "2d" || requestedMode === "street") return "street";
  if (requestedMode === "iso" || requestedMode === "isometric") return "isometric";
  return localStorage.getItem(MAP_MODE_STORAGE_KEY) === "street"
    ? "street"
    : "isometric";
}

function loadStreetView(): StreetViewState {
  try {
    const saved = localStorage.getItem(STREET_VIEW_STORAGE_KEY);
    if (!saved) return DEFAULT_STREET_VIEW;
    const parsed = JSON.parse(saved) as Partial<StreetViewState>;
    if (
      typeof parsed.latitude === "number" &&
      typeof parsed.longitude === "number" &&
      typeof parsed.zoom === "number"
    ) {
      return {
        latitude: parsed.latitude,
        longitude: parsed.longitude,
        zoom: parsed.zoom,
      };
    }
  } catch {
    // Ignore a malformed saved view and return to the NYC default.
  }
  return DEFAULT_STREET_VIEW;
}

// Calculate max zoom for 1:1 pixel ratio (no upscaling beyond native resolution)
// At zoom Z, the OSD zoom = (windowWidth / totalWidth) * 2^Z
// For 1:1 pixel ratio, we need osdZoom = totalWidth / windowWidth
// (each image pixel = 1 screen pixel, so visible width = window width in image pixels)
// Solving: totalWidth/windowWidth = (windowWidth/totalWidth) * 2^Z
// => (totalWidth/windowWidth)^2 = 2^Z
// => Z = 2 * log2(totalWidth / windowWidth)
function calculateMaxZoomFor1to1(totalWidth: number): number {
  // Use innerWidth since that's what the zoom conversion uses
  return 2 * Math.log2(totalWidth / window.innerWidth);
}

// Check for reset query parameter
function checkForReset(): boolean {
  const params = new URLSearchParams(window.location.search);
  if (params.get("reset") === "1") {
    localStorage.removeItem(VIEW_STATE_STORAGE_KEY);
    // Clean URL without reload
    window.history.replaceState({}, "", window.location.pathname);
    return true;
  }
  return false;
}

// Load saved view state from localStorage
function loadSavedViewState(tileConfig?: TileConfig): ViewState | null {
  // Check for reset first
  if (checkForReset()) {
    return null;
  }

  try {
    const saved = localStorage.getItem(VIEW_STATE_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Validate the structure - target can be 2 or 3 elements
      if (
        Array.isArray(parsed.target) &&
        parsed.target.length >= 2 &&
        typeof parsed.zoom === "number"
      ) {
        // Normalize to 3-element target
        const target: [number, number, number] = [
          parsed.target[0],
          parsed.target[1],
          parsed.target[2] ?? 0,
        ];

        // Validate position is within reasonable bounds if we have config
        if (tileConfig) {
          const maxX = tileConfig.gridWidth * tileConfig.tileSize;
          const maxY = tileConfig.gridHeight * tileConfig.tileSize;
          if (
            target[0] < 0 ||
            target[0] > maxX ||
            target[1] < 0 ||
            target[1] > maxY
          ) {
            console.warn(
              "Saved view position out of bounds, resetting:",
              target,
            );
            localStorage.removeItem(VIEW_STATE_STORAGE_KEY);
            return null;
          }
        }

        return { target, zoom: parsed.zoom };
      }
    }
  } catch (e) {
    console.warn("Failed to load saved view state:", e);
  }
  return null;
}

// Save view state to localStorage (debounced to avoid excessive writes)
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
function saveViewState(viewState: ViewState): void {
  // Debounce saves to avoid excessive localStorage writes during panning
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(() => {
    try {
      localStorage.setItem(VIEW_STATE_STORAGE_KEY, JSON.stringify(viewState));
    } catch (e) {
      console.warn("Failed to save view state:", e);
    }
  }, 500);
}

function App() {
  const [mapMode, setMapMode] = useState<MapMode>(loadMapMode);
  const [streetViewState, setStreetViewState] =
    useState<StreetViewState>(loadStreetView);
  const [userLocation, setUserLocation] = useState<MapLocation | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [tileConfig, setTileConfig] = useState<TileConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Dynamic max zoom based on window size and image dimensions (1:1 pixel ratio)
  const [maxZoom, setMaxZoom] = useState<number | null>(null);
  // Debounced zoom logging
  const zoomLogTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logZoom = useCallback((zoom: number) => {
    if (zoomLogTimeoutRef.current) {
      clearTimeout(zoomLogTimeoutRef.current);
    }
    zoomLogTimeoutRef.current = setTimeout(() => {
      console.log(`Zoom level: ${zoom}`);
    }, 200);
  }, []);

  // Load the large isometric-map configuration only when that mode is opened.
  // The 2D navigation view can now paint immediately without waiting on R2.
  // Priority: DZI (native OSD) > Legacy manifest
  useEffect(() => {
    if (mapMode !== "isometric" || tileConfig) return;

    const controller = new AbortController();
    let cancelled = false;
    setLoading(true);
    setError(null);

    // Construct URLs based on export directory
    // Structure: {baseUrl}/{exportDir}/tiles.dzi, {baseUrl}/{exportDir}/metadata.json
    const exportBase = tilesBaseUrl ? `${tilesBaseUrl}/${exportDir}` : exportDir;
    const dziUrl = `${exportBase}/tiles.dzi`;

    // Try to fetch DZI metadata (tiles_metadata.json for R2, metadata.json for local)
    const fetchMetadata = async (): Promise<DziMetadata> => {
      const tryFetch = async (url: string): Promise<DziMetadata | null> => {
        try {
          const response = await fetch(url, { signal: controller.signal });
          if (!response.ok) return null;
          // Check content-type to avoid parsing HTML as JSON (Vite SPA fallback)
          const contentType = response.headers.get("content-type");
          if (!contentType?.includes("application/json")) return null;
          return response.json();
        } catch {
          return null;
        }
      };

      // Try tiles_metadata.json first (R2 naming)
      const r2Meta = await tryFetch(`${exportBase}/tiles_metadata.json`);
      if (r2Meta) return r2Meta;

      // Fall back to metadata.json (local naming)
      const localMeta = await tryFetch(`${exportBase}/metadata.json`);
      if (localMeta) return localMeta;

      throw new Error("DZI metadata not found");
    };

    // Try DZI first (preferred - native OpenSeadragon support)
    console.log(`Loading DZI from export directory: ${exportDir}`);
    console.log("Checking for DZI at:", dziUrl);
    fetchMetadata()
      .then((meta) => {
        if (cancelled) return;
        console.log("Loaded DZI metadata:", meta);

        setTileConfig({
          gridWidth: meta.gridWidth,
          gridHeight: meta.gridHeight,
          originalWidth: meta.gridWidth,
          originalHeight: meta.gridHeight,
          tileSize: meta.tileSize ?? 512,
          maxZoomLevel: meta.maxZoom ?? 4,
          originX: meta.originX ?? 0,
          originY: meta.originY ?? 0,
          dziUrl: dziUrl,
          appDefaults: meta.appDefaults,
        });
        setLoading(false);
      })
      .catch((dziErr) => {
        console.log("DZI not available, falling back to legacy manifest:", dziErr);

        // Fall back to legacy manifest.json (uses exportBase)
        fetch(`${exportBase}/tiles/manifest.json`)
          .then((res) => {
            if (!res.ok)
              throw new Error(`Failed to load manifest: ${res.status}`);
            return res.json() as Promise<TileManifest>;
          })
          .then((manifest) => {
            if (cancelled) return;
            setTileConfig({
              gridWidth: manifest.gridWidth,
              gridHeight: manifest.gridHeight,
              originalWidth: manifest.originalWidth ?? manifest.gridWidth,
              originalHeight: manifest.originalHeight ?? manifest.gridHeight,
              tileSize: manifest.tileSize,
              tileUrlPattern: `${exportBase}/tiles/{z}/{x}_{y}.png`,
              maxZoomLevel: manifest.maxZoomLevel ?? 0,
              originX: 0,
              originY: 0,
            });
            setLoading(false);
          })
          .catch((err) => {
            if (cancelled || err instanceof DOMException && err.name === "AbortError") {
              return;
            }
            console.error("Failed to load tile manifest:", err);
            setError(err.message);
            setLoading(false);
          });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [mapMode, tileConfig]);

  const [viewState, setViewState] = useState<ViewState | null>(null);
  const [showMinimap, setShowMinimap] = useState(true);
  const [showCityOS, setShowCityOS] = useState(false);

  useEffect(() => {
    localStorage.setItem(MAP_MODE_STORAGE_KEY, mapMode);
  }, [mapMode]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      localStorage.setItem(
        STREET_VIEW_STORAGE_KEY,
        JSON.stringify(streetViewState),
      );
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [streetViewState]);

  // Calculate max zoom for 1:1 pixel ratio when tileConfig is available
  // and update on window resize
  useEffect(() => {
    if (mapMode !== "isometric" || !tileConfig) return;

    const totalWidth = tileConfig.gridWidth * tileConfig.tileSize;

    const updateMaxZoom = () => {
      const newMaxZoom = calculateMaxZoomFor1to1(totalWidth);
      setMaxZoom(newMaxZoom);
      console.log(
        `Max zoom updated for 1:1 pixel ratio: ${newMaxZoom.toFixed(2)} (window: ${window.innerWidth}x${window.innerHeight}, image: ${totalWidth}px)`,
      );
    };

    // Initial calculation
    updateMaxZoom();

    // Update on resize
    window.addEventListener("resize", updateMaxZoom);
    return () => window.removeEventListener("resize", updateMaxZoom);
  }, [mapMode, tileConfig]);

  // Clamp zoom when maxZoom decreases (e.g., window resize to smaller size)
  useEffect(() => {
    if (viewState && maxZoom !== null && viewState.zoom > maxZoom) {
      console.log(
        `Clamping zoom from ${viewState.zoom.toFixed(2)} to ${maxZoom.toFixed(2)} due to window resize`,
      );
      const clampedViewState = { ...viewState, zoom: maxZoom };
      setViewState(clampedViewState);
      saveViewState(clampedViewState);
    }
  }, [maxZoom, viewState]);

  // Initialize view state once tile config is loaded
  // Try to restore from localStorage, otherwise center on the content area
  useEffect(() => {
    if (tileConfig && maxZoom !== null && !viewState) {
      // Try to load saved view state first (pass tileConfig for bounds validation)
      const savedViewState = loadSavedViewState(tileConfig);
      if (savedViewState) {
        // Clamp saved zoom to current max (in case window is smaller than when saved)
        const clampedZoom = Math.min(savedViewState.zoom, maxZoom);
        console.log(
          `View init: restoring saved position (${savedViewState.target[0]}, ${savedViewState.target[1]}), zoom=${clampedZoom} (saved: ${savedViewState.zoom}, max: ${maxZoom.toFixed(2)})`,
        );
        setViewState({ ...savedViewState, zoom: clampedZoom });
        return;
      }

      // Fall back to default starting position (from metadata or hardcoded fallback)
      const defaultX = tileConfig.appDefaults?.x ?? 46192;
      const defaultY = tileConfig.appDefaults?.y ?? 67469;
      const defaultZoom = tileConfig.appDefaults?.zoom ?? DEFAULT_ZOOM;

      console.log(
        `View init: using default position (${defaultX}, ${defaultY}), zoom=${defaultZoom.toFixed(2)}`,
      );

      setViewState({
        target: [defaultX, defaultY, 0],
        zoom: defaultZoom,
      });
    }
  }, [tileConfig, maxZoom, viewState]);

  // Light direction for future use (currently unused)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_lightDirection, _setLightDirection] = useState<
    [number, number, number]
  >([0.5, 0.5, 1.0]);
  const [hoveredTile, setHoveredTile] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [waterShader, setWaterShader] = useState({
    // Disable water shader in production - it requires individual tile files
    enabled: showDebugUI,
    showMask: false,
    params: defaultShaderParams,
  });

  const handleViewStateChange = useCallback(
    (params: { viewState: ViewState }) => {
      // Clamp zoom to max (1:1 pixel ratio)
      const clampedViewState =
        maxZoom !== null && params.viewState.zoom > maxZoom
          ? { ...params.viewState, zoom: maxZoom }
          : params.viewState;
      setViewState(clampedViewState);
      saveViewState(clampedViewState);
      logZoom(clampedViewState.zoom);
    },
    [maxZoom, logZoom],
  );

  const handleZoomIn = useCallback(() => {
    if (mapMode === "street") {
      setStreetViewState((current) => ({
        ...current,
        zoom: Math.min(19, current.zoom + 1),
      }));
      return;
    }
    if (!viewState || maxZoom === null) return;
    const newZoom = Math.min(maxZoom, viewState.zoom * 1.05);
    const newViewState = { ...viewState, zoom: newZoom };
    setViewState(newViewState);
    saveViewState(newViewState);
    logZoom(newZoom);
  }, [mapMode, viewState, maxZoom, logZoom]);

  const handleZoomOut = useCallback(() => {
    if (mapMode === "street") {
      setStreetViewState((current) => ({
        ...current,
        zoom: Math.max(2, current.zoom - 1),
      }));
      return;
    }
    if (!viewState) return;
    const newZoom = Math.max(MIN_ZOOM, viewState.zoom / 1.05);
    const newViewState = { ...viewState, zoom: newZoom };
    setViewState(newViewState);
    saveViewState(newViewState);
    logZoom(newZoom);
  }, [mapMode, viewState, logZoom]);

  const handleStreetViewStateChange = useCallback((nextView: StreetViewState) => {
    setStreetViewState(nextView);
  }, []);

  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("Location services are not available in this browser.");
      return;
    }

    setIsLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setUserLocation(location);
        setStreetViewState((current) => ({
          ...location,
          zoom: Math.max(current.zoom, 16),
        }));
        setIsLocating(false);
      },
      (geolocationError) => {
        setLocationError(
          geolocationError.code === geolocationError.PERMISSION_DENIED
            ? "Location permission was denied. You can still pan the 2D map manually."
            : "Your current location could not be determined.",
        );
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  const handleTileHover = useCallback(
    (tile: { x: number; y: number } | null) => {
      setHoveredTile(tile);
    },
    [],
  );

  // Loading state
  if (mapMode === "isometric" && loading) {
    return (
      <div className="app loading">
        <div className="loading-message">Loading tile manifest...</div>
      </div>
    );
  }

  // Error state
  if (mapMode === "isometric" && (error || !tileConfig)) {
    return (
      <div className="app error">
        <div className="error-message">
          Failed to load tiles: {error || "Unknown error"}
        </div>
      </div>
    );
  }

  // Wait for view state and max zoom to be initialized
  if (mapMode === "isometric" && (!viewState || maxZoom === null)) {
    return (
      <div className="app loading">
        <div className="loading-message">Initializing view...</div>
      </div>
    );
  }

  return (
    <div className="app">
      {mapMode === "isometric" ? (
        <IsometricMap
          tileConfig={tileConfig!}
          viewState={viewState!}
          onViewStateChange={handleViewStateChange}
          lightDirection={_lightDirection}
          onTileHover={handleTileHover}
          waterShader={waterShader}
          showMinimap={showMinimap}
        />
      ) : (
        <StreetMap
          viewState={streetViewState}
          onViewStateChange={handleStreetViewStateChange}
          userLocation={userLocation}
        />
      )}

      <header className="header">
        <h1>New York City</h1>
        <CityStatus />
        <div className="header-actions">
          <div className="map-mode-switch" role="group" aria-label="Map view">
            <button
              className={mapMode === "isometric" ? "active" : ""}
              onClick={() => setMapMode("isometric")}
              title="Isometric city view"
              aria-pressed={mapMode === "isometric"}
            >
              <Building2 size={12} />
              <span>ISO</span>
            </button>
            <button
              className={mapMode === "street" ? "active" : ""}
              onClick={() => setMapMode("street")}
              title="2D street map"
              aria-pressed={mapMode === "street"}
            >
              <MapIcon size={12} />
              <span>2D</span>
            </button>
          </div>
          <button
            className="icon-button"
            onClick={handleZoomIn}
            title="Zoom in"
            aria-label="Zoom in"
          >
            <ZoomIn size={14} />
          </button>
          <button
            className="icon-button"
            onClick={handleZoomOut}
            title="Zoom out"
            aria-label="Zoom out"
          >
            <ZoomOut size={14} />
          </button>
          {mapMode === "isometric" ? (
            <button
              className={`icon-button ${showMinimap ? "active" : ""}`}
              onClick={() => setShowMinimap(!showMinimap)}
              title={showMinimap ? "Hide minimap" : "Show minimap"}
              aria-label={showMinimap ? "Hide minimap" : "Show minimap"}
            >
              <Globe size={14} />
            </button>
          ) : (
            <button
              className={`icon-button ${isLocating ? "active" : ""}`}
              onClick={handleLocateMe}
              title="Center map on my location"
              aria-label="Center map on my location"
              disabled={isLocating}
            >
              <LocateFixed size={14} />
            </button>
          )}
          <button
            className={`icon-button ${showCityOS ? "active" : ""}`}
            onClick={() => setShowCityOS(!showCityOS)}
            title={showCityOS ? "Close City OS" : "Open City OS"}
            aria-label={showCityOS ? "Close City OS" : "Open City OS"}
          >
            <Sparkles size={14} />
          </button>
        </div>
      </header>

      {showCityOS && (
        <CityOS
          onClose={() => setShowCityOS(false)}
          location={mapMode === "street" ? streetViewState : undefined}
        />
      )}

      {locationError && (
        <div className="map-location-error" role="status">
          <span>{locationError}</span>
          <button onClick={() => setLocationError(null)}>Dismiss</button>
        </div>
      )}

      {showDebugUI && mapMode === "isometric" && (
        <ControlPanel
          waterShader={waterShader}
          onWaterShaderChange={setWaterShader}
        />
      )}

      {showDebugUI && mapMode === "isometric" && (
        <TileInfo
          hoveredTile={hoveredTile}
          viewState={viewState!}
          originX={tileConfig!.originX}
          originY={tileConfig!.originY}
        />
      )}
    </div>
  );
}

export default App;
