// "View as my child" — a full session swap. The parent's own session is backed
// up (never overwritten) and restored on exit; while active, the app runs as the
// child (its own minted token) so every learner screen/API works unchanged.
//
// Read-only is advisory on the client for v1 (the minted token is a full learner
// token). Server-enforced GET-only via a delegation `act` claim in JwtAuthFilter
// is the documented hardening follow-up.

import { TokenKey } from "@/constants/auth/tokens";
import {
  setTokenInStorage,
  getTokenFromStorage,
  getTokenDecodedData,
} from "@/lib/auth/sessionUtility";
import { fetchAndStoreInstituteDetails } from "@/services/fetchAndStoreInstituteDetails";
import { fetchAndStoreStudentDetails } from "@/services/studentDetails";

const FLAG = "childViewActive";
const NAME = "childViewName";
const BK = {
  access: "parentBackup.accessToken",
  refresh: "parentBackup.refreshToken",
  student: "parentBackup.StudentDetails",
  institute: "parentBackup.InstituteDetails",
  instituteId: "parentBackup.InstituteId",
} as const;

export function isChildViewActive(): boolean {
  try {
    return localStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
}

export function getChildViewName(): string {
  try {
    return localStorage.getItem(NAME) || "";
  } catch {
    return "";
  }
}

export interface ChildViewSession {
  childUserId: string;
  childName: string;
  accessToken: string;
  refreshToken?: string | null;
}

function backup(bkKey: string, key: string) {
  const v = localStorage.getItem(key);
  if (v != null) localStorage.setItem(bkKey, v);
}

function restore(bkKey: string, key: string) {
  const v = localStorage.getItem(bkKey);
  if (v != null) localStorage.setItem(key, v);
  else localStorage.removeItem(key);
}

function safeRemove(k: string) {
  try {
    localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}

/** Start viewing as the child: back up the parent, become the child, reload. */
export async function startChildView(session: ChildViewSession): Promise<void> {
  // 1) Back up the PARENT session so it survives and can be restored on exit.
  const [pa, pr] = await Promise.all([
    getTokenFromStorage(TokenKey.accessToken),
    getTokenFromStorage(TokenKey.refreshToken),
  ]);
  if (pa) localStorage.setItem(BK.access, pa);
  if (pr) localStorage.setItem(BK.refresh, pr);
  backup(BK.student, "StudentDetails");
  backup(BK.institute, "InstituteDetails");
  backup(BK.instituteId, "InstituteId");

  // 2) Become the child (all token stores).
  await setTokenInStorage(TokenKey.accessToken, session.accessToken);
  if (session.refreshToken) await setTokenInStorage(TokenKey.refreshToken, session.refreshToken);
  localStorage.removeItem("StudentDetails");
  localStorage.removeItem("InstituteDetails");

  // 3) Hydrate the child's details with the now-active child token. Institute id
  //    comes from the minted token's authorities (the child's one institute).
  const decoded = getTokenDecodedData(session.accessToken) as
    | { authorities?: Record<string, unknown> }
    | null;
  const instituteId = decoded?.authorities ? Object.keys(decoded.authorities)[0] : undefined;
  if (instituteId) {
    try {
      await fetchAndStoreInstituteDetails(instituteId, session.childUserId);
      await fetchAndStoreStudentDetails(instituteId, session.childUserId);
    } catch (e) {
      console.warn("[childView] hydrate failed", e);
    }
  }

  // 4) Mark active and hard-reload into the learner dashboard for a clean state.
  localStorage.setItem(FLAG, "1");
  localStorage.setItem(NAME, session.childName);
  window.location.href = "/dashboard";
}

/** Exit child view: restore the parent session and return to the parent portal. */
export async function exitChildView(): Promise<void> {
  const pa = localStorage.getItem(BK.access);
  const pr = localStorage.getItem(BK.refresh);
  if (pa) await setTokenInStorage(TokenKey.accessToken, pa);
  if (pr) await setTokenInStorage(TokenKey.refreshToken, pr);
  restore(BK.student, "StudentDetails");
  restore(BK.institute, "InstituteDetails");
  restore(BK.instituteId, "InstituteId");
  [FLAG, NAME, BK.access, BK.refresh, BK.student, BK.institute, BK.instituteId].forEach(safeRemove);
  window.location.href = "/parent/child";
}
