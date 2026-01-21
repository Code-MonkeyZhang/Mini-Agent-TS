import { exec, spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import type { Tool, ToolResultWithMeta } from "./base.js";

type BashInput = {
  command: string;
  timeout?: number;
  run_in_background?: boolean;
};

type BashOutputInput = {
  bash_id: string;
  filter_str?: string;
};

type BashKillInput = {
  bash_id: string;
};

type BashOutputResult = ToolResultWithMeta<{
  stdout: string;
  stderr: string;
  exit_code: number;
  bash_id?: string | null;
}>;

/**
 * Format stdout/stderr/metadata into a single content string.
 */
function formatBashContent(result: BashOutputResult): string {
  let output = "";
  if (result.stdout) {
    output += result.stdout;
  }
  if (result.stderr) {
    output += `${output ? "\n" : ""}[stderr]:\n${result.stderr}`;
  }
  if (result.bash_id) {
    output += `${output ? "\n" : ""}[bash_id]:\n${result.bash_id}`;
  }
  if (result.exit_code) {
    output += `${output ? "\n" : ""}[exit_code]:\n${result.exit_code}`;
  }
  return output || "(no output)";
}

/**
 * Pick OS-appropriate shell and args for the command.
 */
function buildShellCommand(command: string): { shell: string; args: string[] } {
  if (process.platform === "win32") {
    return {
      shell: "powershell.exe",
      args: ["-NoProfile", "-Command", command],
    };
  }
  return {
    shell: "/bin/bash",
    args: ["-lc", command],
  };
}

class BackgroundShell {
  public outputLines: string[] = [];
  public lastReadIndex = 0;
  public status: "running" | "completed" | "failed" | "terminated" | "error" =
    "running";
  public exitCode: number | null = null;
  private stdoutBuffer = "";
  private stderrBuffer = "";

  constructor(
    public readonly bashId: string,
    public readonly command: string,
    public readonly process: ChildProcessWithoutNullStreams,
    public readonly startTime: number
  ) {}

  /**
   * Append a new output line to the buffer.
   */
  addOutput(chunk: string): void {
    this.outputLines.push(chunk);
  }

  /**
   * Split buffered output into complete lines.
   */
  flushBuffer(buffer: string): string[] {
    const lines = buffer.split("\n");
    const completeLines = lines.slice(0, -1);
    return completeLines;
  }

  /**
   * Track stdout/stderr stream chunks and extract full lines.
   */
  handleStreamData(data: Buffer, isStdout: boolean): void {
    const text = data.toString("utf8");
    if (isStdout) {
      this.stdoutBuffer += text;
      const lines = this.flushBuffer(this.stdoutBuffer);
      lines.forEach((line) => this.addOutput(line));
      this.stdoutBuffer = this.stdoutBuffer.split("\n").slice(-1)[0] ?? "";
    } else {
      this.stderrBuffer += text;
      const lines = this.flushBuffer(this.stderrBuffer);
      lines.forEach((line) => this.addOutput(line));
      this.stderrBuffer = this.stderrBuffer.split("\n").slice(-1)[0] ?? "";
    }
  }

  /**
   * Flush any remaining buffered data when the process exits.
   */
  finalizeBuffers(): void {
    if (this.stdoutBuffer) {
      this.addOutput(this.stdoutBuffer);
      this.stdoutBuffer = "";
    }
    if (this.stderrBuffer) {
      this.addOutput(this.stderrBuffer);
      this.stderrBuffer = "";
    }
  }

  /**
   * Return new output lines since the last read, optionally regex-filtered.
   */
  getNewOutput(filterPattern?: string): string[] {
    const newLines = this.outputLines.slice(this.lastReadIndex);
    this.lastReadIndex = this.outputLines.length;

    if (!filterPattern) {
      return newLines;
    }

    try {
      const regex = new RegExp(filterPattern);
      return newLines.filter((line) => regex.test(line));
    } catch {
      return newLines;
    }
  }

  /**
   * Update process status based on exit code.
   */
  updateStatus(exitCode: number | null): void {
    if (exitCode === null) {
      this.status = "running";
      return;
    }
    this.exitCode = exitCode;
    if (this.status === "terminated") {
      return;
    }
    this.status = exitCode === 0 ? "completed" : "failed";
  }

  /**
   * Terminate the process with a graceful timeout fallback.
   */
  async terminate(): Promise<void> {
    if (!this.process.killed) {
      this.process.kill("SIGTERM");
    }
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        if (!this.process.killed) {
          this.process.kill("SIGKILL");
        }
        resolve();
      }, 5000);
      this.process.once("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
    });
    this.status = "terminated";
  }
}

