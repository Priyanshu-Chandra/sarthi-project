import React, { useState, useRef, useEffect } from "react";
import { matchPath, useLocation } from "react-router-dom";

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

  // Persist chats to localStorage
  useEffect(() => {
    saveChats(chats);
  }, [chats]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats, currentChatId]);

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
    if (!message) return;
    updateMessages((prev) => [...prev, { sender: "user", text: message }]);
    setInput("");

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
      updateMessages((prev) => [...prev, { sender: "ai", text: data.reply }]);
    } catch {
      updateMessages((prev) => [
        ...prev,
        { sender: "ai", text: "Server error. Please try again." },
      ]);
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
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-2 rounded-md text-xs max-w-[90%] ${
                    msg.sender === "user"
                      ? "bg-blue-100 ml-auto text-right"
                      : "bg-gray-200"
                  }`}
                >
                  {msg.text}
                </div>
              ))}
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
