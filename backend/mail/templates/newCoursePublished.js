module.exports = (studentName, instructorName, courseName, courseDescription) => {
  return `
    <div style="font-family:Arial">
      <h2>🎓 New Course Published</h2>

      <p>Hello ${studentName},</p>

      <p>
      <b>${instructorName}</b> has published a new course.
      </p>

      <h3>${courseName}</h3>

      <p>${courseDescription}</p>

      <p>Start learning now on <b>Sarthi</b> 🚀</p>
    </div>
  `;
};