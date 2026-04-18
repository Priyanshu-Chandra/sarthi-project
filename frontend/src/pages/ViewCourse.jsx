import { useEffect, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { Outlet, useParams } from "react-router-dom"

import CourseReviewModal from "../components/core/ViewCourse/CourseReviewModal"
import VideoDetailsSidebar from "../components/core/ViewCourse/VideoDetailsSidebar"
import { getFullDetailsOfCourse } from "../services/operations/courseDetailsAPI"
import { courseEndpoints } from "../services/apis"

import {
  setCompletedLectures,
  setCourseSectionData,
  setEntireCourseData,
  setTotalNoOfLectures,
} from "../slices/viewCourseSlice"

import { setCourseViewSidebar } from "../slices/sidebarSlice"

// ⭐ QUIZ API

export default function ViewCourse() {

  const { courseId } = useParams()
  const { token } = useSelector((state) => state.auth)
  const dispatch = useDispatch()

  const [reviewModal, setReviewModal] = useState(false)
  const [downloading, setDownloading] = useState(false)

  // Redux state extraction for Phase F2
  const { courseEntireData } = useSelector((state) => state.viewCourse)
  const courseDetails = courseEntireData;
  const certificateEligibility = courseEntireData?.certificateEligibility;

  const canDownloadCertificate =
    certificateEligibility?.eligible === true &&
    courseDetails?.courseStatus === "COMPLETED" &&
    courseDetails?.isCertificateEnabled === true;

  let certificateMessage = "";

  if (courseDetails?.courseStatus !== "COMPLETED") {
    certificateMessage = "Course not completed yet";
  } else if (!courseDetails?.isCertificateEnabled) {
    certificateMessage = "Certificate not released yet";
  } else if (!certificateEligibility?.eligible) {
    certificateMessage = "Complete all tests to unlock certificate";
  }

  const handleDownloadCertificate = async () => {
    try {
      setDownloading(true);
      const url = `${courseEndpoints.DOWNLOAD_CERTIFICATE_API}/${courseId}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Server error: ${response.status}`);
      }

      const contentType = response.headers.get("Content-Type") || "";
      if (!contentType.includes("pdf")) {
        throw new Error("Server did not return a PDF file");
      }

      const blob = await response.blob();
      if (blob.size < 100) {
        throw new Error("Downloaded file is too small — likely corrupt");
      }

      // Try to get filename from Content-Disposition header
      let fileName = "certificate.pdf";
      const contentDisposition = response.headers.get("Content-Disposition");
      if (contentDisposition) {
        const fileNameMatch = contentDisposition.match(/filename="(.+)"/);
        if (fileNameMatch && fileNameMatch[1]) {
          fileName = fileNameMatch[1];
        }
      }

      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Certificate download failed:", error);
      alert(`Certificate download failed: ${error.message}`);
    } finally {
      setDownloading(false);
    }
  };
  // get Full Details Of Course
  useEffect(() => {

    ; (async () => {

      const courseData = await getFullDetailsOfCourse(courseId, token)



      dispatch(setCourseSectionData(courseData.courseDetails.courseContent))
      dispatch(setEntireCourseData({
        ...courseData.courseDetails,
        certificateEligibility: courseData.certificateEligibility || {
          eligible: true,
          reason: "ELIGIBLE",
        },
      }))
      dispatch(setCompletedLectures(courseData.completedVideos))

      let lectures = 0

      courseData?.courseDetails?.courseContent?.forEach((sec) => {
        lectures += sec.subSection.length
      })

      dispatch(setTotalNoOfLectures(lectures))

      // ⭐ CHECK IF QUIZ EXISTS
    })()

  }, [courseId, token, dispatch])


  // sidebar logic
  const { courseViewSidebar } = useSelector(state => state.sidebar)
  const [screenSize, setScreenSize] = useState(undefined)

  useEffect(() => {

    const handleScreenSize = () => setScreenSize(window.innerWidth)

    window.addEventListener('resize', handleScreenSize)
    handleScreenSize()

    return () => window.removeEventListener('resize', handleScreenSize)

  })


  useEffect(() => {

    if (screenSize <= 640) {
      dispatch(setCourseViewSidebar(false))
    } else {
      dispatch(setCourseViewSidebar(true))
    }

  }, [screenSize])


  return (
    <>
      <div className="relative flex min-h-[calc(100vh-3.5rem)] ">

        {/* sidebar */}
        {courseViewSidebar && (
          <VideoDetailsSidebar setReviewModal={setReviewModal} />
        )}

        <div className="h-[calc(100vh-3.5rem)] flex-1 overflow-auto mt-14" id="view-course-scroll-container">

          <div className="mx-6 mt-6">
            <div className="mb-4 flex justify-end items-center gap-3">
              {canDownloadCertificate ? (
                <button
                  onClick={handleDownloadCertificate}
                  disabled={downloading}
                  className="bg-yellow-400 hover:bg-yellow-500 text-black px-4 py-2 font-semibold rounded-md transition disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                >
                  {downloading ? "Downloading..." : "Download Certificate"}
                </button>
              ) : (
                <span className="text-sm font-medium text-richblack-300">
                  {certificateMessage}
                </span>
              )}
            </div>
            <Outlet />
          </div>

        </div>
      </div>

      {reviewModal && (
        <CourseReviewModal setReviewModal={setReviewModal} />
      )}
    </>
  )
}
