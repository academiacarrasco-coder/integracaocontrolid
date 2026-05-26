async function checkRealProject() {
  try {
    const res = await fetch("http://metadata.google.internal/computeMetadata/v1/project/project-id", {
      headers: { "Metadata-Flavor": "Google" }
    });
    const id = await res.text();
    console.log("REAL PROJECT ID FROM METADATA:", id);
    
    const resNum = await fetch("http://metadata.google.internal/computeMetadata/v1/project/numeric-project-id", {
      headers: { "Metadata-Flavor": "Google" }
    });
    const num = await resNum.text();
    console.log("REAL PROJECT NUMBER FROM METADATA:", num);
  } catch (e: any) {
    console.log("Failed to fetch metadata:", e.message);
  }
}
checkRealProject();
