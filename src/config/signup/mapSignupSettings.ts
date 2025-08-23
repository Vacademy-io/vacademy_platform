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
    return defaultSignupSettings;
  }

  console.log('[mapSignupSettings] Backend settings received:', apiSettings);

  // Merge providers with defaults, handling backend property name differences
  // Note: Signup never includes usernamePassword provider - only emailOtp
  const mergedProviders = {
    ...defaultSignupSettings.providers,
    ...apiSettings.providers,
    // For signup: use emailOtp directly, or fallback to usernamePassword if emailOtp not provided
    // This ensures emailOtp: true is respected when backend sends it
    emailOtp: apiSettings.providers?.emailOtp ?? apiSettings.providers?.usernamePassword ?? defaultSignupSettings.providers.emailOtp,
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

  console.log('[mapSignupSettings] Mapped settings:', result);

  return result;
};
