import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { useTutorSocket, type TutorBoardOp, type TutorCheckEvent, type TutorStateEvent } from "@/hooks/useTutorSocket";
import { Whiteboard } from "@/components/tutor/Whiteboard";
import { TutorSidebar, type TutorTopicItem } from "@/components/tutor/TutorSidebar";
import { TeacherPanel, type TranscriptLine, type TutorPhase } from "@/components/tutor/TeacherPanel";
import {
  endTutorSession,
  getTutorChapterSlides,
  startTutorSession,
  type TutorChapterSlide,
  type TutorStartResponse,
} from "@/services/tutor-api";
import { markSlideCompletion } from "@/services/study-library/tracking-api/mark-slide-completion";

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
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<TutorPhase>("connecting");
  const [state, setState] = useState<TutorStateEvent | null>(null);
  const [boardOps, setBoardOps] = useState<TutorBoardOp[]>([]);
  const [liveOps, setLiveOps] = useState<TutorBoardOp[]>([]);
  const [boardKey, setBoardKey] = useState("b0");
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [check, setCheck] = useState<TutorCheckEvent | null>(null);
  const [awaiting, setAwaiting] = useState<"continue" | "answer" | "done" | null>(null);
  const [chapterSlides, setChapterSlides] = useState<TutorChapterSlide[]>([]);
  const [speakOn, setSpeakOn] = useState(true);
  const [micOn, setMicOn] = useState(false);
  const currentSlideRef = useRef<string | null>(null);
  const sessionRef = useRef<string | null>(null);
  const boardCounter = useRef(0);

  // ── audio out ──
  const audioPlayer = useAudioPlayer();
  const chunksRef = useRef<Uint8Array[]>([]);
  const queueRef = useRef<ArrayBuffer[]>([]);
  const drainingRef = useRef(false);
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
  const drain = useCallback(async () => {
    if (drainingRef.current) return;
    drainingRef.current = true;
    try {
      while (queueRef.current.length) {
        const seg = queueRef.current.shift();
        if (!seg) continue;
        setPhase("speaking");
        try {
          await audioPlayer.playAudio(seg);
        } catch {
          /* autoplay blocked or decode error: keep going */
        }
      }
    } finally {
      drainingRef.current = false;
    }
  }, [audioPlayer]);

  // ── socket ──
  const socket = useTutorSocket({
    onReady: () => setPhase("idle"),
    onState: (ev) => {
      setState(ev);
      if (ev.phase === "await_answer" || ev.phase === "remediate") setPhase("question");
      else if (ev.phase === "media_task") setPhase("media");
      else if (ev.phase === "slide_done") setPhase("done");
    },
    onBoard: (ops, clear, live) => {
      if (live) {
        setLiveOps(ops);
        return;
      }
      if (clear) {
        boardCounter.current += 1;
        setBoardKey(`b${boardCounter.current}`);
        setBoardOps([]);
        setLiveOps([]);
        return;
      }
      setBoardOps((prev) => [...prev, ...ops]);
    },
    onAiText: (text) => {
      setTranscript((prev) => [...prev, { role: "teacher", text }]);
      if (!voiceMode) setPhase("idle");
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
      if (seg) {
        queueRef.current.push(seg);
        void drain();
      }
    },
    onAudioEnd: () => {
      const seg = takeSegment();
      if (seg) queueRef.current.push(seg);
      void drain().then(() => setPhase((p) => (p === "speaking" ? "idle" : p)));
    },
    onCheck: (ev) => {
      setCheck(ev);
      setAwaiting("answer");
      setPhase("question");
    },
    onAwait: (what) => {
      setAwaiting(what);
      if (what === "answer") setPhase("question");
      else if (what === "done") setPhase("media");
    },
    onTranscriptFinal: (text) => {
      if (text) setTranscript((prev) => [...prev, { role: "learner", text }]);
      setPhase("thinking");
    },
    onSlideDone: async (ev) => {
      setPhase("done");
      setAwaiting(null);
      setCheck(null);
      try {
        await markSlideCompletion({
          slideId: ev.slide_id,
          slideType: currentSlideType(),
          chapterId: search.chapterId,
          moduleId: search.moduleId,
          subjectId: search.subjectId,
          packageSessionId: search.packageSessionId,
          completed: true,
        });
      } catch {
        /* progress write is best-effort here; the viewer path still works */
      }
    },
    onSummary: () => {
      setPhase("done");
    },
    onError: (m) => setError(m),
    onClose: () => setPhase((p) => (p === "done" ? p : "idle")),
  });

  const currentSlideType = () =>
    chapterSlides.find((s) => s.slide_id === currentSlideRef.current)?.source_type || "DOCUMENT";

  // ── mic ──
  const recorder = useVoiceRecorder({
    onAudioChunk: (b64) => socket.sendAudioChunk(b64),
    onSilenceStop: () => {
      recorder.stopRecording();
      setMicOn(false);
      socket.sendAudioEnd(recorder.mimeType);
      setPhase("thinking");
    },
    onNoSpeech: () => {
      recorder.stopRecording();
      setMicOn(false);
      socket.sendAudioDiscard();
    },
    silenceTimeout: 2000,
    maxWaitForSpeechMs: 15000,
  });
  const toggleMic = async () => {
    if (micOn) {
      recorder.stopRecording();
      setMicOn(false);
      socket.sendAudioEnd(recorder.mimeType);
      return;
    }
    audioPlayer.stop();
    socket.sendInterrupt();
    const ok = await recorder.startRecording();
    if (ok) {
      setMicOn(true);
      setPhase("listening");
    }
  };

  // ── boot ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [b, slides] = await Promise.all([
          startTutorSession({ packageSessionId: search.packageSessionId, slideId: search.slideId, mode: voiceMode ? "VOICE" : "TEXT" }),
          search.chapterId ? getTutorChapterSlides(search.chapterId, search.packageSessionId) : Promise.resolve([]),
        ]);
        if (cancelled) return;
        setBoot(b);
        setChapterSlides(slides);
        currentSlideRef.current = b.slide_id;
        sessionRef.current = b.tutor_session_id;
        socket.connect(b.socket_path);
      } catch (e: unknown) {
        const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        setError(msg || (e instanceof Error ? e.message : "Could not start the tutor"));
      }
    })();
    return () => {
      cancelled = true;
      socket.disconnect();
      if (sessionRef.current) void endTutorSession(sessionRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.packageSessionId, search.slideId, voiceMode]);

  const topics: TutorTopicItem[] = useMemo(() => boot?.topics ?? [], [boot]);
  const nextSlides = useMemo(
    () => chapterSlides.map((s) => ({ ...s, current: s.slide_id === (state?.slide_id ?? boot?.slide_id) })),
    [chapterSlides, state?.slide_id, boot?.slide_id],
  );
  const nextTeachable = useMemo(() => {
    const idx = chapterSlides.findIndex((s) => s.slide_id === (state?.slide_id ?? boot?.slide_id));
    return chapterSlides.slice(idx + 1).find((s) => s.teachable) || null;
  }, [chapterSlides, state?.slide_id, boot?.slide_id]);

  const goToSlide = (slideId: string) => {
    currentSlideRef.current = slideId;
    setTranscript([]);
    setCheck(null);
    setAwaiting(null);
    socket.sendNextSlide(slideId);
  };

  const endAndLeave = () => {
    socket.sendEndSession();
    setTimeout(() => {
      navigate({ to: "/study-library/courses/course-details", search: { courseId: search.courseId, packageSessionId: search.packageSessionId } as never });
    }, 400);
  };

  if (error) {
    return (
      <LayoutContainer>
        <div className="mx-auto max-w-lg rounded-2xl border border-danger-200 bg-danger-50 p-6 text-center">
          <p className="text-sm text-danger-700">{error}</p>
          <button type="button" className="mt-4 rounded-full bg-primary-500 px-4 py-2 text-sm text-white" onClick={() => window.history.back()}>
            Go back
          </button>
        </div>
      </LayoutContainer>
    );
  }

  const slideTitle = boot?.topics?.[0]?.title ? (chapterSlides.find((s) => s.slide_id === (state?.slide_id ?? boot?.slide_id))?.title || "Lesson") : "Lesson";
  const progress = state?.progress ?? boot?.progress ?? { done: 0, total: 1, percent: 0 };

  return (
    <LayoutContainer>
      <div className="grid min-h-96 grid-cols-1 gap-3 lg:h-full lg:grid-cols-12">
        <div className="hidden rounded-2xl border border-neutral-200 bg-white p-3 lg:col-span-3 lg:block">
          <TutorSidebar
            slideTitle={slideTitle}
            topics={topics}
            activeTopicId={state?.topic_id ?? null}
            progressPercent={progress.percent}
            done={progress.done}
            total={progress.total}
            nextSlides={nextSlides}
            onPickSlide={goToSlide}
          />
        </div>
        <div className="min-h-0 lg:col-span-6">
          <Whiteboard ops={boardOps} liveOps={liveOps} boardKey={boardKey} teacherName={boot?.teacher_name} />
          {phase === "done" && (
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
        <div className="rounded-2xl border border-neutral-200 bg-white p-3 lg:col-span-3">
          <TeacherPanel
            teacherName={boot?.teacher_name || "Teacher"}
            phase={phase}
            transcript={transcript}
            check={check ? { prompt: check.prompt, options: check.options, check_type: check.check_type } : null}
            awaiting={awaiting}
            voiceMode={voiceMode}
            micOn={micOn}
            speakOn={speakOn}
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
                if (v) audioPlayer.stop();
                return !v;
              });
            }}
            onInterrupt={() => {
              audioPlayer.stop();
              queueRef.current = [];
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
