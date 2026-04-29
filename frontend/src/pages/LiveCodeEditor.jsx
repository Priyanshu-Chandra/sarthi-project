import React, { useEffect, useRef, useState } from "react";
import CodeEditor from "../components/Coding/CodeEditor";

// Professional Boilerplates matching the backend defaults
const BOILERPLATES = {
  cpp: `#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, Sarthi!" << endl;\n    return 0;\n}`,
  c: `#include <stdio.h>\n\nint main() {\n    printf("Hello, Sarthi!\\n");\n    return 0;\n}`,
  java: `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, Sarthi!");\n    }\n}`,
  python: `print("Hello, Sarthi!")`,
  javascript: `console.log("Hello, Sarthi!");`
};

const LiveCodeEditor = ({ socket, roomId, user, role }) => {
  const [code, setCode]               = useState(BOILERPLATES.cpp);
  const [language, setLanguage]       = useState("cpp");
  const [activeEditor, setActiveEditor] = useState(null);
  const [output, setOutput]           = useState("");
  const [isRunning, setIsRunning]     = useState(false);
  const [input, setInput]             = useState("");
  const [activeTab, setActiveTab]     = useState("output"); // output | input
  const [consoleWidth, setConsoleWidth] = useState(380);
  const isResizingRef                 = useRef(false);
  const debounceRef                   = useRef(null);
  const isRemoteUpdate                = useRef(false);

  // ─── Resizing Logic ──────────────────────────────────────────────────
  const startResizing = (e) => {
    e.preventDefault();
    isResizingRef.current = true;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", stopResizing);
    document.body.style.cursor = "col-resize";
  };

  const handleMouseMove = (e) => {
    if (!isResizingRef.current) return;
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth > 250 && newWidth < 800) {
      setConsoleWidth(newWidth);
    }
  };

  const stopResizing = () => {
    isResizingRef.current = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", stopResizing);
    document.body.style.cursor = "default";
  };

  // ─── Socket Listeners ──────────────────────────────────────────────────
  useEffect(() => {
    // Request fresh state on mount to prevent resetting to default code
    socket.emit("request-code-state", { roomId });

    const handleCodeState = (state) => {
      if (!state) return;
      isRemoteUpdate.current = true;

      // Smart Recovery: If the recovered code is empty or the old default, apply the boilerplate
      let finalCode = state.code || "";
      const trimmed = finalCode.trim();
      const isDefaultPlaceholder = !trimmed || 
                                   trimmed === "// Start coding..." || 
                                   trimmed === "// Loading state..." ||
                                   trimmed.startsWith("// Start coding");

      if (isDefaultPlaceholder && state.language) {
        finalCode = BOILERPLATES[state.language] || finalCode;
      }

      setCode(finalCode);
      setLanguage(state.language || "cpp");
      setActiveEditor(state.activeEditor || null);

      if (state.lastOutput) {
        const out = [
          state.lastOutput.compile_output,
          state.lastOutput.stdout,
          state.lastOutput.stderr,
          state.lastOutput.error
        ].filter(Boolean).join("\n");
        setOutput(out || "");
      }
    };
    
    const handleCodeUpdate = ({ code: newCode }) => {
      isRemoteUpdate.current = true;
      setCode(newCode);
    };
    
    const handleEditorUpdated       = ({ activeEditor }) => setActiveEditor(activeEditor);
    const handleLanguageUpdated     = ({ language }) => setLanguage(language);
    const handleCodeResult = (res) => {
      // Concatenate all output streams like a real terminal
      let combinedOutput = [
        res.compile_output,
        res.stdout,
        res.stderr,
        res.error
      ].filter(Boolean).join("\n");
      
      // Performance Guard: Truncate massive outputs (e.g. infinite loops) to keep browser responsive
      if (combinedOutput.length > 50000) {
        combinedOutput = combinedOutput.substring(0, 50000) + "\n\n... [Output Truncated: Too large for display]";
      }

      setOutput(combinedOutput || "");
      setIsRunning(false);
      setActiveTab("output"); // Auto-switch to output when result arrives
    };

    const handleReconnect = () => {
      setIsRunning(false);
      socket.emit("request-code-state", { roomId });
    };

    socket.on("CODE_STATE",           handleCodeState);
    socket.on("code-update",          handleCodeUpdate);
    socket.on("code-editor-updated",  handleEditorUpdated);
    socket.on("code-language-updated",handleLanguageUpdated);
    socket.on("code-result",          handleCodeResult);
    socket.on("reconnect",            handleReconnect);

    // 🔥 CRITICAL: Immediate request on mount to ensure boilerplate renders
    socket.emit("request-code-state", { roomId });

    return () => {
      socket.off("CODE_STATE",            handleCodeState);
      socket.off("code-update",           handleCodeUpdate);
      socket.off("code-editor-updated",   handleEditorUpdated);
      socket.off("code-language-updated", handleLanguageUpdated);
      socket.off("code-result",           handleCodeResult);
      socket.off("reconnect",             handleReconnect);
    };
  }, [socket, roomId]);

  // ─── Handlers ──────────────────────────────────────────────────────────
  const isEditable = role === "instructor" || activeEditor === user?._id?.toString();

  const handleCodeChange = (value) => {
    setCode(value);
    
    if (isRemoteUpdate.current) {
      isRemoteUpdate.current = false;
      return;
    }
    
    if (!isEditable) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      socket.emit("code-change", { roomId, code: value });
    }, 200);
  };

  const handleLanguageChange = (lang) => {
    setLanguage(lang);
    if (!isEditable) return;

    // Smart Boilerplate: If the current code is just the old boilerplate (or empty/comments), 
    // swap it for the new language's boilerplate.
    const trimmed = code.trim();
    const isDefault = !trimmed || 
                      Object.values(BOILERPLATES).some(bp => bp.trim() === trimmed) || 
                      trimmed.startsWith("// Start coding") || 
                      trimmed.startsWith("// Loading state");

    if (isDefault) {
      const newCode = BOILERPLATES[lang] || `// Start coding in ${lang}...\n`;
      setCode(newCode);
      socket.emit("code-change", { roomId, code: newCode });
    }

    socket.emit("code-language-change", { roomId, language: lang });
  };

  const runCode = () => {
    if (!isEditable) return;
    setIsRunning(true);
    setOutput("");
    socket.emit("run-code", { roomId, input });
  };

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full w-full bg-[#0a0a10] overflow-hidden select-none">
      {/* ── EDITOR PANEL ── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 bg-[#0f0f1a] border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className={`h-2 w-2 rounded-full ${activeEditor ? "bg-emerald-500 animate-pulse" : "bg-richblack-600"}`} />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
              {activeEditor
                ? activeEditor === user?._id?.toString() ? "⚡ You are editing" : "👤 Someone is editing"
                : "⌨️ No active editor"}
            </span>
          </div>
          {/* Language selector */}
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            disabled={!isEditable}
            className="bg-richblack-800 text-white text-xs px-3 py-1.5 rounded-lg border border-white/10 outline-none disabled:opacity-40"
          >
            {["cpp", "c", "python", "java", "javascript"].map(l => (
              <option key={l} value={l}>{l.toUpperCase()}</option>
            ))}
          </select>
        </div>

        {/* Monaco Editor */}
        <div className="flex-1 overflow-hidden relative">
          <CodeEditor
            code={code}
            language={language}
            setCode={handleCodeChange}
            readOnly={!isEditable}
          />
          {!isEditable && (
             <div className="absolute top-4 right-4 z-10 px-4 py-2 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center gap-2">
                <span className="text-xs text-white/40 font-bold tracking-widest uppercase">Read Only</span>
             </div>
          )}
        </div>
      </div>

      {/* ── RESIZABLE DIVIDER ── */}
      <div 
        onMouseDown={startResizing}
        className="group relative w-1 cursor-col-resize bg-white/5 transition-colors hover:bg-indigo-500/50 active:bg-indigo-500"
      >
        <div className="absolute inset-y-0 -left-1 -right-1 z-10" />
      </div>

      {/* ── CONSOLE PANEL ── */}
      <div 
        style={{ width: `${consoleWidth}px` }}
        className="flex flex-col bg-[#07070a] transition-[width] duration-0"
      >
        {/* Run button area */}
        <div className="p-5 border-b border-white/5">
          <button
            onClick={runCode}
            disabled={!isEditable || isRunning}
            className={`w-full flex items-center justify-center gap-3 rounded-xl py-3 text-xs font-black uppercase tracking-widest transition-all shadow-xl active:scale-95 ${
              isRunning 
                ? "bg-richblack-800 text-white/20" 
                : "bg-indigo-600 text-white shadow-indigo-600/20 hover:bg-indigo-500 hover:scale-[1.02]"
            } disabled:opacity-30 disabled:cursor-not-allowed`}
          >
            {isRunning ? "⏳ Compiling..." : "▶ Run Code"}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5 bg-[#0f0f1a]">
          {[
            { id: "input", label: "⌨️ Input" },
            { id: "output", label: "📟 Output" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${
                activeTab === tab.id ? "text-white border-indigo-500 bg-white/5" : "text-white/20 border-transparent hover:text-white/40"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden relative">
          {activeTab === "input" ? (
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Standard Input (stdin)..."
              className="w-full h-full bg-[#07070a] text-white/70 text-sm p-5 outline-none resize-none font-mono placeholder:text-white/10"
            />
          ) : (
            <div className="h-full flex flex-col">
               <pre className={`flex-1 p-5 font-mono text-sm overflow-auto whitespace-pre-wrap ${
                 output?.startsWith("⚠️") || output?.toLowerCase().includes("error")
                   ? "text-pink-400" : "text-indigo-300"
               }`}>
                 {output || <span className="text-white/10 italic select-none">Output window...</span>}
               </pre>
            </div>
          )}
        </div>

        {/* Footer/Status */}
        <div className="p-4 bg-[#0a0a10] border-t border-white/5">
           <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Compiler: Sarthi Node v1.0</span>
              {isRunning && <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-ping" />}
           </div>
        </div>
      </div>
    </div>
  );
};

export default LiveCodeEditor;
