import { useEffect, useState, useCallback } from "react";
import { useSelector } from "react-redux";
import { getWeeklyLeaderboard, getMyRank } from "../../services/operations/analysisApi";
import TopThree from "../../components/leaderboard/TopThree";
import LeaderboardList from "../../components/leaderboard/LeaderboardList";
import MyRankCard from "../../components/leaderboard/MyRankCard";

const Leaderboard = () => {
  const [leaders, setLeaders] = useState([]);
  const [myRank, setMyRank] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const { token } = useSelector((state) => state.auth);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      const [leaderData, rankData] = await Promise.all([
        getWeeklyLeaderboard(token),
        getMyRank(token)
      ]);

      setLeaders(leaderData || []);
      setMyRank(rankData || null);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Leaderboard fetch error", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchData();
  }, [fetchData, token]);

  const top3 = leaders.slice(0, 3);
  const rest = leaders.slice(3);

  return (
    <div className="w-full min-h-screen bg-richblack-900 text-richblack-5 py-8 px-4 md:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">🏆 Weekly Leaderboard</h1>
            <p className="text-richblack-400 text-sm mt-1">Resets every Monday · Top 20 coders this week</p>
          </div>
          <button
            onClick={fetchData}
            className="text-xs text-richblack-400 hover:text-richblack-100 border border-richblack-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            ↻ Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col gap-6 animate-pulse">
            <div className="flex justify-center gap-4 mb-8">
              {[0,1,2].map(i => <div key={i} className="h-44 w-36 bg-richblack-700 rounded-2xl" />)}
            </div>
            {[0,1,2,3,4].map(i => <div key={i} className="h-14 bg-richblack-800 rounded-xl" />)}
          </div>
        ) : leaders.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">🚀</p>
            <p className="text-richblack-200 text-lg font-semibold">The leaderboard is empty this week!</p>
            <p className="text-richblack-400 text-sm mt-2">Be the first to solve a problem and claim the #1 spot.</p>
          </div>
        ) : (
          <>
            {/* Podium */}
            <TopThree leaders={top3} />

            {/* Rest of the list */}
            {rest.length > 0 && <LeaderboardList leaders={rest} myRank={myRank} />}

            {/* My Rank separator — shown even if not in top 20 */}
            {myRank && myRank.rank > 20 && (
              <div className="flex items-center gap-4 my-4">
                <div className="flex-1 h-px bg-richblack-700" />
                <span className="text-xs text-richblack-500 uppercase tracking-widest shrink-0">Your position</span>
                <div className="flex-1 h-px bg-richblack-700" />
              </div>
            )}

            {/* My rank card */}
            <MyRankCard data={myRank} />

            {lastUpdated && (
              <p className="text-center text-xs text-richblack-600 mt-6">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
