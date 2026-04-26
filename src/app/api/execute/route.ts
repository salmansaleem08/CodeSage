import { NextResponse } from "next/server";

const WANDBOX_ENDPOINT = "https://wandbox.org/api/compile.json";

type ExecuteRequestBody = {
  language: "cpp" | "python";
  code: string;
  stdin?: string;
};

function getRuntime(language: ExecuteRequestBody["language"]) {
  if (language === "cpp") {
    return { compiler: "gcc-13.2.0", options: "warning,gnu++17" };
  }
  return { compiler: "cpython-3.10.15", options: "" };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ExecuteRequestBody;
    if (!body?.code?.trim()) {
      return NextResponse.json({ error: "Code is required." }, { status: 400 });
    }

    const runtime = getRuntime(body.language);
    const payload = {
      compiler: runtime.compiler,
      stdin: body.stdin ?? "",
      code: body.code,
      options: runtime.options,
      save: false
    };

    const response = await fetch(WANDBOX_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      cache: "no-store"
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Execution service is unavailable right now." }, { status: 502 });
    }

    const result = await response.json();
    const output = result?.program_output ?? "";
    const compileOutput = [result?.compiler_output, result?.compiler_error].filter(Boolean).join("\n");
    const runStderr = [result?.program_error, result?.program_message].filter(Boolean).join("\n");
    const runStdout = result?.program_output ?? "";
    const code = Number(result?.status ?? 1);

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
