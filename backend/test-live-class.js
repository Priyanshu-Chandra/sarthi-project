/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  E2E Test v2: Live Class — Rate Limiting + Access Control
 *  Tests ALL original aspects PLUS new Phase 1 & 2 guards:
 *    1.  Model schema fields
 *    2.  Auth guards (no token, wrong role)
 *    3.  Input validation
 *    4.  startLiveClass happy path
 *    5.  Rate Limit: 30s cooldown per course
 *    6.  Rate Limit: Instructor-wide lock (cannot start 2nd class while 1st live)
 *    7.  Instructor-wide lock: same course is already live
 *    8.  endLiveClass happy path
 *    9.  Double-end graceful
 *   10.  validateLiveClass: instructor access
 *   11.  validateLiveClass: enrolled student access
 *   12.  validateLiveClass: non-enrolled user → 403
 *   13.  validateLiveClass: room not live → 404
 *   14.  Certificate fields unaffected
 *   15.  Route method guards
 * ─────────────────────────────────────────────────────────────────────────────
 */

const mongoose = require("mongoose");
const jwt      = require("jsonwebtoken");
require("dotenv").config();

const { connectDB } = require("./config/database");
const User     = require("./models/user");
const Profile  = require("./models/profile");
const Course   = require("./models/course");
const Category = require("./models/category");

const PORT     = process.env.PORT || 5000;
const BASE     = `http://localhost:${PORT}`;

// ── ANSI helpers ─────────────────────────────────────────────────────────────
const G = (s) => `\x1b[32m${s}\x1b[0m`;
const R = (s) => `\x1b[31m${s}\x1b[0m`;
const Y = (s) => `\x1b[33m${s}\x1b[0m`;
const B = (s) => `\x1b[1m${s}\x1b[0m`;

let passed = 0, failed = 0;

const assert = (label, cond, ctx = "") => {
  if (cond) { console.log(G("  ✅ PASS") + ` — ${label}`); passed++; }
  else       { console.log(R("  ❌ FAIL") + ` — ${label}` + (ctx ? `\n       ${Y(ctx)}` : "")); failed++; }
};

