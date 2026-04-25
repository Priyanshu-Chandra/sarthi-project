import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { getCourseSessionHistory } from '../../../services/operations/liveAnalyticsAPI'
import { IoArrowBack, IoTimeOutline, IoPeopleOutline, IoStatsChartOutline, IoPlayOutline } from 'react-icons/io5'
import InstructorLiveDashboard from './InstructorLiveDashboard'
import { format } from 'date-fns'

const InstructorSessionHistory = () => {
  const { courseId } = useParams()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { token } = useSelector((state) => state.auth)
  
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedSessionId, setSelectedSessionId] = useState(null)

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true)
      const res = await dispatch(getCourseSessionHistory(courseId, token))
      if (res) setSessions(res)
      setLoading(false)
    }
    fetchHistory()
  }, [courseId, token, dispatch])

  const calculateDuration = (start, end) => {
    if (!start || !end) return "N/A"
    const duration = Math.floor((new Date(end) - new Date(start)) / 1000)
    const hours = Math.floor(duration / 3600)
    const minutes = Math.floor((duration % 3600) / 60)
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
  }

  if (selectedSessionId) {
    return (
      <div className="relative h-screen w-full bg-richblack-900">
        <button 
          onClick={() => setSelectedSessionId(null)}
          className="absolute top-4 left-4 z-[100] flex items-center gap-2 px-4 py-2 bg-richblack-800 text-richblack-5 rounded-lg border border-richblack-700 hover:bg-richblack-700 transition-all font-medium"
        >
          <IoArrowBack /> Exit Summary
        </button>
        <InstructorLiveDashboard 
          sessionId={selectedSessionId} 
          isHistorical={true} 
          onClose={() => setSelectedSessionId(null)} 
        />
      </div>
    )
  }

  return (
    <div className="p-8 min-h-screen bg-richblack-900 text-richblack-5">
      <div className="flex items-center justify-between mb-8">
        <div>
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-richblack-300 hover:text-yellow-50 transition-all mb-2"
          >
            <IoArrowBack /> Back to Courses
          </button>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-50 to-orange-200 bg-clip-text text-transparent">
            Live Session History
          </h1>
          <p className="text-richblack-400 mt-1">
            Review past class performance and student engagement metrics.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-richblack-800 rounded-xl animate-pulse"></div>
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-richblack-800 rounded-2xl border border-dashed border-richblack-600">
          <div className="p-4 bg-richblack-700 rounded-full mb-4">
            <IoStatsChartOutline className="text-4xl text-richblack-400" />
          </div>
          <h3 className="text-xl font-semibold">No Sessions Found</h3>
          <p className="text-richblack-400">You haven't conducted any live classes for this course yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sessions.map((session) => (
            <div 
              key={session._id}
              className="group relative bg-richblack-800 border border-richblack-700 rounded-2xl overflow-hidden hover:border-yellow-200/50 transition-all duration-300"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex flex-col">
                    <span className="text-sm text-yellow-50 font-semibold mb-1 uppercase tracking-wider">
                      {format(new Date(session.startedAt), 'EEE, MMM do')}
                    </span>
                    <span className="text-xl font-bold">
                      {format(new Date(session.startedAt), 'hh:mm a')}
                    </span>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-tighter ${
                    session.status === 'ended' ? 'bg-caribbeangreen-900/40 text-caribbeangreen-100' : 'bg-yellow-900/40 text-yellow-100'
                  }`}>
                    {session.status}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 my-6">
                  <div className="flex items-center gap-2 text-richblack-300">
                    <IoTimeOutline className="text-xl text-richblack-100" />
                    <span className="text-sm">{calculateDuration(session.startedAt, session.endedAt)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-richblack-300">
                    <IoPeopleOutline className="text-xl text-richblack-100" />
                    <span className="text-sm">{session.presentStudents || 0} Attended</span>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedSessionId(session._id)}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-richblack-700 text-richblack-5 rounded-xl border border-richblack-600 group-hover:bg-yellow-50 group-hover:text-black transition-all duration-300 font-bold"
                >
                  <IoPlayOutline /> View Report
                </button>
              </div>
              
              {/* Decorative accent */}
              <div className="absolute top-0 left-0 w-1 h-full bg-yellow-50 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default InstructorSessionHistory
