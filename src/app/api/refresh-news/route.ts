import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const PYTHON_CANDIDATES = [
  process.env.PYTHON_PATH,
  "C:/Users/X1 YOGA/AppData/Local/Programs/Python/Python312/python.exe",
  "python",
  "py"
].filter((item): item is string => Boolean(item));

function canRunPython(candidate: string): boolean {
  try {
    const result = spawnSync(candidate, ["--version"], {
      windowsHide: true,
      encoding: "utf-8"
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

function resolvePythonExecutable(): string | null {
  for (const candidate of PYTHON_CANDIDATES) {
    if (candidate.includes(":/") || candidate.includes(":\\")) {
      if (existsSync(candidate) && canRunPython(candidate)) {
        return candidate;
      }
      continue;
    }
    if (canRunPython(candidate)) {
      return candidate;
    }
  }
  return null;
}

function runFetchScript(pythonExec: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const scriptPath = join(process.cwd(), "fetch_ai_news.py");
    const child = spawn(pythonExec, [scriptPath], {
      cwd: process.cwd(),
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";

    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("执行抓取脚本超时（120秒）"));
    }, 120_000);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(stderr || stdout || `脚本执行失败，退出码: ${code}`));
      }
    });
  });
}

export async function POST() {
  const pythonExec = resolvePythonExecutable();
  if (!pythonExec) {
    return NextResponse.json(
      { ok: false, message: "未找到可用的 Python 解释器，请设置 PYTHON_PATH。" },
      { status: 500 }
    );
  }

  try {
    const result = await runFetchScript(pythonExec);
    revalidatePath("/");
    return NextResponse.json({
      ok: true,
      message: "资讯刷新成功",
      output: (result.stdout || result.stderr).slice(-2000)
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "资讯刷新失败",
        error: error instanceof Error ? error.message : "未知错误"
      },
      { status: 500 }
    );
  }
}
