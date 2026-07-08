"""
AI coding-question generation.

Takes a rough problem idea from an admin and authors a complete coding question
for the Vacademy coding platform: an HTML problem statement (with an explicit
stdin/stdout I/O contract), sample + hidden test cases, per-language starter
code with the I/O already wired, per-run settings, and a reference solution the
frontend runs in-browser to self-verify the generated test cases before the
admin reviews them.

This is a sibling of QuizService (assessment generation): build a strict-JSON
prompt, call ChatLLMClient (OpenRouter -> Gemini), extract + validate JSON.

CRITICAL DESIGN NOTE — the platform grades by comparing the program's STDOUT to
each test case's expected output (trim both sides, then exact match). There is
no return-value grading. So every generated question MUST define an explicit
input/output format, the starter MUST read stdin and print, and expected
outputs MUST be exactly what the reference solution prints.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# LangIds the platform's in-browser executor supports.
SUPPORTED_LANGUAGES = ("python", "javascript", "c", "cpp", "java", "go")

# Languages that run instantly in the browser (Pyodide / JS Function) — used to
# pick the reference-solution language so the FE self-verify is fast and doesn't
# depend on the rate-limited Judge0 path.
INSTANT_VERIFY_LANGUAGES = ("python", "javascript")


class CodingQuestionService:
    """Generates a single coding-question config from a natural-language idea."""

    def __init__(self, llm_client):
        self.llm_client = llm_client

    async def generate(
        self,
        *,
        idea: str,
        allowed_languages: List[str],
        difficulty: str = "medium",
        num_test_cases: int = 5,
        institute_id: Optional[str] = None,
        user_id: Optional[str] = None,
        model: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Author a coding question. Returns a dict shaped for the admin UI.

        Raises RuntimeError on LLM failure or if no valid question could be
        parsed.
        """
        langs = self._sanitize_languages(allowed_languages)
        verify_language = self._pick_verify_language(langs)
        diff = (difficulty or "medium").lower()
        if diff not in ("easy", "medium", "hard"):
            diff = "medium"
        n_tests = max(2, min(int(num_test_cases or 5), 12))

        prompt = self._build_prompt(
            idea=idea,
            langs=langs,
            verify_language=verify_language,
            difficulty=diff,
            num_test_cases=n_tests,
        )

        if model:
            logger.info("[coding-gen] (note) caller hinted model=%s; ChatLLMClient resolves actual model.", model)

        try:
            response = await self.llm_client.chat_completion(
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are an expert competitive-programming problem setter. "
                            "You author coding questions for a platform that grades by "
                            "comparing a program's STDOUT to expected output (trimmed, "
                            "exact match). Always respond with a single valid JSON object "
                            "and nothing else."
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
                tools=None,
                temperature=0.3,
                max_tokens=16384,
                institute_id=institute_id,
                user_id=user_id,
                model=model,
            )
        except Exception as e:  # noqa: BLE001
            logger.error("[coding-gen] LLM call failed: %s", e, exc_info=True)
            raise RuntimeError(f"Failed to generate coding question: {e}") from e

        content = (response.get("content") or "") if isinstance(response, dict) else ""
        usage = (response.get("usage") or {}) if isinstance(response, dict) else {}
        prompt_toks = int(usage.get("prompt_tokens") or usage.get("promptTokenCount") or 0)
        completion_toks = int(usage.get("completion_tokens") or usage.get("candidatesTokenCount") or 0)

        json_str = self._extract_json(content)
        if not json_str or not json_str.strip():
            logger.error(
                "[coding-gen] LLM returned empty/unparseable content. keys=%s len=%d head=%r",
                list(response.keys()) if isinstance(response, dict) else type(response).__name__,
                len(content),
                content[:200],
            )
            raise RuntimeError(
                "LLM returned an empty response — likely rate-limited, content-filtered, "
                "or an API key/model issue. Retry, and check ai-service logs if it persists."
            )

        try:
            data = json.loads(json_str, strict=False)
        except Exception as e:  # noqa: BLE001
            logger.error("[coding-gen] JSON parse failed: %s; head=%r", e, json_str[:300])
            raise RuntimeError(f"Failed to parse generated coding question JSON: {e}") from e

        return self._normalize(data, langs=langs, verify_language=verify_language,
                               prompt_toks=prompt_toks, completion_toks=completion_toks)

    # ------------------------------------------------------------------
    # Prompt
    # ------------------------------------------------------------------
    def _build_prompt(self, *, idea: str, langs: List[str], verify_language: str,
                      difficulty: str, num_test_cases: int) -> str:
        langs_csv = ", ".join(langs)
        return f"""Author ONE coding question for our platform from the idea below.

IDEA (may be rough — fill gaps sensibly and state no assumptions in prose, only in the problem):
\"\"\"
{idea}
\"\"\"

TARGET LANGUAGES: {langs_csv}
DIFFICULTY: {difficulty}
TOTAL TEST CASES: {num_test_cases} (make ~2 of them visible "samples", the rest hidden)

HOW THE PLATFORM GRADES (design for this — it is NOT LeetCode):
- The learner's program READS FROM STDIN and PRINTS the answer to STDOUT.
- Grading compares the program's stdout to each test's expected output: both are
  TRIMMED (leading/trailing whitespace removed) then compared EXACTLY
  (case-sensitive, internal spaces significant). There is NO return-value grading.
- A test may list MULTIPLE accepted outputs; it passes if stdout matches ANY.

RULES:
1. Write an explicit, unambiguous INPUT and OUTPUT format into the problem, with an
   exact example input and output. Put the statement in simple HTML (use <p>, <b>,
   <ul>/<li>, <pre> for I/O blocks). This becomes problem_html.
2. Prefer a CANONICAL output so each test has ONE correct string (e.g. "print in
   increasing order", "round to 2 decimals", "lowercase", space-separated). Use
   multiple accepted_outputs ONLY for a small finite set of valid forms (e.g. the
   two orderings of a pair). NEVER enumerate a large/combinatorial set — constrain
   the output format instead.
3. starter_code: for EACH target language, a runnable skeleton with the read-stdin
   and print plumbing already written and a clearly-named function the learner
   fills (leave a TODO). The unsolved starter must RUN without a syntax/runtime
   error and simply produce wrong output — never crash.
4. Provide a reference SOLUTION in {verify_language} that PASSES every test. Derive
   each test's accepted_outputs by mentally RUNNING this solution on that input —
   do not guess. accepted_outputs[0] is the exact string the solution prints.
5. Kill non-determinism: fixed float formatting, no randomness, stable ordering,
   no debug prints, no prompt text in output.
6. Keep test inputs small and valid per your constraints. Cover edge cases in the
   hidden tests (empty/min/max/boundary/duplicates as relevant).
7. PYTHON ONLY: call your entry function at the TOP LEVEL. Do NOT wrap the stdin
   reading / printing in `if __name__ == "__main__":` — the in-browser Python
   sandbox may not set __name__, so a guarded block would print nothing. (C/C++/
   Java keep their normal main().)

Return ONLY this JSON object, no markdown, no commentary:
{{
  "title": "Short title (3-8 words)",
  "problem_html": "<p>...statement with <b>Input</b>, <b>Output</b>, <b>Example</b>, <b>Constraints</b>...</p>",
  "allowed_languages": [{", ".join('"' + l + '"' for l in langs)}],
  "starter_code": {{ {", ".join('"' + l + '": "...runnable skeleton..."' for l in langs)} }},
  "test_cases": [
    {{
      "label": "Sample 1",
      "input": "exact stdin, use \\n for newlines between lines",
      "accepted_outputs": ["exact expected stdout", "optional alternative"],
      "visible": true
    }}
  ],
  "solution": {{ "language": "{verify_language}", "source_code": "full working solution that reads stdin and prints" }},
  "settings": {{ "max_points": 100, "cpu_seconds": 2, "memory_kb": 256000, "session_time_minutes": null }}
}}
"""

    # ------------------------------------------------------------------
    # Normalization / validation
    # ------------------------------------------------------------------
    def _normalize(self, data: Dict[str, Any], *, langs: List[str], verify_language: str,
                   prompt_toks: int, completion_toks: int) -> Dict[str, Any]:
        title = (str(data.get("title") or "").strip()) or "Coding Question"
        problem_html = str(data.get("problem_html") or "").strip()
        if not problem_html:
            raise RuntimeError("Generated question has no problem statement.")

        # Keep only supported languages the caller asked for.
        out_langs = [l for l in self._sanitize_languages(data.get("allowed_languages") or []) if l in langs] or langs

        raw_starter = data.get("starter_code") or {}
        starter_code: Dict[str, str] = {}
        if isinstance(raw_starter, dict):
            for lang in out_langs:
                code = raw_starter.get(lang)
                if isinstance(code, str) and code.strip():
                    starter_code[lang] = code

        test_cases: List[Dict[str, Any]] = []
        for i, tc in enumerate(data.get("test_cases") or []):
            if not isinstance(tc, dict):
                continue
            accepted = tc.get("accepted_outputs")
            if isinstance(accepted, str):
                accepted = [accepted]
            if not isinstance(accepted, list):
                # Fall back to a single expected field if the model used one.
                single = tc.get("expected_output") or tc.get("expectedStdout")
                accepted = [single] if isinstance(single, str) else []
            accepted = [str(a) for a in accepted if a is not None]
            if not accepted:
                logger.warning("[coding-gen] dropping test case idx=%d with no accepted outputs", i)
                continue
            test_cases.append({
                "label": str(tc.get("label") or f"Test {len(test_cases) + 1}"),
                "input": str(tc.get("input") or ""),
                "accepted_outputs": accepted,
                "visible": bool(tc.get("visible", i < 2)),
            })

        if not test_cases:
            raise RuntimeError("Generated question has no valid test cases.")

        sol = data.get("solution") or {}
        solution = {
            "language": (str(sol.get("language") or verify_language) if isinstance(sol, dict) else verify_language),
            "source_code": (str(sol.get("source_code") or "") if isinstance(sol, dict) else ""),
        }
        if solution["language"] not in SUPPORTED_LANGUAGES:
            solution["language"] = verify_language

        raw_settings = data.get("settings") or {}
        settings = {
            "max_points": self._safe_int(raw_settings.get("max_points"), 100),
            "cpu_seconds": self._safe_float(raw_settings.get("cpu_seconds"), 2.0),
            "memory_kb": self._safe_int(raw_settings.get("memory_kb"), 256000),
            "session_time_minutes": (
                self._safe_int(raw_settings.get("session_time_minutes"), None)
                if raw_settings.get("session_time_minutes") is not None else None
            ),
        }

        return {
            "title": title,
            "problem_html": problem_html,
            "allowed_languages": out_langs,
            "starter_code": starter_code,
            "test_cases": test_cases,
            "solution": solution,
            "settings": settings,
            "usage": {"prompt_tokens": prompt_toks, "completion_tokens": completion_toks},
        }

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    @staticmethod
    def _sanitize_languages(langs: Any) -> List[str]:
        if not isinstance(langs, list):
            return ["python"]
        seen: List[str] = []
        for l in langs:
            key = str(l).strip().lower()
            if key in SUPPORTED_LANGUAGES and key not in seen:
                seen.append(key)
        return seen or ["python"]

    @staticmethod
    def _pick_verify_language(langs: List[str]) -> str:
        for l in INSTANT_VERIFY_LANGUAGES:
            if l in langs:
                return l
        return langs[0] if langs else "python"

    @staticmethod
    def _safe_int(value: Any, default):
        try:
            return int(value)
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _safe_float(value: Any, default):
        try:
            return float(value)
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _extract_json(text: str) -> str:
        """Pull the first balanced JSON object out of an LLM response, tolerating
        ```json fences and leading/trailing prose."""
        if not text:
            return ""
        # Strip code fences.
        fenced = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.DOTALL)
        if fenced:
            return fenced.group(1)
        # Otherwise take from the first { to the last } (greedy balanced-ish).
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            return text[start:end + 1]
        return ""
