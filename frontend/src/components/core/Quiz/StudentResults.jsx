import { useState, useEffect } from 'react';
import { fetchStudentResults } from '../../../services/operations/quizAPI';
import { useSelector } from 'react-redux';

export default function StudentResults() {
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  const { token } = useSelector((state) => state.auth);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const res = await fetchStudentResults(token);
        if (res?.results) {
          setResults(res.results);
        } else {
          setError('Failed to fetch results.');
        }
      } catch (err) {
        setError('An error occurred while fetching results.');
      }
    };
    fetchResults();
  }, [token]);

  return (
    <div>
      <h2>Your Quiz Results</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {results.map(r => (
        <div key={r._id}>
          <h3>{r.testId?.title || r.quizId?.title || 'Unknown Quiz'}</h3>
          <p>Score: {r.score} / {r.totalQuestions}</p>
        </div>
      ))}
    </div>
  );
}
