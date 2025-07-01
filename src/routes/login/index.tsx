
import { createFileRoute} from "@tanstack/react-router";
import { LoginForm } from "@/components/common/LoginPages/sections/login-form";
export const Route = createFileRoute("/login/")({
  
  component: RouteComponent,
});

function RouteComponent() {
  return <div className="w-full h-full"><LoginForm /></div>;
}

