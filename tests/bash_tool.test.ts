import { describe, it, expect } from "vitest";
import {
  BashTool,
  BashOutputTool,
  BashKillTool,
} from "../src/tools/bash_tool";

const describeIf = process.platform === "win32" ? describe.skip : describe;

describeIf("Bash tool", () => {
  it("should execute foreground commands", async () => {
    const tool = new BashTool();
    const result = await tool.execute({ command: "echo 'Hello from foreground'" });

    expect(result.success).toBe(true);
    expect(result.stdout).toContain("Hello from foreground");
    expect(result.exit_code).toBe(0);
  });

  it("should capture stdout and stderr", async () => {
    const tool = new BashTool();
    const result = await tool.execute({
      command: "echo 'stdout message' && echo 'stderr message' >&2",
    });

    expect(result.success).toBe(true);
    expect(result.stdout).toContain("stdout message");
    expect(result.stderr).toContain("stderr message");
  });

  it("should report command failures", async () => {
    const tool = new BashTool();
    const result = await tool.execute({
      command: "ls /nonexistent_directory_12345",
    });

    expect(result.success).toBe(false);
    expect(result.exit_code).not.toBe(0);
    expect(result.error).toBeTruthy();
  });

  it("should handle timeouts", async () => {
    const tool = new BashTool();
    const result = await tool.execute({ command: "sleep 5", timeout: 1 });

    expect(result.success).toBe(false);
    expect(result.error?.toLowerCase()).toContain("timed out");
  }, 10000);

  it("should run background commands and fetch output", async () => {
    const tool = new BashTool();
    const result = await tool.execute({
      command: "for i in 1 2 3; do echo 'Line '$i; sleep 0.2; done",
      run_in_background: true,
    });

    expect(result.success).toBe(true);
    const bashId = result.bash_id ?? "";
    expect(bashId).not.toBe("");
    await new Promise((resolve) => setTimeout(resolve, 500));

    const outputTool = new BashOutputTool();
    const outputResult = await outputTool.execute({ bash_id: bashId });

    expect(outputResult.success).toBe(true);
    expect(outputResult.stdout).toContain("Line");

    const killTool = new BashKillTool();
    const killResult = await killTool.execute({ bash_id: bashId });
    expect(killResult.success).toBe(true);
  }, 10000);

  it("should filter background output", async () => {
    const tool = new BashTool();
    const result = await tool.execute({
      command: "for i in 1 2 3 4 5; do echo 'Line '$i; sleep 0.2; done",
      run_in_background: true,
    });

    const bashId = result.bash_id ?? "";
    expect(bashId).not.toBe("");
    await new Promise((resolve) => setTimeout(resolve, 800));

    const outputTool = new BashOutputTool();
    const outputResult = await outputTool.execute({
      bash_id: bashId,
      filter_str: "Line [24]",
    });

    expect(outputResult.success).toBe(true);
    if (outputResult.stdout) {
      expect(outputResult.stdout).toMatch(/Line (2|4)/);
    }

    const killTool = new BashKillTool();
    await killTool.execute({ bash_id: bashId });
  }, 10000);

  it("should handle non-existent bash ids", async () => {
    const killTool = new BashKillTool();
    const killResult = await killTool.execute({ bash_id: "nonexistent123" });

    expect(killResult.success).toBe(false);
    expect(killResult.error?.toLowerCase()).toContain("not found");

    const outputTool = new BashOutputTool();
    const outputResult = await outputTool.execute({ bash_id: "nonexistent123" });

    expect(outputResult.success).toBe(false);
    expect(outputResult.error?.toLowerCase()).toContain("not found");
  });
});
