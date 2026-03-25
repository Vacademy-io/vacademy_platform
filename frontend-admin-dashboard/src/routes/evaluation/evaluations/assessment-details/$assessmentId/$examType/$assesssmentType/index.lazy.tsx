import { createLazyFileRoute } from "@tanstack/react-router"

export const Route = createLazyFileRoute(
  "/evaluation/evaluations/assessment-details/$assessmentId/$examType/$assesssmentType/",
)({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div>
      Hello
      "/evaluation/evaluations/assessment-details/$assessmentId/$examType/$assesssmentType/"!
    </div>
  )
}
