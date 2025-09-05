import React from 'react';
import { isYouTubeUrl } from '../../-utils/helper';
import { YouTubeVideoPlayer } from './youtube-video-player';

interface VideoPlayerProps {
  src: string;
  className?: string;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ 
  src, 
  className = "" 
}) => {
  if (!src) {
    return null;
  }

  // If it's a YouTube URL, use the YouTube player
  if (isYouTubeUrl(src)) {
    return <YouTubeVideoPlayer url={src} className={className} />;
  }

  // Otherwise, use the regular video element
  return (
    <div className={`relative overflow-hidden rounded-md shadow-md border border-black/10 bg-black/20 group ${className}`}>
      <div className="relative aspect-video">
        <video
          src={src}
          controls
          controlsList="nodownload noremoteplayback"
          disablePictureInPicture
          disableRemotePlayback
          className="w-full h-full object-cover rounded-md"
          onError={(e) => {
            e.currentTarget.style.display = "none";
            e.currentTarget.parentElement?.classList.add("bg-black");
          }}
        >
          Your browser does not support the video tag.
        </video>
      </div>
      {/* Video overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none rounded-md"></div>
    </div>
  );
}; 