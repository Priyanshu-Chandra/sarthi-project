const BASE_URL = import.meta.env.VITE_APP_BASE_URL;

// AUTH ENDPOINTS
export const endpoints = {
  SENDOTP_API: BASE_URL + "/api/v1/auth/sendotp",
  SIGNUP_API: BASE_URL + "/api/v1/auth/signup",
  LOGIN_API: BASE_URL + "/api/v1/auth/login",
  RESETPASSTOKEN_API: BASE_URL + "/api/v1/auth/reset-password-token",
  RESETPASSWORD_API: BASE_URL + "/api/v1/auth/reset-password",
}

// PROFILE ENDPOINTS
export const profileEndpoints = {
  GET_USER_DETAILS_API: BASE_URL + "/api/v1/profile/getUserDetails",
  GET_USER_ENROLLED_COURSES_API: BASE_URL + "/api/v1/profile/getEnrolledCourses",
  GET_INSTRUCTOR_DATA_API: BASE_URL + "/api/v1/profile/instructorDashboard",
  GET_PURCHASE_HISTORY_API: BASE_URL + "/api/v1/profile/getPurchaseHistory",
}

// ADMIN ENDPOINTS
export const adminEndPoints = {
  GET_ALL_STUDENTS_DATA_API: BASE_URL + "/api/v1/auth/all-students",
  GET_ALL_INSTRUCTORS_DATA_API: BASE_URL + "/api/v1/auth/all-instructors",
}

// STUDENTS ENDPOINTS
export const studentEndpoints = {
  COURSE_PAYMENT_API: BASE_URL + "/api/v1/payment/capturePayment",
  COURSE_VERIFY_API: BASE_URL + "/api/v1/payment/verifyPayment",
  SEND_PAYMENT_SUCCESS_EMAIL_API: BASE_URL + "/api/v1/payment/sendPaymentSuccessEmail",
}

// COURSE ENDPOINTS
export const courseEndpoints = {
  GET_ALL_COURSE_API: BASE_URL + "/api/v1/course/getAllCourses",
  COURSE_DETAILS_API: BASE_URL + "/api/v1/course/getCourseDetails",
  EDIT_COURSE_API: BASE_URL + "/api/v1/course/editCourse",
  COURSE_CATEGORIES_API: BASE_URL + "/api/v1/course/showAllCategories",
  CREATE_COURSE_API: BASE_URL + "/api/v1/course/createCourse",
  CREATE_SECTION_API: BASE_URL + "/api/v1/course/addSection",
  CREATE_SUBSECTION_API: BASE_URL + "/api/v1/course/addSubSection",
  UPDATE_SECTION_API: BASE_URL + "/api/v1/course/updateSection",
  UPDATE_SUBSECTION_API: BASE_URL + "/api/v1/course/updateSubSection",
  GET_ALL_INSTRUCTOR_COURSES_API: BASE_URL + "/api/v1/course/getInstructorCourses",
  DELETE_SECTION_API: BASE_URL + "/api/v1/course/deleteSection",
  DELETE_SUBSECTION_API: BASE_URL + "/api/v1/course/deleteSubSection",
  DELETE_COURSE_API: BASE_URL + "/api/v1/course/deleteCourse",
  GET_FULL_COURSE_DETAILS_AUTHENTICATED: BASE_URL + "/api/v1/course/getFullCourseDetails",
  LECTURE_COMPLETION_API: BASE_URL + "/api/v1/course/updateCourseProgress",
  CREATE_RATING_API: BASE_URL + "/api/v1/course/createRating",
  CREATE_NEW_CATEGORY: BASE_URL + "/api/v1/course/createCategory",
  DELETE_CATEGORY: BASE_URL + "/api/v1/course/deleteCategory",
  VERIFY_CERTIFICATE_API: BASE_URL + "/api/v1/course/verify-certificate",
  MARK_COURSE_COMPLETED_API: BASE_URL + "/api/v1/course/markCourseAsCompleted",
  ENABLE_CERTIFICATE_API: BASE_URL + "/api/v1/course/enableCertificate",
  DOWNLOAD_CERTIFICATE_API: BASE_URL + "/api/v1/course/downloadCertificate",
}

// RATINGS AND REVIEWS
export const ratingsEndpoints = {
  REVIEWS_DETAILS_API: BASE_URL + "/api/v1/course/getReviews",
}

