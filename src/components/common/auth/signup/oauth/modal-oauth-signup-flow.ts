import { toast } from "sonner";
import { Preferences } from "@capacitor/preferences";
import { TokenKey } from "@/constants/auth/tokens";
import { getTokenDecodedData } from "@/lib/auth/sessionUtility";
import { fetchAndStoreInstituteDetails } from "@/services/fetchAndStoreInstituteDetails";
import { fetchAndStoreStudentDetails } from "@/services/studentDetails";
import {
  getUserDetailsByEmail,
  getInstituteDetails,
  parseInstituteSettings,
  registerUser,
  type RegisterUserRequest,
} from "@/services/signup-api";

type DecodedState = {
  redirectTo?: string;
  currentUrl?: string;
  type?: string;
  courseId?: string;
  institute_id?: string;
  isModalSignup?: boolean;
};

type SignupPayload = {
  name?: string;
  email?: string;
  profile?: string;
  sub?: string;
  provider?: "google" | "github" | string;
};

function robustDecodeBase64Param(param: string): string {
  try {
    return atob(param);
  } catch {
    try {
      return atob(decodeURIComponent(param));
    } catch {
      return "";
    }
  }
}

function generateUsername(name?: string, email?: string): string {
  const base = (email?.split("@")[0] || name || "user").toLowerCase();
  const sanitized = base.replace(/[^a-z0-9]+/g, "").slice(0, 18) || "user";
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${sanitized}${suffix}`;
}

export async function processModalOAuthSignup() {
  const urlParams = new URLSearchParams(window.location.search);
  const stateParam = urlParams.get("state") || "";
  const signupDataParam = urlParams.get("signupData") || "";
  const emailVerified = urlParams.get("emailVerified");

  // Decode state
  let state: DecodedState = {};
  if (stateParam) {
    try {
      const decodedState = robustDecodeBase64Param(stateParam);
      state = JSON.parse(decodedState) as DecodedState;
    } catch (err) {
      // proceed with defaults
    }
  }

  // Decode signup payload
  let payload: SignupPayload = {};
  if (signupDataParam) {
    try {
      const decoded = robustDecodeBase64Param(signupDataParam);
      payload = JSON.parse(decoded) as SignupPayload;
    } catch (err) {
      toast.error("Invalid signup data. Please try again.");
      // Return to signup with modal open for retry - use window.location to avoid navigation conflicts
      const signupUrl = new URL(window.location.origin + "/signup");
      signupUrl.searchParams.set("openModal", "true");
      signupUrl.searchParams.set("fromOAuth", "true");
      if (state.type) signupUrl.searchParams.set("type", state.type);
      if (state.courseId) signupUrl.searchParams.set("courseId", state.courseId);
      if (state.institute_id) signupUrl.searchParams.set("instituteId", state.institute_id);
      window.location.href = signupUrl.toString();
      return;
    }
  }

  // Validate email presence and verification for GitHub
  const provider = payload.provider;
  const hasEmail = Boolean(payload.email);
  const isEmailVerified = emailVerified === "true";

  if (provider === "github" && (!hasEmail || !isEmailVerified)) {
    toast.error("Missing email from GitHub. Make your email public or try another method.");
    const signupUrl = new URL(window.location.origin + "/signup");
    signupUrl.searchParams.set("openModal", "true");
    signupUrl.searchParams.set("fromOAuth", "true");
    if (state.type) signupUrl.searchParams.set("type", state.type);
    if (state.courseId) signupUrl.searchParams.set("courseId", state.courseId);
    if (state.institute_id) signupUrl.searchParams.set("instituteId", state.institute_id);
    window.location.href = signupUrl.toString();
    return;
  }

  // Require institute context
  const instituteId = state.institute_id;
  if (!instituteId) {
    toast.error("Missing institute information. Please try again.");
    window.history.back();
    return;
  }

  try {
    // Fetch institute settings to determine roles
    const instituteDetails = await getInstituteDetails(instituteId);
    const settings = parseInstituteSettings(instituteDetails.setting);
    const userRoles: string[] = ["STUDENT"];
    if (settings?.learnersCanCreateCourses) {
      userRoles.push("TEACHER");
    }

    let registrationData: RegisterUserRequest | null = null;

    try {
      // Check if user exists by email
      const existing = await getUserDetailsByEmail(payload.email || "");
      registrationData = {
        user: {
          username: existing.username,
          email: existing.email,
          full_name: existing.full_name,
          password: existing.password || "",
          roles: userRoles,
          root_user: false,
        },
        institute_id: instituteId,
        learner_package_session_enroll: null,
      };
    } catch (err: unknown) {
      // If user not found, register new using OAuth data
      const username = generateUsername(payload.name, payload.email);
      registrationData = {
        user: {
          username,
          email: payload.email || "",
          full_name: payload.name || username,
          password: "",
          roles: userRoles,
          root_user: false,
        },
        institute_id: instituteId,
        learner_package_session_enroll: null,
      };
    }

    // Perform registration/enrollment which returns tokens
    const response = await registerUser(registrationData);

    // Store tokens directly (no navigate call to avoid conflicts)
    await Preferences.set({ key: TokenKey.accessToken, value: response.accessToken });
    await Preferences.set({ key: TokenKey.refreshToken, value: response.refreshToken });
    await Preferences.set({ key: "instituteId", value: instituteId });

    // Decode token to get user ID
    const decodedData = getTokenDecodedData(response.accessToken);
    const userId = decodedData?.user;

    if (!userId) {
      throw new Error("Invalid user data in token");
    }

    // Fetch and store institute details
    await fetchAndStoreInstituteDetails(instituteId, userId);
    await fetchAndStoreStudentDetails(instituteId, userId);

    // Show success message
    toast.success("Successfully signed up and logged in!");

    // Determine redirect URL based on context - redirect in same tab
    let redirectUrl = "/dashboard";
    if (state.type === "courseDetailsPage" && state.courseId) {
      redirectUrl = `/study-library/courses/course-details?courseId=${state.courseId}&selectedTab=ALL`;
    } else if (state.type === "courseDetailsPage") {
      redirectUrl = "/study-library/courses";
    } else if (state.redirectTo) {
      redirectUrl = state.redirectTo;
    }

    // Redirect in the same tab - no new tabs opened
    window.location.href = redirectUrl;
  } catch (err) {
    toast.error("Failed to complete signup. Please try again.");
    window.history.back();
  }
}



