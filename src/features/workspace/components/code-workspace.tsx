"use client";

import Editor from "@monaco-editor/react";
import { Loader2, Play, Settings2, Sparkles, TerminalSquare } from "lucide-react";
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
      "What is the exact output your loop should produce?",
      "Are you validating each input value before processing?",
      "Can you test one minimal example by hand first?"
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

  return (
    <section className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-6 sm:px-6 md:px-10 lg:grid-cols-[1fr_1.2fr]">
      <article className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
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

      <article className="space-y-4">
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
              height="380px"
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
            <Label htmlFor="stdin">Input</Label>
            <textarea
              id="stdin"
              className="min-h-20 w-full rounded-md border border-input bg-transparent p-3 text-sm"
              value={stdin}
              onChange={(e) => setStdin(e.target.value)}
              placeholder="Provide stdin data here..."
            />
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Settings2 className="size-4 text-primary" />
            <h3 className="font-semibold">Mode & Guidance Settings</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Mode</Label>
              <select
                className="h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={mode}
                onChange={(e) => setMode(e.target.value as Mode)}
              >
                <option value="SEED">SEED</option>
                <option value="FOCUS">FOCUS</option>
                <option value="SHADOW">SHADOW</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Code Disclosure</Label>
              <select
                className="h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={codeDisclosure}
                onChange={(e) => setCodeDisclosure(e.target.value as CodeDisclosure)}
              >
                <option value="allow_minimal_code">Allow minimal code</option>
                <option value="no_code">No code</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Hint Delivery</Label>
              <select
                className="h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={hintDelivery}
                onChange={(e) => setHintDelivery(e.target.value as HintDelivery)}
              >
                <option value="automatic">Automatic</option>
                <option value="on_demand">On demand</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Hint Specificity: {hintSpecificity}</Label>
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
          <p className="mt-3 text-xs text-muted-foreground">
            Hints used: {hintsUsed} {mode === "SEED" ? `• Current step: ${seedStep}` : ""}
          </p>
        </section>

        <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <TerminalSquare className="size-4 text-primary" />
            <h3 className="font-semibold">Output & Error Console</h3>
          </div>
          {execution.error ? <p className="mb-3 text-sm text-destructive">{execution.error}</p> : null}
          <div className="space-y-3 text-sm">
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
            <div className="mt-4 rounded-md border border-primary/30 bg-primary/10 p-3 text-sm">
              <p className="mb-1 font-medium text-primary">Current Hint</p>
              <p>{currentHint}</p>
            </div>
          ) : null}
          <p className="mt-3 text-xs text-muted-foreground">Exit code: {execution.exitCode}</p>
        </section>
      </article>
    </section>
  );
}
