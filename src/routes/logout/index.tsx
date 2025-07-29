import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { removeTokensAndLogout } from "@/lib/auth/sessionUtility";
import { useNavigate } from "@tanstack/react-router";
import { NAMING_SETTINGS_KEY } from "@/types/naming-settings";

export const Route = createFileRoute("/logout/")({
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();

  useEffect(() => {
    localStorage.removeItem(NAMING_SETTINGS_KEY);
    removeTokensAndLogout();
    navigate({
      to: "/login",
    });
  }, []);
  return <div>Loging out ....</div>;
}
