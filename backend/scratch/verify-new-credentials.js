const { generateToken04 } = require("../utils/zegoToken");

const appID = 1207334476;
const serverSecret = "86f363d721c85a73cd7b3c920ec5d6a8";

async function verify() {
  console.log("🔍 Testing New ZegoCloud Credentials...");
  console.log(`AppID: ${appID}`);
  console.log(`Secret: ${serverSecret}`);

  try {
    const token = generateToken04(appID, "test_user", serverSecret, 3600, "");
    console.log("✅ SUCCESS: Token generated locally.");
    console.log("Token:", token);
    
    if (token.startsWith("04")) {
        console.log("✅ Token matches the required '04' format for Zego SDK.");
    }

    console.log("\nNote: Local generation is successful. To verify if the AppID is active on Zego's servers, you must start a Live Class and see if the video connects.");
  } catch (err) {
    console.error("❌ FAILED:", err.message);
  }
}

verify();
