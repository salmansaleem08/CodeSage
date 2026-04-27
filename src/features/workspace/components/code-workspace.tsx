"use client";

import Editor from "@monaco-editor/react";
import type { OnMount } from "@monaco-editor/react";
import {
  ChevronDown,
  Crosshair,
  Eye,
  FileText,
  Leaf,
  Loader2,
  MessageSquare,
  Play,
  Sparkles,
  Target,
  TerminalSquare,
  Upload,
  Zap
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
  cout << "Hello from C++" << endl;
  return 0;
}
`,
  python: `print("Hello from Python")
`
};

function getModeHint({
  mode,
  problemDescription,
  seedStep,
  hintSpecificity
}: {
  mode: Mode;
  problemDescription: string;
  seedStep: number;
  hintSpecificity: number;
}) {
  const text = problemDescription.trim();
  if (!text) return "Add a problem statement to receive mode-based guidance.";

  if (mode === "SHADOW") {
    const nudges = [
      "Are you checking every character you need to check?",
      "What exactly defines a match in this problem?",
      "Is your loop range correct for the problem’s bounds?"
    ];
    return nudges[(seedStep - 1) % nudges.length];
  }

  if (mode === "FOCUS") {
    if (hintSpecificity <= 2) return "Identify the core transformation between input and desired output.";
    if (hintSpecificity <= 4) return "Write the algorithm in 3 steps before coding; verify time complexity.";
    return "Focus on edge cases: empty input, boundaries, and repeated values.";
  }

  return "";
}

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
  const [seedStep, setSeedStep] = useState(1);
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
    error: ""
  });

  const [seedSteps, setSeedSteps] = useState<string[]>([]);
  const [seedFrontier, setSeedFrontier] = useState(1);
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [problemFingerprint, setProblemFingerprint] = useState<string | null>(null);

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

  const hasProblemText = useMemo(
    () => Boolean(problemDescription.trim() || constraints.trim() || inputOutputFormat.trim() || examples.trim()),
    [problemDescription, constraints, inputOutputFormat, examples]
  );

  const settingsSummary = useMemo(() => {
    if (mode === "SEED") return "Step-by-step teaching";
    if (mode === "FOCUS") return "Logic mentoring";
    return "Minimal intervention";
  }, [mode]);

  useEffect(() => {
    seedStepsRef.current = seedSteps;
  }, [seedSteps]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    hintDeliveryRef.current = hintDelivery;
  }, [hintDelivery]);

  useEffect(() => {
    fingerprintRef.current = problemFingerprint;
  }, [problemFingerprint]);

  useEffect(() => {
    seedBundleRef.current = { language, steps: seedSteps, frontier: seedFrontier };
  }, [language, seedSteps, seedFrontier]);

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
            frontierStep: next
          })
        });
      } catch {
        // offline / transient — local progression still applies
      }
    },
    [language, codeDisclosure, hintSpecificity]
  );

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
      const ed = editorRef.current;
      if (ed) {
        triggerInlineSuggest(ed);
      }
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
      const ed = editorRef.current;
      if (ed) {
        triggerInlineSuggest(ed);
      }
    }, SEED_PAUSE_MS);
  }, []);

  useEffect(() => {
    armIdleRef.current = armIdleTimer;
  }, [armIdleTimer]);

  useEffect(() => {
    armIdleTimer();
    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
    };
  }, [
    armIdleTimer,
    code,
    problemTitle,
    problemDescription,
    constraints,
    inputOutputFormat,
    examples,
    hintDelivery,
    mode,
    seedSteps.length
  ]);

  useEffect(() => {
    if (mode !== "SEED") {
      setSeedSteps([]);
      setSeedFrontier(1);
      setProblemFingerprint(null);
      setSeedError(null);
      setSeedLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== "SEED" || !hasProblemText) {
      if (mode === "SEED" && !hasProblemText) {
        setSeedLoading(false);
        setSeedError(null);
        setSeedSteps([]);
        setProblemFingerprint(null);
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
            examples
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
              hintSpecificity
            })
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

          const steps = Array.isArray(data.steps) ? data.steps.filter((s) => typeof s === "string" && s.trim()) : [];
          if (steps.length === 0) {
            setSeedError("Guidance could not be loaded.");
            setSeedSteps([]);
            return;
          }

          setProblemFingerprint(fpLocal);
          setSeedSteps(steps);
          const max = steps.length;
          const fs = typeof data.frontierStep === "number" ? data.frontierStep : 1;
          setSeedFrontier(Math.min(Math.max(fs, 1), max));
          setSeedError(null);
          setCurrentHint("");
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
    mode,
    hasProblemText,
    problemTitle,
    problemDescription,
    constraints,
    inputOutputFormat,
    examples,
    language,
    codeDisclosure,
    hintSpecificity
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

  async function parseProblemText(rawText: string): Promise<ParsedProblemPayload> {
    const response = await fetch("/api/guidance/problem/parse-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: rawText })
    });
    const payload = (await response.json()) as Partial<ParsedProblemPayload> & { error?: string };
    if (!response.ok) {
      throw new Error(payload.error || "Could not parse file.");
    }
    return {
      title: payload.title?.trim() || "",
      description: payload.description?.trim() || "",
      constraints: payload.constraints?.trim() || "",
      inputOutputFormat: payload.inputOutputFormat?.trim() || "",
      examples: payload.examples?.trim() || ""
    };
  }

  async function handleProblemTextUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setParsingProblemFile(true);
      setFileParseNotice(null);
      if (file.size > MAX_PROBLEM_TEXT_FILE_BYTES) {
        throw new Error("File is too large. Use a smaller plain text statement.");
      }
      const rawText = await file.text();
      const parsed = await parseProblemText(rawText);
      setProblemTitle(parsed.title);
      setProblemDescription(parsed.description);
      setConstraints(parsed.constraints);
      setInputOutputFormat(parsed.inputOutputFormat);
      setExamples(parsed.examples);
      setFileParseNotice("Problem fields detected and filled. Review and adjust if needed.");
    } catch (error) {
      setFileParseNotice(error instanceof Error ? error.message : "Could not parse this file.");
    } finally {
      event.target.value = "";
      setParsingProblemFile(false);
    }
  }

  const handleSeedAccept = useCallback(() => {
    setSeedFrontier((f) => {
      const max = seedStepsRef.current.length;
      const next = Math.min(f + 1, max + 1);
      if (next !== f && next <= max) {
        void persistFrontier(next);
        setHintsUsed((h) => h + 1);
      }
      return next;
    });
  }, [persistFrontier]);

  useEffect(() => {
    handleSeedAcceptRef.current = handleSeedAccept;
  }, [handleSeedAccept]);

  const handleEditorMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      seedInlineDisposeRef.current?.dispose();
      seedInlineDisposeRef.current = registerSeedInlineHintProvider(
        monaco,
        editor,
        () => {
          if (modeRef.current !== "SEED") return null;
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
        armTypingPauseHint();
        armIdleRef.current();
      });
      editor.onDidChangeCursorPosition(() => {
        if (modeRef.current === "SEED" && hintDeliveryRef.current === "automatic") {
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

  async function execute(type: "run" | "submit") {
    setRunning(true);
    setExecution({
      output: "",
      stdout: "",
      stderr: "",
      compileOutput: "",
      exitCode: 0,
      error: ""
    });
    try {
      const response = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language,
          code,
          stdin
        })
      });
      const data = await response.json();
      if (!response.ok) {
        setExecution((prev) => ({
          ...prev,
          error: data.error || "Execution failed."
        }));
        return;
      }

      setExecution({
        output: data.output ?? "",
        stdout: data.stdout ?? "",
        stderr: data.stderr ?? "",
        compileOutput: data.compileOutput ?? "",
        exitCode: data.exitCode ?? 0,
        error: ""
      });

      if (mode === "SEED" && seedStepsRef.current.length > 0 && (type === "run" || type === "submit")) {
        setSeedFrontier((f) => {
          const max = seedStepsRef.current.length;
          const next = Math.min(f + 1, max + 1);
          if (next !== f && next <= max) {
            void persistFrontier(next);
            setHintsUsed((h) => h + 1);
          }
          return next;
        });
        if (hintDelivery === "automatic") {
          queueMicrotask(() => {
            const ed = editorRef.current;
            if (ed) triggerInlineSuggest(ed);
          });
        }
      }

      if (type === "submit" && hintDelivery === "automatic" && mode !== "SHADOW" && mode !== "SEED" && hasProblemText) {
        const hint = getModeHint({
          mode,
          problemDescription,
          seedStep,
          hintSpecificity
        });
        if (hint) {
          setCurrentHint(hint);
          setHintsUsed((value) => value + 1);
        }
      }
    } catch {
      setExecution((prev) => ({
        ...prev,
        error: "Unexpected error while running code."
      }));
    } finally {
      setRunning(false);
    }
  }

  function requestHint() {
    if (mode === "SEED") {
      if (!seedSteps.length) {
        setCurrentHint(
          seedLoading ? "Getting your guided sequence ready…" : seedError ?? "Add problem details on the left to enable guidance."
        );
        return;
      }
      if (seedFrontier > seedSteps.length) {
        setCurrentHint("Great progress. You have completed all guided SEED steps for this problem.");
        return;
      }
      const ed = editorRef.current;
      if (ed) triggerInlineSuggest(ed);
      setHintsUsed((value) => value + 1);
      return;
    }

    const hint = getModeHint({
      mode,
      problemDescription,
      seedStep,
      hintSpecificity
    });
    setCurrentHint(hint);
    setHintsUsed((value) => value + 1);
    if (mode === "SHADOW") setSeedStep((value) => value + 1);
  }

  const modeCards: Array<{
    id: Mode;
    title: string;
    tagline: string;
    description: string;
    icon: typeof Leaf;
    accent: string;
  }> = [
    {
      id: "SEED",
      title: "SEED",
      tagline: "Foundational guidance",
      description:
        "Starts from scratch in very small steps—one idea at a time—so you learn how to think before you rush to code.",
      icon: Leaf,
      accent: "from-primary/15 to-transparent"
    },
    {
      id: "FOCUS",
      title: "FOCUS",
      tagline: "Logic-first mentoring",
      description:
        "For when you already know the basics but you are stuck on the core idea—hints stay strategic, not tutorial.",
      icon: Crosshair,
      accent: "from-secondary/15 to-transparent"
    },
    {
      id: "SHADOW",
      title: "SHADOW",
      tagline: "Minimal nudges",
      description:
        "Quiet until you ask. Each request gives one brief nudge—exam-style—then it steps back again.",
      icon: Zap,
      accent: "from-muted-foreground/10 to-transparent"
    }
  ];

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[1280px] flex-1 flex-col gap-4 px-3 py-4 sm:px-4 md:px-6">
      <section className="rounded-2xl border border-border bg-card/90 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">Guidance Studio</p>
          <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground">
            {settingsSummary}
          </span>
          <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground">
            Hints used: <span className="font-medium text-foreground">{hintsUsed}</span>
          </span>
          {mode === "SEED" ? (
            <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground">
              Step {seedSteps.length ? `${Math.min(seedFrontier, seedSteps.length)} / ${seedSteps.length}` : "—"}
            </span>
          ) : null}
          <Button variant="ghost" size="sm" className="ml-auto h-8 px-2" onClick={() => setGuidanceExpanded((v) => !v)}>
            {guidanceExpanded ? "Hide details" : "Show details"}
            <ChevronDown className={cn("size-4 transition-transform", guidanceExpanded && "rotate-180")} />
          </Button>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {modeCards.map((card) => {
            const Icon = card.icon;
            const selected = mode === card.id;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => {
                  setMode(card.id);
                  setSeedStep(1);
                  setCurrentHint("");
                }}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-3 text-left transition-all",
                  selected ? "border-primary bg-primary/10 ring-1 ring-primary/30" : "border-border bg-background hover:bg-accent/30"
                )}
              >
                <div className="grid size-9 shrink-0 place-content-center rounded-md border border-border bg-card">
                  <Icon className="size-4.5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{card.title}</p>
                  <p className="text-[11px] text-muted-foreground">{card.tagline}</p>
                </div>
              </button>
            );
          })}
        </div>

        {guidanceExpanded ? (
          <div className="mt-3 grid gap-3 border-t border-border pt-3 md:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs">
                <Eye className="size-3.5 text-primary" />
                Code shown in mentor messages
              </Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={codeDisclosure}
                onChange={(e) => setCodeDisclosure(e.target.value as CodeDisclosure)}
              >
                <option value="no_code">No code examples</option>
                <option value="allow_minimal_code">Tiny snippets allowed</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs">
                <MessageSquare className="size-3.5 text-primary" />
                Hint delivery
              </Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={hintDelivery}
                onChange={(e) => setHintDelivery(e.target.value as HintDelivery)}
              >
                <option value="on_demand">On demand</option>
                <option value="automatic">Automatic while coding</option>
              </select>
            </div>
            <div className="space-y-2 md:col-span-2 xl:col-span-1">
              <Label className="flex items-center gap-2 text-xs">
                <Target className="size-3.5 text-primary" />
                Hint depth: {hintSpecificity}
              </Label>
              <input
                type="range"
                min={1}
                max={5}
                value={hintSpecificity}
                onChange={(e) => setHintSpecificity(Number(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        ) : null}
      </section>

      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <section className="max-h-[18vh] min-h-[140px] space-y-3 overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Problem</h2>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,text/plain"
                className="hidden"
                onChange={handleProblemTextUpload}
              />
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => fileInputRef.current?.click()}
                disabled={parsingProblemFile}
              >
                {parsingProblemFile ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                Import .txt
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Upload a plain text statement and fields will auto-fill.</p>
          {fileParseNotice ? (
            <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">{fileParseNotice}</p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="problem-title">Title</Label>
            <Input id="problem-title" value={problemTitle} onChange={(e) => setProblemTitle(e.target.value)} className="h-10" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="problem-description">Description</Label>
            <textarea
              id="problem-description"
              className="min-h-28 w-full rounded-md border border-input bg-transparent p-3 text-sm"
              value={problemDescription}
              onChange={(e) => setProblemDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="problem-constraints">Constraints</Label>
            <textarea
              id="problem-constraints"
              className="min-h-16 w-full rounded-md border border-input bg-transparent p-3 text-sm"
              value={constraints}
              onChange={(e) => setConstraints(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="problem-io">Input / Output</Label>
            <textarea
              id="problem-io"
              className="min-h-16 w-full rounded-md border border-input bg-transparent p-3 text-sm"
              value={inputOutputFormat}
              onChange={(e) => setInputOutputFormat(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="problem-examples">Examples</Label>
            <textarea
              id="problem-examples"
              className="min-h-16 w-full rounded-md border border-input bg-transparent p-3 text-sm"
              value={examples}
              onChange={(e) => setExamples(e.target.value)}
            />
          </div>
        </section>

        <section className="grid min-h-[72vh] flex-1 gap-4 lg:grid-cols-[1.85fr_1fr]">
          <section className="flex min-h-0 flex-col rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Button variant={language === "cpp" ? "default" : "outline"} onClick={() => switchLanguage("cpp")}>
                C++
              </Button>
              <Button variant={language === "python" ? "default" : "outline"} onClick={() => switchLanguage("python")}>
                Python
              </Button>
              <div className="ml-auto flex items-center gap-2">
                {mode === "SEED" && seedLoading ? (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    Preparing
                  </span>
                ) : null}
                <Button variant="outline" className="h-9" onClick={() => requestHint()}>
                  <Sparkles className="size-4" />
                  Hint
                </Button>
                <Button variant="outline" className="h-9" onClick={() => execute("run")} disabled={running}>
                  {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                  Run
                </Button>
                <Button className="h-9" onClick={() => execute("submit")} disabled={running}>
                  {running ? "Submitting..." : "Submit"}
                </Button>
              </div>
            </div>

            {seedError && mode === "SEED" ? (
              <p className="mb-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{seedError}</p>
            ) : null}
            <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border">
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
                  inlineSuggest: { enabled: true }
                }}
              />
            </div>

            <div className="mt-3 space-y-2">
              <Label htmlFor="stdin">Program input (stdin)</Label>
              <textarea
                id="stdin"
                className="min-h-16 w-full rounded-md border border-input bg-transparent p-3 text-sm"
                value={stdin}
                onChange={(e) => setStdin(e.target.value)}
                placeholder="Provide stdin data here..."
              />
            </div>
          </section>

          <section className="flex min-h-0 flex-col rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <TerminalSquare className="size-4 text-primary" />
              <h3 className="font-semibold">Output & Error Console</h3>
            </div>
            {execution.error ? <p className="mb-3 text-sm text-destructive">{execution.error}</p> : null}
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto text-sm">
              <div className="rounded-md border border-border bg-background/70 p-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Compile Logs</p>
                <pre className="overflow-x-auto whitespace-pre-wrap">{execution.compileOutput || "No compile logs."}</pre>
              </div>
              <div className="rounded-md border border-border bg-background/70 p-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Program Output</p>
                <pre className="overflow-x-auto whitespace-pre-wrap">{execution.stdout || execution.output || "No output."}</pre>
              </div>
              <div className="rounded-md border border-border bg-background/70 p-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Runtime Errors</p>
                <pre className="overflow-x-auto whitespace-pre-wrap">{execution.stderr || "No runtime errors."}</pre>
              </div>
            </div>
            {mode === "SEED" && seedSteps.length > 0 ? (
              <div className="mt-3 rounded-md border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
                <p className="flex items-center gap-1.5 font-medium text-foreground">
                  <FileText className="size-3.5" />
                  Inline guidance
                </p>
                <p className="mt-1">Hints appear at your cursor like Copilot ghost text. Press Tab to accept a step comment.</p>
              </div>
            ) : null}
            {currentHint ? (
              <div className="mt-3 rounded-md border border-primary/30 bg-primary/10 p-3 text-sm">
                <p className="mb-1 font-medium text-primary">{mode === "SEED" ? "Notice" : "Current Hint"}</p>
                <p>{currentHint}</p>
              </div>
            ) : null}
            <p className="mt-3 text-xs text-muted-foreground">Exit code: {execution.exitCode}</p>
          </section>
        </section>
      </div>
    </div>
  );
}
