import React from "react";
import Editor from "@monaco-editor/react";

const CodeEditor = ({ language, code, setCode, readOnly = false }) => {
  return (
    <div className="w-full h-full border border-richblack-700 rounded-lg overflow-hidden bg-[#1e1e1e]">
      <Editor
        height="100%"
        language={language === "cpp" || language === "c" ? "cpp" : language}
        value={code}
        theme="vs-dark"
        onChange={(value) => !readOnly && setCode(value)}
        options={{
          minimap: { enabled: false },
          fontSize: 16,
          wordWrap: "on",
          automaticLayout: true,
          readOnly: readOnly,
          domReadOnly: readOnly,
        }}
      />
    </div>
  );
};

export default CodeEditor;
