import { createFileRoute } from '@tanstack/react-router'
//import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import InProgressCourseWrapper from '../completed/-component/completeCourseWrapper';
export const Route = createFileRoute('/study-library/in-progress/')({
  component:InProgressCourseWrapper,
})


