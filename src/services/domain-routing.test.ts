// Simple test file for domain routing service
// This can be run manually to test the API integration

import { resolveDomainRouting, getCurrentDomainInfo } from "./domain-routing";

// Test function that can be called manually
export const testDomainRouting = async () => {
  console.log("Testing domain routing service...");
  
  try {
    // Test current domain info
    const domainInfo = getCurrentDomainInfo();
    console.log("Current domain info:", domainInfo);
    
    // Test API call with current domain/subdomain
    const subdomain = domainInfo.subdomain || "*";
    const result = await resolveDomainRouting(domainInfo.domain, subdomain);
    console.log("Domain routing result:", result);
    return result;
  } catch (error) {
    console.error("Domain routing test failed:", error);
    return null;
  }
};

// Test localhost subdomain specifically
export const testLocalhostSubdomain = async (subdomain: string = "pp") => {
  console.log(`Testing localhost subdomain: ${subdomain}`);
  
  try {
    const result = await resolveDomainRouting("localhost", subdomain);
    console.log("Domain routing result:", result);
    return result;
  } catch (error) {
    console.error("Domain routing test failed:", error);
    return null;
  }
};

// Test with specific subdomain
export const testDomainRoutingWithSubdomain = async (subdomain: string = "code-circle") => {
  console.log(`Testing domain routing with subdomain: ${subdomain}`);
  
  try {
    const result = await resolveDomainRouting("vacademy.io", subdomain);
    console.log("Domain routing result:", result);
    return result;
  } catch (error) {
    console.error("Domain routing test failed:", error);
    return null;
  }
};

// Test main domain (no subdomain)
export const testMainDomainRouting = async () => {
  console.log("Testing domain routing for main domain (no subdomain)");
  
  try {
    const result = await resolveDomainRouting("vacademy.io", "*");
    console.log("Domain routing result:", result);
    return result;
  } catch (error) {
    console.error("Domain routing test failed:", error);
    return null;
  }
};

// Export for manual testing
if (typeof window !== "undefined") {
  (window as unknown as { testDomainRouting: typeof testDomainRouting }).testDomainRouting = testDomainRouting;
  (window as unknown as { testDomainRoutingWithSubdomain: typeof testDomainRoutingWithSubdomain }).testDomainRoutingWithSubdomain = testDomainRoutingWithSubdomain;
  (window as unknown as { testMainDomainRouting: typeof testMainDomainRouting }).testMainDomainRouting = testMainDomainRouting;
  (window as unknown as { testLocalhostSubdomain: typeof testLocalhostSubdomain }).testLocalhostSubdomain = testLocalhostSubdomain;
}
