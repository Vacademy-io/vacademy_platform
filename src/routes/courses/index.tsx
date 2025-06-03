import { createFileRoute } from '@tanstack/react-router'

import CatalogPageComponent from './-component/CatalogPage'
import CourseCatalougePage from './-component/CourseCatalougePage'

// Define the route for /courses/
export const Route = createFileRoute('/courses/')({
  // This route simply renders the CoursesContainerComponent
  component: CoursesContainerComponent,
})

// This component will be rendered for the /courses/ path
function CoursesContainerComponent() {
  // This parent route component doesn't need to know about instituteId if the child handles it directly.
  // CatalogPageComponent will use its own internal logic (URLSearchParams)
  // to get the instituteId and make its API call.
  return (
    <div className='min-h-screen bg-white'>
      {/* <h1>Welcome to the Courses Section</h1>
      <p>
        The catalog below should display based on the 'instituteId' in the URL (e.g., /courses?instituteId=YOUR_UUID).
      </p>
      <hr /> */}
      <CatalogPageComponent />
      <CourseCatalougePage/>
    </div>
  )
}
