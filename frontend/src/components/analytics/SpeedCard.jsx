const SpeedCard = ({ avgAttempts }) => {
  return (
    <div className="bg-[#1f2937] p-6 rounded-2xl shadow-md flex flex-col items-center justify-center min-h-[250px]">
      <h2 className="text-white text-lg mb-4 text-center">
        Problem Solving Speed
      </h2>

      <div className="relative flex items-center justify-center w-32 h-32 rounded-full border-4 border-[#374151]">
        <p className="text-4xl text-green-400 font-bold">
          {avgAttempts ? avgAttempts.toFixed(2) : "0.00"}
        </p>
      </div>

      <p className="text-gray-400 text-sm mt-4 text-center">
        Avg Attempts per Problem
      </p>
    </div>
  );
};

export default SpeedCard;
