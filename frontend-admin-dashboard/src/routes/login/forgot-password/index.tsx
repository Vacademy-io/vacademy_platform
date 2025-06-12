import { createFileRoute } from "@tanstack/react-router";
import { useSyncLanguage } from "@/hooks/useSyncLanguage";
import { ForgotPassword } from "@/routes/login/-components/LoginPages/sections/forgot-password-form";

export const Route = createFileRoute("/login/forgot-password/")({
    component: PasswordReset,
});

export function PasswordReset() {
    useSyncLanguage();

    return <ForgotPassword />;
}
