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
          onLoad={suppressCaptions}
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
 *
 * enablejsapi=1 is what lets {@link suppressCaptions} talk to the player. There is
 * no query parameter that turns subtitles off — cc_load_policy only accepts 1,
 * meaning "force them ON" — so the only lever is the JS API.
 */
const toEmbedUrl = (url: string): string => {
  const trimmed = url.trim();
  const yt =
    /(?:youtube\.com\/(?:watch\?v=|live\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/.exec(
      trimmed
    );
  return yt?.[1]
    ? `https://www.youtube.com/embed/${yt[1]}?enablejsapi=1`
    : trimmed;
};

/**
 * Turn subtitles off once the player has loaded.
 *
 * YouTube's default is to follow the VIEWER's own preference — a Google account
 * set to "always show captions", or an OS-level subtitle toggle — which is why
 * the same disclaimer plays clean for most learners and captioned for one.
 * Unloading the captions module is the only way to override that.
 *
 * Sent by postMessage because this is a plain iframe, not the JS-API player
 * wrapper. Both module names are tried: "cc" on the legacy player, "captions" on
 * the HTML5 one. Best-effort by design — if it fails the learner simply sees
 * subtitles, which must never block them from reaching the class.
 */
const suppressCaptions = (e: React.SyntheticEvent<HTMLIFrameElement>) => {
  const win = e.currentTarget.contentWindow;
  if (!win) return;
  for (const moduleName of ["captions", "cc"]) {
    win.postMessage(
      JSON.stringify({
        event: "command",
        func: "unloadModule",
        args: [moduleName],
      }),
      "https://www.youtube.com"
    );
  }
};
