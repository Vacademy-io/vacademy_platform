import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Premium teacher avatar rendered on the device by Spatius AvatarKit
 * (docs.spatius.ai). The lesson hands each spoken segment's audio to the
 * avatar instead of the speaker; AvatarKit plays it in sync with the face.
 *
 * Loading is the whole experience here, so it is staged for the eye:
 *  - the SDK (3 MB + a 1 MB wasm core) is prefetched at the tap that opens
 *    the lesson, a full round-trip before the page needs it;
 *  - SDK init runs while the session token is still in flight;
 *  - `progress` is the real asset download, `painted` the first frame —
 *    the card shows the teacher's photo until then and cross-fades.
 */
export interface AvatarBoot {
  provider: "spatius";
  app_id: string;
  avatar_id: string;
  /** The session token, or the request for it — init overlaps the wait. */
  session_token: string | Promise<string>;
}

type AvatarKit = typeof import("@spatius/avatarkit");
const TARGET_RATE = 16000;

let kitPromise: Promise<AvatarKit> | null = null;
/** Start downloading the SDK now (idempotent). Safe to call from any tap. */
export function preloadAvatarKit(): Promise<AvatarKit> {
  if (!kitPromise) {
    kitPromise = import("@spatius/avatarkit").catch((e) => {
      kitPromise = null; // a failed fetch is retried next time
      throw e;
    });
  }
  return kitPromise;
}
let initializedApp: string | null = null;

