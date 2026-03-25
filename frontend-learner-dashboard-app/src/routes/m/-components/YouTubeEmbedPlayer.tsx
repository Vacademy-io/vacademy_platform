import React from "react";

interface YouTubeEmbedPlayerProps {
    url: string;
    title?: string;
    className?: string;
}

// Utility: extract the 11-character YouTube ID from any common URL form
function extractYouTubeVideoId(url: string): string | null {
    if (!url) return null;
    const regExp =
        /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|live\/))([a-zA-Z0-9_-]{11})/;
    const match = url.match(regExp);
    return match ? match[1] : null;
}

// Check if URL is a YouTube URL
function isYouTubeUrl(url: string): boolean {
    if (!url) return false;
    return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/.test(url);
}

// Convert any YouTube URL to embed format with branding disabled
function convertToYouTubeEmbedUrl(url: string): string {
    const videoId = extractYouTubeVideoId(url);
    if (!videoId) return url;

    // YouTube embed parameters to minimize branding and disable seeking
    const params = new URLSearchParams({
        modestbranding: '1',  // Reduce YouTube logo in controls
        rel: '0',             // Don't show related videos from other channels
        fs: '1',              // Enable fullscreen button
        playsinline: '1',     // Play inline on mobile
        iv_load_policy: '3',  // Hide video annotations
        disablekb: '1',       // Disable keyboard controls (prevents seeking via arrow keys)
        cc_load_policy: '0',  // Don't force captions
    });

    // Use youtube-nocookie.com for privacy-enhanced mode (less branding)
    return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}

export const YouTubeEmbedPlayer: React.FC<YouTubeEmbedPlayerProps> = ({
    url,
    title = "Video",
    className = "",
}) => {
    if (!url || !isYouTubeUrl(url)) {
        return (
            <div className="flex items-center justify-center h-[40vh] sm:h-[50vh] bg-white/5 rounded-lg sm:rounded-xl p-4 sm:p-8">
                <p className="text-white/50 text-sm sm:text-base">Invalid YouTube URL</p>
            </div>
        );
    }

    const embedUrl = convertToYouTubeEmbedUrl(url);

    return (
        <div className={`youtube-embed-container relative overflow-hidden rounded-lg sm:rounded-xl bg-black ${className}`}>
            <div className="relative aspect-video">
                <iframe
                    src={embedUrl}
                    title={title}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                    allowFullScreen
                    className="w-full h-full absolute inset-0"
                    loading="lazy"
                />

                {/* Overlay to block timeline and YouTube branding at the bottom */}
                <div
                    className="absolute bottom-0 left-0 right-0 h-[50px] sm:h-[60px] z-10 cursor-default"
                    style={{ background: 'transparent' }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                />

                {/* Overlay to block "Watch on YouTube" button in top-right corner */}
                <div
                    className="absolute top-0 right-0 w-[120px] h-[40px] sm:w-[150px] sm:h-[50px] z-10 cursor-default"
                    style={{ background: 'transparent' }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                />
            </div>
        </div>
    );
};

export { extractYouTubeVideoId, isYouTubeUrl, convertToYouTubeEmbedUrl };
