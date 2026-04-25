import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { CODE_SNIPPETS } from "../../data/languageOptions";
import { executeCode } from "../../services/operations/codingApi";

import LanguageSelector from "../../components/Coding/LanguageSelector";
import CodeEditor from "../../components/Coding/CodeEditor";
import TerminalOutput from "../../components/Coding/TerminalOutput";
import IconBtn from "../../components/common/IconBtn";

function OnlineCompiler() {
  const { token } = useSelector((state) => state.auth);

  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState(CODE_SNIPPETS["python"]);
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [runMetrics, setRunMetrics] = useState({ time: null, memory: null });

  // Update code when language changes intentionally
  useEffect(() => {
    setCode(CODE_SNIPPETS[language] || "");
  }, [language]);

  const handleRunCode = async () => {
    if (!code) return;
    setIsLoading(true);
    setIsError(false);
    
    // We send language and code per the new API contract
    const data = {
      language,
      code,
      input
    };

    const result = await executeCode(data, token);
    
    if (result) {
        setRunMetrics({ time: result.executionTime, memory: result.memory });
        if (result.compile_output) {
            setOutput(result.compile_output);
            setIsError(true);
        } else if (result.stderr) {
            setOutput(result.stderr);
            setIsError(true);
        } else {
            setOutput(result.stdout);
            setIsError(false);
        }
    } else {
        setOutput("An error occurred during execution.");
        setIsError(true);
    }
    
    setIsLoading(false);
  };

  return (
    <div className="w-full p-6">
      {/* Breadcrumbs */}
      <nav className="text-sm text-richblack-300 mb-6 flex gap-2">
        <Link to="/dashboard/my-profile" className="hover:text-yellow-50 transition-colors duration-200">Dashboard</Link>
        <span>/</span>
        <Link to="/dashboard/coding-practice" className="hover:text-yellow-50 transition-colors duration-200">Coding Practice</Link>
        <span>/</span>
        <span className="text-yellow-50">Online Compiler</span>
      </nav>

      <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-200px)] min-h-[600px]">
        {/* Editor Section */}
        <div className="flex flex-col flex-1 gap-4">
          <div className="flex items-end justify-between">
            <LanguageSelector 
              language={language} 
              setLanguage={setLanguage} 
              setCode={setCode}
              codeSnippets={CODE_SNIPPETS}
            />
            <div className="mb-4">
              <IconBtn
                text={isLoading ? "Running..." : "Run Code"}
                onclick={handleRunCode}
                disabled={isLoading}
                customClasses={`transition-all duration-200 ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
              />
            </div>
          </div>
          
          <CodeEditor language={language} code={code} setCode={setCode} />
        </div>

        {/* Input/Output Section */}
        <div className="lg:w-[400px] w-full flex flex-col pt-12">
          <TerminalOutput 
            output={output} 
            input={input} 
            setInput={setInput} 
            isError={isError} 
            time={runMetrics.time}
            memory={runMetrics.memory}
          />
        </div>
      </div>
    </div>
  );
}

export default OnlineCompiler;
