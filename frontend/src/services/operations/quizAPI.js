import { apiConnector } from "../apiConnector"
import { quizEndpoints } from "../apis"

const {
  GET_SUBJECTS_API,
  GET_QUIZZES_BY_SUBJECT_API,
  GET_QUIZ_BY_ID_API,
  SUBMIT_QUIZ_API,
} = quizEndpoints



//fetch quiz by course ID
export const fetchQuizByCourse = async (courseId, token) => {
  try {

    const response = await apiConnector(
      "GET",
      `${quizEndpoints.GET_QUIZ_BY_COURSE_API}/${courseId}`,
      null,
      {
        Authorization: `Bearer ${token}`
      }
    );

    return response.data;

  } catch (error) {
    // print on  backend console
    console.log("QUIZ FETCH ERROR 1");
    console.log("QUIZ FETCH ERROR 1", error);
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
export const fetchQuizById = async (quizId, token) => {

  try {

    const response = await apiConnector(
      "GET",
      `${GET_QUIZ_BY_ID_API}/${quizId}`,
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



// Submit quiz
export const submitQuiz = async (data, token) => {

  try {

    const response = await apiConnector(
      "POST",
      SUBMIT_QUIZ_API,
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