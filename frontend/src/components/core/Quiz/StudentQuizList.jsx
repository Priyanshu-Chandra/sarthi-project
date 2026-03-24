import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchQuizSubjects, fetchQuizzesBySubject } from '../../../services/operations/quizAPI';
import { useSelector } from 'react-redux';

export default function StudentQuizList() {
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [quizzes, setQuizzes] = useState([]);
  const [error, setError] = useState('');
  const { token } = useSelector((state) => state.auth);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const res = await fetchQuizSubjects(token);
        if (res?.subjects) {
          setSubjects(res.subjects);
        } else {
          setError('Failed to fetch subjects.');
        }
      } catch (err) {
        setError('An error occurred while fetching subjects.');
      }
    };
    fetchSubjects();
  }, [token]);

  const fetchQuizzes = async (subject) => {
    setSelectedSubject(subject);
    setError('');
    try {
      const res = await fetchQuizzesBySubject(subject, token);
      if (res?.quizzes) {
        setQuizzes(res.quizzes);
      } else {
        setError('Failed to fetch quizzes.');
      }
    } catch (err) {
      setError('An error occurred while fetching quizzes.');
    }
  };

  return (
    <div>
      <h2>Available Quizzes</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <select onChange={e => fetchQuizzes(e.target.value)} value={selectedSubject}>
        <option value="">Select Subject</option>
        {subjects.map((s, i) => <option key={i} value={s}>{s}</option>)}
      </select>

      <ul>
        {quizzes.map(q => (
          <li key={q._id}>
            {q.title} - <button onClick={() => navigate(`/quiz/attempt/${q._id}`)}>Attempt</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
