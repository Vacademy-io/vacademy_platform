import { useEffect } from 'react'

type Props = {
  disabled?: boolean
}

/**
 * Prevent user select
 */
export function useSelectionDisable({ disabled }: Props = { disabled: false }) {
  useEffect(() => {
    if (disabled) return

    const element = document.body

    const properties = [
      'user-select',
      '-webkit-user-select',
      '-ms-user-select',
      '-moz-user-select',
    ] as const

    properties.forEach((property) => element.style.setProperty(property, 'none'))

    return () => {
      properties.forEach((property) => element.style.setProperty(property, 'auto'))
    }
  }, [disabled])

  return
}
