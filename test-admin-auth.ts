import admin from "firebase-admin";
import { readFileSync } from "fs";

async function testAuth() {
  const config = JSON.parse(readFileSync("./firebase-applet-config.json", "utf8"));
  console.log("Testing with Project:", config.projectId);
  
  try {
    admin.initializeApp({ projectId: config.projectId });
    const userList = await admin.auth().listUsers(1);
    console.log("✅ Admin Auth SUCCESS! Found users count:", userList.users.length);
  } catch (e: any) {
    console.log("❌ Admin Auth FAIL:", e.message);
  }
}

testAuth();
