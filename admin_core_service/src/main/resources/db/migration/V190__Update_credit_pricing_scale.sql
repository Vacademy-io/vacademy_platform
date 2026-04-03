-- Update credit pricing to $1 = 100 credits scale (50% markup over AI costs)
-- All base_cost, token_rate, minimum_charge scaled down 10x from original values

INSERT INTO credit_pricing (request_type, base_cost, token_rate, minimum_charge, unit_type, description, is_active)
VALUES
    ('content',    0.05, 0.00001,  0.05, 'tokens',     'Content generation (token-based)', TRUE),
    ('agent',      0.05, 0.00001,  0.05, 'tokens',     'AI Agent interactions', TRUE),
    ('copilot',    0.05, 0.00001,  0.05, 'tokens',     'Instructor/Student copilot', TRUE),
    ('analytics',  0.05, 0.00001,  0.05, 'tokens',     'Student analytics', TRUE),
    ('outline',    0.05, 0.00001,  0.05, 'tokens',     'Course outline generation', TRUE),
    ('evaluation', 0.10, 0.000015, 0.10, 'tokens',     'Answer evaluation', TRUE),
    ('embedding',  0.01, 0.000002, 0.01, 'tokens',     'Text embeddings', TRUE),
    ('image',      0.30, 0,        0.30, 'none',       'Image generation (flat rate)', TRUE),
    ('video',      0.05, 0.00001,  0.05, 'tokens',     'Video generation (token-based per stage)', TRUE),
    ('tts',        0.02, 0.00001,  0.02, 'characters', 'Text-to-Speech', TRUE)
ON CONFLICT (request_type)
DO UPDATE SET base_cost = EXCLUDED.base_cost,
             token_rate = EXCLUDED.token_rate,
             minimum_charge = EXCLUDED.minimum_charge,
             unit_type = EXCLUDED.unit_type,
             description = EXCLUDED.description;
