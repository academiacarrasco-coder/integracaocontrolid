import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

async function hunt() {
  const projectId = "carrasco-fit-607856914066";
  console.log("Testing Project ID variant:", projectId);
  
  try {
    admin.initializeApp({ projectId });
    const db = getFirestore();
    const snap = await db.collection('students').limit(1).get();
    console.log(`✅ Success on ${projectId}! Found ${snap.size} docs.`);
  } catch (e: any) {
    console.log(`❌ Fail on ${projectId}: ${e.message.split('\n')[0]}`);
  }
}

hunt();
