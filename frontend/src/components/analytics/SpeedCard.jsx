const SpeedCard = ({ avgAttempts }) => {
  return (
    <div className="bg-richblack-800 border border-richblack-700 p-6 rounded-3xl shadow-xl flex flex-col items-center justify-center min-h-[250px] relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-caribbeangreen-600/10 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2"></div>
      
      <div className="flex flex-col items-center z-10">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-2xl">⚡</span>
          <h2 className="text-white text-xl font-bold tracking-tight">Solving Speed</h2>
        </div>

        <div className="relative flex items-center justify-center w-32 h-32 rounded-full border-4 border-caribbeangreen-600/30 shadow-[0_0_30px_rgba(6,214,160,0.15)]">
          <div className="absolute inset-2 rounded-full border-2 border-caribbeangreen-400/40 border-dashed animate-[spin_10s_linear_infinite]" />
          <p className="text-4xl text-caribbeangreen-100 font-black drop-shadow-[0_0_10px_rgba(6,214,160,0.3)]">
            {avgAttempts ? avgAttempts.toFixed(2) : "0.00"}
          </p>
        </div>

        <p className="text-richblack-300 text-sm mt-6 font-medium text-center uppercase tracking-widest">
          Avg attempts / problem
        </p>
      </div>
    </div>
  );
};

export default SpeedCard;
