const { spawn } = require("child_process");
const crypto = require("crypto");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { buildPaths, getLanguageProfile } = require("./languageProfiles");
const { ExecutionSystemError } = require("./statusMapper");

const MAX_OUTPUT = 1024 * 1024; // 1MB Global Cap
const COMPILE_TIMEOUT_MS = Number(process.env.CODE_RUNNER_COMPILE_TIMEOUT_MS || 10000);
const commandAvailability = new Map();

const killProcessTree = (child) => {
  if (!child || !child.pid) return Promise.resolve();

  if (process.platform === "win32") {
    return new Promise((resolve) => {
      const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        windowsHide: true,
        stdio: "ignore",
      });
      killer.on("close", resolve);
      killer.on("error", resolve);
    });
  }

  try {
    process.kill(-child.pid, "SIGKILL");
  } catch (error) {
    try {
      child.kill("SIGKILL");
    } catch (_) {
      // Process already exited.
    }
  }
  return Promise.resolve();
};

const runProcess = ({ command, args, cwd, input = "", timeoutMs, outputLimit = MAX_OUTPUT }) => {
  return new Promise((resolve, reject) => {
    const startedAt = process.hrtime.bigint();
    let stdout = "";
    let stderr = "";
    let outputSize = 0;
    let timedOut = false;
    let outputLimitExceeded = false;
    let settled = false;

    let child;
    try {
      const useShell = process.platform === "win32";
      console.log(`🛠️ [EXEC_SPAWN] Command: ${command} | Shell: ${useShell} | CWD: ${cwd}`);
      
      child = spawn(command, args, {
        cwd,
        shell: useShell,
        windowsHide: true,
        detached: process.platform !== "win32",
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (error) {
      console.error("🚀 [EXEC_FATAL_START_ERROR]", error);
      const message = `Failed to start execution tool: ${error.message}`;
      reject(new ExecutionSystemError(message, { command, args, code: error.code }));
      return;
    }

    const finishReject = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    };

    const timer = setTimeout(() => {
      if (settled) return;
      timedOut = true;
      killProcessTree(child).catch(() => {});
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      if (outputLimitExceeded || settled) return;
      outputSize += chunk.length;
      if (outputSize > outputLimit) {
        outputLimitExceeded = true;
        killProcessTree(child).catch(() => {});
        return;
      }
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk) => {
      if (outputLimitExceeded || settled) return;
      outputSize += chunk.length;
      if (outputSize > outputLimit) {
        outputLimitExceeded = true;
        killProcessTree(child).catch(() => {});
        return;
      }
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      console.error("❌ [CHILD_PROCESS_ERROR]", { 
        command, 
        args, 
        error: error.message,
        path: process.env.PATH?.split(path.delimiter).slice(0, 5) // Log first 5 PATH entries for debug
      });
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      
      let message = `Execution tool error: ${error.message}`;
      if (error.code === "ENOENT") {
        message = `Execution tool not found: "${command}". Please ensure it is installed and in your system PATH. (Detected Platform: ${process.platform})`;
      }
      
      finishReject(new ExecutionSystemError(message, { command, args, code: error.code }));
    });

    child.on("close", (exitCode, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      resolve({
        stdout,
        stderr,
        exitCode,
        signal,
        timedOut,
        outputLimitExceeded,
        durationMs,
        memoryKb: null,
      });
    });

    try {
      if (input) child.stdin.write(input);
      child.stdin.end();
    } catch (error) {
      // Ignore broken pipe errors if process exits before stdin is closed
      console.log("CODE_EXEC_STDIN_ERROR", { error: error.message });
    }
  });
};

const checkCommand = async (candidate) => {
  if (!candidate.versionArgs) return true;

  const key = `${candidate.command} ${candidate.versionArgs.join(" ")}`;
  if (commandAvailability.has(key)) {
    return commandAvailability.get(key);
  }

  try {
    const result = await runProcess({
      command: candidate.command,
      args: candidate.versionArgs,
      cwd: process.cwd(),
      timeoutMs: 5000,
      outputLimit: 2000,
    });
    const available = result.exitCode === 0 && !result.timedOut && !result.outputLimitExceeded;
    commandAvailability.set(key, available);
    return available;
  } catch (error) {
    commandAvailability.set(key, false);
    return false;
  }
};

const runAvailableCandidate = async (candidates, runOptions) => {
  const missingLabels = [];

  for (const candidate of candidates) {
    const available = await checkCommand(candidate);
    if (!available) {
      missingLabels.push(candidate.label || candidate.command);
      continue;
    }

    try {
      return await runProcess({
        command: candidate.command,
        args: candidate.args,
        ...runOptions,
      });
    } catch (error) {
      if (error.isSystemError && error.details?.code === "ENOENT") {
        missingLabels.push(candidate.label || candidate.command);
        continue;
      }
      throw error;
    }
  }

  throw new ExecutionSystemError("Required local execution tool is unavailable.", {
    tools: missingLabels,
  });
};

const createTempDir = async () => {
  const root = path.join(os.tmpdir(), "code-runner");
  await fs.mkdir(root, { recursive: true });
  const tempDir = path.join(root, crypto.randomUUID());
  await fs.mkdir(tempDir, { recursive: true });
  return tempDir;
};

const runOne = async ({ code, language, input = "", timeLimit = 2000 }) => {
  const profile = getLanguageProfile(language);
  if (!profile) {
    throw new ExecutionSystemError("Unsupported language profile.", { language });
  }

  const validationError = profile.validateSource ? profile.validateSource(code) : null;
  if (validationError) {
    return {
      stdout: "",
      stderr: "",
      compile_output: validationError,
      compileFailed: true,
      durationMs: 0,
      memoryKb: null,
    };
  }

  let tempDir = null;
  const startedAt = Date.now();

  try {
    tempDir = await createTempDir();
    const paths = buildPaths(profile, tempDir);
    await fs.writeFile(paths.sourcePath, code, "utf8");

    const context = { ...paths, tempDir };
    const compileCandidates = profile.getCompileCandidates ? profile.getCompileCandidates(context) : [];

    if (compileCandidates.length > 0) {
      const compileResult = await runAvailableCandidate(compileCandidates, {
        cwd: tempDir,
        timeoutMs: COMPILE_TIMEOUT_MS,
        outputLimit: MAX_OUTPUT,
      });

      if (compileResult.timedOut) {
        return {
          ...compileResult,
          stdout: "",
          stderr: "",
          compile_output: "Compilation timed out",
          compileFailed: true,
        };
      }

      if (compileResult.outputLimitExceeded) {
        return {
          ...compileResult,
          stdout: "",
          stderr: "",
          compile_output: "Compiler output limit exceeded",
          compileFailed: true,
        };
      }

      if (compileResult.exitCode !== 0) {
        return {
          ...compileResult,
          stdout: "",
          stderr: "",
          compile_output: compileResult.stderr || compileResult.stdout || "Compilation failed",
          compileFailed: true,
        };
      }
    }

    const runCandidates = profile.getRunCandidates(context);
    return await runAvailableCandidate(runCandidates, {
      cwd: tempDir,
      input,
      timeoutMs: Number(timeLimit) || 2000,
      outputLimit: MAX_OUTPUT,
    });
  } finally {
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
        console.log("CODE_EXEC_TEMP_CLEANUP", { tempDir, ok: true, durationMs: Date.now() - startedAt });
      } catch (error) {
        console.warn("CODE_EXEC_TEMP_CLEANUP_FAILED", {
          tempDir,
          error: error.message,
          durationMs: Date.now() - startedAt,
        });
      }
    }
  }
};

module.exports = {
  MAX_OUTPUT,
  runOne,
};
