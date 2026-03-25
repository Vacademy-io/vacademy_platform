import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute(
  "/study-library/ai-copilot/shared/components/YouTubePlayerSimple",
)({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div>
      Hello "/study-library/ai-copilot/shared/components/YouTubePlayerSimple"!
    </div>
  )
}
