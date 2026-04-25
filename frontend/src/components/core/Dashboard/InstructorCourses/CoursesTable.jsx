
import { useSelector } from "react-redux"

import { Table, Thead, Tbody, Tr, Th, Td } from 'react-super-responsive-table'
import 'react-super-responsive-table/dist/SuperResponsiveTableStyle.css'

import { useState } from "react"
import { FaCheck, FaAward } from "react-icons/fa"
import { FiEdit2 } from "react-icons/fi"
import { HiClock } from "react-icons/hi"
import { RiDeleteBin6Line, RiCheckboxCircleFill } from "react-icons/ri"
import { MdOutlineVideocam } from "react-icons/md"
import { useNavigate } from "react-router-dom"

import { formatDate } from "../../../../services/formatDate"
import { 
  deleteCourse, 
  fetchInstructorCourses, 
  markCourseAsCompleted, 
  enableCertificateForCourse 
} from "../../../../services/operations/courseDetailsAPI"
import { COURSE_STATUS } from "../../../../utils/constants"
import ConfirmationModal from "../../../common/ConfirmationModal"
import Img from './../../../common/Img';
import toast from 'react-hot-toast'
import { apiConnector } from "../../../../services/apiConnector"
import { VscGraph, VscHistory } from "react-icons/vsc"
import TestSelectionModal from "./TestSelectionModal"





import { liveClassEndpoints } from "../../../../services/apis"

