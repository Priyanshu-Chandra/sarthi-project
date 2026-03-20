import React from "react";

const QuestionCard = ({ question, options, selected, onSelect }) => {
  return (
    <div className="bg-gray-800 p-6 rounded-xl mb-6 text-white">
      <h2 className="text-xl font-semibold mb-4">{question}</h2>

      {options.map((opt, index) => (
        <button
          key={index}
          onClick={() => onSelect(opt)}
          className={`block w-full text-left px-4 py-2 rounded-md my-2 
          ${selected === opt ? "bg-yellow-500 text-black" : "bg-gray-700"}
          `}
        >
          {opt}
        </button>
      ))}
    </div>
  );
};

export default QuestionCard;
