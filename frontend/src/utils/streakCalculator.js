/**
 * Calculates coding streaks from an array of activity objects.
 * Expects activityData: [{ date: 'YYYY-MM-DD', count: number }, ...]
 */
export const calculateStreaks = (activityData) => {
  if (!activityData || activityData.length === 0) {
    return { currentStreak: 0, longestStreak: 0, totalActiveDays: 0 };
  }

  // 1. Sort activity by date (ascending)
  const sortedDays = [...activityData].sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // 2. Map to a set for O(1) lookup
  const activeDates = new Set(sortedDays.map(d => d.date));
  
  // 3. Current Streak Calculation
  let currentStreak = 0;
  const today = new Date();
  const todayStr = today.toLocaleDateString("en-CA");
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toLocaleDateString("en-CA");

  // If no activity today OR yesterday, current streak is 0
  // (unless they just finished a problem today)
  let checkDate = activeDates.has(todayStr) ? today : (activeDates.has(yesterdayStr) ? yesterday : null);

  if (checkDate) {
    let tempDate = new Date(checkDate);
    while (activeDates.has(tempDate.toLocaleDateString("en-CA"))) {
      currentStreak++;
      tempDate.setDate(tempDate.getDate() - 1);
    }
  }

  // 4. Longest Streak Calculation
  let longestStreak = 0;
  let runningStreak = 0;
  let lastDate = null;

  sortedDays.forEach((day) => {
    const currentDate = new Date(day.date);
    
    if (lastDate) {
      const diffTime = Math.abs(currentDate - lastDate);
      const diffDays = Math.round(diffTime / 86400000);
      
      if (diffDays === 1) {
        runningStreak++;
      } else {
        runningStreak = 1;
      }
    } else {
      runningStreak = 1;
    }
    
    if (runningStreak > longestStreak) {
      longestStreak = runningStreak;
    }
    lastDate = currentDate;
  });

  return {
    currentStreak,
    longestStreak,
    totalActiveDays: activeDates.size
  };
};
