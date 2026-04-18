/**
 * Certificate Setup Test Script
 * 
 * Steps:
 *  1. Login as instructor → get token
 *  2. List instructor courses → pick first course
 *  3. PATCH markCourseAsCompleted
 *  4. PATCH enableCertificate
 *  5. GET getFullCourseDetails → confirm all 3 flags are correct
 */

require("dotenv").config();

const BASE_URL = "http://localhost:5000";

// ──────────────────────────────────────────────────────────
// Instructor credentials
// ──────────────────────────────────────────────────────────
const INSTRUCTOR_EMAIL    = "priyanshuchandra26@gmail.com";
const INSTRUCTOR_PASSWORD = "priyanshu#25";

async function post(url, body, token) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function patch(url, token) {
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  return res.json();
}

async function get(url, token) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

// ──────────────────────────────────────────────────────────
async function run() {
  // ── STEP 1: Login ────────────────────────────────────────
  console.log("\n🔐 Step 1: Logging in as instructor...");
  const loginRes = await post(`${BASE_URL}/api/v1/auth/login`, {
    email: INSTRUCTOR_EMAIL,
    password: INSTRUCTOR_PASSWORD,
  });

  if (!loginRes.success) {
    console.error("❌ Login failed:", loginRes.message);
    return;
  }

  const token = loginRes.token;
  console.log("✅ Logged in. Token acquired.");

  // ── STEP 2: Get instructor courses ───────────────────────
  console.log("\n📚 Step 2: Fetching instructor courses...");
  const coursesRes = await get(`${BASE_URL}/api/v1/course/getInstructorCourses`, token);

  if (!coursesRes.success || !coursesRes.data?.length) {
    console.error("❌ No courses found for this instructor:", coursesRes.message);
    return;
  }

  // List all courses so user can pick
  console.log(`\nFound ${coursesRes.data.length} course(s):`);
  coursesRes.data.forEach((c, i) => {
    console.log(`  [${i}] ${c.courseName}  →  ID: ${c._id}  (status: ${c.courseStatus}, certEnabled: ${c.isCertificateEnabled})`);
  });

  // Pick first course automatically (change index if needed)
  const COURSE_INDEX = 0;
  const course = coursesRes.data[COURSE_INDEX];
  const courseId = course._id;
  console.log(`\n🎯 Using course: "${course.courseName}" (${courseId})`);

  // ── STEP 3: Mark course as COMPLETED ─────────────────────
  console.log("\n🏁 Step 3: Marking course as COMPLETED...");
  const markRes = await patch(
    `${BASE_URL}/api/v1/course/markCourseAsCompleted/${courseId}`,
    token
  );
  console.log(markRes.success ? `✅ ${markRes.message}` : `❌ ${markRes.message}`);

  // ── STEP 4: Enable Certificate ───────────────────────────
  console.log("\n🎓 Step 4: Enabling certificate for course...");
  const certRes = await patch(
    `${BASE_URL}/api/v1/course/enableCertificate/${courseId}`,
    token
  );
  console.log(certRes.success ? `✅ ${certRes.message}` : `❌ ${certRes.message}`);

  // ── STEP 5: Verify final state ───────────────────────────
  console.log("\n🔍 Step 5: Verifying final course state...");
  const fullRes = await post(
    `${BASE_URL}/api/v1/course/getFullCourseDetails`,
    { courseId },
    token
  );

  if (!fullRes.success) {
    console.error("❌ Could not fetch full course details:", fullRes.message);
    return;
  }

  const details = fullRes.data?.courseDetails;
  const eligibility = fullRes.data?.certificateEligibility;

  console.log("\n═══════════════════════════════════════");
  console.log("📊 FINAL STATE REPORT");
  console.log("═══════════════════════════════════════");
  console.log(`Course Status:        ${details?.courseStatus === "COMPLETED" ? "✅" : "❌"} ${details?.courseStatus}`);
  console.log(`Certificate Enabled:  ${details?.isCertificateEnabled === true ? "✅" : "❌"} ${details?.isCertificateEnabled}`);
  console.log(`Eligibility:          ${eligibility?.eligible === true ? "✅" : "⚠️ "} ${eligibility?.eligible} (reason: ${eligibility?.reason})`);
  console.log("═══════════════════════════════════════\n");

  if (details?.courseStatus === "COMPLETED" && details?.isCertificateEnabled === true) {
    console.log("🟢 Backend is ready. Now ask a student to pass the test to get eligibility = true.");
  } else {
    console.log("🔴 Something went wrong. Check the error messages above.");
  }
}

run().catch(console.error);
