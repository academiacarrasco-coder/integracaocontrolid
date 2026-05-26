import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

async function hunt() {
  const config = JSON.parse(readFileSync("./firebase-applet-config.json", "utf8"));
  console.log("Checking project:", config.projectId);
  
  admin.initializeApp({ projectId: config.projectId });
  
  const potentialDbs = [
    config.firestoreDatabaseId,
    "(default)",
    "carrasco-data-1",
    "carrasco-data-final",
    "carrasco-fit-data"
  ].filter(x => x && x !== 'undefined');

  for (const dbId of potentialDbs) {
    const id = dbId === "(default)" ? undefined : dbId;
    console.log(`\n--- Checking DB: ${dbId} ---`);
    try {
      const db = getFirestore(admin.apps[0]!, id);
      // Try to list collections first
      const collections = await db.listCollections();
      console.log(`Collections found:`, collections.map(c => c.id));
      
      if (collections.length > 0) {
        for (const coll of collections) {
          const snap = await db.collection(coll.id).limit(1).get();
          console.log(`Collection [${coll.id}]: Found ${snap.size} documents sample.`);
        }
      } else {
        // Fallback: try to read 'students' directly even if listCollections is empty/blocked
        console.log("No collections listed, trying direct 'students' read...");
        const snap = await db.collection('students').limit(1).get();
        console.log(`Direct 'students' read: Found ${snap.size} documents.`);
      }
    } catch (e: any) {
      console.log(`❌ Fail ${dbId}: ${e.message.split('\n')[0]}`);
    }
  }
}

hunt();
