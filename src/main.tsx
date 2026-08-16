import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import "maplibre-gl/dist/maplibre-gl.css";
import "./styles.css";

const normalizedPath = window.location.pathname.replace(/\/+$/, "") || "/";
const isDataSourcesRoute = normalizedPath === "/datasources";
const Page = lazy(async () => isDataSourcesRoute
  ? { default: (await import("./DataSourcesPage")).DataSourcesPage }
  : { default: (await import("./App")).App });

document.body.classList.toggle("datasources-body", isDataSourcesRoute);
document.title = isDataSourcesRoute ? "Data sources — Happy Path" : "Happy Path";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><Suspense fallback={<div className="route-loading" aria-label="Loading" />}><Page /></Suspense></React.StrictMode>,
);
