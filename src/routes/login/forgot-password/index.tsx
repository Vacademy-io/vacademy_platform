import { createFileRoute } from "@tanstack/react-router";
import { useSyncLanguage } from "@/hooks/useSyncLanguage";
import { ForgotPassword } from "@/components/common/auth/login/forms/page/forgot-password-form";

export const Route = createFileRoute("/login/forgot-password/")({
  component: PasswordReset,
});


export function PasswordReset() {
  useSyncLanguage();
  return <div className="w-full h-full"><ForgotPassword /></div>;
}
