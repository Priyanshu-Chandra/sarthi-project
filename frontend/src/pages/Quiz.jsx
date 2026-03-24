import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";

import { fetchQuizByCourse, submitQuiz } from "../services/operations/quizAPI";

const DEFAULT_ALLOWED_TIME_SECONDS = 10 * 60;

const getSessionStorageKey = (courseId) => `test-attempt-session:${courseId}`;

const getStoredAttemptSession = (storageKey) => {
  try {
    const rawSession = sessionStorage.getItem(storageKey);

    if (!rawSession) {
      return null;
    }

    const parsedSession = JSON.parse(rawSession);

    if (
      typeof parsedSession?.startTime !== "number" ||
      typeof parsedSession?.allowedTimeSeconds !== "number" ||
      typeof parsedSession?.attemptSessionToken !== "string"
    ) {
      return null;
    }

    return parsedSession;
  } catch (error) {
    return null;
  }
};

const storeAttemptSession = (storageKey, sessionData) => {
  sessionStorage.setItem(storageKey, JSON.stringify(sessionData));
};

const clearAttemptSession = (storageKey) => {
  sessionStorage.removeItem(storageKey);
};

const getTimeTakenSeconds = (startTime) =>
  Math.max(Math.floor((Date.now() - startTime) / 1000), 0);

const getRemainingTimeSeconds = (startTime, allowedTimeSeconds) =>
  Math.max(allowedTimeSeconds - getTimeTakenSeconds(startTime), 0);

