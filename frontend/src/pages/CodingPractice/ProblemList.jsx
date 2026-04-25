import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { getAllProblems } from "../../services/operations/problemApi";

function ProblemList() {
  const { token } = useSelector((state) => state.auth);
  const navigate = useNavigate();

  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [searchTerm, setSearchTerm] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [topic, setTopic] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    // 2️⃣ Debounce Search Properly
    const timer = setTimeout(() => {
      fetchProblems();
    }, 400);

    return () => clearTimeout(timer);
  }, [searchTerm, difficulty, topic, page, token]);

  const fetchProblems = async () => {
    setLoading(true);
    const filters = {
      search: searchTerm,
      difficulty,
      topic,
      page,
    };
    const res = await getAllProblems(token, filters);
    if (res) {
      setProblems(res.data || []);
      if (res.totalPages) setTotalPages(res.totalPages);
    }
    setLoading(false);
  };

  return (
    <div className="w-full p-6">
      <nav className="text-sm text-richblack-300 mb-6 flex gap-2">
        <Link to="/dashboard/my-profile" className="hover:text-yellow-50 transition-colors duration-200">Dashboard</Link>
        <span>/</span>
        <Link to="/dashboard/coding-practice" className="hover:text-yellow-50 transition-colors duration-200">Coding Practice</Link>
        <span>/</span>
        <span className="text-yellow-50">Practice Problems</span>
      </nav>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-3xl font-semibold text-richblack-5">Practice Problems</h1>
        
        {/* Filters UI */}
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <input
            type="text"
            placeholder="Search problems..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-64 bg-richblack-800 rounded-lg border border-richblack-700 px-4 py-2 text-richblack-5 focus:outline-none focus:border-yellow-50"
          />
          
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="w-full sm:w-auto bg-richblack-800 rounded-lg border border-richblack-700 px-4 py-2 text-richblack-5 focus:outline-none focus:border-yellow-50"
          >
            <option value="">All Difficulties</option>
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>
          
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full sm:w-auto bg-richblack-800 rounded-lg border border-richblack-700 px-4 py-2 text-richblack-5 focus:outline-none focus:border-yellow-50"
          >
            <option value="">All Topics</option>
            <option value="Arrays">Arrays</option>
            <option value="Strings">Strings</option>
            <option value="Math">Math</option>
            <option value="Graph">Graph</option>
            <option value="Searching">Searching</option>
          </select>
        </div>
      </div>

      <div className="bg-richblack-800 rounded-lg border border-richblack-700 overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-richblack-200">
             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-50 mr-3"></div>
             Loading problems...
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <table className="w-full text-left">
              <thead className="bg-richblack-700 text-richblack-100 border-b border-richblack-600">
                <tr>
                  <th className="p-4 font-semibold">Title</th>
                  <th className="p-4 font-semibold">Difficulty</th>
                  <th className="p-4 font-semibold">Topic</th>
                  <th className="p-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {problems.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="p-12 text-center text-richblack-300">
                      No problems found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  problems.map((prob) => (
                    <tr key={prob._id} className="border-b border-richblack-700 hover:bg-richblack-700/50 transition-colors">
                      <td className="p-4 font-medium text-richblack-5">{prob.title}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          prob.difficulty === 'Easy' ? 'bg-caribbeangreen-900 text-caribbeangreen-100' :
                          prob.difficulty === 'Medium' ? 'bg-yellow-900 text-yellow-100' :
                          'bg-pink-900 text-pink-100'
                        }`}>
                          {prob.difficulty}
                        </span>
                      </td>
                      <td className="p-4 text-richblack-200">{prob.topic}</td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => navigate(`/dashboard/coding-practice/problems/${prob.slug || prob._id}`)}
                          className="bg-yellow-50 text-black px-4 py-2 rounded-md font-medium hover:bg-yellow-100 transition-colors"
                        >
                          Solve
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-auto border-t border-richblack-700 p-4 flex justify-between items-center bg-richblack-800">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  className={`px-4 py-2 rounded-md font-medium transition-colors ${
                    page === 1 
                      ? "bg-richblack-700 text-richblack-400 cursor-not-allowed" 
                      : "bg-richblack-600 text-richblack-50 hover:bg-richblack-500"
                  }`}
                >
                  Previous Page
                </button>
                <span className="text-richblack-300 text-sm font-medium">
                  Page {page} of {totalPages}
                </span>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(page + 1)}
                  className={`px-4 py-2 rounded-md font-medium transition-colors ${
                    page === totalPages 
                      ? "bg-richblack-700 text-richblack-400 cursor-not-allowed" 
                      : "bg-richblack-600 text-richblack-50 hover:bg-richblack-500"
                  }`}
                >
                  Next Page
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ProblemList;
