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
// QUIZ ENDPOINTS
export const quizEndpoints = {
  CREATE_QUIZ_API: BASE_URL + "/api/v1/quiz/create",
  GET_SUBJECTS_API: BASE_URL + "/api/v1/quiz/subjects",
  GET_QUIZ_BY_COURSE_API: BASE_URL + "/api/v1/quiz/course",
  GET_QUIZZES_BY_SUBJECT_API: BASE_URL + "/api/v1/quiz/by-subject",
  GET_QUIZ_BY_ID_API: BASE_URL + "/api/v1/quiz",
  SUBMIT_QUIZ_API: BASE_URL + "/api/v1/quiz/submit",
  GET_RESULTS_API: BASE_URL + "/api/v1/quiz/results"
}