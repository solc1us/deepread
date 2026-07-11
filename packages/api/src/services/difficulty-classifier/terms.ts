export const COMPLEX_METHODOLOGY_TERMS = [
  "bayesian inference",
  "causal inference",
  "computational model",
  "deep learning",
  "difference-in-differences",
  "discourse analysis",
  "econometric",
  "experimental design",
  "finite element",
  "gradient-based",
  "instrumental variable",
  "latent variable",
  "longitudinal",
  "machine learning",
  "meta-analysis",
  "mixed methods",
  "monte carlo",
  "multilevel model",
  "neural network",
  "phenomenology",
  "quasi-experimental",
  "randomized controlled trial",
  "regression discontinuity",
  "simulation",
  "structural equation",
  "systematic review",
];

export const STATISTICAL_TERMS = [
  "anova",
  "bayesian",
  "benchmark",
  "confidence interval",
  "correlation",
  "dataset",
  "effect size",
  "f-statistic",
  "hypothesis test",
  "logistic regression",
  "multivariate",
  "p-value",
  "regression",
  "sample size",
  "significance",
  "standard deviation",
  "statistical",
  "t-test",
  "variance",
];

export const ADVANCED_TECHNICAL_TERMS = [
  "algorithm",
  "attention mechanism",
  "backpropagation",
  "biomarker",
  "computational",
  "convolutional",
  "cryptographic",
  "differential equation",
  "eigenvalue",
  "embedding",
  "finite element",
  "genomic",
  "gradient",
  "hyperparameter",
  "neural",
  "optimization",
  "polymerase",
  "probabilistic",
  "reinforcement learning",
  "stochastic",
  "transformer",
  "vector",
];

export const PREREQUISITE_TERMS = [
  "advanced",
  "benchmark datasets",
  "domain-specific",
  "graduate",
  "mathematical",
  "mechanistic",
  "model evaluation",
  "prior knowledge",
  "specialized",
  "theoretical framework",
  "underlying mechanism",
];

export const ACADEMIC_JARGON_TERMS = [
  "construct",
  "epistemological",
  "framework",
  "heterogeneity",
  "implementation fidelity",
  "implications",
  "intervention",
  "methodological",
  "operationalization",
  "paradigm",
  "phenomenon",
  "robustness",
  "taxonomy",
  "validity",
];

export const CLARITY_SIGNALS = [
  "this paper",
  "this study",
  "we examine",
  "we investigate",
  "we report",
  "we show",
  "results suggest",
  "findings suggest",
  "the study compares",
];

export const VAGUE_SIGNALS = ["complex", "novel", "robust", "significant", "various", "multiple", "comprehensive"];

export const DOMAIN_SPECIFIC_CATEGORIES = ["computer science", "engineering", "health", "medicine", "psychology"];

function uniqueTerms(terms: string[]) {
  return [...new Set(terms)];
}

export const V2_COMPLEX_METHODOLOGY_TERMS = uniqueTerms([
  ...COMPLEX_METHODOLOGY_TERMS,
  "intention-to-treat",
  "cohort study",
  "case-control study",
  "cross-sectional study",
  "structural equation modeling",
  "path analysis",
  "mediation analysis",
  "moderation analysis",
  "confirmatory factor analysis",
  "exploratory factor analysis",
  "mixed-effects model",
  "survival analysis",
  "linear regression",
  "hierarchical regression",
  "scale validation",
]);

export const V2_STATISTICAL_TERMS = uniqueTerms([
  ...STATISTICAL_TERMS,
  "linear regression",
  "hierarchical regression",
  "odds ratio",
  "hazard ratio",
  "chi-square",
  "bootstrap",
  "manova",
  "statistical significance",
  "survival analysis",
  "path analysis",
  "mediation analysis",
  "moderation analysis",
  "confirmatory factor analysis",
  "exploratory factor analysis",
]);

export const V2_ADVANCED_TECHNICAL_TERMS = uniqueTerms([
  ...ADVANCED_TECHNICAL_TERMS,
  "model",
  "software",
  "system",
  "scale validation",
  "latent variable",
]);

export const V2_PREREQUISITE_TERMS = uniqueTerms([
  ...PREREQUISITE_TERMS,
  "prerequisite",
  "domain knowledge",
  "technical background",
  "advanced coursework",
]);

export const V2_ACADEMIC_JARGON_TERMS = uniqueTerms([
  ...ACADEMIC_JARGON_TERMS,
  "conceptualization",
  "generalizability",
  "theoretical",
]);

export const METHOD_SIGNALS = [
  "survey",
  "experiment",
  "interview",
  "case study",
  "participants",
  "sample",
  "questionnaire",
  "dataset",
  "analysis",
  "regression",
  "systematic review",
  "meta-analysis",
];

export const RESULT_SIGNALS = [
  "results show",
  "results indicate",
  "findings show",
  "findings suggest",
  "we found",
  "the study found",
  "significant effect",
  "increased",
  "decreased",
  "improved",
  "relationship",
  "association",
  "correlation",
];

export const VAGUE_PHRASES = [
  "plays an important role",
  "is very important",
  "various aspects",
  "many challenges",
  "many benefits",
  "in today's world",
  "this paper discusses",
  "this article explores",
  "general overview",
  "comprehensive overview",
];

export const METADATA_ONLY_SIGNALS = [
  "books reviewed",
  "book review",
  "reviewed by",
  "editorial",
  "corrigendum",
  "erratum",
  "conference announcement",
  "table of contents",
];

export const STRONG_METHODOLOGY_TERMS = [
  "systematic review",
  "meta-analysis",
  "randomized controlled trial",
  "intention-to-treat",
  "causal inference",
  "structural equation modeling",
  "confirmatory factor analysis",
  "exploratory factor analysis",
  "multilevel model",
  "mixed-effects model",
  "survival analysis",
];

export const STRONG_STATISTICAL_TERMS = [
  "mediation analysis",
  "moderation analysis",
  "path analysis",
  "logistic regression",
  "hierarchical regression",
  "odds ratio",
  "hazard ratio",
  "manova",
  "bootstrap",
];

export const STRONG_TECHNICAL_TERMS = [
  "deep learning",
  "neural network",
  "reinforcement learning",
  "optimization",
  "cryptographic",
  "transformer",
  "backpropagation",
  "differential equation",
  "finite element",
];

export const ADVANCED_SIGNAL_GROUPS = {
  advancedMethodology: [
    "systematic review",
    "meta-analysis",
    "randomized controlled trial",
    "intention-to-treat",
    "causal inference",
  ],
  machineLearning: [
    "deep learning",
    "neural network",
    "reinforcement learning",
    "transformer",
    "backpropagation",
  ],
  mathematicalQuantum: [
    "quantum computing",
    "quantum machine learning",
    "hilbert space",
    "eigenvalue",
    "differential equation",
    "stochastic process",
  ],
  biomedicalMolecular: [
    "genomic",
    "biomarker",
    "molecular modeling",
    "molecular featurization",
    "polymerase",
    "clinical trial",
  ],
  engineeringPhysics: [
    "finite element",
    "fluid mechanics",
    "computational fluid dynamics",
    "structural dynamics",
    "thermodynamics",
  ],
  advancedStatistics: [
    "structural equation modeling",
    "causal inference",
    "survival analysis",
    "multilevel model",
    "mixed-effects model",
    "bayesian inference",
    "factor analysis",
  ],
} as const;
