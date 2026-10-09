import { useCallback, useEffect, useMemo, useState } from "react";
import type { CourseLanguageOption } from "../../-utils/course-variants";
import {
  fetchCourseLevels,
  getOpenEnrollInvite,
  invitePackageSessionIds,
  mergeCourseInit,
  type CourseInitLike,
  type CourseLevel,
  type OpenEnrollInvite,
} from "../../-services/course-levels-service";
import {
  effectiveInviteIdFor,
  languageOptionsFor,
  orderVersions,
  pickInitialVersion,
  urlDesignatedVersion,
  type LanguageVersionOption,
  type VersionSelectionInput,
} from "../-utils/course-version-selection";

export interface CourseVersionsState {
  /** off = the site did not opt in (no request is made). */
  status: "off" | "loading" | "ready" | "error";
  /** Every version, merged with course-init, in picker order. */
  versions: CourseLevel[];
  /** The version on screen; null in "off", while loading, or when the course has none. */
  selected: CourseLevel | null;
  /** The invite the selected version is enrolled through. */
  selectedInviteId: string | null;
  /** That invite, once loaded (plans, availability, closed message). */
  invite: OpenEnrollInvite | null;
  /** Language picker segments (fewer than two = no picker). */
  options: LanguageVersionOption[];
  /** Shows another version (the caller mirrors it into the URL). */
  select: (packageSessionId: string) => void;
}

/**
 * The course's versions and the one on screen. Selection is derived from the
 * URL (?packageSessionId / ?enrollInviteId), then the visitor's language, then
 * the first version with an invite — so a shared link, a reload and the
 * Language picker (which writes the URL) all agree. Nothing is fetched while
 * `enabled` is false, which keeps sites that did not opt in on exactly the
 * requests they made before.
 */
export const useCourseVersions = (opts: {
  enabled: boolean;
  instituteId: string;
  courseId: string;
  productPageCode?: string;
  courseInit: CourseInitLike | null;
  urlPackageSessionId?: string;
  urlEnrollInviteId?: string;
  /** Languages that tell versions apart; [] when the site has language versions off. */
  languages: CourseLanguageOption[];
  preferredLanguage: string | null;
}): CourseVersionsState => {
  const {
    enabled,
    instituteId,
    courseId,
    productPageCode,
    courseInit,
    urlPackageSessionId,
    urlEnrollInviteId,
    languages,
    preferredLanguage,
  } = opts;

  const fetchKey = enabled && instituteId && courseId ? `${instituteId}|${courseId}|${productPageCode ?? ""}` : null;

  const [loaded, setLoaded] = useState<{
    key: string;
    levels: CourseLevel[];
    status: "loading" | "ready" | "error";
  } | null>(null);

  useEffect(() => {
    if (!fetchKey) return;
    let cancelled = false;
    setLoaded({ key: fetchKey, levels: [], status: "loading" });
    fetchCourseLevels({ instituteId, courseId, productPageCode })
      .then((levels) => {
        if (!cancelled) setLoaded({ key: fetchKey, levels, status: "ready" });
      })
      .catch((err) => {
        console.warn("[CourseDetailsPage] Course versions unavailable:", err);
        if (!cancelled) setLoaded({ key: fetchKey, levels: [], status: "error" });
      });
    return () => {
      cancelled = true;
    };
    // fetchKey already encodes instituteId / courseId / productPageCode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchKey]);

  // "?enrollInviteId's level" when the link carries a non-default invite: the
  // invite itself says which package sessions it sells. Usually a cache hit
  // (the page fetched this invite for its price).
  const [urlInviteSells, setUrlInviteSells] = useState<{ inviteId: string; ids: string[] } | null>(null);
  useEffect(() => {
    if (!enabled || !instituteId || !urlEnrollInviteId || urlPackageSessionId) return;
    let cancelled = false;
    getOpenEnrollInvite(instituteId, urlEnrollInviteId)
      .then((invite) => {
        if (!cancelled) setUrlInviteSells({ inviteId: urlEnrollInviteId, ids: invitePackageSessionIds(invite) });
      })
      .catch(() => {
        /* the default-invite match still applies */
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, instituteId, urlEnrollInviteId, urlPackageSessionId]);

  const current = loaded && loaded.key === fetchKey ? loaded : null;

  const versions = useMemo(
    () => (current?.status === "ready" ? orderVersions(mergeCourseInit(current.levels, courseInit), languages) : []),
    [current, courseInit, languages],
  );

  // A pick made on this page (instant; the URL catches up a tick later).
  const [picked, setPicked] = useState<{ key: string; packageSessionId: string } | null>(null);
  const select = useCallback(
    (packageSessionId: string) => {
      if (fetchKey) setPicked({ key: fetchKey, packageSessionId });
    },
    [fetchKey],
  );

  const selectionInput = useMemo<VersionSelectionInput>(
    () => ({
      urlPackageSessionId,
      urlEnrollInviteId,
      urlInvitePackageSessionIds:
        urlInviteSells && urlEnrollInviteId && urlInviteSells.inviteId === urlEnrollInviteId
          ? urlInviteSells.ids
          : undefined,
      preferredLanguage,
      languages,
    }),
    [urlPackageSessionId, urlEnrollInviteId, urlInviteSells, preferredLanguage, languages],
  );

  const urlVersion = useMemo(() => urlDesignatedVersion(versions, selectionInput), [versions, selectionInput]);

  const selected = useMemo(() => {
    const pick =
      picked && picked.key === fetchKey ? versions.find((v) => v.packageSessionId === picked.packageSessionId) : undefined;
    return pick ?? pickInitialVersion(versions, selectionInput);
  }, [picked, fetchKey, versions, selectionInput]);

  const selectedInviteId = selected ? effectiveInviteIdFor(selected, urlEnrollInviteId, urlVersion) : null;

  const [inviteState, setInviteState] = useState<{ inviteId: string; invite: OpenEnrollInvite | null } | null>(null);
  useEffect(() => {
    if (!enabled || !instituteId || !selectedInviteId) return;
    let cancelled = false;
    getOpenEnrollInvite(instituteId, selectedInviteId)
      .then((invite) => {
        if (!cancelled) setInviteState({ inviteId: selectedInviteId, invite });
      })
      .catch(() => {
        // The search row's price and availability stay on screen.
        if (!cancelled) setInviteState({ inviteId: selectedInviteId, invite: null });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, instituteId, selectedInviteId]);

  const invite = inviteState && inviteState.inviteId === selectedInviteId ? inviteState.invite : null;

  const options = useMemo(
    () => languageOptionsFor(versions, languages, selected?.packageSessionId),
    [versions, languages, selected],
  );

  const status: CourseVersionsState["status"] = !fetchKey
    ? "off"
    : !current || current.status === "loading"
      ? "loading"
      : current.status;

  return { status, versions, selected, selectedInviteId, invite, options, select };
};
