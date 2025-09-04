interface ConfettiOverlayProps {
    showConfetti: boolean;
}

export const ConfettiOverlay = ({ showConfetti }: ConfettiOverlayProps) => {
    if (!showConfetti) return null;

    return (
        <div className="pointer-events-none fixed inset-0 z-[1000] overflow-hidden">
            <div className="absolute inset-0 bg-transparent animate-pulse" />
        </div>
    );
};
