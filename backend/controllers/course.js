const Course = require('../models/course');
const User = require('../models/user');
const Category = require('../models/category');
const Section = require('../models/section')
const SubSection = require('../models/subSection')
const CourseProgress = require('../models/courseProgress')
const Certificate = require('../models/Certificate');
const mailSender = require("../utils/mailSender");
const puppeteer = require("puppeteer")
const QRCode = require("qrcode")
const newCourseEmail = require("../mail/templates/newCoursePublished");
const { courseUpdateNotificationEmail } = require("../mail/templates/courseUpdateNotification");

const { uploadImageToCloudinary, deleteResourceFromCloudinary } = require('../utils/imageUploader');
const { convertSecondsToDuration } = require("../utils/secToDuration")
const { checkCourseEligibility } = require("../services/testEligibilityService");



// // ================ create new course ================
// exports.createCourse = async (req, res) => {
//     try {
//         // extract data
//         let { courseName, courseDescription, whatYouWillLearn, price, category, instructions: _instructions, status, tag: _tag } = req.body;

//         // Convert the tag and instructions from stringified Array to Array
//         const tag = JSON.parse(_tag)
//         const instructions = JSON.parse(_instructions)

//         // console.log("tag = ", tag)
//         // console.log("instructions = ", instructions)

//         // get thumbnail of course
//         const thumbnail = req.files?.thumbnailImage;

//         // validation
//         if (!courseName || !courseDescription || !whatYouWillLearn || !price
//             || !category || !thumbnail || !instructions.length || !tag.length) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'All Fileds are required'
//             });
//         }

//         if (!status || status === undefined) {
//             status = "Draft";
//         }

//         // check current user is instructor or not , bcoz only instructor can create 
//         // we have insert user id in req.user , (payload , while auth ) 
//         const instructorId = req.user.id;


//         // check given category is valid or not
//         const categoryDetails = await Category.findById(category);
//         if (!categoryDetails) {
//             return res.status(401).json({
//                 success: false,
//                 message: 'Category Details not found'
//             })
//         }


//         // upload thumbnail to cloudinary
//         const thumbnailDetails = await uploadImageToCloudinary(thumbnail, process.env.FOLDER_NAME);

//         // create new course - entry in DB
//         const newCourse = await Course.create({
//             courseName, courseDescription, instructor: instructorId, whatYouWillLearn, price, category: categoryDetails._id,
//             tag, status, instructions, thumbnail: thumbnailDetails.secure_url, createdAt: Date.now(),
//         });

//         // add course id to instructor courses list, this is bcoz - it will show all created courses by instructor 
//         await User.findByIdAndUpdate(instructorId,
//             {
//                 $push: {
//                     courses: newCourse._id
//                 }
//             },
//             { new: true }
//         );


//         // Add the new course to the Categories
//         await Category.findByIdAndUpdate(
//             { _id: category },
//             {
//                 $push: {
//                     courses: newCourse._id,
//                 },
//             },
//             { new: true }
//         );

//         // return response
//         res.status(200).json({
//             success: true,
//             data: newCourse,
//             message: 'New Course created successfully'
//         })
//     }

//     catch (error) {
//         console.log('Error while creating new course');
//         console.log(error);
//         res.status(500).json({
//             success: false,
//             error: error.message,
//             message: 'Error while creating new course'
//         })
//     }
// }
//const mailSender = require("../utils/mailSender");
// ================ create new course ================


