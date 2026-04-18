import React from "react";
import { LANGUAGE_OPTIONS } from "../../data/languageOptions";

const LanguageSelector = ({ language, setLanguage, setCode, codeSnippets, disabled = false }) => {
  const handleChange = (e) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    // Optionally change code to default snippet when language changes
    if (codeSnippets && codeSnippets[newLang]) {
      setCode(codeSnippets[newLang]);
    }
  };

  return (
    <div className="flex flex-col gap-2 mb-4">
      <label htmlFor="language-select" className="text-sm font-medium text-richblack-200">
        Language
      </label>
      <select
        id="language-select"
        value={language}
        onChange={handleChange}
        disabled={disabled}
        className="w-full sm:w-48 bg-richblack-800 text-richblack-5 p-2 rounded-md border border-richblack-700 outline-none focus:ring-1 focus:ring-yellow-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {LANGUAGE_OPTIONS.map((lang) => (
          <option key={lang.id} value={lang.value}>
            {lang.label} ({lang.version})
          </option>
        ))}
      </select>
    </div>
  );
};

export default LanguageSelector;
