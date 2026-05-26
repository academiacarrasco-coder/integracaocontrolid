async function test() {
  const projectId = "carrascofit-app";
  const databaseId = "carrasco-data-final";
  const apiKey = "AIzaSyAlPByjWib136gM6pLS68hEnuFQVhgIidE";
  
  // Try public read
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/students?key=${apiKey}`;
  console.log("Fetching from REST public API:", url);
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}

test();
