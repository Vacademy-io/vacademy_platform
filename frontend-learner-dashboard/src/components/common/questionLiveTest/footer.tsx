import { ChevronLeft, ChevronRight } from "lucide-react";
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
    <div className="sticky bottom-0 flex h-16 bg-primary-50 items-center justify-between border-t  px-4">
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
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-[4rem] text-center">
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
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
