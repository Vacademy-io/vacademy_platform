import React from "react";
import { resolveMobileBarLinks, classifyBarLink, shouldShowMobileGetStarted } from "../-utils/catalogue-cta";

/**
 * The fixed bottom action bar on mobile catalogue pages.
 *
 * It renders THE SAME buttons as the site header (`authLinks`), stacked for
 * thumbs — one mental model, one place to configure. That makes it fully
 * admin-controllable from Global Header → Auth / CTA Buttons:
 *   - remove a button there → it disappears here too (remove ALL → no bar);
 *   - an "Enquire (form)" button bound to an Audience campaign opens that
 *     campaign's form as a popup here exactly like it does in the header.
 *
 * Catalogues that never configured authLinks keep the legacy hardcoded bar
 * (Login + Get Started → lead-collection modal) so nothing shifts under
 * institutes that never touched the setting.
 */

interface MobileActionBarProps {
  catalogueData: any;
  pageSlug?: string;
  /** Legacy Get Started visibility gate the page already computes. */
  legacyGetStartedVisible: boolean;
  onLogin: () => void;
  onLegacyGetStarted: () => void;
  onNavigate: (route: string) => void;
  /** Extra bottom padding on native shells (gesture bar). */
  nativePad?: boolean;
}

const SUBLABEL: Record<string, string | undefined> = {
  // Login carries no sublabel on mobile — the button says what it does, and the
  // caption only crowded the bar. Kept for the capture actions, where "For new
  // users" is doing real work telling the two buttons apart.
  login: undefined,
  leadCollection: "For new users",
  form: undefined,
  signup: "For new users",
  navigate: undefined,
};

export const MobileActionBar: React.FC<MobileActionBarProps> = ({
  catalogueData,
  pageSlug,
  legacyGetStartedVisible,
  onLogin,
  onLegacyGetStarted,
  onNavigate,
  nativePad = false,
}) => {
  const links = resolveMobileBarLinks(catalogueData, pageSlug);

  // Explicitly cleared header buttons → the admin asked for no bar at all.
  if (links !== null && links.length === 0) return null;

  const shell = (children: React.ReactNode) => (
    <div className="md:hidden fixed bottom-0 start-0 end-0 z-50 bg-catalogue-bg border-t border-catalogue-border p-4">
      <div className={`flex flex-col gap-3 ${nativePad ? "mb-8" : ""}`}>{children}</div>
    </div>
  );

  // ── Legacy default (authLinks never configured) ──
  if (links === null) {
    return shell(
      <>
        <div className="flex flex-col gap-1">
          <button onClick={onLogin} className="catalogue-btn catalogue-btn-secondary w-full justify-center">
            Login
          </button>
        </div>
        {legacyGetStartedVisible && shouldShowMobileGetStarted(catalogueData, pageSlug) && (
          <div className="flex flex-col gap-1">
            <button onClick={onLegacyGetStarted} className="catalogue-btn catalogue-btn-primary w-full justify-center">
              Get Started
            </button>
            <span className="text-center text-xs text-catalogue-text-secondary">For new users</span>
          </div>
        )}
      </>
    );
  }

  // ── Header-mirrored bar ──
  const handleClick = (link: any) => {
    switch (classifyBarLink(link)) {
      case "form":
        window.dispatchEvent(
          new CustomEvent("openAudienceForm", {
            detail: { audienceId: String(link.audienceId).trim(), title: link.formTitle || link.label },
          })
        );
        break;
      case "login":
        onLogin();
        break;
      case "signup":
        window.location.href = "/signup";
        break;
      case "leadCollection":
        onLegacyGetStarted();
        break;
      default:
        if (link.route) onNavigate(link.route);
    }
  };

  return shell(
    <>
      {links.slice(0, 3).map((link: any, i: number) => {
        const kind = classifyBarLink(link);
        // Capture actions lead; login/navigation stay quiet.
        const primary = kind === "form" || kind === "leadCollection" || kind === "signup";
        const sublabel = SUBLABEL[kind];
        return (
          <div key={i} className="flex flex-col gap-1">
            <button
              onClick={() => handleClick(link)}
              className={`catalogue-btn w-full justify-center ${primary ? "catalogue-btn-primary" : "catalogue-btn-secondary"}`}
            >
              {link.label || "Open"}
            </button>
            {sublabel && (
              <span className="text-center text-xs text-catalogue-text-secondary">{sublabel}</span>
            )}
          </div>
        );
      })}
    </>
  );
};

export default MobileActionBar;
