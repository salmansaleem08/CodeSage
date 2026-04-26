import { NextResponse } from "next/server";

const PISTON_ENDPOINT = "https://emkc.org/api/v2/piston/execute";

type ExecuteRequestBody = {
  language: "cpp" | "python";
  code: string;
  stdin?: string;
};

function getRuntime(language: ExecuteRequestBody["language"]) {
  if (language === "cpp") {
    return { language: "cpp", version: "17.0.0" };
  }
  return { language: "python", version: "3.10.0" };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ExecuteRequestBody;
    if (!body?.code?.trim()) {
      return NextResponse.json({ error: "Code is required." }, { status: 400 });
    }

    const runtime = getRuntime(body.language);
    const pistonPayload = {
      language: runtime.language,
      version: runtime.version,
      files: [{ name: `main.${body.language === "cpp" ? "cpp" : "py"}`, content: body.code }],
      stdin: body.stdin ?? "",
      compile_timeout: 10000,
      run_timeout: 10000
    };

    const response = await fetch(PISTON_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(pistonPayload),
      cache: "no-store"
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Execution service is unavailable right now." }, { status: 502 });
    }

    const result = await response.json();
    const output = result?.run?.output ?? "";
    const compileOutput = result?.compile?.output ?? "";
    const runStderr = result?.run?.stderr ?? "";
    const runStdout = result?.run?.stdout ?? "";
    const code = result?.run?.code ?? 0;

    return NextResponse.json({
      output,
      stdout: runStdout,
      stderr: runStderr,
      compileOutput,
      exitCode: code
    });
  } catch {
    return NextResponse.json({ error: "Unexpected server error while executing code." }, { status: 500 });
  }
}
