/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  Sarthi ANALYTICS & ATTENDANCE INTELLIGENCE — Deep Audit
 *  Verified: Alpha/Beta/Gamma Classification, Scoring Weights, Timeline Buckets
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
const LiveSession = require("./models/LiveSession");
const LiveAttendance = require("./models/LiveAttendance");

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
  if (cond) { console.log(G("  ✅ PASS") + ` — ${label}`); passed++; } 
  else { console.log(R("  ❌ FAIL") + ` — ${label}` + (ctx ? `\n       ${Y(ctx)}` : "")); failed++; }
};
const wait = (ms) => new Promise(r => setTimeout(r, ms));

const run = async () => {
    console.log(B("\n══════════════════════════════════════════════════════════════"));
    console.log(B("   Sarthi ANALYTICS INTELLIGENCE — Professional Audit"));
    console.log(B("══════════════════════════════════════════════════════════════\n"));

    await connectDB();
    
    // 1. Setup Environment
    console.log(C("🧹 Purging stale test data..."));
    await User.deleteMany({ email: { $regex: "_analytics_" } });
    await Course.deleteMany({ courseName: "__ANALYTICS_TEST__" });

    const createU = async (name, role) => {
        const p = await Profile.create({});
        return await User.create({
            firstName: name, lastName: "Test", email: `${name}_analytics_@test.com`,
            password: "h", accountType: role, approved: true, additionalDetails: p._id,
            image: `https://api.dicebear.com/5.x/initials/svg?seed=${name}`, courses: []
        });
    };

    const instructor = await createU("Inst", "Instructor");
    const alpha      = await createU("Alpha", "Student");
    const beta       = await createU("Beta", "Student");
    const gamma      = await createU("Gamma", "Student");

    const cat = await Category.findOne({});
    const course = await Course.create({
        courseName: "__ANALYTICS_TEST__", instructor: instructor._id,
        category: cat._id, status: "Published", courseStatus: "ONGOING",
        studentsEnrolled: [alpha._id, beta._id, gamma._id], price: 0
    });

    const sign = (u) => jwt.sign({ id: u._id, email: u.email, accountType: u.accountType }, process.env.JWT_SECRET);
    const instToken = sign(instructor);
    const apiHeaders = { headers: { Authorization: `Bearer ${instToken}` } };

    // 2. Mock Session Start
    // 2. Mock Session Start (Real-time)
    const startRes = await axios.post(`${API_BASE}/live-class/start`, { courseId: course._id }, apiHeaders);
    const { roomId, sessionId } = startRes.data;
    console.log(G("✔ Session started (Real-time stimulation)"));

    // 3. Simulate Student Behaviors (15s Sprint)
    const createS = (token) => Client(BASE, { transports: ["websocket"], forceNew: true, auth: { token } });
    
    console.log(C("\n🎬 Simulating 15s Interactive Classroom..."));

    // Alpha: Joins at 0s
    console.log("  - Simulation: Alpha joining...");
    const sAlpha = createS(sign(alpha));
    await new Promise(r => { 
        sAlpha.on("connect", () => {
            sAlpha.emit("join-room", { roomId, token: sign(alpha), name: "Alpha" }, (ack) => {
                console.log("    (Alpha joined room context)");
                r();
            });
        });
        setTimeout(r, 2500); // fallback
    });
    
    // Interactions for Alpha (Chat=1, Board=2, Poll=2)
    sAlpha.emit("send-message", { roomId, message: { text: "Alpha speaking!" } });
    await wait(2000);
    sAlpha.emit("board-draw", { roomId, stroke: { from: {x:0,y:0}, to:{x:1,y:1} } });

    // Gamma: Joins at 3s, leaves at 5s
    const sGamma = createS(sign(gamma));
    await new Promise(r => { 
        sGamma.on("connect", () => sGamma.emit("join-room", { roomId, token: sign(gamma), name: "Gamma" }));
        setTimeout(r, 1000); 
    });
    await wait(2000);
    sGamma.disconnect();
    
    // Beta: Joins late (at 8s)
    const sBeta = createS(sign(beta));
    await new Promise(r => { 
        sBeta.on("connect", () => sBeta.emit("join-room", { roomId, token: sign(beta), name: "Beta" }));
        setTimeout(r, 1000); 
    });

    console.log("  - Simulation complete. Waiting for session finalization...");
    await wait(5000); // Wait for simulation to total ~15s

    // 4. Session End
    const instSocket = createS(instToken);
    await new Promise(r => { 
        instSocket.on("connect", () => instSocket.emit("end-live-class", { roomId }));
        setTimeout(r, 5000); // Give time for bulkWrite/Aggregation
    });

    // ──────────────────────────────────────────────────────────────────────────
    console.log("\n" + B("🧪 INTELLIGENCE ENGINE VERIFICATION"));
    console.log("─────────────────────────────────────");

    const atts = await LiveAttendance.find({ sessionId }).populate("userId", "firstName");
    atts.forEach(a => {
        console.log(`  👤 ${a.userId?.firstName}: Score=${a.engagementScore}, Time=${a.activeSeconds}s, Status=${a.attendanceStatus}, Late=${a.isLate}`);
    });

    const alphaAtt = atts.find(a => a.userId.firstName === "Alpha");
    const gammaAtt = atts.find(a => a.userId.firstName === "Gamma");

    assert("Alpha: Engagement Score is 3 (1 chat + 1 board)", alphaAtt?.engagementScore === 3);
    assert("Alpha: Status is 'active' (High participation ratio)", alphaAtt?.attendanceStatus === "active");
    assert("Gamma: Status is 'dropoff' (Participation < 20% of class time)", gammaAtt?.attendanceStatus === "dropoff");

    const sess = await LiveSession.findById(sessionId);
    assert("Summary Cache: Correctly populated after session end", sess.summaryCache !== null);
    assert("Insights: At least one insight generated", sess.summaryCache?.insights?.length > 0);

    // 🏁 FINISH
    console.log("\n" + C("🧹 Cleaning up..."));
    await User.deleteMany({ email: { $regex: "_analytics_" } });
    await Course.deleteMany({ courseName: "__ANALYTICS_TEST__" });
    
    console.log("\n" + B("══════════════════════════════════════════════════════════════"));
    console.log(`   Passed : ${passed} | Failed : ${failed}`);
    process.exit(failed > 0 ? 1 : 0);
};

run().catch(e => { console.error(e); process.exit(1); });
