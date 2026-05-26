async function shotgun() {
  const apiKey = "AIzaSyAlPByjWib136gM6pLS68hEnuFQVhgIidE";
  const projectId = "carrascofit-app";
  const dbs = [
    "(default)", "carrasco-data-1", "carrasco-data-final", "db", "data", "main", "primary", "carrasco", "fit", "carrasco-fit"
  ];
  
  for (const db of dbs) {
    const dbId = db === "(default)" ? "" : db;
    const path = dbId ? `databases/${dbId}` : "databases/(default)";
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/${path}/documents/students?key=${apiKey}`;
    
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (res.status === 200) {
        console.log(`✅ FOUND DB: ${db}`);
        return;
      } else {
        console.log(`❌ DB ${db}: ${res.status} ${data.error?.message || ''}`);
      }
    } catch (e) {
      console.log(`❌ DB ${db}: Exception`);
    }
  }
}
shotgun();
