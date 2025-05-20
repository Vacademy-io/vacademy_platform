import { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet, redirect } from "@tanstack/react-router";
import React, { Suspense } from "react";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { getTokenFromCookie, isTokenExpired } from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";

const TanStackRouterDevtools =
    process.env.NODE_ENV === "production"
        ? () => null
        : React.lazy(() =>
              import("@tanstack/router-devtools").then((res) => ({
                  default: res.TanStackRouterDevtools,
              })),
          );

const isAuthenticated = () => {
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    return accessToken && !isTokenExpired(accessToken);
};

// List of public routes that don't require authentication
const publicRoutes = ["/login", "/login/forgot-password", "/signup", "/evaluator-ai"];

export const Route = createRootRouteWithContext<{
    queryClient: QueryClient;
}>()({
    beforeLoad: ({ location }) => {
        // Redirect root to login
        if (location.pathname === "/") {
            throw redirect({
                to: "/login",
            });
        }

        // Check if the route requires authentication
        const isPublicRoute = publicRoutes.some((route) => location.pathname.startsWith(route));

        // If it's not a public route and user is not authenticated,
        // redirect to login with the intended destination
        if (!isPublicRoute && !isAuthenticated()) {
            throw redirect({
                to: "/login",
                search: {
                    redirect: location.pathname,
                },
            });
        }

        // If user is authenticated and tries to access login page,
        // redirect to dashboard
        if (isAuthenticated() && location.pathname.startsWith("/login")) {
            throw redirect({
                to: "/dashboard",
            });
        }
    },

    component: () => (
        <>
            <Outlet />
            <Suspense>
                <TanStackRouterDevtools />
            </Suspense>
            <ReactQueryDevtools initialIsOpen={false} />
        </>
    ),
});
