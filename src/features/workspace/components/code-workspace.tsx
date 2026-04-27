"use client";

import Editor from "@monaco-editor/react";
import { Crosshair, Eye, EyeOff, Leaf, Loader2, MessageSquare, Play, Sparkles, Target, TerminalSquare, Zap } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

  const steps = [
    "Start by restating what the program should read from input.",
    "Define variables and data structures needed to store the input.",
    "Design one loop/condition block that performs the core logic.",
    "Track intermediate values so you can verify logic at each step.",
    "Print final output in the exact required format."
  ];
  return `Step ${seedStep}: ${steps[(seedStep - 1) % steps.length]}`;
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

  const [execution, setExecution] = useState<ExecutionState>({
    output: "",
    stdout: "",
    stderr: "",
    compileOutput: "",
    exitCode: 0,
    error: ""
  });

  const hasProblemText = useMemo(
    () => Boolean(problemDescription.trim() || constraints.trim() || inputOutputFormat.trim() || examples.trim()),
    [problemDescription, constraints, inputOutputFormat, examples]
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

      if (type === "submit" && hintDelivery === "automatic" && mode !== "SHADOW" && hasProblemText) {
        const hint = getModeHint({
          mode,
          problemDescription,
          seedStep,
          hintSpecificity
        });
        setCurrentHint(hint);
        setHintsUsed((value) => value + 1);
        if (mode === "SEED") setSeedStep((value) => value + 1);
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
    const hint = getModeHint({
      mode,
      problemDescription,
      seedStep,
      hintSpecificity
    });
    setCurrentHint(hint);
    setHintsUsed((value) => value + 1);
    if (mode === "SEED") setSeedStep((value) => value + 1);
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
    <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-4 sm:px-6 md:px-10">
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_color-mix(in_oklab,var(--primary)_14%,transparent),transparent_55%),radial-gradient(circle_at_bottom_left,_color-mix(in_oklab,var(--secondary)_12%,transparent),transparent_55%)]" />
        <div className="relative space-y-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">Guidance Studio</p>
              <h2 className="mt-1 text-xl font-bold md:text-2xl">Choose how much help you want—before you start coding</h2>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                Think of this as your learning posture: how patient the mentor is, how detailed hints are, and whether help waits for you or meets you after you try.
              </p>
            </div>
            <div className="rounded-full border border-border bg-background/70 px-4 py-2 text-xs text-muted-foreground">
              Active: <span className="font-semibold text-foreground">{mode}</span>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
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
                  className={`relative overflow-hidden rounded-xl border p-4 text-left transition-all ${
                    selected
                      ? "border-primary bg-primary/10 shadow-sm ring-2 ring-primary/25"
                      : "border-border bg-background/60 hover:bg-accent/40"
                  }`}
                >
                  <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${card.accent}`} />
                  <div className="relative flex items-start gap-3">
                    <div className="grid size-10 shrink-0 place-content-center rounded-lg border border-border bg-card">
                      <Icon className="size-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{card.title}</p>
                      <p className="text-xs text-muted-foreground">{card.tagline}</p>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{card.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="rounded-xl border border-border bg-background/70 p-4">
            <p className="text-sm font-medium text-foreground">
              {mode === "SEED" &&
                "Best for beginners: the mentor explains the journey in order—from what a program does first, through input, logic, and output—without skipping ahead. The point is understanding, not finishing fast."}
              {mode === "FOCUS" &&
                "Best when you can code but the problem logic is fuzzy: hints focus on the real bottleneck (the algorithm), not loops and variables you already know."}
              {mode === "SHADOW" &&
                "Best for independence: no proactive teaching. Help is intentionally short—one nudge at a time—similar to contests or timed exams."}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Eye className="size-4 text-primary" />
                Code shown in mentor messages
              </Label>
              <select
                className="h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={codeDisclosure}
                onChange={(e) => setCodeDisclosure(e.target.value as CodeDisclosure)}
              >
                <option value="no_code">No example code (text-only guidance)</option>
                <option value="allow_minimal_code">Allow tiny snippets when they unlock understanding</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Controls whether hints may include very small illustrative snippets—or stay purely conceptual so you write the code yourself.
              </p>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MessageSquare className="size-4 text-primary" />
                When hints appear
              </Label>
              <select
                className="h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={hintDelivery}
                onChange={(e) => setHintDelivery(e.target.value as HintDelivery)}
              >
                <option value="on_demand">On demand (you press Get Hint)</option>
                <option value="automatic">After Submit (still respects SHADOW)</option>
              </select>
              <p className="text-xs text-muted-foreground">
                On demand keeps you in control. After Submit can provide a timely nudge right after you try—without replacing your thinking. In SHADOW, hints never arrive automatically; use Get Hint.
              </p>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="flex items-center gap-2">
                <Target className="size-4 text-primary" />
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
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Gentle nudge</span>
                <span>More explicit direction</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Higher specificity gives more concrete direction; lower keeps hints lighter so you reason more on your own.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted-foreground">
            <span>
              Hints used this session: <span className="font-medium text-foreground">{hintsUsed}</span>
              {mode === "SEED" ? (
                <>
                  {" "}
                  • Step focus: <span className="font-medium text-foreground">{seedStep}</span>
                </>
              ) : null}
            </span>
            <span className="flex items-center gap-2">
              <EyeOff className="size-3.5" />
              Your settings apply to mentor responses and hint timing—not your editor features.
            </span>
          </div>
        </div>
      </section>

      <section className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[0.95fr_1.35fr]">
        <article className="min-h-0 space-y-4 overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Problem Section</h2>
        <div className="space-y-2">
          <Label htmlFor="problem-title">Problem Title</Label>
          <Input id="problem-title" value={problemTitle} onChange={(e) => setProblemTitle(e.target.value)} className="h-11" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="problem-description">Description</Label>
          <textarea
            id="problem-description"
            className="min-h-32 w-full rounded-md border border-input bg-transparent p-3 text-sm"
            value={problemDescription}
            onChange={(e) => setProblemDescription(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="problem-constraints">Constraints</Label>
          <textarea
            id="problem-constraints"
            className="min-h-20 w-full rounded-md border border-input bg-transparent p-3 text-sm"
            value={constraints}
            onChange={(e) => setConstraints(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="problem-io">Input / Output Format</Label>
          <textarea
            id="problem-io"
            className="min-h-20 w-full rounded-md border border-input bg-transparent p-3 text-sm"
            value={inputOutputFormat}
            onChange={(e) => setInputOutputFormat(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="problem-examples">Examples</Label>
          <textarea
            id="problem-examples"
            className="min-h-20 w-full rounded-md border border-input bg-transparent p-3 text-sm"
            value={examples}
            onChange={(e) => setExamples(e.target.value)}
          />
        </div>
        </article>

        <article className="grid min-h-0 grid-rows-[auto_1fr] gap-4">
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Button variant={language === "cpp" ? "default" : "outline"} onClick={() => switchLanguage("cpp")}>
              C++
            </Button>
            <Button variant={language === "python" ? "default" : "outline"} onClick={() => switchLanguage("python")}>
              Python
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" className="h-10" onClick={() => requestHint()}>
                <Sparkles className="size-4" />
                Get Hint
              </Button>
              <Button variant="outline" className="h-10" onClick={() => execute("run")} disabled={running}>
                {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                Run
              </Button>
              <Button className="h-10" onClick={() => execute("submit")} disabled={running}>
                {running ? "Submitting..." : "Submit"}
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border">
            <Editor
              height="min(52vh, 520px)"
              language={language === "cpp" ? "cpp" : "python"}
              value={code}
              onChange={(value) => setCode(value ?? "")}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                tabSize: 2,
                automaticLayout: true
              }}
            />
          </div>

          <div className="mt-4 space-y-2">
            <Label htmlFor="stdin">Program input (stdin)</Label>
            <textarea
              id="stdin"
              className="min-h-20 w-full rounded-md border border-input bg-transparent p-3 text-sm"
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
          {currentHint ? (
            <div className="mt-4 shrink-0 rounded-md border border-primary/30 bg-primary/10 p-3 text-sm">
              <p className="mb-1 font-medium text-primary">Current Hint</p>
              <p>{currentHint}</p>
            </div>
          ) : null}
          <p className="mt-3 shrink-0 text-xs text-muted-foreground">Exit code: {execution.exitCode}</p>
        </section>
        </article>
      </section>
    </div>
  );
}
