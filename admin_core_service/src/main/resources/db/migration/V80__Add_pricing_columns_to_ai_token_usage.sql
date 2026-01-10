-- Migration to add pricing columns to AI Token Usage table
-- Adds separate pricing for input and output tokens, plus total price

ALTER TABLE ai_token_usage
ADD COLUMN IF NOT EXISTS input_token_price NUMERIC(20, 10) NULL,
ADD COLUMN IF NOT EXISTS output_token_price NUMERIC(20, 10) NULL,
ADD COLUMN IF NOT EXISTS total_price NUMERIC(20, 10) NULL;

-- Comments for documentation
-- Note: prompt_tokens = input tokens, completion_tokens = output tokens
COMMENT ON COLUMN ai_token_usage.input_token_price IS 'Price per input token (applies to prompt_tokens) for this model';
COMMENT ON COLUMN ai_token_usage.output_token_price IS 'Price per output token (applies to completion_tokens) for this model';
COMMENT ON COLUMN ai_token_usage.total_price IS 'Total price: (input_token_price * prompt_tokens) + (output_token_price * completion_tokens)';

-- Index for efficient price queries
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_total_price 
    ON ai_token_usage(total_price) 
    WHERE total_price IS NOT NULL;