const api = async (method, path, body = null, token = null) => {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  try {
    const res  = await fetch(`${BASE}${path}`, {
      method, headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    let data;
    try { data = await res.json(); } catch (_) { data = null; }
    return { status: res.status, data };
  } catch (err) {
    return { status: 0, error: err.message, data: null };
  }
};

// ── Main ──────────────────────────────────────────────────────────────────────
const run = async () => {
  console.log(B("\n══════════════════════════════════════════════════"));
  console.log(B("   Sarthi Live Class v2 — Full E2E Test Suite"));
  console.log(B("══════════════════════════════════════════════════\n"));

  await connectDB();
  console.log("✔  DB connected\n");

  // Cleanup
  await User.deleteMany({ email: { $regex: "_lcv2test_" } });
  await Course.deleteMany({ courseName: { $regex: "__LC2E__" } });
  await Category.deleteMany({ name: "__LC2ECategory__" });

  // ── Seed ──────────────────────────────────────────────────────────────────
  const pI  = await Profile.create({ gender: null, dateOfBirth: null, about: null, contactNumber: null });
  const pI2 = await Profile.create({ gender: null, dateOfBirth: null, about: null, contactNumber: null });
  const pS  = await Profile.create({ gender: null, dateOfBirth: null, about: null, contactNumber: null });
  const pS2 = await Profile.create({ gender: null, dateOfBirth: null, about: null, contactNumber: null });

  const instructor = await User.create({
    firstName: "Inst", lastName: "LCV2",
    email: "inst_lcv2test_@test.com", password: "h",
    accountType: "Instructor", approved: true,
    additionalDetails: pI._id,
    image: "https://api.dicebear.com/5.x/initials/svg?seed=IL",
  });

  // Second instructor (to test cross-instructor isolation)
  const instructor2 = await User.create({
    firstName: "Inst2", lastName: "LCV2",
    email: "inst2_lcv2test_@test.com", password: "h",
    accountType: "Instructor", approved: true,
    additionalDetails: pI2._id,
    image: "https://api.dicebear.com/5.x/initials/svg?seed=IL2",
  });

  const student = await User.create({
    firstName: "Stud", lastName: "LCV2",
    email: "stud_lcv2test_@test.com", password: "h",
    accountType: "Student", approved: true,
    additionalDetails: pS._id,
    image: "https://api.dicebear.com/5.x/initials/svg?seed=SL",
    courses: [],
  });

  // Non-enrolled student
  const stranger = await User.create({
    firstName: "Stranger", lastName: "LCV2",
    email: "stranger_lcv2test_@test.com", password: "h",
    accountType: "Student", approved: true,
    additionalDetails: pS2._id,
    image: "https://api.dicebear.com/5.x/initials/svg?seed=SLX",
    courses: [],
  });

  const cat  = await Category.create({ name: "__LC2ECategory__", description: "test" });

  // Course A — instructor's main course
  const courseA = await Course.create({
    courseName: "__LC2E__CourseA", courseDescription: "A",
    instructor: instructor._id,
    whatYouWillLearn: "Testing", price: 0, category: cat._id,
    tag: ["test"], status: "Published", courseStatus: "ONGOING",
    isCertificateEnabled: false, isLive: false, liveRoomId: null,
    studentsEnrolled: [student._id],
  });

  // Course B — same instructor's second course
  const courseB = await Course.create({
    courseName: "__LC2E__CourseB", courseDescription: "B",
    instructor: instructor._id,
    whatYouWillLearn: "Testing", price: 0, category: cat._id,
    tag: ["test"], status: "Published", courseStatus: "ONGOING",
    isCertificateEnabled: false, isLive: false, liveRoomId: null,
    studentsEnrolled: [],
  });

  student.courses.push(courseA._id);
  await student.save();

  const sign = (u) => jwt.sign(
    { id: u._id, email: u.email, accountType: u.accountType },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  const instToken     = sign(instructor);
  const inst2Token    = sign(instructor2);
  const studToken     = sign(student);
  const strangerToken = sign(stranger);

  const lc = (path, method = "POST", body = null, tok = null) =>
    api(method, `/api/v1/live-class${path}`, body, tok);

  // PING
  const ping = await api("GET", "/");
  if (ping.status === 0) {
    console.log(R("\n🚨 Server not running on port 5000. Start it first.\n"));
    process.exit(1);
  }

  // ══════════════════════════════════════════════════════════════════════════
  console.log(B("📋  Section 1 — Model Schema"));
  console.log("─────────────────────────────────────────────────");

  const fresh = await Course.findById(courseA._id).lean();
  assert("isLive field exists (default false)",           fresh.isLive === false);
  assert("liveRoomId field exists (default null)",        fresh.liveRoomId === null);
  // Note: Mongoose omits undefined Date fields from lean() until first write — validated in Section 4 instead
  assert("liveStartedAt field defined in schema",          fresh.hasOwnProperty("liveStartedAt"));
  assert("lastLiveClassStartedAt field defined in schema", fresh.hasOwnProperty("lastLiveClassStartedAt"));
  assert("isCertificateEnabled field intact",             fresh.hasOwnProperty("isCertificateEnabled"));
  assert("studentsEnrolled field present",                Array.isArray(fresh.studentsEnrolled));

  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n" + B("📋  Section 2 — Auth Guards"));
  console.log("─────────────────────────────────────────────────");

  assert("POST /start no token → 401/500",    [401,500].includes((await lc("/start","POST",{courseId:courseA._id})).status));
  assert("POST /start student token → 401",   (await lc("/start","POST",{courseId:courseA._id},studToken)).status === 401);
  assert("POST /end no token → 401/500",      [401,500].includes((await lc("/end","POST",{courseId:courseA._id})).status));
  assert("POST /end student token → 401",     (await lc("/end","POST",{courseId:courseA._id},studToken)).status === 401);
  assert("GET /validate no token → 401/500",  [401,500].includes((await lc("/validate/fakeRoom","GET")).status));

  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n" + B("📋  Section 3 — Input Validation"));
  console.log("─────────────────────────────────────────────────");

  const fakeId = new mongoose.Types.ObjectId().toString();
  assert("POST /start no courseId → 400",            (await lc("/start","POST",{},instToken)).status === 400);
  assert("POST /start non-existent course → 404",    (await lc("/start","POST",{courseId:fakeId},instToken)).status === 404);
  assert("POST /end no courseId → 400",              (await lc("/end","POST",{},instToken)).status === 400);
  assert("POST /end non-existent course → 404",      (await lc("/end","POST",{courseId:fakeId},instToken)).status === 404);
  assert("POST /start another instructor's course → 403", (await lc("/start","POST",{courseId:courseA._id},inst2Token)).status === 403);

  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n" + B("📋  Section 4 — Happy Path: Start"));
  console.log("─────────────────────────────────────────────────");

  const startA = await lc("/start", "POST", { courseId: courseA._id }, instToken);
  assert("POST /start → 200",                         startA.status === 200, JSON.stringify(startA.data));
  assert("response.success === true",                  startA.data?.success === true);
  assert("roomId present and non-empty",               typeof startA.data?.roomId === "string" && startA.data.roomId.length > 0);
  assert("roomId matches sarthi_<uuid> pattern",        /^sarthi_[0-9a-f-]+$/.test(startA.data?.roomId));

  const roomIdA = startA.data?.roomId;
  const dbA     = await Course.findById(courseA._id).lean();
  assert("DB: isLive = true after start",              dbA.isLive === true, `got: ${dbA.isLive}`);
  assert("DB: liveRoomId = returned roomId",           dbA.liveRoomId === roomIdA);
  assert("DB: liveStartedAt set",                      dbA.liveStartedAt !== null && dbA.liveStartedAt !== undefined);
  assert("DB: lastLiveClassStartedAt set",             dbA.lastLiveClassStartedAt !== null && dbA.lastLiveClassStartedAt !== undefined);

  const foreignEnd = await lc("/end", "POST", { courseId: courseA._id }, inst2Token);
  assert("Different instructor cannot end another instructor's live class → 403", foreignEnd.status === 403, JSON.stringify(foreignEnd.data));

  const foreignHeartbeat = await lc("/heartbeat", "POST", { courseId: courseA._id }, inst2Token);
  assert("Different instructor cannot heartbeat another instructor's live class → 403", foreignHeartbeat.status === 403, JSON.stringify(foreignHeartbeat.data));

  const impersonatedToken = await lc(
    "/token",
    "POST",
    { roomId: roomIdA, userId: stranger._id.toString(), userName: "Imposter" },
    studToken
  );
  assert("Token userId must match authenticated user → 403", impersonatedToken.status === 403, JSON.stringify(impersonatedToken.data));

  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n" + B("📋  Section 5 — Rate Limiting: 30s Cooldown"));
  console.log("─────────────────────────────────────────────────");

  // End first so the rate-limit is for the "restart" scenario
  await lc("/end", "POST", { courseId: courseA._id }, instToken);

  // Immediately try to restart — lastLiveClassStartedAt is very recent
  const rlRes = await lc("/start", "POST", { courseId: courseA._id }, instToken);
  assert("Immediate re-start → 429 (rate limited)",   rlRes.status === 429, `Got status ${rlRes.status}: ${JSON.stringify(rlRes.data)}`);
  assert("Error message contains wait time",           rlRes.data?.message?.toLowerCase().includes("wait"), `Got: ${rlRes.data?.message}`);

  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n" + B("📋  Section 6 — Rate Limiting: Instructor-Wide Lock"));
  console.log("─────────────────────────────────────────────────");

  // Bypass rate limit by directly setting lastLiveClassStartedAt to past
  await Course.findByIdAndUpdate(courseA._id, {
    lastLiveClassStartedAt: new Date(Date.now() - 60000), // 60s ago
    isLive: false,
    liveRoomId: null,
    liveStartedAt: null,
  });

  // Start CourseA successfully
  const startA2 = await lc("/start", "POST", { courseId: courseA._id }, instToken);
  assert("CourseA starts after cooldown reset → 200",  startA2.status === 200, JSON.stringify(startA2.data));
  const roomIdA2 = startA2.data?.roomId;

  // Now try to start CourseB (same instructor) — should be BLOCKED (409)
  await Course.findByIdAndUpdate(courseB._id, {
    lastLiveClassStartedAt: new Date(Date.now() - 60000),
  });
  const startB = await lc("/start", "POST", { courseId: courseB._id }, instToken);
  assert("Starting 2nd course while 1st is live → 409", startB.status === 409, `Got status ${startB.status}: ${JSON.stringify(startB.data)}`);
  assert("409 message mentions active class",            startB.data?.message?.toLowerCase().includes("active"), `Got: ${startB.data?.message}`);
  assert("409 response includes activeRoomId",           typeof startB.data?.activeRoomId === "string");

  // Instructor2 should NOT be blocked (different instructor)
  const courseC = await Course.create({
    courseName: "__LC2E__CourseC", courseDescription: "C",
    instructor: instructor2._id,
    whatYouWillLearn: "Testing", price: 0, category: cat._id,
    tag: ["test"], status: "Published", courseStatus: "ONGOING",
    isCertificateEnabled: false, isLive: false, liveRoomId: null,
    studentsEnrolled: [], lastLiveClassStartedAt: new Date(Date.now() - 60000),
  });
  const startC = await lc("/start", "POST", { courseId: courseC._id }, inst2Token);
  assert("Instructor2 can start own class while Instructor1 is live → 200", startC.status === 200, `Got: ${startC.status}`);
  await lc("/end", "POST", { courseId: courseC._id }, inst2Token);
  await Course.findByIdAndDelete(courseC._id);

  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n" + B("📋  Section 7 — Starting an Already-Live Course"));
  console.log("─────────────────────────────────────────────────");

  // CourseA is still live from Section 6
  await Course.findByIdAndUpdate(courseA._id, { lastLiveClassStartedAt: new Date(Date.now() - 60000) });
  const sameCourseRes = await lc("/start", "POST", { courseId: courseA._id }, instToken);
  assert("Starting same live course again → 409",       sameCourseRes.status === 409, `Got: ${sameCourseRes.status}`);

  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n" + B("📋  Section 8 — Access Control: Validate Endpoint"));
  console.log("─────────────────────────────────────────────────");

  // CourseA still live with roomIdA2
  const vnInst = await lc(`/validate/${roomIdA2}`, "GET", null, instToken);
  assert("Instructor can validate own live class → 200",  vnInst.status === 200, JSON.stringify(vnInst.data));
  assert("Instructor role confirmed",                      vnInst.data?.role === "instructor");
  assert("Instructor validate returns courseId",           !!vnInst.data?.courseId, `Got courseId: ${vnInst.data?.courseId}`);
  assert("Returned courseId matches actual courseId",      vnInst.data?.courseId?.toString() === courseA._id.toString());
  assert("Validate returns courseName",                    typeof vnInst.data?.courseName === "string" && vnInst.data.courseName.length > 0);

  // Enrolled student
  const vnStud = await lc(`/validate/${roomIdA2}`, "GET", null, studToken);
  assert("Enrolled student can validate → 200",            vnStud.status === 200, JSON.stringify(vnStud.data));
  assert("Student role confirmed",                         vnStud.data?.role === "student");
  assert("Student validate also returns courseId",         !!vnStud.data?.courseId, `Got courseId: ${vnStud.data?.courseId}`);

  // Non-enrolled stranger → 403
  const vnStr = await lc(`/validate/${roomIdA2}`, "GET", null, strangerToken);
  assert("Non-enrolled user → 403",                        vnStr.status === 403, `Got: ${vnStr.status}`);

  // Fake room → 404
  const vnFake = await lc(`/validate/sarthi_00000000000`, "GET", null, studToken);
  assert("Fake roomId → 404",                              vnFake.status === 404, `Got: ${vnFake.status}`);

  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n" + B("📋  Section 9 — End Class + Post-End Validate"));
  console.log("─────────────────────────────────────────────────");

  const endRes = await lc("/end", "POST", { courseId: courseA._id }, instToken);
  assert("POST /end → 200",                               endRes.status === 200);

  const dbAfterEnd = await Course.findById(courseA._id).lean();
  assert("DB: isLive = false",                            dbAfterEnd.isLive === false);
  assert("DB: liveRoomId = null",                         dbAfterEnd.liveRoomId === null);
  assert("DB: liveStartedAt = null",                      dbAfterEnd.liveStartedAt === null || dbAfterEnd.liveStartedAt === undefined);

  // Validate after end should now return 404
  const vnAfterEnd = await lc(`/validate/${roomIdA2}`, "GET", null, studToken);
  assert("Validate after class ends → 404",               vnAfterEnd.status === 404);

  // Double end (graceful)
  const end2 = await lc("/end", "POST", { courseId: courseA._id }, instToken);
  assert("Double-end → 200 (graceful noop)",              end2.status === 200);

  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n" + B("📋  Section 10 — Certificate Fields Intact"));
  console.log("─────────────────────────────────────────────────");

  const final = await Course.findById(courseA._id).lean();
  assert("isCertificateEnabled unchanged",  final.isCertificateEnabled === false);
  assert("courseStatus unchanged",          final.courseStatus === "ONGOING");
  assert("status unchanged",                final.status === "Published");

  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n" + B("📋  Section 11 — HTTP Method Guards"));
  console.log("─────────────────────────────────────────────────");

  assert("GET /start → not 200", (await lc("/start","GET",null,instToken)).status !== 200);
  assert("GET /end → not 200",   (await lc("/end","GET",null,instToken)).status !== 200);
  assert("POST /validate/:id → not 200", (await lc(`/validate/${roomIdA2}`,"POST",{},studToken)).status !== 200);

  // ══════════════════════════════════════════════════════════════════════════
  // Cleanup
  console.log("\n─────────────────────────────────────────────────");
  console.log("🧹  Cleaning up...");
  await User.deleteMany({ email: { $regex: "_lcv2test_" } });
  await Course.deleteMany({ courseName: { $regex: "__LC2E__" } });
  await Category.deleteMany({ name: "__LC2ECategory__" });
  await Profile.deleteMany({ _id: { $in: [pI._id, pI2._id, pS._id, pS2._id] } });
  console.log("✔  Cleanup complete");

  // ── Summary ───────────────────────────────────────────────────────────────
  const total = passed + failed;
  console.log("\n" + B("══════════════════════════════════════════════════"));
  console.log(B("   Test Summary"));
  console.log(B("══════════════════════════════════════════════════"));
  console.log(`   Total  : ${total}`);
  console.log(`   ${G("Passed")} : ${passed}`);
  console.log(`   ${failed > 0 ? R("Failed") : G("Failed")} : ${failed}`);
  console.log(B("══════════════════════════════════════════════════\n"));

  if (failed > 0) {
    console.log(R("🚨  Some tests failed.\n"));
    process.exit(1);
  } else {
    console.log(G("🎉  All tests passed!\n"));
    process.exit(0);
  }
};

run().catch((err) => {
  console.error(R("\n💥  Test runner crashed:"), err);
  process.exit(1);
});
