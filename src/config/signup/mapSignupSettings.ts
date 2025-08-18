import { defaultSignupSettings, type SignupSettings } from "./defaultSignupSettings";

export interface InstituteSignupSettings {
  providers?: {
    google?: boolean;
    github?: boolean;
    emailOtp?: boolean;
    defaultProvider?: "google" | "github" | "emailOtp";
  };
  googleSignupMode?: "direct" | "askCredentials";
  githubSignupMode?: "direct" | "askCredentials";
  emailOtpSignupMode?: "direct" | "askCredentials";
  usernameStrategy?: "email" | "username" | "both";
  passwordStrategy?: "manual" | "auto" | "none";
  passwordDelivery?: "email" | "sms" | "none";
}

export const mapSignupSettings = (
  apiSettings?: InstituteSignupSettings | null
): SignupSettings => {
  if (!apiSettings) {
    return defaultSignupSettings;
  }

  // Merge providers with defaults
  const mergedProviders = {
    ...defaultSignupSettings.providers,
    ...apiSettings.providers,
  };

  // Ensure all provider flags are boolean
  Object.keys(mergedProviders).forEach((key) => {
    if (key !== "defaultProvider") {
      mergedProviders[key as keyof Omit<typeof mergedProviders, "defaultProvider">] = 
        Boolean(mergedProviders[key as keyof Omit<typeof mergedProviders, "defaultProvider">]);
    }
  });

  // Validate defaultProvider is one of the enabled providers
  if (mergedProviders.defaultProvider) {
    const enabledProviders = Object.entries(mergedProviders)
      .filter(([key, value]) => key !== "defaultProvider" && value === true)
      .map(([key]) => key);

    if (enabledProviders.length > 0 && !enabledProviders.includes(mergedProviders.defaultProvider)) {
      // If default provider is not enabled, use the first enabled provider
      mergedProviders.defaultProvider = enabledProviders[0] as SignupSettings["providers"]["defaultProvider"];
    }
  }

  return {
    providers: mergedProviders as SignupSettings["providers"],
    googleSignupMode: apiSettings.googleSignupMode || defaultSignupSettings.googleSignupMode,
    githubSignupMode: apiSettings.githubSignupMode || defaultSignupSettings.githubSignupMode,
    emailOtpSignupMode: apiSettings.emailOtpSignupMode || defaultSignupSettings.emailOtpSignupMode,
    usernameStrategy: apiSettings.usernameStrategy || defaultSignupSettings.usernameStrategy,
    passwordStrategy: apiSettings.passwordStrategy || defaultSignupSettings.passwordStrategy,
    passwordDelivery: apiSettings.passwordDelivery || defaultSignupSettings.passwordDelivery,
  };
};
