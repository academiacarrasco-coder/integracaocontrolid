import admin from "firebase-admin";

async function check() {
  console.log("ENV VARS:");
  for (const key in process.env) {
    if (key.includes("FIREBASE") || key.includes("GOOGLE") || key.includes("GCP") || key.includes("PROJECT")) {
      console.log(`${key}: ${process.env[key]}`);
    }
  }
}

check();
