// Main signup components
export { ModularDynamicSignupContainer } from "./components/ModularDynamicSignupContainer";

// Reusable components
export { CredentialsForm } from "./components/reusable/CredentialsForm";
export { EmailInputForm } from "./components/reusable/EmailInputForm";
export { EmailOtpForm } from "./components/reusable/EmailOtpForm";
export { OtpVerificationForm } from "./components/reusable/OtpVerificationForm";
export { SignupStep } from "./components/reusable/SignupStep";

// Hooks
export { useUnifiedRegistration } from "./hooks/use-unified-registration";
export { useSignupFlow } from "./hooks/use-signup-flow";
export { useModularSignupFlow } from "./hooks/use-modular-signup-flow";

// Utils
export { generateCredentials, generateUsername, generatePassword, areCredentialsRequired } from "./utils/credential-generator";
export { checkUserEnrollmentInInstitute, handleEnrolledUser, autoLoginEnrolledUser } from "./utils/enrollment-checker";

// Types
export type { SignupSettings } from "@/config/signup/defaultSignupSettings";
export type { RegistrationData, PostRegistrationOptions } from "./hooks/use-unified-registration";

// Signup providers
export { GoogleSignupProvider } from "./providers/GoogleSignupProvider";
export { GithubSignupProvider } from "./providers/GithubSignupProvider";
export { EmailOtpSignupProvider } from "./providers/EmailOtpSignupProvider";

// Signup forms
export { SignUpForm } from "./forms/page/signup-form"; 