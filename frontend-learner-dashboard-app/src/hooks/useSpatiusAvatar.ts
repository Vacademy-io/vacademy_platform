import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Premium teacher avatar rendered on the device by Spatius AvatarKit
 * (docs.spatius.ai). The lesson hands each spoken segment's audio to the
 * avatar instead of the speaker; AvatarKit plays it in sync with the face.
 * Loaded on demand so lessons without an avatar never download the SDK.
 */
export interface AvatarBoot {
  provider: "spatius";
  app_id: string;
  avatar_id: string;
  session_token: string;
}

type AvatarKit = typeof import("@spatius/avatarkit");
const TARGET_RATE = 16000;

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
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  /** Last non-fatal vendor error (websocket drop, playback hiccup); the avatar stays and reconnects. */
  const [warning, setWarning] = useState<string | null>(null);
  /** Audio unlocked inside a tap and the motion session started: the avatar can actually speak. */
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
    setActivated(false);
  }, []);

  /** Mount the avatar into `container` with the session from the server. Call once per lesson. */
  const mount = useCallback(async (boot: AvatarBoot, container: HTMLDivElement) => {
    try {
      const kit = kitRef.current ?? (await import("@spatius/avatarkit"));
      kitRef.current = kit;
      await kit.AvatarSDK.initialize(boot.app_id, {
        drivingServiceMode: kit.DrivingServiceMode.direct,
        // The SDK's default and what Spatius Studio renders with; "high" scales the
        // splat pass down and single-photo avatars visibly soften.
        renderQuality: kit.RenderQuality.ultra,
        audioFormat: { channelCount: 1, sampleRate: TARGET_RATE },
      });
      kit.AvatarSDK.setSessionToken(boot.session_token);
      const avatar = await kit.AvatarManager.shared.load(boot.avatar_id);
      const view = new kit.AvatarView(avatar, container);
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
    }
  }, []);

  /** Must run inside a user gesture (tap): unlocks audio and connects to the motion server. */
  const activate = useCallback(async () => {
    const view = viewRef.current;
    if (!view) return;
    try {
      const c = view.controller;
      await (view.initializeAudioContext?.() ?? c.initializeAudioContext?.());
      await (view.start?.() ?? c.start?.());
      connectedRef.current = true;
      setActivated(true);
      setWarning(null);
    } catch (e: unknown) {
      const code = String((e as { code?: string })?.code ?? "");
      console.warn("[tutor avatar] connect failed", code, e);
      if (FATAL_CODES.has(code)) setFailed(e instanceof Error ? e.message : "The teacher avatar could not connect");
      else setWarning(code || (e instanceof Error ? e.message : "connect failed"));
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

  return { ready, failed, warning, activated, mount, activate, speak, interrupt, dispose, retry };
}
