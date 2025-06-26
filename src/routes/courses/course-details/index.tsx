import { createFileRoute } from '@tanstack/react-router'
import viewCourseDetails from './-component/ViewCourseDetails/ViewCourseDetails';
export const Route = createFileRoute('/courses/course-details/')({
  component: viewCourseDetails,
})

// function RouteComponent() {
//   return <div>Hello "/courses/course-details/"!</div>
// }
