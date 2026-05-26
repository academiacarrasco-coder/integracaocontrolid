async function finalHunt() {
  const apiKey = "AIzaSyAlPByjWib136gM6pLS68hEnuFQVhgIidE";
  const projects = ["carrascofit-app", "carrasco-fit", "carrasco", "academia-carrasco", "academiacarrasco"];
  const dbs = ["(default)", "carrasco-data-final", "carrasco-data-1", "db", "data"];
  
  for (const p of projects) {
    for (const d of dbs) {
      const url = `https://firestore.googleapis.com/v1/projects/${p}/databases/${d}/documents/students?key=${apiKey}`;
      try {
        const res = await fetch(url);
        if (res.status === 200) {
          const data = await res.json();
          if (data.documents) {
            console.log(`✅ FOUND DATA! Project: ${p}, DB: ${d}, Count: ${data.documents.length}`);
            return;
          } else {
            console.log(`ℹ️ Project: ${p}, DB: ${d} (Empty)`);
          }
        } else if (res.status !== 404) {
          console.log(`❓ Project: ${p}, DB: ${d}: ${res.status}`);
        }
      } catch (e) {}
    }
  }
}
finalHunt();
