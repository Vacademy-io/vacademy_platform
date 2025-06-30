import { createFileRoute } from '@tanstack/react-router'

import CourseCatalougePage from './-component/CourseCatalougePage'

// Define the route for /courses/
export const Route = createFileRoute('/courses/')({
  // This route simply renders the CoursesContainerComponent
  component: CoursesContainerComponent,

validateSearch: (search) => {
    return {
      instituteId: search.instituteId as string ?? 'dd9b9687-56ee-467a-9fc4-8c5835eae7f9', // fallback to empty string
    }
  },


})

// This component will be rendered for the /courses/ path
function CoursesContainerComponent() {
  // This parent route component doesn't need to know about instituteId if the child handles it directly.
  // CatalogPageComponent will use its own internal logic (URLSearchParams)
  // to get the instituteId and make its API call.
  return (
    <div className='min-h-screen bg-white'>
      <CourseCatalougePage/>
    </div>
  )
}
