"use client";

import Editor from "@monaco-editor/react";
import type { OnMount } from "@monaco-editor/react";
import {
  CheckCircle2,
  ChevronDown,
  Crosshair,
  Eye,
  FileText,
  FlaskConical,
  Keyboard,
  Leaf,
  Loader2,
  MessageSquare,
  Play,
  Plus,
  Settings,
  Sparkles,
  Target,
  TerminalSquare,
  Upload,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { fingerprintProblemClient } from "@/lib/guidance/problem-fingerprint-client";
import { settingsKey as composeSeedSettingsKey } from "@/lib/guidance/problem-fingerprint";
import { formatSeedHintComment } from "@/features/workspace/lib/seed-hint-format";
import { registerSeedInlineHintProvider, triggerInlineSuggest } from "@/features/workspace/monaco/register-seed-inline";

const SEED_IDLE_MS = 45_000;
const SEED_PAUSE_MS = 1_800;
const MAX_PROBLEM_TEXT_FILE_BYTES = 120_000;
const MIN_NONWS_CHARS_AFTER_ACCEPT = 5;

type Language = "cpp" | "python";
type Mode = "SEED" | "FOCUS" | "SHADOW";
type HintDelivery = "automatic" | "on_demand";
type CodeDisclosure = "allow_minimal_code" | "no_code";

type ExecutionState = {
  output: string;
  stdout: string;
  stderr: string;
  compileOutput: string;
  exitCode: number;
  error: string;
};

type TestCase = {
  id: string;
  input: string;
  expectedOutput: string;
};

type TestCaseResult = {
  index: number;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
  exitCode: number;
  stderr: string;
  compileError: string;
};

type SubmitSummary = {
  total: number;
  passed: number;
  results: TestCaseResult[];
};

type ParsedProblemPayload = {
  title: string;
  description: string;
  constraints: string;
  inputOutputFormat: string;
  examples: string;
};

const templates: Record<Language, string> = {
  cpp: `#include <bits/stdc++.h>
using namespace std;

int main() {
  // Your solution here
  return 0;
}
`,
  python: `# Your solution here
`,
};

type ModeCard = {
  id: Mode;
  tagline: string;
  longDescription: string;
  icon: typeof Leaf;
};

const MODE_CARDS: ModeCard[] = [
  {
    id: "SEED",
    tagline: "Step-by-step teaching",
    longDescription:
      "Generates a structured teaching plan for your problem. Each step appears as ghost text at your cursor — press Tab to accept and move forward. Your next step only appears after you write code for the previous one.",
    icon: Leaf,
  },
  {
    id: "FOCUS",
    tagline: "Logic-first mentoring",
    longDescription:
      "For students who know syntax but get stuck on logic. Click Hint to get a targeted hint at your chosen depth — it adapts to your current code and any errors you have.",
    icon: Crosshair,
  },
  {
    id: "SHADOW",
    tagline: "Minimal intervention",
    longDescription:
      "Silent until you ask. Each Help click reveals exactly one brief nudge, then steps back. Hint depth escalates across clicks. Ideal for exam practice or competitive programming.",
    icon: Zap,
  },
];

export function CodeWorkspace() {
  const [language, setLanguage] = useState<Language>("cpp");
  const [code, setCode] = useState<string>(templates.cpp);
  const [stdin, setStdin] = useState("");
  const [running, setRunning] = useState(false);
  const [problemTitle, setProblemTitle] = useState("");
  const [problemDescription, setProblemDescription] = useState("");
  const [constraints, setConstraints] = useState("");
  const [inputOutputFormat, setInputOutputFormat] = useState("");
  const [examples, setExamples] = useState("");

  const [mode, setMode] = useState<Mode>("FOCUS");
  const [codeDisclosure, setCodeDisclosure] = useState<CodeDisclosure>("no_code");
  const [hintDelivery, setHintDelivery] = useState<HintDelivery>("on_demand");
  const [hintSpecificity, setHintSpecificity] = useState(3);
  const [shadowHelpClick, setShadowHelpClick] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [currentHint, setCurrentHint] = useState("");
  const [guidanceExpanded, setGuidanceExpanded] = useState(false);
  const [parsingProblemFile, setParsingProblemFile] = useState(false);
  const [fileParseNotice, setFileParseNotice] = useState<string | null>(null);

  const [execution, setExecution] = useState<ExecutionState>({
    output: "",
    stdout: "",
    stderr: "",
    compileOutput: "",
    exitCode: 0,
    error: "",
  });

  const [seedSteps, setSeedSteps] = useState<string[]>([]);
  const [seedFrontier, setSeedFrontier] = useState(1);
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [problemFingerprint, setProblemFingerprint] = useState<string | null>(null);
  const [waitingForCode, setWaitingForCode] = useState(false);

  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [generatingTestCases, setGeneratingTestCases] = useState(false);
  const [testCaseError, setTestCaseError] = useState<string | null>(null);
  const [submitSummary, setSubmitSummary] = useState<SubmitSummary | null>(null);
  const [consoleTab, setConsoleTab] = useState<"console" | "results">("console");

  const editorRef = useRef<import("monaco-editor").editor.IStandaloneCodeEditor | null>(null);
  const seedInlineDisposeRef = useRef<{ dispose: () => void } | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bootstrapGenRef = useRef(0);
  const seedStepsRef = useRef<string[]>([]);
  const modeRef = useRef<Mode>(mode);
  const hintDeliveryRef = useRef(hintDelivery);
  const seedBundleRef = useRef({ language, steps: [] as string[], frontier: 1 });
  const handleSeedAcceptRef = useRef<() => void>(() => {});
  const armIdleRef = useRef<() => void>(() => {});
  const fingerprintRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const requiresUserInputRef = useRef(false);
  const codeAtAcceptNonwsRef = useRef(0);

  const hasProblemText = useMemo(
    () =>
      Boolean(
        problemDescription.trim() || constraints.trim() || inputOutputFormat.trim() || examples.trim()
      ),
    [problemDescription, constraints, inputOutputFormat, examples]
  );

  const currentCard = MODE_CARDS.find((c) => c.id === mode) ?? MODE_CARDS[1];

  const depthLabel = useMemo(() => {
    return (["", "Vague nudge", "Concept name", "Explanation", "Pseudocode", "Code snippet"] as const)[
      hintSpecificity
    ] ?? "Balanced";
  }, [hintSpecificity]);

  // ── Ref sync ──
  useEffect(() => { seedStepsRef.current = seedSteps; }, [seedSteps]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { hintDeliveryRef.current = hintDelivery; }, [hintDelivery]);
  useEffect(() => { fingerprintRef.current = problemFingerprint; }, [problemFingerprint]);
  useEffect(() => {
    seedBundleRef.current = { language, steps: seedSteps, frontier: seedFrontier };
  }, [language, seedSteps, seedFrontier]);

  function setRequiresInput(val: boolean) {
    requiresUserInputRef.current = val;
    setWaitingForCode(val);
  }

  // ── Persistence ──
  const persistFrontier = useCallback(
    async (next: number) => {
      const fp = fingerprintRef.current;
      if (!fp) return;
      try {
        await fetch("/api/guidance/seed/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            problemFingerprint: fp,
            language,
            settingsKey: composeSeedSettingsKey(codeDisclosure, hintSpecificity),
            frontierStep: next,
          }),
        });
      } catch {
        // offline / transient — local progression still applies
      }
    },
    [language, codeDisclosure, hintSpecificity]
  );

  // ── Timers ──
  const armIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (modeRef.current !== "SEED" || hintDeliveryRef.current !== "automatic") return;
    if (!seedStepsRef.current.length) return;

    idleTimerRef.current = setTimeout(() => {
      idleTimerRef.current = null;
      if (modeRef.current !== "SEED" || hintDeliveryRef.current !== "automatic") return;
      // Clear waiting flag on long idle so hint appears even without coding
      requiresUserInputRef.current = false;
      setWaitingForCode(false);
      const ed = editorRef.current;
      if (ed) triggerInlineSuggest(ed);
    }, SEED_IDLE_MS);
  }, []);

  const armTypingPauseHint = useCallback(() => {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    if (modeRef.current !== "SEED" || hintDeliveryRef.current !== "automatic") return;
    if (!seedStepsRef.current.length) return;

    typingTimerRef.current = setTimeout(() => {
      typingTimerRef.current = null;
      if (modeRef.current !== "SEED" || hintDeliveryRef.current !== "automatic") return;
      if (requiresUserInputRef.current) return; // still waiting — don't show yet
      const ed = editorRef.current;
      if (ed) triggerInlineSuggest(ed);
    }, SEED_PAUSE_MS);
  }, []);

  useEffect(() => { armIdleRef.current = armIdleTimer; }, [armIdleTimer]);

  useEffect(() => {
    armIdleTimer();
    return () => {
      if (idleTimerRef.current) { clearTimeout(idleTimerRef.current); idleTimerRef.current = null; }
      if (typingTimerRef.current) { clearTimeout(typingTimerRef.current); typingTimerRef.current = null; }
    };
  }, [
    armIdleTimer, code, problemTitle, problemDescription,
    constraints, inputOutputFormat, examples,
    hintDelivery, mode, seedSteps.length,
  ]);

  // ── Mode change cleanup ──
  useEffect(() => {
    if (mode !== "SEED") {
      setSeedSteps([]);
      setSeedFrontier(1);
      setProblemFingerprint(null);
      setSeedError(null);
      setSeedLoading(false);
      setRequiresInput(false);
    }
  }, [mode]);

  // ── SEED bootstrap ──
  useEffect(() => {
    if (mode !== "SEED" || !hasProblemText) {
      if (mode === "SEED" && !hasProblemText) {
        setSeedLoading(false);
        setSeedError(null);
        setSeedSteps([]);
        setProblemFingerprint(null);
        setRequiresInput(false);
      }
      return;
    }

    const gen = ++bootstrapGenRef.current;
    setSeedLoading(true);
    setSeedError(null);

    const debounce = setTimeout(() => {
      void (async () => {
        try {
          const fpLocal = await fingerprintProblemClient({
            title: problemTitle,
            description: problemDescription,
            constraints,
            inputOutputFormat,
            examples,
          });

          const res = await fetch("/api/guidance/seed/bootstrap", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              problemTitle,
              problemDescription,
              constraints,
              inputOutputFormat,
              examples,
              language,
              codeDisclosure,
              hintSpecificity,
            }),
          });

          const data = (await res.json()) as {
            error?: string;
            steps?: string[];
            frontierStep?: number;
          };

          if (gen !== bootstrapGenRef.current) return;

          if (!res.ok) {
            setSeedError(data.error ?? "Could not prepare guided steps.");
            setSeedSteps([]);
            return;
          }

          const steps = Array.isArray(data.steps)
            ? data.steps.filter((s) => typeof s === "string" && s.trim())
            : [];
          if (steps.length === 0) {
            setSeedError("Guidance could not be loaded.");
            setSeedSteps([]);
            return;
          }

          setProblemFingerprint(fpLocal);
          setSeedSteps(steps);
          setSeedFrontier(1);
          setSeedError(null);
          setCurrentHint("");
          setRequiresInput(false);
        } catch {
          if (gen === bootstrapGenRef.current) {
            setSeedError("Could not prepare guided steps.");
            setSeedSteps([]);
          }
        } finally {
          if (gen === bootstrapGenRef.current) setSeedLoading(false);
        }
      })();
    }, 750);

    return () => clearTimeout(debounce);
  }, [
    mode, hasProblemText, problemTitle, problemDescription,
    constraints, inputOutputFormat, examples,
    language, codeDisclosure, hintSpecificity,
  ]);

  useEffect(
    () => () => {
      seedInlineDisposeRef.current?.dispose();
      seedInlineDisposeRef.current = null;
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    },
    []
  );

  // ── Problem file parse ──
  async function parseProblemText(rawText: string): Promise<ParsedProblemPayload> {
    const response = await fetch("/api/guidance/problem/parse-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: rawText }),
    });
    const payload = (await response.json()) as Partial<ParsedProblemPayload> & { error?: string };
    if (!response.ok) throw new Error(payload.error || "Could not parse file.");
    return {
      title: payload.title?.trim() || "",
      description: payload.description?.trim() || "",
      constraints: payload.constraints?.trim() || "",
      inputOutputFormat: payload.inputOutputFormat?.trim() || "",
      examples: payload.examples?.trim() || "",
    };
  }

  async function handleProblemTextUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setParsingProblemFile(true);
      setFileParseNotice(null);
      if (file.size > MAX_PROBLEM_TEXT_FILE_BYTES) throw new Error("File too large. Use a smaller plain-text statement.");
      const rawText = await file.text();
      const parsed = await parseProblemText(rawText);
      setProblemTitle(parsed.title);
      setProblemDescription(parsed.description);
      setConstraints(parsed.constraints);
      setInputOutputFormat(parsed.inputOutputFormat);
      setExamples(parsed.examples);
      setFileParseNotice("Problem fields filled from file — review and adjust as needed.");
    } catch (error) {
      setFileParseNotice(error instanceof Error ? error.message : "Could not parse this file.");
    } finally {
      event.target.value = "";
      setParsingProblemFile(false);
    }
  }

  // ── SEED step accept (Copilot-like: require code before next step) ──
  const handleSeedAccept = useCallback(() => {
    setSeedFrontier((f) => {
      const max = seedStepsRef.current.length;
      const next = Math.min(f + 1, max + 1);
      if (next !== f && next <= max) {
        void persistFrontier(next);
        setHintsUsed((h) => h + 1);
        requiresUserInputRef.current = true;
        setWaitingForCode(true);
        const currentCode = editorRef.current?.getValue() ?? "";
        codeAtAcceptNonwsRef.current = currentCode.replace(/\s/g, "").length;
      }
      return next;
    });
  }, [persistFrontier]);

  useEffect(() => { handleSeedAcceptRef.current = handleSeedAccept; }, [handleSeedAccept]);

  // ── Editor mount ──
  const handleEditorMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      seedInlineDisposeRef.current?.dispose();
      seedInlineDisposeRef.current = registerSeedInlineHintProvider(
        monaco,
        editor,
        () => {
          if (modeRef.current !== "SEED") return null;
          if (requiresUserInputRef.current) return null; // waiting for user to write code
          const b = seedBundleRef.current;
          if (b.frontier > b.steps.length) return null;
          const idx = b.frontier - 1;
          const body = b.steps[idx];
          if (!body) return null;
          return formatSeedHintComment(b.language, b.frontier, body);
        },
        () => handleSeedAcceptRef.current()
      );

      editor.onDidChangeModelContent(() => {
        if (requiresUserInputRef.current) {
          const nonws = editor.getValue().replace(/\s/g, "").length;
          const delta = nonws - codeAtAcceptNonwsRef.current;
          if (delta >= MIN_NONWS_CHARS_AFTER_ACCEPT) {
            requiresUserInputRef.current = false;
            setWaitingForCode(false);
            armTypingPauseHint();
          }
          armIdleRef.current();
          return;
        }
        armTypingPauseHint();
        armIdleRef.current();
      });

      editor.onDidChangeCursorPosition(() => {
        if (
          modeRef.current === "SEED" &&
          hintDeliveryRef.current === "automatic" &&
          !requiresUserInputRef.current
        ) {
          armTypingPauseHint();
        }
      });
    },
    [armTypingPauseHint]
  );

  function switchLanguage(next: Language) {
    setLanguage(next);
    setCode(templates[next]);
  }

  // ── Gemini hint request ──
  async function requestGeminiHint(forAutomatic = false) {
    const clampedSeedStep =
      mode === "SEED"
        ? seedSteps.length > 0
          ? Math.min(Math.max(seedFrontier, 1), seedSteps.length)
          : 1
        : 1;

    const body = {
      mode,
      language,
      depth: hintSpecificity,
      problem: [problemTitle, problemDescription, constraints, inputOutputFormat, examples]
        .filter(Boolean)
        .join("\n\n"),
      hasCode: code.trim().length > 0 && code.trim() !== templates[language].trim(),
      userCode: code,
      userError: [execution.error, execution.stderr, execution.compileOutput].filter(Boolean).join("\n"),
      step: clampedSeedStep,
      totalSteps: mode === "SEED" ? Math.max(seedSteps.length, 1) : 1,
      helpClickNumber: mode === "SHADOW" ? shadowHelpClick + 1 : 1,
    };

    const response = await fetch("/api/guidance/hint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json()) as { hint?: string; error?: string };
    if (!response.ok || !data.hint) {
      if (!forAutomatic) setCurrentHint(data.error ?? "Could not generate hint.");
      return;
    }
    setCurrentHint(data.hint);
    setHintsUsed((v) => v + 1);
    if (mode === "SHADOW") setShadowHelpClick((v) => Math.min(v + 1, 5));
  }

  // ── Code execution ──
  async function execute(type: "run" | "submit") {
    setRunning(true);
    setExecution({ output: "", stdout: "", stderr: "", compileOutput: "", exitCode: 0, error: "" });
    try {
      const response = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, code, stdin }),
      });
      const data = await response.json();
      if (!response.ok) {
        setExecution((prev) => ({ ...prev, error: data.error || "Execution failed." }));
        return;
      }
      setExecution({
        output: data.output ?? "",
        stdout: data.stdout ?? "",
        stderr: data.stderr ?? "",
        compileOutput: data.compileOutput ?? "",
        exitCode: data.exitCode ?? 0,
        error: "",
      });
      if (
        mode === "SEED" &&
        seedStepsRef.current.length > 0 &&
        hintDelivery === "automatic" &&
        !requiresUserInputRef.current
      ) {
        queueMicrotask(() => {
          const ed = editorRef.current;
          if (ed) triggerInlineSuggest(ed);
        });
      }
      if (
        type === "submit" &&
        hintDelivery === "automatic" &&
        mode !== "SHADOW" &&
        mode !== "SEED" &&
        hasProblemText
      ) {
        await requestGeminiHint(true);
      }
    } catch {
      setExecution((prev) => ({ ...prev, error: "Unexpected error while running code." }));
    } finally {
      setRunning(false);
    }
  }

  // ── Test cases ──
  function addTestCase() {
    setTestCases((prev) => [...prev, { id: crypto.randomUUID(), input: "", expectedOutput: "" }]);
  }

  function removeTestCase(id: string) {
    setTestCases((prev) => prev.filter((tc) => tc.id !== id));
  }

  function updateTestCase(id: string, field: "input" | "expectedOutput", value: string) {
    setTestCases((prev) => prev.map((tc) => (tc.id === id ? { ...tc, [field]: value } : tc)));
  }

  async function generateTestCases() {
    if (!hasProblemText) return;
    setGeneratingTestCases(true);
    setTestCaseError(null);
    try {
      const res = await fetch("/api/guidance/problem/generate-test-cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language,
          problemTitle,
          problemDescription,
          constraints,
          inputOutputFormat,
          examples,
        }),
      });
      const data = (await res.json()) as { testCases?: { input: string; expectedOutput: string }[]; error?: string };
      if (!res.ok) {
        setTestCaseError(data.error ?? "Could not generate test cases.");
        return;
      }
      if (Array.isArray(data.testCases)) {
        setTestCases(
          data.testCases.map((tc) => ({ id: crypto.randomUUID(), input: tc.input, expectedOutput: tc.expectedOutput }))
        );
      }
    } catch {
      setTestCaseError("Could not generate test cases.");
    } finally {
      setGeneratingTestCases(false);
    }
  }

  async function recordAttempt(isCorrect: boolean) {
    const fp = fingerprintRef.current;
    if (!fp) return;
    try {
      await fetch("/api/attempts/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemFingerprint: fp, problemTitle, problemDescription, isCorrect, hintsUsed }),
      });
    } catch {
      // fire-and-forget
    }
  }

  async function handleSubmit() {
    const validCases = testCases.filter((tc) => tc.expectedOutput.trim() !== "");
    if (validCases.length === 0) {
      await execute("submit");
      return;
    }
    setRunning(true);
    setSubmitSummary(null);
    try {
      const res = await fetch("/api/execute/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language,
          code,
          testCases: validCases.map((tc) => ({ input: tc.input, expectedOutput: tc.expectedOutput })),
        }),
      });
      const data = (await res.json()) as SubmitSummary & { error?: string };
      if (!res.ok) {
        setExecution((prev) => ({ ...prev, error: data.error ?? "Submit failed." }));
        setConsoleTab("console");
        return;
      }
      setSubmitSummary(data);
      setConsoleTab("results");
      void recordAttempt(data.passed === data.total);
    } catch {
      setExecution((prev) => ({ ...prev, error: "Unexpected error during submit." }));
      setConsoleTab("console");
    } finally {
      setRunning(false);
    }
  }

  // ── Hint button ──
  function requestHint() {
    if (mode === "SEED") {
      if (!seedSteps.length) {
        setCurrentHint(
          seedLoading
            ? "Getting your guided sequence ready…"
            : (seedError ?? "Add problem details on the left to enable guidance.")
        );
        return;
      }
      if (seedFrontier > seedSteps.length) {
        setCurrentHint("All guided steps complete. Great work!");
        return;
      }
      // Explicit click overrides the waiting-for-code gate
      setRequiresInput(false);
      const ed = editorRef.current;
      if (ed) triggerInlineSuggest(ed);
      setHintsUsed((v) => v + 1);
      return;
    }
    void requestGeminiHint(false);
  }

  // ─────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────
  return (
    <div className="flex flex-1 flex-col overflow-hidden">

      {/* ── Guidance bar ── */}
      <div className="shrink-0 border-b border-border bg-card px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode toggle */}
          <div className="inline-flex items-center gap-px rounded-lg border border-border bg-background p-1">
            {MODE_CARDS.map((card) => {
              const Icon = card.icon;
              const selected = mode === card.id;
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => { setMode(card.id); setShadowHelpClick(0); setCurrentHint(""); }}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all",
                    selected
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <Icon className="size-3.5" />
                  {card.id}
                </button>
              );
            })}
          </div>

          {/* Status chips */}
          {mode === "SEED" && (
            <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground">
              {seedLoading
                ? "Preparing…"
                : seedSteps.length
                ? `Step ${Math.min(seedFrontier, seedSteps.length)} / ${seedSteps.length}`
                : "Add problem →"}
            </span>
          )}
          {mode === "SHADOW" && (
            <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground">
              Nudges: {shadowHelpClick} / 5
            </span>
          )}
          <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground">
            {hintsUsed} hint{hintsUsed !== 1 ? "s" : ""} used
          </span>

          <button
            type="button"
            onClick={() => setGuidanceExpanded((v) => !v)}
            className="ml-auto flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Settings className="size-3.5" />
            Settings
            <ChevronDown className={cn("size-3 transition-transform", guidanceExpanded && "rotate-180")} />
          </button>
        </div>

        {/* Mode description */}
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{currentCard.longDescription}</p>

        {/* Settings panel */}
        {guidanceExpanded && (
          <div className="mt-3 grid gap-4 border-t border-border pt-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs">
                <Eye className="size-3.5 text-primary" />
                Code in hints
              </Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs text-foreground"
                value={codeDisclosure}
                onChange={(e) => setCodeDisclosure(e.target.value as CodeDisclosure)}
              >
                <option value="no_code">Text only — no code shown</option>
                <option value="allow_minimal_code">Allow small code snippets</option>
              </select>
              <p className="text-[10px] text-muted-foreground">
                Controls whether hints may include partial {language === "cpp" ? "C++" : "Python"} fragments.
                Keeping code off makes you work through syntax independently.
              </p>
            </div>

            {mode === "SEED" && (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs">
                  <MessageSquare className="size-3.5 text-primary" />
                  Hint delivery
                </Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs text-foreground"
                  value={hintDelivery}
                  onChange={(e) => setHintDelivery(e.target.value as HintDelivery)}
                >
                  <option value="on_demand">On demand — click Show Step</option>
                  <option value="automatic">Automatic — appear while coding</option>
                </select>
                <p className="text-[10px] text-muted-foreground">
                  Automatic shows ghost text after a short typing pause. Press Tab to accept a step and advance.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs">
                <Target className="size-3.5 text-primary" />
                Hint depth: {hintSpecificity} — {depthLabel}
              </Label>
              <input
                type="range"
                min={1}
                max={5}
                value={hintSpecificity}
                onChange={(e) => setHintSpecificity(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>1 Conceptual</span>
                <span>3 Balanced</span>
                <span>5 Direct code</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Three-panel workspace ── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">

        {/* ── LEFT: Problem panel ── */}
        <div className="flex w-[272px] shrink-0 flex-col overflow-hidden border-r border-border">
          <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
            <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Problem
            </h2>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 px-2 text-[11px]"
              onClick={() => fileInputRef.current?.click()}
              disabled={parsingProblemFile}
            >
              {parsingProblemFile ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Upload className="size-3" />
              )}
              Import .txt
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,text/plain"
              className="hidden"
              onChange={handleProblemTextUpload}
            />
          </div>

          <div className="flex-1 space-y-3.5 overflow-y-auto p-3">
            {fileParseNotice && (
              <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <span>{fileParseNotice}</span>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-[11px]" htmlFor="problem-title">
                Title
              </Label>
              <Input
                id="problem-title"
                className="h-8 text-sm"
                value={problemTitle}
                onChange={(e) => setProblemTitle(e.target.value)}
                placeholder="e.g. Two Sum"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px]" htmlFor="problem-description">
                Description
              </Label>
              <textarea
                id="problem-description"
                className="min-h-[110px] w-full resize-y rounded-md border border-input bg-transparent p-2.5 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring"
                value={problemDescription}
                onChange={(e) => setProblemDescription(e.target.value)}
                placeholder="Describe the problem clearly…"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px]" htmlFor="problem-constraints">
                Constraints
              </Label>
              <textarea
                id="problem-constraints"
                className="min-h-[56px] w-full resize-y rounded-md border border-input bg-transparent p-2.5 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring"
                value={constraints}
                onChange={(e) => setConstraints(e.target.value)}
                placeholder="1 ≤ n ≤ 10⁵…"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px]" htmlFor="problem-io">
                Input / Output format
              </Label>
              <textarea
                id="problem-io"
                className="min-h-[56px] w-full resize-y rounded-md border border-input bg-transparent p-2.5 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring"
                value={inputOutputFormat}
                onChange={(e) => setInputOutputFormat(e.target.value)}
                placeholder={"Input: …\nOutput: …"}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px]" htmlFor="problem-examples">
                Examples
              </Label>
              <textarea
                id="problem-examples"
                className="min-h-[90px] w-full resize-y rounded-md border border-input bg-transparent p-2.5 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring"
                value={examples}
                onChange={(e) => setExamples(e.target.value)}
                placeholder={"Input: 5\nOutput: 5\nExplanation: …"}
              />
            </div>

            {/* ── Test Cases ── */}
            <div className="space-y-2 border-t border-border pt-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5 text-[11px]">
                  <FlaskConical className="size-3.5 text-primary" />
                  Test Cases
                  {testCases.length > 0 && (
                    <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                      {testCases.length}
                    </span>
                  )}
                </Label>
                <div className="flex items-center gap-1">
                  {hasProblemText && (
                    <button
                      type="button"
                      onClick={() => void generateTestCases()}
                      disabled={generatingTestCases}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                    >
                      {generatingTestCases ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Sparkles className="size-3" />
                      )}
                      Auto
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={addTestCase}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <Plus className="size-3" />
                    Add
                  </button>
                </div>
              </div>

              {testCaseError && (
                <p className="text-[11px] text-destructive">{testCaseError}</p>
              )}

              {testCases.length === 0 && !generatingTestCases && (
                <p className="text-[11px] text-muted-foreground">
                  {hasProblemText
                    ? "Click Auto to generate from problem, or Add to create manually."
                    : "Fill in the problem description to enable auto-generation."}
                </p>
              )}

              {testCases.map((tc, i) => (
                <div
                  key={tc.id}
                  className="rounded-md border border-border bg-muted/20 p-2 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      Case {i + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeTestCase(tc.id)}
                      className="text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground">Input (stdin)</span>
                    <textarea
                      className="mt-0.5 min-h-[32px] w-full resize-y rounded border border-input bg-transparent px-2 py-1 font-mono text-[11px] leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring"
                      value={tc.input}
                      onChange={(e) => updateTestCase(tc.id, "input", e.target.value)}
                      placeholder="(empty stdin)"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground">Expected output</span>
                    <textarea
                      className="mt-0.5 min-h-[28px] w-full resize-y rounded border border-input bg-transparent px-2 py-1 font-mono text-[11px] leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring"
                      value={tc.expectedOutput}
                      onChange={(e) => updateTestCase(tc.id, "expectedOutput", e.target.value)}
                      placeholder="expected stdout…"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── CENTER: Editor panel ── */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2">
            <div className="inline-flex items-center gap-px rounded-lg border border-border bg-background p-0.5">
              <Button
                variant={language === "cpp" ? "default" : "ghost"}
                size="sm"
                className="h-7 px-3 text-xs"
                onClick={() => switchLanguage("cpp")}
              >
                C++
              </Button>
              <Button
                variant={language === "python" ? "default" : "ghost"}
                size="sm"
                className="h-7 px-3 text-xs"
                onClick={() => switchLanguage("python")}
              >
                Python
              </Button>
            </div>

            {mode === "SEED" && seedLoading && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                Preparing guide…
              </span>
            )}
            {mode === "SEED" && waitingForCode && seedSteps.length > 0 && (
              <span className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-primary">
                <Keyboard className="size-3" />
                Code step {Math.max(seedFrontier - 1, 1)}, then step {Math.min(seedFrontier, seedSteps.length)} appears
              </span>
            )}

            <div className="ml-auto flex items-center gap-1.5">
              <Button
                variant="outline"
                className="h-8 gap-1.5 px-3 text-xs"
                onClick={requestHint}
                disabled={mode === "SEED" && seedLoading}
              >
                <Sparkles className="size-3.5" />
                {mode === "SEED" ? "Show Step" : mode === "SHADOW" ? `Nudge ${shadowHelpClick + 1}` : "Hint"}
              </Button>
              <Button
                variant="outline"
                className="h-8 gap-1.5 px-3 text-xs"
                onClick={() => execute("run")}
                disabled={running}
              >
                {running ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                Run
              </Button>
              <Button
                className="h-8 px-4 text-xs"
                onClick={handleSubmit}
                disabled={running}
              >
                {running ? "Running…" : "Submit"}
              </Button>
            </div>
          </div>

          {seedError && mode === "SEED" && (
            <div className="shrink-0 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">
              {seedError}
            </div>
          )}

          {/* Monaco — fills all remaining vertical space */}
          <div className="min-h-0 flex-1">
            <Editor
              height="100%"
              language={language === "cpp" ? "cpp" : "python"}
              value={code}
              onChange={(value) => setCode(value ?? "")}
              onMount={handleEditorMount}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                tabSize: 2,
                automaticLayout: true,
                inlineSuggest: { enabled: true },
                scrollBeyondLastLine: false,
                padding: { top: 12, bottom: 12 },
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                fontLigatures: true,
                lineNumbers: "on",
                renderLineHighlight: "line",
                cursorBlinking: "smooth",
              }}
            />
          </div>

          {/* Stdin */}
          <div className="shrink-0 border-t border-border px-3 py-2.5">
            <Label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              stdin
            </Label>
            <textarea
              className="h-[64px] w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={stdin}
              onChange={(e) => setStdin(e.target.value)}
              placeholder="Standard input for your program…"
            />
          </div>
        </div>

        {/* ── RIGHT: Console panel ── */}
        <div className="flex w-[300px] shrink-0 flex-col overflow-hidden border-l border-border">
          {/* Tab header */}
          <div className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-1.5">
            <button
              type="button"
              onClick={() => setConsoleTab("console")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                consoleTab === "console"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <TerminalSquare className="size-3" />
              Console
            </button>
            <button
              type="button"
              onClick={() => setConsoleTab("results")}
              disabled={!submitSummary}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-40",
                consoleTab === "results"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <FlaskConical className="size-3" />
              Results
              {submitSummary && (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[10px] font-semibold",
                    submitSummary.passed === submitSummary.total
                      ? "bg-green-500/15 text-green-500"
                      : "bg-destructive/15 text-destructive"
                  )}
                >
                  {submitSummary.passed}/{submitSummary.total}
                </span>
              )}
            </button>

            {consoleTab === "console" && (
              <span
                className={cn(
                  "ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium",
                  execution.exitCode === 0 && (execution.stdout || execution.output)
                    ? "bg-green-500/15 text-green-500"
                    : execution.exitCode !== 0
                    ? "bg-destructive/15 text-destructive"
                    : "bg-muted text-muted-foreground"
                )}
              >
                Exit {execution.exitCode}
              </span>
            )}
          </div>

          {/* Console tab content */}
          {consoleTab === "console" && (
            <div className="flex-1 space-y-3 overflow-y-auto p-3">
              {execution.error && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
                  {execution.error}
                </div>
              )}

              <ConsoleBlock label="Compile" content={execution.compileOutput} empty="No compile output" />
              <ConsoleBlock
                label="Output"
                content={execution.stdout || execution.output}
                empty="No output yet"
                minHeight="min-h-[64px]"
              />
              <ConsoleBlock label="Errors" content={execution.stderr} empty="No runtime errors" />

              {/* SEED progress tracker */}
              {mode === "SEED" && seedSteps.length > 0 && (
                <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                      <FileText className="size-3.5" />
                      Guided steps
                    </p>
                    <span className="text-[11px] text-muted-foreground">
                      {Math.min(seedFrontier - 1, seedSteps.length)} / {seedSteps.length} done
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-1.5 rounded-full bg-primary transition-all duration-500"
                      style={{
                        width: `${(Math.min(seedFrontier - 1, seedSteps.length) / seedSteps.length) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                    {waitingForCode
                      ? "✏ Write code for the accepted step — your next step will then appear."
                      : seedFrontier > seedSteps.length
                      ? "✓ All steps complete."
                      : `Step ${Math.min(seedFrontier, seedSteps.length)} ready — look for the ghost text at your cursor.`}
                  </p>
                </div>
              )}

              {/* Current hint */}
              {currentHint && (
                <div className="rounded-md border border-primary/30 bg-primary/10 p-3">
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <Sparkles className="size-3" />
                    {mode === "SEED" ? "Step Note" : mode === "SHADOW" ? "Nudge" : "Hint"}
                  </p>
                  <p className="text-sm leading-relaxed text-foreground">{currentHint}</p>
                </div>
              )}
            </div>
          )}

          {/* Results tab content */}
          {consoleTab === "results" && submitSummary && (
            <div className="flex-1 space-y-2.5 overflow-y-auto p-3">
              {/* Summary card */}
              <div className="rounded-md border border-border bg-card p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">
                    {submitSummary.passed} / {submitSummary.total} passed
                  </span>
                  <span
                    className={cn(
                      "text-xs font-medium",
                      submitSummary.passed === submitSummary.total
                        ? "text-green-500"
                        : "text-destructive"
                    )}
                  >
                    {submitSummary.passed === submitSummary.total
                      ? "All tests passed"
                      : `${submitSummary.total - submitSummary.passed} failed`}
                  </span>
                </div>
                <div className="mt-2 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
                  {submitSummary.results.map((r) => (
                    <div
                      key={r.index}
                      className={cn(
                        "flex-1 rounded-full",
                        r.passed ? "bg-green-500" : "bg-destructive"
                      )}
                    />
                  ))}
                </div>
              </div>

              {/* Per-test results */}
              {submitSummary.results.map((r) => (
                <div
                  key={r.index}
                  className={cn(
                    "rounded-md border p-2.5 text-xs",
                    r.passed
                      ? "border-green-500/20 bg-green-500/5"
                      : "border-destructive/20 bg-destructive/5"
                  )}
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    {r.passed ? (
                      <CheckCircle2 className="size-3.5 text-green-500" />
                    ) : (
                      <XCircle className="size-3.5 text-destructive" />
                    )}
                    <span className="font-semibold">Test {r.index + 1}</span>
                    <span
                      className={cn(
                        "ml-auto text-[10px] font-bold tracking-wide",
                        r.passed ? "text-green-500" : "text-destructive"
                      )}
                    >
                      {r.passed ? "PASS" : "FAIL"}
                    </span>
                  </div>
                  {!r.passed && (
                    <div className="space-y-1 font-mono text-[11px]">
                      {r.input && (
                        <div>
                          <span className="text-muted-foreground">Input: </span>
                          <span className="break-all">{r.input}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground">Expected: </span>
                        <span className="text-green-600 dark:text-green-400">{r.expectedOutput || "(empty)"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Got: </span>
                        <span className="text-destructive">{r.actualOutput || "(empty)"}</span>
                      </div>
                      {(r.compileError || r.stderr) && (
                        <div>
                          <span className="text-muted-foreground">Error: </span>
                          <span className="text-destructive/80">{r.compileError || r.stderr}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ConsoleBlock({
  label,
  content,
  empty,
  minHeight = "min-h-[44px]",
}: {
  label: string;
  content: string;
  empty: string;
  minHeight?: string;
}) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {label}
        <span className="h-px flex-1 bg-border" />
      </p>
      <pre
        className={cn(
          "rounded-md border border-border bg-black/20 p-2.5 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap break-all text-foreground",
          minHeight
        )}
      >
        {content || <span className="italic text-muted-foreground">{empty}</span>}
      </pre>
    </div>
  );
}
