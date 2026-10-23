/**
 * Everything outside React: camera, face tracker, sampling loop, score and
 * reporting. The floating panel renders getState() and calls the actions.
 *
 * Protecting the class comes first. The loop samples about once a second, backs
 * off when the computer is slow, and switches itself off rather than starve
 * BBB's own audio/video on a budget laptop.
 */
import { ActivenessMeter, type Score } from "./meter";
import { CameraError, type CameraProblem, listCameras, openCamera, stopStream } from "./camera";
import { createAttentionTracker, type AttentionTracker } from "./tracker";
import { persistKey, sendReport, type ReportPayload } from "./report";

export type Phase = "ask" | "starting" | "on" | "off" | "problem";

export interface ViewState {
  phase: Phase;
  problem: CameraProblem | null;
  live: Score;
  session: Score;
  /** No face for a while, or the class tab was in the background. */
  away: boolean;
  /** The frame is nearly black: lens covered, shutter closed or a very dark room. */
  dark: boolean;
  collapsed: boolean;
  /** First-time model download is taking a while. */
  slowLoad: boolean;
  cameras: { id: string; label: string }[];
  cameraId: string | null;
}

const BASE_INTERVAL_MS = 1000;
const MAX_INTERVAL_MS = 3000;
/** A reading slower than this on average = the computer is struggling; turn off. */
const TOO_SLOW_MS = 600;
const SLOW_LOAD_MS = 15_000;
const LOAD_TIMEOUT_MS = 120_000;
/** No face this long = stepped away. */
const AWAY_AFTER_MS = 8000;
const BACK_AFTER_SAMPLES = 2;
/** Away at least this long = re-learn the resting pose on return. */
const RECALIBRATE_AFTER_MS = 30_000;
const DARK_BELOW = 14;
const DARK_AFTER_MS = 8000;
/** This many readings in a row without a frame = the camera stopped. */
const FRAMELESS_LIMIT = 15;
const REPORT_EVERY_MS = 60_000;
/** Nothing is reported before this much tracked time. */
const MIN_REPORT_MS = 10_000;
const CHOICE_KEY = "vacademy.activeness.choice";
const CAMERA_KEY = "vacademy.activeness.camera";
const RESUME_MAX_AGE_MS = 12 * 3600_000;

const EMPTY_SCORE: Score = { score: null, onScreen: null, attention: null };

/**
 * Timer, event and async entry points run through this. An exception that escapes
 * a plugin reaches the BBB client's global error handler, which can put a reload
 * screen in front of the class — a broken score must only ever switch itself off.
 */
const guard =
  <A extends unknown[]>(name: string, fn: (...args: A) => void, onError?: () => void) =>
  (...args: A) => {
    try {
      fn(...args);
    } catch (error) {
      console.warn(`[activeness] ${name} failed`, error);
      try {
        onError?.();
      } catch {
        // Nothing more to do.
      }
    }
  };

const storage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Private mode: lasts for this class only.
    }
  },
};

export class ActivenessController {
  private state: ViewState;
  private listeners = new Set<() => void>();
  private readonly meter: ActivenessMeter;
  private readonly video: HTMLVideoElement;
  private readonly parking: HTMLDivElement;
  private stream: MediaStream | null = null;
  private tracker: AttentionTracker | null = null;
  private timer: number | null = null;
  private generation = 0;
  private interval = BASE_INTERVAL_MS;
  private costEma = 0;
  private readings = 0;
  private lastTickAt = 0;
  private lastFaceAt = 0;
  private awaySince: number | null = null;
  private faceRun = 0;
  private darkSince: number | null = null;
  private frameless = 0;
  private hiddenAt: number | null = null;
  private lastReportAt = 0;
  private disposed = false;

  constructor(
    private readonly token: string,
    private readonly reportUrl: string
  ) {
    this.meter = new ActivenessMeter(this.loadResume());
    this.video = Object.assign(document.createElement("video"), { muted: true, playsInline: true, autoplay: true });
    this.video.setAttribute("muted", "");
    this.video.setAttribute("playsinline", "");
    Object.assign(this.video.style, {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      transform: "scaleX(-1)",
      display: "block",
    });
    // When the panel is not mounted the video waits here, still in the document so
    // the browser keeps decoding frames for the tracker.
    this.parking = document.createElement("div");
    Object.assign(this.parking.style, {
      position: "fixed",
      right: "0",
      bottom: "0",
      width: "2px",
      height: "2px",
      opacity: "0.01",
      overflow: "hidden",
      pointerEvents: "none",
    });
    this.parking.setAttribute("aria-hidden", "true");
    this.parking.appendChild(this.video);
    document.body.appendChild(this.parking);

    const choice = storage.get(CHOICE_KEY);
    this.state = {
      phase: choice === "off" ? "off" : "ask",
      problem: null,
      live: EMPTY_SCORE,
      session: this.meter.session(),
      away: false,
      dark: false,
      collapsed: choice === "off",
      slowLoad: false,
      cameras: [],
      cameraId: storage.get(CAMERA_KEY),
    };

    document.addEventListener("visibilitychange", this.onVisibility);
    window.addEventListener("pagehide", this.onPageHide);
    navigator.mediaDevices?.addEventListener?.("devicechange", this.onDeviceChange);

    // A learner who said yes before (this browser, this class host) starts straight away.
    if (choice === "on") void this.start();
  }

