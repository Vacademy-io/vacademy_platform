import { useEffect, useRef, useState } from "react";
import { Microphone, PaperPlaneRight, SkipForward, ArrowCounterClockwise, Question, SpeakerHigh, SpeakerSlash, Stop } from "@phosphor-icons/react";
import { TeacherAvatar } from "./TeacherAvatar";

export interface TranscriptLine {
  role: "teacher" | "learner";
  text: string;
}

export type TutorPhase = "connecting" | "speaking" | "listening" | "thinking" | "idle" | "question" | "media" | "done";

interface TeacherPanelProps {
  teacherName: string;
  teacherAvatarFileId?: string | null;
  phase: TutorPhase;
  transcript: TranscriptLine[];
  check: { prompt: string | null; options: string[]; check_type: string | null } | null;
  awaiting: "continue" | "answer" | "done" | null;
  voiceMode: boolean;
  micOn: boolean;
  speakOn: boolean;
  onSendText: (text: string) => void;
  onAsk: (text: string) => void;
  onContinue: () => void;
  onControl: (intent: "repeat" | "skip" | "slower" | "faster" | "doubt" | "done") => void;
  onToggleMic: () => void;
  onToggleSpeak: () => void;
  onInterrupt: () => void;
  onEnd: () => void;
  /** Transient server notice (a failed transcription, a slide that cannot be opened). */
  notice?: string | null;
  /** Socket gone: inputs are inert until the learner reconnects. */
  disabled?: boolean;
  /** Phones: the page shows its own teacher strip, so the panel header hides below lg. */
  compact?: boolean;
}

const PHASE_LABEL: Record<TutorPhase, string> = {
  connecting: "Connecting…",
  speaking: "Speaking…",
  listening: "Listening…",
  thinking: "Thinking…",
  idle: "Ready",
  question: "Your turn",
  media: "Watch, then tap Done",
  done: "Slide complete",
};

/** Right rail: the teacher, the conversation, the check, and the controls. */
export const TeacherPanel: React.FC<TeacherPanelProps> = ({
  teacherName, teacherAvatarFileId, phase, transcript, check, awaiting, voiceMode, micOn, speakOn,
  onSendText, onAsk, onContinue, onControl, onToggleMic, onToggleSpeak, onInterrupt, onEnd,
  notice, disabled, compact,
}) => {
  const [text, setText] = useState("");
  const [askMode, setAskMode] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [transcript.length]);

  const submit = () => {
    const t = text.trim();
    if (!t || disabled) return;
    if (askMode || awaiting !== "answer") onAsk(t);
    else onSendText(t);
    setText("");
    setAskMode(false);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={`flex items-center gap-3 border-b border-neutral-200 pb-3 ${compact ? "hidden lg:flex" : ""}`}>
        <TeacherAvatar fileId={teacherAvatarFileId} name={teacherName} speaking={phase === "speaking"} className="size-12" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-neutral-900">{teacherName}</p>
          <p className="text-xs text-neutral-500">{PHASE_LABEL[phase]}</p>
        </div>
        {voiceMode && (
          <button type="button" onClick={onToggleSpeak} className="rounded-full p-2 text-neutral-500 hover:bg-neutral-100" title={speakOn ? "Mute teacher" : "Unmute teacher"}>
            {speakOn ? <SpeakerHigh className="size-4" /> : <SpeakerSlash className="size-4" />}
          </button>
        )}
        {phase === "speaking" && (
          <button type="button" onClick={onInterrupt} className="rounded-full p-2 text-neutral-500 hover:bg-neutral-100" title="Stop">
            <Stop className="size-4" />
          </button>
        )}
      </div>

      {notice && (
        <p role="status" className="mt-2 rounded-lg border border-warning-200 bg-warning-50 px-3 py-1.5 text-xs text-warning-700">
          {notice}
        </p>
      )}

      <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto py-3">
        {transcript.map((m, i) => (
          <div key={i} className={`flex ${m.role === "learner" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-md rounded-2xl px-3 py-2 text-sm ${m.role === "learner" ? "bg-primary-500 text-white" : "bg-neutral-100 text-neutral-800"}`}>
              {m.text}
            </div>
          </div>
        ))}
        {check && awaiting === "answer" && (
          <div className="rounded-xl border border-primary-200 bg-primary-50 p-3">
            <p className="text-xs font-semibold uppercase text-primary-500">Question</p>
            <p className="mt-1 text-sm text-neutral-900">{check.prompt}</p>
            {check.options.length > 0 && (
              <div className="mt-2 flex flex-col gap-1">
                {check.options.map((o, i) => (
                  <button key={i} type="button" onClick={() => onSendText(o)} className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-start text-sm hover:border-primary-300">
                    {o}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className={`space-y-2 border-t border-neutral-200 pt-3 ${disabled ? "pointer-events-none opacity-50" : ""}`}>
        <div className="flex flex-wrap gap-1">
          {awaiting === "continue" && (
            <button
              type="button"
              onClick={onContinue}
              className={`rounded-full bg-primary-500 px-3 py-1 text-xs font-medium text-white ${voiceMode ? "" : "animate-pulse ring-2 ring-primary-200"}`}
            >
              {voiceMode ? "Continue now" : "Continue"}
            </button>
          )}
          {awaiting === "done" && (
            <button type="button" onClick={() => onControl("done")} className="rounded-full bg-primary-500 px-3 py-1 text-xs font-medium text-white">I'm done</button>
          )}
          <button type="button" onClick={() => onControl("repeat")} className="inline-flex items-center gap-1 rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-700 hover:bg-neutral-50"><ArrowCounterClockwise className="size-3" /> Repeat</button>
          <button type="button" onClick={() => setAskMode((v) => !v)} className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs ${askMode ? "border-primary-500 bg-primary-50 text-primary-500" : "border-neutral-200 text-neutral-700 hover:bg-neutral-50"}`}><Question className="size-3" /> Doubt</button>
          <button type="button" onClick={() => onControl("skip")} className="inline-flex items-center gap-1 rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-700 hover:bg-neutral-50"><SkipForward className="size-3" /> Skip</button>
          <button type="button" onClick={onEnd} className="ms-auto rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-500 hover:bg-neutral-50">End</button>
        </div>
        {voiceMode && (
          <button
            type="button"
            onClick={onToggleMic}
            disabled={phase === "thinking" || phase === "connecting"}
            aria-pressed={micOn}
            className={`flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-50 ${
              micOn ? "bg-danger-500 text-white animate-pulse" : "bg-primary-500 text-white hover:bg-primary-400"
            }`}
          >
            <Microphone className="size-5" weight="fill" />
            {micOn
              ? "Listening… tap when you're done"
              : awaiting === "answer"
                ? "Tap to answer"
                : "Tap to speak"}
          </button>
        )}
        <div className="flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder={askMode ? "Ask your doubt…" : awaiting === "answer" ? "Type your answer…" : "Say something or ask…"}
            className="min-w-0 flex-1 rounded-full border border-neutral-200 px-4 py-2 text-sm outline-none focus:border-primary-400"
          />
          <button type="button" onClick={submit} className="rounded-full bg-primary-500 p-2 text-white" title="Send">
            <PaperPlaneRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
