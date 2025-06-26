
const ZoomEmbedPlayer = ({
  recordingUrl = "https://zoom.us/rec/play/YOUR_RECORDING_ID",
}) => {
  return (
    <div className="relative inline-block w-[560px] h-[315px]">
      <iframe
        width="560"
        height="315"
        src={recordingUrl}
        frameBorder="0"
        allowFullScreen
        className="absolute top-0 left-0"
        title="Zoom Recording"
      ></iframe>

      {/* LIVE Badge */}
      <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-1 rounded font-bold text-sm uppercase z-10 animate-pulse">
        LIVE
      </div>

      {/* View Count */}
      <div className="absolute top-2 right-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-sm z-10 font-sans">
        <span className="text-red-400">●</span> 1,234 watching
      </div>
    </div>
  );
};

export default ZoomEmbedPlayer;
