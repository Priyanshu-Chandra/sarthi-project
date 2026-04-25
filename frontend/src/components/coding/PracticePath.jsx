import React from "react";
import { Link } from "react-router-dom";

function PracticePath({ problems }) {
  if (!problems || problems.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-richblack-700 bg-richblack-900 shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-richblack-700 bg-richblack-800">
          <h2 className="text-lg font-bold text-richblack-5">🎯 Recommended Practice Path</h2>
        </div>
        <div className="px-6 py-12 flex flex-col items-center justify-center text-center">
          <span className="text-4xl mb-3">🚀</span>
          <h3 className="text-richblack-5 font-bold text-lg mb-1">No recommendations yet</h3>
          <p className="text-richblack-300 text-sm max-w-sm">
            Solve more problems or take a test to unlock your personalized AI practice path.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-2xl border border-richblack-700 bg-richblack-900 shadow-xl">
      <div className="px-6 py-4 border-b border-richblack-700 bg-richblack-800">
        <h2 className="text-lg font-bold text-richblack-5">
          🎯 Recommended Practice Path
        </h2>
      </div>

      <div className="p-5 flex flex-col gap-3">
        {problems.map((p, i) => (
          <Link
            key={p._id}
            to={`/dashboard/coding-practice/problems/${p.slug}`}
            className="flex items-center justify-between bg-richblack-800 border border-richblack-700 rounded-lg px-4 py-3 hover:bg-richblack-700 transition"
          >
            <div className="flex items-center gap-3">
              <span className="text-richblack-50 text-sm font-bold bg-richblack-700 w-6 h-6 rounded-full flex items-center justify-center">
                {i + 1}
              </span>
              <span className="text-richblack-100 font-medium">
                {p.title}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {p.topic && (
                <span className="text-richblack-300 text-xs font-semibold px-2">
                  {p.topic}
                </span>
              )}
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase ${
                  p.difficulty === "Easy"
                    ? "text-emerald-400 bg-emerald-900/40 border-emerald-700/40"
                    : p.difficulty === "Medium"
                    ? "text-yellow-100 bg-yellow-900/40 border-yellow-700/40"
                    : "text-red-400 bg-red-900/40 border-red-700/40"
                }`}
              >
                {p.difficulty === "Easy" ? "Beginner Step" : p.difficulty === "Medium" ? "Intermediate Step" : "Advanced Step"}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default PracticePath;
