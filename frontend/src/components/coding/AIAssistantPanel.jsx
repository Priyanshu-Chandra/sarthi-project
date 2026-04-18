import React, { useState } from "react";
import ReactMarkdown from "react-markdown";

function AIAssistantPanel({ onClose, onAskAI, aiResponse, isAILoading }) {
  const [customQuestion, setCustomQuestion] = useState("");
  const [currentContext, setCurrentContext] = useState("");

  const quickActions = [
    { label: "Explain Error", prompt: "Please explain the error I am getting and why it occurred." },
    { label: "Give Hint", prompt: "Can you give me a small hint without revealing the solution?" },
    { label: "Optimize Code", prompt: "Could you suggest ways to optimize this code's time or space complexity?" },
    { label: "Analyze Complexity", prompt: "What are the time and space complexities of my current code?" },
  ];

  const handleCustomAsk = () => {
    if (!customQuestion.trim() || isAILoading) return;
    setCurrentContext(`Custom Question`);
    onAskAI(customQuestion);
    setCustomQuestion("");
  };

  const handleQuickAction = (action) => {
    if (isAILoading) return;
    setCurrentContext(action.label);
    onAskAI(action.prompt);
  };

  return (
    <div className="w-full bg-richblack-800 border-l border-richblack-700 flex flex-col h-full shadow-2xl relative">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-richblack-700 shrink-0">
        <h3 className="text-lg font-semibold text-richblack-5 flex items-center gap-2">
          <span>🤖</span> AI Mentor
        </h3>
        <button 
          onClick={() => {
            setCurrentContext("");
            onClose();
          }}
          className="text-richblack-300 hover:text-richblack-5 text-xl transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Recommended Actions */}
      <div className="p-4 border-b border-richblack-700 shrink-0 bg-richblack-900/40">
         <p className="text-xs text-richblack-300 uppercase tracking-wider font-semibold mb-3">Quick Actions</p>
         <div className="flex flex-wrap gap-2">
            {quickActions.map((action, idx) => (
               <button
                 key={idx}
                 onClick={() => handleQuickAction(action)}
                 disabled={isAILoading}
                 className="px-3 py-1.5 bg-richblack-700 hover:bg-richblack-600 border border-richblack-600 rounded-full text-xs font-medium text-richblack-100 transition-colors disabled:opacity-50"
               >
                 {action.label}
               </button>
            ))}
         </div>
      </div>

      {/* Response Area */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
         {isAILoading ? (
             <div className="flex flex-col items-center justify-center h-full text-richblack-300 gap-3">
                 <div className="w-8 h-8 rounded-full border-2 border-t-yellow-50 animate-spin border-richblack-600"></div>
                 <p className="text-sm font-medium animate-pulse">Consulting AI Mentor...</p>
             </div>
         ) : aiResponse ? (
             <div className="flex flex-col gap-3">
                 {currentContext && (
                     <div className="text-xs text-yellow-100 font-semibold bg-richblack-700/50 inline-block px-3 py-1 rounded-full w-max">
                         Asked: {currentContext}
                     </div>
                 )}
                 <div className="text-sm text-richblack-5 prose prose-invert max-w-none prose-sm list-decimal prose-pre:bg-richblack-900 prose-pre:border prose-pre:border-richblack-700">
                     <ReactMarkdown>{aiResponse}</ReactMarkdown>
                 </div>
             </div>
         ) : (
             <div className="flex flex-col items-center justify-center h-full text-richblack-400 text-center">
                 <span className="text-4xl mb-3">💡</span>
                 <p className="font-medium text-richblack-200">Stuck on a problem?</p>
                 <p className="text-xs mt-1">Ask the AI mentor for a hint, complexity analysis, or debugging help!</p>
             </div>
         )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-richblack-700 shrink-0 bg-richblack-900">
         <div className="flex gap-2">
           <textarea
             value={customQuestion}
             onChange={(e) => setCustomQuestion(e.target.value)}
             placeholder="Ask a custom question..."
             rows={2}
             disabled={isAILoading}
             className="flex-1 bg-richblack-800 text-sm text-richblack-5 p-2 rounded-md border border-richblack-700 outline-none focus:ring-1 focus:ring-yellow-50 resize-none custom-scrollbar"
             onKeyDown={(e) => {
               if (e.key === 'Enter' && !e.shiftKey) {
                 e.preventDefault();
                 handleCustomAsk();
               }
             }}
           />
           <button
             onClick={handleCustomAsk}
             disabled={!customQuestion.trim() || isAILoading}
             className="px-3 bg-yellow-50 text-black font-bold rounded-md hover:bg-yellow-100 disabled:opacity-50 transition-colors"
           >
             Send
           </button>
         </div>
      </div>
    </div>
  );
}

export default AIAssistantPanel;
