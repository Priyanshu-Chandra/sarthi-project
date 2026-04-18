import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { apiConnector } from "../services/apiconnector";
import { courseEndpoints } from "../services/apis";
import { formattedDate } from "../utils/dateFormatter";

export default function VerifyCertificate() {
  const { certificateId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [certData, setCertData] = useState(null);

  useEffect(() => {
    const fetchCertificate = async () => {
      try {
        setLoading(true);
        // We will add VERIFY_CERTIFICATE_API to courseEndpoints in services/apis.js
        const res = await apiConnector("GET", `${courseEndpoints.VERIFY_CERTIFICATE_API}/${certificateId}`);
        if (res.data.valid) {
          setCertData(res.data);
        } else {
          setError(res.data.message || "Invalid certificate format");
        }
      } catch (err) {
        if (err.response && err.response.data && !err.response.data.valid) {
          setError(err.response.data.message || "Invalid certificate ID.");
        } else {
          setError("Failed to verify certificate. Please try again.");
        }
      } finally {
        setLoading(false);
      }
    };
    if (certificateId) {
      fetchCertificate();
    }
  }, [certificateId]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] py-12 px-4 sm:px-6 lg:px-8 bg-richblack-900 text-richblack-5">
      <div className="w-full max-w-2xl bg-richblack-800 rounded-lg shadow-xl p-8 border border-richblack-700">
        <h1 className="text-3xl font-bold text-center text-richblack-5 mb-8">
          Certificate Verification
        </h1>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="spinner"></div>
            <span className="ml-4 text-richblack-200">Verifying certificate...</span>
          </div>
        ) : error ? (
          <div className="bg-pink-100 text-pink-700 p-6 rounded-md mb-6 border border-pink-200 text-center">
            <div className="text-5xl mb-4">❌</div>
            <h2 className="text-xl font-semibold mb-2">Verification Failed</h2>
            <p>{error}</p>
            <p className="mt-4 text-sm">Please ensure the certificate ID is correct.</p>
          </div>
        ) : certData ? (
          <div className="border border-caribbeangreen-200 bg-caribbeangreen-50 bg-opacity-10 p-8 rounded-lg text-center relative overflow-hidden">
             {/* Decorative element */}
             <div className="absolute top-0 right-0 p-4 opacity-20">
               <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-caribbeangreen-300"><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"></path><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"></path><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"></path></svg>
             </div>
            
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-caribbeangreen-300 mb-6">Authentic Certificate</h2>
            
            <div className="space-y-4 text-left border-t border-richblack-600 pt-6 mt-6">
              <div>
                <p className="text-sm text-richblack-300 uppercase tracking-wider font-semibold">Awarded To</p>
                <p className="text-xl font-medium text-richblack-5">{certData.studentName}</p>
              </div>
              
              <div>
                <p className="text-sm text-richblack-300 uppercase tracking-wider font-semibold">For completing the course</p>
                <p className="text-xl font-medium text-yellow-50">{certData.courseName}</p>
              </div>
              
              <div className="flex flex-col sm:flex-row sm:gap-12 gap-4 pt-4">
                <div>
                  <p className="text-sm text-richblack-300 uppercase tracking-wider font-semibold">Issue Date</p>
                  <p className="text-md text-richblack-5">{formattedDate(certData.issuedAt)}</p>
                </div>
                
                <div>
                  <p className="text-sm text-richblack-300 uppercase tracking-wider font-semibold">Certificate ID</p>
                  <p className="text-md text-richblack-5 font-mono">{certData.certificateId}</p>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-8 text-center flex justify-center gap-4">
          <Link to="/" className="text-richblack-200 hover:text-yellow-50 transition-colors">
            Return to Home
          </Link>
          <span className="text-richblack-600">|</span>
          <Link to="/catalog" className="text-richblack-200 hover:text-yellow-50 transition-colors">
            Browse Courses
          </Link>
        </div>
      </div>
    </div>
  );
}
