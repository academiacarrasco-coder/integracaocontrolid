async function checkStudents() {
  const res = await fetch("http://localhost:3000/api/students/list");
  const data = await res.json();
  console.log(`Loaded ${data.length} students`);
  if (data.length > 0) {
    console.log("Sample:", JSON.stringify(data[0]));
  }
}
checkStudents();
