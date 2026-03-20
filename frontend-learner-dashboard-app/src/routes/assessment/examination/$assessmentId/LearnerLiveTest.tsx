import Page from '@/components/common/questionLiveTest/page'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/assessment/examination/$assessmentId/LearnerLiveTest',
)({
  component: RouteComponent,
})

function RouteComponent() {
    return <Page />
  
}
