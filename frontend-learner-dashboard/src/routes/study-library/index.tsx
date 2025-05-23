import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/study-library/')({
  beforeLoad: () => {
    throw redirect({
        to: '/study-library/courses'
    })
  }
})

