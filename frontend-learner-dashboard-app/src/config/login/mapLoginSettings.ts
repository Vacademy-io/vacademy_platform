import { defaultLoginSettings, LoginSettings } from "./defaultLoginSettings";

export interface InstituteLoginSettings {
  providers?: {
    google?: boolean;
    github?: boolean;
    usernamePassword?: boolean;
    emailOtp?: boolean;
    defaultProvider?: "google" | "github" | "usernamePassword" | "emailOtp";
  };
  usernameStrategy?: "email" | "username" | "both" | "manual";
  passwordStrategy?: "manual" | "auto" | "none";
  passwordDelivery?: "email" | "sms" | "none";
}

export const mapLoginSettings = (
  apiSettings?: InstituteLoginSettings | null
): LoginSettings => {
  if (!apiSettings) {
    return defaultLoginSettings;
  }



  // Only enable providers that are explicitly enabled in institute settings
  // Don't merge with defaults - respect the actual institute configuration
  const mergedProviders = {
    google: apiSettings.providers?.google ?? false,
    github: apiSettings.providers?.github ?? false,
    // For login: respect both emailOtp and usernamePassword settings independently
    // emailOtp: true enables email OTP login
    // usernamePassword: true enables username/password login
    emailOtp: apiSettings.providers?.emailOtp ?? false,
    usernamePassword: apiSettings.providers?.usernamePassword ?? false,
    defaultProvider: apiSettings.providers?.defaultProvider ?? "usernamePassword",
  };

  // Ensure all provider flags are boolean
  Object.keys(mergedProviders).forEach((key) => {
    if (key !== "defaultProvider") {
      mergedProviders[key as keyof Omit<typeof mergedProviders, "defaultProvider">] = 
        Boolean(mergedProviders[key as keyof Omit<typeof mergedProviders, "defaultProvider">]);
    }
  });

  // Ensure at least one provider is enabled by checking if any are true
  const enabledProviders = Object.entries(mergedProviders)
    .filter(([key, value]) => key !== "defaultProvider" && value === true)
    .map(([key]) => key);

  // If no providers are enabled, fall back to defaults
  if (enabledProviders.length === 0) {
    return defaultLoginSettings;
  }

  // Validate defaultProvider is one of the enabled providers
  if (mergedProviders.defaultProvider && !enabledProviders.includes(mergedProviders.defaultProvider)) {
    // If default provider is not enabled, use the first enabled provider
    mergedProviders.defaultProvider = enabledProviders[0] as LoginSettings["providers"]["defaultProvider"];
  }

  const result = {
    providers: mergedProviders as LoginSettings["providers"],
    usernameStrategy: apiSettings.usernameStrategy ?? defaultLoginSettings.usernameStrategy,
    passwordStrategy: apiSettings.passwordStrategy ?? defaultLoginSettings.passwordStrategy,
    passwordDelivery: apiSettings.passwordDelivery ?? defaultLoginSettings.passwordDelivery,
  };



  return result;
};
