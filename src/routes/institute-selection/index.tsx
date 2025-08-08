import { InstituteSelection } from '@/components/common/auth/login/forms/page/select-institute'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/institute-selection/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <InstituteSelection />
}
