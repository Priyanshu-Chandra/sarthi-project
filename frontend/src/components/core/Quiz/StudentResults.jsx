import { useState, useEffect } from 'react';

export default function StudentResults() {
  const [results, setResults] = useState([]);

  useEffect(() => {
    API.get('/quiz/results').then(res => setResults(res.data.results));
  }, []);

  return (
    <div>
      <h2>Your Quiz Results</h2>
      {results.map(r => (
        <div key={r._id}>
          <h3>{r.quizId.title} ({r.quizId.subject})</h3>
          <p>Score: {r.score} / {r.totalQuestions}</p>
        </div>
      ))}
    </div>
  );
}
