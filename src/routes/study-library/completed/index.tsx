import { createFileRoute } from '@tanstack/react-router'
import completeCourseWrapper from './-component/completeCourseWrapper'
export const Route = createFileRoute('/study-library/completed/')({
  component: completeCourseWrapper,
})

// function RouteComponent() {
//   return <div>Hello "/study-library/completedCourse/"!</div>
// }
