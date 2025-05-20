import { LayoutContainer } from '@/components/common/layout-container/layout-container'
import { ModuleMaterial } from '@/components/common/study-library/level-material/subject-material/module-material/module-material'
import { InitStudyLibraryProvider } from '@/providers/study-library/init-study-library-provider'
import { ModulesWithChaptersProvider } from '@/providers/study-library/modules-with-chapters-provider'
import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'

interface SubjectSearchParams {
  subjectId: string
}

export const Route = createFileRoute(
  '/study-library/courses/levels/subjects/modules/',
)({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): SubjectSearchParams => {
    return {
      subjectId: search.subjectId as string,
    }
  },
})

function RouteComponent() {
  const searchParams = Route.useSearch();
  const { subjectId } = Route.useSearch();

  const queryClient = useQueryClient(); // Get the queryClient instance

  const invalidateModulesQuery = () => {
      queryClient.invalidateQueries({
          queryKey: ["GET_MODULES_WITH_CHAPTERS", subjectId],
      });
  };

  useEffect(()=>{
    invalidateModulesQuery()
  }, [])
  
  return (
    <LayoutContainer>
      <InitStudyLibraryProvider>
        <ModulesWithChaptersProvider subjectId={searchParams.subjectId}>
          <ModuleMaterial />
        </ModulesWithChaptersProvider>
      </InitStudyLibraryProvider>
    </LayoutContainer>
  )
}
