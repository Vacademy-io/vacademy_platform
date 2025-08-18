
import { createFileRoute} from "@tanstack/react-router";
import { LoginForm } from "@/components/common/auth/login/forms/page/login-form";
import { useDomainRouting } from "@/hooks/use-domain-routing";
import { DashboardLoader } from "@/components/core/dashboard-loader";

export const Route = createFileRoute("/login/")({
  
  component: RouteComponent,
});

function RouteComponent() {
  const domainRouting = useDomainRouting();

  if (domainRouting.isLoading) {
    return <DashboardLoader />;
  }

  return <div className="w-full min-h-screen bg-background"><LoginForm /></div>;
}

