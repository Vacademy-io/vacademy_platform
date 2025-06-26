import { createFileRoute } from "@tanstack/react-router";
// import { useEffect } from "react";
// import { useNavigate } from "@tanstack/react-router";
// import { z } from "zod";

export const Route = createFileRoute("/live-class-guest/")({
  component: RouteComponent,
});

function RouteComponent() {
//   const navigate = useNavigate();

//   useEffect(() => {
//     navigate({
//       to: "/live-class-guest/waiting-room",
//       search: { sessionId, guestId },
//     });
//   }, [sessionId, guestId]);

  return <div>Hello "/live-class-guest/"!</div>;
}
