// ── Brand Kit ────────────────────────────────────────────────────────────────

export type BackgroundType = 'white' | 'black';

export interface BrandPalette {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
}

export interface IntroOutroConfig {
    enabled?: boolean;
    duration_seconds?: number;
    html?: string;
}

export type WatermarkPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface WatermarkConfig {
    enabled?: boolean;
    position?: WatermarkPosition;
    opacity?: number;
    html?: string;
    max_width?: number;
    max_height?: number;
    margin?: number;
}

export interface BrandKit {
    id: string;
    name: string;
    is_default: boolean;
    background_type: BackgroundType;
    palette: BrandPalette;
    heading_font?: string;
    body_font?: string;
    layout_theme?: string;
    logo_file_id?: string;
    intro: IntroOutroConfig;
    outro: IntroOutroConfig;
    watermark: WatermarkConfig;
    /**
     * Free-text director instructions auto-appended to the AI video generation
     * prompts (ShotPlanner / Director / NarrationWriter / per-shot HTML) for
     * every video made with this kit. Empty/undefined = no brand direction.
     */
    system_prompt?: string;
    created_at?: number;
    updated_at?: number;
}

export type BrandKitWritePayload = Partial<Omit<BrandKit, 'id' | 'created_at' | 'updated_at'>>;

// "Build kit from website" response — the backend returns a draft shaped like
// BrandKitWritePayload plus preview assets (rehosted on our S3) so the drawer
// can show what was pulled. Persistence is unchanged: the user reviews and the
// existing POST /brand-kits saves it.
export interface BrandKitScrapePreview {
    source_url: string;
    logo_url?: string;
    screenshot_url?: string;
}

export interface BrandKitScrapeResult {
    draft: BrandKitWritePayload;
    preview: BrandKitScrapePreview;
    warnings?: string[];
}

// ── Studio Avatar ────────────────────────────────────────────────────────────

export type AvatarProvider = 'custom' | 'argil' | 'veed';

export interface StudioAvatar {
    id: string;
    name: string;
    provider: AvatarProvider;
    /** Set only when provider != 'custom'. */
    external_avatar_id?: string;
    /** Set only when provider == 'custom'. */
    face_image_url?: string;
    /** FE thumbnail; null for built-ins until we self-host catalog frames. */
    preview_image_url?: string;
    description?: string;
    voice_id?: string;
    voice_provider?: string;
    voice_language?: string;
    voice_gender?: string;
    created_at?: number;
    updated_at?: number;
}

export type StudioAvatarWritePayload = Partial<
    Omit<StudioAvatar, 'id' | 'created_at' | 'updated_at'>
>;
