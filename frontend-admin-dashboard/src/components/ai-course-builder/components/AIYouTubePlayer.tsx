import React, { useEffect, useRef, useState, useCallback } from 'react';

export interface YTPlayer {
    destroy(): void;
    getCurrentTime(): number;
    getDuration(): number;
    seekTo(seconds: number, allowSeekAhead: boolean): void;
    getPlayerState(): number;
}

interface YouTubePlayerEvent {
    target: YTPlayer;
    data: number;
}

declare global {
    interface Window {
        onYouTubeIframeAPIReady: () => void;
        YT: {
            Player: new (
                element: HTMLElement | string,
                options: {
                    height?: string | number;
                    width?: string | number;
                    videoId?: string;
                    playerVars?: {
                        autoplay?: number;
                        controls?: number;
                        showinfo?: number;
                        rel?: number;
                        [key: string]: unknown;
                    };
                    events?: {
                        onReady?: (event: YouTubePlayerEvent) => void;
                        onStateChange?: (event: YouTubePlayerEvent) => void;
                        onError?: (event: YouTubePlayerEvent) => void;
                        [key: string]: unknown;
                    };
                }
            ) => YTPlayer;
            PlayerState: {
                PLAYING: number;
                PAUSED: number;
                ENDED: number;
                BUFFERING: number;
                CUED: number;
                UNSTARTED: number;
            };
        };
    }
}

interface AIYouTubePlayerProps {
    videoUrl: string;
    className?: string;
}

/**
 * Simplified YouTube Player for AI Course Builder
 * This version doesn't depend on route context from manual course system
 */
