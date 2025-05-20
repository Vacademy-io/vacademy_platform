'use client';

import { useEffect, useRef, useState } from 'react';
import { Slide } from '../-hooks/use-slides';
import { useContentStore } from '../-stores/chapter-sidebar-store';
import { getPublicUrl } from '@/services/upload_file';
import YouTubePlayer from './youtube-player';
import { toast } from 'sonner';

const VideoSlidePreview = ({ activeItem }: { activeItem: Slide }) => {
    const { items } = useContentStore();
    const videoSourceType = activeItem.video_slide?.source_type;
    const videoStatus = activeItem.status;
    // const videoTitle = activeItem.video_slide?.title || 'Video';
    const videoRef = useRef<HTMLVideoElement>(null);

    const fileId =
        videoStatus === 'PUBLISHED'
            ? activeItem.video_slide?.published_url
            : activeItem.video_slide?.url;

    const [videoUrl, setVideoUrl] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isUrlExpired, setIsUrlExpired] = useState(false);

    const refreshS3Url = async () => {
        try {
            setIsLoading(true);
            const url = await getPublicUrl(fileId!);
            setVideoUrl(url);
            setIsUrlExpired(false);
        } catch (err) {
            console.error('Error refreshing video URL:', err);
            setError('Failed to refresh video URL');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const fetchVideoUrl = async () => {
            try {
                console.log('Fetching video URL for file ID:', fileId);
                if (videoSourceType === 'FILE_ID') {
                    const url = await getPublicUrl(fileId!);
                    setVideoUrl(url);

                    if (url.includes('X-Amz-Expires=')) {
                        const expiresParam = url.match(/X-Amz-Expires=(\d+)/)?.[1];
                        if (expiresParam) {
                            const expiresInSeconds = Number.parseInt(expiresParam, 10);
                            const refreshTimer = setTimeout(
                                () => {
                                    setIsUrlExpired(true);
                                },
                                (expiresInSeconds - 30) * 1000
                            );

                            return () => clearTimeout(refreshTimer);
                        }
                    }
                }
            } catch (err) {
                console.error('Error fetching video URL:', err);
                setError('Failed to load video');
            } finally {
                setIsLoading(false);
            }
            return undefined; // Ensure all code paths return a value
        };

        if (videoSourceType === 'FILE_ID') {
            fetchVideoUrl();
        }
    }, [fileId, videoSourceType]);

    const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
        console.error('Video playback error:', e);
        const videoElement = e.currentTarget;
        if (
            videoElement.error?.code === MediaError.MEDIA_ERR_NETWORK ||
            videoElement.error?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
        ) {
            setIsUrlExpired(true);
            toast.error('Video URL has expired. Refreshing...');
        } else {
            setError(`Video playback error: ${videoElement.error?.message || 'Unknown error'}`);
        }
    };

    useEffect(() => {
        if (isUrlExpired) {
            refreshS3Url();
        }
    }, [isUrlExpired]);

    // Loading UI
    if (videoSourceType === 'FILE_ID' && isLoading) {
        return (
            <div className="flex h-64 items-center justify-center rounded-lg bg-gray-100">
                <div className="size-12 animate-spin rounded-full border-y-2 border-primary-500"></div>
            </div>
        );
    }

    // Error UI
    if (videoSourceType === 'FILE_ID' && error) {
        return (
            <div className="flex h-64 flex-col items-center justify-center rounded-lg bg-red-50 p-4">
                <p className="mb-2 font-medium text-red-500">{error}</p>
                <button
                    onClick={refreshS3Url}
                    className="hover:bg-primary-600 rounded-md bg-primary-500 px-4 py-2 text-white transition-colors"
                >
                    Retry
                </button>
            </div>
        );
    }

    // FILE_ID video rendering
    if (videoSourceType === 'FILE_ID') {
        return (
            <div key={`video-${items.length + 1}`} className="w-full overflow-hidden rounded-lg">
                {isUrlExpired ? (
                    <div className="flex h-64 flex-col items-center justify-center bg-yellow-50 p-4">
                        <p className="mb-4 text-yellow-700">Video URL has expired. Refreshing...</p>
                        <div className="size-8 animate-spin rounded-full border-y-2 border-primary-500"></div>
                    </div>
                ) : (
                    <video
                        ref={videoRef}
                        className="w-full"
                        controls
                        controlsList="nodownload"
                        onError={handleVideoError}
                        playsInline
                        preload="metadata"
                    >
                        <source src={videoUrl} type="video/webm" />
                        <source src={videoUrl} type="video/mp4" />
                        <source src={videoUrl} type="video/ogg" />
                        Your browser does not support the video tag or the video format.
                    </video>
                )}
            </div>
        );
    }

    // YouTube embed fallback for 'VIDEO'
    return (
        <div key={`video-${items.length + 1}`} className="size-full">
            <YouTubePlayer
                videoUrl={
                    activeItem.video_slide?.published_url || activeItem.video_slide?.url || ''
                }
            />
        </div>
    );
};

export default VideoSlidePreview;
