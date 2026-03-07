interface ZohoEmbedPlayerProps {
    meetingUrl: string;
}

const ZohoEmbedPlayer: React.FC<ZohoEmbedPlayerProps> = ({
    meetingUrl = "",
}) => {
    const getEmbedUrl = (url: string) => {
        if (!url) return "";

        // If it's already an embed URL, leave it
        if (url.includes("/meeting/embed/")) return url;

        // Transform meet.zoho.xx or meeting.zoho.xx into public embed join format
        const match = url.match(/(?:meet|meeting)\.zoho\.(in|com)\/([a-zA-Z0-9-]+)/);
        if (match) {
            const domain = match[1];
            const id = match[2];
            // Trying the public join path which is more permissive in some Zoho regions
            return `https://meeting.zoho.${domain}/meeting/public/join?key=${id}&embed=true`;
        }

        // Fallback: Add embed=true
        if (url.includes("zoho") && !url.includes("embed=true")) {
            const separator = url.includes("?") ? "&" : "?";
            return `${url}${separator}embed=true`;
        }

        return url;
    };

    const embedUrl = getEmbedUrl(meetingUrl);
    console.log("[ZohoEmbed] Original URL:", meetingUrl);
    console.log("[ZohoEmbed] Trying Public Join URL:", embedUrl);

    return (
        <div className="relative w-full h-full flex-1 min-h-[400px] bg-black rounded-lg overflow-hidden">
            {/* Zoho iframe */}
            <iframe
                src={embedUrl}
                className="absolute inset-0 w-full h-full"
                allow="camera; microphone; display-capture; autoplay; fullscreen; clipboard-write"
                allowFullScreen
                frameBorder={0}
                title="Zoho Session"
            />
        </div>
    );
};

export default ZohoEmbedPlayer;
