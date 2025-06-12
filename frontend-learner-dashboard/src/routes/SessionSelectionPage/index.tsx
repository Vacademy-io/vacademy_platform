import SessionSelectionPage from '@/components/common/LoginPages/sections/SessionSelectionPage'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/SessionSelectionPage/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <SessionSelectionPage />
}
