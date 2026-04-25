import { apiConnector } from "../apiConnector"
import { quizEndpoints } from "../apis"

const {
  GET_SUBJECTS_API,
  GET_QUIZZES_BY_SUBJECT_API,
  GET_QUIZ_BY_ID_API,
  SUBMIT_QUIZ_API,
  GET_RESULTS_API,
} = quizEndpoints


// Fetch all tests for a course (listing only — no attempt session)
export const fetchTestsByCourse = async (courseId, token) => {
  try {
    const response = await apiConnector(
      "GET",
      `${quizEndpoints.GET_TESTS_BY_COURSE_API}/${courseId}/list`,
      null,
      {
        Authorization: `Bearer ${token}`
      }
    );

    return response.data;

  } catch (error) {
    console.log("TESTS LIST FETCH ERROR", error);
  }
};

// Get subjects
export const fetchQuizSubjects = async (token) => {
  try {

    const response = await apiConnector(
      "GET",
      GET_SUBJECTS_API,
      null,
      {
        Authorization: `Bearer ${token}`
      }
    )

    return response.data

  } catch (error) {
    console.log("SUBJECT API ERROR", error)
  }
}



// Get quizzes of a subject
export const fetchQuizzesBySubject = async (subject, token) => {

  try {

    const response = await apiConnector(
      "GET",
      `${GET_QUIZZES_BY_SUBJECT_API}/${subject}`,
      null,
      {
        Authorization: `Bearer ${token}`
      }
    )

    return response.data

  } catch (error) {
    console.log("QUIZ LIST ERROR", error)
  }

}



// Get quiz questions
export const fetchQuizById = async ({ quizId, deviceId }, token) => {

  try {
    const query = deviceId
      ? `?deviceId=${encodeURIComponent(deviceId)}`
      : "";

    const response = await apiConnector(
      "GET",
      `${GET_QUIZ_BY_ID_API}/${quizId}${query}`,
      null,
      {
        Authorization: `Bearer ${token}`
      }
    )

    return response.data

  } catch (error) {
     console.log("QUIZ FETCH ERROR 2");

    console.log("QUIZ FETCH ERROR", error)

  }

}

export const startQuizAttempt = async ({ quizId, deviceId }, token) => {
  try {
    const response = await apiConnector(
      "POST",
      `${GET_QUIZ_BY_ID_API}/${quizId}/start`,
      { deviceId },
      {
        Authorization: `Bearer ${token}`
      }
    )

    return response.data

  } catch (error) {
    console.log("QUIZ START ERROR", error)
    throw error
  }
}



// Submit quiz
export const submitQuiz = async (data, token) => {

  try {
    const { answers, tabSwitchCount = 0, timeTaken, ...restData } = data

    const response = await apiConnector(
      "POST",
      SUBMIT_QUIZ_API,
      {
        ...restData,
        answers,
        tabSwitchCount,
        timeTaken: typeof timeTaken === "number" ? timeTaken : 0,
      },
      {
        Authorization: `Bearer ${token}`
      }
    )

    return response.data

  }catch (error) {

  console.log("QUIZ SUBMIT ERROR", error)

  throw error // ⭐ important
}
}
// Create Quiz (Instructor)
export const createQuiz = async (data, token) => {

  try {

    const response = await apiConnector(
      "POST",
      quizEndpoints.CREATE_QUIZ_API,
      data,
      {
        Authorization: `Bearer ${token}`
      }
    )

    return response.data

  }catch (error) {

  console.log("QUIZ SUBMIT ERROR", error)

  throw error // ⭐ important
}

}
export const generateQuizAI = async (data, token) => {
  try {

    const response = await apiConnector(
      "POST",
      `${quizEndpoints.GENERATE_AI_API}`,
      data,
      {
        Authorization: `Bearer ${token}`
      }
    )

    return response.data

  } catch (error) {
    console.log("AI GENERATION ERROR", error)
    throw error
  }
}

// Get student results
export const fetchStudentResults = async (token) => {
  try {
    const response = await apiConnector(
      "GET",
      GET_RESULTS_API,
      null,
      {
        Authorization: `Bearer ${token}`
      }
    )
    return response.data
  } catch (error) {
    console.log("RESULTS FETCH ERROR", error)
    throw error
  }
}

// Delete a test (Instructor)
export const deleteTest = async (testId, token) => {
  try {
    const response = await apiConnector(
      "DELETE",
      `${quizEndpoints.DELETE_TEST_API}/${testId}`,
      null,
      {
        Authorization: `Bearer ${token}`
      }
    )
    return response.data
  } catch (error) {
    console.log("TEST DELETE ERROR", error)
    throw error
  }
}