export const AIYouTubePlayer: React.FC<AIYouTubePlayerProps> = ({ videoUrl, className = '' }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<YTPlayer | null>(null);
    const [isAPIReady, setIsAPIReady] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [videoDuration, setVideoDuration] = useState(0);
    const [playerError, setPlayerError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false); // Start with false, only set to true when actually loading
    const [forceIframe, setForceIframe] = useState(false);
    const [useSimpleIframe, setUseSimpleIframe] = useState(false);
    const [iframeError, setIframeError] = useState<string | null>(null);
    const [iframeLoaded, setIframeLoaded] = useState(false);
    const [useDirectEmbed, setUseDirectEmbed] = useState(false);

    const extractVideoId = useCallback((url: string): string => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);

        if (match && match[2] && match[2].length === 11) {
            return match[2];
        }
        return '';
    }, []);

    // Function to load YouTube IFrame API
    const loadYouTubeAPI = useCallback(() => {
        console.log('loadYouTubeAPI called');

        if (window.YT && window.YT.Player) {
            console.log('YouTube API already loaded');
            setIsAPIReady(true);
            setIsLoading(false);
            return;
        }

        if (document.querySelector('script[src*="youtube.com/iframe_api"]')) {
            console.log('YouTube API script already exists, waiting for load...');
            // Set a shorter timeout if script exists but API isn't ready
            setTimeout(() => {
                if (!window.YT || !window.YT.Player) {
                    console.log('YouTube API script loaded but not ready, forcing iframe');
                    setForceIframe(true);
                    setIsLoading(false);
                }
            }, 3000);
            return;
        }

        console.log('Loading YouTube API script...');
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';

        // Set up the callback
        window.onYouTubeIframeAPIReady = () => {
            console.log('YouTube API ready via callback');
            setIsAPIReady(true);
            setIsLoading(false);
        };

        tag.onload = () => {
            console.log('YouTube API script loaded');
        };

        tag.onerror = () => {
            console.log('YouTube API script failed to load, using iframe fallback');
            setForceIframe(true);
            setIsLoading(false);
        };

        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
    }, []);

    // Create player when API is ready and URL changes
    const createPlayer = useCallback(() => {
        if (!isAPIReady || !videoUrl || !containerRef.current) {
            console.log('Cannot create player:', {
                isAPIReady,
                hasVideoUrl: !!videoUrl,
                hasContainer: !!containerRef.current,
            });
            return;
        }

        const videoId = extractVideoId(videoUrl);
        if (!videoId) {
            setPlayerError('Invalid YouTube URL');
            setIsLoading(false);
            return;
        }

        console.log('Creating YouTube player for video ID:', videoId);
        setPlayerError(null);
        // Don't set loading here since it's already set in the mount effect

        // Destroy existing player
        if (playerRef.current) {
            try {
                playerRef.current.destroy();
            } catch (e) {
                console.error('Error destroying existing player:', e);
            }
            playerRef.current = null;
        }

        // Create container element
        const playerContainer = document.createElement('div');
        playerContainer.id = `youtube-player-${Date.now()}`;
        containerRef.current.innerHTML = '';
        containerRef.current.appendChild(playerContainer);

        // Add a fallback timeout for player creation itself
        const playerTimeout = setTimeout(() => {
            if (isLoading) {
                console.log('Player creation timeout, forcing iframe');
                setForceIframe(true);
                setIsLoading(false);
            }
        }, 1000);

        try {
            // Create new player
            const player = new window.YT.Player(playerContainer, {
                height: '100%',
                width: '100%',
                videoId: videoId,
                playerVars: {
                    autoplay: 0,
                    controls: 1,
                    showinfo: 0,
                    rel: 0,
                    modestbranding: 1,
                    cc_load_policy: 0,
                    origin: window.location.origin,
                },
                events: {
                    onReady: (event) => {
                        console.log('✅ YouTube player ready and loaded!');
                        clearTimeout(playerTimeout);
                        setIsLoading(false);
                        try {
                            const duration = event.target.getDuration();
                            setVideoDuration(duration);
                            console.log('Video duration:', duration);
                        } catch (e) {
                            console.error('Error getting duration:', e);
                        }
                    },
                    onStateChange: (event) => {
                        console.log('YouTube player state change:', event.data);
                        if (event.data === window.YT.PlayerState.PLAYING) {
                            try {
                                const duration = event.target.getDuration();
                                setVideoDuration(duration);
                            } catch (e) {
                                console.error('Error getting duration on play:', e);
                            }
                        }
                    },
                    onError: (event) => {
                        console.error('❌ YouTube Player error:', event);
                        clearTimeout(playerTimeout);
                        setIsLoading(false);
                        switch (event.data) {
                            case 2:
                                setPlayerError('Invalid video ID');
                                break;
                            case 5:
                                setPlayerError('Video not available in HTML5 player');
                                break;
                            case 100:
                                setPlayerError('Video not found');
                                break;
                            case 101:
                            case 150:
                                setPlayerError('Video cannot be embedded');
                                break;
                            default:
                                setPlayerError(`Player error: ${event.data}`);
                        }
                    },
                },
            });

            playerRef.current = player;
            console.log('YouTube player object created, waiting for onReady...');
        } catch (error) {
            console.error('❌ Error creating YouTube player:', error);
            clearTimeout(playerTimeout);
            setPlayerError('Failed to create player');
            setIsLoading(false);
        }
    }, [isAPIReady, videoUrl, extractVideoId, isLoading]);

    // Load YouTube API on mount
    useEffect(() => {
        console.log('YouTube Player mounting, videoUrl:', videoUrl);

        if (!videoUrl) {
            console.log('No video URL, not loading anything');
            setIsLoading(false);
            return;
        }

        const videoId = extractVideoId(videoUrl);
        if (!videoId) {
            console.log('Invalid video URL, not loading anything');
            setIsLoading(false);
            return;
        }

        // Start loading process
        setIsLoading(true);
        setPlayerError(null);
        setForceIframe(false);

        console.log('Starting YouTube API loading for video:', videoId);
        loadYouTubeAPI();

        // Smart timeout - if API doesn't load OR player doesn't create within reasonable time
        const timeout = setTimeout(() => {
            if (!isAPIReady) {
                console.log('🕒 YouTube API timeout after 2s, forcing iframe fallback');
                setForceIframe(true);
                setIsLoading(false);
            } else if (isLoading) {
                console.log(
                    '🕒 Player creation taking too long (API ready but player not loaded), checking status...'
                );
                // Give player creation a bit more time since API is ready
                setTimeout(() => {
                    if (isLoading) {
                        console.log('🕒 Final timeout: forcing iframe fallback');
                        setForceIframe(true);
                        setIsLoading(false);
                    }
                }, 1000);
            }
        }, 2000);

        return () => {
            clearTimeout(timeout);
            if (playerRef.current) {
                try {
                    playerRef.current.destroy();
                } catch (e) {
                    console.error('Error destroying YouTube player:', e);
                }
            }
        };
    }, [loadYouTubeAPI, videoUrl, extractVideoId]); // isAPIReady and isLoading intentionally omitted to prevent infinite loops

    // Create player when ready
    useEffect(() => {
        createPlayer();
    }, [createPlayer]);

    // Update current time for tracking
    useEffect(() => {
        let interval: NodeJS.Timeout | null = null;

        if (playerRef.current && !playerError) {
            interval = setInterval(() => {
                try {
                    const player = playerRef.current;
                    if (player && player.getPlayerState && player.getCurrentTime) {
                        const state = player.getPlayerState();
                        if (state !== 2 && state !== -1) {
                            // not paused or unstarted
                            setCurrentTime(player.getCurrentTime());
                        }
                    }
                } catch (e) {
                    // Silently ignore errors during time updates
                }
            }, 1000);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isAPIReady, playerError]);

    if (!videoUrl) {
        return (
            <div className={`video-placeholder ${className}`}>
                <div className="video-placeholder-content">
                    <p>No video URL provided</p>
                    <p>Please add a YouTube video URL to display the player.</p>
                </div>
            </div>
        );
    }

    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
        return (
            <div className={`video-placeholder ${className}`}>
                <div className="video-placeholder-content">
                    <p>Invalid YouTube URL</p>
                    <p>Please provide a valid YouTube video URL.</p>
                </div>
            </div>
        );
    }

    // Show error state
    if (playerError) {
        return (
            <div className={`video-placeholder ${className}`}>
                <div className="video-placeholder-content">
                    <p>YouTube Player Error</p>
                    <p>{playerError}</p>
                    <p className="fallback-note">Falling back to iframe player...</p>
                    {/* Fallback iframe player */}
                    <div className="fallback-player" style={{ marginTop: '1rem' }}>
                        <iframe
                            width="100%"
                            height="315"
                            src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}&rel=0&modestbranding=1`}
                            title="YouTube video player"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                            referrerPolicy="strict-origin-when-cross-origin"
                            style={{ borderRadius: '8px' }}
                        />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`ai-youtube-player ${className}`}>
            {/* Development controls */}
            {process.env.NODE_ENV === 'development' && (
                <div
                    style={{
                        marginBottom: '1rem',
                        padding: '0.5rem',
                        background: '#f0f0f0',
                        borderRadius: '4px',
                    }}
                >
                    <button
                        onClick={() => {
                            setForceIframe(true);
                            setIsLoading(false);
                        }}
                        style={{
                            marginRight: '0.5rem',
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.75rem',
                        }}
                    >
                        Force Iframe
                    </button>
                    <button
                        onClick={() => {
                            setForceIframe(false);
                            setIsLoading(true);
                            setIsAPIReady(false);
                            loadYouTubeAPI();
                        }}
                        style={{
                            marginRight: '0.5rem',
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.75rem',
                        }}
                    >
                        Try API Again
                    </button>
                    <button
                        onClick={() => {
                            // Test simple iframe without any origin parameters
                            const testWindow = window.open(
                                `https://www.youtube.com/embed/${extractVideoId(videoUrl)}`,
                                '_blank',
                                'width=800,height=600'
                            );
                            setTimeout(() => testWindow?.close(), 5000);
                        }}
                        style={{
                            marginRight: '0.5rem',
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.75rem',
                        }}
                    >
                        Test CORS
                    </button>
                    <button
                        onClick={() => {
                            setUseSimpleIframe(true);
                            setIsLoading(false);
                            setForceIframe(false);
                            setIframeLoaded(false);
                            setIframeError(null);
                        }}
                        style={{
                            marginRight: '0.5rem',
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.75rem',
                        }}
                    >
                        Simple Iframe
                    </button>
                    <button
                        onClick={() => {
                            // Try with a known working video ID
                            const testVideoId = 'dQw4w9WgXcQ'; // Rick Roll - always embeddable
                            const testWindow = window.open(
                                `https://www.youtube.com/embed/${testVideoId}`,
                                '_blank',
                                'width=800,height=600'
                            );
                            setTimeout(() => testWindow?.close(), 3000);
                        }}
                        style={{
                            marginRight: '0.5rem',
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.75rem',
                        }}
                    >
                        Test Known Video
                    </button>
                    <button
                        onClick={() => {
                            setUseDirectEmbed(true);
                            setUseSimpleIframe(false);
                            setIsLoading(false);
                            setForceIframe(false);
                        }}
                        style={{
                            marginRight: '0.5rem',
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.75rem',
                        }}
                    >
                        Direct Embed
                    </button>
                    <button
                        onClick={() => {
                            // Open the exact URL we're trying to embed
                            window.open(
                                `https://www.youtube.com/embed/${extractVideoId(videoUrl)}`,
                                '_blank'
                            );
                        }}
                        style={{
                            marginRight: '0.5rem',
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.75rem',
                        }}
                    >
                        Test Direct URL
                    </button>
                    <button
                        onClick={() => {
                            // Force a known working video ID for testing
                            const knownWorkingId = 'jNQXAC9IVRw'; // "Me at the zoo" - first YouTube video, definitely embeddable
                            const testUrl = `https://youtu.be/${knownWorkingId}`;

                            // Update the component with known working video
                            setUseSimpleIframe(true);
                            setUseDirectEmbed(false);
                            setIsLoading(false);
                            setForceIframe(false);
                            setIframeLoaded(false);
                            setIframeError(null);

                            // Would need to update parent component with new URL
                            console.log('🧪 Testing with known working video:', testUrl);
                        }}
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                    >
                        Try Known Working Video
                    </button>
                </div>
            )}

            <div className="video-container">
                {/* Loading indicator */}
                {isLoading && !forceIframe && (
                    <div className="loading-overlay">
                        <div className="loading-spinner">
                            <div className="spinner"></div>
                            <p>Loading YouTube player...</p>
                            <p style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
                                If this takes too long, we&apos;ll automatically switch to iframe
                                mode
                            </p>
                        </div>
                    </div>
                )}

                <div
                    ref={containerRef}
                    className="youtube-player-container"
                    style={{
                        width: '100%',
                        height: '400px',
                        background: '#000',
                        display:
                            isLoading || forceIframe || useSimpleIframe || useDirectEmbed
                                ? 'none'
                                : 'block',
                    }}
                />

                {/* Simple iframe for CORS testing */}
                {useSimpleIframe && (
                    <div className="simple-iframe">
                        <div
                            style={{ marginBottom: '0.5rem', fontSize: '0.875rem', color: '#666' }}
                        >
                            <strong>Simple Iframe Test</strong> (Video ID: {videoId})<br />
                            Status: {iframeLoaded ? '✅ Loaded' : '⏳ Loading...'}
                            {iframeError && ` ❌ Error: ${iframeError}`}
                            <br />
                            URL: https://www.youtube.com/embed/{videoId}
                        </div>
                        <iframe
                            width="100%"
                            height="400"
                            src={`https://www.youtube.com/embed/${videoId}`}
                            title="YouTube video player"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            style={{
                                borderRadius: '8px',
                                border: '3px solid blue',
                                minHeight: '400px',
                            }}
                            onLoad={(e) => {
                                console.log('✅ Simple iframe loaded successfully');
                                const iframe = e.target as HTMLIFrameElement;
                                console.log('📺 Simple iframe details:', {
                                    src: iframe.src,
                                    width: iframe.offsetWidth,
                                    height: iframe.offsetHeight,
                                    display: window.getComputedStyle(iframe).display,
                                    visibility: window.getComputedStyle(iframe).visibility,
                                });
                                setIframeLoaded(true);
                                setIframeError(null);
                            }}
                            onError={(e) => {
                                console.error('❌ Simple iframe error:', e);
                                setIframeError('Failed to load iframe');
                                setIframeLoaded(false);
                            }}
                        />
                    </div>
                )}

                {/* Direct embed - most minimal possible */}
                {useDirectEmbed && (
                    <div className="direct-embed">
                        <div
                            style={{ marginBottom: '0.5rem', fontSize: '0.875rem', color: '#666' }}
                        >
                            <strong>Direct Minimal Embed</strong> (Video ID: {videoId})<br />
                            Absolute minimal iframe - no attributes at all
                            <br />
                            URL: https://www.youtube.com/embed/{videoId}
                        </div>
                        <iframe
                            width="100%"
                            height="400"
                            src={`https://www.youtube.com/embed/${videoId}`}
                            style={{ border: '2px solid red' }}
                            onLoad={(e) => {
                                console.log('🎬 Direct embed iframe loaded');
                                const iframe = e.target as HTMLIFrameElement;
                                console.log('🎬 Direct embed src:', iframe.src);
                                console.log('🎬 Direct embed dimensions:', {
                                    width: iframe.offsetWidth,
                                    height: iframe.offsetHeight,
                                    display: window.getComputedStyle(iframe).display,
                                    visibility: window.getComputedStyle(iframe).visibility,
                                });
                            }}
                        />
                    </div>
                )}

                {/* Fallback iframe if API player doesn't work or timeout */}
                {!useSimpleIframe &&
                    !useDirectEmbed &&
                    ((!isAPIReady && !isLoading) || forceIframe) && (
                        <div className="fallback-iframe">
                            <div
                                style={{
                                    marginBottom: '0.5rem',
                                    fontSize: '0.875rem',
                                    color: '#666',
                                }}
                            >
                                {forceIframe
                                    ? 'Using iframe player (forced)'
                                    : 'Using iframe player (API fallback)'}
                            </div>
                            <iframe
                                width="100%"
                                height="400"
                                src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}&rel=0&modestbranding=1`}
                                title="YouTube video player"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                                referrerPolicy="strict-origin-when-cross-origin"
                                style={{ borderRadius: '8px' }}
                            />
                        </div>
                    )}
            </div>

            {/* Simple video info */}
            {videoDuration > 0 && !isLoading && (
                <div className="video-info">
                    <div className="video-time">
                        {Math.floor(currentTime / 60)}:
                        {Math.floor(currentTime % 60)
                            .toString()
                            .padStart(2, '0')}{' '}
                        / {Math.floor(videoDuration / 60)}:
                        {Math.floor(videoDuration % 60)
                            .toString()
                            .padStart(2, '0')}
                    </div>
                </div>
            )}

            {/* Debug info in development */}
            {process.env.NODE_ENV === 'development' && (
                <div>
                    <div
                        className="debug-info"
                        style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.5rem' }}
                    >
                        <strong>Current Mode:</strong>{' '}
                        {useSimpleIframe
                            ? '📺 Simple Iframe'
                            : useDirectEmbed
                              ? '🎬 Direct Embed'
                              : forceIframe
                                ? '🔄 Force Iframe'
                                : isAPIReady
                                  ? '▶️ YouTube API'
                                  : '⏳ Loading'}
                        <br />
                        Video ID: <strong>{videoId}</strong> | API Ready: {isAPIReady ? '✅' : '❌'}{' '}
                        | Iframe Loaded: {iframeLoaded ? '✅' : '❌'} | Error:{' '}
                        {playerError || 'None'}
                    </div>
                    {!iframeLoaded && !isAPIReady && (
                        <div
                            style={{
                                marginTop: '0.5rem',
                                padding: '0.5rem',
                                background: '#fff3cd',
                                border: '1px solid #ffeaa7',
                                borderRadius: '4px',
                                fontSize: '0.875rem',
                            }}
                        >
                            <strong>Troubleshooting:</strong>
                            <br />
                            1. Click "Test Known Video" - if that popup works, your video might have
                            embedding disabled
                            <br />
                            2. Click "Direct Embed" - this is the most minimal possible iframe
                            <br />
                            3. Check console for specific error messages
                            <br />
                            4. Try a different YouTube video URL
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AIYouTubePlayer;
