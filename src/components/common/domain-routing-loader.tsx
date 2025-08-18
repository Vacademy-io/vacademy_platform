import React from "react";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { useDomainRouting } from "@/hooks/use-domain-routing";

interface DomainRoutingLoaderProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const DomainRoutingLoader: React.FC<DomainRoutingLoaderProps> = ({ 
  children, 
  fallback = <DashboardLoader /> 
}) => {
  const domainRouting = useDomainRouting();

  if (domainRouting.isLoading) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

export default DomainRoutingLoader;
