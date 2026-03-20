import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

export default function AttemptQuiz() {
  const { id } = useParams();
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState([]);

  useEffect(() => {
    API.get(`/quiz/${id}`).then(res => {
      setQuiz(res.data.quiz);
      setAnswers(Array(res.data.quiz.questions.length).fill(null));
    });
  }, [id]);

  const selectAnswer = (qIdx, optIdx) => {
    const newAns = [...answers];
    newAns[qIdx] = optIdx;
    setAnswers(newAns);
  };

  const submitQuiz = async () => {
    const res = await API.post('/quiz/submit', { quizId: id, answers });
    alert(`Score: ${res.data.score} / ${res.data.total}`);
  };

  if (!quiz) return <p>Loading...</p>;

  return (
    <div>
      <h2>{quiz.title}</h2>
      {quiz.questions.map((q, idx) => (
        <div key={idx}>
          <p>{q.question}</p>
          {q.options.map((opt, i) => (
            <div key={i}>
              <input type="radio" name={`q${idx}`} checked={answers[idx] === i} onChange={() => selectAnswer(idx, i)} />
              {opt}
            </div>
          ))}
        </div>
      ))}
      <button onClick={submitQuiz}>Submit Quiz</button>
    </div>
  );
}
