import { createFileRoute } from '@tanstack/react-router';
import StudyCourseCatalogWrapper from './-component/StudyCourseCatalogWrapper'; // ✅ Correct import

export const Route = createFileRoute('/study-library/')({
  component: StudyCourseCatalogWrapper, // ✅ Use the imported component
});
