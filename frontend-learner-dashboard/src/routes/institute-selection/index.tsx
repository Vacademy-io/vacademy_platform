// import { InstituteSelection } from '@/components/common/LoginPages/sections/select-institute'
import { InstituteSelection } from '@/components/common/LoginPages/sections/select-institute'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/institute-selection/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <InstituteSelection />
}
