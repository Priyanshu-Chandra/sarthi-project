export default function ResumeButton({ openInNewTab = true, className = "" }) {
  const url = "https://resumind-ten.vercel.app/";

  return (
    <a
      href={url}
      target={openInNewTab ? "_blank" : "_self"}
      rel={openInNewTab ? "noopener noreferrer" : undefined}
      className={`
        inline-flex items-center gap-3 px-5 py-3 rounded-md font-semibold 
        transition-all duration-200 active:translate-y-[1px]
        bg-[#121212] text-[#64B5F6] hover:bg-[#1E1E1E] 
        shadow-sm border border-[#1F1F1F]
        ${className}
      `}
    >
      <span>Wanna analyze your resume?<br></br>
         Click here</span>

      <svg xmlns="http://www.w3.org/2000/svg" 
        className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3h7v7M21 3L10 14" />
      </svg>
    </a>
  );
}
