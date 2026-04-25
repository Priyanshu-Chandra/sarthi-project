const io = require("socket.io-client");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const SOCKET_URL = "http://localhost:5000";
const JWT_SECRET = process.env.JWT_SECRET || "Priyanshu";

const testHandLoweringOnDisconnect = async () => {
    console.log("🧪 Starting Reliability Test: Hand-Lowering on Disconnect...");

    const userId = new mongoose.Types.ObjectId().toString();
    const roomId = "test-reliability-room";
    const token = jwt.sign({ id: userId, accountType: "Student" }, JWT_SECRET);

    // Listener socket (another student) to monitor
    const listenerId = new mongoose.Types.ObjectId().toString();
    const listToken = jwt.sign({ id: listenerId, accountType: "Student" }, JWT_SECRET);
    
    const instSocket = io(SOCKET_URL, { auth: { token: listToken } });
    const studSocket = io(SOCKET_URL, { auth: { token } });

    let handLoweredReceived = false;

    instSocket.on("connect", () => {
         instSocket.emit("join-room", { roomId, token: listToken, name: "Listener" });
    });

    instSocket.on("hand-lowered", (data) => {
        if (data.userId === userId) {
            console.log("✅ Success: hand-lowered event received for disconnecting student.");
            handLoweredReceived = true;
        }
    });

    studSocket.on("connect", () => {
        studSocket.emit("join-room", { roomId, token, name: "Test Student" });
        
        setTimeout(() => {
            console.log("📡 Student raising hand...");
            studSocket.emit("raise-hand", { roomId, user: { id: userId, name: "Test Student" } });

            setTimeout(() => {
                console.log("🔌 Student disconnecting suddenly...");
                studSocket.disconnect();
            }, 1000);
        }, 1000);
    });

    // Wait for event
    setTimeout(() => {
        if (!handLoweredReceived) {
            console.error("❌ Failure: hand-lowered event NOT received after disconnect.");
            process.exit(1);
        } else {
            console.log("🏁 Test completed successfully.");
            process.exit(0);
        }
    }, 5000);
};

testHandLoweringOnDisconnect();
