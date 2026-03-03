export interface Rule {
  category: string;
  subCategory: string;
  weight: number;
  scoringType: "Higher is Better" | "Lower is Better";
  maxScore: number;
}

export interface Score {
  evaluator: string;
  supplier: string;
  category: string;
  subCategory: string;
  rawScore: number;
}

export interface ReconciledScore extends Score {
  weight: number;
  scoringType: "Higher is Better" | "Lower is Better";
  maxScore: number;
  minPriceInGroup?: number;
  weightedScore: number;
}
