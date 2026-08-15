import { MyButton } from "@/components/design-system/button";

/**
 * The institute's disclaimer, shown before a learner joins a class they have not
 * attended yet. Purely presentational — the caller decides when it appears and
 * what happens on continue.
 *
 * It sits BEFORE the join, not on the class screen, because joining marks the
 * learner present; anything shown afterwards could no longer tell a newcomer
 * from a returning learner.
 */
export const DisclaimerVideoScreen = ({
  videoUrl,
  onContinue,
}: {
  videoUrl: string;
  onContinue: () => void;
}) => (
  <div className="flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-neutral-50 px-4 py-8">
    <div className="w-full max-w-3xl">
      <h2 className="text-title font-semibold text-neutral-700">
        Before you join
      </h2>
      <p className="mt-1 text-body text-neutral-500">
        Please watch this short video.
      </p>

      <div className="mt-4 aspect-video w-full overflow-hidden rounded-xl bg-neutral-900">
        <iframe
          src={toEmbedUrl(videoUrl)}
          title="Disclaimer"
          className="size-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>

      <div className="mt-4 flex justify-end">
        <MyButton buttonType="primary" onClick={onContinue}>
          Continue to class
        </MyButton>
      </div>
    </div>
  </div>
);

/**
 * YouTube watch/short links do not render inside an iframe; only /embed/ does.
 * Anything else is passed through untouched so a direct MP4 or an already-embed
 * URL still works.
 */
const toEmbedUrl = (url: string): string => {
  const trimmed = url.trim();
  const yt =
    /(?:youtube\.com\/(?:watch\?v=|live\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/.exec(
      trimmed
    );
  return yt?.[1] ? `https://www.youtube.com/embed/${yt[1]}` : trimmed;
};
