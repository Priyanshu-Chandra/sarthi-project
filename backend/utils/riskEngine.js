const RISK_CONFIG = {
  HIGH: 9,
  SUSPICIOUS: 4,
  MAX_SCORE: 20
};

/**
 * Intelligent Risk Scoring Engine
 * Weights various proctoring violations to calculate a risk score/level.
 */
const calculateRisk = (result) => {
  let score = 0;

  // Weighted scoring system
  score += (result.tabSwitchCount || 0) * 2;
  score += (result.multipleFacesDetected ? 5 : 0);
  score += (result.cameraDisabled ? 5 : 0);
  score += (result.lookingAwayCount || 0) * 2;
  score += (result.noiseDetected ? 1 : 0);

  // Safety cap to prevent calculation spikes
  score = Math.min(score, RISK_CONFIG.MAX_SCORE);

  let level = "SAFE";

  if (score >= RISK_CONFIG.HIGH) level = "HIGH";
  else if (score >= RISK_CONFIG.SUSPICIOUS) level = "SUSPICIOUS";

  return { score, level };
};

module.exports = { calculateRisk, RISK_CONFIG };
