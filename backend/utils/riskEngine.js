const RISK_CONFIG = {
  HIGH: 25,
  SUSPICIOUS: 10,
  MAX_SCORE: 100
};

/**
 * Intelligent Risk Scoring Engine
 * Weights various proctoring violations to calculate a risk score/level.
 */
const calculateRisk = (result) => {
  let score = 0;

  // Weighted scoring system
  score += (result.tabSwitchCount || 0) * 2;
  score += (result.multipleFacesDetected ? 25 : 0);
  score += (result.cameraDisabled ? 10 : 0);
  score += (result.lookingAwayCount || 0) * 2;
  score += (result.noiseDetected ? 25 : 0);

  // Safety cap to prevent calculation spikes
  score = Math.min(score, RISK_CONFIG.MAX_SCORE);

  let level = "SAFE";

  if (score >= RISK_CONFIG.HIGH) level = "HIGH";
  else if (score >= RISK_CONFIG.SUSPICIOUS) level = "SUSPICIOUS";

  return { score, level };
};

module.exports = { calculateRisk, RISK_CONFIG };
