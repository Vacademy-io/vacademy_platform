import { createFileRoute } from "@tanstack/react-router";
import { SignUpForm } from "@/components/common/auth/signup/forms/page/signup-form";
import { useDomainRouting } from "@/hooks/use-domain-routing";
import { DashboardLoader } from "@/components/core/dashboard-loader";

export const Route = createFileRoute("/signup/")({
  component: RouteComponent,
});

function RouteComponent() {
  const domainRouting = useDomainRouting();

  if (domainRouting.isLoading) {
    return <DashboardLoader />;
  }

  return <div className="w-full h-full"><SignUpForm /></div>;
} 