import React from 'react';
import { isYouTubeUrl, convertToYouTubeEmbedUrl } from '../-utils/helper';

interface YouTubeVideoPlayerProps {
  url: string;
  className?: string;
}

export const YouTubeVideoPlayer: React.FC<YouTubeVideoPlayerProps> = ({ 
  url, 
  className = "" 
}) => {
  if (!url || !isYouTubeUrl(url)) {
    return null;
  }

  const embedUrl = convertToYouTubeEmbedUrl(url);

  return (
    <div className={`relative overflow-hidden rounded-xl shadow-2xl border border-white/20 bg-black/20 backdrop-blur-sm group ${className}`}>
      <div className="relative aspect-video">
        <iframe
          src={embedUrl}
          title="YouTube video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="w-full h-full object-cover rounded-xl"
        />
      </div>
      {/* Video overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none rounded-xl"></div>
    </div>
  );
}; 