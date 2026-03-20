// import { useCamDetection } from "./useCamDetection";
// import { useDevToolDetection } from "./useDevToolDetection";
import {
  FullScreenStatus,
  triggerFullscreen,
  useFullScreenDetection,
} from './useFullScreenDetection'
import { useTabFocusDetection } from './useTabFocusDetection'
import { useCopyDisable } from './useCopyDisable'
import { useDisableContextMenu } from './useDisableContextMenu'
import { useSelectionDisable } from './useSelectionDisable'

type Props = {
  preventContextMenu?: boolean
  preventUserSelection?: boolean
  preventCopy?: boolean
  forceFullScreen?: boolean
  preventTabSwitch?: boolean
}

export type ProctoringData = {
  fullScreen: { status: FullScreenStatus; trigger: VoidFunction }
  tabFocus: { status: boolean }
}

export function useProctoring({
  preventTabSwitch = false,
  forceFullScreen = false,
  preventContextMenu = false,
  preventUserSelection = false,
  preventCopy = false,
}: Props) {
  useDisableContextMenu({ disabled: preventContextMenu === false })

  useCopyDisable({ disabled: preventCopy === false })
  useSelectionDisable({ disabled: preventUserSelection === false })

  // TODO: Future work
  // const { webCamStatus, videoRef, replayVideo } = useCamDetection({
  //   disabled,
  // })

  // Disabled devtools detection
  // const { devToolsOpen } = useDevToolDetection({ disabled: true })
  const { tabFocusStatus } = useTabFocusDetection({
    disabled: preventTabSwitch === false,
  })
  // console.log(tabFocusStatus, 'from proctoring')
  const { fullScreenStatus } = useFullScreenDetection({
    disabled: forceFullScreen === false,
  })

  return {
    fullScreen: { status: fullScreenStatus, trigger: triggerFullscreen },
    tabFocus: { status: tabFocusStatus },
  } as const
}
