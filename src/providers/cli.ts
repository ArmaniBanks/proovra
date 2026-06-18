import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export type CliResult = {
  stdout: string;
  stderr: string;
};

export function runCli(
  command: string,
  args: string[],
  timeoutMs = 30_000
): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      {
        windowsHide: true,
        timeout: timeoutMs,
        maxBuffer: 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          const message = stderr || stdout || error.message;
          reject(new Error(message.trim()));
          return;
        }

        resolve({ stdout, stderr });
      }
    );
  });
}

export function getCircleCliCommand() {
  if (process.env.CIRCLE_CLI_COMMAND) return process.env.CIRCLE_CLI_COMMAND;
  const appData = process.env.APPDATA;
  const windowsShim = appData ? join(appData, "npm", "circle.cmd") : "";
  if (windowsShim && existsSync(windowsShim)) return windowsShim;
  return process.env.CIRCLE_CLI_COMMAND || "circle";
}

export function getCastCommand() {
  return process.env.FOUNDRY_CAST_COMMAND || ".\\tools\\foundry\\cast.exe";
}

export function parseJsonOutput<T>(output: string, label: string): T {
  try {
    return JSON.parse(output) as T;
  } catch {
    throw new Error(`${label} did not return valid JSON.`);
  }
}