class BackgroundShellManager {
  private static shells: Map<string, BackgroundShell> = new Map();

  /**
   * Register a background shell.
   */
  static add(shell: BackgroundShell): void {
    this.shells.set(shell.bashId, shell);
  }

  /**
   * Retrieve a background shell by id.
   */
  static get(bashId: string): BackgroundShell | undefined {
    return this.shells.get(bashId);
  }

  /**
   * List all active background ids.
   */
  static getAvailableIds(): string[] {
    return Array.from(this.shells.keys());
  }

  /**
   * Remove a background shell from tracking.
   */
  static remove(bashId: string): void {
    this.shells.delete(bashId);
  }

  /**
   * Terminate a background shell and remove it from tracking.
   */
  static async terminate(bashId: string): Promise<BackgroundShell> {
    const shell = this.shells.get(bashId);
    if (!shell) {
      throw new Error(`Shell not found: ${bashId}`);
    }
    await shell.terminate();
    this.remove(bashId);
    return shell;
  }
}

/**
 * Normalize BashOutputResult and auto-generate content.
 */
function buildResult(
  base: Omit<BashOutputResult, "content"> & { content?: string }
): BashOutputResult {
  const result: BashOutputResult = {
    success: base.success,
    content: base.content ?? "",
    error: base.error ?? null,
    stdout: base.stdout,
    stderr: base.stderr,
    exit_code: base.exit_code,
    bash_id: base.bash_id,
  };
  result.content = formatBashContent(result);
  return result;
}

export class BashTool implements Tool<BashInput, BashOutputResult> {
  public name = "bash";
  public description =
    "Execute bash commands in foreground or background.\n\n" +
    "For terminal operations like git, npm, docker, etc. DO NOT use for file operations - use specialized tools.\n\n" +
    "Parameters:\n" +
    "  - command (required): Bash command to execute\n" +
    "  - timeout (optional): Timeout in seconds (default: 120, max: 600) for foreground commands\n" +
    "  - run_in_background (optional): Set true for long-running commands (servers, etc.)\n\n" +
    "Tips:\n" +
    "  - Quote file paths with spaces: cd \"My Documents\"\n" +
    "  - Chain dependent commands with &&: git add . && git commit -m \"msg\"\n" +
    "  - Use absolute paths instead of cd when possible\n" +
    "  - For background commands, monitor with bash_output and terminate with bash_kill\n\n" +
    "Examples:\n" +
    "  - git status\n" +
    "  - npm test\n" +
    "  - python3 -m http.server 8080 (with run_in_background=true)";

  public parameters = {
    type: "object",
    properties: {
      command: {
        type: "string",
        description:
          "The shell command to execute. Quote file paths with spaces using double quotes.",
      },
      timeout: {
        type: "integer",
        description:
          "Optional: Timeout in seconds (default: 120, max: 600). Only applies to foreground commands.",
        default: 120,
      },
      run_in_background: {
        type: "boolean",
        description:
          "Optional: Set to true to run the command in the background. Use this for long-running commands like servers. You can monitor output using bash_output tool.",
        default: false,
      },
    },
    required: ["command"],
  };

  /**
   * Execute a shell command in foreground or background.
   */
  async execute(params: BashInput): Promise<BashOutputResult> {
    const timeout = Math.min(Math.max(params.timeout ?? 120, 1), 600);
    const runInBackground = params.run_in_background ?? false;
    const { shell, args } = buildShellCommand(params.command);

    if (runInBackground) {
      const bashId = Math.random().toString(16).slice(2, 10);
      const process = spawn(shell, args, { stdio: "pipe" });
      const bgShell = new BackgroundShell(
        bashId,
        params.command,
        process,
        Date.now()
      );
      BackgroundShellManager.add(bgShell);

      process.stdout.on("data", (data: Buffer) =>
        bgShell.handleStreamData(data, true)
      );
      process.stderr.on("data", (data: Buffer) =>
        bgShell.handleStreamData(data, false)
      );
      process.on("close", (code) => {
        bgShell.finalizeBuffers();
        bgShell.updateStatus(code);
      });
      process.on("error", () => {
        bgShell.status = "error";
      });

      return buildResult({
        success: true,
        stdout: `Background command started with ID: ${bashId}`,
        stderr: "",
        exit_code: 0,
        bash_id: bashId,
        content:
          `Command started in background. Use bash_output to monitor (bash_id='${bashId}').\n\n` +
          `Command: ${params.command}\nBash ID: ${bashId}`,
      });
    }

    return await new Promise<BashOutputResult>((resolve) => {
      exec(
        params.command,
        {
          timeout: timeout * 1000,
          maxBuffer: 10 * 1024 * 1024,
          shell,
        },
        (error, stdout, stderr) => {
          if (error) {
            const exitCode =
              typeof (error as { code?: number }).code === "number"
                ? (error as { code?: number }).code ?? -1
                : -1;
            const errorMsg =
              error.killed && error.signal === "SIGTERM"
                ? `Command timed out after ${timeout} seconds`
                : `Command failed with exit code ${exitCode}`;
            resolve(
              buildResult({
                success: false,
                error: stderr ? `${errorMsg}\n${stderr.trim()}` : errorMsg,
                stdout: stdout ?? "",
                stderr: stderr ?? errorMsg,
                exit_code: exitCode,
                bash_id: null,
              })
            );
            return;
          }
          resolve(
            buildResult({
              success: true,
              stdout: stdout ?? "",
              stderr: stderr ?? "",
              exit_code: 0,
              bash_id: null,
            })
          );
        }
      );
    });
  }
}

