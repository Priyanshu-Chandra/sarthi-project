import { apiConnector } from "../apiConnector";
import { problemEndpoints } from "../apis";
import { toast } from "react-hot-toast";

const { GET_ALL_PROBLEMS_API, GET_PROBLEM_DETAILS_API } = problemEndpoints;

export const getAllProblems = async (token, filters = {}) => {
  let result = null;
  try {
    let url = new URL(GET_ALL_PROBLEMS_API);
    if (filters.search) url.searchParams.append("search", filters.search);
    if (filters.difficulty) url.searchParams.append("difficulty", filters.difficulty);
    if (filters.topic) url.searchParams.append("topic", filters.topic);
    if (filters.page) url.searchParams.append("page", filters.page);

    const response = await apiConnector("GET", url.toString(), null, {
      Authorization: `Bearer ${token}`,
    });
    if (!response.data.success) {
      throw new Error(response.data.message);
    }
    result = response.data;
  } catch (error) {
    console.log("GET_ALL_PROBLEMS_API ERROR...", error);
    toast.error("Could not fetch problems");
  }
  return result;
};

export const getProblemDetails = async (problemId, token) => {
  let result = null;
  const idStr = typeof problemId === "object" ? problemId.id : problemId;
  const url = `${GET_PROBLEM_DETAILS_API}/${idStr}`;
  try {
    const response = await apiConnector("GET", url, null, {
      Authorization: `Bearer ${token}`,
    });
    if (!response.data.success) {
      throw new Error(response.data.message);
    }
    result = response.data.data;
  } catch (error) {
    console.log("GET_PROBLEM_DETAILS_API ERROR...", error);
    toast.error("Could not fetch problem details");
  }
  return result;
};
