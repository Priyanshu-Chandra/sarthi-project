import { useState } from "react"
import { useSelector } from "react-redux"
//import { createQuiz } from "../../services/operations/quizAPI"
import { createQuiz } from "../../../services/operations/quizAPI"
export default function InstructorCreateQuiz({ courseId }) {

  const { token } = useSelector((state) => state.auth)

  const [title, setTitle] = useState("")
  const [questions, setQuestions] = useState([])

  const addQuestion = () => {
    setQuestions([
      ...questions,
      { question: "", options: ["", "", "", ""], correctAnswer: 0 }
    ])
  }

  const handleQuestionChange = (index, value) => {
    const updated = [...questions]
    updated[index].question = value
    setQuestions(updated)
  }

  const handleOptionChange = (qIndex, oIndex, value) => {
    const updated = [...questions]
    updated[qIndex].options[oIndex] = value
    setQuestions(updated)
  }

  const handleCorrectAnswer = (qIndex, value) => {
    const updated = [...questions]
    updated[qIndex].correctAnswer = Number(value)
    setQuestions(updated)
  }

  const handleSubmit = async () => {

    const quizData = {
      title,
      courseId,
      questions
    }

    await createQuiz(quizData, token)

    alert("Quiz Created Successfully")
  }

  return (
    <div className="p-6 text-white">

      <h2 className="text-2xl mb-4">Create Quiz</h2>

      <input
        type="text"
        placeholder="Quiz Title"
        className="p-2 text-black"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <button
        className="bg-yellow-400 px-4 py-2 ml-3"
        onClick={addQuestion}
      >
        Add Question
      </button>

      {questions.map((q, qIndex) => (
        <div key={qIndex} className="mt-6 border p-4">

          <input
            type="text"
            placeholder="Question"
            className="p-2 text-black w-full"
            value={q.question}
            onChange={(e) =>
              handleQuestionChange(qIndex, e.target.value)
            }
          />

          {q.options.map((opt, oIndex) => (
            <input
              key={oIndex}
              type="text"
              placeholder={`Option ${oIndex + 1}`}
              className="p-2 text-black block mt-2"
              value={opt}
              onChange={(e) =>
                handleOptionChange(qIndex, oIndex, e.target.value)
              }
            />
          ))}

          <select
            className="mt-2 text-black"
            onChange={(e) =>
              handleCorrectAnswer(qIndex, e.target.value)
            }
          >
            <option value={0}>Correct: Option 1</option>
            <option value={1}>Correct: Option 2</option>
            <option value={2}>Correct: Option 3</option>
            <option value={3}>Correct: Option 4</option>
          </select>

        </div>
      ))}

      <button
        onClick={handleSubmit}
        className="mt-6 bg-blue-600 px-4 py-2"
      >
        Save Quiz
      </button>

    </div>
  )
}