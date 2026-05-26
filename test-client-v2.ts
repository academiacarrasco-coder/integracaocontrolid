import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, limit, query } from "firebase/firestore";
import { readFileSync } from "fs";

async function test() {
  const firebaseConfig = JSON.parse(readFileSync("./firebase-applet-config.json", "utf8"));
  console.log("Testing Client SDK with Project:", firebaseConfig.projectId);
  
  const app = initializeApp(firebaseConfig);
  
  const dbIds = [
    firebaseConfig.firestoreDatabaseId,
    "(default)",
    "carrasco-data-1",
    "carrasco-fit-data"
  ].filter(x => x);

  for (const dbId of dbIds) {
    const id = dbId === "(default)" ? undefined : dbId;
    console.log(`Checking Client DB: ${dbId}`);
    try {
      const db = getFirestore(app, id);
      const snap = await getDocs(query(collection(db, "_connection_test_"), limit(1)));
      console.log(`✅ Success! Connected to ${dbId}`);
      return;
    } catch (e: any) {
      console.log(`❌ Fail ${dbId}: ${e.message.split('\n')[0]}`);
    }
  }
}

test();
