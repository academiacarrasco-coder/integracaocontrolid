async function testAiStudio() {
  const apiKey = "AIzaSyAlPByjWib136gM6pLS68hEnuFQVhgIidE";
  const projectId = "carrascofit-app";
  const db = "ai-studio-c02d96e6-2cfd-4c61-9d84-8d2be7a4efd6";
  
  console.log(`\n--- Testing REST for DB: ${db} ---`);
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${db}/documents/students?key=${apiKey}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (res.status === 200) {
      if (data.documents) {
        console.log(`✅ SUCCESS! Found ${data.documents.length} docs in ${db}.`);
      } else {
        console.log(`ℹ️ SUCCESS but ${db} is EMPTY (0 docs).`);
      }
    } else {
      console.log(`❌ FAIL ${db}: ${res.status} ${data.error?.message || ''}`);
    }
  } catch (e: any) {
    console.log(`❌ Exception: ${e.message}`);
  }
}

testAiStudio();
