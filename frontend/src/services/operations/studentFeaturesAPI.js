import { toast } from "react-hot-toast";
import { studentEndpoints } from "../apis";
import { apiConnector } from "../apiConnector";
import rzpLogo from "../../assets/Logo/rzp_logo.png";
import { setPaymentLoading } from "../../slices/courseSlice";
import { resetCart } from "../../slices/cartSlice";
import { setUser } from "../../slices/profileSlice";

const {
  COURSE_PAYMENT_API,
  COURSE_VERIFY_API,
  SEND_PAYMENT_SUCCESS_EMAIL_API,
} = studentEndpoints;

function loadScript(src) {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = src;

    script.onload = () => {
      resolve(true);
    };
    script.onerror = () => {
      resolve(false);
    };
    document.body.appendChild(script);
  });
}

// ================ buyCourse ================
export async function buyCourse(
  token,
  coursesId,
  userDetails,
  navigate,
  dispatch,
) {
  const toastId = toast.loading("Loading...");

  try {
    if (!userDetails) {
      toast.error("User details not available. Please log in again.");
      toast.dismiss(toastId);
      return;
    }

    //load the script
    const res = await loadScript(
      "https://checkout.razorpay.com/v1/checkout.js",
    );

    if (!res) {
      toast.error("RazorPay SDK failed to load");
      toast.dismiss(toastId);
      return;
    }

    // initiate the order
    const orderResponse = await apiConnector(
      "POST",
      COURSE_PAYMENT_API,
      { coursesId },
      {
        Authorization: `Bearer ${token}`,
      },
    );
    // console.log("orderResponse... ", orderResponse);
    if (!orderResponse.data.success) {
      throw new Error(orderResponse.data.message);
    }

    const RAZORPAY_KEY = import.meta.env.VITE_APP_RAZORPAY_KEY;
    // console.log("RAZORPAY_KEY...", RAZORPAY_KEY);

    // options
    const options = {
      key: RAZORPAY_KEY,
      currency: orderResponse.data.currency,
      amount: orderResponse.data.amount,
      order_id: orderResponse.data.orderId,
      name: "StudyNotion",
      description: "Thank You for Purchasing the Course",
      image: rzpLogo,
      prefill: {
        name: userDetails.firstName,
        email: userDetails.email,
      },
      handler: function (response) {
        //send successful mail
        sendPaymentSuccessEmail(response, orderResponse.data.amount, token);
        //verifyPayment
        verifyPayment(
          { ...response, coursesId },
          token,
          navigate,
          dispatch,
          userDetails,
        );
      },
    };

    const paymentObject = new window.Razorpay(options);
    paymentObject.open();
    paymentObject.on("payment.failed", function (response) {
      toast.error("oops, payment failed");
      console.log("payment failed.... ", response.error);
    });
  } catch (error) {
    console.log("PAYMENT API ERROR.....", error);
    const message =
      error.response?.data?.message ||
      error.message ||
      "Could not make Payment";
    toast.error(message);
  }
  toast.dismiss(toastId);
}

// ================ send Payment Success Email ================
async function sendPaymentSuccessEmail(response, amount, token) {
  try {
    await apiConnector(
      "POST",
      SEND_PAYMENT_SUCCESS_EMAIL_API,
      {
        orderId: response.razorpay_order_id,
        paymentId: response.razorpay_payment_id,
        amount,
      },
      {
        Authorization: `Bearer ${token}`,
      },
    );
  } catch (error) {
    console.log("PAYMENT SUCCESS EMAIL ERROR....", error);
  }
}

// ================ verify payment ================
async function verifyPayment(bodyData, token, navigate, dispatch, userDetails) {
  const toastId = toast.loading("Verifying Payment....");

  dispatch(setPaymentLoading(true));

  try {
    const response = await apiConnector("POST", COURSE_VERIFY_API, bodyData, {
      Authorization: `Bearer ${token}`,
    });

    if (!response.data.success) {
      throw new Error(response.data.message);
    }

    toast.success("payment Successful, you are addded to the course");

    // update user state with new enrolled courses
    const updatedUser = {
      ...userDetails,
      courses: [...(userDetails.courses || []), ...bodyData.coursesId],
    };
    dispatch(setUser(updatedUser));
    sessionStorage.setItem("user", JSON.stringify(updatedUser));

    navigate("/dashboard/enrolled-courses");
    dispatch(resetCart());
  } catch (error) {
    console.log("PAYMENT VERIFY ERROR....", error);
    toast.error("Could not verify Payment");
  }
  toast.dismiss(toastId);
  dispatch(setPaymentLoading(false));
}
