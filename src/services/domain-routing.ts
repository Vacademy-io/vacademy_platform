import axios from "axios";
import { Preferences } from "@capacitor/preferences";
import { BASE_URL } from "../constants/urls";

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
const domainRoutingCache = new Map<string, { data: DomainRoutingResponse; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const resolveDomainRouting = async (
  domain: string,
  subdomain: string
): Promise<DomainRoutingResponse | null> => {
  const cacheKey = `${domain}:${subdomain}`;
  
  // Check cache first
  const cached = domainRoutingCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log("[Domain Routing] Using cached response for:", cacheKey);
    return cached.data;
  }

  try {
    console.log("[Domain Routing] Resolving domain routing for:", { domain, subdomain });
    
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
    
    console.log("[Domain Routing] Successfully resolved:", data);
    return data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      console.log("[Domain Routing] No institute found for domain/subdomain:", { domain, subdomain });
      return null;
    }
    
    console.error("[Domain Routing] API error:", error);
    throw new Error(`Domain routing API error: ${error.message}`);
  }
};

// Helper function to get domain and subdomain from current location
export const getCurrentDomainInfo = () => {
  const hostname = window.location.hostname;
  const parts = hostname.split(".");
  
  // Special handling for localhost subdomains
  if (hostname.includes("localhost")) {
    if (parts.length >= 2 && parts[0] !== "localhost") {
      // e.g., pp.localhost -> subdomain: pp, domain: localhost
      const subdomain = parts[0];
      const domain = parts.slice(1).join(".");
      return { domain, subdomain };
    } else {
      // e.g., localhost -> subdomain: null, domain: localhost
      return { domain: "localhost", subdomain: null };
    }
  }
  
  // Standard domain handling
  if (parts.length >= 3) {
    // e.g., code-circle.vacademy.io -> subdomain: code-circle, domain: vacademy.io
    const subdomain = parts[0];
    const domain = parts.slice(1).join(".");
    return { domain, subdomain };
  } else if (parts.length === 2) {
    // e.g., vacademy.io -> subdomain: null, domain: vacademy.io
    const domain = hostname;
    return { domain, subdomain: null };
  }
  
  // Fallback for other cases
  return { domain: hostname, subdomain: null };
};

// Clear cache (useful for testing or when cache becomes stale)
export const clearDomainRoutingCache = () => {
  domainRoutingCache.clear();
  console.log("[Domain Routing] Cache cleared");
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
