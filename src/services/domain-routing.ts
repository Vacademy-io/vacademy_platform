import axios from "axios";
import { BASE_URL } from "../constants/urls";
import { getDomainAndSubdomain } from "../utils/platform-flavor";

export interface DomainRoutingResponse {
  instituteId: string;
  instituteName: string;
  instituteLogoFileId: string;
  instituteThemeCode: string;
  role: string;
  redirect: string;
}

export interface DomainRoutingError {
  status: number;
  message: string;
}

// Cache for domain routing responses
const domainRoutingCache = new Map<
  string,
  { data: DomainRoutingResponse; timestamp: number }
>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const resolveDomainRouting = async (
  domain: string,
  subdomain: string
): Promise<DomainRoutingResponse | null> => {
  const cacheKey = `${domain}:${subdomain}`;

  // Check cache first
  const cached = domainRoutingCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    // Resolving domain routing for: ${domain}:${subdomain}

    const response = await axios.get<DomainRoutingResponse>(
      `${BASE_URL}/admin-core-service/public/domain-routing/v1/resolve`,
      {
        params: { domain, subdomain },
        timeout: 10000, // 10 second timeout
      }
    );

    const data = response.data;

    // Cache the successful response
    domainRoutingCache.set(cacheKey, { data, timestamp: Date.now() });

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

// Clear cache (useful for testing or when cache becomes stale)
export const clearDomainRoutingCache = () => {
  domainRoutingCache.clear();
  // Domain routing cache cleared
};

// Get cached data for debugging
export const getDomainRoutingCacheInfo = () => {
  return {
    size: domainRoutingCache.size,
    entries: Array.from(domainRoutingCache.entries()).map(([key, value]) => ({
      key,
      timestamp: value.timestamp,
      age: Date.now() - value.timestamp,
    })),
  };
};
