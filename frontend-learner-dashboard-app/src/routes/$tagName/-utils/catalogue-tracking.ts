import { useEffect } from "react";

/**
 * Tracking for institute catalogue sites — GA4 / Meta Pixel / GTM, configured
 * per-site in the page builder (Global Settings → Tracking & Analytics,
 * stored as globalSettings.tracking in the catalogue JSON).
 *
 * WHY THIS EXISTS: these sites had zero measurement — no pixel, no analytics,
 * no conversion events — so an institute buying Meta/Google ads could neither
 * optimise campaigns on enquiries nor answer "did the website work?". Scripts
 * inject only on catalogue routes (this hook lives in the two catalogue page
 * shells), never on the learner LMS surface.
 *
 * Every capture surface dispatches `vacademy:lead-captured` on success; this
 * hook forwards it as a GA4 `generate_lead` and a Meta `Lead` event.
 */

export interface TrackingSettings {
  ga4MeasurementId?: string;
  metaPixelId?: string;
  gtmId?: string;
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean };
    _fbq?: unknown;
  }
}

const once = (id: string): boolean => {
  if (document.getElementById(id)) return false;
  return true;
};

const injectGa4 = (measurementId: string) => {
  if (!once("vac-ga4")) return;
  const s = document.createElement("script");
  s.id = "vac-ga4";
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  // gtag must push `arguments` (an Arguments object), not a spread array —
  // GA's snippet contract.
  // eslint-disable-next-line prefer-rest-params
  window.gtag = function gtag() { window.dataLayer!.push(arguments); } as never;
  window.gtag("js", new Date());
  window.gtag("config", measurementId);
};

const injectGtm = (gtmId: string) => {
  if (!once("vac-gtm")) return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
  const s = document.createElement("script");
  s.id = "vac-gtm";
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtmId)}`;
  document.head.appendChild(s);
};

const injectMetaPixel = (pixelId: string) => {
  if (!once("vac-fbq")) return;
  const marker = document.createElement("meta");
  marker.id = "vac-fbq";
  document.head.appendChild(marker);
  // Standard Meta base code, minus the IIFE wrapper.
  const f = window as Window;
  if (!f.fbq) {
    const n: Window["fbq"] = function (...args: unknown[]) {
      (n as { callMethod?: (...a: unknown[]) => void }).callMethod
        ? (n as unknown as { callMethod: (...a: unknown[]) => void }).callMethod(...args)
        : n!.queue!.push(args);
    } as never;
    n!.queue = [];
    n!.loaded = true;
    f.fbq = n;
    f._fbq = n;
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(s);
  }
  f.fbq!("init", pixelId);
  f.fbq!("track", "PageView");
};

export interface LeadCapturedDetail {
  audienceId?: string;
  sourceType?: string;
  sourceId?: string;
}

/** Fired by every capture surface after a successful submission. */
export const emitLeadCaptured = (detail: LeadCapturedDetail) => {
  try {
    window.dispatchEvent(new CustomEvent("vacademy:lead-captured", { detail }));
  } catch {
    /* never let telemetry break a submission */
  }
};

export const useCatalogueTracking = (tracking?: TrackingSettings | null) => {
  const ga4 = tracking?.ga4MeasurementId?.trim();
  const pixel = tracking?.metaPixelId?.trim();
  const gtm = tracking?.gtmId?.trim();

  useEffect(() => {
    if (ga4) injectGa4(ga4);
    if (gtm) injectGtm(gtm);
    if (pixel) injectMetaPixel(pixel);
  }, [ga4, pixel, gtm]);

  useEffect(() => {
    if (!ga4 && !pixel && !gtm) return;
    const onLead = (e: Event) => {
      const d = (e as CustomEvent<LeadCapturedDetail>).detail || {};
      try {
        window.gtag?.("event", "generate_lead", {
          source_type: d.sourceType,
          source_id: d.sourceId,
          audience_id: d.audienceId,
        });
        window.fbq?.("track", "Lead", { content_name: d.sourceId });
        window.dataLayer?.push({ event: "lead_submitted", ...d });
      } catch {
        /* telemetry only */
      }
    };
    window.addEventListener("vacademy:lead-captured", onLead);
    return () => window.removeEventListener("vacademy:lead-captured", onLead);
  }, [ga4, pixel, gtm]);
};

/**
 * First-touch UTM capture. Stored on landing so the attribution survives
 * navigation to the page that actually holds the form.
 */
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
const UTM_STORE = "vac_utm_first_touch";

export const captureUtmOnce = (): void => {
  try {
    if (sessionStorage.getItem(UTM_STORE)) return;
    const params = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};
    for (const k of UTM_KEYS) {
      const v = params.get(k);
      if (v) utm[k] = v.slice(0, 120);
    }
    if (Object.keys(utm).length > 0) sessionStorage.setItem(UTM_STORE, JSON.stringify(utm));
  } catch {
    /* storage unavailable — attribution is best-effort */
  }
};

export const getStoredUtm = (): Record<string, string> => {
  try {
    return JSON.parse(sessionStorage.getItem(UTM_STORE) || "{}");
  } catch {
    return {};
  }
};
