import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { Play, Send, Check, X, Loader2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import confetti from "canvas-confetti";
import { Preferences } from "@capacitor/preferences";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  LANGUAGE_REGISTRY,
  getLanguageDef,
} from "./language-registry";
import type {
  CodingQuestionConfig,
  CodingSubmission,
  LangId,
  TestCaseResult,
  Verdict,
} from "./types";
import { runCode, runTestCase } from "./executor";
import { SessionTimer } from "./SessionTimer";
import { clearSessionTimer } from "./session-timer-utils";
import { SubmissionHistory } from "./SubmissionHistory";
import { saveSubmission } from "./submission-store";

interface Props {
  question: CodingQuestionConfig;
  slideId: string;
}

function pickInitialLang(allowed: LangId[]): LangId {
  return allowed.length ? allowed[0]! : "python";
}

function classify(passed: number, total: number, hadError: boolean): Verdict {
  if (total === 0) return "ERROR";
  if (hadError && passed === 0) return "ERROR";
  if (passed === total) return "ACCEPTED";
  if (passed === 0) return "REJECTED";
  return "PARTIAL";
}

export function QuestionModeView({ question, slideId }: Props) {
  // Per-language code, kept locally (not persisted across sessions in v1).
  const [codeByLang, setCodeByLang] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const l of question.allowedLanguages) {
      init[l] =
        question.starterCode[l] ?? LANGUAGE_REGISTRY[l]?.starter ?? "";
    }
    return init;
  });
  const [language, setLanguage] = useState<LangId>(() =>
    pickInitialLang(question.allowedLanguages),
  );

  const [output, setOutput] = useState<string>("");
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bottomTab, setBottomTab] = useState<
    "tests" | "output" | "history"
  >("tests");
  const [testResults, setTestResults] = useState<TestCaseResult[] | null>(
    null,
  );
  const [latestVerdict, setLatestVerdict] = useState<Verdict | null>(null);
  const [latestScore, setLatestScore] = useState<number | null>(null);
  const [historyTick, setHistoryTick] = useState(0);
  const submitInFlightRef = useRef(false);

  const def = getLanguageDef(language);

  const handleLangChange = useCallback((l: LangId) => {
    setLanguage(l);
    setCodeByLang((prev) =>
      prev[l] != null
        ? prev
        : {
            ...prev,
            [l]:
              question.starterCode[l] ?? LANGUAGE_REGISTRY[l]?.starter ?? "",
          },
    );
  }, [question.starterCode]);

  const sampleCases = useMemo(
    () => question.testCases.filter((t) => t.visible),
    [question.testCases],
  );
  const hiddenCount = question.testCases.length - sampleCases.length;

  // ---- RUN: execute against sample test cases (if any) or just stdin=""
  const onRun = useCallback(async () => {
    if (isRunning || isSubmitting) return;
    setIsRunning(true);
    setBottomTab(sampleCases.length ? "tests" : "output");
    setTestResults(null);
    setOutput("Running...");
    try {
      const code = codeByLang[language] ?? "";
      if (sampleCases.length === 0) {
        const r = await runCode(code, language, {
          cpuSeconds: question.perRunLimits.cpuSeconds,
          memoryKb: question.perRunLimits.memoryKb,
        });
        setOutput(r.output);
      } else {
        const results: TestCaseResult[] = [];
        for (const tc of sampleCases) {
          const r = await runTestCase(
            code,
            language,
            tc.stdin,
            tc.expectedStdout,
            {
              cpuSeconds: question.perRunLimits.cpuSeconds,
              memoryKb: question.perRunLimits.memoryKb,
            },
          );
          results.push({
            id: tc.id,
            label: tc.label,
            visible: true,
            passed: r.passed,
            stdout: r.stdout,
            expected: tc.expectedStdout,
            stderr: r.stderr,
            timeMs: r.timeMs,
            memoryKb: r.memoryKb,
            error: r.error,
          });
        }
        setTestResults(results);
        setOutput(
          results
            .map(
              (r, i) =>
                `--- ${r.label || `Sample ${i + 1}`}: ${r.passed ? "PASS" : "FAIL"} ---\n${r.stdout || "(no stdout)"}`,
            )
            .join("\n\n"),
        );
      }
    } catch (e) {
      setOutput(
        "Run error: " + (e instanceof Error ? e.message : String(e)),
      );
    } finally {
      setIsRunning(false);
    }
  }, [
    codeByLang,
    language,
    sampleCases,
    isRunning,
    isSubmitting,
    question.perRunLimits.cpuSeconds,
    question.perRunLimits.memoryKb,
  ]);

  // ---- SUBMIT: run ALL test cases, store the submission
  const submit = useCallback(
    async (auto = false) => {
      if (submitInFlightRef.current) return;
      submitInFlightRef.current = true;
      setIsSubmitting(true);
      setBottomTab("tests");
      const code = codeByLang[language] ?? "";
      const results: TestCaseResult[] = [];
      let totalTime = 0;
      let peakMemory = 0;
      let hadError = false;
      try {
        for (const tc of question.testCases) {
          const r = await runTestCase(code, language, tc.stdin, tc.expectedStdout, {
            cpuSeconds: question.perRunLimits.cpuSeconds,
            memoryKb: question.perRunLimits.memoryKb,
          });
          if (r.error) hadError = true;
          totalTime += r.timeMs ?? 0;
          peakMemory = Math.max(peakMemory, r.memoryKb ?? 0);
          results.push({
            id: tc.id,
            label: tc.label,
            visible: tc.visible,
            passed: r.passed,
            stdout: r.stdout,
            expected: tc.expectedStdout,
            stderr: r.stderr,
            timeMs: r.timeMs,
            memoryKb: r.memoryKb,
            error: r.error,
          });
        }

        const passed = results.filter((r) => r.passed).length;
        const total = results.length;
        const verdict = classify(passed, total, hadError);
        const score =
          total === 0 ? 0 : (passed / total) * question.maxPoints;

        // Pull the timer's start time (set on first mount by SessionTimer) so
        // the backend can record how long the learner actually took. Only
        // present when the question has a session timer; otherwise undefined.
        let sessionStartedAt: number | undefined;
        if (question.sessionTimeMinutes) {
          try {
            const { value } = await Preferences.get({
              key: `coding_session_started_${slideId}`,
            });
            if (value) {
              const n = Number(value);
              if (Number.isFinite(n)) sessionStartedAt = n;
            }
          } catch {
            // Preferences unavailable (e.g. SSR / web build without plugin)
            // — leave undefined.
          }
        }

        const submission: CodingSubmission = {
          id: uuidv4(),
          slideId,
          language,
          sourceCode: code,
          verdict,
          passedCount: passed,
          totalCount: total,
          score,
          maxPoints: question.maxPoints,
          results,
          totalTimeMs: totalTime,
          peakMemoryKb: peakMemory,
          submittedAt: Date.now(),
          sessionStartedAt,
        };

        await saveSubmission(submission);
        setTestResults(results);
        setLatestVerdict(verdict);
        setLatestScore(score);
        setHistoryTick((t) => t + 1);

        if (verdict === "ACCEPTED" && !auto) {
          try {
            confetti({
              particleCount: 120,
              spread: 70,
              origin: { y: 0.6 },
            });
          } catch {
            // ignore — confetti is best-effort
          }
        }
        if (auto) {
          // Session expired — clear so a future visit starts a fresh timer.
          await clearSessionTimer(slideId);
        }
      } catch (e) {
        setOutput(
          "Submit failed: " + (e instanceof Error ? e.message : String(e)),
        );
      } finally {
        submitInFlightRef.current = false;
        setIsSubmitting(false);
      }
    },
    [
      codeByLang,
      language,
      question.testCases,
      question.perRunLimits.cpuSeconds,
      question.perRunLimits.memoryKb,
      question.maxPoints,
      question.sessionTimeMinutes,
      slideId,
    ],
  );

  // Auto-submit when the session timer expires.
  const onTimerExpire = useCallback(() => {
    submit(true);
  }, [submit]);

  // ---- Resize: vertical split (top = code+problem, bottom = output/tests)
  const [bottomHeight, setBottomHeight] = useState(220);
  const resizingRef = useRef(false);
  const onResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
  };
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      const vh = window.innerHeight;
      const next = Math.min(Math.max(vh - e.clientY, 120), vh * 0.7);
      setBottomHeight(next);
    };
    const up = () => {
      resizingRef.current = false;
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded border bg-white">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b bg-gray-50 px-3 py-2">
        <Select
          value={language}
          onValueChange={(v) => handleLangChange(v as LangId)}
        >
          <SelectTrigger className="h-8 w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {question.allowedLanguages.map((l) => (
              <SelectItem key={l} value={l}>
                {LANGUAGE_REGISTRY[l]?.label ?? l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Badge variant="outline" className="text-[10px]">
          {def.executor}
        </Badge>

        <div className="ml-auto flex items-center gap-2">
          {question.sessionTimeMinutes ? (
            <SessionTimer
              slideId={slideId}
              totalMinutes={question.sessionTimeMinutes}
              onExpire={onTimerExpire}
            />
          ) : null}

          <Button
            variant="outline"
            size="sm"
            onClick={onRun}
            disabled={isRunning || isSubmitting}
          >
            {isRunning ? (
              <Loader2 className="mr-1 size-4 animate-spin" />
            ) : (
              <Play className="mr-1 size-4" />
            )}
            Run
          </Button>

          <Button
            size="sm"
            onClick={() => submit(false)}
            disabled={isSubmitting || isRunning}
            className="bg-primary-500 text-white hover:bg-primary-600"
          >
            {isSubmitting ? (
              <Loader2 className="mr-1 size-4 animate-spin" />
            ) : (
              <Send className="mr-1 size-4" />
            )}
            Submit
          </Button>
        </div>
      </div>

      {/* Two-column top: problem + editor */}
      <div
        className="flex min-h-0 flex-1"
        style={{ height: `calc(100% - ${bottomHeight + 36}px)` }}
      >
        {/* Problem */}
        <div className="w-2/5 min-w-[280px] overflow-auto border-r bg-white p-4">
          {question.problemHtml ? (
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: question.problemHtml }}
            />
          ) : (
            <p className="text-sm text-gray-500">
              No problem statement provided yet.
            </p>
          )}
          <div className="mt-3 text-xs text-gray-500">
            Max points:{" "}
            <span className="font-medium">{question.maxPoints}</span> ·{" "}
            {question.testCases.length} test
            {question.testCases.length === 1 ? "" : "s"} ({sampleCases.length}{" "}
            visible, {hiddenCount} hidden) · CPU{" "}
            {question.perRunLimits.cpuSeconds}s · Mem{" "}
            {Math.round(question.perRunLimits.memoryKb / 1000)}MB
          </div>
        </div>

        {/* Editor */}
        <div className="min-h-0 flex-1">
          <Editor
            height="100%"
            language={def.monacoLang}
            value={codeByLang[language] ?? ""}
            theme="vs-dark"
            onChange={(v) =>
              setCodeByLang((prev) => ({ ...prev, [language]: v ?? "" }))
            }
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              automaticLayout: true,
              scrollBeyondLastLine: false,
              lineNumbers: "on",
              padding: { top: 12 },
            }}
          />
        </div>
      </div>

      {/* Resize handle */}
      <div
        className="h-1 cursor-ns-resize bg-gray-200 hover:bg-gray-300"
        onMouseDown={onResizeStart}
      />

      {/* Bottom panel: tabs */}
      <div
        className="flex flex-col overflow-hidden border-t bg-white"
        style={{ height: bottomHeight }}
      >
        <Tabs
          value={bottomTab}
          onValueChange={(v) => setBottomTab(v as typeof bottomTab)}
          className="flex h-full flex-col"
        >
          <div className="flex items-center justify-between border-b px-3 py-1">
            <TabsList>
              <TabsTrigger value="tests">
                Test Cases
                {testResults
                  ? ` (${testResults.filter((r) => r.passed).length}/${testResults.length})`
                  : ""}
              </TabsTrigger>
              <TabsTrigger value="output">Output</TabsTrigger>
              <TabsTrigger value="history">My Submissions</TabsTrigger>
            </TabsList>
            {latestVerdict && (
              <div className="text-xs">
                <span className="font-semibold">{latestVerdict}</span>
                {latestScore != null && (
                  <span className="ml-1 text-gray-500">
                    {latestScore.toFixed(1)} / {question.maxPoints}
                  </span>
                )}
              </div>
            )}
          </div>

          <TabsContent
            value="tests"
            className="m-0 flex-1 overflow-auto p-3"
          >
            {testResults ? (
              <div className="space-y-2">
                {testResults.map((r, i) => (
                  <div
                    key={r.id}
                    className={`rounded border p-2 text-xs ${
                      r.passed
                        ? "border-green-200 bg-green-50"
                        : "border-red-200 bg-red-50"
                    }`}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      {r.passed ? (
                        <Check className="size-3 text-green-600" />
                      ) : (
                        <X className="size-3 text-red-600" />
                      )}
                      <span className="font-medium">
                        {r.label || (r.visible ? `Sample ${i + 1}` : `Hidden ${i + 1}`)}
                      </span>
                      <span className="text-gray-500">
                        {r.visible ? "(sample)" : "(hidden)"}
                      </span>
                      {r.timeMs != null && (
                        <span className="ml-auto text-gray-500">
                          {r.timeMs} ms
                        </span>
                      )}
                    </div>
                    {r.visible && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-[10px] font-semibold uppercase text-gray-500">
                            Your output
                          </div>
                          <pre className="overflow-auto rounded bg-white p-1 font-mono text-[11px]">
                            {r.stdout || "(empty)"}
                          </pre>
                        </div>
                        <div>
                          <div className="text-[10px] font-semibold uppercase text-gray-500">
                            Expected
                          </div>
                          <pre className="overflow-auto rounded bg-white p-1 font-mono text-[11px]">
                            {r.expected || "(empty)"}
                          </pre>
                        </div>
                      </div>
                    )}
                    {r.stderr && (
                      <pre className="mt-1 overflow-auto rounded bg-white p-1 font-mono text-[11px] text-red-700">
                        {r.stderr}
                      </pre>
                    )}
                    {r.error && (
                      <div className="mt-1 text-[11px] text-red-700">
                        {r.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {sampleCases.length === 0 ? (
                  <p className="text-xs text-gray-500">
                    No sample test cases shown by the author. {hiddenCount}{" "}
                    hidden test{hiddenCount === 1 ? "" : "s"} will run on
                    Submit.
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-gray-500">
                      Hit Run to evaluate against the {sampleCases.length}{" "}
                      sample test{sampleCases.length === 1 ? "" : "s"}.
                    </p>
                    {sampleCases.map((tc, i) => (
                      <div
                        key={tc.id}
                        className="rounded border p-2 text-xs"
                      >
                        <div className="mb-1 font-medium">
                          {tc.label || `Sample ${i + 1}`}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <div className="text-[10px] font-semibold uppercase text-gray-500">
                              Input
                            </div>
                            <pre className="overflow-auto rounded bg-gray-50 p-1 font-mono text-[11px]">
                              {tc.stdin || "(empty)"}
                            </pre>
                          </div>
                          <div>
                            <div className="text-[10px] font-semibold uppercase text-gray-500">
                              Expected output
                            </div>
                            <pre className="overflow-auto rounded bg-gray-50 p-1 font-mono text-[11px]">
                              {tc.expectedStdout || "(empty)"}
                            </pre>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="output" className="m-0 flex-1 overflow-auto">
            <pre className="h-full overflow-auto bg-gray-900 p-3 font-mono text-xs text-green-300">
              {output || 'Hit "Run" to see output here.'}
            </pre>
          </TabsContent>

          <TabsContent
            value="history"
            className="m-0 flex-1 overflow-auto p-3"
          >
            <SubmissionHistory slideId={slideId} refreshKey={historyTick} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
