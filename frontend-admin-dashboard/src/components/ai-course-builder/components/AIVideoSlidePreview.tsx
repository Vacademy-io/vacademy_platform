import React, { useState } from 'react';
import AIYouTubePlayer from './AIYouTubePlayer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Play, ExternalLink } from 'lucide-react';
import type { Slide as ManualSlide } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-hooks/use-slides';

interface AIVideoSlidePreviewProps {
    activeItem: ManualSlide;
    onSlideUpdate?: (updatedSlide: ManualSlide) => void;
}

export const AIVideoSlidePreview: React.FC<AIVideoSlidePreviewProps> = ({
    activeItem,
    onSlideUpdate,
}) => {
    const [videoUrl, setVideoUrl] = useState(
        activeItem.video_slide?.url || activeItem.video_slide?.published_url || ''
    );
    const [isEditing, setIsEditing] = useState(false);
    const [tempUrl, setTempUrl] = useState(videoUrl);

    const handleUrlUpdate = () => {
        const updatedSlide = {
            ...activeItem,
            video_slide: {
                ...activeItem.video_slide!,
                url: tempUrl,
                published_url: tempUrl,
            },
        };

        setVideoUrl(tempUrl);
        setIsEditing(false);

        if (onSlideUpdate) {
            onSlideUpdate(updatedSlide);
        }
    };

    const handleCancelEdit = () => {
        setTempUrl(videoUrl);
        setIsEditing(false);
    };

    const getVideoSourceType = () => {
        if (!videoUrl) return 'NONE';
        if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) return 'YOUTUBE';
        return 'FILE_ID';
    };

    const renderVideoControls = () => (
        <div className="video-controls">
            <div className="video-url-controls">
                {!isEditing ? (
                    <div className="url-display">
                        <span className="url-label">Video URL:</span>
                        <span className="url-value">{videoUrl || 'No URL set'}</span>
                        <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                            Edit URL
                        </Button>
                    </div>
                ) : (
                    <div className="url-edit">
                        <Input
                            value={tempUrl}
                            onChange={(e) => setTempUrl(e.target.value)}
                            placeholder="Enter YouTube URL or video file URL"
                            className="url-input"
                        />
                        <div className="url-buttons">
                            <Button size="sm" onClick={handleUrlUpdate}>
                                Save
                            </Button>
                            <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                                Cancel
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    const renderVideoPlayer = () => {
        const sourceType = getVideoSourceType();

        if (sourceType === 'NONE') {
            return (
                <div className="video-placeholder">
                    <div className="placeholder:text-content">
                        <Play className="placeholder:text-icon" size={48} />
                        <h3>No Video Set</h3>
                        <p>Click &quot;Edit URL&quot; to add a video URL</p>
                    </div>
                </div>
            );
        }

        if (sourceType === 'YOUTUBE') {
            return (
                <AIYouTubePlayer
                    key={`youtube-player-${activeItem.id}-${videoUrl}`}
                    videoUrl={videoUrl}
                />
            );
        }

        // For FILE_ID or other video types
        return (
            <div className="video-player">
                <video
                    key={`video-player-${activeItem.id}-${videoUrl}`}
                    controls
                    width="100%"
                    height="400"
                    controlsList="nodownload"
                    style={{ background: '#000' }}
                >
                    <source src={videoUrl} type="video/mp4" />
                    <source src={videoUrl} type="video/webm" />
                    <source src={videoUrl} type="video/ogg" />
                    Your browser does not support the video tag.
                </video>
            </div>
        );
    };

    return (
        <div className="ai-video-slide-preview">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span>Video Content</span>
                        <div className="video-meta">
                            <span className="video-type-badge">{getVideoSourceType()}</span>
                            {videoUrl && (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => window.open(videoUrl, '_blank')}
                                >
                                    <ExternalLink size={16} />
                                </Button>
                            )}
                        </div>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {renderVideoControls()}
                    <div className="video-content">{renderVideoPlayer()}</div>

                    {/* Video Info */}
                    <div className="video-info">
                        <div className="info-grid">
                            <div className="info-item">
                                <label>Title:</label>
                                <span>{activeItem.video_slide?.title || activeItem.title}</span>
                            </div>
                            <div className="info-item">
                                <label>Description:</label>
                                <span>
                                    {activeItem.video_slide?.description || 'No description'}
                                </span>
                            </div>
                            <div className="info-item">
                                <label>Source Type:</label>
                                <span>{activeItem.video_slide?.source_type || 'VIDEO'}</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default AIVideoSlidePreview;
