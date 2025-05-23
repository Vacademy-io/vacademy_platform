import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { removeTokensAndLogout } from "@/lib/auth/sessionUtility";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/logout/")({
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();

  useEffect(() => {
    removeTokensAndLogout();
    navigate({
      to: "/login",
    });
  }, []);
  return <div>Loging out ....</div>;
}
