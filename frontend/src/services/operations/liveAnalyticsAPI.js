import { toast } from "react-hot-toast"
import { apiConnector } from "../apiConnector"
import { liveAnalyticsEndpoints } from "../apis"

const {
  GET_SESSION_SUMMARY_API,
  GET_COURSE_SESSION_HISTORY_API,
  GET_SESSION_STUDENTS_API,
} = liveAnalyticsEndpoints

export function getSessionSummary(sessionId, token) {
  return async (dispatch) => {
    let result = null
    try {
      const response = await apiConnector("GET", `${GET_SESSION_SUMMARY_API}/${sessionId}/summary`, null, {
        Authorization: `Bearer ${token}`,
      })
      console.log("GET_SESSION_SUMMARY_API RESPONSE...", response)

      if (!response.data.success) {
        throw new Error(response.data.message)
      }
      result = response.data.summary
    } catch (error) {
      console.log("GET_SESSION_SUMMARY_API ERROR...", error)
      // toast.error("Could not fetch session summary")
    }
    return result
  }
}

export function getCourseSessionHistory(courseId, token) {
  return async (dispatch) => {
    let result = []
    try {
      const response = await apiConnector("GET", `${GET_COURSE_SESSION_HISTORY_API}/${courseId}/history`, null, {
        Authorization: `Bearer ${token}`,
      })
      console.log("GET_COURSE_SESSION_HISTORY_API RESPONSE...", response)

      if (!response.data.success) {
        throw new Error(response.data.message)
      }
      result = response.data.sessions
    } catch (error) {
      console.log("GET_COURSE_SESSION_HISTORY_API ERROR...", error)
      toast.error("Could not fetch session history")
    }
    return result
  }
}

export function getSessionStudents(sessionId, page = 1, limit = 20, token) {
  return async (dispatch) => {
    let result = null
    try {
      const response = await apiConnector(
        "GET",
        `${GET_SESSION_STUDENTS_API}/${sessionId}/students`,
        null, // bodyData
        { Authorization: `Bearer ${token}` }, // headers
        null, // params
        { params: { page, limit } } // otherConfig (spread into axios config)
      )
      console.log("GET_SESSION_STUDENTS_API RESPONSE...", response)

      if (!response.data.success) {
        throw new Error(response.data.message)
      }
      result = response.data
    } catch (error) {
      console.log("GET_SESSION_STUDENTS_API ERROR...", error)
      toast.error("Could not fetch student attendance")
    }
    return result
  }
}