/** Decode any browser-playable audio (mp3 / wav) to mono 16 kHz PCM16 for the motion server. */
export async function toPcm16(ctx: AudioContext, data: ArrayBuffer): Promise<ArrayBuffer> {
  const decoded = await ctx.decodeAudioData(data.slice(0));
  const frames = Math.ceil(decoded.duration * TARGET_RATE);
  const offline = new OfflineAudioContext(1, frames, TARGET_RATE);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start(0);
  const mono = (await offline.startRendering()).getChannelData(0);
  const out = new Int16Array(mono.length);
  for (let i = 0; i < mono.length; i++) {
    const s = Math.max(-1, Math.min(1, mono[i] ?? 0));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out.buffer;
}

/** Errors after which the avatar cannot continue this lesson; everything else is transient. */
const FATAL_CODES = new Set([
  "appIDUnrecognized", "avatarIDUnrecognized", "insufficientBalance", "sessionTokenInvalid", "sessionTokenExpired",
  "failedToDownloadAvatarAssets", "failedToFetchAvatarMetadata", "unsupportedAvatarAsset", "invalidAvatarMetadata",
  "concurrentLimitExceeded",
]);

export function useSpatiusAvatar() {
  /** The view exists (assets downloaded). Not yet visible: see `painted`. */
  const [ready, setReady] = useState(false);
  /** The SDK drew its first frame: the face is on screen. */
  const [painted, setPainted] = useState(false);
  /** Asset download, 0..1, while loading; null when unknown. */
  const [progress, setProgress] = useState<number | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  /** Last non-fatal vendor error (websocket drop, playback hiccup); the avatar stays and reconnects. */
  const [warning, setWarning] = useState<string | null>(null);
  /** Audio unlocked and the motion session started: the avatar can actually speak. */
  const [activated, setActivated] = useState(false);
  const connectedRef = useRef(false);
  const bootRef = useRef<AvatarBoot | null>(null);
  const kitRef = useRef<AvatarKit | null>(null);
  const viewRef = useRef<InstanceType<AvatarKit["AvatarView"]> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const idleWaitersRef = useRef<Array<() => void>>([]);
  const playingRef = useRef(false);

  const dispose = useCallback(() => {
    try {
      viewRef.current?.dispose();
    } catch {
      /* already gone */
    }
    viewRef.current = null;
    connectedRef.current = false;
    setReady(false);
    setPainted(false);
    setProgress(null);
    setActivated(false);
  }, []);

  /** Mount the avatar into `container` with the session from the server. Call once per lesson. */
  const mount = useCallback(async (boot: AvatarBoot, container: HTMLDivElement) => {
    try {
      const kit = kitRef.current ?? (await preloadAvatarKit());
      kitRef.current = kit;
      // Init needs only the app id, so it overlaps the token round-trip.
      if (initializedApp !== boot.app_id) {
        await kit.AvatarSDK.initialize(boot.app_id, {
          drivingServiceMode: kit.DrivingServiceMode.direct,
          // The SDK's default and what Spatius Studio renders with; "high" scales the
          // splat pass down and single-photo avatars visibly soften.
          renderQuality: kit.RenderQuality.ultra,
          audioFormat: { channelCount: 1, sampleRate: TARGET_RATE },
        });
        initializedApp = boot.app_id;
      }
      kit.AvatarSDK.setSessionToken(await boot.session_token);
      setProgress(0);
      const avatar = await kit.AvatarManager.shared.load(boot.avatar_id, (info) => {
        if (typeof info.progress === "number") setProgress(Math.max(0, Math.min(1, info.progress)));
        if (info.type === "completed") setProgress(1);
      });
      const view = new kit.AvatarView(avatar, container);
      view.onFirstRendering = () => setPainted(true);
      containerRef.current = container;
      const c = view.controller;
      c.onConversationState = (state) => {
        if (state === "playing") playingRef.current = true;
        if (state === "idle" && playingRef.current) {
          playingRef.current = false;
          const waiters = idleWaitersRef.current;
          idleWaitersRef.current = [];
          waiters.forEach((w) => w());
        }
      };
      c.onError = (err) => {
        const code = String((err as { code?: string })?.code ?? "");
        const message = err instanceof Error ? err.message : "avatar error";
        console.warn("[tutor avatar]", code || "error", message);
        if (FATAL_CODES.has(code)) {
          setFailed(code ? `${message} (${code})` : message);
          return;
        }
        // Connection-level errors end the motion session; the next segment reconnects.
        if (code.startsWith("websocket") || code === "sessionTimeout" || code === "networkLayerNotAvailable" || code === "serverError") {
          connectedRef.current = false;
        }
        setWarning(code || message);
      };
      viewRef.current = view;
      bootRef.current = boot;
      connectedRef.current = false;
      setReady(true);
      setFailed(null);
      setWarning(null);
    } catch (e: unknown) {
      setFailed(e instanceof Error ? e.message : "The teacher avatar could not start");
      setReady(false);
      setProgress(null);
    }
  }, []);

  /**
   * Unlock audio and connect to the motion server. Works outside a tap when
   * the document already has user activation (the tap that opened the
   * lesson); returns false when the browser insists on a gesture first.
   */
  const activate = useCallback(async (): Promise<boolean> => {
    const view = viewRef.current;
    if (!view) return false;
    try {
      const c = view.controller;
      await (view.initializeAudioContext?.() ?? c.initializeAudioContext?.());
      await (view.start?.() ?? c.start?.());
      connectedRef.current = true;
      setActivated(true);
      setWarning(null);
      return true;
    } catch (e: unknown) {
      const code = String((e as { code?: string })?.code ?? "");
      console.warn("[tutor avatar] connect failed", code, e);
      if (FATAL_CODES.has(code)) setFailed(e instanceof Error ? e.message : "The teacher avatar could not connect");
      else if (code !== "audioContextNotInitialized") setWarning(code || (e instanceof Error ? e.message : "connect failed"));
      return false;
    }
  }, []);

  /** Reconnect the motion session (after a drop or an idle timeout). */
  const reconnect = useCallback(async () => {
    const view = viewRef.current;
    if (!view || connectedRef.current) return;
    try {
      await (view.start?.() ?? view.controller.start?.());
      connectedRef.current = true;
      setWarning(null);
    } catch (e: unknown) {
      console.warn("[tutor avatar] reconnect failed", e);
    }
  }, []);

  /** Speak one segment through the avatar; resolves when its playback ends. */
  const speak = useCallback(async (audio: ArrayBuffer) => {
    const view = viewRef.current;
    if (!view) return;
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    if (!connectedRef.current) await reconnect();
    const pcm = await toPcm16(ctxRef.current, audio);
    const done = new Promise<void>((resolve) => {
      idleWaitersRef.current.push(resolve);
      // Never hang the lesson on a missing state event.
      window.setTimeout(resolve, Math.max(2000, (pcm.byteLength / (TARGET_RATE * 2)) * 1000 + 1500));
    });
    view.controller.send(pcm, true);
    await done;
  }, [reconnect]);

  const interrupt = useCallback(() => {
    try {
      viewRef.current?.controller.interrupt();
    } catch {
      /* not connected */
    }
    const waiters = idleWaitersRef.current;
    idleWaitersRef.current = [];
    waiters.forEach((w) => w());
    playingRef.current = false;
  }, []);

  /** Start over with a fresh session (after a fatal error). */
  const retry = useCallback(async (boot: AvatarBoot) => {
    const container = containerRef.current;
    if (!container) return;
    dispose();
    setFailed(null);
    await mount(boot, container);
    await activate();
  }, [dispose, mount, activate]);

  useEffect(() => () => dispose(), [dispose]);

  return { ready, painted, progress, failed, warning, activated, mount, activate, speak, interrupt, dispose, retry };
}
