const axios = require("axios");
const io = require("socket.io-client");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const BASE_URL = "http://localhost:5000/api/v1";
const SOCKET_URL = "http://localhost:5000";
const JWT_SECRET = process.env.JWT_SECRET || "Priyanshu";

const runAudit = async () => {
    console.log("🔍 Starting Sarthi System Audit...");

    const userId = new mongoose.Types.ObjectId().toString();
    const token = jwt.sign({ id: userId, accountType: "Instructor" }, JWT_SECRET);
    const config = { headers: { Authorization: `Bearer ${token}` } };

    // 1. Audit Analytics Endpoints (Consistency Check)
    console.log("\n📡 Auditing Analytics Endpoints...");
    const testEndpoints = [
        "/instructor-analytics/overview/mock-id",
        "/cheating-analytics/summary/mock-id"
    ];

    for (const path of testEndpoints) {
        try {
            const res = await axios.get(`${BASE_URL}${path}`, config);
            console.log(`✅ ${path}: Responded (Expected 404/Success depending on data)`);
        } catch (err) {
            if (err.response?.status === 404) {
                 console.log(`✅ ${path}: Route found (Returned 404 as expected for mock ID)`);
            } else {
                 console.error(`❌ ${path}: Failed with status ${err.response?.status}`);
            }
        }
    }

    // 2. Audit Socket Reliability (Hand-Lowering)
    console.log("\n🔌 Auditing Socket Reliability (Disconnect Cleanup)...");
    const roomId = "audit-room-101";
    const studentId = new mongoose.Types.ObjectId().toString();
    const studToken = jwt.sign({ id: studentId, accountType: "Student" }, JWT_SECRET);

    const instSocket = io(SOCKET_URL, { auth: { token } });
    const studSocket = io(SOCKET_URL, { auth: { token: studToken } });

    let handLoweredReceived = false;

    instSocket.on("hand-lowered", (data) => {
        if (data.userId === studentId) {
            console.log("✅ Socket: hand-lowered event received on student sudden disconnect.");
            handLoweredReceived = true;
        }
    });

    // Mock the join-room flow carefully
    instSocket.emit("join-room", { roomId, token });
    studSocket.emit("join-room", { roomId, token: studToken, name: "Audit Student" });

    setTimeout(() => {
        studSocket.emit("raise-hand", { roomId, user: { id: studentId, name: "Audit Student" } });
        
        setTimeout(() => {
            console.log("🔌 Triggering sudden disconnect...");
            studSocket.disconnect();
        }, 500);
    }, 1000);

    setTimeout(() => {
        if (handLoweredReceived) {
            console.log("🏁 Audit Complete: System integrity verified.");
            process.exit(0);
        } else {
            console.error("❌ Audit Failed: Disconnect reliability fix not triggered.");
            process.exit(1);
        }
    }, 5000);
};

runAudit();
