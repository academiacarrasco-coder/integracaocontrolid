async function inspectRealStudent() {
  const apiKey = "AIzaSyAlPByjWib136gM6pLS68hEnuFQVhgIidE";
  const projectId = "carrascofit-app";
  const dbId = "ai-studio-c02d96e6-2cfd-4c61-9d84-8d2be7a4efd6";
  
  console.log(`\n--- Inspecting 1 real student from ${dbId} ---`);
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents/students?pageSize=1&key=${apiKey}`;
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.documents && data.documents.length > 0) {
      console.log("Structure found:", JSON.stringify(data.documents[0].fields, null, 2));
    } else {
      console.log("No documents found in this database via REST.");
    }
  } catch (e: any) {
    console.log("Error inspecting:", e.message);
  }
}
inspectRealStudent();
