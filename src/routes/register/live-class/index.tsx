import { createFileRoute } from "@tanstack/react-router";
import LiveClassRegistrationPage from "./-components/LiveClassRegistrationPage";

interface liveClassParams {
  sessionId: string;
}

export const Route = createFileRoute("/register/live-class/")({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): liveClassParams => {
    return {
      sessionId: search.sessionId as string,
    };
  },
});
function RouteComponent() {
  return <LiveClassRegistrationPage />;
}
