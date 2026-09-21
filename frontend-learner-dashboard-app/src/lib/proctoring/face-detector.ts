/**
 * On-device face counting for the BASIC proctoring tier.
 *
 * Three backends, tried cheapest first:
 *
 *  1. `native`    — the browser's Shape Detection `FaceDetector` (Chrome, Edge,
 *                   Android WebView). Zero download, hardware accelerated.
 *  2. `mediapipe` — MediaPipe Tasks Vision, loaded from the CDN only when this
 *                   runs, so the app bundle every other learner downloads is
 *                   untouched. ~3 MB of WASM + a 200 KB model, cached by the
 *                   browser after the first exam.
 *  3. `none`      — no detector could load (old Safari, offline CDN). Snapshots
 *                   still upload; a reviewer looks at them instead.
 *
 * Every backend answers the same question: how many faces are in this frame.
 * Nothing here identifies anyone — that is deliberately out of scope for a
 * tier whose whole cost is storage.
 */

export type FaceDetectorName = "native" | "mediapipe" | "none";

export interface FaceCounter {
  readonly name: FaceDetectorName;
  /** Faces in the current frame, or null if the frame could not be read. */
  count(video: HTMLVideoElement): Promise<number | null>;
  close(): void;
}

interface NativeDetectedFace {
  boundingBox: DOMRectReadOnly;
}
interface NativeFaceDetector {
  detect(source: HTMLVideoElement): Promise<NativeDetectedFace[]>;
}
type NativeFaceDetectorCtor = new (options?: {
  maxDetectedFaces?: number;
  fastMode?: boolean;
}) => NativeFaceDetector;

interface MediaPipeDetection {
  categories?: { score: number }[];
}
interface MediaPipeFaceDetector {
  detectForVideo(
    video: HTMLVideoElement,
    timestampMs: number
  ): { detections: MediaPipeDetection[] };
  close(): void;
}
interface MediaPipeVisionModule {
  FilesetResolver: {
    forVisionTasks(wasmPath: string): Promise<unknown>;
  };
  FaceDetector: {
    createFromOptions(
      vision: unknown,
      options: {
        baseOptions: { modelAssetPath: string; delegate?: "GPU" | "CPU" };
        runningMode: "VIDEO";
        minDetectionConfidence?: number;
      }
    ): Promise<MediaPipeFaceDetector>;
  };
}

const MEDIAPIPE_VERSION = "0.10.14";
const MEDIAPIPE_BUNDLE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/vision_bundle.mjs`;
const MEDIAPIPE_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const MEDIAPIPE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

const isFrameReady = (video: HTMLVideoElement) =>
  video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0;

const createNative = (): FaceCounter | null => {
  const Ctor = (window as unknown as { FaceDetector?: NativeFaceDetectorCtor })
    .FaceDetector;
  if (typeof Ctor !== "function") return null;
  let detector: NativeFaceDetector;
  try {
    detector = new Ctor({ maxDetectedFaces: 4, fastMode: true });
  } catch {
    return null;
  }
  return {
    name: "native",
    async count(video) {
      if (!isFrameReady(video)) return null;
      try {
        const faces = await detector.detect(video);
        return faces.length;
      } catch {
        return null;
      }
    },
    close() {
      // Nothing to release.
    },
  };
};

const createMediaPipe = async (): Promise<FaceCounter | null> => {
  try {
    const vision = (await import(
      /* @vite-ignore */ MEDIAPIPE_BUNDLE
    )) as MediaPipeVisionModule;
    const fileset = await vision.FilesetResolver.forVisionTasks(MEDIAPIPE_WASM);
    const detector = await vision.FaceDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MEDIAPIPE_MODEL, delegate: "CPU" },
      runningMode: "VIDEO",
      minDetectionConfidence: 0.5,
    });
    let lastTimestamp = 0;
    return {
      name: "mediapipe",
      async count(video) {
        if (!isFrameReady(video)) return null;
        try {
          // MediaPipe requires strictly increasing timestamps per video stream.
          const now = Math.max(performance.now(), lastTimestamp + 1);
          lastTimestamp = now;
          return detector.detectForVideo(video, now).detections.length;
        } catch {
          return null;
        }
      },
      close() {
        try {
          detector.close();
        } catch {
          // Already closed.
        }
      },
    };
  } catch (error) {
    console.warn("[proctoring] MediaPipe unavailable; snapshots only", error);
    return null;
  }
};

const none: FaceCounter = {
  name: "none",
  async count() {
    return null;
  },
  close() {
    // Nothing to release.
  },
};

/** Best available counter for this device. Never rejects. */
export const createFaceCounter = async (
  enabled: boolean
): Promise<FaceCounter> => {
  if (!enabled) return none;
  const native = createNative();
  if (native) return native;
  return (await createMediaPipe()) ?? none;
};
