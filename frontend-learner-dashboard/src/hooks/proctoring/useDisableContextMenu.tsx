import { useCallback, useEffect } from "react"

type Props = {
  disabled?: boolean
}

/**
 * Prevent Right Click:
 * User should not be able to access default context menu on right click
 */
export function useDisableContextMenu(
  { disabled }: Props = { disabled: false }
) {
  const contextMenuListener = useCallback((e: MouseEvent) => {
    e.preventDefault()
  }, [])

  useEffect(() => {
    const removeListener = () => {
      window.removeEventListener("contextmenu", contextMenuListener)
    }
    if (disabled) return removeListener

    window.addEventListener("contextmenu", contextMenuListener)
    return removeListener
  }, [disabled, contextMenuListener])

  return
}
