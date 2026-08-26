/**
 * Drives the optional post-submit redirect configured on an audience campaign.
 *
 * Shared by both surfaces that render an audience form — the standalone
 * /audience-response page and the catalogue's inline/modal LeadForm — so a
 * campaign redirects identically wherever its form was filled.
 *
 * Contract: does nothing until `active` (i.e. the submission succeeded) and
 * only when the admin configured a destination that survives
 * `resolvePostSubmitUrl`. A configured delay shows the thank-you screen first
 * and counts down, so the visitor gets to read the message.
 */
import { useEffect, useState } from "react";
import {
  AudiencePostSubmitConfiguration,
  PostSubmitTokens,
  resolvePostSubmitUrl,
} from "./post-submit-config";

export const usePostSubmitRedirect = (
  config: AudiencePostSubmitConfiguration,
  tokens: PostSubmitTokens,
  active: boolean
): { redirectUrl: string | null; secondsLeft: number | null } => {
  const redirectUrl = resolvePostSubmitUrl(config.redirectUrl, tokens);
  const delay = Math.max(0, config.redirectDelaySeconds || 0);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!active || !redirectUrl) {
      setSecondsLeft(null);
      return;
    }

    if (delay <= 0) {
      window.location.href = redirectUrl;
      return;
    }

    setSecondsLeft(delay);
    let remaining = delay;
    const interval = window.setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        window.clearInterval(interval);
        setSecondsLeft(0);
        window.location.href = redirectUrl;
        return;
      }
      setSecondsLeft(remaining);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [active, redirectUrl, delay]);

  return { redirectUrl, secondsLeft };
};
