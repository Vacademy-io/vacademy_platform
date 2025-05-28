import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/study-library/courses/')({
  beforeLoad: () => {
    return redirect({
      to: `/study-library/courses/levels/subjects`
    })
  }
})

// function RouteComponent() {
//   return (
//     <LayoutContainer>
//       <InitStudyLibraryProvider>
//       <CourseMaterial />
//       </InitStudyLibraryProvider>
//     </LayoutContainer>
//   )
// }