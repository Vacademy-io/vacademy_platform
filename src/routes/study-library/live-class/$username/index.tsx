import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/study-library/live-class/$username/")({
  beforeLoad: ({ params }) => {
    const { username } = params;
    console.log("Username from URL:", username);

    // Redirect to the main live-class route
    throw redirect({
      to: "/study-library/live-class",
    });
  },
  component: () => null, // This will never render due to the redirect
});
