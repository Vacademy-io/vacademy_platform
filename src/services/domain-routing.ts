import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { BASE_URL } from "../constants/urls";
import { getDomainAndSubdomain } from "../utils/platform-flavor";
import { getPublicUrlWithoutLogin } from "@/services/upload_file";

export interface DomainRoutingResponse {
  instituteId: string;
  instituteName: string;
  instituteLogoFileId: string;
  instituteThemeCode: string;
  role: string;
  redirect: string;
  // New optional fields for institute policy URLs
  privacyPolicyUrl?: string | null;
  termsAndConditionUrl?: string | null;
  // Optional theme and font settings for pre-login branding
  theme?: string | null;
  fontFamily?: string | null;
  // Optional signup visibility
  allowSignup?: boolean | null;
  // Optional tab branding
  tabText?: string | null;
  tabIconFileId?: string | null;
  homeIconClickRoute?: string | null;
  // Login provider toggles
  allowGoogleAuth?: boolean | null;
  allowGithubAuth?: boolean | null;
  allowEmailOtpAuth?: boolean | null;
  allowUsernamePasswordAuth?: boolean | null;
}

export interface DomainRoutingError {
  status: number;
  message: string;
}

export interface CachedInstituteBranding {
  instituteId: string | null;
  instituteName: string | null;
  instituteLogoFileId: string | null;
  instituteLogoUrl: string | null;
  instituteThemeCode: string | null;
  homeIconClickRoute: string | null;
}

const BRANDING_CACHE_KEY = "InstituteBranding";
let cachedBrandingMemory: CachedInstituteBranding | null = null;

export const resolveDomainRouting = async (
  domain: string,
  subdomain: string
): Promise<DomainRoutingResponse | null> => {

  try {
    // Resolving domain routing for: ${domain}:${subdomain}

    const response = await authenticatedAxiosInstance.get<DomainRoutingResponse>(
      `${BASE_URL}/admin-core-service/public/domain-routing/v1/resolve`,
      {
        params: { domain, subdomain },
        timeout: 10000, // 10 second timeout
      }
    );

    const data = response.data;

    // Successfully resolved domain routing
    return data;
  } catch (error: unknown) {
    // Type guard for axios error
    const isAxiosError = (
      err: unknown
    ): err is { response?: { status: number }; message: string } => {
      return typeof err === "object" && err !== null && "response" in err;
    };

    if (isAxiosError(error) && error.response?.status === 404) {
      // No institute found for domain/subdomain: ${domain}:${subdomain}
      return null;
    }

    console.error("[Domain Routing] API error:", error);
    const errorMessage = isAxiosError(error) ? error.message : "Unknown error";
    throw new Error(`Domain routing API error: ${errorMessage}`);
  }
};

// Helper function to get domain and subdomain from current location
export const getCurrentDomainInfo = async () => {
  // Use the platform-aware domain resolution
  return await getDomainAndSubdomain();
};

const canUseLocalStorage = (): boolean => {
  return typeof window !== "undefined" && !!window?.localStorage;
};

const normalizeBranding = (
  branding?: Partial<CachedInstituteBranding> | null
): CachedInstituteBranding => ({
  instituteId: branding?.instituteId ?? null,
  instituteName: branding?.instituteName ?? null,
  instituteLogoFileId: branding?.instituteLogoFileId ?? null,
  instituteLogoUrl: branding?.instituteLogoUrl ?? null,
  instituteThemeCode: branding?.instituteThemeCode ?? null,
  homeIconClickRoute: branding?.homeIconClickRoute ?? null,
});

const readBrandingFromStorage = (): CachedInstituteBranding | null => {
  if (!canUseLocalStorage()) {
    return null;
  }

  try {
    const stored = window.localStorage.getItem(BRANDING_CACHE_KEY);
    if (!stored) {
      return null;
    }

    return normalizeBranding(JSON.parse(stored));
  } catch (error) {
    console.warn("[Domain Routing] Failed to parse branding cache:", error);
    window.localStorage.removeItem(BRANDING_CACHE_KEY);
    return null;
  }
};

const deriveBrandingFromInstituteDetails = (): CachedInstituteBranding | null => {
  if (!canUseLocalStorage()) {
    return null;
  }

  try {
    const stored = window.localStorage.getItem("InstituteDetails");
    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored);
    return normalizeBranding({
      instituteId: parsed?.id ?? parsed?.instituteId ?? null,
      instituteName: parsed?.institute_name ?? parsed?.instituteName ?? null,
      instituteLogoFileId:
        parsed?.institute_logo_file_id ?? parsed?.instituteLogoFileId ?? null,
      instituteLogoUrl: parsed?.instituteLogoUrl ?? null,
      instituteThemeCode:
        parsed?.institute_theme_code ?? parsed?.instituteThemeCode ?? null,
      homeIconClickRoute:
        parsed?.home_icon_click_route ?? parsed?.homeIconClickRoute ?? null,
    });
  } catch (error) {
    console.warn(
      "[Domain Routing] Failed to derive branding from InstituteDetails:",
      error
    );
    return null;
  }
};

export const getCachedInstituteBranding = (): CachedInstituteBranding | null => {
  if (cachedBrandingMemory) {
    return cachedBrandingMemory;
  }

  const stored = readBrandingFromStorage();
  if (stored) {
    cachedBrandingMemory = stored;
    return stored;
  }

  const derived = deriveBrandingFromInstituteDetails();
  if (derived) {
    setCachedInstituteBranding(derived);
    return derived;
  }

  return null;
};

export const setCachedInstituteBranding = (
  branding: Partial<CachedInstituteBranding> | null
) => {
  if (!branding) {
    cachedBrandingMemory = null;
  } else {
    cachedBrandingMemory = normalizeBranding(branding);
  }

  if (!canUseLocalStorage()) {
    return;
  }

  try {
    if (!branding) {
      window.localStorage.removeItem(BRANDING_CACHE_KEY);
      return;
    }

    window.localStorage.setItem(
      BRANDING_CACHE_KEY,
      JSON.stringify(cachedBrandingMemory)
    );
  } catch (error) {
    console.warn("[Domain Routing] Failed to persist branding cache:", error);
  }
};

export const updateCachedInstituteBranding = (
  partialBranding: Partial<CachedInstituteBranding>
) => {
  const existing = getCachedInstituteBranding();
  const merged = normalizeBranding({ ...existing, ...partialBranding });
  setCachedInstituteBranding(merged);
};

export const getPublicUrl = async (
  fileId: string | undefined | null
): Promise<string> => {
  if (!fileId) {
    return "";
  }

  try {
    return await getPublicUrlWithoutLogin(fileId);
  } catch (error) {
    console.error("[Domain Routing] Failed to resolve public URL:", error);
    return "";
  }
};

// Client-side cache now handled centrally by axios + in-memory cache
