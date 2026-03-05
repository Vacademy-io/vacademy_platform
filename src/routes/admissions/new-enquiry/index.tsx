import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/admissions/new-enquiry/")({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/admissions/new-enquiry/"!</div>
}
