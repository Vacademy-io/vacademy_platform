import { defaultSignupSettings, type SignupSettings } from "./defaultSignupSettings";

export interface InstituteSignupSettings {
  providers?: {
    google?: boolean;
    github?: boolean;
    emailOtp?: boolean;
    usernamePassword?: boolean; // Backend uses this name
    defaultProvider?: "google" | "github" | "emailOtp";
  };
  googleSignupMode?: "direct" | "askCredentials";
  githubSignupMode?: "direct" | "askCredentials";
  emailOtpSignupMode?: "direct" | "askCredentials";
  usernameStrategy?: "email" | "random" | "manual" | "both" | " ";
  passwordStrategy?: "manual" | "autoRandom" | " ";
  passwordDelivery?: "showOnScreen" | "sendEmail" | " " | "none";
}

export const mapSignupSettings = (
  apiSettings?: InstituteSignupSettings | null
): SignupSettings => {
  if (!apiSettings) {
    console.log('[mapSignupSettings] No API settings provided - using defaults');
    return defaultSignupSettings;
  }

  // Backend settings received

  // Check if backend has any provider settings at all
  const hasAnyProviderSettings = apiSettings.providers && 
    (apiSettings.providers.google !== undefined || 
     apiSettings.providers.github !== undefined || 
     apiSettings.providers.emailOtp !== undefined ||
     apiSettings.providers.usernamePassword !== undefined);

  // Check if backend explicitly disables ALL providers (intentional signup disable)
  const hasExplicitDisableAll = apiSettings.providers && 
    apiSettings.providers.google === false && 
    apiSettings.providers.github === false && 
    apiSettings.providers.emailOtp === false &&
    apiSettings.providers.usernamePassword === false;

  let mergedProviders: SignupSettings["providers"];

  if (hasExplicitDisableAll) {
    // Backend explicitly disabled ALL providers - respect this completely
          // Backend explicitly disabled all signup providers
      mergedProviders = {
        google: false,
        github: false,
        emailOtp: false,
        defaultProvider: "emailOtp" as const,
      };
  } else if (hasAnyProviderSettings) {
    // Backend has some provider settings - merge with defaults intelligently
    // Backend has partial provider settings - merging with defaults
    mergedProviders = {
      ...defaultSignupSettings.providers, // Start with defaults
      ...apiSettings.providers, // Override with any explicit backend values
      // Handle emailOtp/usernamePassword mapping
      emailOtp: apiSettings.providers?.emailOtp ?? 
                apiSettings.providers?.usernamePassword ?? 
                defaultSignupSettings.providers.emailOtp,
    };
  } else {
    // Backend has no provider settings at all - use defaults completely
    // No backend provider settings - using defaults completely
    mergedProviders = {
      ...defaultSignupSettings.providers,
    };
  }

  // Merged provider settings completed

  // Ensure all provider flags are boolean
  Object.keys(mergedProviders).forEach((key) => {
    if (key !== "defaultProvider") {
      mergedProviders[key as keyof Omit<typeof mergedProviders, "defaultProvider">] = 
        Boolean(mergedProviders[key as keyof Omit<typeof mergedProviders, "defaultProvider">]);
    }
  });

  // Check if any providers are enabled
  const enabledProviders = Object.entries(mergedProviders)
    .filter(([key, value]) => key !== "defaultProvider" && value === true)
    .map(([key]) => key);

  // Enabled providers: ${enabledProviders.length}

  // If no providers are enabled, this means signup is disabled
  if (enabledProviders.length === 0) {
    console.warn('[mapSignupSettings] All signup providers are disabled - signup will not be available');
    
          // Return settings with all providers disabled
      return {
        providers: {
          google: false,
          github: false,
          emailOtp: false,
          defaultProvider: "emailOtp" as const,
        },
      googleSignupMode: "askCredentials",
      githubSignupMode: "askCredentials",
      emailOtpSignupMode: "askCredentials",
      usernameStrategy: "manual",
      passwordStrategy: "manual",
      passwordDelivery: "none",
    };
  }

  // Validate defaultProvider is one of the enabled providers
  if (mergedProviders.defaultProvider && enabledProviders.length > 0) {
    if (!enabledProviders.includes(mergedProviders.defaultProvider)) {
      // If default provider is not enabled, use the first enabled provider
      mergedProviders.defaultProvider = enabledProviders[0] as SignupSettings["providers"]["defaultProvider"];
      console.log('[mapSignupSettings] Updated defaultProvider to:', mergedProviders.defaultProvider);
    }
  }

  // Map username strategy with proper validation
  let usernameStrategy = defaultSignupSettings.usernameStrategy;
  if (apiSettings.usernameStrategy) {
    if (["email", "random", "manual", "both", " "].includes(apiSettings.usernameStrategy)) {
      usernameStrategy = apiSettings.usernameStrategy as SignupSettings["usernameStrategy"];
    } else {
      console.warn('[mapSignupSettings] Invalid usernameStrategy from backend:', apiSettings.usernameStrategy);
    }
  }

  // Map password strategy with proper validation
  let passwordStrategy = defaultSignupSettings.passwordStrategy;
  if (apiSettings.passwordStrategy) {
    if (["manual", "autoRandom", " "].includes(apiSettings.passwordStrategy)) {
      passwordStrategy = apiSettings.passwordStrategy as SignupSettings["passwordStrategy"];
    } else {
      console.warn('[mapSignupSettings] Invalid passwordStrategy from backend:', apiSettings.passwordStrategy);
    }
  }

  const result = {
    providers: mergedProviders as SignupSettings["providers"],
    googleSignupMode: apiSettings.googleSignupMode || defaultSignupSettings.googleSignupMode,
    githubSignupMode: apiSettings.githubSignupMode || defaultSignupSettings.githubSignupMode,
    emailOtpSignupMode: apiSettings.emailOtpSignupMode || defaultSignupSettings.emailOtpSignupMode,
    usernameStrategy,
    passwordStrategy,
    passwordDelivery: apiSettings.passwordDelivery || defaultSignupSettings.passwordDelivery,
  };

  return result;
};
