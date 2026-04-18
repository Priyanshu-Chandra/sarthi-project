import { useEffect, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { useLocation, useNavigate, useParams } from "react-router-dom"

import IconBtn from './../../common/IconBtn';
import { setCourseViewSidebar } from "../../../slices/sidebarSlice"

import { BsChevronDown } from "react-icons/bs"
import { IoIosArrowBack } from "react-icons/io"

import { IoMdClose } from 'react-icons/io'
import { HiMenuAlt1 } from 'react-icons/hi'
import { FiAward, FiShield, FiUnlock } from "react-icons/fi"

import { fetchTestsByCourse } from "../../../services/operations/quizAPI"



export default function VideoDetailsSidebar({ setReviewModal }) {

  const [activeStatus, setActiveStatus] = useState("") // store curr section id
  const [videoBarActive, setVideoBarActive] = useState("") // store curr SubSection Id
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useDispatch();

  const { sectionId, subSectionId } = useParams()
  const {
    courseSectionData,
    courseEntireData,
    totalNoOfLectures,
    completedLectures,
  } = useSelector((state) => state.viewCourse)

  const { token } = useSelector((state) => state.auth)
  const { courseViewSidebar } = useSelector(state => state.sidebar)

  // Course tests
  const [courseTests, setCourseTests] = useState([])
  const [testsLoading, setTestsLoading] = useState(false)

  // Fetch tests for this course
  useEffect(() => {
    const loadTests = async () => {
      if (!courseEntireData?._id) return
      setTestsLoading(true)
      try {
        const res = await fetchTestsByCourse(courseEntireData._id, token)
        if (res?.tests) {
          setCourseTests(res.tests)
        }
      } catch (err) {
        console.log("Failed to load course tests", err)
      } finally {
        setTestsLoading(false)
      }
    }
    loadTests()
  }, [courseEntireData?._id, token])


  // set which section - subSection is selected 
  useEffect(() => {
    ; (() => {
      if (!courseSectionData.length) return
      const currentSectionIndx = courseSectionData.findIndex((data) => data._id === sectionId)
      const currentSubSectionIndx = courseSectionData?.[currentSectionIndx]?.subSection.findIndex((data) => data._id === subSectionId)
      const activeSubSectionId = courseSectionData[currentSectionIndx]?.subSection?.[currentSubSectionIndx]?._id
      setActiveStatus(courseSectionData?.[currentSectionIndx]?._id)
      setVideoBarActive(activeSubSectionId)
    })()
  }, [courseSectionData, courseEntireData, location.pathname])


  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
  };

  const hasCertificateEligibility = Boolean(courseEntireData?._id && courseEntireData?.certificateEligibility)
  const certificateEligibility = courseEntireData?.certificateEligibility || {
    eligible: false,
    reason: "NOT_ALL_TESTS_PASSED",
  }
  const certificateLocked = !hasCertificateEligibility || certificateEligibility.eligible !== true
  const certificateMessage =
    !hasCertificateEligibility
      ? "Checking certificate status..."
      : certificateEligibility.reason === "CHEATING_DETECTED"
      ? "Certificate denied due to suspicious activity"
      : "Complete all tests to unlock certificate"


  return (
    <>
      <div className="flex h-[calc(100vh-3.5rem)] w-[320px] max-w-[350px] flex-col border-r-[1px] border-r-richblack-700 bg-richblack-800">
        <div className="mx-5 flex flex-col items-start justify-between gap-2 gap-y-4 border-b border-richblack-600 py-5 text-lg font-bold text-richblack-25">
          <div className="flex w-full items-center justify-between ">

            {/* open - close side bar icons */}
            <div
              className="sm:hidden text-white cursor-pointer "
              onClick={() => dispatch(setCourseViewSidebar(!courseViewSidebar))}
            >
              {courseViewSidebar ? <IoMdClose size={33} /> : <HiMenuAlt1 size={33} />}
            </div>

            {/* go back dashboard */}
            <button
              onClick={() => { navigate(`/dashboard/enrolled-courses`) }}
              className="flex h-[35px] w-[35px] items-center justify-center rounded-full bg-richblack-100 p-1 text-richblack-700 hover:scale-90"
              title="back"
            >
              <IoIosArrowBack size={30} />
            </button>

            {/* add review button */}
            <IconBtn
              text="Add Review"
              onclick={() => setReviewModal(true)}
            />
          </div>

          {/* course Name - total No Of Lectures*/}
          <div className="flex flex-col">
            <p>{courseEntireData?.courseName}</p>
            <p className="text-sm font-semibold text-richblack-500">
              {completedLectures?.length} / {totalNoOfLectures}
            </p>
          </div>
        </div>

        <div className="mx-5 mb-4 rounded-2xl border border-richblack-600 bg-gradient-to-br from-richblack-700 via-richblack-800 to-richblack-900 p-4 shadow-lg">
          <div className="flex items-start gap-3">
            <div
              className={`mt-1 flex h-10 w-10 items-center justify-center rounded-xl ${
                certificateLocked
                  ? "bg-pink-500/15 text-pink-200"
                  : "bg-yellow-400/20 text-yellow-100"
              }`}
            >
              {certificateLocked ? <FiShield size={18} /> : <FiAward size={18} />}
            </div>

            <div className="flex-1">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-richblack-400">
                    Certificate
                  </p>
                  <p className="mt-1 text-base font-semibold text-richblack-5">
                    {certificateLocked ? "Locked" : "Unlocked"}
                  </p>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${
                    certificateLocked
                      ? "bg-pink-500/15 text-pink-200"
                      : "bg-yellow-300 text-richblack-900"
                  }`}
                >
                  {certificateLocked ? "Restricted" : "Ready"}
                </span>
              </div>

              <p className="mt-3 text-sm leading-6 text-richblack-300">
                {certificateLocked
                  ? certificateMessage
                  : "All tests are cleared cleanly. Your certificate is unlocked."}
              </p>

              <button
                type="button"
                disabled={certificateLocked}
                className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  certificateLocked
                    ? "cursor-not-allowed border border-richblack-600 bg-richblack-700 text-richblack-400"
                    : "bg-yellow-50 text-richblack-900 hover:bg-yellow-100"
                }`}
              >
                {certificateLocked ? <FiShield size={16} /> : <FiUnlock size={16} />}
                {certificateLocked ? "Certificate Locked" : "Certificate Unlocked"}
              </button>
            </div>
          </div>
        </div>


        {/* render all section -subSection */}
        <div className="h-[calc(100vh - 5rem)] overflow-y-auto">
          {courseSectionData.map((section, index) => (
            <div
              className="mt-2 cursor-pointer text-sm text-richblack-5"
              onClick={() => setActiveStatus(section?._id)}
              key={index}
            >
              {/* Section */}
              <div className="flex justify-between bg-richblack-700 px-5 py-4">
                <div className="w-[70%] font-semibold">
                  {section?.sectionName}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[12px] font-medium gap-2 flex">
                    <span>{section?.subSection?.length || 0} Lession{(section?.subSection?.length !== 1) ? "s" : ""}</span>
                    {courseTests.filter(t => t.sectionId && t.sectionId.toString() === section?._id?.toString()).length > 0 && (
                      <span className="text-yellow-100">• {courseTests.filter(t => t.sectionId && t.sectionId.toString() === section?._id?.toString()).length} Quiz</span>
                    )}
                  </span>
                  <span
                    className={`${activeStatus === section?._id
                      ? "rotate-0 transition-all duration-500"
                      : "rotate-180"
                      } `}
                  >
                    <BsChevronDown />
                  </span>
                </div>
              </div>

              {/* Sub Sections */}
              {activeStatus === section?._id && (
                <div className="transition-[height] duration-500 ease-in-out">
                  {section.subSection.map((topic, i) => (
                    <div
                      className={`flex gap-3  px-5 py-2 ${videoBarActive === topic._id
                        ? "bg-yellow-200 font-semibold text-richblack-800"
                        : "hover:bg-richblack-900"
                        } `}
                      key={i}
                      onClick={() => {
                        navigate(`/view-course/${courseEntireData?._id}/section/${section?._id}/sub-section/${topic?._id}`)
                        setVideoBarActive(topic._id)
                        courseViewSidebar && window.innerWidth <= 640 ? dispatch(setCourseViewSidebar(false)) : null;
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={completedLectures.includes(topic?._id)}
                        onChange={() => { }}
                      />
                      {topic.title}
                    </div>
                  ))}
                  
                  {/* Render tests for this section */}
                  {courseTests.filter(t => t.sectionId && t.sectionId.toString() === section?._id?.toString()).map((test, i) => (
                    <div
                      className={`flex flex-col gap-1 px-5 py-3 text-left text-sm cursor-pointer ${videoBarActive === test._id
                        ? "bg-yellow-200 font-semibold text-richblack-800"
                        : "hover:bg-richblack-900 text-richblack-5"
                        } `}
                      key={`test-${test._id}`}
                      onClick={() => {
                        navigate(`/view-course/${courseEntireData?._id}/test/${test._id}`)
                        setVideoBarActive(test._id)
                        if (courseViewSidebar && window.innerWidth <= 640) {
                          dispatch(setCourseViewSidebar(false));
                        }
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span>📝</span>
                        <span>{test.title}</span>
                      </div>
                      <div className="text-[11px] text-richblack-300 flex gap-2 pl-6">
                        <span>⏱ {formatTime(test.timeLimitSeconds)}</span>
                        <span>•</span>
                        <span>Max {test.maxAttempts} attempts</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

        </div>
      </div>
    </>
  )
}
