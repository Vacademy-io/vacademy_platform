export interface AIModel {
    model_id: string;
    name: string;
    provider: string;
    category: string;
    tier: 'free' | 'standard' | 'premium' | 'ultra';
    max_tokens: number | null;
    context_window: number | null;
    supports_streaming: boolean;
    supports_images: boolean;
    supports_function_calling: boolean;
    supports_json_mode: boolean;
    input_price_per_1m: string;
    output_price_per_1m: string;
    credit_multiplier: string;
    is_free: boolean;
    recommended_for: string[];
    quality_score: number;
    speed_score: number;
    is_active: boolean;
    is_default: boolean;
    is_default_free: boolean;
    description: string;
}

export interface AIModelsListResponse {
    models: AIModel[];
    total: number;
    free_count: number;
    paid_count: number;
}

export interface AIModelUseCaseResponse {
    use_case: string;
    default_model: AIModel;
    fallback_model: AIModel;
    free_tier_model: AIModel;
    recommended_models: AIModel[];
    all_compatible_models: AIModel[];
}
