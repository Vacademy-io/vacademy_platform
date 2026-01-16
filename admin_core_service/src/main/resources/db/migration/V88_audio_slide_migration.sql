-- Audio Slide Table Migration
-- Adds support for audio slide type

-- Create audio_slide table
CREATE TABLE IF NOT EXISTS audio_slide (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(255),
    description TEXT,
    audio_file_id VARCHAR(255),
    thumbnail_file_id VARCHAR(255),
    audio_length_in_millis BIGINT,
    published_audio_file_id VARCHAR(255),
    published_audio_length_in_millis BIGINT,
    source_type VARCHAR(50),
    external_url VARCHAR(500),
    transcript TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create audio_tracked table for learner tracking
CREATE TABLE IF NOT EXISTS audio_tracked (
    id VARCHAR(255) PRIMARY KEY,
    activity_id VARCHAR(255) REFERENCES activity_log(id),
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    playback_speed DOUBLE PRECISION,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audio_tracked_activity_id ON audio_tracked(activity_id);
CREATE INDEX IF NOT EXISTS idx_audio_slide_audio_file_id ON audio_slide(audio_file_id);

-- Add comments
COMMENT ON TABLE audio_slide IS 'Stores audio slide metadata';
COMMENT ON TABLE audio_tracked IS 'Tracks audio playback intervals for learner progress';
COMMENT ON COLUMN audio_slide.audio_file_id IS 'File ID of the audio stored in file service';
COMMENT ON COLUMN audio_slide.thumbnail_file_id IS 'Optional cover image file ID';
COMMENT ON COLUMN audio_slide.audio_length_in_millis IS 'Duration of audio in milliseconds';
COMMENT ON COLUMN audio_slide.transcript IS 'Text transcript of the audio content for accessibility';
COMMENT ON COLUMN audio_tracked.start_time IS 'Start time of audio segment listened (as timestamp from millis)';
COMMENT ON COLUMN audio_tracked.end_time IS 'End time of audio segment listened (as timestamp from millis)';
COMMENT ON COLUMN audio_tracked.playback_speed IS 'Playback speed used during this segment (e.g., 1.0, 1.5)';
