import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// PWA register disabled - uncomment when PWA plugin is enabled
// import { registerSW } from "virtual:pwa-register";

import "../excalidraw-app/sentry";

import ExcalidrawApp from "./App";

window.__EXCALIDRAW_SHA__ = import.meta.env.VITE_APP_GIT_SHA;
const rootElement = document.getElementById("root")!;
const root = createRoot(rootElement);
// PWA register disabled - uncomment when PWA plugin is enabled
// registerSW();
root.render(
  <StrictMode>
    <ExcalidrawApp />
  </StrictMode>,
);
