import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { getSubmissionHistory } from "../../services/operations/codingApi";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";

function SubmissionHistory() {
  const { token } = useSelector((state) => state.auth);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      const res = await getSubmissionHistory(token);
      if (res) {
        setHistory(res);
      }
      setLoading(false);
    };
    fetchHistory();
  }, [token]);

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="w-full p-6 max-w-6xl mx-auto">
      <nav className="text-sm text-richblack-300 mb-6 flex gap-2">
        <Link to="/dashboard/my-profile" className="hover:text-yellow-50">Dashboard</Link>
        <span>/</span>
        <Link to="/dashboard/coding-practice" className="hover:text-yellow-50">Coding Practice</Link>
        <span>/</span>
        <span className="text-yellow-50">Submission History</span>
      </nav>

      <h1 className="text-3xl font-semibold mb-6 text-richblack-5">My Submissions</h1>

      <div className="bg-richblack-800 rounded-lg border border-richblack-700 overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-richblack-200">
             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-50 mr-3"></div>
             Loading history...
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-richblack-700 text-richblack-100 border-b border-richblack-600">
              <tr>
                <th className="p-4 font-semibold w-10"></th>
                <th className="p-4 font-semibold">Date</th>
                <th className="p-4 font-semibold">Problem</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold">Language</th>
                <th className="p-4 font-semibold">Time</th>
                <th className="p-4 font-semibold">Memory</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-12 text-center text-richblack-300">
                    No submissions found yet. Time to start coding!
                  </td>
                </tr>
              ) : (
                history.map((sub) => (
                  <React.Fragment key={sub._id}>
                    <tr 
                      className="border-b border-richblack-700 hover:bg-richblack-700/50 transition-colors cursor-pointer"
                      onClick={() => toggleExpand(sub._id)}
                    >
                      <td className="p-4 text-richblack-300">
                        {expandedId === sub._id ? <FiChevronUp /> : <FiChevronDown />}
                      </td>
                      <td className="p-4 text-richblack-200 text-sm">
                        {new Date(sub.createdAt).toLocaleString()}
                      </td>
                      <td className="p-4 font-medium text-richblack-5">
                        {sub.problemId ? sub.problemId.title : "Unknown Problem"}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          sub.status === 'Accepted' ? 'bg-caribbeangreen-900 text-caribbeangreen-100' :
                          'bg-pink-900 text-pink-100'
                        }`}>
                          {sub.status}
                        </span>
                      </td>
                      <td className="p-4 text-richblack-200 capitalize w-20">{sub.language}</td>
                      <td className="p-4 text-richblack-200">{sub.executionTime || "-"}</td>
                      <td className="p-4 text-richblack-200">{sub.memory || "-"}</td>
                    </tr>
                    
                    {expandedId === sub._id && (
                      <tr className="bg-richblack-900 border-b border-richblack-700">
                        <td colSpan="7" className="p-6">
                          <div className="flex flex-col gap-4 animate-fadeIn">
                             {/* Code Section */}
                             <div>
                               <p className="text-xs text-richblack-400 font-bold uppercase tracking-widest mb-2">Submitted Code</p>
                               <pre className="bg-richblack-800 p-4 rounded-lg border border-richblack-700 text-sm font-mono text-richblack-100 overflow-x-auto">
                                 {sub.code || "No code available"}
                               </pre>
                             </div>
                             
                             {/* Failed Test Section */}
                             {sub.failedTest && sub.status !== "Accepted" && (
                               <div className="bg-pink-900/10 border border-pink-900/30 rounded-lg p-4">
                                 <p className="text-xs text-pink-400 font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-pink-500"></span>
                                    Failed Test Case #{sub.failedTest.testIndex !== undefined ? sub.failedTest.testIndex + 1 : "?"}
                                 </p>
                                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                   <div>
                                     <p className="text-[10px] text-richblack-400 uppercase font-bold mb-1">Input</p>
                                     <pre className="bg-richblack-800 p-2 rounded border border-richblack-700 text-xs text-richblack-200 overflow-x-auto">{sub.failedTest.input}</pre>
                                   </div>
                                   <div>
                                     <p className="text-[10px] text-caribbeangreen-400 uppercase font-bold mb-1">Expected Output</p>
                                     <pre className="bg-richblack-800 p-2 rounded border border-caribbeangreen-900/30 text-xs text-caribbeangreen-200 overflow-x-auto">{sub.failedTest.expected}</pre>
                                   </div>
                                   <div>
                                     <p className="text-[10px] text-pink-400 uppercase font-bold mb-1">Your Output</p>
                                     {sub.failedTest.error ? (
                                        <pre className="bg-pink-900/20 p-2 rounded border border-pink-900/40 text-xs text-pink-400 overflow-x-auto">{sub.failedTest.error}</pre>
                                     ) : (
                                        <pre className="bg-pink-900/20 p-2 rounded border border-pink-900/40 text-xs text-pink-200 overflow-x-auto">{sub.failedTest.actual || "No Output"}</pre>
                                     )}
                                   </div>
                                 </div>
                               </div>
                             )}

                             {sub.status === "Accepted" && (
                               <div className="bg-caribbeangreen-900/10 border border-caribbeangreen-900/30 rounded-lg p-3 text-center">
                                 <p className="text-sm font-bold text-caribbeangreen-300">🎉 All test cases passed successfully!</p>
                               </div>
                             )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default SubmissionHistory;
