import { createFileRoute } from "@tanstack/react-router";
import { SignUpForm } from "@/components/common/SignUpPages/sections/signup-form";

export const Route = createFileRoute("/signup/")({
  component: RouteComponent,
});

function RouteComponent() {
  return <div className="w-full h-full"><SignUpForm /></div>;
} 