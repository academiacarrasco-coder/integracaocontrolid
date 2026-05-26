async function listDbs() {
  const apiKey = "AIzaSyAlPByjWib136gM6pLS68hEnuFQVhgIidE";
  const projectId = "carrascofit-app";
  
  console.log(`\n--- Listing Databases for Project: ${projectId} ---`);
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases?key=${apiKey}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (res.status === 200) {
      console.log('Databases:', JSON.stringify(data.databases?.map((d: any) => d.name), null, 2));
    } else {
      console.log(`❌ FAIL: ${res.status} ${data.error?.message || ''}`);
    }
  } catch (e: any) {
    console.log(`❌ Exception: ${e.message}`);
  }
}
listDbs();
