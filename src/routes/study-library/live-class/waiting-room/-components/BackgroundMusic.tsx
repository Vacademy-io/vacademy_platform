import { useEffect, useRef } from "react";
import { getPublicUrl } from "@/services/upload_file";

interface BackgroundMusicProps {
  backgroundScoreFileId: string | null;
}

export function BackgroundMusic({
  backgroundScoreFileId,
}: BackgroundMusicProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const fetchAndPlayAudio = async () => {
      if (backgroundScoreFileId) {
        try {
          const url = await getPublicUrl(backgroundScoreFileId);
          if (audioRef.current) {
            audioRef.current.src = url;
            audioRef.current.volume = 0.3; // Set volume to 30%
            audioRef.current.play().catch((error) => {
              console.error("Error playing audio:", error);
            });
          }
        } catch (error) {
          console.error("Error fetching audio URL:", error);
        }
      }
    };

    fetchAndPlayAudio();

    // Cleanup function to stop audio when component unmounts
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, [backgroundScoreFileId]);

  return <audio ref={audioRef} loop style={{ display: "none" }} />;
}
