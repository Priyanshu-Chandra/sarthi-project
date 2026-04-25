import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";

import { fetchTestsByCourse } from "../services/operations/quizAPI";

function Quiz() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { token } = useSelector((state) => state.auth);

  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadTests = async () => {
      setLoading(true);
      setError("");

      try {
        const result = await fetchTestsByCourse(courseId, token);
        const availableTests = Array.isArray(result?.tests) ? result.tests : [];

        setTests(availableTests);

        if (availableTests.length === 1) {
          navigate(`/view-course/${courseId}/test/${availableTests[0]._id}`, {
            replace: true,
          });
        }
      } catch (err) {
        setError("Unable to load tests for this course.");
      } finally {
        setLoading(false);
      }
    };

    loadTests();
  }, [courseId, navigate, token]);

  const formatTime = (seconds) => {
    const mins = Math.floor((seconds || 0) / 60);
    return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
  };

  if (loading) {
    return <div className="p-8 text-white">Loading tests...</div>;
  }

  if (error) {
    return <div className="p-8 text-red-200">{error}</div>;
  }

  if (!tests.length) {
    return <div className="p-8 text-white">No tests available for this course.</div>;
  }

  return (
    <div className="mx-auto max-w-4xl p-8 text-white">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Course Tests</h1>
        <p className="mt-2 text-richblack-300">
          Select the test you want to attempt.
        </p>
      </div>

      <div className="grid gap-4">
        {tests.map((test) => (
          <button
            key={test._id}
            onClick={() => navigate(`/view-course/${courseId}/test/${test._id}`)}
            className="rounded-xl border border-richblack-700 bg-richblack-800 p-5 text-left transition hover:border-yellow-400 hover:bg-richblack-700"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">{test.title}</h2>
                <p className="mt-2 text-sm text-richblack-300">
                  {test.questionCount} question{test.questionCount !== 1 ? "s" : ""}
                </p>
              </div>

              <div className="text-right text-sm text-richblack-300">
                <p>{formatTime(test.timeLimitSeconds)}</p>
                <p className="mt-1">Max {test.maxAttempts} attempts</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default Quiz;
