import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell
} from "recharts";

/* eslint-disable react/prop-types */
const FailedQuestionsChart = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-[#1f2937] p-4 rounded-2xl shadow-md h-full min-h-[350px] flex flex-col items-center justify-center">
        <h2 className="text-white text-lg mb-2">Most Failed Questions</h2>
        <p className="text-gray-400">No failed questions recorded yet.</p>
      </div>
    );
  }

  const formatted = data.map((q, index) => {
    let shortName = `Q${index + 1}`;
    if (q.questionText && q.questionText.length > 0) {
      shortName = q.questionText.slice(0, 15) + (q.questionText.length > 15 ? "..." : "");
    }
    return {
      name: shortName,
      questionText: q.questionText,
      type: q.type || "[MCQ]",
      failureRate: q.failureRate
    };
  });

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const qd = payload[0].payload;
      return (
        <div className="bg-gray-800 p-3 border border-gray-600 rounded-md shadow-lg max-w-xs">
          <div className="flex items-center justify-between mb-1">
             <p className="text-white font-bold">{label}</p>
             <span className={`text-[10px] font-black px-2 py-0.5 rounded ${
               qd.type === "[CODING]" ? "bg-pink-900/40 text-pink-300 border border-pink-700/50" : "bg-purple-900/40 text-purple-300 border border-purple-700/50"
             }`}>{qd.type}</span>
          </div>
          <p className="text-gray-300 text-xs mb-2 line-clamp-3 leading-relaxed">
            {qd.questionText || "Unknown/Deleted Question"}
          </p>
          <div className="w-full bg-gray-700 rounded-full h-1.5 mb-1">
             <div className="bg-red-500 h-1.5 rounded-full" style={{ width: `${qd.failureRate}%` }}></div>
          </div>
          <p className="text-red-400 font-bold text-[11px] text-right">{qd.failureRate}% Failed</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-[#1f2937] p-4 rounded-2xl shadow-md h-full min-h-[350px]">
      <h2 className="text-white text-lg mb-4 text-center">
        Most Failed Questions
      </h2>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={formatted} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
          <XAxis dataKey="name" stroke="#9ca3af" axisLine={false} tickLine={false} />
          <YAxis stroke="#9ca3af" axisLine={false} tickLine={false} unit="%" />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />

          <Bar dataKey="failureRate" radius={[4, 4, 0, 0]} isAnimationActive={true}>
            {formatted.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={
                  entry.failureRate > 70 ? "#dc2626" :
                  entry.failureRate > 40 ? "#f97316" :
                  "#facc15"
                } 
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default FailedQuestionsChart;
