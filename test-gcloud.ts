import { Firestore } from "@google-cloud/firestore";
import { readFileSync } from "fs";

async function test() {
  const config = JSON.parse(readFileSync("./firebase-applet-config.json", "utf8"));
  console.log("Testing @google-cloud/firestore with Project:", config.projectId);
  
  try {
    const firestore = new Firestore({
      projectId: config.projectId,
      databaseId: config.firestoreDatabaseId
    });
    const collections = await firestore.listCollections();
    console.log("✅ Success! Collections:", collections.map(c => c.id));
  } catch (e: any) {
    console.error("❌ Failure:", e.message);
  }
}

test();
