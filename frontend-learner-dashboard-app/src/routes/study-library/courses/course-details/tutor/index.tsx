import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { useSidebar } from "@/components/ui/sidebar";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { useTutorSocket, type TutorBoardOp, type TutorCheckEvent, type TutorStateEvent } from "@/hooks/useTutorSocket";
import { Whiteboard } from "@/components/tutor/Whiteboard";
import { TutorSidebar, type TutorTopicItem } from "@/components/tutor/TutorSidebar";
import { TeacherAvatar } from "@/components/tutor/TeacherAvatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ListBullets } from "@phosphor-icons/react";
import { TeacherPanel, type TranscriptLine, type TutorPhase } from "@/components/tutor/TeacherPanel";
import {
  endTutorSession,
  getTutorChapterSlides,
  startTutorSession,
  type TutorChapterSlide,
  type TutorStartResponse,
} from "@/services/tutor-api";
import { markSlideCompletion } from "@/services/study-library/tracking-api/mark-slide-completion";
import { submitTutorQuizActivity } from "@/services/tutor-api";

interface TutorSearch {
  courseId: string;
  packageSessionId: string;
  chapterId?: string;
  slideId?: string;
  subjectId?: string;
  moduleId?: string;
  mode?: "text" | "voice";
}

export const Route = createFileRoute("/study-library/courses/course-details/tutor/")({
  component: TutorPage,
  validateSearch: (search: Record<string, unknown>): TutorSearch => ({
    courseId: String(search.courseId ?? ""),
    packageSessionId: String(search.packageSessionId ?? ""),
    chapterId: search.chapterId ? String(search.chapterId) : undefined,
    slideId: search.slideId ? String(search.slideId) : undefined,
    subjectId: search.subjectId ? String(search.subjectId) : undefined,
    moduleId: search.moduleId ? String(search.moduleId) : undefined,
    mode: search.mode === "voice" ? "voice" : "text",
  }),
});

type Disconnect = { reason: "lost" | "idle" | "limit" | "credits" | "ended" };

// The teacher "writes" a concept's elements one at a time while speaking,
// instead of dropping the whole board at once.
const REVEAL_MS = 900;
// Voice mode: a concept with no question does not stall on a button — the
// teacher pauses for a beat and carries on, unless the learner taps first.
const AUTO_CONTINUE_MS = 1500;

const DISCONNECT_TEXT: Record<Disconnect["reason"], string> = {
  lost: "The connection to your teacher dropped.",
  idle: "The lesson paused because nothing happened for a while.",
  limit: "This lesson reached its time limit.",
  credits: "Your institute's lesson credits have run out for now.",
  ended: "The lesson ended.",
};

/**
 * Learn with your teacher (design §6): a whiteboard the teacher fills in while
 * speaking, a check after each concept, and a sidebar with the boards of this
 * slide and the chapter's other slides. Progression inside a slide is the
 * server's; moving to the next slide is decided here, and completion is
 * written through the same call the slide viewer uses.
 */
function TutorPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const voiceMode = search.mode === "voice";

  const [boot, setBoot] = useState<TutorStartResponse | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [disconnected, setDisconnected] = useState<Disconnect | null>(null);
  const [phase, setPhase] = useState<TutorPhase>("connecting");
  const [state, setState] = useState<TutorStateEvent | null>(null);
  const [topics, setTopics] = useState<TutorTopicItem[]>([]);
  const [slideTitle, setSlideTitle] = useState("");
  const [boardOps, setBoardOps] = useState<TutorBoardOp[]>([]);
  const [liveOps, setLiveOps] = useState<TutorBoardOp[]>([]);
  const [boardKey, setBoardKey] = useState("b0");
  const [revealKey, setRevealKey] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [check, setCheck] = useState<TutorCheckEvent | null>(null);
  const [awaiting, setAwaiting] = useState<"continue" | "answer" | "done" | null>(null);
  const [chapterSlides, setChapterSlides] = useState<TutorChapterSlide[]>([]);
  const [speakOn, setSpeakOn] = useState(true);
  const [micOn, setMicOn] = useState(false);
  // Phones: the outline lives in a bottom sheet instead of a left rail.
  const [outlineOpen, setOutlineOpen] = useState(false);
  const currentSlideRef = useRef<string | null>(null);
  const sessionRef = useRef<string | null>(null);
  const boardCounter = useRef(0);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bootSeq = useRef(0);

  // The app sidebar folds to its icon rail for the lesson and comes back on leave.
  const sidebar = useSidebar();
  useEffect(() => {
    const wasOpen = sidebar.open;
    if (wasOpen) sidebar.setOpen(false);
    return () => {
      if (wasOpen) sidebar.setOpen(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── progressive board reveal ──
  const revealQueueRef = useRef<TutorBoardOp[]>([]);
  const revealTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopReveal = useCallback(() => {
    if (revealTimerRef.current) {
      clearInterval(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  }, []);
  const flushReveal = useCallback(() => {
    stopReveal();
    const rest = revealQueueRef.current;
    revealQueueRef.current = [];
    if (rest.length) setBoardOps((prev) => [...prev, ...rest]);
  }, [stopReveal]);
  const queueReveal = useCallback(
    (ops: TutorBoardOp[]) => {
      if (!ops.length) return;
      // The first element lands with the narration; the rest write in one by one.
      const [first, ...rest] = ops;
      setBoardOps((prev) => [...prev, first as TutorBoardOp]);
      revealQueueRef.current.push(...rest);
      if (revealQueueRef.current.length && !revealTimerRef.current) {
        revealTimerRef.current = setInterval(() => {
          const op = revealQueueRef.current.shift();
          if (op) setBoardOps((prev) => [...prev, op]);
          if (!revealQueueRef.current.length) stopReveal();
        }, REVEAL_MS);
      }
    },
    [stopReveal],
  );
  useEffect(() => () => stopReveal(), [stopReveal]);

  const showNotice = useCallback((m: string) => {
    setNotice(m);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 7000);
  }, []);

  // ── audio out ──
  const audioPlayer = useAudioPlayer();
  const chunksRef = useRef<Uint8Array[]>([]);
  // Each queued segment carries the sentence(s) it speaks, shown as it starts.
  const queueRef = useRef<Array<{ buf: ArrayBuffer; text: string }>>([]);
  const segmentTextRef = useRef("");
  const teacherTextRef = useRef("");
  const drainingRef = useRef(false);
  // The server's phase for AFTER the current narration; applied when the
  // last queued segment finishes so the label never flips mid-sentence.
  const pendingPhaseRef = useRef<TutorPhase | null>(null);
  const turnEndedRef = useRef(false);
  const takeSegment = useCallback((): ArrayBuffer | null => {
    const chunks = chunksRef.current;
    chunksRef.current = [];
    if (!chunks.length) return null;
    const total = chunks.reduce((s, c) => s + c.length, 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
      out.set(c, off);
      off += c.length;
    }
    return out.buffer as ArrayBuffer;
  }, []);
  const audioBusy = () => voiceMode && speakOn && (drainingRef.current || queueRef.current.length > 0);
  const applyPhase = useCallback(
    (p: TutorPhase) => {
      if (voiceMode && speakOn && (drainingRef.current || queueRef.current.length > 0)) {
        pendingPhaseRef.current = p;
        return;
      }
      setPhase(p);
    },
    [voiceMode, speakOn],
  );
  /** Append spoken text to the teacher's current bubble (voice mode). */
  const revealTeacherText = useCallback((text: string) => {
    if (!text) return;
    setTranscript((prev) => {
      const last = prev[prev.length - 1];
      if (!last || last.role !== "teacher") return [...prev, { role: "teacher", text }];
      const merged = last.text ? `${last.text} ${text}` : text;
      return [...prev.slice(0, -1), { ...last, text: merged }];
    });
  }, []);
  const completeTeacherText = useCallback(() => {
    const full = teacherTextRef.current;
    if (!full) return;
    setTranscript((prev) => {
      const last = prev[prev.length - 1];
      if (!last || last.role !== "teacher" || last.text === full) return prev;
      return [...prev.slice(0, -1), { ...last, text: full }];
    });
  }, []);
  const drain = useCallback(async () => {
    if (drainingRef.current) return;
    drainingRef.current = true;
    try {
      while (queueRef.current.length) {
        const seg = queueRef.current.shift();
        if (!seg) continue;
        setPhase("speaking");
        revealTeacherText(seg.text);
        try {
          await audioPlayer.playAudio(seg.buf);
        } catch {
          /* autoplay blocked or decode error: keep going */
        }
      }
    } finally {
      drainingRef.current = false;
      if (turnEndedRef.current && !queueRef.current.length) {
        const next = pendingPhaseRef.current;
        pendingPhaseRef.current = null;
        setPhase((p) => (p === "speaking" ? (next ?? "idle") : next ?? p));
        completeTeacherText();
      }
    }
  }, [audioPlayer, revealTeacherText, completeTeacherText]);
  const stopAudio = useCallback(() => {
    turnEndedRef.current = false;
    pendingPhaseRef.current = null;
    queueRef.current = [];
    chunksRef.current = [];
    audioPlayer.stop();
    completeTeacherText();
  }, [audioPlayer, completeTeacherText]);

  // ── socket ──
  const socket = useTutorSocket({
    onReady: (ev) => {
      setDisconnected(null);
      setPhase("idle");
      if (Array.isArray(ev.topics)) setTopics(ev.topics as TutorTopicItem[]);
      if (typeof ev.slide_title === "string") setSlideTitle(ev.slide_title);
    },
    onLesson: (ev) => {
      setTopics(ev.topics);
      setSlideTitle(ev.slide_title || "");
      currentSlideRef.current = ev.slide_id;
    },
    onState: (ev) => {
      setState(ev);
      if (ev.phase === "await_answer" || ev.phase === "remediate") applyPhase("question");
      else if (ev.phase === "media_task") applyPhase("media");
      else if (ev.phase === "slide_done") applyPhase("done");
    },
    onBoard: (ops, clear, live, _topicId, replay) => {
      if (live) {
        setLiveOps(ops);
        return;
      }
      // A new concept's elements retire the previous turn's highlights.
      setLiveOps([]);
      if (clear) {
        stopReveal();
        revealQueueRef.current = [];
        boardCounter.current += 1;
        setBoardKey(`b${boardCounter.current}`);
        setBoardOps([]);
        return;
      }
      if (replay) setBoardOps((prev) => [...prev, ...ops]);
      else queueReveal(ops);
    },
    onAiText: (text) => {
      turnEndedRef.current = false;
      teacherTextRef.current = text;
      if (voiceMode && speakOn) {
        // The bubble fills sentence by sentence as the audio plays.
        setTranscript((prev) => [...prev, { role: "teacher", text: "" }]);
      } else {
        setTranscript((prev) => [...prev, { role: "teacher", text }]);
        setPhase("idle");
      }
    },
    onSegmentText: (text) => {
      segmentTextRef.current = text;
    },
    onAudioChunk: (b64) => {
      if (!speakOn) return;
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      chunksRef.current.push(bytes);
    },
    onAudioSegmentEnd: () => {
      const seg = takeSegment();
      const text = segmentTextRef.current;
      segmentTextRef.current = "";
      if (seg) {
        queueRef.current.push({ buf: seg, text });
        void drain();
      } else {
        // No audio for this sentence (engine hiccup): still show the words.
        revealTeacherText(text);
      }
    },
    onAudioEnd: () => {
      // Whatever the teacher has not "written" yet lands before the next step.
      flushReveal();
      setRevealKey((k) => k + 1);
      turnEndedRef.current = true;
      const seg = takeSegment();
      if (seg) queueRef.current.push({ buf: seg, text: segmentTextRef.current });
      segmentTextRef.current = "";
      if (drainingRef.current || queueRef.current.length) {
        void drain();
      } else {
        completeTeacherText();
        const next = pendingPhaseRef.current;
        pendingPhaseRef.current = null;
        setPhase((p) => (p === "speaking" ? (next ?? "idle") : next ?? p));
      }
    },
    onCheck: (ev) => {
      flushReveal();
      setCheck(ev);
      setAwaiting("answer");
      applyPhase("question");
    },
    onAwait: (what) => {
      setAwaiting(what);
      if (what === "answer") applyPhase("question");
      else if (what === "done") applyPhase("media");
      else applyPhase("idle");
    },
    onTranscriptFinal: (text) => {
      if (text) setTranscript((prev) => [...prev, { role: "learner", text }]);
      setPhase("thinking");
    },
    onSlideDone: async (ev) => {
      setPhase("done");
      setAwaiting(null);
      setCheck(null);
      const slideType = currentSlideType();
      const current = chapterSlides.find((s) => s.slide_id === ev.slide_id);
      const ids = {
        chapterId: search.chapterId || current?.chapter_id || undefined,
        moduleId: search.moduleId || current?.module_id || undefined,
        subjectId: search.subjectId || current?.subject_id || undefined,
      };
      try {
        if (slideType === "QUIZ" || (ev.quiz_results?.length ?? 0) > 0) {
          // A quiz is completed through its activity log (the tracking
          // service rejects a manual mark); the server graded each answer.
          await submitTutorQuizActivity({
            slideId: ev.slide_id, packageSessionId: search.packageSessionId, ...ids,
            results: ev.quiz_results ?? [],
          });
        } else {
          await markSlideCompletion({
            slideId: ev.slide_id,
            slideType,
            ...ids,
            packageSessionId: search.packageSessionId,
            completed: true,
          });
        }
      } catch {
        showNotice("Your progress for this slide could not be saved right now.");
      }
    },
    onSummary: () => {
      setPhase("done");
    },
    onEnded: (reason) => {
      stopAudio();
      setDisconnected({ reason: reason === "idle" || reason === "limit" || reason === "credits" ? reason : "ended" });
      setPhase("idle");
    },
    onError: (m, isFatal) => {
      if (isFatal) setFatal(m);
      else {
        showNotice(m);
        setPhase((p) => (p === "thinking" ? "idle" : p));
      }
    },
    onClose: () => {
      setPhase((p) => (p === "done" ? p : "idle"));
      setDisconnected((d) => d ?? { reason: "lost" });
    },
  });

  const currentSlideType = () =>
    chapterSlides.find((s) => s.slide_id === currentSlideRef.current)?.source_type || "DOCUMENT";

  // ── mic ──
  const recorder = useVoiceRecorder({
    onAudioChunk: (b64) => socket.sendAudioChunk(b64),
    onSilenceStop: () => {
      finishRecording();
    },
    onNoSpeech: () => {
      recorder.stopRecording();
      setMicOn(false);
      socket.sendAudioDiscard();
      setPhase("idle");
    },
    silenceTimeout: 2000,
    maxWaitForSpeechMs: 15000,
  });
  // MediaRecorder flushes its last chunk AFTER stop() returns; sending
  // audio_end at once would leave that tail in the server buffer, where it
  // corrupts the next recording's header (every second recording failed).
  const AUDIO_END_DELAY_MS = 400;
  const finishRecording = () => {
    const mime = recorder.mimeType;
    recorder.stopRecording();
    setMicOn(false);
    if (!recorder.hadSpeech()) {
      // A stray press or a quiet room: nothing to transcribe.
      socket.sendAudioDiscard();
      setPhase("idle");
      showNotice("I didn't catch anything. Tap the button and speak when you're ready.");
      return;
    }
    setPhase("thinking");
    window.setTimeout(() => socket.sendAudioEnd(mime), AUDIO_END_DELAY_MS);
  };
  const toggleMic = async () => {
    if (disconnected) return;
    if (micOn) {
      finishRecording();
      return;
    }
    // Barge-in: nothing queued may keep talking into the open microphone,
    // and nothing stale may sit in the server's audio buffer.
    stopAudio();
    socket.sendInterrupt();
    socket.sendAudioDiscard();
    const ok = await recorder.startRecording();
    if (ok) {
      setMicOn(true);
      setPhase("listening");
    } else {
      showNotice("The microphone could not be started. Check the browser's microphone permission.");
    }
  };

  // Voice mode: after the audio of a no-question concept (or a topic summary)
  // has finished, continue by itself. Any tap — the mic, Doubt, typing — changes
  // `awaiting`/`micOn`/`phase` and cancels the timer.
  useEffect(() => {
    if (!voiceMode || awaiting !== "continue" || phase !== "idle" || micOn || !!disconnected) return;
    const t = window.setTimeout(() => {
      setAwaiting(null);
      socket.sendContinue();
    }, AUTO_CONTINUE_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceMode, awaiting, phase, micOn, disconnected]);

  // ── boot (also used by Reconnect: the server resumes from the saved pointer) ──
  const bootSession = useCallback(async () => {
    const seq = ++bootSeq.current;
    setFatal(null);
    setDisconnected(null);
    setPhase("connecting");
    try {
      const [b, slides] = await Promise.all([
        startTutorSession({ packageSessionId: search.packageSessionId, slideId: search.slideId, mode: voiceMode ? "VOICE" : "TEXT" }),
        search.chapterId ? getTutorChapterSlides(search.chapterId, search.packageSessionId) : Promise.resolve([]),
      ]);
      if (seq !== bootSeq.current) {
        // The page moved on while the request was in flight: close what we opened.
        void endTutorSession(b.tutor_session_id);
        return;
      }
      setBoot(b);
      setTopics(b.topics ?? []);
      setSlideTitle(b.slide_title || "");
      setChapterSlides(slides);
      currentSlideRef.current = b.slide_id;
      sessionRef.current = b.tutor_session_id;
      socket.connect(b.socket_path);
    } catch (e: unknown) {
      if (seq !== bootSeq.current) return;
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setFatal(msg || (e instanceof Error ? e.message : "Could not start the tutor"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.packageSessionId, search.slideId, search.chapterId, voiceMode]);

  useEffect(() => {
    void bootSession();
    return () => {
      bootSeq.current += 1;
      socket.disconnect();
      if (sessionRef.current) void endTutorSession(sessionRef.current);
      sessionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootSession]);

  const reconnect = () => {
    stopAudio();
    setTranscript([]);
    setCheck(null);
    setAwaiting(null);
    setLiveOps([]);
    void bootSession();
  };

  const nextSlides = useMemo(
    () => chapterSlides.map((s) => ({ ...s, current: s.slide_id === (state?.slide_id ?? boot?.slide_id) })),
    [chapterSlides, state?.slide_id, boot?.slide_id],
  );
  const nextTeachable = useMemo(() => {
    const idx = chapterSlides.findIndex((s) => s.slide_id === (state?.slide_id ?? boot?.slide_id));
    return chapterSlides.slice(idx + 1).find((s) => s.teachable) || null;
  }, [chapterSlides, state?.slide_id, boot?.slide_id]);

  const goToSlide = (slideId: string) => {
    stopAudio();
    stopReveal();
    revealQueueRef.current = [];
    currentSlideRef.current = slideId;
    setTranscript([]);
    setCheck(null);
    setAwaiting(null);
    setLiveOps([]);
    socket.sendNextSlide(slideId);
  };

  const endAndLeave = () => {
    stopAudio();
    socket.sendEndSession();
    setTimeout(() => {
      navigate({ to: "/study-library/courses/course-details", search: { courseId: search.courseId, packageSessionId: search.packageSessionId } as never });
    }, 400);
  };

  if (fatal) {
    return (
      <LayoutContainer>
        <div className="mx-auto max-w-lg rounded-2xl border border-danger-200 bg-danger-50 p-6 text-center">
          <p className="text-sm text-danger-700">{fatal}</p>
          <div className="mt-4 flex justify-center gap-2">
            <button type="button" className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-700" onClick={() => window.history.back()}>
              Go back
            </button>
            <button type="button" className="rounded-full bg-primary-500 px-4 py-2 text-sm text-white" onClick={reconnect}>
              Try again
            </button>
          </div>
        </div>
      </LayoutContainer>
    );
  }

  const title = slideTitle || chapterSlides.find((s) => s.slide_id === (state?.slide_id ?? boot?.slide_id))?.title || "Lesson";
  const progress = state?.progress ?? boot?.progress ?? { done: 0, total: 1, percent: 0 };
  const lessonOver = phase === "done" && !audioBusy();

  const outline = (
    <TutorSidebar
      slideTitle={title}
      topics={topics}
      activeTopicId={state?.topic_id ?? null}
      progressPercent={progress.percent}
      done={progress.done}
      total={progress.total}
      nextSlides={nextSlides}
      onPickSlide={(id) => {
        setOutlineOpen(false);
        goToSlide(id);
      }}
    />
  );

  return (
    <LayoutContainer fillViewport enableChatbotPanel={false}>
      {/* Phones: a compact teacher strip on top (name, status, outline, end). */}
      <div className="mb-2 flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-3 py-2 lg:hidden">
        <TeacherAvatar fileId={boot?.teacher_avatar_file_id} name={boot?.teacher_name} speaking={phase === "speaking"} className="size-9" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-neutral-900">{boot?.teacher_name || "Teacher"}</p>
          <p className="truncate text-xs text-neutral-500">
            {title} · {progress.done}/{progress.total}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOutlineOpen(true)}
          className="inline-flex items-center gap-1 rounded-full border border-neutral-200 px-3 py-1.5 text-xs text-neutral-700"
        >
          <ListBullets className="size-4" /> Outline
        </button>
      </div>
      <Sheet open={outlineOpen} onOpenChange={setOutlineOpen}>
        <SheetContent side="bottom" className="max-h-svh overflow-y-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="text-start">This lesson</SheetTitle>
          </SheetHeader>
          <div className="mt-3">{outline}</div>
        </SheetContent>
      </Sheet>

      <div className="flex h-full min-h-0 flex-col gap-2 lg:grid lg:grid-cols-12 lg:gap-3">
        <div className="hidden min-h-0 overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-3 lg:col-span-3 lg:block">
          {outline}
        </div>
        <div className="flex min-h-0 flex-1 flex-col lg:col-span-6 lg:min-h-0">
          {disconnected && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700">
              <span>{DISCONNECT_TEXT[disconnected.reason]} Your place is saved.</span>
              {disconnected.reason !== "credits" && (
                <button type="button" onClick={reconnect} className="rounded-full bg-primary-500 px-3 py-1 text-xs font-medium text-white">
                  {disconnected.reason === "lost" ? "Reconnect" : "Continue the lesson"}
                </button>
              )}
              <button type="button" onClick={endAndLeave} className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs text-neutral-700">
                Back to course
              </button>
            </div>
          )}
          <div className="min-h-0 flex-1">
            <Whiteboard ops={boardOps} liveOps={liveOps} boardKey={boardKey} teacherName={boot?.teacher_name} revealKey={revealKey} />
          </div>
          {lessonOver && !disconnected && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">
              <span>Slide complete.</span>
              {nextTeachable ? (
                <button type="button" onClick={() => goToSlide(nextTeachable.slide_id)} className="rounded-full bg-primary-500 px-3 py-1 text-xs font-medium text-white">
                  Next: {nextTeachable.title || "next slide"}
                </button>
              ) : (
                <button type="button" onClick={endAndLeave} className="rounded-full bg-primary-500 px-3 py-1 text-xs font-medium text-white">
                  Back to course
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white p-3 lg:col-span-3 lg:min-h-0">
          <TeacherPanel
            compact
            teacherName={boot?.teacher_name || "Teacher"}
            teacherAvatarFileId={boot?.teacher_avatar_file_id}
            phase={phase}
            transcript={transcript}
            check={check ? { prompt: check.prompt, options: check.options, check_type: check.check_type } : null}
            awaiting={awaiting}
            voiceMode={voiceMode}
            micOn={micOn}
            speakOn={speakOn}
            notice={notice}
            disabled={!!disconnected || phase === "connecting"}
            onSendText={(t) => {
              setTranscript((prev) => [...prev, { role: "learner", text: t }]);
              setPhase("thinking");
              setAwaiting(null);
              socket.sendAnswer(t);
            }}
            onAsk={(t) => {
              setTranscript((prev) => [...prev, { role: "learner", text: t }]);
              setPhase("thinking");
              socket.sendAsk(t);
            }}
            onContinue={() => {
              setAwaiting(null);
              socket.sendContinue();
            }}
            onControl={(intent) => {
              setAwaiting(null);
              socket.sendControl(intent);
            }}
            onToggleMic={() => void toggleMic()}
            onToggleSpeak={() => {
              setSpeakOn((v) => {
                socket.sendConfig({ speak: !v });
                if (v) stopAudio();
                return !v;
              });
            }}
            onInterrupt={() => {
              stopAudio();
              socket.sendInterrupt();
              setPhase("idle");
            }}
            onEnd={endAndLeave}
          />
        </div>
      </div>
    </LayoutContainer>
  );
}
