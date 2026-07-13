import { MATERIAL_SEMIOTIC_VARIANTS } from "./terms";
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
    strongTerms: [
      "causal inference",
      "complexity theory",
      "conceptual framework development",
      "critical theory",
      "cultural economy",
      "econometric",
      "epistemology",
      "financialization",
      "legitimation",
      "network effects",
      "platform capitalism",
      "structural equation modeling",
      "systems theory",
    ],
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
      "combinatorial optimization",
      "hilbert space",
      "interpretable machine learning",
      "kernel method",
      "machine learning interpretability",
      "model interpretability",
      "molecular featurization",
      "molecular machine learning",
      "signal processing",
      "stochastic optimization",
      "tensor decomposition",
      "tensor factorization",
    ],
  },
  education: {
    neutralJargonTerms: ["student", "teacher", "classroom", "learning", "curriculum", "intervention"],
    strongTerms: [
      "meta-analysis",
      "systematic review",
      "structural equation modeling",
      "experimental design",
      "bibliometric analysis",
      "conditional process analysis",
      "mixed-model ancova",
      "repeated-measures analysis",
    ],
  },
  engineering: {
    neutralJargonTerms: ["engineering", "design", "system", "model", "simulation"],
    strongTerms: [
      "combinatorial optimization",
      "differential equation",
      "finite element",
      "first-principles calculation",
      "first-principles method",
      "hilbert space",
      "kernel method",
      "materials informatics",
      "optimization",
      "signal processing",
      "simulation",
      "solid-state materials",
      "stochastic optimization",
      "tensor decomposition",
      "tensor factorization",
    ],
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
      "adaptive intervention",
      "compartmental model",
      "compartmental modeling",
      "cost-effectiveness analysis",
      "disease burden",
      "economic evaluation",
      "epidemiological model",
      "epidemiological modeling",
      "evidence synthesis",
      "implementation fidelity",
      "implementation science",
      ...MATERIAL_SEMIOTIC_VARIANTS,
      "opportunity cost",
      "quasi-experimental evaluation",
      "reproduction number",
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
      "analysis of covariance",
      "conditional process analysis",
      "mixed-model ancova",
      "repeated-measures analysis",
    ],
  },
  "social science": {
    neutralJargonTerms: ["society", "social", "community", "policy", "population"],
    strongTerms: [
      "bioecological framework",
      "causal inference",
      "complexity theory",
      "conceptual framework development",
      "critical theory",
      "cultural economy",
      "econometric",
      "epistemology",
      "financialization",
      "intersectionality",
      "legitimation",
      ...MATERIAL_SEMIOTIC_VARIANTS,
      "multi-level social analysis",
      "multilevel model",
      "network effects",
      "platform capitalism",
      "social mechanisms",
      "structural equation modeling",
      "systems theory",
    ],
  },
  technology: {
    neutralJargonTerms: ["technology", "system", "software", "digital", "platform", "model"],
    strongTerms: [
      "combinatorial optimization",
      "cryptographic",
      "deep learning",
      "interpretable machine learning",
      "machine learning interpretability",
      "model interpretability",
      "neural network",
      "optimization",
      "signal processing",
      "stochastic optimization",
      "tensor decomposition",
      "tensor factorization",
      "transformer",
    ],
  },
};

export function getCategoryProfile(categoryName?: string) {
  if (!categoryName) {
    return DEFAULT_CATEGORY_PROFILE;
  }

  return CATEGORY_PROFILES[normalizeText(categoryName)] ?? DEFAULT_CATEGORY_PROFILE;
}
