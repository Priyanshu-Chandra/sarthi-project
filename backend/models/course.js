const mongoose = require('mongoose')

const courseSchema = new mongoose.Schema({
    courseName: {
        type: String
    },
    courseDescription: {
        type: String
    },
    instructor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    whatYouWillLearn: {
        type: String
    },
    courseContent: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Section'
        }
    ],
    ratingAndReviews: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'RatingAndReview'
        }
    ],
    price: {
        type: Number
    },
    thumbnail: {
        type: String
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category'
    },
    tag: {
        type: [String],
        required: true
    },
    studentsEnrolled: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        }
    ],
    instructions: {
        type: [String]
    },
    status: {
        type: String,
        enum: ['Draft', 'Published']
    },
    courseStatus: {
        type: String,
        enum: ['ONGOING', 'COMPLETED'],
        default: 'ONGOING'
    },
    isCertificateEnabled: {
        type: Boolean,
        default: false
    },
    isLive: {
        type: Boolean,
        default: false
    },
    liveRoomId: {
        type: String,
        default: null
    },
    createdAt: {
        type: Date,
    }
    ,
    updatedAt: {
        type: Date,
    },
    lastNotificationSentAt: {
        type: Date,
    },
    lastHeartbeatAt: {
        type: Date,
        default: null
    },
    liveStartedAt: {
        type: Date,
        default: null
    },
    lastLiveClassStartedAt: {
        type: Date,
        default: null
    }

});

courseSchema.index(
    { instructor: 1, isLive: 1 },
    { unique: true, partialFilterExpression: { isLive: true } }
);

module.exports = mongoose.model('Course', courseSchema);