  // ── store ────────────────────────────────────────────────────────────────

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  getState = () => this.state;

  private set(patch: Partial<ViewState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => guard("render", fn)());
  }

  // ── actions ──────────────────────────────────────────────────────────────

  /** The learner turned the score on (or pressed Try again). */
  start = () => {
    this.startInner().catch((error) => {
      console.warn("[activeness] start failed", error);
      guard("fail", () => this.fail("unknown"))();
    });
  };

  private startInner = async () => {
    if (this.disposed) return;
    const gen = ++this.generation;
    storage.set(CHOICE_KEY, "on");
    this.releaseCamera();
    this.set({ phase: "starting", problem: null, slowLoad: false, collapsed: false });
    try {
      const stream = await openCamera(this.state.cameraId ?? undefined);
      if (gen !== this.generation) return stopStream(stream);
      this.stream = stream;
      this.video.srcObject = stream;
      void this.video.play().catch(() => undefined);
      stream.getVideoTracks().forEach((t) => t.addEventListener("ended", this.onTrackEnded));
      void this.refreshCameras().catch(() => undefined);

      if (!this.tracker) {
        const slow = window.setTimeout(() => gen === this.generation && this.set({ slowLoad: true }), SLOW_LOAD_MS);
        try {
          this.tracker = await Promise.race([
            createAttentionTracker(),
            new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("timeout")), LOAD_TIMEOUT_MS)),
          ]);
        } catch (error) {
          console.warn("[activeness] face model unavailable", error);
          if (gen === this.generation) this.fail("load");
          return;
        } finally {
          window.clearTimeout(slow);
        }
        if (gen !== this.generation) return;
      }

      this.costEma = 0;
      this.readings = 0;
      this.interval = BASE_INTERVAL_MS;
      this.frameless = 0;
      this.lastTickAt = Date.now();
      this.lastFaceAt = Date.now();
      this.set({ phase: "on", slowLoad: false, away: false, dark: false });
      this.schedule();
    } catch (error) {
      if (gen !== this.generation) return;
      this.fail(error instanceof CameraError ? error.problem : "unknown");
    }
  };

  /** The learner turned it off: report what we have, free the camera. */
  stop = () => {
    storage.set(CHOICE_KEY, "off");
    this.generation += 1;
    this.report(false);
    this.releaseCamera();
    this.set({ phase: "off", problem: null, away: false, dark: false, collapsed: true, live: EMPTY_SCORE });
  };

  setCollapsed = (collapsed: boolean) => this.set({ collapsed });

  switchCamera = (id: string) => {
    storage.set(CAMERA_KEY, id);
    this.set({ cameraId: id });
    if (this.state.phase === "on" || this.state.phase === "problem") void this.start();
  };

  /** The panel mounts the live preview here; null when it unmounts. */
  attachPreview = (container: HTMLElement | null) => {
    const target = container ?? this.parking;
    if (this.video.parentElement !== target) target.appendChild(this.video);
    if (this.stream) void this.video.play().catch(() => undefined);
  };

  /** The class ended or the plugin is being unloaded. */
  dispose = guard("dispose", () => {
    if (this.disposed) return;
    this.report(true);
    this.disposed = true;
    this.generation += 1;
    this.releaseCamera();
    this.tracker?.close();
    this.tracker = null;
    document.removeEventListener("visibilitychange", this.onVisibility);
    window.removeEventListener("pagehide", this.onPageHide);
    navigator.mediaDevices?.removeEventListener?.("devicechange", this.onDeviceChange);
    this.parking.remove();
    this.listeners.clear();
  });

  // ── loop ─────────────────────────────────────────────────────────────────

  private schedule() {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(this.tick, this.interval);
  }

  private tick = guard("tick", () => this.tickInner(), () => this.fail("unknown"));

  private tickInner() {
    this.timer = null;
    if (this.state.phase !== "on" || !this.tracker) return;
    const now = Date.now();
    const dt = Math.min(5000, Math.max(0, now - this.lastTickAt));
    this.lastTickAt = now;
    if (document.visibilityState === "hidden") return this.schedule();

    const t0 = performance.now();
    const reading = this.tracker.read(this.video);
    const cost = performance.now() - t0;

    if (!reading) {
      this.frameless += 1;
      if (this.frameless >= FRAMELESS_LIMIT) return this.fail("ended");
      return this.schedule();
    }
    this.frameless = 0;

    // Back off on slow machines; give up before the class itself suffers.
    this.readings += 1;
    this.costEma = this.readings === 1 ? cost : this.costEma * 0.8 + cost * 0.2;
    if (this.readings >= 10 && this.costEma > TOO_SLOW_MS) return this.fail("slow");
    this.interval = Math.min(MAX_INTERVAL_MS, Math.max(BASE_INTERVAL_MS, Math.round(this.costEma * 8)));

    const { sample, brightness } = reading;
    this.meter.addSample(now, sample, dt);

    let away = this.state.away;
    if (sample.face) {
      this.lastFaceAt = now;
      this.faceRun += 1;
      if (away && this.faceRun >= BACK_AFTER_SAMPLES) {
        away = false;
        if (this.awaySince !== null && now - this.awaySince >= RECALIBRATE_AFTER_MS) this.tracker.recalibrate();
        this.awaySince = null;
      }
    } else {
      this.faceRun = 0;
      if (!away && now - this.lastFaceAt > AWAY_AFTER_MS) {
        away = true;
        this.awaySince = now;
        this.meter.markAway();
      }
    }

    if (brightness < DARK_BELOW) this.darkSince ??= now;
    else this.darkSince = null;
    const dark = this.darkSince !== null && now - this.darkSince >= DARK_AFTER_MS;

    this.set({ live: this.meter.live(now), session: this.meter.session(), away, dark });
    if (now - this.lastReportAt >= REPORT_EVERY_MS) this.report(false);
    this.schedule();
  }

  private fail(problem: CameraProblem) {
    this.generation += 1;
    this.report(false);
    this.releaseCamera();
    this.set({ phase: "problem", problem, slowLoad: false, away: false, dark: false, collapsed: false });
  }

  private releaseCamera() {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
    this.stream?.getVideoTracks().forEach((t) => t.removeEventListener("ended", this.onTrackEnded));
    stopStream(this.stream);
    this.stream = null;
    this.video.srcObject = null;
  }

  private async refreshCameras() {
    const cams = await listCameras();
    const activeId = this.stream?.getVideoTracks()[0]?.getSettings().deviceId ?? this.state.cameraId;
    this.set({
      cameras: cams.map((c, i) => ({ id: c.deviceId, label: c.label || `Camera ${i + 1}` })),
      cameraId: activeId ?? null,
    });
  }

  // ── events ───────────────────────────────────────────────────────────────

  private onTrackEnded = guard("track-ended", () => {
    if (this.state.phase === "on") this.fail("ended");
  });

  private onDeviceChange = guard("devicechange", () => {
    if (this.stream) void this.refreshCameras().catch(() => undefined);
  });

  private onVisibility = guard("visibility", () => {
    if (this.state.phase !== "on") return;
    const now = Date.now();
    if (document.visibilityState === "hidden") {
      this.hiddenAt = now;
      if (!this.state.away) {
        this.meter.markAway();
        this.awaySince = now;
        this.set({ away: true });
      }
      // The last moment the browser reliably lets us send anything.
      this.report(false, true);
      return;
    }
    if (this.hiddenAt !== null) this.meter.addHidden(now, now - this.hiddenAt);
    this.hiddenAt = null;
    // Presence comes back with the next face on camera, not with the tab.
    this.lastTickAt = now;
    this.lastFaceAt = now;
    this.faceRun = 0;
    this.set({ session: this.meter.session(), live: this.meter.live(now) });
  });

  private onPageHide = guard("pagehide", () => this.report(true, true));

  // ── reporting ────────────────────────────────────────────────────────────

  private report(final: boolean, beacon = final) {
    if (this.disposed) return;
    const t = this.meter.totals;
    const s = this.meter.session();
    this.lastReportAt = Date.now();
    this.saveResume();
    if (s.score === null || t.trackedMs < MIN_REPORT_MS) return;
    const payload: ReportPayload = {
      token: this.token,
      avg: s.score,
      on_screen: s.onScreen,
      attention: s.attention,
      seconds: Math.round(t.trackedMs / 1000),
      away_count: t.awayCount,
      away_seconds: Math.round(t.awayMs / 1000),
      final,
    };
    sendReport(this.reportUrl, payload, beacon);
  }

  private loadResume(): unknown {
    const key = persistKey(this.token);
    if (!key) return undefined;
    try {
      const saved = JSON.parse(storage.get(key) ?? "null") as { at?: number; totals?: unknown } | null;
      if (!saved || typeof saved.at !== "number" || Date.now() - saved.at > RESUME_MAX_AGE_MS) return undefined;
      return saved.totals;
    } catch {
      return undefined;
    }
  }

  private saveResume() {
    const key = persistKey(this.token);
    if (key) storage.set(key, JSON.stringify({ at: Date.now(), totals: this.meter.totals }));
  }
}