exports.createCourse = async (req, res) => {
  try {

    console.log("===== CREATE COURSE START =====");

    // extract data
    let {
      courseName,
      courseDescription,
      whatYouWillLearn,
      price,
      category,
      instructions: _instructions,
      status,
      tag: _tag
    } = req.body;

    const tag = JSON.parse(_tag);
    const instructions = JSON.parse(_instructions);

    const thumbnail = req.files?.thumbnailImage;

    console.log("Course Name:", courseName);
    console.log("Course Status:", status);

    // validation
    if (
      !courseName ||
      !courseDescription ||
      !whatYouWillLearn ||
      !price ||
      !category ||
      !thumbnail ||
      !instructions.length ||
      !tag.length
    ) {
      console.log("Validation Failed");

      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    if (!status || status === undefined) {
      status = "Draft";
    }

    const instructorId = req.user.id;

    console.log("Instructor ID:", instructorId);

    // check category
    const categoryDetails = await Category.findById(category);

    if (!categoryDetails) {
      console.log("Category not found");

      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    console.log("Category found:", categoryDetails.name);

    // upload thumbnail
    const thumbnailDetails = await uploadImageToCloudinary(
      thumbnail,
      process.env.FOLDER_NAME
    );

    console.log("Thumbnail uploaded:", thumbnailDetails.secure_url);

    // create course
    const newCourse = await Course.create({
      courseName,
      courseDescription,
      instructor: instructorId,
      whatYouWillLearn,
      price,
      category: categoryDetails._id,
      tag,
      status,
      instructions,
      thumbnail: thumbnailDetails.secure_url,
      createdAt: Date.now()
    });

    console.log("Course created successfully:", newCourse._id);

    // add course to instructor
    await User.findByIdAndUpdate(
      instructorId,
      {
        $push: { courses: newCourse._id }
      },
      { new: true }
    );

    console.log("Course added to instructor");

    // add course to category
    await Category.findByIdAndUpdate(
      category,
      {
        $push: { courses: newCourse._id }
      },
      { new: true }
    );

    console.log("Course added to category");

    // ================= EMAIL FEATURE =================
    if (status === "Published") {
      newCourse.lastNotificationSentAt = Date.now();
      await newCourse.save();

      console.log("Course is Published → Starting promo emails to all students");

      // get instructor details
      const instructorDetails = await User.findById(instructorId);

      console.log(
        "Instructor:",
        instructorDetails.firstName,
        instructorDetails.lastName
      );

      // find all students
      const students = await User.find({
        accountType: "Student"
      }).select("email firstName");

      console.log(`[Notification] Found ${students.length} students to notify.`);

      if (students.length === 0) {
        console.log("[Notification] No students found. Skipping emails.");
      }

      // Sequential email sending for reliable delivery
      for (const student of students) {
        try {
          console.log(`[Notification] Sending promo mail to: ${student.email}`);
          const emailBody = newCourseEmail(
            student.firstName,
            `${instructorDetails.firstName} ${instructorDetails.lastName}`,
            courseName,
            courseDescription
          );
          await mailSender(
            student.email,
            `📢 New Course Published: ${courseName}`,
            emailBody
          );
          console.log(`[Notification] Promo Success: Sent to ${student.email}`);
          // Configurable delay between emails (default 100ms)
          const delayMs = process.env.MAIL_DELAY_MS ? parseInt(process.env.MAIL_DELAY_MS) : 100;
          await new Promise(resolve => setTimeout(resolve, delayMs));
        } catch (error) {
          console.error(`[Notification] Promo FAILED: Could not send to ${student.email} | Error: ${error.message}`);
        }
      }

      console.log("All student emails sent successfully");
    }

    console.log("===== CREATE COURSE END =====");

    return res.status(200).json({
      success: true,
      data: newCourse,
      message: "New Course created successfully"
    });

  } catch (error) {

    console.log("ERROR IN CREATE COURSE");
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Error while creating course",
      error: error.message
    });
  }
};

// ================ show all courses ================
exports.getAllCourses = async (req, res) => {
    try {
        const allCourses = await Course.find({},
            {
                courseName: true, courseDescription: true, price: true, thumbnail: true, instructor: true,
                ratingAndReviews: true, studentsEnrolled: true, isLive: true, liveRoomId: true
            })
            .populate({
                path: 'instructor',
                select: 'firstName lastName email image'
            })
            .populate("ratingAndReviews")
            .exec();

        return res.status(200).json({
            success: true,
            data: allCourses,
            message: 'Data for all courses fetched successfully'
        });
    }

    catch (error) {
        console.log('Error while fetching data of all courses');
        console.log(error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Error while fetching data of all courses'
        })
    }
}



