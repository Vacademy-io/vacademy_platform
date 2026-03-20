
import { createFileRoute} from "@tanstack/react-router";
import { LoginForm } from "@/components/common/auth/login/forms/page/login-form";

export const Route = createFileRoute("/login/")({
  component: RouteComponent,
});

function RouteComponent() {
  return <div className="w-full min-h-screen bg-background"><LoginForm /></div>;
}

