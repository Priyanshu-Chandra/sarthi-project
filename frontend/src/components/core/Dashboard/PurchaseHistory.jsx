import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { getPurchaseHistory } from "../../../services/operations/profileAPI";
import { useNavigate } from "react-router-dom";
import Img from "../../common/Img";
import {
  FiCalendar,
  FiCreditCard,
  FiHash,
  FiPackage,
  FiUser,
  FiTag,
} from "react-icons/fi";
import { HiOutlineReceiptTax } from "react-icons/hi";

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className="flex flex-col sm:flex-row gap-4 border border-richblack-700 rounded-xl p-5 animate-pulse">
      <div className="h-20 w-20 shrink-0 rounded-lg skeleton" />
      <div className="flex flex-col flex-1 gap-2 justify-center">
        <div className="h-4 w-1/2 rounded-md skeleton" />
        <div className="h-3 w-3/4 rounded-md skeleton" />
        <div className="h-3 w-1/4 rounded-md skeleton" />
      </div>
      <div className="flex flex-col items-end gap-2 justify-center">
        <div className="h-6 w-24 rounded-lg skeleton" />
        <div className="h-3 w-32 rounded-md skeleton" />
      </div>
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
function Badge({ children, color = "yellow" }) {
  const colors = {
    yellow: "bg-yellow-900 text-yellow-100 border-yellow-700",
    green: "bg-green-900 text-green-100 border-green-700",
    blue: "bg-blue-900 text-blue-200 border-blue-700",
    gray: "bg-richblack-700 text-richblack-200 border-richblack-600",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${colors[color]}`}
    >
      {children}
    </span>
  );
}

// ── Detail row ────────────────────────────────────────────────────────────────
function Detail({ icon: Icon, label, value, mono = false }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="mt-0.5 shrink-0 text-richblack-400" size={14} />
      <span className="text-richblack-400 whitespace-nowrap">{label}:</span>
      <span
        className={`text-richblack-100 break-all ${
          mono ? "font-mono text-xs" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PurchaseHistory() {
  const { token } = useSelector((state) => state.auth);
  const navigate = useNavigate();

  const [history, setHistory] = useState(null); // null = loading
  const [expanded, setExpanded] = useState(null); // id of expanded card

  useEffect(() => {
    (async () => {
      const data = await getPurchaseHistory(token);
      setHistory(data);
    })();
  }, [token]);

  // ── derived stats ────────────────────────────────────────────────────────
  const totalSpent = history?.reduce((s, h) => s + (h.amountPaid ?? 0), 0) ?? 0;

  // ── render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[70vh]">
      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-richblack-5 font-boogaloo">
          Purchase History
        </h1>
        <p className="mt-1 text-sm text-richblack-300">
          A complete record of every course you have enrolled into on Sarthi.
        </p>
      </div>

      {/* ── Summary bar ───────────────────────────────────────────────────── */}
      {history && history.length > 0 && (
        <div className="mb-8 grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="bg-richblack-800 rounded-xl p-4 border border-richblack-700">
            <p className="text-xs text-richblack-400 uppercase tracking-wider mb-1">
              Total Purchases
            </p>
            <p className="text-2xl font-bold text-richblack-5">
              {history.length}
            </p>
          </div>
          <div className="bg-richblack-800 rounded-xl p-4 border border-richblack-700">
            <p className="text-xs text-richblack-400 uppercase tracking-wider mb-1">
              Total Spent
            </p>
            <p className="text-2xl font-bold text-yellow-50">
              ₹{totalSpent.toLocaleString("en-IN")}
            </p>
          </div>
          <div className="bg-richblack-800 rounded-xl p-4 border border-richblack-700 col-span-2 sm:col-span-1">
            <p className="text-xs text-richblack-400 uppercase tracking-wider mb-1">
              Last Purchase
            </p>
            <p className="text-base font-semibold text-richblack-100 truncate">
              {history[0]?.course?.courseName ?? "—"}
            </p>
          </div>
        </div>
      )}

      {/* ── Loading ───────────────────────────────────────────────────────── */}
      {history === null && (
        <div className="flex flex-col gap-4">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {history?.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <HiOutlineReceiptTax size={56} className="text-richblack-500" />
          <p className="text-xl font-medium text-richblack-300">
            No purchases yet
          </p>
          <p className="text-sm text-richblack-500">
            Browse our catalog and enroll in a course to see your purchase history here.
          </p>
          <button
            onClick={() => navigate("/")}
            className="mt-2 rounded-lg bg-yellow-50 px-5 py-2 text-sm font-semibold text-richblack-900 hover:bg-yellow-100 transition"
          >
            Explore Courses
          </button>
        </div>
      )}

      {/* ── History list ──────────────────────────────────────────────────── */}
      {history && history.length > 0 && (
        <div className="flex flex-col gap-4">
          {history.map((item, idx) => {
            const course = item.course;
            const isExpanded = expanded === idx;
            const date = item.enrolledAt
              ? new Date(item.enrolledAt)
              : null;

            return (
              <div
                key={idx}
                className="border border-richblack-700 rounded-xl overflow-hidden bg-richblack-800 hover:border-richblack-500 transition-colors"
              >
                {/* ── Card header (always visible) ─────────────────── */}
                <div className="flex flex-col sm:flex-row gap-4 p-5">
                  {/* Thumbnail */}
                  <div
                    className="shrink-0 cursor-pointer"
                    onClick={() =>
                      navigate(`/courses/${course._id}`)
                    }
                  >
                    <Img
                      src={course.thumbnail}
                      alt={course.courseName}
                      className="h-20 w-20 rounded-lg object-cover border border-richblack-600"
                    />
                  </div>

                  {/* Course info */}
                  <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    <h2
                      className="font-semibold text-richblack-5 cursor-pointer hover:text-yellow-50 transition truncate"
                      onClick={() => navigate(`/courses/${course._id}`)}
                    >
                      {course.courseName}
                    </h2>

                    <p className="text-xs text-richblack-400 line-clamp-2">
                      {course.courseDescription}
                    </p>

                    <div className="flex flex-wrap gap-2 mt-1">
                      {course.instructor && (
                        <Badge color="blue">
                          <FiUser size={10} />
                          {course.instructor.firstName}{" "}
                          {course.instructor.lastName}
                        </Badge>
                      )}
                      {course.category && (
                        <Badge color="gray">
                          <FiTag size={10} />
                          {course.category.name}
                        </Badge>
                      )}
                      {item.videosCompleted > 0 && (
                        <Badge color="green">
                          <FiPackage size={10} />
                          {item.videosCompleted} videos done
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Price + date */}
                  <div className="flex flex-row sm:flex-col items-start sm:items-end justify-between sm:justify-center gap-2 shrink-0">
                    <div className="text-right">
                      <p className="text-xl font-bold text-yellow-50">
                        {item.amountPaid != null
                          ? `₹${Number(item.amountPaid).toLocaleString("en-IN")}`
                          : "Free"}
                      </p>
                      <p className="text-xs text-richblack-400">Amount paid</p>
                    </div>

                    {date && (
                      <div className="text-right">
                        <p className="text-xs text-richblack-300">
                          {date.toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                        <p className="text-xs text-richblack-500">
                          {date.toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    )}

                    <button
                      onClick={() => setExpanded(isExpanded ? null : idx)}
                      className="text-xs text-yellow-50 hover:underline mt-1"
                    >
                      {isExpanded ? "Hide details ▲" : "View details ▼"}
                    </button>
                  </div>
                </div>

                {/* ── Expanded payment details ──────────────────────── */}
                {isExpanded && (
                  <div className="border-t border-richblack-700 bg-richblack-900 px-5 py-4">
                    <p className="text-xs uppercase tracking-widest text-richblack-400 mb-3">
                      Payment Details
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Detail
                        icon={FiCalendar}
                        label="Enrolled on"
                        value={
                          date
                            ? date.toLocaleString("en-IN", {
                                dateStyle: "long",
                                timeStyle: "short",
                              })
                            : "Unknown"
                        }
                      />
                      <Detail
                        icon={FiCreditCard}
                        label="Amount paid"
                        value={
                          item.amountPaid != null
                            ? `₹${Number(item.amountPaid).toLocaleString(
                                "en-IN"
                              )}`
                            : "Free / Not recorded"
                        }
                      />
                      <Detail
                        icon={FiHash}
                        label="Order ID"
                        value={item.orderId || "Not captured"}
                        mono
                      />
                      <Detail
                        icon={FiHash}
                        label="Payment ID"
                        value={item.paymentId || "Not captured"}
                        mono
                      />
                      <Detail
                        icon={FiUser}
                        label="Instructor"
                        value={
                          course.instructor
                            ? `${course.instructor.firstName} ${course.instructor.lastName} (${course.instructor.email})`
                            : null
                        }
                      />
                      <Detail
                        icon={FiTag}
                        label="Category"
                        value={course.category?.name}
                      />
                    </div>

                    <div className="mt-4 flex gap-3">
                      <button
                        onClick={() => navigate(`/courses/${course._id}`)}
                        className="rounded-lg border border-richblack-600 px-4 py-1.5 text-xs text-richblack-200 hover:bg-richblack-700 transition"
                      >
                        View Course
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
