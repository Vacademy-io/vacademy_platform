import { createLazyFileRoute } from "@tanstack/react-router"
import { GenerateQuestionsFromAudio } from "./-components/GenerateQuestionsFromAudio"
import { AICenterProvider } from "@/routes/ai-center/-contexts/useAICenterContext"
import { LayoutContainer } from "@/components/common/layout-container/layout-container"
import { CaretLeft } from "@phosphor-icons/react"
import { useEffect } from "react"
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore"

export const Route = createLazyFileRoute("/ai-center/ai-tools/vsmart-audio/")({
  component: RouteComponent,
})

function RouteComponent() {
  const { setNavHeading } = useNavHeadingStore()
  useEffect(() => {
    const heading = (
      <div className="flex items-center gap-4">
        <CaretLeft
          onClick={() => window.history.back()}
          className="cursor-pointer"
        />
        <div>VSmart AI Tools</div>
      </div>
    )

    setNavHeading(heading)
  }, [])
  return (
    <LayoutContainer>
      <AICenterProvider>
        <GenerateQuestionsFromAudio />
      </AICenterProvider>
    </LayoutContainer>
  )
}
