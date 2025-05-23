"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { useAssessmentStore } from "@/stores/assessment-store";
import { Preferences } from "@capacitor/preferences";

export function SectionTimer() {
  const {
    currentSection,
    sectionTimers,
    updateSectionTimer,
    moveToNextAvailableSection,
    findNextAvailableSection,
  } = useAssessmentStore();

  const currentTimer = sectionTimers[currentSection];
  const [playMode, setPlayMode] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlayMode = async () => {
      const storedMode = await Preferences.get({
        key: "InstructionID_and_AboutID",
      });
      if (storedMode.value) {
        const parsedData = JSON.parse(storedMode.value);
        setPlayMode(parsedData.play_mode);
      }
    };

    fetchPlayMode();
  }, []);
  useEffect(() => {
    if (!currentTimer?.isRunning) return;

    const timer = setInterval(() => {
      const newTime = Math.max(0, currentTimer.timeLeft - 1000);
      updateSectionTimer(currentSection, newTime);

      // If time is up for current section, move to next available section
      if (newTime === 0) {
        const nextSection = findNextAvailableSection();
        if (nextSection !== null && nextSection !== currentSection) {
          moveToNextAvailableSection();
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [currentTimer?.isRunning, currentTimer?.timeLeft, currentSection]);

  if (!currentTimer) return null;

  const minutes = Math.floor(currentTimer.timeLeft / 60000);
  const seconds = Math.floor((currentTimer.timeLeft % 60000) / 1000);

  return (
    <div className="flex items-center gap-2 text-lg font-mono">
      <Clock className="h-5 w-5" />
      {playMode !== "PRACTICE" && playMode !== "SURVEY" && (
        <span className={currentTimer.timeLeft < 60000 ? "text-red-500" : ""}>
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </span>
      )}
    </div>
  );
}
