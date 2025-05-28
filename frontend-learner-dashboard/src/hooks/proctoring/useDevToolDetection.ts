// import { useCallback, useEffect, useState } from "react"

// import devTools, { DevToolsEvent } from "devtools-detect"
// import { isMobileSafari, isIOS, isChrome } from "react-device-detect"

// type Props = {
//   disabled?: boolean
// }

// export function useDevToolDetection({ disabled }: Props = { disabled: false }) {}
// export function useDevToolDetection({ disabled }: Props = { disabled: false }) {
//   const [devToolsOpen, setDevToolsOpen] = useState<boolean | null>(null)

//   /**
//    * Dev tools Access:
//    * Prevent all short cuts from opening dev tools
//    */
//   const listener = useCallback((e: KeyboardEvent) => {
//     if (e.key === "F12") {
//       e.preventDefault()
//     }
//     if (e.ctrlKey && e.shiftKey && e.key === "I") {
//       e.preventDefault()
//     }
//     if (e.ctrlKey && e.shiftKey && e.key === "J") {
//       e.preventDefault()
//     }
//     if (e.ctrlKey && e.shiftKey && e.key === "C") {
//       e.preventDefault()
//     }
//     if (e.ctrlKey && e.key === "U") {
//       e.preventDefault()
//     }
//   }, [])

//   const devToolsChangeListener = useCallback((event: DevToolsEvent) => {
//     setDevToolsOpen(event.detail.isOpen)
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [])

//   useEffect(() => {
//     if (disabled || isMobileSafari || (isIOS && isChrome)) return

//     if (devTools.isOpen) {
//       setDevToolsOpen(true)
//     }
//     window.addEventListener("devtoolschange", devToolsChangeListener)

//     window.addEventListener("keydown", listener)

//     return () => {
//       window.removeEventListener("keydown", listener)

//       // @ts-expect-error library issue
//       window.removeEventListener("devtoolschange", devToolsChangeListener)
//     }
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [isMobileSafari, isIOS, isChrome])

//   return { devToolsOpen } as const
// }
