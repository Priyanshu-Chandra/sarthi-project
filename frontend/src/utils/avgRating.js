export default function GetAvgRating(ratingArr) {
  if (!ratingArr || ratingArr.length === 0) return 0;
  const totalReviewCount = ratingArr.reduce((acc, curr) => {
    acc += Number(curr.rating) || 0;
    return acc;
  }, 0);

  const multiplier = Math.pow(10, 1);
  const avgReviewCount =
    Math.round((totalReviewCount / ratingArr.length) * multiplier) / multiplier;

  // clamp between 0 and 5 to guard against any legacy data anomalies
  return Math.min(5, Math.max(0, avgReviewCount));
}
