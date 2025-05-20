import { AssessmentPreview } from '@/components/common/questionLiveTest/assessment-preview'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/assessment/examination/$assessmentId/assessmentPreview',
)({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <AssessmentPreview />
  )
}