function Quiz() {
  const { courseId } = useParams();
  const { token } = useSelector((state) => state.auth);

  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [score, setScore] = useState(null);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_ALLOWED_TIME_SECONDS);
  const [timerStarted, setTimerStarted] = useState(false);
  const [quizLocked, setQuizLocked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [warning, setWarning] = useState("");
  const [startTime, setStartTime] = useState(null);
  const [allowedTimeSeconds, setAllowedTimeSeconds] = useState(
    DEFAULT_ALLOWED_TIME_SECONDS
  );
  const [attemptSessionToken, setAttemptSessionToken] = useState("");

  const hasSubmittedRef = useRef(false);
  const submitHandlerRef = useRef(null);
  const storageKey = getSessionStorageKey(courseId);

  useEffect(() => {
    loadQuiz();
  }, [courseId, token]);

  const loadQuiz = async () => {
    const result = await fetchQuizByCourse(courseId, token);

    if (!result?.quiz) {
      return;
    }

    const serverAllowedTimeSeconds =
      Number.isInteger(result.allowedTimeSeconds) &&
      result.allowedTimeSeconds > 0
        ? result.allowedTimeSeconds
        : DEFAULT_ALLOWED_TIME_SECONDS;
    const serverAttemptSession = {
      startTime:
        typeof result.startTime === "number" ? result.startTime : Date.now(),
      allowedTimeSeconds: serverAllowedTimeSeconds,
      attemptSessionToken: result.attemptSessionToken || "",
    };
    const storedAttemptSession = getStoredAttemptSession(storageKey);
    const activeAttemptSession =
      storedAttemptSession?.attemptSessionToken &&
      storedAttemptSession.allowedTimeSeconds === serverAllowedTimeSeconds
        ? storedAttemptSession
        : serverAttemptSession;
    const nextTimeLeft = getRemainingTimeSeconds(
      activeAttemptSession.startTime,
      activeAttemptSession.allowedTimeSeconds
    );

    if (activeAttemptSession.attemptSessionToken) {
      storeAttemptSession(storageKey, activeAttemptSession);
    }

    hasSubmittedRef.current = false;
    setScore(null);
    setQuizLocked(false);
    setIsSubmitting(false);
    setTabSwitchCount(0);
    setWarning("");
    setQuiz(result.quiz);
    setAnswers(new Array(result.quiz.questions.length).fill(null));
    setAllowedTimeSeconds(activeAttemptSession.allowedTimeSeconds);
    setAttemptSessionToken(activeAttemptSession.attemptSessionToken);
    setStartTime(activeAttemptSession.startTime);
    setTimeLeft(nextTimeLeft);
    setTimerStarted(true);
  };

  useEffect(() => {
    if (!timerStarted || !startTime || quizLocked) {
      return;
    }

    const updateTimer = () => {
      const remainingTime = getRemainingTimeSeconds(
        startTime,
        allowedTimeSeconds
      );

      setTimeLeft(remainingTime);

      if (remainingTime <= 0 && submitHandlerRef.current) {
        submitHandlerRef.current(true);
      }
    };

    updateTimer();

    const timer = setInterval(updateTimer, 1000);

    return () => clearInterval(timer);
  }, [allowedTimeSeconds, quizLocked, startTime, timerStarted]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitchCount((prev) => prev + 1);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const showRestrictionWarning = (message) => {
      setWarning(message);
      toast.error(message);
    };

    const handleContextMenu = (event) => {
      event.preventDefault();
      showRestrictionWarning("Right click is not allowed during the test");
    };

    const handleCopy = (event) => {
      event.preventDefault();
      showRestrictionWarning("Copy is not allowed during the test");
    };

    const handlePaste = (event) => {
      event.preventDefault();
      showRestrictionWarning("Paste is not allowed during the test");
    };

    const handleKeyDown = (event) => {
      const isCopyShortcut =
        (event.ctrlKey || event.metaKey) &&
        event.key?.toLowerCase() === "c";
      const isPasteShortcut =
        (event.ctrlKey || event.metaKey) &&
        event.key?.toLowerCase() === "v";

      if (isCopyShortcut) {
        event.preventDefault();
        showRestrictionWarning("Copy is not allowed during the test");
      }

      if (isPasteShortcut) {
        event.preventDefault();
        showRestrictionWarning("Paste is not allowed during the test");
      }
    };

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("paste", handlePaste);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("paste", handlePaste);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleOptionSelect = (questionIndex, optionIndex) => {
    if (quizLocked) {
      return;
    }

    const newAnswers = [...answers];
    newAnswers[questionIndex] = optionIndex;
    setAnswers(newAnswers);
  };

  const handleSubmit = async (isAutoSubmit = false) => {
    if (
      !quiz ||
      quizLocked ||
      hasSubmittedRef.current ||
      !attemptSessionToken ||
      !startTime
    ) {
      return;
    }

    hasSubmittedRef.current = true;
    setIsSubmitting(true);

    const timeTaken = getTimeTakenSeconds(startTime);

    if (timeTaken > allowedTimeSeconds && !isAutoSubmit) {
      toast.error("Time limit exceeded. Submitting your test.");
    }

    const data = {
      quizId: quiz._id,
      answers,
      tabSwitchCount,
      attemptSessionToken,
      timeTaken,
    };

    try {
      const result = await submitQuiz(data, token);

      if (result?.score !== undefined) {
        setScore(result.score);
        setQuizLocked(true);
        clearAttemptSession(storageKey);

        toast.success(
          isAutoSubmit || timeTaken >= allowedTimeSeconds
            ? "Time is up. Test submitted."
            : "Quiz submitted successfully"
        );
      }
    } catch (error) {
      const message =
        error?.response?.data?.message || "Something went wrong";

      toast.error(message);

      if (
        message === "Time limit exceeded" ||
        message === "Attempt session missing" ||
        message === "Attempt session expired or invalid"
      ) {
        setQuizLocked(true);
        clearAttemptSession(storageKey);
        return;
      }

      hasSubmittedRef.current = false;
      setIsSubmitting(false);
    }
  };

  submitHandlerRef.current = handleSubmit;

  const formatTime = () => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;

    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  if (!quiz) {
    return <div className="p-8 text-white">Loading Quiz...</div>;
  }

  if (score !== null) {
    return (
      <div className="flex flex-col items-center p-8 text-white">
        <div className="rounded-xl bg-richblack-800 p-8 text-center shadow-lg">
          <h1 className="mb-4 text-3xl font-bold">Quiz Result</h1>

          <p className="text-2xl text-yellow-300">
            Score: {score} / {quiz.questions.length}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-8 text-white">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">{quiz.title}</h1>

        <div className="rounded-lg bg-red-500 px-4 py-2 font-semibold">
          {formatTime()}
        </div>
      </div>

      {warning ? (
        <div className="mb-4 rounded-lg border border-yellow-500 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
          {warning}
        </div>
      ) : null}

      <div className="mb-6 h-3 w-full rounded-full bg-gray-700">
        <div
          className="h-3 rounded-full bg-yellow-400"
          style={{
            width: `${
              (answers.filter((answer) => answer !== null).length /
                quiz.questions.length) *
              100
            }%`,
          }}
        />
      </div>

      {quiz.questions.map((question, index) => (
        <div
          key={index}
          className="mb-6 rounded-lg bg-richblack-800 p-6 shadow-md"
        >
          <p className="mb-3 font-semibold">Question {index + 1}</p>

          <p className="mb-4 text-lg">{question.question}</p>

          {question.options.map((option, optionIndex) => (
            <button
              key={optionIndex}
              disabled={quizLocked}
              onClick={() => handleOptionSelect(index, optionIndex)}
              className={`mt-2 block w-full rounded-lg p-3 text-left transition ${
                answers[index] === optionIndex
                  ? "bg-yellow-400 text-black"
                  : "bg-gray-700 hover:bg-gray-600"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      ))}

      <button
        disabled={quizLocked || isSubmitting}
        onClick={() => handleSubmit(false)}
        className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold hover:bg-blue-700"
      >
        {isSubmitting ? "Submitting..." : "Submit Quiz"}
      </button>
    </div>
  );
}

export default Quiz;
