import { normalizeText } from "./text-utils";

export interface CategoryProfile {
  neutralJargonTerms: string[];
  strongTerms: string[];
}

export const DEFAULT_CATEGORY_PROFILE: CategoryProfile = {
  neutralJargonTerms: [],
  strongTerms: [],
};

export const CATEGORY_PROFILES: Record<string, CategoryProfile> = {
  business: {
    neutralJargonTerms: ["business", "management", "organization", "market", "strategy"],
    strongTerms: ["econometric", "causal inference", "structural equation modeling"],
  },
  "computer science": {
    neutralJargonTerms: ["dataset", "model", "algorithm", "framework", "software", "system"],
    strongTerms: [
      "deep learning",
      "neural network",
      "reinforcement learning",
      "optimization",
      "cryptographic",
      "transformer",
      "backpropagation",
    ],
  },
  education: {
    neutralJargonTerms: ["student", "teacher", "classroom", "learning", "curriculum", "intervention"],
    strongTerms: [
      "meta-analysis",
      "systematic review",
      "structural equation modeling",
      "experimental design",
    ],
  },
  engineering: {
    neutralJargonTerms: ["engineering", "design", "system", "model", "simulation"],
    strongTerms: ["finite element", "differential equation", "optimization", "simulation"],
  },
  health: {
    neutralJargonTerms: ["patient", "clinical", "treatment", "health", "disease"],
    strongTerms: [
      "randomized controlled trial",
      "cohort study",
      "survival analysis",
      "hazard ratio",
      "meta-analysis",
      "intention-to-treat",
    ],
  },
  psychology: {
    neutralJargonTerms: ["behavior", "cognitive", "participant", "scale", "psychological"],
    strongTerms: [
      "structural equation modeling",
      "mediation analysis",
      "moderation analysis",
      "factor analysis",
      "scale validation",
      "latent variable",
    ],
  },
  "social science": {
    neutralJargonTerms: ["society", "social", "community", "policy", "population"],
    strongTerms: ["causal inference", "econometric", "multilevel model", "structural equation modeling"],
  },
  technology: {
    neutralJargonTerms: ["technology", "system", "software", "digital", "platform", "model"],
    strongTerms: ["deep learning", "neural network", "cryptographic", "optimization", "transformer"],
  },
};

export function getCategoryProfile(categoryName?: string) {
  if (!categoryName) {
    return DEFAULT_CATEGORY_PROFILE;
  }

  return CATEGORY_PROFILES[normalizeText(categoryName)] ?? DEFAULT_CATEGORY_PROFILE;
}
