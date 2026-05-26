async function hunt() {
  const projectId = "carrascofit-app";
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases`;
  console.log("Fetching databases from REST API...");
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log("REST API Response:", JSON.stringify(data, null, 2));
  } catch (e: any) {
    console.error("REST API Error:", e.message);
  }
}

hunt();
