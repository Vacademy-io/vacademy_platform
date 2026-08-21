import { Preferences } from "@capacitor/preferences";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { LEARNER_BATCH_DETAIL } from "@/constants/urls";
import { getInstituteDetails } from "@/services/signup-api";
import { getInstituteId } from "@/utils/study-library/get-list-from-stores/getPackageSessionId";
import {
  parseCourseSettingsDripConditions,
  type ResolvedDripConditions,
} from "@/utils/drip-conditions";

const DRIP_SETTINGS_REFRESHED_AT_KEY = "DripSettingsRefreshedAt";
const DRIP_SETTINGS_CACHE_KEY = "DripSettingsSnapshot";
const DRIP_SETTINGS_TTL_MS = 30 * 60 * 1000;

/**
 * Drip configuration as the admin saved it, read out of the institute-settings
 * blob already cached on the device. No network call: the catalogue and the
 * course page both need this before their first paint.
 */
export const readInstituteDripSettings =
  async (): Promise<ResolvedDripConditions> => {
    try {
      // Our own snapshot first when we have one, then the login-time copy.
      const snapshot = await Preferences.get({ key: DRIP_SETTINGS_CACHE_KEY });
      if (snapshot?.value) {
        return parseCourseSettingsDripConditions(snapshot.value);
      }

      const stored = await Preferences.get({ key: "InstituteDetails" });
      const raw = stored?.value;
      if (!raw || raw === "undefined" || raw === "null") {
        return { enabled: false, applyConfiguredRules: false, conditions: [] };
      }
      const parsed = JSON.parse(raw) as { institute_settings_json?: string };
      return parseCourseSettingsDripConditions(parsed.institute_settings_json);
    } catch (error) {
      console.warn("[Drip] failed to read institute drip settings", error);
      return { enabled: false, applyConfiguredRules: false, conditions: [] };
    }
  };

/**
 * The backend field is spelled `enrollMentDate` (sic) and serialised with
 * Jackson's snake-case strategy, so it arrives as `enroll_ment_date`. The
 * other spellings are accepted because that typo is one rename away from
 * changing, and a silently-null anchor would quietly unlock a whole schedule.
 */
const settingsAreStale = async (): Promise<boolean> => {
  try {
    const stamp = await Preferences.get({ key: DRIP_SETTINGS_REFRESHED_AT_KEY });
    const last = Number(stamp?.value ?? 0);
    return !last || Date.now() - last > DRIP_SETTINGS_TTL_MS;
  } catch {
    return true;
  }
};

/**
 * Re-read the institute settings from the server when the cached copy has gone
 * stale, and return the refreshed drip configuration.
 *
 * The cached blob is otherwise only written at login, so a learner who stays
 * signed in for weeks — the normal case on the mobile app — would never see a
 * schedule the admin turned on yesterday. Returns null when nothing was
 * refreshed, so callers can keep what they already had.
 */
// The course page and the slide viewer both mount the drip hook, and the
// course page can mount it twice — without this the same refresh fires two or
// three times on one navigation, because the TTL stamp is only written once
// the first request has already come back.
let refreshInFlight: Promise<ResolvedDripConditions | null> | null = null;

export const refreshInstituteDripSettings =
  (): Promise<ResolvedDripConditions | null> => {
    if (!refreshInFlight) {
      refreshInFlight = doRefreshInstituteDripSettings().finally(() => {
        refreshInFlight = null;
      });
    }
    return refreshInFlight;
  };

const doRefreshInstituteDripSettings =
  async (): Promise<ResolvedDripConditions | null> => {
    try {
      if (!(await settingsAreStale())) return null;
      const instituteId = await getInstituteId();
      if (!instituteId) return null;

      const details = await getInstituteDetails(instituteId);
      const setting = (details as { setting?: string } | null)?.setting;
      if (!setting) return null;

      // Cached under a key of our own rather than written back into
      // InstituteDetails.institute_settings_json. That blob also carries
      // naming, theme, catalogue permissions and display settings, all of
      // which other screens read from the copy written at login — refreshing
      // it here would quietly change those too, which is well outside what
      // this feature is allowed to touch.
      await Preferences.set({ key: DRIP_SETTINGS_CACHE_KEY, value: setting });
      await Preferences.set({
        key: DRIP_SETTINGS_REFRESHED_AT_KEY,
        value: String(Date.now()),
      });
      return parseCourseSettingsDripConditions(setting);
    } catch (error) {
      console.warn("[Drip] institute settings refresh failed", error);
      return null;
    }
  };

interface BatchDetailResponse {
  enroll_ment_date?: string | null;
  enrollment_date?: string | null;
  enrolled_date?: string | null;
  enrollMentDate?: string | null;
  expiry_date?: string | null;
  session?: { start_date?: string | null; startDate?: string | null } | null;
}

export interface EnrollmentAnchor {
  enrollmentDate: string | null;
  sessionStartDate: string | null;
}

/**
 * When the learner's access to this batch started, and when the batch itself
 * started — the two anchors a day-wise drip schedule can count from.
 *
 * Returns nulls rather than throwing: a learner with no active mapping (or a
 * blipping network) must not end up staring at a fully locked course.
 */
export const fetchEnrollmentAnchor = async (
  instituteId: string,
  packageSessionId: string,
): Promise<EnrollmentAnchor> => {
  try {
    const { data } = await authenticatedAxiosInstance.get<BatchDetailResponse>(
      LEARNER_BATCH_DETAIL,
      { params: { instituteId, packageSessionId } },
    );
    return {
      enrollmentDate:
        data?.enroll_ment_date ??
        data?.enrollment_date ??
        data?.enrolled_date ??
        data?.enrollMentDate ??
        null,
      sessionStartDate:
        data?.session?.start_date ?? data?.session?.startDate ?? null,
    };
  } catch (error) {
    console.warn("[Drip] enrollment anchor lookup failed", error);
    return { enrollmentDate: null, sessionStartDate: null };
  }
};
