const path = require("path");

const executableName = process.platform === "win32" ? "program.exe" : "program";

const pythonCandidates = (sourcePath) => {
  if (process.env.PYTHON_BIN) {
    return [
      {
        command: process.env.PYTHON_BIN,
        args: [sourcePath],
        versionArgs: ["--version"],
        label: "Python",
      },
    ];
  }

  const candidates = [
    { command: "python3", args: [sourcePath], versionArgs: ["--version"], label: "Python" },
    { command: "python", args: [sourcePath], versionArgs: ["--version"], label: "Python" },
  ];

  if (process.platform === "win32") {
    candidates.push({
      command: "py",
      args: ["-3", sourcePath],
      versionArgs: ["-3", "--version"],
      label: "Python",
    });
  }

  return candidates;
};

const pythonCompileCandidates = (sourcePath) => {
  return pythonCandidates(sourcePath).map((candidate) => ({
    ...candidate,
    args: candidate.command === "py"
      ? ["-3", "-m", "py_compile", sourcePath]
      : ["-m", "py_compile", sourcePath],
    label: `${candidate.label} syntax check`,
  }));
};

const profiles = {
  python: {
    sourceFile: "main.py",
    getCompileCandidates: ({ sourcePath }) => pythonCompileCandidates(sourcePath),
    getRunCandidates: ({ sourcePath }) => pythonCandidates(sourcePath),
  },
  c: {
    sourceFile: "main.c",
    getCompileCandidates: ({ sourcePath, outputPath }) => [
      {
        command: process.env.CC || "gcc",
        args: [sourcePath, "-O2", "-std=c11", "-o", outputPath],
        versionArgs: ["--version"],
        label: "gcc",
      },
    ],
    getRunCandidates: ({ outputPath }) => [
      {
        command: outputPath,
        args: [],
        label: "compiled C program",
      },
    ],
  },
  cpp: {
    sourceFile: "main.cpp",
    getCompileCandidates: ({ sourcePath, outputPath }) => [
      {
        command: process.env.CXX || "g++",
        args: [sourcePath, "-O2", "-std=c++17", "-o", outputPath],
        versionArgs: ["--version"],
        label: "g++",
      },
    ],
    getRunCandidates: ({ outputPath }) => [
      {
        command: outputPath,
        args: [],
        label: "compiled C++ program",
      },
    ],
  },
  java: {
    sourceFile: "Main.java",
    validateSource: (code) => {
      if (/^\s*package\s+[\w.]+\s*;/m.test(code)) {
        return "Java submissions must not declare a package. Use public class Main only.";
      }

      if (!/\bpublic\s+class\s+Main\b/.test(code)) {
        return "Java submissions must declare public class Main.";
      }
      return null;
    },
    getCompileCandidates: ({ sourcePath }) => [
      {
        command: process.env.JAVAC_BIN || "javac",
        args: [sourcePath],
        versionArgs: ["-version"],
        label: "javac",
      },
    ],
    getRunCandidates: ({ tempDir }) => [
      {
        command: process.env.JAVA_BIN || "java",
        args: ["-cp", tempDir, "Main"],
        versionArgs: ["-version"],
        label: "java",
      },
    ],
  },
  javascript: {
    sourceFile: "main.js",
    getRunCandidates: ({ sourcePath }) => [
      {
        command: process.env.NODE_BIN || "node",
        args: [sourcePath],
        versionArgs: ["--version"],
        label: "node",
      },
      {
        command: "node.exe",
        args: [sourcePath],
        versionArgs: ["--version"],
        label: "node (exe)",
      },
    ],
  },
};

const getLanguageProfile = (language) => profiles[language] || null;

const isSupportedLanguage = (language) => Boolean(getLanguageProfile(language));

const buildPaths = (profile, tempDir) => ({
  sourcePath: path.join(tempDir, profile.sourceFile),
  outputPath: path.join(tempDir, executableName),
});

module.exports = {
  buildPaths,
  getLanguageProfile,
  isSupportedLanguage,
};
