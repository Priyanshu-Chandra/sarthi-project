
import { PieChart, Pie, Tooltip, Cell, LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts";

const COLORS = ["#10B981", "#FBBF24", "#EF4444"]; // Easy (Green), Medium (Yellow), Hard (Red)

/* eslint-disable react/prop-types */
function AnalyticsDashboard({ analytics }) {
  if (!analytics) return null;

  const {
    acceptanceRate,
    totalSubmissions,
    totalSolved,
    difficultyStats,
    weeklyActivity
  } = analytics;

  // 6️⃣ Add Empty State for Charts
  if (!analytics || totalSubmissions === 0) {
    return (
      <div className="text-richblack-300 text-center py-10">
        Start solving problems to see your analytics 📊
      </div>
    );
  }

  // Format difficulty stats to ensure they map to colors predictably
  // Mongoose _id could be 'Easy', 'Medium', 'Hard'
  const formattedDifficulty = [
    { name: 'Easy', count: difficultyStats.find(d => d._id === 'Easy')?.count || 0 },
    { name: 'Medium', count: difficultyStats.find(d => d._id === 'Medium')?.count || 0 },
    { name: 'Hard', count: difficultyStats.find(d => d._id === 'Hard')?.count || 0 },
  ].filter(d => d.count > 0);

  // Format weekly activity for readable x-axis (e.g. 'Apr 01')
  const formattedActivity = weeklyActivity.map(a => {
    const d = new Date(a._id);
    return {
      _id: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      count: a.count
    };
  });

  // Smart Behavioral Insights Logic
  const generateInsights = () => {
    let focusTip = "";
    let focusColor = "text-yellow-300";

    if (acceptanceRate < 45) {
      focusTip = "Your acceptance rate is below 45%. Take more time to step through test cases mentally before submitting to avoid edge-case failures.";
      focusColor = "text-red-400";
    } else if (formattedDifficulty.length > 0) {
       const easy = formattedDifficulty.find(d => d.name === "Easy")?.count || 0;
       const medium = formattedDifficulty.find(d => d.name === "Medium")?.count || 0;
       const hard = formattedDifficulty.find(d => d.name === "Hard")?.count || 0;
       
       if (easy > 15 && medium < 3) {
         focusTip = "You've mastered the basics! It's time to step out of your comfort zone and tackle medium difficulty programming patterns.";
         focusColor = "text-caribbeangreen-300";
       } else if (medium > 20 && hard < 2) {
         focusTip = "Great progress on medium problems. Start incorporating hard algorithmic challenges to prepare for top-tier interviews.";
         focusColor = "text-pink-300";
       } else {
         focusTip = "You are maintaining a healthy, balanced problem-solving diet. Keep your streak alive!";
         focusColor = "text-caribbeangreen-300";
       }
    }
    return { tip: focusTip, color: focusColor };
  };

  const insight = generateInsights();

  return (
    <div className="flex flex-col gap-6">
      {/* Top Stats */}
      {/* 9️⃣ Optional Advanced Metric: Problems Solved */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-richblack-700 p-4 rounded-md text-center border border-richblack-600">
          <p className="text-sm text-richblack-200 mb-1">Total Submissions</p>
          <p className="text-3xl font-bold tracking-tight text-richblack-5">{totalSubmissions}</p>
        </div>
        <div className="bg-richblack-700 p-4 rounded-md text-center border border-richblack-600">
          <p className="text-sm text-richblack-200 mb-1">Unique Solved</p>
          <p className="text-3xl font-bold tracking-tight text-richblack-5">{totalSolved}</p>
        </div>
        <div className="bg-richblack-700 p-4 rounded-md text-center border border-richblack-600">
          <p className="text-sm text-richblack-200 mb-1">Acceptance Rate</p>
          <p className="text-3xl font-bold tracking-tight text-caribbeangreen-300">{acceptanceRate}%</p>
        </div>
        <div className="bg-richblack-700 p-4 rounded-md text-center border border-richblack-600">
          <p className="text-sm text-richblack-200 mb-1">Longest Streak</p>
          <p className="text-3xl font-bold tracking-tight text-yellow-100">{analytics.longestStreak || 0}d</p>
        </div>
      </div>

      {insight.tip && (
        <div className="bg-richblack-900 border border-richblack-700 p-4 rounded-lg flex items-start gap-4">
          <div className="text-2xl mt-1">💡</div>
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-richblack-300">Learning Insight</h4>
            <p className={`text-sm mt-1 leading-relaxed ${insight.color}`}>
              {insight.tip}
            </p>
          </div>
        </div>
      )}

      {/* Charts Box */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-richblack-900/50 p-6 rounded-md">
        
        {/* Pie Chart (Difficulty) */}
        <div className="flex flex-col items-center">
          <h3 className="text-lg font-semibold text-richblack-100 mb-4">Difficulty Distribution</h3>
          {formattedDifficulty.length > 0 ? (
            <div className="h-[250px] w-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={formattedDifficulty}
                    dataKey="count"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={100}
                    stroke="none"
                  >
                    {formattedDifficulty.map((entry, index) => (
                      <Cell 
                        key={index} 
                        fill={entry.name === 'Easy' ? COLORS[0] : entry.name === 'Medium' ? COLORS[1] : COLORS[2]} 
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                     contentStyle={{ backgroundColor: '#161D29', borderColor: '#2C333F', color: '#fff' }}
                     itemStyle={{ color: '#fff' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* 7️⃣ Improve Difficulty Chart UX */}
              <div className="flex justify-center gap-4 mt-2 text-sm">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-caribbeangreen-400"></span> Easy</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-400"></span> Medium</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-pink-400"></span> Hard</span>
              </div>
            </div>
          ) : (
             <div className="h-[250px] w-[250px] flex items-center justify-center text-richblack-300">No Data</div>
          )}
        </div>

        {/* Line Chart (Weekly Trends) */}
        <div className="flex flex-col items-center w-full">
          <h3 className="text-lg font-semibold text-richblack-100 mb-4">Submission Trends (90 Days)</h3>
          {formattedActivity.length > 0 ? (
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={formattedActivity} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  {/* 5️⃣ Improve Weekly Chart UX */}
                  <XAxis 
                    dataKey="_id" 
                    stroke="#424854" 
                    tick={{fill: '#999DAA', fontSize: 10}} 
                    interval="preserveStartEnd" 
                  />
                  <YAxis stroke="#424854" tick={{fill: '#999DAA', fontSize: 10}} allowDecimals={false} />
                  <Tooltip 
                     contentStyle={{ backgroundColor: '#161D29', borderColor: '#2C333F', color: '#fff' }}
                     itemStyle={{ color: '#34D399' }}
                  />
                  <Line type="monotone" dataKey="count" name="Submissions" stroke="#34D399" strokeWidth={3} dot={{r: 4, fill: '#34D399'}} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[250px] w-full flex items-center justify-center text-richblack-300">No Activity</div>
          )}
        </div>

      </div>
    </div>
  );
}

export default AnalyticsDashboard;
