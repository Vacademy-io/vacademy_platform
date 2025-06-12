import { createFileRoute } from '@tanstack/react-router'
import InstructionPage from '@/components/common/instructionPage/InstructionPage'

export const Route = createFileRoute('/assessment/examination/$assessmentId/')({
  component: RouteComponent,
})
function RouteComponent() {
  // return <InstructionPage assessment={dummyAssessment[0]} />
  return <InstructionPage />
}