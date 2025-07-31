interface ZoomEmbedPlayerProps {
  recordingUrl: string;
}

// A responsive Zoom embed that fills its parent container (similar look-and-feel to our YouTube player)
const ZoomEmbedPlayer: React.FC<ZoomEmbedPlayerProps> = ({
  recordingUrl = "https://zoom.us/rec/play/YOUR_RECORDING_ID",
}) => {
  return (
    <div className="relative w-full h-full bg-black">
      {/* Zoom iframe */}
      <iframe
        src={recordingUrl}
        className="absolute inset-0 w-full h-full"
        allow="autoplay; fullscreen"
        allowFullScreen
        frameBorder={0}
        title="Zoom Recording"
      />

      {/* View count placeholder */}
      <span className="absolute top-3 right-3 z-10 rounded bg-black/70 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
        <span className="mr-1 text-red-400">●</span>1,234 watching
      </span>
    </div>
  );
};

export default ZoomEmbedPlayer;