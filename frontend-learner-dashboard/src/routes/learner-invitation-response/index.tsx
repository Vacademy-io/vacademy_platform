import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import EnrollByInvite from '@/components/common/enroll-by-invite/enroll-form'

const inviteParamsSchema = z.object({
  instituteId: z.string().uuid(),
  inviteCode: z.string(),
})

export const Route = createFileRoute('/learner-invitation-response/')({
  validateSearch: inviteParamsSchema,
  component: RouteComponent,
})

function RouteComponent() {
  return <EnrollByInvite />
}
