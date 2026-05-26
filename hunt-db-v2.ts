import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

async function hunt() {
  const config = JSON.parse(readFileSync("./firebase-applet-config.json", "utf8"));
  console.log("Hunting in project:", config.projectId);
  
  admin.initializeApp({ projectId: config.projectId });
  
  const potentialDbs = [
    "carrasco-data-final",
    "(default)",
    "carrasco-data-1",
    "carrasco-fit-data",
    "main",
    "prod"
  ].filter(x => x);

  for (const dbId of potentialDbs) {
    const id = dbId === "(default)" ? undefined : dbId;
    console.log(`Checking DB: ${dbId}`);
    try {
      const db = getFirestore(admin.apps[0]!, id);
      const collections = await db.listCollections();
      console.log(`✅ FOUND! Collections in ${dbId}:`, collections.map(c => c.id));
      if (collections.length > 0) return;
    } catch (e: any) {
      console.log(`❌ Fail ${dbId}: ${e.message.split('\n')[0]}`);
    }
  }
}

hunt();