export default function CoursesTable({ courses, setCourses, loading, setLoading, mode }) {

  const navigate = useNavigate()
  const { token } = useSelector((state) => state.auth)

  const [confirmationModal, setConfirmationModal] = useState(null)
  const [testModal, setTestModal] = useState(null)
  const TRUNCATE_LENGTH = 25

  const handleMarkAsCompleted = async (courseId) => {
    setLoading(true)
    const result = await markCourseAsCompleted(courseId, token)
    if (result) {
      const updatedCourses = await fetchInstructorCourses(token)
      if (updatedCourses) setCourses(updatedCourses)
    }
    setLoading(false)
  }

  const handleEnableCertificate = async (courseId) => {
    setLoading(true)
    const result = await enableCertificateForCourse(courseId, token)
    if (result) {
      const updatedCourses = await fetchInstructorCourses(token)
      if (updatedCourses) setCourses(updatedCourses)
    }
    setLoading(false)
  }

  // delete course
  const handleCourseDelete = async (courseId) => {
    setLoading(true)
    const toastId = toast.loading('Deleting...');
    await deleteCourse({ courseId: courseId }, token)
    const result = await fetchInstructorCourses(token)
    if (result) {
      setCourses(result)
    }
    setConfirmationModal(null)
    setLoading(false)
    toast.dismiss(toastId)
    // console.log("All Course ", courses)
  }

  const handleStartClass = async (courseId) => {
    const toastId = toast.loading("Starting live class...");
    try {
      const res = await apiConnector("POST", liveClassEndpoints.START_LIVE_CLASS_API, { courseId }, {
        Authorization: `Bearer ${token}`,
      });
      const roomId = res?.data?.roomId;
      if (roomId) {
        toast.success("Live class started");
        navigate(`/live-class/${roomId}`, { state: { courseId } });
      } else {
        toast.error(res?.data?.message || "Could not start live class");
      }
    } catch (error) {
      console.error(error);
      toast.error(error?.response?.data?.message || "Could not start live class");
    } finally {
      toast.dismiss(toastId);
    }
  };


  // Loading Skeleton - Returns a valid Table Row
  const skItem = () => {
    return (
      <Tr className="flex border-b border-richblack-800 px-6 py-8 w-full">
        <Td className="flex flex-1 gap-x-4 ">
          <div className='h-[148px] min-w-[300px] rounded-xl skeleton '></div>

          <div className="flex flex-col w-[40%]">
            <p className="h-5 w-[50%] rounded-xl skeleton"></p>
            <p className="h-20 w-[60%] rounded-xl mt-3 skeleton"></p>

            <p className="h-2 w-[20%] rounded-xl skeleton mt-3"></p>
            <p className="h-2 w-[20%] rounded-xl skeleton mt-2"></p>
          </div>
        </Td>
        {/* Fill columns to prevent layout shift */}
        <Td className="skeleton h-5 w-10"></Td>
        <Td className="skeleton h-5 w-10"></Td>
        <Td className="skeleton h-5 w-10"></Td>
      </Tr>
    )
  }

  return (
    <>
      <Table className="rounded-2xl border border-richblack-800 ">
        {/* heading */}
        <Thead>
          <Tr className="flex gap-x-10 rounded-t-3xl border-b border-b-richblack-800 px-6 py-2">
            <Th className="flex-1 text-left text-sm font-medium uppercase text-richblack-100">
              Courses
            </Th>
            <Th className="text-left text-sm font-medium uppercase text-richblack-100">
              Duration
            </Th>
            <Th className="text-left text-sm font-medium uppercase text-richblack-100">
              Price
            </Th>
            <Th className="text-left text-sm font-medium uppercase text-richblack-100">
              Actions
            </Th>
          </Tr>
        </Thead>


        <Tbody>
          {loading && (
            <>
              {skItem()}
              {skItem()}
              {skItem()}
            </>
          )}
          {!loading && courses?.length === 0 ? (
            <Tr>
              <Td className="py-10 text-center text-2xl font-medium text-richblack-100">
                No courses found
              </Td>
            </Tr>
          )
            : (
              courses?.map((course) => (
                <Tr
                  key={course._id}
                  className="flex gap-x-10 border-b border-richblack-800 px-6 py-8"
                >
                  <Td className="flex flex-1 gap-x-4 relative">
                    {/* course Thumbnail */}
                    <Img
                      src={course?.thumbnail}
                      alt={course?.courseName}
                      className="h-[148px] min-w-[270px] max-w-[270px] rounded-lg object-cover"
                    />

                    <div className="flex flex-col">
                      <p className="text-lg font-semibold text-richblack-5 capitalize">{course.courseName}</p>
                      <p className="text-xs text-richblack-300 ">
                        {course.courseDescription.split(" ").length > TRUNCATE_LENGTH
                          ? course.courseDescription
                            .split(" ")
                            .slice(0, TRUNCATE_LENGTH)
                            .join(" ") + "..."
                          : course.courseDescription}
                      </p>

                      {/* created At */}
                      <p className="text-[12px] text-richblack-100 mt-4">
                        Created: {formatDate(course?.createdAt)}
                      </p>

                      {/* updated At */}
                      <p className="text-[12px] text-richblack-100 ">
                        updated: {formatDate(course?.updatedAt)}
                      </p>

                      {/* course status */}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {course.status === COURSE_STATUS.DRAFT ? (
                          <p className="flex w-fit items-center gap-2 rounded-full bg-richblack-700 px-2 py-[2px] text-[12px] font-medium text-pink-100">
                            <HiClock size={14} />
                            Drafted
                          </p>
                        ) : (
                          <div className="flex w-fit items-center gap-2 rounded-full bg-richblack-700 px-2 py-[2px] text-[12px] font-medium text-yellow-100">
                            <p className="flex h-3 w-3 items-center justify-center rounded-full bg-yellow-100 text-richblack-700">
                              <FaCheck size={8} />
                            </p>
                            Published
                          </div>
                        )}

                        {course.courseStatus === "COMPLETED" && (
                          <div className="flex w-fit items-center gap-2 rounded-full bg-caribbeangreen-900 px-2 py-[2px] text-[12px] font-medium text-caribbeangreen-100">
                            <RiCheckboxCircleFill size={14} />
                            Completed
                          </div>
                        )}

                        {course.isCertificateEnabled && (
                          <div className="flex w-fit items-center gap-2 rounded-full bg-blue-900 px-2 py-[2px] text-[12px] font-medium text-blue-100 border border-blue-500">
                            <FaAward size={12} title="Certificates Active" />
                            Certificates Active
                          </div>
                        )}
                      </div>
                    </div>
                  </Td>

                  {/* course duration */}
                  <Td className="text-sm font-medium text-richblack-100">{course?.totalDuration || "0s"}</Td>
                  {/* course price */}
                  <Td className="text-sm font-medium text-richblack-100">₹{course.price}</Td>

                  <Td className="text-sm font-medium text-richblack-100 ">
                    {/* General Editing Buttons (Only in My Courses or if no mode) */}
                    {(!mode || mode === "test") && (
                      <button
                        disabled={loading}
                        onClick={() => { navigate(`/dashboard/edit-course/${course._id}`) }}
                        title="Edit"
                        className="px-2 transition-all duration-200 hover:scale-110 hover:text-caribbeangreen-300"
                      >
                        <FiEdit2 size={20} />
                      </button>
                    )}

                    {/* Mark Completed Button (Visible if Published) */}
                    {!mode && course.status === COURSE_STATUS.PUBLISHED && course.courseStatus !== "COMPLETED" && (
                      <button
                        disabled={loading}
                        onClick={() => handleMarkAsCompleted(course._id)}
                        title="Mark Course as Completed"
                        className="px-2 transition-all duration-200 hover:scale-110 text-richblack-100 hover:text-caribbeangreen-100"
                      >
                        <RiCheckboxCircleFill size={22} />
                      </button>
                    )}

                    {/* Enable Certificate Button */}
                    {!mode && course.courseStatus === "COMPLETED" && !course.isCertificateEnabled && (
                      <button
                        disabled={loading}
                        onClick={() => handleEnableCertificate(course._id)}
                        title="Enable Certificates for Students"
                        className="px-2 transition-all duration-200 hover:scale-110 text-richblack-100 hover:text-blue-200"
                      >
                        <FaAward size={22} />
                      </button>
                    )}

                    {/* Delete button (Only in My Courses) */}
                    {!mode && (
                      <button
                        disabled={loading}
                        onClick={() => {
                          setConfirmationModal({
                            text1: "Do you want to delete this course?",
                            text2:
                              "All the data related to this course will be deleted",
                            btn1Text: !loading ? "Delete" : "Loading...  ",
                            btn2Text: "Cancel",
                            btn1Handler: !loading
                              ? () => handleCourseDelete(course._id)
                              : () => { },
                            btn2Handler: !loading
                              ? () => setConfirmationModal(null)
                              : () => { },

                          })
                        }}
                        title="Delete"
                        className="px-1 transition-all duration-200 hover:scale-110 hover:text-[#ff0000]"
                      >
                        <RiDeleteBin6Line size={20} />
                      </button>
                    )}

                    {/* Start Live Class Button (Highlighted in Live mode) */}
                    {(!mode || mode === "live") && (
                      <button
                        disabled={loading}
                        onClick={() => handleStartClass(course._id)}
                        title="Start Live Class"
                        className={`px-1 transition-all duration-200 hover:scale-110 ${mode === "live" ? "text-caribbeangreen-200" : "text-richblack-100"} hover:text-green-300`}
                      >
                        <MdOutlineVideocam size={24} />
                      </button>
                    )}

                    {/* Test Analytics Button (Highlighted in Test mode) */}
                    {(!mode || mode === "test") && (
                      <button
                        disabled={loading}
                        onClick={() => setTestModal({ 
                          courseId: course._id, 
                          courseName: course.courseName 
                        })}
                        title="View Test Analytics"
                        className={`px-1 transition-all duration-200 hover:scale-110 ${mode === "test" ? "text-yellow-100" : "text-richblack-100"} hover:text-yellow-50`}
                      >
                        <VscGraph size={22} />
                      </button>
                    )}

                    {/* Live History Button (Available in both Live and Analytics) */}
                    <button
                      disabled={loading}
                      onClick={() => navigate(`/dashboard/live-analytics/${course._id}`)}
                      title="View Session History"
                      className={`px-1 transition-all duration-200 hover:scale-110 ${mode === "live" ? "text-blue-100" : "text-richblack-100"} hover:text-blue-200`}
                    >
                      <VscHistory size={22} />
                    </button>
                  </Td>
                </Tr>
              ))
            )}
        </Tbody>
      </Table>

      {/* Confirmation Modal */}
      {confirmationModal && <ConfirmationModal modalData={confirmationModal} />}

      {/* Test Selection Modal */}
      {testModal && (
        <TestSelectionModal 
          courseId={testModal.courseId} 
          courseName={testModal.courseName} 
          onClose={() => setTestModal(null)} 
        />
      )}
    </>
  )
}
