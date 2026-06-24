import { classifyPaperDifficulty, type ClassifyPaperDifficultyInput } from "@deepread/api/services/paper-difficulty-classifier";

const samples: Array<{ label: string; paper: ClassifyPaperDifficultyInput }> = [
  {
    label: "beginner-friendly",
    paper: {
      title: "Student Study Habits and Weekly Learning Reflections",
      abstract:
        "This study examines how weekly learning reflections help first-year students understand their study habits. The paper compares short survey responses before and after a four-week classroom activity. Findings suggest that simple reflection prompts helped students plan study time and notice common learning challenges.",
      keywords: ["student learning", "reflection", "study habits"],
      categoryName: "Education",
      publicationYear: 2024,
    },
  },
  {
    label: "moderate",
    paper: {
      title: "Student Perceptions of Generative AI Support in Introductory Programming",
      abstract:
        "This study investigates how students in introductory programming courses describe the benefits and risks of generative AI tools. Interview findings suggest that students value fast explanations but need guidance to avoid over-reliance. The analysis uses a thematic framework and compares responses across students with different programming backgrounds.",
      keywords: ["generative AI", "programming education", "student perception"],
      categoryName: "Computer Science",
      publicationYear: 2025,
    },
  },
  {
    label: "difficult",
    paper: {
      title: "Attention-Based Neural Models for Text Classification",
      abstract:
        "Attention mechanisms are widely used in neural text classification. This paper compares attention visualizations with gradient-based explanations and discusses when these explanations align with model behavior across benchmark datasets. The study reports regression analysis, model evaluation metrics, and robustness checks across multiple computational settings.",
      keywords: ["attention", "neural network", "text classification", "explainable AI"],
      categoryName: "Computer Science",
      publicationYear: 2024,
    },
  },
  {
    label: "expert",
    paper: {
      title: "Finite Element Modeling of Composite Bridge Deck Fatigue Behavior",
      abstract:
        "This paper presents a finite element model for fatigue behavior in composite bridge decks under repeated traffic loading. Simulation results are validated against laboratory measurements and analyzed using stress concentration, damage accumulation, stochastic load assumptions, multivariate regression, confidence interval estimation, and numerical optimization. The method requires prior knowledge of structural mechanics, differential equation models, and domain-specific material behavior.",
      keywords: ["finite element", "fatigue behavior", "simulation", "structural engineering"],
      categoryName: "Engineering",
      publicationYear: 2020,
    },
  },
];

console.log("DEV ONLY: Rule-based classifier manual test. No database writes are performed.\n");

for (const sample of samples) {
  const result = classifyPaperDifficulty(sample.paper);

  console.log(`[${sample.label}] ${sample.paper.title}`);
  console.log(`difficultyLevel: ${result.difficultyLevel}`);
  console.log(`beginnerScore: ${result.beginnerScore}`);
  console.log(`estimatedReadingTime: ${result.estimatedReadingTime} minutes`);
  console.log(`classificationReason: ${result.classificationReason}`);
  console.log(`readingWarning: ${result.readingWarning}`);
  console.log("");
}
