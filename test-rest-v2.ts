async function testRest() {
  const apiKey = "AIzaSyAlPByjWib136gM6pLS68hEnuFQVhgIidE";
  const projectId = "carrascofit-app";
  const dbs = ["carrasco-data-1", "carrasco-data-final", "ai-studio-c02d96e6-2cfd-4c61-9d84-8d2be7a4efd6"];
  
  for (const db of dbs) {
    console.log(`\n--- Testing REST for DB: ${db} ---`);
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${db}/documents/students?key=${apiKey}`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.error) {
        console.log(`❌ Error: ${data.error.message}`);
      } else if (data.documents) {
        console.log(`✅ Success! Found ${data.documents.length} docs.`);
        return;
      } else {
        console.log(`ℹ️ Success but 0 docs.`);
      }
    } catch (e: any) {
      console.log(`❌ Exception: ${e.message}`);
    }
  }
}

testRest();
