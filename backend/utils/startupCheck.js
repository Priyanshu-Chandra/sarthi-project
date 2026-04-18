const { spawnSync } = require("child_process");

/**
 * Checks if a command exists in the environment by running it with version/help args.
 */
const checkCommand = (cmd, args = ["--version"]) => {
  try {
    const res = spawnSync(cmd, args, { windowsHide: true, timeout: 2000 });
    // Success is usually status 0. Some tools might return non-zero for --version but still exist.
    // However, for gcc/g++/java/python, status 0 is expected.
    return res.status === 0 || (res.status !== null && res.stdout.length > 0);
  } catch (err) {
    return false;
  }
};

/**
 * Validates the development/production environment for code execution.
 */
const validateEnvironment = () => {
  console.log("--- STARTUP ENVIRONMENT CHECK ---");
  
  const checks = {
    gcc: checkCommand("gcc"),
    gpp: checkCommand("g++"),
    java: checkCommand("java", ["-version"]),
    javac: checkCommand("javac", ["-version"]),
    python: checkCommand("python") || checkCommand("python3") || checkCommand("py", ["-3", "--version"]),
  };

  const missing = Object.entries(checks)
    .filter(([_, exists]) => !exists)
    .map(([name]) => name);

  if (missing.length > 0) {
    console.warn("⚠️  WARNING: Some execution tools are missing or inaccessible:", missing.join(", "));
    console.warn("Certain languages will fail to execute until these tools are installed.");
  } else {
    console.log("✅ All execution tools are verified and accessible.");
  }

  console.log("---------------------------------");

  return checks;
};

module.exports = { validateEnvironment };
