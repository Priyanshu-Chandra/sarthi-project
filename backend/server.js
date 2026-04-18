const express = require('express');
const app = express();

// packages
const fileUpload = require('express-fileupload');
const cookieParser = require('cookie-parser');
const cors = require('cors');
require('dotenv').config();

// connection to DB and cloudinary
const { connectDB } = require('./config/database');
const { cloudinaryConnect } = require('./config/cloudinary');
const { validateEnvironment } = require('./utils/startupCheck');

// Validate environment early 
validateEnvironment();

// routes
const userRoutes = require('./routes/user');
const profileRoutes = require('./routes/profile');
const paymentRoutes = require('./routes/payments');
const courseRoutes = require('./routes/course');
const studyPlanner = require("./routes/studyPlanner");


// middleware 
app.use(express.json()); // to parse json body
app.use(cookieParser());
app.use(
    cors({
        // origin: 'http://localhost:5173', // frontend link
        origin: "*",
        credentials: true,
        exposedHeaders: ["Content-Disposition"]
    })
);
app.use(
    fileUpload({
        useTempFiles: true,
        tempFileDir: '/tmp'
    })
)


const PORT = process.env.PORT || 5000;

const chatRoute = require("./routes/chatRoute");

// Simple request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use("/api/chat", chatRoute);
app.use("/api", studyPlanner);

const testRoutes = require("./routes/testRoute.js");



app.listen(PORT, () => {
    console.log(`Server Started on PORT ${PORT}`);
});

// connections
connectDB();
cloudinaryConnect();

// mount route
app.use('/api/v1/auth', userRoutes);
app.use('/api/v1/profile', profileRoutes);
app.use('/api/v1/payment', paymentRoutes);
app.use('/api/v1/course', courseRoutes);
app.use('/api/v1/test', testRoutes);
const codeRoutes = require("./routes/codeRoutes");
app.use("/api/v1/code", codeRoutes);
const problemRoutes = require("./routes/problemRoutes");
app.use("/api/v1/problems", problemRoutes);
const codingAIRoute = require("./routes/codingAIRoute");
app.use("/api/v1/ai", codingAIRoute);
const analysisRoutes = require("./routes/analysisRoutes");
app.use("/api/v1/analysis", analysisRoutes);
const recommendationRoutes = require("./routes/recommendationRoutes");
app.use("/api/v1/recommendation", recommendationRoutes);

const analyticsRoutes = require("./routes/analytics");
app.use("/api/analytics", analyticsRoutes);

const instructorAnalyticsRoutes = require("./routes/instructorAnalytics");
app.use("/api/instructor", instructorAnalyticsRoutes);

const cheatingAnalyticsRoutes = require("./routes/cheatingAnalytics");
app.use("/api/cheating", cheatingAnalyticsRoutes);

const leaderboardRoutes = require("./routes/leaderboard");
app.use("/api/v1/leaderboard", leaderboardRoutes);

const systemRoutes = require("./routes/systemRoutes");
app.use("/api/v1/system", systemRoutes);



// Default Route
app.get('/', (req, res) => {
    // console.log('Your server is up and running..!');
    res.send(`<div>
    This is Default Route  
    <p>Everything is OK</p>
    </div>`);
})
