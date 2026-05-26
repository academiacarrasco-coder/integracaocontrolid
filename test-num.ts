async function testProjectNumber() {
  const apiKey = "AIzaSyAlPByjWib136gM6pLS68hEnuFQVhgIidE";
  const projectNum = "74789247297";
  
  const ids = ["(default)", "ai-studio-c02d96e6-2cfd-4c61-9d84-8d2be7a4efd6", "carrasco-data-final"];
  
  for (const db of ids) {
    console.log(`\n--- Testing REST for Project ${projectNum} DB: ${db} ---`);
    const url = `https://firestore.googleapis.com/v1/projects/${projectNum}/databases/${db}/documents/students?key=${apiKey}`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (res.status === 200) {
        if (data.documents) {
          console.log(`✅ SUCCESS! Found ${data.documents.length} docs.`);
        } else {
          console.log(`ℹ️ SUCCESS but DB is EMPTY.`);
        }
      } else {
        console.log(`❌ FAIL: ${res.status} ${data.error?.message || ''}`);
      }
    } catch (e: any) {
      console.log(`❌ Exception: ${e.message}`);
    }
  }
}
testProjectNumber();
