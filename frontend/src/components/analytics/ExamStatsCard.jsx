const ExamStatsCard = ({ title, value }) => {
  return (
    <div className="bg-[#1f2937] p-5 rounded-2xl shadow-md text-center flex flex-col justify-center min-h-[120px]">
      <p className="text-gray-400 text-sm">{title}</p>
      <h2 className="text-white text-3xl font-bold mt-2">{value !== undefined ? value : "-"}</h2>
    </div>
  );
};

export default ExamStatsCard;
