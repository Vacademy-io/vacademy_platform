interface ZoomEmbedPlayerProps {
  recordingUrl: string;
  /**
   * ISO-8601 provider auto-delete time (Zoom cloud recordings expire ~30 days
   * unless mirrored to the Vacademy library). When set and in the future, a small
   * "Available until <date>" note is shown so learners know the recording is
   * time-limited. Omit (or pass null) once the recording is on permanent storage.
   */
  expiresAt?: string | null;
}

// A responsive Zoom embed that fills its parent container (similar look-and-feel to our YouTube player)
const ZoomEmbedPlayer: React.FC<ZoomEmbedPlayerProps> = ({
  recordingUrl = "https://zoom.us/rec/play/YOUR_RECORDING_ID",
  expiresAt = null,
}) => {
  const expiryDate = expiresAt ? new Date(expiresAt) : null;
  const showExpiry =
    expiryDate !== null && !Number.isNaN(expiryDate.getTime()) && expiryDate.getTime() > Date.now();

  return (
    <div className="relative w-full h-full flex-1 min-h-96 bg-black rounded-lg overflow-hidden">
      {/* Zoom iframe */}
      <iframe
        src={recordingUrl}
        className="absolute inset-0 w-full h-full"
        allow="autoplay; fullscreen"
        allowFullScreen
        frameBorder={0}
        title="Zoom Recording"
      />

      {/* Retention note — recording lives on Zoom Cloud and will expire */}
      {showExpiry && (
        <span className="absolute bottom-3 left-3 z-10 rounded bg-black/70 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
          Available until {expiryDate!.toLocaleDateString()}
        </span>
      )}
    </div>
  );
};

export default ZoomEmbedPlayer;