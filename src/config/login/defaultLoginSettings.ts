export type StudentDefaultProvider = 
  | "google" 
  | "github" 
  | "emailOtp" 
  | "usernamePassword";

export type PasswordDelivery = "email" | "sms" | "none";

export const defaultLoginSettings = {
  providers: {
    google: false,
    github: false,
    emailOtp: true,
    usernamePassword: true,
    defaultProvider: "emailOtp" as StudentDefaultProvider,
  },
  usernameStrategy: "email" as const,
  passwordStrategy: "manual" as const,
  passwordDelivery: "none" as const,

};

export type LoginProviders = {
  google: boolean;
  github: boolean;
  emailOtp: boolean;
  usernamePassword: boolean;
  defaultProvider: StudentDefaultProvider;
};

export type LoginSettings = {
  providers: LoginProviders;
  usernameStrategy: "email" | "username" | "both" | "manual";
  passwordStrategy: "manual" | "auto" | "none";
  passwordDelivery: PasswordDelivery;
};
