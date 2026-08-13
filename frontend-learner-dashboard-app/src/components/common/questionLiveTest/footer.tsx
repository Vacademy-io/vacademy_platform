import { Capacitor } from "@capacitor/core";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { useAssessmentStore } from "@/stores/assessment-store";
import { ListBulletIcon } from "@radix-ui/react-icons";

interface FooterProps {
  onToggleSidebar: () => void;
}

export function Footer({ onToggleSidebar }: FooterProps) {
  const {
    assessment,
    currentQuestion,
    currentSection,
    setCurrentQuestion,
    setCurrentSection,
    sectionTimers,
  } = useAssessmentStore();

  if (
    !assessment ||
    !assessment.section_dtos ||
    !assessment.section_dtos[currentSection]
  )
    return null;

  const currentSectionQuestions =
    assessment.section_dtos[currentSection]?.question_preview_dto_list || [];

  const currentIndex = currentSectionQuestions.findIndex(
    (q) => q.question_id === currentQuestion?.question_id
  );

  const isTimeUp = sectionTimers[currentSection]?.timeLeft === 0;

  const handlePrevQuestion = () => {
    if (currentIndex > 0) {
      setCurrentQuestion(currentSectionQuestions[currentIndex - 1]);
    }
  };

  const handleNextQuestion = () => {
    if (currentIndex < currentSectionQuestions.length - 1) {
      setCurrentQuestion(currentSectionQuestions[currentIndex + 1]);
    } else {
      const nextSection = currentSection + 1;
      if (
        nextSection < assessment.section_dtos.length &&
        (sectionTimers[nextSection]?.timeLeft ?? -1) !== 0
      ) {
        setCurrentSection(nextSection);
        setCurrentQuestion(
          assessment.section_dtos[nextSection].question_preview_dto_list[0]
        );
      }
    }
  };

  return (
    // MainActivity runs setDecorFitsSystemWindows(false), so the WebView draws
    // behind the system nav bar. Android WebView frequently reports
    // env(safe-area-inset-bottom) as 0 for that bar (it only reliably exposes
    // display-cutout insets), which is why an inset-only padding still left the
    // pager untappable. max() takes the real inset where the platform reports one
    // (iOS home indicator ~34px) and otherwise falls back to a floor tall enough
    // to clear Android's 48dp three-button nav bar.
    <div
      className="sticky bottom-0 z-10 flex min-h-16 shrink-0 bg-primary-50 items-center justify-between border-t px-4"
      style={{ // design-lint-ignore: dynamic safe-area inset padding
        paddingBottom: `max(env(safe-area-inset-bottom, 0px), ${
          Capacitor.getPlatform() === "android" ? "52px" : "8px"
        })`,
      }}
    >
      <Button
        variant="outline"
        size="icon"
        onClick={onToggleSidebar}
        className=""
      >
        {/* <PanelLeft className="h-4 w-4" /> */}
        <ListBulletIcon className="h-4 w-4" />
      </Button>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={handlePrevQuestion}
          disabled={currentIndex <= 0 || isTimeUp}
        >
          <CaretLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-16 text-center">
          {currentQuestion
            ? `${currentIndex + 1}/${currentSectionQuestions.length}`
            : "-"}
        </span>
        <Button
          variant="outline"
          size="icon"
          onClick={handleNextQuestion}
          disabled={
            (currentIndex === currentSectionQuestions.length - 1 &&
              currentSection === assessment.section_dtos.length - 1) ||
            isTimeUp
          }
        >
          <CaretRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
