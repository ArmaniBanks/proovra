import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

function run(command, args, timeout = 30_000) {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      { windowsHide: true, timeout, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        resolve({
          ok: !error,
          command: [command, ...args].join(" "),
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          error: error?.message ?? "",
        });
      }
    );
  });
}

async function firstWorking(commands) {
  for (const [command, args] of commands) {
    const result = await run(command, args);
    if (result.ok) return result;
  }
  return run(commands[0][0], commands[0][1]);
}

function circleCommand() {
  if (process.env.CIRCLE_CLI_COMMAND) return process.env.CIRCLE_CLI_COMMAND;
  const appData = process.env.APPDATA;
  const windowsShim = appData ? join(appData, "npm", "circle.cmd") : "";
  if (windowsShim && existsSync(windowsShim)) return windowsShim;
  return "circle";
}

const checks = [
  {
    name: "ARC CLI",
    install: "uv tool install git+https://github.com/the-canteen-dev/ARC-cli",
    result: await firstWorking([
      ["arc", ["--help"]],
      ["arc-canteen", ["--help"]],
      ["ARC-cli", ["--help"]],
      ["uv", ["tool", "run", "arc-canteen", "--help"]],
      ["uv", ["tool", "run", "ARC-cli", "--help"]],
    ]),
  },
  {
    name: "Circle CLI version",
    install: "npm install -g @circle-fin/cli",
    result: await run(circleCommand(), ["--version"]),
  },
  {
    name: "Circle CLI Arc Testnet support",
    install: "npm install -g @circle-fin/cli",
    result: await run(circleCommand(), [
      "blockchain",
      "list",
      "--output",
      "json",
    ]),
  },
];

let failed = false;
for (const check of checks) {
  const status = check.result.ok ? "PASS" : "FAIL";
  if (!check.result.ok) failed = true;
  console.log(`${status} ${check.name}`);
  console.log(`  install: ${check.install}`);
  console.log(`  command: ${check.result.command}`);
  if (check.result.stdout) console.log(`  stdout: ${check.result.stdout.slice(0, 500)}`);
  if (check.result.stderr) console.log(`  stderr: ${check.result.stderr.slice(0, 500)}`);
  if (check.result.error) console.log(`  error: ${check.result.error.slice(0, 500)}`);
}

process.exitCode = failed ? 1 : 0;