// ================ Get Course Details ================
exports.getCourseDetails = async (req, res) => {
    try {
        // get course ID
        const { courseId } = req.body;

        // find course details
        const courseDetails = await Course.findOne({
            _id: courseId,
        })
            .populate({
                path: "instructor",
                populate: {
                    path: "additionalDetails",
                },
            })
            .populate("category")
            .populate("ratingAndReviews")

            .populate({
                path: "courseContent",
                populate: {
                    path: "subSection",
                    select: "-videoUrl",
                },
            })
            .exec()


        //validation
        if (!courseDetails) {
            return res.status(400).json({
                success: false,
                message: `Could not find the course with ${courseId}`,
            });
        }

        // if (courseDetails.status === "Draft") {
        //   return res.status(403).json({
        //     success: false,
        //     message: `Accessing a draft course is forbidden`,
        //   });
        // }

        // console.log('courseDetails -> ', courseDetails)
        let totalDurationInSeconds = 0
        courseDetails.courseContent.forEach((content) => {
            content.subSection.forEach((subSection) => {
                const timeDurationInSeconds = parseInt(subSection.timeDuration)
                totalDurationInSeconds += timeDurationInSeconds
            })
        })

        const totalDuration = convertSecondsToDuration(totalDurationInSeconds)

        //return response
        return res.status(200).json({
            success: true,
            data: {
                courseDetails,
                totalDuration,
            },
            message: 'Fetched course data successfully'
        })
    }

    catch (error) {
        console.log('Error while fetching course details');
        console.log(error);
        return res.status(500).json({
            success: false,
            error: error.message,
            message: 'Error while fetching course details',
        });
    }
}


// ================ Get Full Course Details ================
exports.getFullCourseDetails = async (req, res) => {
    try {
        const { courseId } = req.body
        const userId = req.user.id
        // console.log('courseId userId  = ', courseId, " == ", userId)

        const courseDetails = await Course.findOne({
            _id: courseId,
        })
            .populate({
                path: "instructor",
                populate: {
                    path: "additionalDetails",
                },
            })
            .populate("category")
            .populate("ratingAndReviews")
            .populate({
                path: "courseContent",
                populate: {
                    path: "subSection",
                },
            })
            .exec()

        let courseProgressCount = await CourseProgress.findOne({
            courseID: courseId,
            userId: userId,
        })

        //   console.log("courseProgressCount : ", courseProgressCount)

        if (!courseDetails) {
            return res.status(404).json({
                success: false,
                message: `Could not find course with id: ${courseId}`,
            })
        }

        // if (courseDetails.status === "Draft") {
        //   return res.status(403).json({
        //     success: false,
        //     message: `Accessing a draft course is forbidden`,
        //   });
        // }

        //   count total time duration of course
        let totalDurationInSeconds = 0
        courseDetails.courseContent.forEach((content) => {
            content.subSection.forEach((subSection) => {
                const timeDurationInSeconds = parseInt(subSection.timeDuration)
                totalDurationInSeconds += timeDurationInSeconds
            })
        })

        const totalDuration = convertSecondsToDuration(totalDurationInSeconds)
        const certificateEligibility = await checkCourseEligibility(userId, courseId)

        return res.status(200).json({
            success: true,
            data: {
                courseDetails,
                totalDuration,
                completedVideos: courseProgressCount?.completedVideos ? courseProgressCount?.completedVideos : [],
                certificateEligibility,
                isLive: courseDetails.isLive || false,
                liveRoomId: courseDetails.liveRoomId || null,
            },
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        })
    }
}



exports.markCourseAsCompleted = async (req, res) => {
    try {
        const { courseId } = req.params

        const course = await Course.findById(courseId)

        if (!course) {
            return res.status(404).json({
                success: false,
                message: "Course not found",
            })
        }

        if (req.user?.accountType !== "Instructor") {
            return res.status(403).json({
                success: false,
                message: "Only instructors can perform this action",
            })
        }

        if (course.instructor.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to update this course",
            })
        }

        if (course.courseStatus === "COMPLETED") {
            return res.status(200).json({
                success: true,
                message: "Course already marked as completed",
                data: course,
            })
        }

        course.courseStatus = "COMPLETED"
        await course.save()

        return res.status(200).json({
            success: true,
            message: "Course marked as completed successfully",
            data: course,
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        })
    }
}

