import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from "recharts";

const DifficultyChart = ({ data }) => {
  const formattedData = [
    { name: "Easy", value: data?.easy || 0 },
    { name: "Medium", value: data?.medium || 0 },
    { name: "Hard", value: data?.hard || 0 }
  ];

  const isEmpty = formattedData.every((item) => item.value === 0);

  if (isEmpty) {
    return (
      <div className="bg-richblack-800 border border-richblack-700 p-6 rounded-3xl shadow-xl h-full min-h-[250px] flex flex-col items-center justify-center">
        <h2 className="text-white text-xl font-bold mb-3 tracking-tight">Difficulty Progression</h2>
        <p className="text-richblack-300 text-sm">No problems solved yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-richblack-800 border border-richblack-700 p-6 rounded-3xl shadow-xl h-full min-h-[250px]">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-2xl">📊</span>
        <h2 className="text-white text-xl font-bold tracking-tight">
          Difficulty Progression
        </h2>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={formattedData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
          <XAxis dataKey="name" stroke="#9ca3af" axisLine={false} tickLine={false} />
          <YAxis stroke="#9ca3af" axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip 
            cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} 
            contentStyle={{ backgroundColor: '#161d29', borderColor: '#2c333f', borderRadius: '12px', color: '#f1f2ff' }}
            itemStyle={{ color: '#4ade80', fontWeight: 'bold' }}
            labelStyle={{ color: '#999daa', marginBottom: '4px' }}
          />

          <Bar 
            dataKey="value" 
            fill="url(#colorDifficulty)" 
            radius={[4, 4, 0, 0]} 
            isAnimationActive={true}
          />
          <defs>
            <linearGradient id="colorDifficulty" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.2}/>
            </linearGradient>
          </defs>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default DifficultyChart;
