import { createFileRoute, redirect } from '@tanstack/react-router'

// interface CourseSearchParams {
//   courseId: string
// }

export const Route = createFileRoute('/study-library/courses/levels/')({
  // component: RouteComponent,
  // validateSearch: (search: Record<string, unknown>): CourseSearchParams => {
  //   return {
  //     courseId: search.courseId as string,
  //   }
  // },
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
//         <LevelMaterial />
//       </InitStudyLibraryProvider>
//     </LayoutContainer>
//   )
// }
