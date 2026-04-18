import { toast } from "react-hot-toast";
import { apiConnector } from "../apiConnector";
import { codingEndpoints } from "../apis";

const { EXECUTE_CODE_API } = codingEndpoints;

export const executeCode = async (data, token) => {
  const toastId = toast.loading("Executing code...");
  let result = null;
  try {
    const response = await apiConnector("POST", EXECUTE_CODE_API, data, {
      Authorization: `Bearer ${token}`,
    });

    if (!response.data.success) {
      throw new Error(response.data.message);
    }

    result = response.data.data;
    toast.success("Executed successfully");
  } catch (error) {
    console.log("EXECUTE_CODE_API ERROR...", error);
    toast.error(error.response?.data?.message || "Could not execute code");
    result = error.response?.data?.data || null;
  }
  toast.dismiss(toastId);
  return result;
};

export const submitCode = async (data, token) => {
  const toastId = toast.loading("Evaluating against test cases...");
  let result = null;
  try {
    const response = await apiConnector("POST", codingEndpoints.SUBMIT_CODE_API, data, {
      Authorization: `Bearer ${token}`,
    });

    if (!response.data.success) {
      throw new Error(response.data.message);
    }

    result = response.data.data;
    if (result.status === "Accepted") {
      toast.success("Problem Solved!");
      
      if (response.data.levelUp) {
        setTimeout(() => toast.success(`🎉 LEVEL UP! You reached a new level!`, { duration: 6000, style: { background: '#22c55e', color: '#fff', fontWeight: 'bold' } }), 1000);
      }
      
      if (response.data.xpGained) {
        setTimeout(() => toast.success(`+${response.data.xpGained} XP Gained! 🌟`, { duration: 4000 }), 500);
      }
      
      if (response.data.achievementsUnlocked && response.data.achievementsUnlocked.length > 0) {
        response.data.achievementsUnlocked.forEach((badge, index) => {
          setTimeout(() => {
            toast(`Achievement Unlocked:\n${badge}`, { icon: '🏆', duration: 5000 });
          }, 1000 + (index * 800));
        });
      }

    } else {
      toast.error(`Result: ${result.status}`);
    }
  } catch (error) {
    console.log("SUBMIT_CODE_API ERROR...", error);
    toast.error(error.response?.data?.message || "Could not submit code");
    result = error.response?.data?.data || null;
  }
  toast.dismiss(toastId);
  return result;
};

export const getSubmissionHistory = async (token) => {
  let result = [];
  try {
    const response = await apiConnector("GET", codingEndpoints.GET_USER_SUBMISSIONS_API, null, {
      Authorization: `Bearer ${token}`,
    });
    if (response?.data?.success) result = response.data.data;
  } catch (error) {
    console.log("HISTORY_API ERROR...", error);
  }
  return result;
};

export const getUserCodingStats = async (token) => {
  let result = null;
  try {
    const response = await apiConnector("GET", codingEndpoints.GET_CODING_STATS_API, null, {
      Authorization: `Bearer ${token}`,
    });
    if (response?.data?.success) result = response.data.data;
  } catch (error) {
    console.log("STATS_API ERROR...", error);
  }
  return result;
};

export const getLeaderboard = async (token) => {
  let result = [];
  try {
    const response = await apiConnector("GET", codingEndpoints.GET_LEADERBOARD_API, null, {
      Authorization: `Bearer ${token}`,
    });
    if (response?.data?.success) result = response.data.data;
  } catch (error) {
    console.log("LEADERBOARD_API ERROR...", error);
  }
  return result;
};

export const getCodingActivity = async (token) => {
  try {
    const response = await apiConnector(
      "GET",
      codingEndpoints.GET_ACTIVITY_API,
      null,
      { Authorization: `Bearer ${token}` }
    );
    return response.data.data;
  } catch (error) {
    console.log("ACTIVITY_FETCH_ERROR", error);
    return [];
  }
};

export const getCodingAnalytics = async (token) => {
  try {
    const response = await apiConnector(
      "GET",
      codingEndpoints.GET_ANALYTICS_API,
      null,
      { Authorization: `Bearer ${token}` }
    );
    return response.data.data;
  } catch (error) {
    console.log("ANALYTICS_FETCH_ERROR", error);
    return null;
  }
};

export const getAICodeHelp = async (data, token) => {
  const toastId = toast.loading("Consulting AI...");
  try {
    const response = await apiConnector(
      "POST",
      codingEndpoints.AI_HELP_API,
      data,
      { Authorization: `Bearer ${token}` }
    );
    toast.dismiss(toastId);
    if (!response.data.success) {
      throw new Error(response.data.message);
    }
    return response.data.data;
  } catch (error) {
    console.log("AI_HELP_ERROR", error);
    toast.dismiss(toastId);
    toast.error(error.response?.data?.message || "Failed to get AI assistance.");
    return null;
  }
};

const BASE_URL = import.meta.env.VITE_APP_BASE_URL;

export const getPracticePath = async (token) => {
  try {
    const response = await apiConnector(
      "GET",
      `${BASE_URL}/api/v1/recommendation/practice-path`,
      null,
      { Authorization: `Bearer ${token}` }
    );

    if (!response.data.success) return [];

    return response.data.data;
  } catch (error) {
    console.log("PRACTICE_PATH_ERROR", error);
    return [];
  }
};

export const getDailyChallenge = async (token) => {
  try {
    const response = await apiConnector(
      "GET",
      `${BASE_URL}/api/v1/recommendation/daily-challenge`,
      null,
      { Authorization: `Bearer ${token}` }
    );

    if (!response.data.success) return null;

    return response.data.data;
  } catch (error) {
    console.log("DAILY_CHALLENGE_ERROR", error);
    return null;
  }
};