exports.enableCertificateForCourse = async (req, res) => {
    try {
        const { courseId } = req.params

        const course = await Course.findById(courseId)

        if (!course) {
            return res.status(404).json({
                success: false,
                message: "Course not found",
            })
        }

        if (req.user?.accountType !== "Instructor") {
            return res.status(403).json({
                success: false,
                message: "Only instructors can perform this action",
            })
        }

        if (course.instructor.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to update this course",
            })
        }

        if (course.courseStatus !== "COMPLETED") {
            return res.status(400).json({
                success: false,
                message: "Course not completed yet",
            })
        }

        if (course.isCertificateEnabled) {
            return res.status(200).json({
                success: true,
                message: "Certificate already enabled for this course",
                data: course,
            })
        }

        course.isCertificateEnabled = true
        await course.save()

        return res.status(200).json({
            success: true,
            message: "Certificate enabled successfully",
            data: course,
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        })
    }
}
// ================ Verify Certificate ================
exports.verifyCertificate = async (req, res) => {
    try {
        const { certificateId } = req.params;

        // Find certificate by id
        const certificate = await Certificate.findOne({ certificateId })
            .populate("studentId", "firstName lastName")
            .populate({
                path: "courseId",
                select: "courseName instructor",
                populate: {
                    path: "instructor",
                    select: "firstName lastName"
                }
            });

        if (!certificate) {
            return res.status(404).json({ valid: false, message: "Invalid Certificate ID" });
        }

        const studentName = `${certificate.studentId?.firstName || ""} ${certificate.studentId?.lastName || ""}`.trim();
        const courseName = certificate.courseId?.courseName;
        const instructorName = `${certificate.courseId?.instructor?.firstName || ""} ${certificate.courseId?.instructor?.lastName || ""}`.trim();

        return res.status(200).json({
            valid: true,
            message: "Certificate is valid",
            certificateId,
            studentName,
            courseName,
            instructorName,
            issuedAt: certificate.issuedAt
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ valid: false, message: "Server Error" });
    }
};

