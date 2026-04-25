import React, { useEffect, useMemo, useState } from "react";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const VISIBLE_WEEKDAY_ROWS = new Set([0, 2, 4]);

const toDateKey = (date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatPremiumDate = (dateStr) => {
  try {
    // Force UTC DB strings to render safely in Local Timezone layout
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch (e) {
    return dateStr;
  }
};

const getMonthSections = (activityData, todayKey) => {
  const today = new Date(`${todayKey}T00:00:00`);
  today.setHours(0, 0, 0, 0);

  const startMonth = new Date(today.getFullYear(), today.getMonth() - 11, 1);
  const activityMap = new Map(
    (activityData || []).map((entry) => [entry.date, Number(entry.count) || 0])
  );

  const sections = [];

  for (let offset = 0; offset < 12; offset += 1) {
    const monthDate = new Date(startMonth.getFullYear(), startMonth.getMonth() + offset, 1);
    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

    const leadingEmpty = (monthStart.getDay() + 6) % 7;
    const totalSlots = leadingEmpty + monthEnd.getDate();
    const weekCount = Math.ceil(totalSlots / 7);
    const weeks = Array.from({ length: weekCount }, () => Array(7).fill(null));

    for (let day = 1; day <= monthEnd.getDate(); day += 1) {
      const current = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
      if (current > today) break;

      const weekdayIndex = (current.getDay() + 6) % 7;
      const slotIndex = leadingEmpty + day - 1;
      const weekIndex = Math.floor(slotIndex / 7);
      const date = toDateKey(current);
      const count = activityMap.get(date) || 0;

      let level = 0;
      if (count >= 5) level = 4;
      else if (count >= 3) level = 3;
      else if (count >= 2) level = 2;
      else if (count >= 1) level = 1;

      weeks[weekIndex][weekdayIndex] = { date, count, level };
    }

    sections.push({
      key: `${monthDate.getFullYear()}-${monthDate.getMonth()}`,
      label: MONTH_NAMES[monthDate.getMonth()],
      weeks,
    });
  }

  return sections;
};

const getCellClasses = (level) => {
  switch (level) {
    case 4:
      return "bg-[#39d353] border-[#39d353]";
    case 3:
      return "bg-[#26a641] border-[#26a641]";
    case 2:
      return "bg-[#006d32] border-[#006d32]";
    case 1:
      return "bg-[#0e4429] border-[#0e4429]";
    default:
      return "bg-[#161b22] border-[#263040]";
  }
};

function ActivityHeatmap({ activityData }) {
  const [todayKey, setTodayKey] = useState(() => toDateKey(new Date()));

  useEffect(() => {
    const scheduleNextDayRefresh = () => {
      const now = new Date();
      const nextDay = new Date(now);
      nextDay.setDate(now.getDate() + 1);
      nextDay.setHours(0, 0, 1, 0);

      return window.setTimeout(() => {
        setTodayKey(toDateKey(new Date()));
      }, nextDay.getTime() - now.getTime());
    };

    const timerId = scheduleNextDayRefresh();
    return () => window.clearTimeout(timerId);
  }, [todayKey]);

  const monthSections = useMemo(() => getMonthSections(activityData, todayKey), [activityData, todayKey]);
  const totalSolved = useMemo(
    () => (activityData || []).reduce((sum, entry) => sum + (Number(entry.count) || 0), 0),
    [activityData]
  );

  if (!activityData) return null;

  return (
    <div className="w-full py-4 text-richblack-5">
      <div className="custom-scrollbar overflow-x-auto pb-3">
        <div className="inline-flex min-w-max gap-5">
          <div className="grid shrink-0 grid-rows-7 gap-[6px] pr-3 pt-8 text-xs font-semibold text-richblack-300">
            {WEEKDAY_LABELS.map((label, index) => (
              <div key={label} className="flex h-[14px] items-center justify-end">
                {VISIBLE_WEEKDAY_ROWS.has(index) ? label : ""}
              </div>
            ))}
          </div>

          {monthSections.map((month) => (
            <div key={month.key} className="shrink-0">
              <div className="mb-3 text-sm font-semibold text-richblack-25">{month.label}</div>
              <div
                className="grid gap-[6px]"
                style={{ gridTemplateColumns: `repeat(${month.weeks.length}, minmax(0, 14px))` }}
              >
                {month.weeks.map((week, weekIndex) =>
                  week.map((day, rowIndex) => {
                    if (!day) {
                      return <div key={`${month.key}-${weekIndex}-${rowIndex}`} className="h-[14px] w-[14px]" />;
                    }

                    return (
                      <div key={day.date} className="group relative h-[14px] w-[14px]">
                        <div
                          className={`h-[14px] w-[14px] rounded-[3px] border transition-transform duration-150 group-hover:scale-110 ${getCellClasses(day.level)}`}
                        />
                        <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-richblack-5 px-2 py-1 text-[11px] font-medium text-richblack-900 shadow-lg group-hover:block">
                          {formatPremiumDate(day.date)}: {day.count} submission{day.count === 1 ? "" : "s"}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 text-sm text-richblack-25">
        <span>{totalSolved} problems solved in the last year</span>

        <div className="flex items-center gap-2">
          <span>Less</span>
          <div className="flex gap-[6px]">
            {[0, 1, 2, 3, 4].map((level) => (
              <div
                key={level}
                className={`h-[14px] w-[14px] rounded-[3px] border ${getCellClasses(level)}`}
              />
            ))}
          </div>
          <span>More</span>
        </div>
      </div>

      {totalSolved === 0 && (
        <p className="mt-4 text-center text-sm text-richblack-300">
          Solve a problem today to start filling your yearly activity map.
        </p>
      )}
    </div>
  );
}

export function ActivityHeatmapSkeleton() {
  const dummyMonths = Array.from({ length: 12 }, (_, i) => i);
  const visibleWeeks = 52;

  return (
    <div className="w-full py-4 max-w-full overflow-hidden">
      <div className="flex min-w-max gap-5 opacity-40 animate-pulse pointer-events-none">
        
        {/* Days Column */}
        <div className="grid shrink-0 grid-rows-7 gap-[6px] pr-3 pt-8 text-[10px] font-semibold text-richblack-400/50">
          {WEEKDAY_LABELS.map((label, index) => (
            <div key={label} className="flex h-[14px] items-center justify-end">
              {VISIBLE_WEEKDAY_ROWS.has(index) ? label : ""}
            </div>
          ))}
        </div>

        {/* Dummy 12 Months Grid */}
        <div className="flex gap-2">
          {dummyMonths.map((m) => (
            <div key={m} className="shrink-0 flex flex-col">
              <div className="mb-3 h-4 w-8 bg-richblack-700 rounded text-transparent text-sm">.</div>
              <div
                className="grid gap-[6px]"
                style={{ gridTemplateColumns: `repeat(${m === 0 ? 3 : m === 11 ? 5 : 4}, minmax(0, 14px))` }}
              >
                {Array.from({ length: m === 0 ? 3 : m === 11 ? 5 : 4 }).map((_, wIdx) =>
                  Array.from({ length: 7 }).map((_, dIdx) => (
                    <div
                      key={`sk-${m}-${wIdx}-${dIdx}`}
                      className="h-[14px] w-[14px] rounded-[3px] bg-richblack-800"
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 text-sm text-richblack-25 opacity-30 animate-pulse pointer-events-none">
        <div className="h-5 w-48 bg-richblack-700 rounded"></div>
        <div className="flex items-center gap-2">
           <div className="h-4 w-8 bg-richblack-700 rounded"></div>
           <div className="flex gap-[6px]">
             {[0, 1, 2, 3, 4].map((level) => (
               <div key={level} className="h-[14px] w-[14px] rounded-[3px] bg-richblack-700" />
             ))}
           </div>
           <div className="h-4 w-8 bg-richblack-700 rounded"></div>
        </div>
      </div>
    </div>
  );
}

export default ActivityHeatmap;
