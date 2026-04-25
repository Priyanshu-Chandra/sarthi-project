const MEDAL = ["🥇", "🥈", "🥉"];
const CARD_STYLES = [
  "bg-gradient-to-b from-yellow-400 to-yellow-600 text-black shadow-yellow-500/40",
  "bg-gradient-to-b from-gray-300 to-gray-400 text-black shadow-gray-400/30",
  "bg-gradient-to-b from-orange-400 to-orange-600 text-black shadow-orange-500/30"
];
const SIZES = ["scale-110 z-10", "scale-100", "scale-100"];
const ORDER = [1, 0, 2]; // visually: 2nd, 1st, 3rd

const TopThree = ({ leaders }) => {
  if (!leaders || leaders.length === 0) return null;

  // Reorder for visual podium effect: silver | gold | bronze
  const ordered = ORDER.map(i => leaders[i]).filter(Boolean);

  return (
    <div className="flex justify-center items-end gap-4 mb-10">
      {ordered.map((user, idx) => {
        const originalRank = ORDER[idx]; // 0-indexed real rank
        return (
          <div
            key={idx}
            className={`flex flex-col items-center p-5 rounded-2xl shadow-xl transition-transform duration-300 w-36 ${CARD_STYLES[originalRank]} ${SIZES[originalRank]}`}
          >
            {user.image ? (
              <img src={user.image} alt={user.name} className="w-14 h-14 rounded-full object-cover border-2 border-white/50 mb-2" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-white/30 flex items-center justify-center text-2xl mb-2">
                {user.name?.[0]?.toUpperCase() || "?"}
              </div>
            )}
            <span className="text-2xl mb-1">{MEDAL[originalRank]}</span>
            <p className="font-bold text-sm text-center leading-tight">{user.name}</p>
            <p className="text-xs mt-1 opacity-80">Lv {user.level}</p>
            <p className="font-extrabold text-lg mt-1">{user.xp} <span className="text-xs font-normal">XP</span></p>
          </div>
        );
      })}
    </div>
  );
};

export default TopThree;
