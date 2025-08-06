import React from 'react';
import { isYouTubeUrl } from '../-utils/helper';
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
    <div className={`w-[500px] overflow-hidden rounded-lg shadow-xl ${className}`}>
      <div className="relative aspect-video bg-black">
        <video
          src={src}
          controls
          controlsList="nodownload noremoteplayback"
          disablePictureInPicture
          disableRemotePlayback
          className="size-full rounded-lg object-contain"
          onError={(e) => {
            e.currentTarget.style.display = "none";
            e.currentTarget.parentElement?.classList.add("bg-black");
          }}
        >
          Your browser does not support the video tag.
        </video>
      </div>
    </div>
  );
}; 