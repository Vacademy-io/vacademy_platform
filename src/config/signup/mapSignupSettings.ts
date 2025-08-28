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

export function mapSignupSettings(apiSettings: any): SignupSettings {
  // If no API settings provided, return defaults
  if (!apiSettings || typeof apiSettings !== 'object') {
    return defaultSignupSettings;
  }

  // Merge API settings with defaults
  const mergedSettings: SignupSettings = {
    ...defaultSignupSettings,
    ...apiSettings,
  };

  // Validate and merge providers
  if (apiSettings.providers && Array.isArray(apiSettings.providers)) {
    const validProviders = apiSettings.providers.filter((provider: any) => 
      provider && typeof provider === 'object' && 
      typeof provider.enabled === 'boolean' && 
      typeof provider.clientId === 'string' && 
      provider.clientId.trim() !== ''
    );

    if (validProviders.length > 0) {
      mergedSettings.providers = validProviders.map((provider: any) => ({
        ...defaultSignupSettings.providers.find(p => p.name === provider.name),
        ...provider,
      }));
    }
  }

  // Validate and merge credential strategies
  if (apiSettings.usernameStrategy && typeof apiSettings.usernameStrategy === 'string') {
    const validUsernameStrategies = ['email', 'custom', 'auto_generate'];
    if (validUsernameStrategies.includes(apiSettings.usernameStrategy)) {
      mergedSettings.usernameStrategy = apiSettings.usernameStrategy;
    }
  }

  if (apiSettings.passwordStrategy && typeof apiSettings.passwordStrategy === 'string') {
    const validPasswordStrategies = ['custom', 'auto_generate', 'email_based'];
    if (validPasswordStrategies.includes(apiSettings.passwordStrategy)) {
      mergedSettings.passwordStrategy = apiSettings.passwordStrategy;
    }
  }

  // Validate and merge signup flow settings
  if (apiSettings.requireEmailVerification !== undefined) {
    mergedSettings.requireEmailVerification = Boolean(apiSettings.requireEmailVerification);
  }

  if (apiSettings.requirePhoneVerification !== undefined) {
    mergedSettings.requirePhoneVerification = Boolean(apiSettings.requirePhoneVerification);
  }

  if (apiSettings.requireApproval !== undefined) {
    mergedSettings.requireApproval = Boolean(apiSettings.requireApproval);
  }

  // Validate and merge UI settings
  if (apiSettings.showSocialSignup !== undefined) {
    mergedSettings.showSocialSignup = Boolean(apiSettings.showSocialSignup);
  }

  if (apiSettings.showEmailSignup !== undefined) {
    mergedSettings.showEmailSignup = Boolean(apiSettings.showEmailSignup);
  }

  if (apiSettings.showPhoneSignup !== undefined) {
    mergedSettings.showPhoneSignup = Boolean(apiSettings.showPhoneSignup);
  }

  // Validate and merge validation settings
  if (apiSettings.passwordMinLength && typeof apiSettings.passwordMinLength === 'number') {
    mergedSettings.passwordMinLength = Math.max(1, apiSettings.passwordMinLength);
  }

  if (apiSettings.passwordMaxLength && typeof apiSettings.passwordMaxLength === 'number') {
    mergedSettings.passwordMaxLength = Math.max(mergedSettings.passwordMinLength, apiSettings.passwordMaxLength);
  }

  if (apiSettings.usernameMinLength && typeof apiSettings.usernameMinLength === 'number') {
    mergedSettings.usernameMinLength = Math.max(1, apiSettings.usernameMinLength);
  }

  if (apiSettings.usernameMaxLength && typeof apiSettings.usernameMaxLength === 'number') {
    mergedSettings.usernameMaxLength = Math.max(mergedSettings.usernameMinLength, apiSettings.usernameMaxLength);
  }

  // Validate and merge terms and privacy settings
  if (apiSettings.requireTermsAcceptance !== undefined) {
    mergedSettings.requireTermsAcceptance = Boolean(apiSettings.requireTermsAcceptance);
  }

  if (apiSettings.requirePrivacyAcceptance !== undefined) {
    mergedSettings.requirePrivacyAcceptance = Boolean(apiSettings.requirePrivacyAcceptance);
  }

  if (apiSettings.termsUrl && typeof apiSettings.termsUrl === 'string') {
    mergedSettings.termsUrl = apiSettings.termsUrl;
  }

  if (apiSettings.privacyUrl && typeof apiSettings.privacyUrl === 'string') {
    mergedSettings.privacyUrl = apiSettings.privacyUrl;
  }

  // Validate and merge redirect settings
  if (apiSettings.postSignupRedirectRoute && typeof apiSettings.postSignupRedirectRoute === 'string') {
    mergedSettings.postSignupRedirectRoute = apiSettings.postSignupRedirectRoute;
  }

  if (apiSettings.postLoginRedirectRoute && typeof apiSettings.postLoginRedirectRoute === 'string') {
    mergedSettings.postLoginRedirectRoute = apiSettings.postLoginRedirectRoute;
  }

  // Validate and merge notification settings
  if (apiSettings.sendWelcomeEmail !== undefined) {
    mergedSettings.sendWelcomeEmail = Boolean(apiSettings.sendWelcomeEmail);
  }

  if (apiSettings.sendWelcomeSMS !== undefined) {
    mergedSettings.sendWelcomeSMS = Boolean(apiSettings.sendWelcomeSMS);
  }

  // Validate and merge security settings
  if (apiSettings.requireCaptcha !== undefined) {
    mergedSettings.requireCaptcha = Boolean(apiSettings.requireCaptcha);
  }

  if (apiSettings.requireTwoFactor !== undefined) {
    mergedSettings.requireTwoFactor = Boolean(apiSettings.requireTwoFactor);
  }

  // Validate and merge custom fields
  if (apiSettings.customFields && Array.isArray(apiSettings.customFields)) {
    const validCustomFields = apiSettings.customFields.filter((field: any) => 
      field && typeof field === 'object' && 
      typeof field.name === 'string' && 
      typeof field.type === 'string' && 
      typeof field.required === 'boolean'
    );

    if (validCustomFields.length > 0) {
      mergedSettings.customFields = validCustomFields;
    }
  }

  // Validate and merge role settings
  if (apiSettings.defaultRole && typeof apiSettings.defaultRole === 'string') {
    mergedSettings.defaultRole = apiSettings.defaultRole;
  }

  if (apiSettings.allowedRoles && Array.isArray(apiSettings.allowedRoles)) {
    const validRoles = apiSettings.allowedRoles.filter((role: any) => 
      role && typeof role === 'string' && role.trim() !== ''
    );

    if (validRoles.length > 0) {
      mergedSettings.allowedRoles = validRoles;
    }
  }

  // Validate and merge institute settings
  if (apiSettings.instituteId && typeof apiSettings.instituteId === 'string') {
    mergedSettings.instituteId = apiSettings.instituteId;
  }

  if (apiSettings.instituteName && typeof apiSettings.instituteName === 'string') {
    mergedSettings.instituteName = apiSettings.instituteName;
  }

  // Validate and merge branding settings
  if (apiSettings.logoUrl && typeof apiSettings.logoUrl === 'string') {
    mergedSettings.logoUrl = apiSettings.logoUrl;
  }

  if (apiSettings.primaryColor && typeof apiSettings.primaryColor === 'string') {
    mergedSettings.primaryColor = apiSettings.primaryColor;
  }

  if (apiSettings.secondaryColor && typeof apiSettings.secondaryColor === 'string') {
    mergedSettings.secondaryColor = apiSettings.secondaryColor;
  }

  // Validate and merge feature flags
  if (apiSettings.features && typeof apiSettings.features === 'object') {
    Object.keys(apiSettings.features).forEach(key => {
      if (typeof apiSettings.features[key] === 'boolean') {
        mergedSettings.features[key] = apiSettings.features[key];
      }
    });
  }

  // Validate and merge advanced settings
  if (apiSettings.advanced && typeof apiSettings.advanced === 'object') {
    Object.keys(apiSettings.advanced).forEach(key => {
      if (typeof apiSettings.advanced[key] !== 'undefined') {
        mergedSettings.advanced[key] = apiSettings.advanced[key];
      }
    });
  }

  return mergedSettings;
}
