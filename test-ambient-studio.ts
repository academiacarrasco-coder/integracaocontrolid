async function testAmbientWithAiStudio() {
  const apiKey = "AIzaSyAlPByjWib136gM6pLS68hEnuFQVhgIidE";
  const ambientId = "ais-us-east1-8ee97547920c4cbc9"; // Real project from metadata
  const db = "ai-studio-c02d96e6-2cfd-4c61-9d84-8d2be7a4efd6";
  
  console.log(`\n--- Testing REST for Ambient Project ${ambientId} DB: ${db} ---`);
  const url = `https://firestore.googleapis.com/v1/projects/${ambientId}/databases/${db}/documents/students?key=${apiKey}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (res.status === 200) {
      console.log(`✅ SUCCESS on Ambient! Found data.`);
    } else {
      console.log(`❌ FAIL Ambient: ${res.status} ${data.error?.message || ''}`);
    }
  } catch (e: any) {
    console.log(`❌ Exception: ${e.message}`);
  }
}
testAmbientWithAiStudio();
