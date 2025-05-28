'use client'
import { cn } from '@/lib/utils'
import { useAssessmentStore } from '@/stores/assessment-store'
import { useEffect } from 'react'
import {distribution_duration_types} from "@/types/assessment";

export function SectionTabs() {
  const {
    assessment,
    currentSection,
    setCurrentSection,
    sectionTimers,
    setCurrentQuestion,
    updateSectionTimer,
    moveToNextAvailableSection
  } = useAssessmentStore()

  // Track if the current section's time is ending
  // const [showEndButton, setShowEndButton] = useState(false)

  useEffect(() => {
    if (assessment?.distribution_duration !== distribution_duration_types.SECTION) return

    const timer = setInterval(() => {
      const currentTimer = sectionTimers[currentSection]
      
      if (currentTimer && currentTimer.timeLeft > 0) {
        updateSectionTimer(currentSection, currentTimer.timeLeft - 1000)
        
        // Show end button when 1 minute is remaining for the current section
        if (currentTimer.timeLeft <= 60000 && !assessment?.can_switch_section) {
          // setShowEndButton(true);
        }
      } else if (!assessment?.can_switch_section) {
        // Automatically move to next section when time ends if switching is disabled
        moveToNextAvailableSection()
        // setShowEndButton(false)
      }
    }, 1000)
    
    return () => clearInterval(timer)
  }, [assessment, currentSection, sectionTimers, updateSectionTimer, moveToNextAvailableSection])

  if (!assessment) return null

  const handleSectionChange = (index: number) => {
    // If switching is disabled, only allow changing to the first non-completed section
    if (!assessment.can_switch_section) {
      const isFirstAvailableSection = assessment.section_dtos
        .slice(0, index)
        .every((_, i) => sectionTimers[i]?.timeLeft === 0);

      if (!isFirstAvailableSection) return;
    }
    
    if (sectionTimers[index]?.timeLeft === 0) return
    
    setCurrentSection(index)
    const firstQuestion = assessment.section_dtos[index].question_preview_dto_list[0]
    setCurrentQuestion(firstQuestion)
  }

  const handleEndSection = () => {
    // Set current section timer to 0
    updateSectionTimer(currentSection, 0)
    moveToNextAvailableSection()
    // setShowEndButton(false)
  }

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return (
    <div className="flex gap-2 px-4 pt-2 border-b bg-white overflow-x-auto">
      {assessment?.section_dtos?.map((section, index) => {
        const timer = sectionTimers[index]
        const isTimeUp = timer?.timeLeft === 0
        const isActive = currentSection === index
        const isAvailable =
          assessment.can_switch_section ||
          assessment.section_dtos
            .slice(0, index)
            .every((_, i) => sectionTimers[i]?.timeLeft === 0);

        return (
          <div key={section.id} className="flex items-center">
            <button
              onClick={() => handleSectionChange(index)}
              disabled={!isAvailable || isTimeUp}
              className={cn(
                "relative px-4 py-2 rounded-t-lg text-sm",
                isActive &&
                  "border border-b-0 border-primary-500 bg-orange-50 text-primary-500",
                !isActive && "border border-transparent hover:bg-gray-50",
                (!isAvailable || isTimeUp) && "opacity-50 cursor-not-allowed"
              )}
            >
              <div className="flex items-center gap-1 min-w-max">
                <span>{section.name}</span>
                {assessment.distribution_duration === distribution_duration_types.SECTION && (
                  <span
                    className={cn(
                      timer?.timeLeft < 60000 && !isTimeUp
                        ? "text-red-500"
                        : "text-gray-500"
                    )}
                  >
                    {formatTime(timer?.timeLeft || 0)}
                  </span>
                )}
              </div>
            </button>
            {!assessment.can_switch_section && isActive && (
              <button
                onClick={handleEndSection}
                className="ml-2 px-3 py-1 text-sm border rounded hover:bg-gray-50"
              >
                End Section
              </button>
            )}
          </div>
        );
      })}
    </div>
  )
}