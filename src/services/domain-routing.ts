import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { BASE_URL } from "../constants/urls";
import { getDomainAndSubdomain } from "../utils/platform-flavor";

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

// Client-side cache now handled centrally by axios + in-memory cache
