import { useState, useMemo, useEffect } from "react"

export function useIntersectionObserver(
  ref: React.MutableRefObject<Element | null>
) {
  const [isIntersecting, setIsIntersecting] = useState(false)
  const observer = useMemo(
    () =>
      new IntersectionObserver(([entry]) =>
        setIsIntersecting(entry.isIntersecting)
      ),
    []
  )

  useEffect(() => {
    if (!ref.current) return
    observer.observe(ref.current)

    return () => {
      observer.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref.current, observer])

  return { isIntersecting } as const
}
