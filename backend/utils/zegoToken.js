/**
 * Zego Token04 Generator — pure Node.js implementation.
 *
 * ZegoCloud's Token04 algorithm uses AES-256-CBC encryption.
 * This is a server-side re-implementation that avoids browser-only packages
 * (e.g., zego-token-generator which references `window` and crashes in Node).
 *
 * Reference: https://docs.zegocloud.com/article/9648
 */

const crypto = require("crypto");

/**
 * Generates a Zego Token04 for room access.
 *
 * @param {number}  appId         - Your ZegoCloud AppID (numeric)
 * @param {string}  userId        - User ID joining the room (string)
 * @param {string}  serverSecret  - 32-char hex server secret from console
 * @param {number}  effectiveTime - Token validity in seconds (e.g. 3600)
 * @param {object}  payload       - Optional privilege payload
 * @returns {string} Token04 string to pass to ZegoUIKitPrebuilt.generateKitTokenForProduction()
 */
function generateToken04(appId, userId, serverSecret, effectiveTime = 3600, payload = "") {
  if (!appId || !userId || !serverSecret) {
    throw new Error("generateToken04: appId, userId, and serverSecret are required");
  }

  const now = Math.floor(Date.now() / 1000);
  const expireTime = now + effectiveTime;
  
  // 1. Inner JSON Payload (Mandatory for Zego 04)
  const innerPayload = JSON.stringify({
    app_id: Number(appId),
    user_id: userId.toString(),
    nonce: Math.floor(Math.random() * 2147483647),
    ctime: now,
    expire: expireTime,
    payload: payload || ""
  });

  // 2. Encryption Setup
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(serverSecret, "utf-8"); // Must be 32 bytes
  if (key.length !== 32) {
    throw new Error("generateToken04: serverSecret must be 32 bytes for AES-256");
  }

  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const encryptedBuf = Buffer.concat([cipher.update(innerPayload, "utf-8"), cipher.final()]);

  // 3. Build Outer Binary Buffer (Zego 8-2-16-2 structure)
  // [expire_time(8) | iv_length(2) | iv(16) | encrypt_length(2) | encrypted_content]
  const buf = Buffer.allocUnsafe(8 + 2 + 16 + 2 + encryptedBuf.length);
  let offset = 0;

  // Expire time (int64 Big-Endian)
  buf.writeBigInt64BE(BigInt(expireTime), offset); offset += 8;
  
  // IV
  buf.writeUInt16BE(iv.length, offset);            offset += 2;
  iv.copy(buf, offset);                            offset += iv.length;
  
  // Encrypted Content
  buf.writeUInt16BE(encryptedBuf.length, offset);  offset += 2;
  encryptedBuf.copy(buf, offset);

  // 4. Base64 encode and prefix with "04"
  return `04${buf.toString("base64")}`;
}

module.exports = { generateToken04 };
