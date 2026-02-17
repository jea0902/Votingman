/**
 * 버핏 원픽 Python 스크립트 실행 헬퍼
 * - public/scripts 내 yf_data_collect.py, yf_result.py 실행용
 * - Vercel에서는 Python 미지원이므로, Python이 설치된 환경(예: VPS에서 next start)에서만 사용
 */

import { spawn } from "child_process";
import path from "path";

const SCRIPTS_DIR = path.join(process.cwd(), "public", "scripts");

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    return auth.slice(7) === secret;
  }
  const headerSecret = request.headers.get("x-cron-secret");
  return headerSecret === secret;
}

export type RunResult = {
  ok: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
};

/**
 * public/scripts에서 Python 스크립트 실행
 * @param scriptName 예: "yf_data_collect.py"
 * @param args 예: ["--mode", "prices"]
 */
export function runBuffettScript(
  scriptName: string,
  args: string[]
): Promise<RunResult> {
  return new Promise((resolve) => {
    const python = process.platform === "win32" ? "python" : "python3";
    const scriptPath = path.join(SCRIPTS_DIR, scriptName);
    const child = spawn(python, [scriptPath, ...args], {
      cwd: SCRIPTS_DIR,
      env: process.env,
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("close", (code, signal) => {
      resolve({
        ok: code === 0,
        code: code ?? null,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });
    child.on("error", (err) => {
      resolve({
        ok: false,
        code: null,
        stdout,
        stderr: stderr || String(err),
      });
    });
  });
}

export { isAuthorized as isCronAuthorized };
