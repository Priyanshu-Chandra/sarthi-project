const STATUS_IDS = {
  "Accepted": 3,
  "Wrong Answer": 4,
  "Time Limit Exceeded": 5,
  "Compilation Error": 6,
  "Runtime Error": 11,
};

class ExecutionSystemError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "ExecutionSystemError";
    this.isSystemError = true;
    this.details = details;
  }
}

const toJudgeStatus = (description) => ({
  id: STATUS_IDS[description] || 11,
  description,
});

/**
 * normalizeOutput
 * ─────────────────────────────────────────────────────────────────────────────
 * Conservative normalization (Elite V5 Final):
 * 1. Standardize newlines (LF).
 * 2. Trim trailing spaces on each line.
 * 3. Trim trailing empty lines.
 * 4. Case-insensitive normalization ONLY for "true" and "false" strings.
 */
const normalizeOutput = (val) => {
  if (val === null || val === undefined) return "";
  
  let str = val.toString().trim();
  
  // Standardize newlines and trim trailing line-space
  str = str
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map(line => line.trimEnd())
    .join("\n")
    .replace(/\n+$/g, ""); // Remove trailing empty lines

  // Elite V5: Strict Boolean Case-Insensitivity (Safe version)
  const lowered = str.toLowerCase();
  if (lowered === "true" || lowered === "false") {
    return lowered;
  }
  
  return str; // Return raw (but line-trimmed) for everything else
};

const basePayload = (raw, status, overrides = {}) => ({
  stdout: raw.stdout || "",
  stderr: raw.stderr || "",
  compile_output: raw.compile_output || null,
  status: toJudgeStatus(status),
  time: raw.durationMs ? (raw.durationMs / 1000).toFixed(2) : null,
  memory: raw.memoryKb || null,
  appStatus: status,
  ...overrides,
});

const mapRunResult = (raw) => {
  if (raw.compileFailed) {
    return basePayload(raw, "Compilation Error", {
      stdout: "",
      stderr: "",
      compile_output: raw.compile_output || "Compilation failed",
    });
  }

  if (raw.outputLimitExceeded) {
    return basePayload(raw, "Runtime Error", {
      stderr: "Output limit exceeded",
    });
  }

  if (raw.timedOut) {
    return basePayload(raw, "Time Limit Exceeded", {
      stderr: raw.stderr || "Time Limit Exceeded",
    });
  }

  if (raw.exitCode !== 0) {
    return basePayload(raw, "Runtime Error", {
      stderr: raw.stderr || `Process exited with code ${raw.exitCode}`,
    });
  }

  if (raw.stderr) {
    return basePayload(raw, "Runtime Error");
  }

  return basePayload(raw, "Accepted");
};

const mapTestResult = (raw, expectedOutput) => {
  const mapped = mapRunResult(raw);
  if (mapped.appStatus !== "Accepted") {
    return {
      ...mapped,
      passed: false,
    };
  }

  const actual = normalizeOutput(mapped.stdout);
  const expected = normalizeOutput(expectedOutput);
  
  if (actual !== expected) {
    return {
      ...mapped,
      status: toJudgeStatus("Wrong Answer"),
      appStatus: "Wrong Answer",
      passed: false,
      actualOutput: mapped.stdout, // Return raw for fail analysis (V5 Elite)
    };
  }

  return {
    ...mapped,
    passed: true,
  };
};

module.exports = {
  ExecutionSystemError,
  mapRunResult,
  mapTestResult,
  normalizeOutput,
  toJudgeStatus,
};
