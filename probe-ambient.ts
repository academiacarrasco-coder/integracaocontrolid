import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

async function probeAmbient() {
  const projectId = "ais-us-east1-8ee97547920c4cbc9";
  console.log("Probing Ambient Project:", projectId);
  
  try {
    admin.initializeApp(); // Use ambient auth
    const db = getFirestore();
    const snap = await db.collection('students').limit(1).get();
    console.log(`✅ Success on Ambient! Found ${snap.size} docs.`);
    const collections = await db.listCollections();
    console.log("Collections:", collections.map(c => c.id));
  } catch (e: any) {
    console.log(`❌ Fail on Ambient: ${e.message.split('\n')[0]}`);
  }
}

probeAmbient();
