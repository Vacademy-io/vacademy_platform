/**
 * Minimal typings for the subset of @spatius/avatarkit the tutor uses
 * (the package ships its own types once installed; this keeps type-checks
 * working in environments where node_modules predates the dependency).
 */
declare module "@spatius/avatarkit" {
  export enum DrivingServiceMode { direct = "direct", backend = "backend", rtc = "rtc" }
  export enum RenderQuality { standard = "standard", high = "high", ultra = "ultra" }
  export type ConversationState = "idle" | "playing" | "paused";
  export interface AvatarController {
    send(audio: ArrayBuffer | Uint8Array, end: boolean): string;
    interrupt(): void;
    setVolume(v: number): void;
    getVolume(): number;
    initializeAudioContext?(): Promise<void> | void;
    start?(): Promise<void> | void;
    onConnectionState?: ((state: string) => void) | null;
    onConversationState?: ((state: ConversationState) => void) | null;
    onAnimationState?: ((type: string) => void) | null;
    onError?: ((err: unknown) => void) | null;
  }
  export class AvatarView {
    constructor(avatar: unknown, container: HTMLElement);
    readonly controller: AvatarController;
    /** Fires once the first frame is drawn — the moment the face is really on screen. */
    onFirstRendering?: () => void;
    initializeAudioContext?(): Promise<void> | void;
    start?(): Promise<void> | void;
    dispose(): void;
  }
  export type LoadProgress = "downloading" | "completed" | "failed";
  export interface LoadProgressInfo {
    type: LoadProgress;
    /** 0..1 while downloading. */
    progress?: number;
    error?: Error;
  }
  export const AvatarManager: {
    shared: {
      load(avatarId: string, onProgress?: (info: LoadProgressInfo) => void, useCompressedModel?: boolean): Promise<unknown>;
    };
  };
  export const AvatarSDK: {
    initialize(appId: string, options?: {
      drivingServiceMode?: DrivingServiceMode;
      renderQuality?: RenderQuality;
      audioFormat?: { channelCount: number; sampleRate: number };
    }): Promise<void>;
    setSessionToken(token: string): void;
  };
}
