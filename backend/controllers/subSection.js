const Section = require('../models/section');
const SubSection = require('../models/subSection');
const Course = require('../models/course');
const { uploadImageToCloudinary, deleteResourceFromCloudinary } = require('../utils/imageUploader');



// ================ create SubSection ================
exports.createSubSection = async (req, res) => {
    try {
        // extract data
        const { title, description, sectionId, courseId } = req.body;

        // extract video file
        const videoFile = req.files.video || req.files.videoFile;

        // validation
        if (!title || !description || !videoFile || !sectionId || !courseId) {
            console.log("Create SubSection Validation Failure:", { title, description, sectionId, courseId, hasVideo: !!videoFile });
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            })
        }

        // upload video to cloudinary
        console.log(`[Cloudinary] Uploading lecture video for: ${title}`);
        const videoFileDetails = await uploadImageToCloudinary(videoFile, process.env.FOLDER_NAME);
        console.log(`[Cloudinary] Video Upload Success: ${videoFileDetails.secure_url}`);

        // create entry in DB
        const SubSectionDetails = await SubSection.create({
            title,
            timeDuration: videoFileDetails.duration,
            description,
            videoUrl: videoFileDetails.secure_url
        })

        // link subsection id to section
        await Section.findByIdAndUpdate(
            { _id: sectionId },
            { $push: { subSection: SubSectionDetails._id } },
            { new: true }
        )

        // Return the full course details to keep frontend in perfect sync
        const updatedCourse = await Course.findById(courseId)
            .populate({
                path: "instructor",
                populate: { path: "additionalDetails" },
            })
            .populate("category")
            .populate("ratingAndReviews")
            .populate({
                path: "courseContent",
                populate: { path: "subSection" },
            })
            .exec()

        console.log(`[Database] SubSection created and Course fully refreshed: ${courseId}`);

        // return response
        res.status(200).json({
            success: true,
            data: updatedCourse,
            message: 'SubSection created successfully'
        });
    }
    catch (error) {
        console.error('Error while creating SubSection:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Error while creating SubSection'
        })
    }
}



// ================ Update SubSection ================
exports.updateSubSection = async (req, res) => {
    try {
        const { sectionId, subSectionId, title, description, courseId } = req.body;

        // validation
        if (!subSectionId || !sectionId || !courseId) {
            return res.status(400).json({
                success: false,
                message: 'Section, SubSection, and Course IDs are required'
            });
        }

        // find in DB
        const subSection = await SubSection.findById(subSectionId);

        if (!subSection) {
            return res.status(404).json({
                success: false,
                message: "SubSection not found",
            })
        }

        // update data
        if (title) subSection.title = title;
        if (description) subSection.description = description;

        // upload video to cloudinary if new one provided
        if (req.files && (req.files.video || req.files.videoFile)) {
            const video = req.files.video || req.files.videoFile;
            console.log(`[Cloudinary] Updating video for: ${subSectionId}`);
            const uploadDetails = await uploadImageToCloudinary(video, process.env.FOLDER_NAME);
            subSection.videoUrl = uploadDetails.secure_url;
            subSection.timeDuration = uploadDetails.duration;
            console.log(`[Cloudinary] New Video URL: ${subSection.videoUrl}`);
        }

        // save data to DB
        await subSection.save();

        // Return the full course details to keep frontend in perfect sync
        const updatedCourse = await Course.findById(courseId)
            .populate({
                path: "instructor",
                populate: { path: "additionalDetails" },
            })
            .populate("category")
            .populate("ratingAndReviews")
            .populate({
                path: "courseContent",
                populate: { path: "subSection" },
            })
            .exec()

        console.log(`[Database] SubSection updated and Course fully refreshed: ${courseId}`);

        return res.status(200).json({
            success: true,
            data: updatedCourse,
            message: "Section updated successfully",
        });
    }
    catch (error) {
        console.error('Error while updating the section:', error)
        return res.status(500).json({
            success: false,
            error: error.message,
            message: "Error while updating the section",
        })
    }
}



// ================ Delete SubSection ================
exports.deleteSubSection = async (req, res) => {
    try {
        const { subSectionId, sectionId } = req.body
        await Section.findByIdAndUpdate(
            { _id: sectionId },
            {
                $pull: {
                    subSection: subSectionId,
                },
            }
        )

        // delete from DB
        const subSection = await SubSection.findByIdAndDelete({ _id: subSectionId })

        if (!subSection) {
            return res
                .status(404)
                .json({ success: false, message: "SubSection not found" })
        }

        // delete from cloudinary
        if (subSection.videoUrl) {
            try {
                await deleteResourceFromCloudinary(subSection.videoUrl);
            } catch (err) {
                console.log("Error while deleting video from cloudinary:", err);
            }
        }

        const updatedSection = await Section.findById(sectionId).populate('subSection')

        // In frontned we have to take care - when subsection is deleted we are sending ,
        // only section data not full course details as we do in others 

        // success response
        return res.json({
            success: true,
            data: updatedSection,
            message: "SubSection deleted successfully",
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json({
            success: false,

            error: error.message,
            message: "An error occurred while deleting the SubSection",
        })
    }
}