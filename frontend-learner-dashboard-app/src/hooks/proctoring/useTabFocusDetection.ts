// import { useState, useCallback, useEffect } from 'react'
import { useState, useEffect } from 'react'

type Props = {
  disabled?: boolean
}

export function useTabFocusDetection({ disabled }: Props = { disabled: false }) {
  const [tabFocusStatus, setTabFocusStatus] = useState(true)

  /**
   * Tab Un-Focus:
   * When page goes out of focus/visibility set tab unfocus status true
   */
  // const visibilityChange = useCallback(() => {
  //   setTabFocusStatus(!document.hidden)
  // }, [])

  useEffect(() => {
    if (disabled) return

    const browserPrefixes = ['moz', 'ms', 'o', 'webkit']
    let isVisible = true // internal flag, defaults to true

    // get the correct attribute name
    function getHiddenPropertyName(prefix: string | null) {
      return prefix ? prefix + 'Hidden' : 'hidden'
    }

    // get the correct event name
    function getVisibilityEvent(prefix: string | null) {
      return (prefix ? prefix : '') + 'visibilitychange'
    }

    // get current browser vendor prefix
    function getBrowserPrefix() {
      for (let i = 0; i < browserPrefixes.length; i++) {
        if (getHiddenPropertyName(browserPrefixes[i]) in document) {
          // return vendor prefix
          return browserPrefixes[i]
        }
      }

      // no vendor prefix needed
      return null
    }

    // bind and handle events
    const browserPrefix = getBrowserPrefix()
    const hiddenPropertyName = getHiddenPropertyName(browserPrefix)
    const visibilityEventName = getVisibilityEvent(browserPrefix)

    function onVisible() {
      // prevent double execution
      if (isVisible) {
        return
      }

      // change flag value
      isVisible = true
      setTabFocusStatus(true)
    }

    function onHidden() {
      // prevent double execution
      if (!isVisible) {
        return
      }

      // change flag value
      isVisible = false
      setTabFocusStatus(false)
    }

    function handleVisibilityChange(forcedFlag: unknown) {
      // forcedFlag is a boolean when this event handler is triggered by a
      // focus or blur eventotherwise it's an Event object
      if (typeof forcedFlag === 'boolean') {
        if (forcedFlag) {
          return onVisible()
        }

        return onHidden()
      }

      // @ts-ignore
      if (document[hiddenPropertyName]) {
        return onHidden()
      }

      return onVisible()
    }

    const handleFocus = () => handleVisibilityChange(true)
    const handleBlur = () => handleVisibilityChange(false)

    document.addEventListener(visibilityEventName, handleVisibilityChange, false)
    // extra event listeners for better behaviour
    document.addEventListener('focus', handleFocus, false)
    document.addEventListener('blur', handleBlur, false)
    window.addEventListener('focus', handleFocus, false)
    window.addEventListener('blur', handleBlur, false)

    return () => {
      document.removeEventListener(visibilityEventName, handleVisibilityChange, false)
      document.removeEventListener('focus', handleFocus, false)
      document.removeEventListener('blur', handleBlur, false)
      window.removeEventListener('focus', handleFocus, false)
      window.removeEventListener('blur', handleBlur, false)
    }
  }, [disabled])

  return { tabFocusStatus } as const
}
