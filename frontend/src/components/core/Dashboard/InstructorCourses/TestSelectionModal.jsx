import { useEffect, useState } from "react"
import { useSelector } from "react-redux"
import { useNavigate } from "react-router-dom"
import { fetchTestsByCourse } from "../../../../services/operations/quizAPI"
import { IoMdClose } from "react-icons/io"
import { VscGraph } from "react-icons/vsc"

export default function TestSelectionModal({ courseId, courseName, onClose }) {
  const { token } = useSelector((state) => state.auth)
  const navigate = useNavigate()
  const [tests, setTests] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadTests = async () => {
      setLoading(true)
      try {
        const res = await fetchTestsByCourse(courseId, token)
        if (res?.tests) {
          setTests(res.tests)
        }
      } catch (error) {
        console.error("Failed to load tests:", error)
        // Note: toast is usually already handled in service, but we add safe fallback here
      } finally {
        setLoading(false)
      }
    }
    loadTests()
  }, [courseId, token])

  return (
    <div className="fixed inset-0 z-[1000] !mt-0 grid place-items-center overflow-auto bg-white bg-opacity-10 backdrop-blur-sm">
      <div className="w-11/12 max-w-[450px] rounded-2xl border border-richblack-400 bg-richblack-800 p-6">
        <div className="flex items-center justify-between border-b border-richblack-700 pb-3">
          <p className="text-xl font-semibold text-richblack-5">Select Test - {courseName}</p>
          <button onClick={onClose} className="text-richblack-5 hover:text-pink-200">
            <IoMdClose size={24} />
          </button>
        </div>

        <div className="mt-5 max-h-[300px] overflow-auto pr-2 custom-scrollbar">
          {loading ? (
            <p className="text-center text-richblack-100">Loading tests...</p>
          ) : tests.length > 0 ? (
            <div className="flex flex-col gap-y-3">
              {tests.map((test) => (
                <button
                  key={test._id}
                  onClick={() => {
                    navigate(`/dashboard/instructor-analytics/${test._id}`)
                    onClose()
                  }}
                  className="flex items-center justify-between rounded-xl border border-richblack-700 bg-richblack-900 p-4 transition-all hover:border-yellow-100 hover:bg-richblack-800"
                >
                  <div className="flex items-center gap-3">
                    <VscGraph className="text-yellow-100" />
                    <span className="text-richblack-5 font-medium">{test.title}</span>
                  </div>
                  <span className="text-xs text-richblack-300">{test.questionCount} Qs</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-5">
               <p className="text-richblack-100">No tests found for this course.</p>
               <button 
                onClick={() => navigate("/dashboard/add-course")}
                className="mt-3 text-sm text-yellow-100 underline hover:text-yellow-25"
               >
                 Create a Test
               </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