exports.downloadCertificate = async (req, res) => {
    let browser

    try {
        const { courseId } = req.params
        const userId = req.user.id

        const course = await Course.findById(courseId).populate("instructor", "firstName lastName")
        if (!course) {
            return res.status(404).json({
                success: false,
                message: "Course not found",
            })
        }

        const student = await User.findById(userId).select("firstName lastName courses")
        if (!student) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            })
        }

        const isEnrolled = student.courses?.some(
            (enrolledCourseId) => enrolledCourseId.toString() === courseId
        )

        if (!isEnrolled) {
            return res.status(403).json({
                success: false,
                message: "You are not enrolled in this course",
            })
        }

        if (course.courseStatus !== "COMPLETED") {
            return res.status(400).json({
                success: false,
                message: "Course not completed yet",
            })
        }

        if (course.isCertificateEnabled !== true) {
            return res.status(400).json({
                success: false,
                message: "Certificate is not enabled for this course",
            })
        }

        const { eligible } = await checkCourseEligibility(userId, courseId)
        if (eligible !== true) {
            return res.status(403).json({
                success: false,
                message: "You are not eligible for this certificate",
            })
        }

        const escapeHtml = (str) => str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;")

        const studentName = `${student.firstName || ""} ${student.lastName || ""}`.trim()
        const courseName = course.courseName
        const instructorName = `${course.instructor?.firstName || ""} ${course.instructor?.lastName || ""}`.trim()

        const safeStudentName = escapeHtml(studentName)
        const safeCourseName = escapeHtml(courseName)
        const safeInstructorName = escapeHtml(instructorName)
        const date = new Date().toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "long",
            year: "numeric",
        })
        let certificate = await Certificate.findOne({ studentId: userId, courseId });
        let certificateId;
        
        if (certificate) {
            certificateId = certificate.certificateId;
        } else {
            certificateId = `SARTHI-${courseId.toString().slice(-4)}-${userId.toString().slice(-4)}-${Date.now()}`;
            try {
                certificate = await Certificate.create({
                    certificateId,
                    studentId: userId,
                    courseId,
                });
            } catch (err) {
                if (err.code === 11000) {
                    certificate = await Certificate.findOne({ studentId: userId, courseId });
                    certificateId = certificate.certificateId;
                } else {
                    throw err;
                }
            }
        }
        const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify/${certificateId}`;
        const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl);

        const certificateHtml = `
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset="UTF-8" />
                    <style>
                        body {
                            margin: 0;
                            padding: 0;
                            font-family: Georgia, serif;
                            background: #f8f4ea;
                            color: #1f2937;
                        }
                        .page {
                            width: 100%;
                            min-height: 100vh;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            padding: 40px;
                            box-sizing: border-box;
                        }
                        .certificate {
                            width: 100%;
                            max-width: 1000px;
                            background: linear-gradient(135deg, #fffdf7, #f6efe0);
                            border: 12px solid #c79a3b;
                            padding: 56px 64px;
                            text-align: center;
                            box-sizing: border-box;
                        }
                        .eyebrow {
                            font-size: 14px;
                            letter-spacing: 6px;
                            text-transform: uppercase;
                            color: #8b6b2d;
                            margin-bottom: 18px;
                        }
                        .title {
                            font-size: 48px;
                            font-weight: 700;
                            margin: 0;
                            color: #111827;
                        }
                        .subtitle {
                            margin-top: 18px;
                            font-size: 20px;
                            color: #4b5563;
                        }
                        .name {
                            margin: 34px 0 16px;
                            font-size: 42px;
                            font-weight: 700;
                            color: #8b5e13;
                        }
                        .course {
                            font-size: 28px;
                            font-weight: 700;
                            margin: 20px 0;
                        }
                        .meta {
                            display: flex;
                            justify-content: space-between;
                            gap: 24px;
                            margin-top: 46px;
                            text-align: left;
                        }
                        .meta-block {
                            flex: 1;
                            border-top: 1px solid #d1b679;
                            padding-top: 12px;
                            font-size: 15px;
                            color: #374151;
                        }
                        .meta-label {
                            display: block;
                            font-size: 12px;
                            letter-spacing: 2px;
                            text-transform: uppercase;
                            color: #9a7b3f;
                            margin-bottom: 8px;
                        }
                    </style>
                </head>
                <body>
                    <div class="page">
                        <div class="certificate">
                            <div class="eyebrow">Sarthi Learning Platform</div>
                            <h1 class="title">Certificate of Completion</h1>
                            <p class="subtitle">This is proudly presented to</p>
                            <div class="name">${safeStudentName}</div>
                            <p class="subtitle">for successfully completing the course</p>
                            <div class="course">${safeCourseName}</div>
                            <p class="subtitle">
                                This certifies that the above named individual has successfully completed all required assessments without any violations.
                            </p>
                            <div class="meta">
                                <div class="meta-block">
                                    <span class="meta-label">Instructor</span>
                                    <span>${safeInstructorName}</span>
                                </div>
                                <div class="meta-block">
                                    <span class="meta-label">Date</span>
                                    <span>${date}</span>
                                </div>
                            </div>
                            
                            <div style="margin-top: 30px; display: flex; justify-content: space-between; align-items: center;">
                                <div style="font-size: 14px; text-align: left;">
                                    <p><strong>Certificate ID:</strong> ${certificateId}</p>
                                    <p>Verify at:</p>
                                    <p style="word-break: break-all;">
                                    ${verificationUrl}
                                    </p>
                                </div>

                                <div style="text-align: center;">
                                    <p style="font-size: 12px; font-weight: 600; margin-bottom: 5px;">
                                        Quick Verify
                                    </p>
                                    <img src="${qrCodeDataUrl}" style="width: 100px; height: 100px; border: 2px solid #d1b679; padding: 4px; background: white;" />
                                    <p style="font-size: 12px; color: #6b7280; margin-top: 5px;">Scan to verify</p>
                                </div>
                            </div>

                        </div>
                    </div>
                </body>
            </html>
        `

        browser = await puppeteer.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
        })

        const page = await browser.newPage()
        await page.setContent(certificateHtml, { 
            waitUntil: ["load", "networkidle0"],
            timeout: 30000 
        })

        const pdfBuffer = await page.pdf({
            format: "A4",
            printBackground: true,
            margin: {
                top: "20px",
                right: "20px",
                bottom: "20px",
                left: "20px",
            },
        })

        await browser.close()
        browser = null

        console.log(`[Certificate] Generated PDF for "${studentName}" — buffer size: ${pdfBuffer.length} bytes`)

        // Explicitly convert to Node.js Buffer if it's a Uint8Array
        const finalBuffer = Buffer.from(pdfBuffer);

        // Basic PDF signature validation
        if (finalBuffer.slice(0, 5).toString() !== "%PDF-") {
            console.error("[Certificate] PDF generation produced an invalid file signature")
            return res.status(500).json({
                success: false,
                message: "Generated file is not a valid PDF",
            })
        }

        if (finalBuffer.length < 100) {
            console.error("[Certificate] PDF buffer too small — likely generation failed")
            return res.status(500).json({
                success: false,
                message: "Failed to generate certificate PDF (file too small)",
            })
        }

        const safeFileName = studentName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '')
        
        // Use Express helper methods for more robust binary transmission
        res.type('application/pdf');
        res.set('Content-Length', finalBuffer.length);
        res.set('Content-Disposition', `attachment; filename="certificate-${safeFileName}.pdf"`);

        return res.send(finalBuffer);
    } catch (error) {
        if (browser) {
            await browser.close()
        }

        return res.status(500).json({
            success: false,
            message: error.message,
        })
    }
}

// ================ Edit Course Details ================
exports.editCourse = async (req, res) => {
    try {
        const { courseId } = req.body
        const updates = req.body
        const course = await Course.findById(courseId)

        if (!course) {
            return res.status(404).json({ error: "Course not found" })
        }

        // Capture old status BEFORE updates are applied
        const oldStatus = course.status;
        console.log(`[Status Transition Check] Old: ${oldStatus}, New: ${updates.status || 'No Change'}`);

        // If Thumbnail Image is found, update it
        if (req.files) {
            // console.log("thumbnail update")
            const thumbnail = req.files.thumbnailImage
            const thumbnailImage = await uploadImageToCloudinary(
                thumbnail,
                process.env.FOLDER_NAME
            )
            course.thumbnail = thumbnailImage.secure_url
        }

        // Update only the fields that are present in the request body
        for (const key in updates) {
            if (updates.hasOwnProperty(key)) {
                if (key === "tag" || key === "instructions") {
                    course[key] = JSON.parse(updates[key])
                } else {
                    course[key] = updates[key]
                }
            }
        }

        // updatedAt
        course.updatedAt = Date.now();

        //   save data
        await course.save()

        const updatedCourse = await Course.findOne({
            _id: courseId,
        })
            .populate({
                path: "instructor",
                populate: {
                    path: "additionalDetails",
                },
            })
            .populate("category")
            .populate("ratingAndReviews")
            .populate({
                path: "courseContent",
                populate: {
                    path: "subSection",
                },
            })
            .exec()

        // ================ NOTIFICATION FEATURE (THROTTLED) ================
        try {
            const newStatus = updates.status;
            const instructor = await User.findById(req.user.id);
            const instructorName = `${instructor.firstName} ${instructor.lastName}`;

            // Case 1: Draft -> Published (Promotional email to ALL students)
            if (oldStatus === "Draft" && newStatus === "Published") {
                console.log("TRANSITION: Draft -> Published. Sending promo emails...");
                const students = await User.find({ accountType: "Student" }).select("email firstName");
                
                // Sequential email sending for reliable delivery
                for (const student of students) {
                    try {
                        console.log(`[Notification] Sending promo mail to: ${student.email}`);
                        const emailBody = newCourseEmail(student.firstName, instructorName, updatedCourse.courseName, updatedCourse.courseDescription);
                        await mailSender(student.email, `📢 New Course Released: ${updatedCourse.courseName}`, emailBody);
                        console.log(`[Notification] Promo Success: Sent to ${student.email}`);
                        // 100ms delay between emails
                        await new Promise(resolve => setTimeout(resolve, 100));
                    } catch (error) {
                        console.error(`[Notification] Promo FAILED: Could not send to ${student.email} | Error: ${error.message}`);
                    }
                }

                await Course.findByIdAndUpdate(courseId, { lastNotificationSentAt: Date.now() });
                console.log("Promo emails sent successfully.");
            } 
            // Case 2: Published -> Published (Update notification to ENROLLED students only, throttled)
            else if (oldStatus === "Published" && newStatus === "Published") {
                const now = Date.now();
                const lastSent = course.lastNotificationSentAt ? new Date(course.lastNotificationSentAt).getTime() : 0;
                const fourHours = 4 * 60 * 60 * 1000;

                if (now - lastSent > fourHours) {
                    console.log("TRANSITION: Content Update. Sending throttled notifications to enrolled students...");
                    const enrolledStudents = await User.find({ _id: { $in: course.studentsEnrolled } }).select("email firstName");

                    if (enrolledStudents.length > 0) {
                        for (const student of enrolledStudents) {
                            try {
                                console.log(`[Notification] Sending update mail to: ${student.email}`);
                                const emailBody = courseUpdateNotificationEmail(updatedCourse.courseName, instructorName, student.firstName);
                                await mailSender(student.email, `🔄 Course Update: ${updatedCourse.courseName}`, emailBody);
                                console.log(`[Notification] Update Success: Sent to ${student.email}`);
                                // 100ms delay between emails
                                await new Promise(resolve => setTimeout(resolve, 100));
                            } catch (error) {
                                console.error(`[Notification] Update FAILED: Could not send to ${student.email} | Error: ${error.message}`);
                            }
                        }
                        
                        await Course.findByIdAndUpdate(courseId, { lastNotificationSentAt: now });
                        console.log("Throttled update notifications sent successfully.");
                    }
                } else {
                    console.log("SKIPPING NOTIFICATION: Throttled (Last sent within 4 hours)");
                }
            }
        } catch (err) {
            console.log("Error in throttled notification logic:", err);
        }

        // success response
        res.status(200).json({
            success: true,
            message: "Course updated successfully",
            data: updatedCourse,
        })
    } catch (error) {
        console.error(error)
        res.status(500).json({
            success: false,
            message: "Error while updating course",
            error: error.message,
        })
    }
}



// ================ Get a list of Course for a given Instructor ================
exports.getInstructorCourses = async (req, res) => {
    try {
        // Get the instructor ID from the authenticated user or request body
        const instructorId = req.user.id

        // Find all courses belonging to the instructor with populated content for duration calculation
        const instructorCourses = await Course.find({ 
            instructor: instructorId, 
        })
        .populate({
            path: "courseContent",
            populate: {
                path: "subSection",
            },
        })
        .sort({ createdAt: -1 })

        // Calculate duration and transform response
        const coursesWithDuration = instructorCourses.map(course => {
            let totalDurationInSeconds = 0
            course.courseContent.forEach((content) => {
                content.subSection.forEach((subSection) => {
                    totalDurationInSeconds += parseInt(subSection.timeDuration) || 0
                })
            })
            
            // Convert to readable format
            const totalDuration = convertSecondsToDuration(totalDurationInSeconds)
            
            // Return course object with flattened duration for easier frontend usage
            const courseObj = course.toObject();
            return {
                ...courseObj,
                totalDuration
            }
        })

        // Return the instructor's courses
        res.status(200).json({
            success: true,
            data: coursesWithDuration,
            message: 'Courses made by Instructor fetched successfully'
        })
    } catch (error) {
        console.error(error)
        res.status(500).json({
            success: false,
            message: "Failed to retrieve instructor courses",
            error: error.message,
        })
    }
}



// ================ Delete the Course ================
exports.deleteCourse = async (req, res) => {
    try {
        const { courseId } = req.body

        // Find the course
        const course = await Course.findById(courseId)
        if (!course) {
            return res.status(404).json({ message: "Course not found" })
        }

        // Unenroll students from the course
        const studentsEnrolled = course.studentsEnrolled
        for (const studentId of studentsEnrolled) {
            await User.findByIdAndUpdate(studentId, {
                $pull: { courses: courseId },
            })
        }

        // delete course thumbnail From Cloudinary
        await deleteResourceFromCloudinary(course?.thumbnail);

        // Delete sections and sub-sections
        const courseSections = course.courseContent
        for (const sectionId of courseSections) {
            // Delete sub-sections of the section
            const section = await Section.findById(sectionId)
            if (section) {
                const subSections = section.subSection
                for (const subSectionId of subSections) {
                    const subSection = await SubSection.findById(subSectionId)
                    if (subSection) {
                        await deleteResourceFromCloudinary(subSection.videoUrl) // delete course videos From Cloudinary
                    }
                    await SubSection.findByIdAndDelete(subSectionId)
                }
            }

            // Delete the section
            await Section.findByIdAndDelete(sectionId)
        }

        // Delete the course
        await Course.findByIdAndDelete(courseId)

        return res.status(200).json({
            success: true,
            message: "Course deleted successfully",
        })

    } catch (error) {
        console.error(error)
        return res.status(500).json({
            success: false,
            message: "Error while Deleting course",
            error: error.message,
        })
    }
}