export class BashOutputTool implements Tool<BashOutputInput, BashOutputResult> {
  public name = "bash_output";
  public description =
    "Retrieves output from a running or completed background bash shell.\n\n" +
    "- Takes a bash_id parameter identifying the shell\n" +
    "- Always returns only new output since the last check\n" +
    "- Returns stdout and stderr output along with shell status\n" +
    "- Supports optional regex filtering to show only lines matching a pattern\n" +
    "- Use this tool when you need to monitor or check the output of a long-running shell\n" +
    "- Shell IDs can be found using the bash tool with run_in_background=true\n\n" +
    "Example: bash_output(bash_id=\"abc12345\")";

  public parameters = {
    type: "object",
    properties: {
      bash_id: {
        type: "string",
        description:
          "The ID of the background shell to retrieve output from. Shell IDs are returned when starting a command with run_in_background=true.",
      },
      filter_str: {
        type: "string",
        description:
          "Optional regular expression to filter the output lines. Only lines matching this regex will be included in the result. Any lines that do not match will no longer be available to read.",
      },
    },
    required: ["bash_id"],
  };

  /**
   * Fetch incremental output from a background shell.
   */
  async execute(params: BashOutputInput): Promise<BashOutputResult> {
    const shell = BackgroundShellManager.get(params.bash_id);
    if (!shell) {
      const available = BackgroundShellManager.getAvailableIds();
      return buildResult({
        success: false,
        error: `Shell not found: ${params.bash_id}. Available: ${
          available.length ? available.join(", ") : "none"
        }`,
        stdout: "",
        stderr: "",
        exit_code: -1,
        bash_id: params.bash_id,
      });
    }

    const newLines = shell.getNewOutput(params.filter_str);
    return buildResult({
      success: true,
      stdout: newLines.length ? newLines.join("\n") : "",
      stderr: "",
      exit_code: shell.exitCode ?? 0,
      bash_id: params.bash_id,
    });
  }
}

export class BashKillTool implements Tool<BashKillInput, BashOutputResult> {
  public name = "bash_kill";
  public description =
    "Kills a running background bash shell by its ID.\n\n" +
    "- Takes a bash_id parameter identifying the shell to kill\n" +
    "- Attempts graceful termination (SIGTERM) first, then forces (SIGKILL) if needed\n" +
    "- Returns the final status and any remaining output before termination\n" +
    "- Cleans up all resources associated with the shell\n" +
    "- Use this tool when you need to terminate a long-running shell\n" +
    "- Shell IDs can be found using the bash tool with run_in_background=true\n\n" +
    "Example: bash_kill(bash_id=\"abc12345\")";

  public parameters = {
    type: "object",
    properties: {
      bash_id: {
        type: "string",
        description:
          "The ID of the background shell to terminate. Shell IDs are returned when starting a command with run_in_background=true.",
      },
    },
    required: ["bash_id"],
  };

  /**
   * Terminate a background shell process.
   */
  async execute(params: BashKillInput): Promise<BashOutputResult> {
    const shell = BackgroundShellManager.get(params.bash_id);
    const remainingLines = shell ? shell.getNewOutput() : [];
    try {
      const terminated = await BackgroundShellManager.terminate(params.bash_id);
      return buildResult({
        success: true,
        stdout: remainingLines.join("\n"),
        stderr: "",
        exit_code: terminated.exitCode ?? 0,
        bash_id: params.bash_id,
      });
    } catch (error) {
      const available = BackgroundShellManager.getAvailableIds();
      return buildResult({
        success: false,
        error: `${(error as Error).message}. Available: ${
          available.length ? available.join(", ") : "none"
        }`,
        stdout: "",
        stderr: (error as Error).message || String(error),
        exit_code: -1,
        bash_id: params.bash_id,
      });
    }
  }
}
