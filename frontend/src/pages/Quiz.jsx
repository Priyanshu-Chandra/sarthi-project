import React, { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { fetchQuizByCourse, submitQuiz } from "../services/operations/quizAPI"
import { useSelector } from "react-redux"
import toast from "react-hot-toast"   // ⭐ toast added

function Quiz() {

  const { courseId } = useParams()
  const { token } = useSelector((state) => state.auth)

  const [quiz, setQuiz] = useState(null)
  const [answers, setAnswers] = useState([])
  const [score, setScore] = useState(null)

  const [timeLeft, setTimeLeft] = useState(600)
  const [timerStarted, setTimerStarted] = useState(false)

  const [quizLocked, setQuizLocked] = useState(false) // ⭐ lock after attempt


  useEffect(() => {
    loadQuiz()
  }, [])


  const loadQuiz = async () => {

    const result = await fetchQuizByCourse(courseId, token)

    if(result?.quiz){
      setQuiz(result.quiz)
      setAnswers(new Array(result.quiz.questions.length).fill(null))
      setTimerStarted(true)
    }

  }


  // ⭐ TIMER
  useEffect(() => {

    if(!timerStarted) return

    const timer = setInterval(() => {

      setTimeLeft((prev) => {

        if(prev <= 1){
          clearInterval(timer)
          handleSubmit()
          return 0
        }

        return prev - 1

      })

    },1000)

    return () => clearInterval(timer)

  }, [timerStarted])


  const handleOptionSelect = (questionIndex, optionIndex) => {

    if(quizLocked) return

    const newAnswers = [...answers]
    newAnswers[questionIndex] = optionIndex
    setAnswers(newAnswers)

  }


  const handleSubmit = async () => {

    if(!quiz || quizLocked) return

    const data = {
      quizId: quiz._id,
      answers
    }

    try {

      const result = await submitQuiz(data, token)

      if(result?.score !== undefined){
        setScore(result.score)
        toast.success("Quiz Submitted Successfully 🎉")  // ⭐ flash
        setQuizLocked(true)
      }

    } catch(error) {

      const message =
        error?.response?.data?.message ||
        "Something went wrong"

      toast.error(message)  // ⭐ flash message
      setQuizLocked(true)

    }

  }


  const formatTime = () => {

    const minutes = Math.floor(timeLeft / 60)
    const seconds = timeLeft % 60

    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`

  }


  if(!quiz) return <div className="text-white p-8">Loading Quiz...</div>


  if(score !== null){
    return (
      <div className="p-8 text-white flex flex-col items-center">

        <div className="bg-richblack-800 p-8 rounded-xl shadow-lg text-center">

          <h1 className="text-3xl font-bold mb-4">
            Quiz Result
          </h1>

          <p className="text-2xl text-yellow-300">
            Score: {score} / {quiz.questions.length}
          </p>

        </div>

      </div>
    )
  }


  return (
    <div className="p-8 text-white max-w-3xl mx-auto">

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">

        <h1 className="text-3xl font-bold">
          {quiz.title}
        </h1>

        <div className="bg-red-500 px-4 py-2 rounded-lg font-semibold">
          ⏳ {formatTime()}
        </div>

      </div>


      {/* PROGRESS BAR ⭐ */}
      <div className="w-full bg-gray-700 rounded-full h-3 mb-6">

        <div
          className="bg-yellow-400 h-3 rounded-full"
          style={{
            width: `${(answers.filter(a => a !== null).length / quiz.questions.length) * 100}%`
          }}
        />

      </div>


      {quiz.questions.map((q, index) => (

        <div
          key={index}
          className="mb-6 bg-richblack-800 p-6 rounded-lg shadow-md"
        >

          <p className="font-semibold mb-3">
            Question {index + 1}
          </p>

          <p className="mb-4 text-lg">
            {q.question}
          </p>


          {q.options.map((opt, i) => (

            <button
              key={i}
              disabled={quizLocked}
              onClick={() => handleOptionSelect(index, i)}
              className={`block w-full text-left mt-2 p-3 rounded-lg transition ${
                answers[index] === i
                  ? "bg-yellow-400 text-black"
                  : "bg-gray-700 hover:bg-gray-600"
              }`}
            >
              {opt}
            </button>

          ))}

        </div>

      ))}


      <button
        disabled={quizLocked}
        onClick={handleSubmit}
        className="mt-6 w-full bg-blue-600 hover:bg-blue-700 px-4 py-3 rounded-lg font-semibold"
      >
        Submit Quiz
      </button>

    </div>
  )
}

export default Quiz