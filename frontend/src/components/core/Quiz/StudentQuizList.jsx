import { useState, useEffect } from 'react';

import { useNavigate } from 'react-router-dom';

export default function StudentQuizList() {
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [quizzes, setQuizzes] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    API.get('/quiz/subjects').then(res => setSubjects(res.data.subjects));
  }, []);

  const fetchQuizzes = async (subject) => {
    setSelectedSubject(subject);
    const res = await API.get(`/quiz/by-subject/${subject}`);
    setQuizzes(res.data.quizzes);
  };

  return (
    <div>
      <h2>Available Quizzes</h2>
      <select onChange={e => fetchQuizzes(e.target.value)}>
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
