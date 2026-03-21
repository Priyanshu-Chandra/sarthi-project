const mongoose = require("mongoose")

const courseProgressSchema = new mongoose.Schema(
    {
        courseID: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Course",
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        completedVideos: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "SubSection",
            },
        ],
        // Payment details stored at enrollment time
        orderId: {
            type: String,
            default: null,
        },
        paymentId: {
            type: String,
            default: null,
        },
        amountPaid: {
            type: Number,
            default: null,
        },
    },
    { timestamps: true }   // createdAt = enrollment / purchase date
)

module.exports = mongoose.model("CourseProgress", courseProgressSchema)


