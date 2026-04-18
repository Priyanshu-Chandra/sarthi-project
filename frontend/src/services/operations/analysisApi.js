import { apiConnector } from "../apiConnector";

const BASE_URL = import.meta.env.VITE_APP_BASE_URL;

export const getPostTestAnalysis = async (testId, token) => {
  try {
    const response = await apiConnector(
      "GET",
      `${BASE_URL}/api/v1/analysis/post-test/${testId}`,
      null,
      { Authorization: `Bearer ${token}` }
    );
    if (!response.data.success) return null;
    return response.data.data;
  } catch (err) {
    console.log("POST_TEST_ANALYSIS_ERROR", err);
    return null;
  }
};

export const getWeeklyLeaderboard = async (token) => {
  try {
    const response = await apiConnector(
      "GET",
      `${BASE_URL}/api/v1/leaderboard/weekly`,
      null,
      { Authorization: `Bearer ${token}` }
    );
    if (!response.data.success) return null;
    return response.data.data;
  } catch (err) {
    console.log("WEEKLY_LEADERBOARD_ERROR", err);
    return null;
  }
};

export const getMyRank = async (token) => {
  try {
    const response = await apiConnector(
      "GET",
      `${BASE_URL}/api/v1/leaderboard/my-rank`,
      null,
      { Authorization: `Bearer ${token}` }
    );
    if (!response.data.success) return null;
    return response.data.data;
  } catch (err) {
    console.log("MY_RANK_ERROR", err);
    return null;
  }
};

export const getStudentAnalytics = async (token) => {
  try {
    const response = await apiConnector(
      "GET",
      `${BASE_URL}/api/analytics/student`,
      null,
      { Authorization: `Bearer ${token}` }
    );
    if (!response.data.success) return null;
    return response.data.data;
  } catch (err) {
    console.log("STUDENT_ANALYTICS_ERROR", err);
    return null;
  }
};
