import { Rule, Score, ReconciledScore } from "../types";
import { normalizeString } from "./stringUtils";

export const reconcileAndScore = (
  rules: Rule[],
  scores: Score[],
): { reconciled: ReconciledScore[]; warnings: string[] } => {
  const warnings: string[] = [];
  const rulesMap = new Map<string, Rule>();

  rules.forEach((rule) => {
    const key = `${normalizeString(rule.category)}|${normalizeString(rule.subCategory)}`;
    rulesMap.set(key, rule);
  });

  // Find min price for "Lower is Better" per sub-category
  const minPrices = new Map<string, number>();
  scores.forEach((score) => {
    const key = `${normalizeString(score.category)}|${normalizeString(score.subCategory)}`;
    const rule = rulesMap.get(key);
    if (rule && rule.scoringType === "Lower is Better") {
      const currentMin = minPrices.get(key);
      if (currentMin === undefined || score.rawScore < currentMin) {
        minPrices.set(key, score.rawScore);
      }
    }
  });

  const reconciled: ReconciledScore[] = [];

  scores.forEach((score) => {
    const key = `${normalizeString(score.category)}|${normalizeString(score.subCategory)}`;
    const rule = rulesMap.get(key);

    if (!rule) {
      warnings.push(
        `Missing rule for Category: "${score.category}", Sub-Category: "${score.subCategory}"`,
      );
      return;
    }

    let weightedScore = 0;
    let minPriceInGroup: number | undefined;

    if (rule.scoringType === "Higher is Better") {
      weightedScore = (score.rawScore / rule.maxScore) * rule.weight;
    } else if (rule.scoringType === "Lower is Better") {
      minPriceInGroup = minPrices.get(key) || score.rawScore;
      // Prevent division by zero
      if (score.rawScore > 0) {
        weightedScore = (minPriceInGroup / score.rawScore) * rule.weight;
      } else {
        weightedScore = 0;
      }
    }

    reconciled.push({
      ...score,
      weight: rule.weight,
      scoringType: rule.scoringType,
      maxScore: rule.maxScore,
      minPriceInGroup,
      weightedScore,
    });
  });

  return { reconciled, warnings: Array.from(new Set(warnings)) };
};
