import React, { useState } from "react";
import { Briefcase, MessageCircle, FileQuestion } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type VoiceMode = "voice_interview" | "voice_doubt" | "voice_oral_test";

interface VoiceModeSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (mode: VoiceMode, language: string) => void;
  enabledModes?: string[];
}

const MODES: {
  key: VoiceMode;
  label: string;
  description: string;
  icon: React.ElementType;
}[] = [
  {
    key: "voice_interview",
    label: "Take my Interview",
    description: "Practice with a mock interview on your current topic",
    icon: Briefcase,
  },
  {
    key: "voice_doubt",
    label: "Discuss your Doubt",
    description: "Talk through your doubts with voice interaction",
    icon: MessageCircle,
  },
  {
    key: "voice_oral_test",
    label: "Take Oral Test",
    description: "Test your knowledge with verbal Q&A",
    icon: FileQuestion,
  },
];

const LANGUAGES = [
  { code: "en-IN", label: "English" },
  { code: "hi-IN", label: "Hindi" },
  { code: "bn-IN", label: "Bengali" },
  { code: "ta-IN", label: "Tamil" },
  { code: "te-IN", label: "Telugu" },
  { code: "kn-IN", label: "Kannada" },
  { code: "ml-IN", label: "Malayalam" },
  { code: "mr-IN", label: "Marathi" },
  { code: "gu-IN", label: "Gujarati" },
  { code: "pa-IN", label: "Punjabi" },
  { code: "od-IN", label: "Odia" },
];

export const VoiceModeSelector: React.FC<VoiceModeSelectorProps> = ({
  open,
  onClose,
  onSelect,
  enabledModes,
}) => {
  const [selectedMode, setSelectedMode] = useState<VoiceMode | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState("en-IN");

  const visibleModes = enabledModes
    ? MODES.filter((m) => enabledModes.includes(m.key))
    : MODES;

  const handleStart = () => {
    if (selectedMode) {
      onSelect(selectedMode, selectedLanguage);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[10010] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-md mx-4 rounded-2xl bg-slate-900 border border-white/10 p-6 shadow-2xl"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-white mb-1">Voice Mode</h2>
            <p className="text-sm text-white/50 mb-5">
              Choose how you want to interact
            </p>

            {/* Mode cards */}
            <div className="space-y-2 mb-5">
              {visibleModes.map((m) => {
                const Icon = m.icon;
                const isSelected = selectedMode === m.key;
                return (
                  <button
                    key={m.key}
                    className={cn(
                      "w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all",
                      isSelected
                        ? "bg-primary/20 border border-primary/50 ring-1 ring-primary/30"
                        : "bg-white/5 border border-white/10 hover:bg-white/10",
                    )}
                    onClick={() => setSelectedMode(m.key)}
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                        isSelected ? "bg-primary/30 text-primary" : "bg-white/10 text-white/60",
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p
                        className={cn(
                          "text-sm font-medium",
                          isSelected ? "text-white" : "text-white/80",
                        )}
                      >
                        {m.label}
                      </p>
                      <p className="text-xs text-white/40 mt-0.5">{m.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Language picker */}
            <div className="mb-5">
              <label className="text-xs text-white/50 font-medium mb-1.5 block">
                Language
              </label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="w-full rounded-lg bg-white/5 border border-white/10 text-white text-sm px-3 py-2 outline-none focus:border-primary/50 appearance-none cursor-pointer"
              >
                {LANGUAGES.map((lang) => (
                  <option
                    key={lang.code}
                    value={lang.code}
                    className="bg-slate-900 text-white"
                  >
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                disabled={!selectedMode}
                onClick={handleStart}
              >
                Start
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
