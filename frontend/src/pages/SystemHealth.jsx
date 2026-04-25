import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import axios from "axios";

const BASE_URL = import.meta.env.VITE_APP_BASE_URL || "http://localhost:5000/api";

const SystemHealth = () => {
  const { token } = useSelector((state) => state.auth);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMetrics = async () => {
    try {
      const response = await axios.get(`${BASE_URL}/v1/system/queue-metrics`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (response.data.success) {
        setMetrics(response.data.data);
        setError(null);
      }
    } catch (err) {
      console.error("Failed to fetch system metrics", err);
      setError("Failed to stream system health metrics. Ensure you have admin privileges and the server is responsive.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    // Setup long-polling for real-time vibe
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, [token]);

  if (loading && !metrics) {
    return (
      <div className="p-6 text-richblack-5 max-w-5xl mx-auto w-full min-h-screen">
        <h1 className="text-3xl font-semibold mb-2">System Health & Diagnostics</h1>
        <div className="animate-pulse h-48 bg-richblack-800 rounded-lg mt-8"></div>
      </div>
    );
  }

  const loadPercentage = metrics ? Math.round((metrics.running / metrics.maxConcurrent) * 100) : 0;
  const isOverloaded = metrics && metrics.queued > 0;

  return (
    <div className="p-6 text-richblack-5 max-w-5xl mx-auto w-full min-h-screen">
      <div className="flex justify-between items-center mb-6 border-b border-richblack-700 pb-4">
        <div>
          <h1 className="text-3xl font-semibold mb-2">System Health & Diagnostics</h1>
          <p className="text-richblack-300 text-sm">Real-time code execution server metrics and load tracking.</p>
        </div>
        <div className="flex items-center gap-2">
           <span className="relative flex h-3 w-3">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${error ? 'bg-red-400' : 'bg-caribbeangreen-400'}`}></span>
            <span className={`relative inline-flex rounded-full h-3 w-3 ${error ? 'bg-red-500' : 'bg-caribbeangreen-500'}`}></span>
          </span>
          <span className="text-sm font-bold text-richblack-200">
            {error ? "API Disconnected" : "Live Stream"}
          </span>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-100 p-4 rounded-lg mb-8">
          <p>⚠️ {error}</p>
        </div>
      )}

      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-richblack-800 p-6 rounded-lg border border-richblack-700 shadow-sm relative overflow-hidden group">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg blur opacity-0 group-hover:opacity-20 transition duration-500"></div>
            <p className="text-sm text-richblack-300 font-bold uppercase tracking-wider mb-2 relative z-10">Active Containers</p>
            <p className="text-4xl font-black text-richblack-5 relative z-10">{metrics.running} <span className="text-lg text-richblack-400 font-normal">/ {metrics.maxConcurrent}</span></p>
          </div>
          
          <div className={`bg-richblack-800 p-6 rounded-lg border border-richblack-700 shadow-sm relative overflow-hidden group ${metrics.queued > 0 ? 'border-yellow-600/50' : ''}`}>
            {metrics.queued > 0 && <div className="absolute -inset-1 bg-gradient-to-r from-yellow-600 to-red-600 rounded-lg blur opacity-20 animate-pulse"></div>}
            <p className="text-sm text-richblack-300 font-bold uppercase tracking-wider mb-2 relative z-10">Pending Queue</p>
            <p className={`text-4xl font-black relative z-10 ${metrics.queued > 0 ? 'text-yellow-400' : 'text-richblack-5'}`}>
              {metrics.queued} <span className="text-lg text-richblack-400 font-normal">/ {metrics.maxQueue} cap</span>
            </p>
          </div>

          <div className="bg-richblack-800 p-6 rounded-lg border border-richblack-700 shadow-sm col-span-1 md:col-span-2 relative overflow-hidden">
             <div className="flex justify-between items-end mb-2">
                <p className="text-sm text-richblack-300 font-bold uppercase tracking-wider">Cluster Load Utilization</p>
                <p className={`text-xl font-bold ${loadPercentage >= 80 ? 'text-red-400' : loadPercentage >= 50 ? 'text-yellow-400' : 'text-caribbeangreen-400'}`}>
                  {loadPercentage}%
                </p>
             </div>
             <div className="w-full bg-richblack-900 border border-richblack-700 h-4 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-700 ${loadPercentage >= 80 ? 'bg-red-500' : loadPercentage >= 50 ? 'bg-yellow-500' : 'bg-caribbeangreen-500'}`}
                  style={{ width: `${Math.min(loadPercentage, 100)}%` }}
                ></div>
             </div>
             {isOverloaded && (
               <p className="text-xs text-yellow-500 mt-3 flex items-center gap-1 font-bold">
                 <span className="animate-spin duration-1000">⏳</span> System is under heavy load. Requests are queuing.
               </p>
             )}
          </div>
        </div>
      )}

      <div className="bg-richblack-800 border border-richblack-700 rounded-lg p-6">
        <h3 className="text-lg font-bold text-white mb-4">Architecture Overview</h3>
        <p className="text-richblack-300 text-sm leading-relaxed mb-4">
          The Sarthi execution engine utilizes an asynchronous FIFO queue pattern. Active execution containers are clamped to <strong className="text-white">{metrics?.maxConcurrent || "N/A"}</strong> to prevent CPU thrashing.
          When parallel submissions exceed this concurrent threshold, subsequent code executions wait in a buffer queue. 
        </p>
        <div className="bg-richblack-900 p-4 rounded text-xs font-mono text-caribbeangreen-300 border border-richblack-700">
          <span className="text-pink-400">const</span> queueConfig = &#123;<br/>
          &nbsp;&nbsp;<span className="text-blue-300">max_concurrent_runners</span>: {metrics?.maxConcurrent || 0},<br/>
          &nbsp;&nbsp;<span className="text-blue-300">max_queue_depth</span>: {metrics?.maxQueue || 0},<br/>
          &nbsp;&nbsp;<span className="text-blue-300">overflow_strategy</span>: <span className="text-yellow-300">&quot;REJECT_429&quot;</span><br/>
          &#125;;
        </div>
      </div>
    </div>
  );
};

export default SystemHealth;
