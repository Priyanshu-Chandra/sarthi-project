import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer
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
      <div className="bg-[#1f2937] p-4 rounded-2xl shadow-md h-full flex flex-col items-center justify-center min-h-[350px]">
        <h2 className="text-white text-lg mb-2">Skill Radar</h2>
        <p className="text-gray-400">Not enough data to display.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#1f2937] p-4 rounded-2xl shadow-md h-full min-h-[350px]">
      <h2 className="text-white text-lg mb-4 text-center">Skill Radar</h2>

      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={formattedData}>
          <PolarGrid stroke="#4b5563" />
          <PolarAngleAxis dataKey="topic" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#4b5563" tick={false} axisLine={false} />

          <Radar
            name="Skill"
            dataKey="value"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.4}
            isAnimationActive={true}
            dot={<CustomDot />}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SkillRadarChart;
