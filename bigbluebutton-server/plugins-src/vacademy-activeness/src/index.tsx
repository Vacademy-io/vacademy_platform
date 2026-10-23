/**
 * Vacademy activeness score — BBB HTML5 plugin entry.
 *
 * Loaded only for classes whose session has `activeness_score` on (admin_core
 * adds this manifest to the create call). It shows itself only to learners whose
 * join URL carries a signed token (`userdata-vacademy_activeness`): never to
 * moderators or guests, and never on phones/tablets.
 */
import * as React from "react";
import { useEffect, useRef } from "react";
import * as ReactDOM from "react-dom/client";
import { BbbPluginSdk, FloatingWindow, type PluginApi } from "bigbluebutton-html-plugin-sdk";
import { ActivenessController } from "./controller";
import { isDesktop } from "./camera";
import { Panel } from "./Panel";

interface MetadataResult {
  user_current: { userMetadata: { parameter: string; value: string }[] }[];
}

const METADATA_SUBSCRIPTION = `subscription VacademyActivenessMetadata {
  user_current {
    userMetadata {
      parameter
      value
    }
  }
}`;

const TOKEN_PARAM = "vacademy_activeness";
const URL_PARAM = "vacademy_activeness_url";
/** Panel position: bottom-left, clear of BBB's action bar. */
const PANEL_LEFT = 16;
const PANEL_BOTTOM_GAP = 340;

function ActivenessPlugin({ uuid, pluginName }: { uuid: string; pluginName: string }) {
  BbbPluginSdk.initialize(uuid);
  const pluginApi: PluginApi = BbbPluginSdk.getPluginApi(uuid, pluginName);

  const currentUser = pluginApi.useCurrentUser?.();
  const metadata = pluginApi.useCustomSubscription?.<MetadataResult>(METADATA_SUBSCRIPTION);
  const shouldUnmount = pluginApi.useShouldUnmountPlugin?.() ?? false;

  const params = metadata?.data?.user_current?.[0]?.userMetadata ?? [];
  const token = params.find((p) => p.parameter === TOKEN_PARAM)?.value ?? null;
  const reportUrl = params.find((p) => p.parameter === URL_PARAM)?.value ?? null;
  const role = currentUser?.data?.role;
  const eligible =
    !shouldUnmount && !!token && !!reportUrl && /^https:\/\//.test(reportUrl) && role === "VIEWER" && isDesktop();

  const controllerRef = useRef<ActivenessController | null>(null);

  useEffect(() => {
    if (!eligible || !token || !reportUrl) return undefined;
    const controller = new ActivenessController(token, reportUrl);
    controllerRef.current = controller;
    pluginApi.setFloatingWindows([
      new FloatingWindow({
        top: Math.max(72, window.innerHeight - PANEL_BOTTOM_GAP),
        left: PANEL_LEFT,
        movable: true,
        backgroundColor: "#ffffff",
        boxShadow: "0 8px 24px rgba(17,24,39,0.18)",
        dataTest: "vacademy-activeness",
        contentFunction: (element: HTMLElement) => {
          const root = ReactDOM.createRoot(element);
          root.render(<Panel controller={controller} />);
          return root;
        },
      }),
    ]);
    return () => {
      pluginApi.setFloatingWindows([]);
      controller.dispose();
      controllerRef.current = null;
    };
    // pluginApi is a stable per-uuid object; re-run only when eligibility or identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligible, token, reportUrl]);

  return null;
}

const uuid = document.currentScript?.getAttribute("uuid") || "root";
const pluginName = document.currentScript?.getAttribute("pluginName") || "VacademyActiveness";
let mount = document.getElementById(uuid);
if (!mount) {
  mount = document.createElement("div");
  mount.id = uuid;
  document.body.appendChild(mount);
}
ReactDOM.createRoot(mount).render(<ActivenessPlugin uuid={uuid} pluginName={pluginName} />);
