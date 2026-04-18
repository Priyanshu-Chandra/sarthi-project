/**
 * fix-indices.js — One-time migration to fix the quizresults unique index
 *
 * Problem: MongoDB has a unique index on { studentId: 1, testId: 1 } in the
 * quizresults collection. This prevents multiple IN_PROGRESS rows for the same
 * student-test pair, blocking the maxAttempts retry flow.
 *
 * Fix:  Drop the unique constraint so the index becomes a plain lookup index.
 *       The application logic already handles uniqueness via upsert patterns
 *       and the { testId, studentId, status } security queries.
 *
 * Usage: node backend/fix-indices.js
 */

require("dotenv").config();
const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DATABASE_URL);
    console.log("DB connected");
  } catch (err) {
    console.error("DB connection failed:", err);
    process.exit(1);
  }
};

const run = async () => {
  await connectDB();
  const db = mongoose.connection.db;
  const coll = db.collection("quizresults");

  // ── 1. Find all indexes on quizresults ──────────────────────────────────────
  const indexes = await coll.indexes();
  console.log("\nCurrent indexes on 'quizresults':");
  indexes.forEach((idx) => {
    console.log(`  ${idx.name}:`, idx.key, idx.unique ? "[UNIQUE]" : "");
  });

  // ── 2. Identify the unique { studentId, testId } index ───────────────────────
  const uniqueIdx = indexes.find(
    (idx) =>
      idx.unique === true &&
      idx.key.studentId !== undefined &&
      idx.key.testId !== undefined
  );

  if (!uniqueIdx) {
    console.log("\n✅ No unique index on { studentId, testId } found — nothing to fix.");
  } else {
    console.log(`\n🔧 Dropping unique index: ${uniqueIdx.name}`);
    await coll.dropIndex(uniqueIdx.name);
    console.log(`   Dropped. Recreating as non-unique index…`);
    await coll.createIndex(
      { studentId: 1, testId: 1 },
      { unique: false, background: true }
    );
    console.log("   Done.");
  }

  // ── 3. Ensure the compound security index exists ─────────────────────────────
  const securityIdx = indexes.find(
    (idx) =>
      idx.key.studentId === 1 &&
      idx.key.testId === 1 &&
      idx.key.status === 1
  );
  if (!securityIdx) {
    console.log("\n🔧 Creating { studentId, testId, status } security index…");
    await coll.createIndex(
      { studentId: 1, testId: 1, status: 1 },
      { background: true }
    );
    console.log("   Created.");
  } else {
    console.log("\n✅ { studentId, testId, status } index already exists.");
  }

  // ── 4. Verify final state ────────────────────────────────────────────────────
  console.log("\nFinal indexes on 'quizresults':");
  const finalIndexes = await coll.indexes();
  finalIndexes.forEach((idx) => {
    console.log(`  ${idx.name}:`, idx.key, idx.unique ? "[UNIQUE]" : "");
  });

  await mongoose.connection.close();
  console.log("\nMigration complete.");
  process.exit(0);
};

run();