// CATEGORIES API
export const categories = {
  CATEGORIES_API: BASE_URL + "/api/v1/course/showAllCategories",
}

// CATALOG PAGE DATA
export const catalogData = {
  CATALOGPAGEDATA_API: BASE_URL + "/api/v1/course/getCategoryPageDetails",
}

// CONTACT-US API
export const contactusEndpoint = {
  CONTACT_US_API: BASE_URL + "/api/v1/reach/contact",
}

// SETTINGS PAGE API
export const settingsEndpoints = {
  UPDATE_DISPLAY_PICTURE_API: BASE_URL + "/api/v1/profile/updateUserProfileImage",
  UPDATE_PROFILE_API: BASE_URL + "/api/v1/profile/updateProfile",
  CHANGE_PASSWORD_API: BASE_URL + "/api/v1/auth/changepassword",
  DELETE_PROFILE_API: BASE_URL + "/api/v1/profile/deleteProfile",
}

// TEST ENDPOINTS (previously /api/v1/quiz, now cleaned up to /api/v1/test)
export const quizEndpoints = {
  CREATE_QUIZ_API: BASE_URL + "/api/v1/test/create",
  GENERATE_AI_API: BASE_URL + "/api/v1/test/generate-ai",
  GET_SUBJECTS_API: BASE_URL + "/api/v1/test/subjects",
  GET_TESTS_BY_COURSE_API: BASE_URL + "/api/v1/test/course",
  GET_QUIZZES_BY_SUBJECT_API: BASE_URL + "/api/v1/test/by-subject",
  GET_QUIZ_BY_ID_API: BASE_URL + "/api/v1/test",
  SUBMIT_QUIZ_API: BASE_URL + "/api/v1/test/submit",
  GET_RESULTS_API: BASE_URL + "/api/v1/test/results",
  DELETE_TEST_API: BASE_URL + "/api/v1/test",
}

// CODING ENDPOINTS
export const codingEndpoints = {
  EXECUTE_CODE_API: BASE_URL + "/api/v1/code/run",
  SUBMIT_CODE_API: BASE_URL + "/api/v1/code/submit",
  GET_USER_SUBMISSIONS_API: BASE_URL + "/api/v1/code/history",
  GET_CODING_STATS_API: BASE_URL + "/api/v1/code/stats",
  GET_LEADERBOARD_API: BASE_URL + "/api/v1/code/leaderboard",
  GET_ACTIVITY_API: BASE_URL + "/api/v1/code/activity",
  GET_ANALYTICS_API: BASE_URL + "/api/v1/code/analytics",
  AI_HELP_API: BASE_URL + "/api/v1/ai/code-help",
}

// PROBLEM ENDPOINTS
export const problemEndpoints = {
  GET_ALL_PROBLEMS_API: BASE_URL + "/api/v1/problems/all",
  GET_PROBLEM_DETAILS_API: BASE_URL + "/api/v1/problems", // append /:id
}

// LIVE ANALYTICS ENDPOINTS
export const liveAnalyticsEndpoints = {
  GET_SESSION_SUMMARY_API: BASE_URL + "/api/v1/live-analytics/session", // append /:sessionId/summary
  GET_COURSE_SESSION_HISTORY_API: BASE_URL + "/api/v1/live-analytics/course", // append /:courseId/history
  GET_SESSION_STUDENTS_API: BASE_URL + "/api/v1/live-analytics/session", // append /:sessionId/students
}

// INSTRUCTOR DASHBOARD ANALYTICS
export const instructorAnalyticsEndpoints = {
  GET_EXAM_OVERVIEW_API: BASE_URL + "/api/v1/instructor-analytics/overview",
  GET_FAILED_QUESTIONS_API: BASE_URL + "/api/v1/instructor-analytics/failed",
  GET_TOP_PERFORMERS_API: BASE_URL + "/api/v1/instructor-analytics/top-performers",
}

// CHEATING ANALYTICS
export const cheatingAnalyticsEndpoints = {
  GET_CHEATING_ANALYSIS_API: BASE_URL + "/api/v1/cheating-analytics",
  GET_CHEATING_SUMMARY_API: BASE_URL + "/api/v1/cheating-analytics/summary",
}

// LIVE CLASS ENDPOINTS
export const liveClassEndpoints = {
  START_LIVE_CLASS_API: BASE_URL + "/api/v1/live-class/start",
}