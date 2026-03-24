import React, { useState, useRef, useEffect } from "react";
import { matchPath, useLocation } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

// ── helpers ──────────────────────────────────────────────
const STORAGE_KEY = "all_chats";

function loadChats() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveChats(chats) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
}

function createChatObject() {
  return { id: Date.now().toString(), title: "New Chat", messages: [] };
}

// Derive a readable title from first user message
function getChatTitle(chat) {
  const firstUser = chat.messages.find((m) => m.sender === "user");
  if (!firstUser) return chat.title;
  return firstUser.text.length > 28
    ? firstUser.text.slice(0, 28) + "…"
    : firstUser.text;
}

// ── component ─────────────────────────────────────────────
export default function SiteChat() {
  const chatApiUrl = `${import.meta.env.VITE_APP_BASE_URL}/api/chat`;
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const [chats, setChats] = useState(() => {
    const stored = loadChats();
    return stored.length > 0 ? stored : [createChatObject()];
  });

  const [currentChatId, setCurrentChatId] = useState(
    () => loadChats()[0]?.id ?? createChatObject().id
  );

  const [input, setInput] = useState("");
  const chatRef = useRef();
  const messagesEndRef = useRef();

  // ── typing effect ──────────────────────────────────────
  const [isWaiting, setIsWaiting] = useState(false);   // waiting for API
  const [typingText, setTypingText] = useState(null);   // full AI reply being animated
  const [displayedLen, setDisplayedLen] = useState(0);  // chars revealed so far

  // Reveal chars incrementally; self-terminates when done
  useEffect(() => {
    if (!typingText) return;
    if (displayedLen >= typingText.length) {
      setTypingText(null);
      return;
    }
    const t = setTimeout(
      () => setDisplayedLen((n) => Math.min(n + 4, typingText.length)),
      12 // ms per tick — adjust for slower/faster reveal
    );
    return () => clearTimeout(t);
  }, [typingText, displayedLen]);

  // Persist chats to localStorage
  useEffect(() => {
    saveChats(chats);
  }, [chats]);

  // Auto-scroll to bottom on new messages, typing indicator, and reveal ticks
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats, currentChatId, isWaiting, displayedLen]);

  // Sync currentChatId if active chat was deleted
  useEffect(() => {
    if (!chats.find((c) => c.id === currentChatId) && chats.length > 0) {
      setCurrentChatId(chats[0].id);
    }
  }, [chats, currentChatId]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (chatRef.current && !chatRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── derived ────────────────────────────────────────────
  const currentChat = chats.find((c) => c.id === currentChatId);
  const messages = currentChat?.messages ?? [];
  const courseMatch =
    matchPath("/view-course/:courseId/*", location.pathname) ||
    matchPath("/courses/:courseId", location.pathname) ||
    matchPath("/quiz/:courseId", location.pathname) ||
    matchPath("/dashboard/edit-course/:courseId", location.pathname);
  const courseId = courseMatch?.params?.courseId ?? null;

  // ── helpers ────────────────────────────────────────────
  function updateMessages(updater) {
    setChats((prev) =>
      prev.map((c) =>
        c.id === currentChatId ? { ...c, messages: updater(c.messages) } : c
      )
    );
  }

  function createNewChat() {
    const newChat = createChatObject();
    setChats((prev) => [newChat, ...prev]);
    setCurrentChatId(newChat.id);
    setInput("");
  }

  async function sendMessage() {
    const message = input.trim();
    if (!message || isWaiting || typingText) return; // prevent double-send while animating
    updateMessages((prev) => [...prev, { sender: "user", text: message }]);
    setInput("");
    setIsWaiting(true);

    try {
      const res = await fetch(chatApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          history: messages,
          courseId,
        }),
      });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      const reply = data.reply ?? "No response.";
      // Save full text to storage immediately so it persists on refresh
      updateMessages((prev) => [...prev, { sender: "ai", text: reply }]);
      // Then animate the reveal
      setDisplayedLen(0);
      setTypingText(reply);
    } catch {
      const errMsg = "Server error. Please try again.";
      updateMessages((prev) => [...prev, { sender: "ai", text: errMsg }]);
      setDisplayedLen(0);
      setTypingText(errMsg);
    } finally {
      setIsWaiting(false);
    }
  }

  // ── render ─────────────────────────────────────────────
  return (
    <div className="fixed bottom-5 right-5 z-50">
      {/* Toggle Button */}
      {!open && (
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg"
          onClick={() => setOpen(true)}
        >
          Chat
        </button>
      )}

      {/* Chat Window */}
      {open && (
        <div
          ref={chatRef}
          className="flex w-[520px] h-[420px] bg-white rounded-lg shadow-xl overflow-hidden border border-gray-200"
        >
          {/* ── Sidebar ── */}
          <div className="w-40 bg-gray-100 border-r border-gray-200 flex flex-col">
            {/* New Chat button */}
            <button
              onClick={createNewChat}
              className="m-2 py-1 px-2 bg-blue-600 text-white text-xs rounded font-semibold hover:bg-blue-700"
            >
              + New Chat
            </button>

            {/* Chat list */}
            <div className="flex-1 overflow-y-auto">
              {chats.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCurrentChatId(c.id)}
                  className={`w-full text-left px-3 py-2 text-xs truncate border-b border-gray-200 ${
                    c.id === currentChatId
                      ? "bg-blue-100 text-blue-700 font-semibold"
                      : "text-gray-700 hover:bg-gray-200"
                  }`}
                  title={getChatTitle(c)}
                >
                  {getChatTitle(c)}
                </button>
              ))}
            </div>
          </div>

          {/* ── Main Panel ── */}
          <div className="flex flex-col flex-1 min-w-0">
            {/* Header */}
            <div className="flex justify-between items-center bg-blue-600 text-white px-4 py-2 shrink-0">
              <h2 className="font-semibold text-sm truncate">
                {getChatTitle(currentChat ?? { title: "Chat", messages: [] })}
              </h2>
              <button onClick={() => setOpen(false)}>✖</button>
            </div>

            {/* Messages */}
            <div className="flex-1 p-2 overflow-y-auto space-y-2">
              {messages.length === 0 && (
                <p className="text-gray-400 text-xs text-center mt-4">
                  Start a conversation…
                </p>
              )}
              {(() => {
                // Find index of last AI message so we can animate it
                const lastAiIdx = messages.reduce(
                  (acc, m, i) => (m.sender === "ai" ? i : acc),
                  -1
                );
                return messages.map((msg, idx) => {
                  // Determine display text: animate only the latest AI message
                  const isLastAi = idx === lastAiIdx;
                  const displayText =
                    isLastAi && typingText
                      ? msg.text.slice(0, displayedLen)
                      : msg.text;

                  return (
                    <div
                      key={idx}
                      className={`p-2 rounded-md text-xs max-w-[90%] ${
                        msg.sender === "user"
                          ? "bg-blue-100 ml-auto text-right"
                          : "bg-gray-200 text-left"
                      }`}
                    >
                      {msg.sender === "user" ? (
                        displayText
                      ) : (
                        <div className="chat-ai-response">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              code({ node, inline, className, children, ...props }) {
                                const match = /language-(\w+)/.exec(className || "");
                                return !inline ? (
                                  <SyntaxHighlighter
                                    style={oneDark}
                                    language={match ? match[1] : "text"}
                                    PreTag="div"
                                    customStyle={{
                                      borderRadius: "6px",
                                      fontSize: "0.72rem",
                                      margin: "0.4rem 0",
                                      padding: "0.75rem",
                                    }}
                                    {...props}
                                  >
                                    {String(children).replace(/\n$/, "")}
                                  </SyntaxHighlighter>
                                ) : (
                                  <code
                                    className="bg-gray-300 px-1 rounded font-mono text-[11px]"
                                    {...props}
                                  >
                                    {children}
                                  </code>
                                );
                              },
                            }}
                          >
                            {displayText}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}

              {/* "AI is typing..." indicator */}
              {(isWaiting || typingText) && (
                <div className="bg-gray-200 text-gray-500 text-xs px-3 py-2 rounded-md max-w-[60%] italic animate-pulse">
                  AI is typing…
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex p-2 border-t border-gray-300 shrink-0">
              <input
                className="flex-1 p-1 border rounded-md text-sm"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Type your message…"
              />
              <button
                className="ml-2 px-3 py-1 bg-blue-600 text-white rounded-md text-sm"
                onClick={sendMessage}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
