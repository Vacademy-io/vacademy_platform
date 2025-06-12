import { createFileRoute, redirect } from "@tanstack/react-router";
import { LoginForm } from "@/routes/login/-components/LoginPages/sections/login-form";
import { getTokenFromCookie } from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";
import { isNullOrEmptyOrUndefined } from "@/lib/utils";

export const Route = createFileRoute("/login/")({
    loader: () => {
        const accessToken = getTokenFromCookie(TokenKey.accessToken);
        if (!isNullOrEmptyOrUndefined(accessToken)) {
            throw redirect({ to: "/dashboard" });
        }
        return;
    },
    component: RouteComponent,
});

function RouteComponent() {
    return <LoginForm />;
}
