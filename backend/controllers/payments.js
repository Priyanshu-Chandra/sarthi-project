const Rajorpay = require("razorpay");
const { instance } = require("../config/rajorpay");
const crypto = require("crypto");
const mailSender = require("../utils/mailSender");
const {
  courseEnrollmentEmail,
} = require("../mail/templates/courseEnrollmentEmail");
require("dotenv").config();

const User = require("../models/user");
const Course = require("../models/course");
const CourseProgress = require("../models/courseProgress");

const { default: mongoose } = require("mongoose");

// ================ capture the payment and Initiate the 'Rajorpay order' ================
// ================ Create Razorpay order for payment ================
exports.capturePayment = async (req, res) => {
  try {
    const { coursesId } = req.body; // array of course IDs
    const userId = req.user.id;

    if (!coursesId || coursesId.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Please provide Course Id(s)" });
    }

    let totalAmount = 0;

    // validate courses + already enrolled check + calculate total amount
    for (const course_id of coursesId) {
      const course = await Course.findById(course_id);
      if (!course) {
        return res
          .status(404)
          .json({ success: false, message: "Could not find the course" });
      }

      const uid = new mongoose.Types.ObjectId(userId);
      if (course.studentsEnrolled.includes(uid)) {
        return res
          .status(400)
          .json({ success: false, message: "Student is already Enrolled" });
      }

      const price = parseFloat(course.price);
      if (isNaN(price) || price < 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid price for course ${course.courseName}`,
        });
      }

      totalAmount += price;
    }

    console.log("Total amount:", totalAmount);

    // create Razorpay order
    const options = {
      amount: totalAmount * 100, // amount in paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      notes: {
        userId,
        courses: coursesId.join(","),
      },
    };

    const order = await instance.orders.create(options);

    return res.status(200).json({
      success: true,
      message: "Order created successfully",
      orderId: order.id,
      currency: order.currency,
      amount: order.amount,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ================ verify the payment ================
exports.verifyPayment = async (req, res) => {
  const razorpay_order_id = req.body?.razorpay_order_id;
  const razorpay_payment_id = req.body?.razorpay_payment_id;
  const razorpay_signature = req.body?.razorpay_signature;
  const courses = req.body?.coursesId;
  const amount = req.body?.amount; // total amount in paise from Razorpay
  const userId = req.user.id;

  if (
    !razorpay_order_id ||
    !razorpay_payment_id ||
    !razorpay_signature ||
    !courses ||
    !userId
  ) {
    return res
      .status(400)
      .json({ success: false, message: "Payment Failed, data not found" });
  }

  let body = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_SECRET)
    .update(body.toString())
    .digest("hex");

  if (expectedSignature === razorpay_signature) {
    // enroll student with payment metadata
    await enrollStudents(courses, userId, razorpay_order_id, razorpay_payment_id, amount);
    return res.status(200).json({ success: true, message: "Payment Verified" });
  }
  return res.status(200).json({ success: false, message: "Payment Failed" });
};

const enrollStudents = async (courses, userId, orderId = null, paymentId = null, totalAmountPaise = null) => {
  if (!courses || !userId) {
    throw new Error("Please Provide data for Courses or UserId");
  }

  // Calculate per-course amount (distribute total evenly if multiple courses)
  const perCourseAmount =
    totalAmountPaise && courses.length > 0
      ? Math.round(totalAmountPaise / courses.length) / 100  // convert paise → ₹
      : null;

  for (const courseId of courses) {
    // find course and enroll student
    const enrolledCourse = await Course.findOneAndUpdate(
      { _id: courseId },
      { $push: { studentsEnrolled: userId } },
      { new: true },
    );

    if (!enrolledCourse) {
      throw new Error("Course not Found");
    }

    // Initialize course progress with payment metadata
    const courseProgress = await CourseProgress.create({
      courseID: courseId,
      userId: userId,
      completedVideos: [],
      orderId: orderId,
      paymentId: paymentId,
      amountPaid: perCourseAmount ?? enrolledCourse.price,
    });

    // add course and progress to user
    const enrolledStudent = await User.findByIdAndUpdate(
      userId,
      {
        $push: {
          courses: courseId,
          courseProgress: courseProgress._id,
        },
      },
      { new: true },
    );

    // send mail (optional, ignore failure)
    try {
      await mailSender(
        enrolledStudent.email,
        `Successfully Enrolled into ${enrolledCourse.courseName}`,
        courseEnrollmentEmail(
          enrolledCourse.courseName,
          `${enrolledStudent.firstName}`,
        ),
      );
    } catch (err) {
      console.log("Failed to send email (non-fatal): ", err);
    }
  }
};

exports.sendPaymentSuccessEmail = async (req, res) => {
  const { orderId, paymentId, amount } = req.body;

  const userId = req.user.id;

  if (!orderId || !paymentId || !amount || !userId) {
    return res
      .status(400)
      .json({ success: false, message: "Please provide all the fields" });
  }

  try {
    // find student
    const enrolledStudent = await User.findById(userId);
    await mailSender(
      enrolledStudent.email,
      `Payment Recieved`,
      paymentSuccessEmail(
        `${enrolledStudent.firstName}`,
        amount / 100,
        orderId,
        paymentId,
      ),
    );
  } catch (error) {
    console.log("error in sending mail", error);
    return res
      .status(500)
      .json({ success: false, message: "Could not send email" });
  }
};

// ================ verify Signature ================
// exports.verifySignature = async (req, res) => {
//     const webhookSecret = '12345678';

//     const signature = req.headers['x-rajorpay-signature'];

//     const shasum = crypto.createHmac('sha256', webhookSecret);
//     shasum.update(JSON.stringify(req.body));
//     const digest = shasum.digest('hex');

//     if (signature === digest) {
//         console.log('Payment is Authorized');

//         const { courseId, userId } = req.body.payload.payment.entity.notes;

//         try {
//             const enrolledCourse = await Course.findByIdAndUpdate({ _id: courseId },
//                 { $push: { studentsEnrolled: userId } },
//                 { new: true });

//             // wrong upper ?

//             if (!enrolledCourse) {
//                 return res.status(500).json({
//                     success: false,
//                     message: 'Course not found'
//                 });
//             }

//             // add course id to user course list
//             const enrolledStudent = await User.findByIdAndUpdate(userId,
//                 { $push: { courses: courseId } },
//                 { new: true });

//             // send enrolled mail

//             // return response
//             res.status(200).json({
//                 success: true,
//                 message: 'Signature Verified and Course Added'
//             })
//         }

//         catch (error) {
//             console.log('Error while verifing rajorpay signature');
//             console.log(error);
//             return res.status(500).json({
//                 success: false,
//                 error: error.messsage,
//                 message: 'Error while verifing rajorpay signature'
//             });
//         }
//     }

//     else {
//         return res.status(400).json({
//             success: false,
//             message: 'Invalid signature'
//         });
//     }
// }
