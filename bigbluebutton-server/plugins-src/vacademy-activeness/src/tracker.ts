/**
 * On-device attention signals, ported from the learner app's AI-tutor tracker
 * (frontend-learner-dashboard-app/src/lib/tutor/attention-tracker.ts), which is
 * proven on prod. MediaPipe Face Landmarker loads from the CDN only after the
 * learner turns the camera on; every frame stays in this browser tab.
 *
 *  - face:     is someone in front of the camera
 *  - facing:   is their head turned towards the screen
 *  - eyesOpen: are the eyes open (a long closure reads as dozing)
 *
 * Head direction is measured against the learner's own resting pose, so a
 * laptop camera mounted low or to the side does not read as "looking away".
 * The resting pose is re-learnt after the learner comes back from being away
 * (they may have moved the laptop or their chair).
 */
import type { Sample, Turn } from "./meter";

const MEDIAPIPE_VERSION = "0.10.14";
const BUNDLE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/vision_bundle.mjs`;
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

export interface FrameReading {
  sample: Sample;
  /** Mean luminance 0–255 of the frame (low = lens covered or a very dark room). */
  brightness: number;
}

export interface AttentionTracker {
  /** One reading of the current frame, or null when no frame could be read. */
  read(video: HTMLVideoElement): FrameReading | null;
  /** Forget the resting pose (the learner came back and may sit differently). */
  recalibrate(): void;
  close(): void;
}

interface Landmark {
  x: number;
  y: number;
}
interface FaceLandmarkerResult {
  faceLandmarks: Landmark[][];
  faceBlendshapes?: { categories: { categoryName: string; score: number }[] }[];
}
interface FaceLandmarker {
  detectForVideo(frame: HTMLCanvasElement, timestampMs: number): FaceLandmarkerResult;
  close(): void;
}
interface VisionModule {
  FilesetResolver: { forVisionTasks(wasmPath: string): Promise<unknown> };
  FaceLandmarker: {
    createFromOptions(
      vision: unknown,
      options: {
        baseOptions: { modelAssetPath: string; delegate?: "GPU" | "CPU" };
        runningMode: "VIDEO";
        numFaces: number;
        outputFaceBlendshapes: boolean;
        minFaceDetectionConfidence?: number;
        minTrackingConfidence?: number;
      }
    ): Promise<FaceLandmarker>;
  };
}

// Face mesh indices: nose tip, outer eye corners, chin.
const NOSE = 1;
const EYE_L = 33;
const EYE_R = 263;
const CHIN = 152;

const CALIBRATION_SAMPLES = 8;
const YAW_TOLERANCE = 0.32;
const PITCH_TOLERANCE = 0.16;
const BLINK_CLOSED = 0.55;
/** Consecutive closed readings before it is "eyes shut" rather than a blink (~3 s at 1 Hz). */
const CLOSED_SAMPLES = 3;

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
};

const headPose = (lm: Landmark[]): { yaw: number; pitch: number } | null => {
  const nose = lm[NOSE];
  const l = lm[EYE_L];
  const r = lm[EYE_R];
  const chin = lm[CHIN];
  if (!nose || !l || !r || !chin) return null;
  const midX = (l.x + r.x) / 2;
  const midY = (l.y + r.y) / 2;
  const eyeDist = Math.hypot(r.x - l.x, r.y - l.y);
  const faceHeight = chin.y - midY;
  if (eyeDist < 1e-4 || faceHeight < 1e-4) return null;
  return { yaw: (nose.x - midX) / eyeDist, pitch: (nose.y - midY) / faceHeight };
};

/**
 * Copy the current frame into a 2D canvas and read that. Handing the camera
 * <video> straight to MediaPipe returned no faces on macOS (a camera frame is a
 * GPU surface there) — the same finding as the proctoring and tutor code.
 */
const makeFrameReader = () => {
  let canvas: HTMLCanvasElement | null = null;
  let tiny: HTMLCanvasElement | null = null;
  return {
    frame(video: HTMLVideoElement): HTMLCanvasElement | null {
      if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) return null;
      canvas ??= document.createElement("canvas");
      if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
      if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas;
      } catch {
        return null;
      }
    },
    brightness(source: HTMLCanvasElement): number {
      tiny ??= Object.assign(document.createElement("canvas"), { width: 16, height: 12 });
      const ctx = tiny.getContext("2d", { willReadFrequently: true });
      if (!ctx) return 128;
      try {
        ctx.drawImage(source, 0, 0, 16, 12);
        const px = ctx.getImageData(0, 0, 16, 12).data;
        let sum = 0;
        for (let i = 0; i < px.length; i += 4) sum += 0.299 * px[i]! + 0.587 * px[i + 1]! + 0.114 * px[i + 2]!;
        return sum / (px.length / 4);
      } catch {
        return 128;
      }
    },
  };
};

export const createAttentionTracker = async (): Promise<AttentionTracker> => {
  const vision = (await import(/* webpackIgnore: true */ /* @vite-ignore */ BUNDLE)) as VisionModule;
  const fileset = await vision.FilesetResolver.forVisionTasks(WASM);
  // CPU: the GPU delegate returned nothing for camera frames on macOS, and GPU
  // drivers on budget Windows laptops are the least predictable part of the stack.
  const landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL, delegate: "CPU" },
    runningMode: "VIDEO",
    numFaces: 1,
    outputFaceBlendshapes: true,
    minFaceDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  const reader = makeFrameReader();
  let lastTimestamp = 0;
  let yaws: number[] = [];
  let pitches: number[] = [];
  let base: { yaw: number; pitch: number } | null = null;
  let closedRun = 0;

  return {
    read(video) {
      const frame = reader.frame(video);
      if (!frame) return null;
      const brightness = reader.brightness(frame);
      let result: FaceLandmarkerResult;
      try {
        // MediaPipe needs strictly increasing timestamps per stream.
        const now = Math.max(performance.now(), lastTimestamp + 1);
        lastTimestamp = now;
        result = landmarker.detectForVideo(frame, now);
      } catch {
        return null;
      }
      const lm = result.faceLandmarks?.[0];
      if (!lm) {
        closedRun = 0;
        return { sample: { face: false, facing: false, eyesOpen: false }, brightness };
      }
      const pose = headPose(lm);
      let turn: Turn | null = pose === null ? "side" : null;
      if (pose) {
        if (!base) {
          yaws.push(pose.yaw);
          pitches.push(pose.pitch);
          if (yaws.length >= CALIBRATION_SAMPLES) base = { yaw: median(yaws), pitch: median(pitches) };
          // Until calibrated, only an extreme turn counts as looking away.
          if (Math.abs(pose.yaw) >= 0.5) turn = "side";
        } else {
          const dPitch = pose.pitch - base.pitch;
          // Sideways first: a head turned to the side also shifts the pitch proxy.
          if (Math.abs(pose.yaw - base.yaw) >= YAW_TOLERANCE) turn = "side";
          else if (dPitch >= PITCH_TOLERANCE) turn = "down";
          else if (dPitch <= -PITCH_TOLERANCE) turn = "up";
        }
      }
      const shapes = result.faceBlendshapes?.[0]?.categories ?? [];
      const blink = (name: string) => shapes.find((c) => c.categoryName === name)?.score ?? 0;
      const closed = blink("eyeBlinkLeft") > BLINK_CLOSED && blink("eyeBlinkRight") > BLINK_CLOSED;
      closedRun = closed ? closedRun + 1 : 0;
      return {
        sample: { face: true, facing: turn === null, eyesOpen: closedRun < CLOSED_SAMPLES, turn },
        brightness,
      };
    },
    recalibrate() {
      base = null;
      yaws = [];
      pitches = [];
    },
    close() {
      try {
        landmarker.close();
      } catch {
        // Already closed.
      }
    },
  };
};
