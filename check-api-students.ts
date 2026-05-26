async function checkApiStudents() {
  try {
    const res = await fetch("http://localhost:3000/api/students/list");
    const data = await res.json();
    console.log(`API returned ${data.length} students`);
    if (data.length > 0) {
      console.log("Sample student name:", data[0].name);
    }
  } catch (e: any) {
    console.error("API check failed:", e.message);
  }
}
checkApiStudents();
