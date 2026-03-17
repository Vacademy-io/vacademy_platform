CREATE TABLE html_video_slide (
    id VARCHAR(255) NOT NULL PRIMARY KEY,
    ai_gen_video_id VARCHAR(255),
    url VARCHAR(255),
    video_length BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
