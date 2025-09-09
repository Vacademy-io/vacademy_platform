import { VideoPlayer } from "./video-player";

interface MobileVideoPlayerProps {
    courseMediaId: string;
}

export const MobileVideoPlayer = ({ courseMediaId }: MobileVideoPlayerProps) => {
    if (!courseMediaId) return null;

    return (
        <div className="lg:hidden relative z-10 max-w-[350px] px-0 py-3">
            <div className="bg-white border border-gray-200 rounded-md shadow-sm p-2 sm:p-3">
                <VideoPlayer src={courseMediaId} />
            </div>
        </div>
    );
};
