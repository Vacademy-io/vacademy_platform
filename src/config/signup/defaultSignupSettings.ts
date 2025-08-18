export type StudentSignupProvider = 'google' | 'github' | 'emailOtp';
export type StudentDefaultProvider = StudentSignupProvider;
export type UsernameStrategy = 'email' | 'random' | 'manual' | ' ';
export type PasswordStrategy = 'manual' | 'autoRandom' | ' ';
export type PasswordDelivery = 'showOnScreen' | 'sendEmail' | ' ' | 'none';

export const defaultSignupSettings = {
  providers: {
    google: true,
    github: true,
    emailOtp: true,
    defaultProvider: "emailOtp",
  },
  googleSignupMode: "askCredentials" as const, // Retained for compatibility, but logic now uses username/passwordStrategy
  githubSignupMode: "askCredentials" as const, // Retained for compatibility, but logic now uses username/passwordStrategy
  emailOtpSignupMode: "askCredentials" as const, // Retained for compatibility, but logic now uses username/passwordStrategy
  usernameStrategy: "email" as UsernameStrategy,
  passwordStrategy: "manual" as PasswordStrategy,
  passwordDelivery: "none" as PasswordDelivery,
};

export type SignupProviders = {
  google: boolean;
  github: boolean;
  emailOtp: boolean;
  defaultProvider: StudentDefaultProvider;
};

export type SignupSettings = {
  providers: SignupProviders;
  googleSignupMode: "direct" | "askCredentials"; // Retained for compatibility
  githubSignupMode: "direct" | "askCredentials"; // Retained for compatibility
  emailOtpSignupMode: "direct" | "askCredentials"; // Retained for compatibility
  usernameStrategy: UsernameStrategy;
  passwordStrategy: PasswordStrategy;
  passwordDelivery: PasswordDelivery;
};

export default defaultSignupSettings;
