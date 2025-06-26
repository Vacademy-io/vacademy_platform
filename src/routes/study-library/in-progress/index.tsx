import { createFileRoute } from '@tanstack/react-router'
import StudyCourseCatalog from './-component1/StudyCourseCatalogWrapper'
export const Route = createFileRoute('/study-library/in-progress/')({
  component: StudyCourseCatalog,
})

// function RouteComponent() {
//   return <div>Hello "/study-library/completedCourse/"!</div>
// }
