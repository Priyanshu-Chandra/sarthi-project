/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  Sarthi INTERACTIVE FEATURES Verification Script (V3 - Final)
 *  Verified: Polls, Hand Resolution, Chat, Whiteboard Sync
 * ─────────────────────────────────────────────────────────────────────────────
 */

const mongoose = require("mongoose");
const jwt      = require("jsonwebtoken");
const axios    = require("axios");
const { io: Client } = require("socket.io-client");
require("dotenv").config();

const { connectDB } = require("./config/database");
const User     = require("./models/user");
const Profile  = require("./models/profile");
const Course   = require("./models/course");
const Category = require("./models/category");

const PORT     = process.env.PORT || 5000;
const BASE     = `http://localhost:${PORT}`;
const API_BASE = `${BASE}/api/v1`;

const G = (s) => `\x1b[32m${s}\x1b[0m`;
const R = (s) => `\x1b[31m${s}\x1b[0m`;
const Y = (s) => `\x1b[33m${s}\x1b[0m`;
const B = (s) => `\x1b[1m${s}\x1b[0m`;
const C = (s) => `\x1b[36m${s}\x1b[0m`;

let passed = 0, failed = 0;

const assert = (label, cond, ctx = "") => {
  if (cond) { 
    console.log(G("  ✅ PASS") + ` — ${label}`); 
    passed++; 
  } else { 
    console.log(R("  ❌ FAIL") + ` — ${label}` + (ctx ? `\n       ${Y(ctx)}` : "")); 
    failed++; 
  }
};

const wait = (ms) => new Promise(r => setTimeout(r, ms));

const run = async () => {
    console.log(B("\n══════════════════════════════════════════════════════════════"));
    console.log(B("   Sarthi INTERACTIVE FEATURES — Functional Audit V3"));
    console.log(B("══════════════════════════════════════════════════════════════\n"));

    await connectDB();
    
    // 1. Setup
    console.log(C("🧹 Setting up test environment..."));
    await User.deleteMany({ email: { $regex: "_interactivetest_" } });
    await Course.deleteMany({ courseName: { $regex: "__INTERACTIVE__" } });

    const pI = await Profile.create({});
    const pS = await Profile.create({});

    const instructor = await User.create({
        firstName: "Inst", lastName: "Interact", email: "inst_interactivetest_@test.com",
        password: "h", accountType: "Instructor", approved: true, additionalDetails: pI._id,
        image: "https://api.dicebear.com/5.x/initials/svg?seed=II"
    });
    const student = await User.create({
        firstName: "Stud", lastName: "Interact", email: "stud_interactivetest_@test.com",
        password: "h", accountType: "Student", approved: true, additionalDetails: pS._id,
        image: "https://api.dicebear.com/5.x/initials/svg?seed=SI"
    });

    const cat = await Category.findOne({});
    const course = await Course.create({
        courseName: "__INTERACTIVE__Course", instructor: instructor._id,
        category: cat._id, status: "Published", courseStatus: "ONGOING",
        studentsEnrolled: [student._id], price: 0
    });

    const sign = (u) => jwt.sign({ id: u._id, email: u.email, accountType: u.accountType }, process.env.JWT_SECRET);
    const instToken = sign(instructor);
    const studToken = sign(student);

    const startRes = await axios.post(`${API_BASE}/live-class/start`, { courseId: course._id }, { headers: { Authorization: `Bearer ${instToken}` }});
    const { roomId } = startRes.data;

    // Connect Sockets
    const instSocket = Client(BASE, { transports: ["websocket"], forceNew: true });
    const studSocket = Client(BASE, { transports: ["websocket"], forceNew: true });

    await new Promise(r => {
        instSocket.on("connect", () => instSocket.emit("join-room", { roomId, token: instToken }));
        studSocket.on("connect", () => studSocket.emit("join-room", { roomId, token: studToken, name: "Student Alpha" }));
        setTimeout(r, 2000); 
    });

    // ──────────────────────────────────────────────────────────────────────────
    console.log("\n" + B("📊 TEST 1: POLL AUTO-CLOSE DURATION"));
    instSocket.emit("create-poll", { roomId, poll: { question: "Hardened?", options: ["Yes", "Maybe"], duration: 3 } });
    
    let pollClosedEvent = false;
    studSocket.on("poll-closed", () => { pollClosedEvent = true; });

    console.log("  Waiting for 3s poll duration...");
    await wait(4500); 
    assert("Poll automatically closed after specified duration", pollClosedEvent === true);

    // ──────────────────────────────────────────────────────────────────────────
    console.log("\n" + B("🤚 TEST 2: RAISE HAND -> RESOLVE -> USER_UNMUTED"));
    let unmutedReceived = false;
    let handLoweredReceived = false;
    studSocket.on("USER_UNMUTED", () => { unmutedReceived = true; });
    studSocket.on("hand-lowered", () => { handLoweredReceived = true; });

    studSocket.emit("raise-hand", { roomId, user: { id: student._id.toString(), name: "Student Alpha" } });
    await wait(800);
    
    instSocket.emit("RESOLVE_HAND", { roomId, userId: student._id.toString(), name: "Student Alpha" });
    await wait(1000);
    assert("Student received USER_UNMUTED on hand resolution", unmutedReceived === true);
    assert("Hand correctly lowered on resolution", handLoweredReceived === true);

    // ──────────────────────────────────────────────────────────────────────────
    console.log("\n" + B("💬 TEST 3: CHAT ACK & BROADCAST"));
    let ackReceived = false;
    let messageReceived = false;
    instSocket.on("receive-message", () => { messageReceived = true; });

    studSocket.emit("send-message", { roomId, message: { text: "Testing telemetry hardening" } }, (ack) => {
        if (ack?.status === "success") ackReceived = true;
    });
    await wait(1500);
    assert("Chat: Server returned status:'success' ACK for message", ackReceived === true);
    assert("Chat: Message broadcasted to other participants", messageReceived === true);

    // ──────────────────────────────────────────────────────────────────────────
    console.log("\n" + B("🎨 TEST 4: WHITEBOARD SYNC (permission-aware)"));
    let drawReceived = false;
    instSocket.on("draw-update", () => { drawReceived = true; });

    // Grant permission 
    instSocket.emit("ALLOW_BOARD", { userId: student._id.toString() });
    await wait(800);

    studSocket.emit("board-draw", { 
      roomId, 
      stroke: { 
        from: { x: 0.1, y: 0.1 }, 
        to: { x: 0.2, y: 0.2 }, 
        tool: { type: "pen", size: 5, color: "#ff0000" } 
      } 
    });
    await wait(1500);
    assert("Whiteboard: Student drawing synced to instructor (draw-update)", drawReceived === true);

    // 🏁 FINISH
    console.log("\n" + C("🧹 Cleaning up..."));
    instSocket.emit("end-live-class", { roomId });
    await wait(2000);

    await User.deleteMany({ email: { $regex: "_interactivetest_" } });
    await Course.deleteMany({ courseName: { $regex: "__INTERACTIVE__" } });
    
    console.log("\n" + B("══════════════════════════════════════════════════════════════"));
    console.log(`   Passed : ${passed} | Failed : ${failed}`);
    process.exit(failed > 0 ? 1 : 0);
};

run().catch(e => { console.error(e); process.exit(1); });
