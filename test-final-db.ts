async function testFinal() {
  const apiKey = "AIzaSyAlPByjWib136gM6pLS68hEnuFQVhgIidE";
  const projectId = "carrascofit-app";
  const db = "carrasco-data-final";
  
  console.log(`\n--- Testing REST for DB: ${db} ---`);
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${db}/documents/students?key=${apiKey}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (res.status === 200) {
      if (data.documents) {
        console.log(`✅ SUCCESS! Found ${data.documents.length} docs in ${db}.`);
        console.log('First student sample:', JSON.stringify(data.documents[0].fields.name));
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

testFinal();
