import { useEffect, useState } from "react"
import { useSelector } from "react-redux"
import { fetchInstructorCourses } from "../../../services/operations/courseDetailsAPI"
import CoursesTable from "./InstructorCourses/CoursesTable"
import Loading from "../../common/Loading"

export default function InstructorPortal({ mode }) {
  const { token } = useSelector((state) => state.auth)
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchCourses = async () => {
      setLoading(true)
      const result = await fetchInstructorCourses(token)
      if (result) {
        setCourses(result)
      }
      setLoading(false)
    }
    fetchCourses()
  }, [token])

  const title = mode === "live" ? "Live Session History" : "Test Intelligence Center"
  const subtitle = mode === "live" 
    ? "Monitor attendance and engagement across all your live sessions."
    : "Deep-dive into student performance and proctoring reports."

  if (loading) return <Loading />

  return (
    <div className="flex flex-col gap-y-6">
      <div className="space-y-2">
        <h1 className="text-4xl font-medium text-richblack-5 font-boogaloo">{title}</h1>
        <p className="text-richblack-300">{subtitle}</p>
      </div>

      <div className="mt-4">
        <CoursesTable 
          courses={courses} 
          setCourses={setCourses} 
          loading={loading} 
          setLoading={setLoading}
          mode={mode}
        />
      </div>
    </div>
  )
}
