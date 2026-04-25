import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip
} from "recharts";

const SkillRadarChart = ({ data }) => {
  // convert backend object → array
  const formattedData = Object.keys(data || {}).map((key) => ({
    topic: key.toUpperCase(),
    value: Number((data[key] * 100).toFixed(1)) // convert to %
  })).sort((a, b) => b.value - a.value);

  const getDotColor = (value) => {
    if (value < 30) return "#ef4444";
    if (value < 70) return "#eab308";
    return "#22c55e";
  };

  const CustomDot = (props) => {
    const { cx, cy, payload } = props;
    if (!cx || !cy) return null;
    return (
      <circle cx={cx} cy={cy} r={4} fill={getDotColor(payload.value)} stroke="#1f2937" strokeWidth={1} />
    );
  };

  if (formattedData.length === 0) {
    return (
      <div className="bg-richblack-800 border border-richblack-700 p-6 rounded-3xl shadow-xl h-full flex flex-col items-center justify-center min-h-[350px]">
        <h2 className="text-white text-xl font-bold mb-3 tracking-tight">Skill Radar</h2>
        <p className="text-richblack-300 text-sm">Not enough data to display.</p>
      </div>
    );
  }

  return (
    <div className="bg-richblack-800 border border-richblack-700 p-6 rounded-3xl shadow-xl h-full min-h-[350px]">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-2xl">🕸️</span>
        <h2 className="text-white text-xl font-bold tracking-tight">Skill Radar</h2>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <RadarChart data={formattedData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
          <PolarGrid stroke="#4b5563" />
          <PolarAngleAxis dataKey="topic" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#4b5563" tick={false} axisLine={false} />

          <Radar
            name="Proficiency"
            dataKey="value"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#colorRadar)"
            fillOpacity={0.5}
            isAnimationActive={true}
            dot={<CustomDot />}
          />
          <Tooltip 
            cursor={{ stroke: 'rgba(255, 255, 255, 0.2)', strokeWidth: 1 }} 
            contentStyle={{ backgroundColor: '#161d29', borderColor: '#2c333f', borderRadius: '12px', color: '#f1f2ff' }}
            itemStyle={{ color: '#3b82f6', fontWeight: 'bold' }}
            labelStyle={{ color: '#999daa', marginBottom: '4px', fontWeight: 'bold' }}
            formatter={(value) => [`${value}%`, 'Proficiency']}
          />
          <defs>
            <linearGradient id="colorRadar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.2}/>
            </linearGradient>
          </defs>
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SkillRadarChart;
