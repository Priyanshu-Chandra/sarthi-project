import { useEffect, useRef, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { useLocation, useNavigate, useParams } from "react-router-dom"

import "video-react/dist/video-react.css"
import { BigPlayButton, Player } from "video-react"

import { markLectureAsComplete } from "../../../services/operations/courseDetailsAPI"
import { updateCompletedLectures } from "../../../slices/viewCourseSlice"
import { setCourseViewSidebar } from "../../../slices/sidebarSlice"

import IconBtn from "../../common/IconBtn"
import { HiMenuAlt1 } from 'react-icons/hi'
import jsPDF from "jspdf"

// Notes UI icons (inline SVGs — no extra package needed)
const SparkleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.88 5.76a1 1 0 00.95.69H21l-4.94 3.58a1 1 0 00-.36 1.12L17.56 20 12 16.44 6.44 20l1.86-5.85a1 1 0 00-.36-1.12L3 9.45h6.17a1 1 0 00.95-.69L12 3z"/>
  </svg>
)

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)

const CopyIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
  </svg>
)

const CheckIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

const VideoDetails = () => {
  const { courseId, sectionId, subSectionId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const playerRef = useRef(null)
  const dispatch = useDispatch()

  const { token } = useSelector((state) => state.auth)
  const { courseSectionData, courseEntireData, completedLectures } = useSelector((state) => state.viewCourse)

  const [videoData, setVideoData] = useState([])
  const [previewSource, setPreviewSource] = useState("")
  const [videoEnded, setVideoEnded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [notes, setNotes] = useState("")
  const [notesLoading, setNotesLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [editingNotes, setEditingNotes] = useState(false)
  const [personalNotes, setPersonalNotes] = useState("")
  const [personalNotesSaved, setPersonalNotesSaved] = useState(false)
  // Ref so downloadNotes always reads the latest value (avoids stale closure)
  const notesRef = useRef("")
  // Track previous subSectionId so we only reset notes on actual lecture change
  const prevSubSectionIdRef = useRef(null)

  useEffect(() => { notesRef.current = notes }, [notes])

  useEffect(() => {
    (async () => {
      if (!courseSectionData.length) return
      if (!courseId && !sectionId && !subSectionId) {
        navigate(`/dashboard/enrolled-courses`)
      } else {
        const filteredData = courseSectionData.filter(
          (course) => course._id === sectionId
        )
        const filteredVideoData = filteredData?.[0]?.subSection.filter(
          (data) => data._id === subSectionId
        )
        if (filteredVideoData) setVideoData(filteredVideoData[0])
        setPreviewSource(courseEntireData.thumbnail)
        setVideoEnded(false)
        // ✅ Only wipe notes when the user actually navigates to a different lecture
        if (prevSubSectionIdRef.current !== subSectionId) {
          prevSubSectionIdRef.current = subSectionId
          setNotes("")
          notesRef.current = ""
          setPersonalNotes("")
          setEditingNotes(false)
        }
      }
    })()
  }, [courseSectionData, courseEntireData, location.pathname])

  // ─── GENERATE NOTES (unchanged logic) ───────────────────────────────────────
  const handleGenerateNotes = async () => {
    try {
      setNotesLoading(true)
      const BASE_URL = import.meta.env.VITE_APP_BASE_URL || "http://localhost:5001"
      const res = await fetch(`${BASE_URL}/api/v1/ai/generate-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: videoData?.videoUrl }),
      })
      const data = await res.json()
      if (data.success) setNotes(data.notes)
      else alert("Failed to generate notes")
    } catch (err) {
      console.error(err)
    } finally {
      setNotesLoading(false)
    }
  }

  // ─── DOWNLOAD NOTES AS PDF ────────────────────────────────────────────────────
  const downloadNotes = () => {
    const content = notesRef.current || notes
    if (!content) return

    const doc = new jsPDF({ unit: "pt", format: "a4" })
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const margin = 50
    const maxLineW = pageW - margin * 2
    let y = margin

    // ── Header bar ──────────────────────────────────────────────────
    doc.setFillColor(99, 102, 241)           // indigo
    doc.rect(0, 0, pageW, 36, "F")
    doc.setTextColor(255, 255, 255)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(13)
    doc.text("AI Lecture Notes", margin, 24)

    // lecture title (right side of header)
    const titleText = (videoData?.title || "Lecture").slice(0, 55)
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.text(titleText, pageW - margin, 24, { align: "right" })

    y = 60

    // ── Parse and render lines ───────────────────────────────────────
    const lines = content.split("\n")

    lines.forEach((rawLine) => {
      const line = rawLine.trim()
      if (!line) { y += 8; return }

      // check page overflow
      const checkPage = (extraH = 0) => {
        if (y + extraH > pageH - margin) {
          doc.addPage()
          y = margin
        }
      }

      // Heading  (#  or  ##)
      if (line.startsWith("#")) {
        checkPage(22)
        const text = line.replace(/^#+\s*/, "").replace(/\*\*/g, "").replace(/\*/g, "")
        doc.setFont("helvetica", "bold")
        doc.setFontSize(13)
        doc.setTextColor(79, 70, 229)          // indigo-600
        const wrapped = doc.splitTextToSize(text, maxLineW)
        doc.text(wrapped, margin, y)
        y += wrapped.length * 16 + 6
        // underline
        doc.setDrawColor(99, 102, 241)
        doc.setLineWidth(0.5)
        doc.line(margin, y - 4, margin + 120, y - 4)
        y += 4
        return
      }

      // Numbered list  (1. text)
      const numMatch = line.match(/^(\d+)\.\s+(.*)/)
      if (numMatch) {
        checkPage(16)
        const label = numMatch[1] + "."
        const rest  = numMatch[2].replace(/\*\*/g, "").replace(/\*/g, "")
        doc.setFont("helvetica", "bold")
        doc.setFontSize(10)
        doc.setTextColor(99, 102, 241)
        doc.text(label, margin, y)
        doc.setFont("helvetica", "normal")
        doc.setTextColor(40, 40, 40)
        const wrapped = doc.splitTextToSize(rest, maxLineW - 20)
        doc.text(wrapped, margin + 20, y)
        y += wrapped.length * 14 + 4
        return
      }

      // Bullet  (-, •, * )
      if (/^[-•*]\s/.test(line)) {
        checkPage(14)
        const rest = line.replace(/^[-•*]\s*/, "").replace(/\*\*/g, "").replace(/\*/g, "")
        doc.setFont("helvetica", "normal")
        doc.setFontSize(10)
        doc.setTextColor(40, 40, 40)
        doc.setFillColor(99, 102, 241)
        doc.circle(margin + 3, y - 4, 2, "F")        // bullet dot
        const wrapped = doc.splitTextToSize(rest, maxLineW - 16)
        doc.text(wrapped, margin + 14, y)
        y += wrapped.length * 14 + 4
        return
      }

      // Normal paragraph
      checkPage(14)
      const text = line.replace(/\*\*/g, "").replace(/\*/g, "")
      doc.setFont("helvetica", "normal")
      doc.setFontSize(10)
      doc.setTextColor(60, 60, 60)
      const wrapped = doc.splitTextToSize(text, maxLineW)
      doc.text(wrapped, margin, y)
      y += wrapped.length * 14 + 4
    })

    // ── Footer on every page ─────────────────────────────────────────
    const totalPages = doc.internal.getNumberOfPages()
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p)
      doc.setFontSize(8)
      doc.setTextColor(160, 160, 160)
      doc.text(
        `Page ${p} of ${totalPages}  •  Generated by AI Notes`,
        pageW / 2, pageH - 20,
        { align: "center" }
      )
    }

    doc.save("lecture-notes.pdf")
  }

  // ─── COPY NOTES ─────────────────────────────────────────────────────────────
  const copyNotes = () => {
    navigator.clipboard.writeText(notes).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // ─── SAVE PERSONAL NOTES (localStorage) ────────────────────────────────────
  const savePersonalNotes = () => {
    if (subSectionId) {
      localStorage.setItem(`personalNotes_${subSectionId}`, personalNotes)
    }
    setEditingNotes(false)
    setPersonalNotesSaved(true)
    setTimeout(() => setPersonalNotesSaved(false), 2000)
  }

  // ─── LOAD PERSONAL NOTES FROM localStorage when lecture changes ─────────────
  useEffect(() => {
    if (subSectionId) {
      const saved = localStorage.getItem(`personalNotes_${subSectionId}`)
      setPersonalNotes(saved || "")
    }
  }, [subSectionId])

  // ─── ALL UNCHANGED FUNCTIONS BELOW ──────────────────────────────────────────

  const isFirstVideo = () => {
    const currentSectionIndx = courseSectionData.findIndex((data) => data._id === sectionId)
    const currentSubSectionIndx = courseSectionData[currentSectionIndx].subSection.findIndex((data) => data._id === subSectionId)
    if (currentSectionIndx === 0 && currentSubSectionIndx === 0) return true
    else return false
  }

  const goToNextVideo = () => {
    const currentSectionIndx = courseSectionData.findIndex((data) => data._id === sectionId)
    const noOfSubsections = courseSectionData[currentSectionIndx].subSection.length
    const currentSubSectionIndx = courseSectionData[currentSectionIndx].subSection.findIndex((data) => data._id === subSectionId)

    if (currentSubSectionIndx !== noOfSubsections - 1) {
      const nextSubSectionId = courseSectionData[currentSectionIndx].subSection[currentSubSectionIndx + 1]._id
      navigate(`/view-course/${courseId}/section/${sectionId}/sub-section/${nextSubSectionId}`)
    } else {
      const nextSectionId = courseSectionData[currentSectionIndx + 1]._id
      const nextSubSectionId = courseSectionData[currentSectionIndx + 1].subSection[0]._id
      navigate(`/view-course/${courseId}/section/${nextSectionId}/sub-section/${nextSubSectionId}`)
    }
  }

  const isLastVideo = () => {
    const currentSectionIndx = courseSectionData.findIndex((data) => data._id === sectionId)
    const noOfSubsections = courseSectionData[currentSectionIndx].subSection.length
    const currentSubSectionIndx = courseSectionData[currentSectionIndx].subSection.findIndex((data) => data._id === subSectionId)
    if (currentSectionIndx === courseSectionData.length - 1 && currentSubSectionIndx === noOfSubsections - 1) return true
    else return false
  }

  const goToPrevVideo = () => {
    const currentSectionIndx = courseSectionData.findIndex((data) => data._id === sectionId)
    const currentSubSectionIndx = courseSectionData[currentSectionIndx].subSection.findIndex((data) => data._id === subSectionId)

    if (currentSubSectionIndx !== 0) {
      const prevSubSectionId = courseSectionData[currentSectionIndx].subSection[currentSubSectionIndx - 1]._id
      navigate(`/view-course/${courseId}/section/${sectionId}/sub-section/${prevSubSectionId}`)
    } else {
      const prevSectionId = courseSectionData[currentSectionIndx - 1]._id
      const prevSubSectionLength = courseSectionData[currentSectionIndx - 1].subSection.length
      const prevSubSectionId = courseSectionData[currentSectionIndx - 1].subSection[prevSubSectionLength - 1]._id
      navigate(`/view-course/${courseId}/section/${prevSectionId}/sub-section/${prevSubSectionId}`)
    }
  }

  const handleLectureCompletion = async () => {
    setLoading(true)
    const res = await markLectureAsComplete(
      { courseId: courseId, subsectionId: subSectionId },
      token
    )
    if (res) dispatch(updateCompletedLectures(subSectionId))
    setLoading(false)
  }

  const { courseViewSidebar } = useSelector((state) => state.sidebar)
  if (courseViewSidebar && window.innerWidth <= 640) return

  // ─── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5 text-white">

      {/* Sidebar toggle — unchanged */}
      <div className="sm:hidden absolute left-7 top-3 cursor-pointer">
        {!courseViewSidebar && (
          <HiMenuAlt1 size={33} onClick={() => dispatch(setCourseViewSidebar(!courseViewSidebar))} />
        )}
      </div>

      {/* Video Player — unchanged */}
      {!videoData ? (
        <img src={previewSource} alt="Preview" className="h-full w-full rounded-md object-cover" />
      ) : (
        <Player
          ref={playerRef}
          aspectRatio="16:9"
          playsInline
          onEnded={() => setVideoEnded(true)}
          src={videoData?.videoUrl}
        >
          <BigPlayButton position="center" />
          {videoEnded && (
            <div
              style={{
                backgroundImage:
                  "linear-gradient(to top, rgb(0, 0, 0), rgba(0,0,0,0.7), rgba(0,0,0,0.5), rgba(0,0,0,0.1)",
              }}
              className="full absolute inset-0 z-[100] grid h-full place-content-center font-inter"
            >
              {!completedLectures.includes(subSectionId) && (
                <IconBtn
                  disabled={loading}
                  onclick={() => handleLectureCompletion()}
                  text={!loading ? "Mark As Completed" : "Loading..."}
                  customClasses="text-xl max-w-max px-4 mx-auto"
                />
              )}
              <IconBtn
                disabled={loading}
                onclick={() => {
                  if (playerRef?.current) {
                    playerRef?.current?.seek(0)
                    setVideoEnded(false)
                  }
                }}
                text="Rewatch"
                customClasses="text-xl max-w-max px-4 mx-auto mt-2"
              />
              <div className="mt-10 flex min-w-[250px] justify-center gap-x-4 text-xl">
                {!isFirstVideo() && (
                  <button disabled={loading} onClick={goToPrevVideo} className="blackButton">
                    Prev
                  </button>
                )}
                {!isLastVideo() && (
                  <button disabled={loading} onClick={goToNextVideo} className="blackButton">
                    Next
                  </button>
                )}
              </div>
            </div>
          )}
        </Player>
      )}

      {/* Title & Description — unchanged */}
      <h1 className="mt-4 text-3xl font-semibold">{videoData?.title}</h1>
      <p className="pt-2 pb-6">{videoData?.description}</p>

      {/* ── NEW NOTES SECTION UI ── */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "16px",
          padding: "24px",
          backdropFilter: "blur(10px)",
        }}
      >
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* Glowing dot */}
            <div
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background: "#a78bfa",
                boxShadow: "0 0 8px 3px rgba(167,139,250,0.5)",
                animation: notesLoading ? "pulse 1.2s ease-in-out infinite" : "none",
              }}
            />
            <span style={{ fontWeight: 700, fontSize: "16px", letterSpacing: "0.03em", color: "#e2e8f0" }}>
              AI Lecture Notes
            </span>
          </div>

          {/* Action buttons — only visible when notes exist */}
          {notes && (
            <div style={{ display: "flex", gap: "8px" }}>
              {/* Copy button */}
              <button
                onClick={copyNotes}
                title="Copy notes"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "6px 12px",
                  borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: copied ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.07)",
                  color: copied ? "#4ade80" : "#94a3b8",
                  fontSize: "12px",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                {copied ? <CheckIcon /> : <CopyIcon />}
                {copied ? "Copied!" : "Copy"}
              </button>

              {/* Download button */}
              <button
                onClick={downloadNotes}
                title="Download as .txt"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "6px 12px",
                  borderRadius: "8px",
                  border: "1px solid rgba(99,102,241,0.4)",
                  background: "rgba(99,102,241,0.15)",
                  color: "#a5b4fc",
                  fontSize: "12px",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                <DownloadIcon />
                Download PDF
              </button>
            </div>
          )}
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerateNotes}
          disabled={notesLoading}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            padding: "12px 20px",
            borderRadius: "10px",
            border: "none",
            background: notesLoading
              ? "rgba(99,102,241,0.3)"
              : "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            color: "#fff",
            fontSize: "14px",
            fontWeight: 600,
            cursor: notesLoading ? "not-allowed" : "pointer",
            letterSpacing: "0.02em",
            transition: "all 0.25s ease",
            boxShadow: notesLoading ? "none" : "0 4px 15px rgba(99,102,241,0.35)",
            marginBottom: "18px",
          }}
          onMouseEnter={(e) => {
            if (!notesLoading) e.target.style.transform = "translateY(-1px)"
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = "translateY(0)"
          }}
        >
          {notesLoading ? (
            <>
              {/* Spinner */}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                style={{ animation: "spin 0.8s linear infinite" }}
              >
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              Generating Notes…
            </>
          ) : (
            <>
              <SparkleIcon />
              {notes ? "Regenerate Notes" : "Generate Notes"}
            </>
          )}
        </button>

        {/* Notes display area */}
        {notesLoading ? (
          /* Skeleton loader while generating */
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[100, 85, 92, 70, 88].map((w, i) => (
              <div
                key={i}
                style={{
                  height: "12px",
                  borderRadius: "6px",
                  width: `${w}%`,
                  background: "rgba(255,255,255,0.07)",
                  animation: "shimmer 1.5s ease-in-out infinite",
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
        ) : notes ? (
          <div
            style={{
              background: "rgba(0,0,0,0.25)",
              borderRadius: "10px",
              border: "1px solid rgba(255,255,255,0.07)",
              padding: "18px",
              maxHeight: "340px",
              overflowY: "auto",
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(99,102,241,0.4) transparent",
            }}
          >
            {notes.split("\n").map((line, idx) => {
              const trimmed = line.trim()
              if (!trimmed) return <div key={idx} style={{ height: "8px" }} />

              // ── helpers ──────────────────────────────────────────────────────
              // Renders inline **bold** and *bold* markers as <strong> spans
              const renderInline = (text) => {
                // strip leading bullet/hash markers before inline parsing
                const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
                return parts.map((part, i) => {
                  if (part.startsWith("**") && part.endsWith("**"))
                    return <strong key={i} style={{ color: "#e2e8f0", fontWeight: 700 }}>{part.slice(2, -2)}</strong>
                  if (part.startsWith("*") && part.endsWith("*"))
                    return <strong key={i} style={{ color: "#e2e8f0", fontWeight: 700 }}>{part.slice(1, -1)}</strong>
                  return part
                })
              }

              // Heading: starts with # or ##
              const isHeading = trimmed.startsWith("#")

              // Bullet: starts with -, •, or a lone * that is NOT *word*
              const isBullet =
                trimmed.startsWith("-") ||
                trimmed.startsWith("•") ||
                /^\*\s/.test(trimmed) // "* text" style bullet

              if (isHeading) {
                const text = trimmed.replace(/^#+\s*/, "")
                return (
                  <p
                    key={idx}
                    style={{
                      fontWeight: 700,
                      fontSize: "14px",
                      color: "#c4b5fd",
                      marginBottom: "6px",
                      marginTop: idx > 0 ? "14px" : "0",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {renderInline(text)}
                  </p>
                )
              }

              if (isBullet) {
                const text = trimmed.replace(/^[-•*]\s*/, "")
                return (
                  <div key={idx} style={{ display: "flex", gap: "8px", marginBottom: "5px" }}>
                    <span style={{ color: "#818cf8", marginTop: "2px", flexShrink: 0 }}>›</span>
                    <p style={{ fontSize: "13px", color: "#cbd5e1", lineHeight: "1.65", margin: 0 }}>
                      {renderInline(text)}
                    </p>
                  </div>
                )
              }

              // Numbered list: "1. text"
              const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)/)
              if (numberedMatch) {
                return (
                  <div key={idx} style={{ display: "flex", gap: "8px", marginBottom: "5px" }}>
                    <span style={{ color: "#818cf8", fontSize: "12px", fontWeight: 700, minWidth: "18px", marginTop: "2px" }}>
                      {numberedMatch[1]}.
                    </span>
                    <p style={{ fontSize: "13px", color: "#cbd5e1", lineHeight: "1.65", margin: 0 }}>
                      {renderInline(numberedMatch[2])}
                    </p>
                  </div>
                )
              }

              return (
                <p key={idx} style={{ fontSize: "13px", color: "#94a3b8", lineHeight: "1.7", marginBottom: "5px" }}>
                  {renderInline(trimmed)}
                </p>
              )
            })}
          </div>
        ) : (
          /* Empty state */
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              padding: "32px 16px",
              border: "1px dashed rgba(255,255,255,0.1)",
              borderRadius: "10px",
              color: "#475569",
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
            <p style={{ fontSize: "13px", textAlign: "center", lineHeight: 1.5 }}>
              Click <strong style={{ color: "#818cf8" }}>Generate Notes</strong> to create<br />AI-powered notes for this lecture
            </p>
          </div>
        )}

        {/* ── PERSONAL NOTES (pen feature) ─────────────────────────────────── */}
        <div style={{ marginTop: "20px" }}>
          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
            <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
            <span style={{ fontSize: "11px", color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Your Notes
            </span>
            <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
          </div>

          {editingNotes ? (
            /* Edit mode */
            <div>
              <textarea
                autoFocus
                value={personalNotes}
                onChange={(e) => setPersonalNotes(e.target.value)}
                placeholder="Write your own notes here…"
                style={{
                  width: "100%",
                  minHeight: "120px",
                  background: "rgba(99,102,241,0.06)",
                  border: "1px solid rgba(99,102,241,0.35)",
                  borderRadius: "10px",
                  padding: "14px",
                  color: "#e2e8f0",
                  fontSize: "13px",
                  lineHeight: "1.7",
                  resize: "vertical",
                  outline: "none",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                }}
              />
              <div style={{ display: "flex", gap: "8px", marginTop: "10px", justifyContent: "flex-end" }}>
                <button
                  onClick={() => setEditingNotes(false)}
                  style={{
                    padding: "7px 14px",
                    borderRadius: "8px",
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "transparent",
                    color: "#64748b",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={savePersonalNotes}
                  style={{
                    padding: "7px 16px",
                    borderRadius: "8px",
                    border: "none",
                    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    color: "#fff",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <CheckIcon /> Save
                </button>
              </div>
            </div>
          ) : (
            /* View mode */
            <div
              onClick={() => setEditingNotes(true)}
              title="Click to edit your notes"
              style={{
                position: "relative",
                minHeight: "60px",
                background: "rgba(0,0,0,0.2)",
                border: "1px dashed rgba(99,102,241,0.25)",
                borderRadius: "10px",
                padding: "14px 40px 14px 14px",
                cursor: "text",
                transition: "border-color 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(99,102,241,0.6)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(99,102,241,0.25)")}
            >
              {/* Pen icon — top right */}
              <div
                style={{
                  position: "absolute",
                  top: "10px",
                  right: "10px",
                  color: personalNotesSaved ? "#4ade80" : "#6366f1",
                  opacity: 0.8,
                  transition: "color 0.3s",
                }}
              >
                {personalNotesSaved ? (
                  <CheckIcon />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9"/>
                    <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
                  </svg>
                )}
              </div>

              {personalNotes ? (
                <p style={{ fontSize: "13px", color: "#94a3b8", lineHeight: "1.7", margin: 0, whiteSpace: "pre-wrap" }}>
                  {personalNotes}
                </p>
              ) : (
                <p style={{ fontSize: "13px", color: "#334155", fontStyle: "italic", margin: 0 }}>
                  Click the pen to add your own notes…
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* CSS keyframes injected once */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
        @keyframes shimmer {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 0.8; }
        }
      `}</style>
    </div>
  )
}

export default VideoDetails