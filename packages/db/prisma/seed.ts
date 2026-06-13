import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";

import { DifficultyLevel, PaperStatus, PrismaClient } from "./generated/client";

dotenv.config({
  path: "../../apps/server/.env",
});

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed the database.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString,
  }),
});

const categories = [
  {
    name: "Technology",
    description: "Applied technology, digital tools, and human-centered systems.",
  },
  {
    name: "Computer Science",
    description: "Computing, software systems, algorithms, and artificial intelligence.",
  },
  {
    name: "Education",
    description: "Teaching, learning, curriculum, and educational technology.",
  },
  {
    name: "Health",
    description: "Public health, medicine, wellness, and healthcare delivery.",
  },
  {
    name: "Business",
    description: "Management, markets, entrepreneurship, and organizational studies.",
  },
  {
    name: "Psychology",
    description: "Human behavior, cognition, motivation, and mental processes.",
  },
  {
    name: "Social Science",
    description: "Society, culture, policy, and social research.",
  },
  {
    name: "Engineering",
    description: "Engineering systems, design methods, and applied technical research.",
  },
];

const papers = [
  {
    title: "Designing Beginner-Friendly Learning Dashboards for Online Courses",
    abstract:
      "This paper studies how simple progress indicators and weekly activity summaries help first-year students understand their learning habits in online courses. The study compares dashboard prototypes using survey feedback and activity logs from an introductory class.",
    authors: ["Maya Hartono", "Liam Chen"],
    publicationYear: 2024,
    doi: "10.0000/deepread.education.001",
    sourceName: "OpenAlex",
    sourceUrl: "https://example.org/papers/learning-dashboards",
    pdfUrl: "https://example.org/papers/learning-dashboards.pdf",
    categoryName: "Education",
    keywords: ["learning analytics", "dashboard", "student engagement"],
    language: "en",
    status: PaperStatus.published,
    source: {
      provider: "openalex",
      externalId: "W-DEEPREAD-0001",
      rawMetadata: {
        license: "cc-by",
        open_access: true,
        sample: true,
      },
    },
    classification: {
      difficultyLevel: DifficultyLevel.beginner_friendly,
      beginnerScore: 88,
      estimatedReadingTime: 14,
      abstractLengthScore: 90,
      sentenceComplexityScore: 86,
      jargonDensityScore: 84,
      methodologyComplexityScore: 82,
      statisticalComplexityScore: 90,
      prerequisiteScore: 88,
      clarityScore: 92,
      classificationReason:
        "The paper uses familiar education concepts, a clear abstract, and a straightforward survey-based method.",
      readingWarning: "Readers may need basic familiarity with learning analytics terminology.",
      recommendedReader: "Beginner undergraduate students interested in education technology.",
      classificationVersion: "seed-v1",
    },
  },
  {
    title: "A Practical Introduction to Usability Testing for Mobile Health Apps",
    abstract:
      "Mobile health applications are often evaluated with usability tests before public release. This paper explains a small evaluation of appointment reminder features and reports common usability issues found by novice users.",
    authors: ["Nadia Putri", "Samuel Brooks"],
    publicationYear: 2023,
    doi: "10.0000/deepread.health.002",
    sourceName: "CORE",
    sourceUrl: "https://example.org/papers/mobile-health-usability",
    pdfUrl: "https://example.org/papers/mobile-health-usability.pdf",
    categoryName: "Health",
    keywords: ["mobile health", "usability testing", "patient experience"],
    language: "en",
    status: PaperStatus.published,
    source: {
      provider: "core",
      externalId: "CORE-DEEPREAD-0002",
      rawMetadata: {
        license: "cc-by-sa",
        open_access: true,
        sample: true,
      },
    },
    classification: {
      difficultyLevel: DifficultyLevel.beginner_friendly,
      beginnerScore: 82,
      estimatedReadingTime: 16,
      abstractLengthScore: 86,
      sentenceComplexityScore: 82,
      jargonDensityScore: 80,
      methodologyComplexityScore: 78,
      statisticalComplexityScore: 88,
      prerequisiteScore: 84,
      clarityScore: 86,
      classificationReason:
        "The topic is practical and the method is easy to follow, with limited statistical complexity.",
      readingWarning: "Some health application design terms may be unfamiliar.",
      recommendedReader: "Beginner readers exploring healthcare technology research.",
      classificationVersion: "seed-v1",
    },
  },
  {
    title: "Student Perceptions of Generative AI Support in Introductory Programming",
    abstract:
      "This study examines how students in introductory programming courses describe the benefits and risks of generative AI tools. Interview findings suggest that students value fast explanations but need guidance to avoid over-reliance.",
    authors: ["Elena Morris", "Rafi Pradana", "Keiko Tan"],
    publicationYear: 2025,
    doi: "10.0000/deepread.cs.003",
    sourceName: "Crossref",
    sourceUrl: "https://example.org/papers/ai-support-programming",
    pdfUrl: null,
    categoryName: "Computer Science",
    keywords: ["generative AI", "programming education", "student perception"],
    language: "en",
    status: PaperStatus.published,
    source: {
      provider: "crossref",
      externalId: "CR-DEEPREAD-0003",
      rawMetadata: {
        license: "cc-by",
        open_access: true,
        sample: true,
      },
    },
    classification: {
      difficultyLevel: DifficultyLevel.moderate,
      beginnerScore: 74,
      estimatedReadingTime: 19,
      abstractLengthScore: 82,
      sentenceComplexityScore: 76,
      jargonDensityScore: 70,
      methodologyComplexityScore: 72,
      statisticalComplexityScore: 84,
      prerequisiteScore: 70,
      clarityScore: 80,
      classificationReason:
        "The paper is readable but assumes familiarity with introductory programming and AI-assisted learning.",
      readingWarning: "Readers may need basic knowledge of programming education and generative AI tools.",
      recommendedReader: "Students who have completed an introductory programming course.",
      classificationVersion: "seed-v1",
    },
  },
  {
    title: "Small Business Adoption of Digital Payment Platforms in Urban Markets",
    abstract:
      "The paper analyzes factors that influence digital payment adoption among small business owners in urban retail markets. It combines questionnaire results with short interviews to explain trust, cost, and customer demand factors.",
    authors: ["Arif Wibowo", "Grace Miller"],
    publicationYear: 2022,
    doi: "10.0000/deepread.business.004",
    sourceName: "DOAJ",
    sourceUrl: "https://example.org/papers/digital-payments-small-business",
    pdfUrl: "https://example.org/papers/digital-payments-small-business.pdf",
    categoryName: "Business",
    keywords: ["digital payments", "small business", "technology adoption"],
    language: "en",
    status: PaperStatus.published,
    source: {
      provider: "doaj",
      externalId: "DOAJ-DEEPREAD-0004",
      rawMetadata: {
        license: "cc-by",
        open_access: true,
        sample: true,
      },
    },
    classification: {
      difficultyLevel: DifficultyLevel.moderate,
      beginnerScore: 68,
      estimatedReadingTime: 21,
      abstractLengthScore: 78,
      sentenceComplexityScore: 70,
      jargonDensityScore: 68,
      methodologyComplexityScore: 66,
      statisticalComplexityScore: 70,
      prerequisiteScore: 72,
      clarityScore: 76,
      classificationReason:
        "The business topic is accessible, but adoption theory and mixed-method analysis add moderate difficulty.",
      readingWarning: "Some terms from technology adoption research may require lookup.",
      recommendedReader: "Undergraduate business or information systems students.",
      classificationVersion: "seed-v1",
    },
  },
  {
    title: "Explaining Attention-Based Neural Models for Text Classification",
    abstract:
      "Attention mechanisms are widely used in neural text classification. This paper compares attention visualizations with gradient-based explanations and discusses when these explanations align with model behavior across benchmark datasets.",
    authors: ["Victor Nguyen", "Priya Raman"],
    publicationYear: 2024,
    doi: "10.0000/deepread.cs.005",
    sourceName: "arXiv",
    sourceUrl: "https://example.org/papers/attention-text-classification",
    pdfUrl: "https://example.org/papers/attention-text-classification.pdf",
    categoryName: "Computer Science",
    keywords: ["attention", "text classification", "explainable AI"],
    language: "en",
    status: PaperStatus.published,
    source: {
      provider: "arxiv",
      externalId: "arXiv:2401.00005",
      rawMetadata: {
        license: "arxiv",
        open_access: true,
        sample: true,
      },
    },
    classification: {
      difficultyLevel: DifficultyLevel.difficult,
      beginnerScore: 52,
      estimatedReadingTime: 32,
      abstractLengthScore: 66,
      sentenceComplexityScore: 58,
      jargonDensityScore: 42,
      methodologyComplexityScore: 48,
      statisticalComplexityScore: 54,
      prerequisiteScore: 40,
      clarityScore: 62,
      classificationReason:
        "The paper requires prior understanding of neural networks, attention mechanisms, and model evaluation.",
      readingWarning: "The methods and benchmark discussion may be difficult without machine learning background.",
      recommendedReader: "Readers with basic machine learning and natural language processing experience.",
      classificationVersion: "seed-v1",
    },
  },
  {
    title: "Cognitive Load and Note-Taking Strategies During Academic Reading",
    abstract:
      "This paper investigates how different note-taking strategies influence perceived cognitive load during academic reading. Participants read short research texts and completed recall tasks after using structured, free-form, or no-note approaches.",
    authors: ["Hannah Lee", "Dimas Satria"],
    publicationYear: 2021,
    doi: "10.0000/deepread.psychology.006",
    sourceName: "OpenAlex",
    sourceUrl: "https://example.org/papers/cognitive-load-note-taking",
    pdfUrl: null,
    categoryName: "Psychology",
    keywords: ["cognitive load", "note taking", "academic reading"],
    language: "en",
    status: PaperStatus.published,
    source: {
      provider: "openalex",
      externalId: "W-DEEPREAD-0006",
      rawMetadata: {
        license: "cc-by-nc",
        open_access: true,
        sample: true,
      },
    },
    classification: {
      difficultyLevel: DifficultyLevel.moderate,
      beginnerScore: 72,
      estimatedReadingTime: 18,
      abstractLengthScore: 80,
      sentenceComplexityScore: 74,
      jargonDensityScore: 68,
      methodologyComplexityScore: 70,
      statisticalComplexityScore: 66,
      prerequisiteScore: 76,
      clarityScore: 78,
      classificationReason:
        "The paper has a clear learning-focused topic but includes psychology terms and experimental design details.",
      readingWarning: "Readers may need to understand cognitive load and recall task terminology.",
      recommendedReader: "Students interested in learning psychology or study strategies.",
      classificationVersion: "seed-v1",
    },
  },
  {
    title: "Community Trust and Public Data Sharing in Smart City Programs",
    abstract:
      "Smart city programs often depend on public data sharing, but residents may hesitate when governance rules are unclear. This paper reviews interview findings on transparency, consent, and perceived public benefit in city data initiatives.",
    authors: ["Sofia Alvarez", "Bima Kusuma"],
    publicationYear: 2023,
    doi: "10.0000/deepread.social.007",
    sourceName: "OpenAlex",
    sourceUrl: "https://example.org/papers/community-trust-smart-city",
    pdfUrl: "https://example.org/papers/community-trust-smart-city.pdf",
    categoryName: "Social Science",
    keywords: ["smart city", "public data", "community trust"],
    language: "en",
    status: PaperStatus.published,
    source: {
      provider: "openalex",
      externalId: "W-DEEPREAD-0007",
      rawMetadata: {
        license: "cc-by",
        open_access: true,
        sample: true,
      },
    },
    classification: {
      difficultyLevel: DifficultyLevel.difficult,
      beginnerScore: 56,
      estimatedReadingTime: 28,
      abstractLengthScore: 70,
      sentenceComplexityScore: 62,
      jargonDensityScore: 58,
      methodologyComplexityScore: 60,
      statisticalComplexityScore: 72,
      prerequisiteScore: 52,
      clarityScore: 68,
      classificationReason:
        "The topic is understandable, but governance concepts and qualitative analysis make it more demanding.",
      readingWarning: "Policy and data governance terminology may slow beginner readers.",
      recommendedReader: "Readers with some background in social science or public policy.",
      classificationVersion: "seed-v1",
    },
  },
  {
    title: "Finite Element Modeling of Composite Bridge Deck Fatigue Behavior",
    abstract:
      "This paper presents a finite element model for fatigue behavior in composite bridge decks under repeated traffic loading. Simulation results are validated against laboratory measurements and discussed using stress concentration and damage accumulation metrics.",
    authors: ["Marcus Stein", "Yuki Nakamura", "Asha Patel"],
    publicationYear: 2020,
    doi: "10.0000/deepread.engineering.008",
    sourceName: "Crossref",
    sourceUrl: "https://example.org/papers/composite-bridge-fatigue",
    pdfUrl: "https://example.org/papers/composite-bridge-fatigue.pdf",
    categoryName: "Engineering",
    keywords: ["finite element", "bridge deck", "fatigue behavior"],
    language: "en",
    status: PaperStatus.published,
    source: {
      provider: "crossref",
      externalId: "CR-DEEPREAD-0008",
      rawMetadata: {
        license: "cc-by",
        open_access: true,
        sample: true,
      },
    },
    classification: {
      difficultyLevel: DifficultyLevel.expert,
      beginnerScore: 28,
      estimatedReadingTime: 45,
      abstractLengthScore: 52,
      sentenceComplexityScore: 44,
      jargonDensityScore: 24,
      methodologyComplexityScore: 26,
      statisticalComplexityScore: 36,
      prerequisiteScore: 20,
      clarityScore: 48,
      classificationReason:
        "The paper is highly technical and assumes knowledge of structural engineering, finite element modeling, and fatigue analysis.",
      readingWarning: "Most readers will need prior engineering mechanics and numerical modeling background.",
      recommendedReader: "Advanced engineering students or readers familiar with structural simulation.",
      classificationVersion: "seed-v1",
    },
  },
];

async function main() {
  const categoryByName = new Map<string, string>();

  for (const category of categories) {
    const savedCategory = await prisma.category.upsert({
      where: {
        name: category.name,
      },
      update: {
        description: category.description,
      },
      create: category,
    });

    categoryByName.set(savedCategory.name, savedCategory.id);
  }

  for (const paperData of papers) {
    const categoryId = categoryByName.get(paperData.categoryName);

    if (!categoryId) {
      throw new Error(`Missing category for paper: ${paperData.title}`);
    }

    const paper = await prisma.paper.upsert({
      where: {
        doi: paperData.doi,
      },
      update: {
        title: paperData.title,
        abstract: paperData.abstract,
        authors: paperData.authors,
        publicationYear: paperData.publicationYear,
        sourceName: paperData.sourceName,
        sourceUrl: paperData.sourceUrl,
        pdfUrl: paperData.pdfUrl,
        categoryId,
        keywords: paperData.keywords,
        language: paperData.language,
        status: paperData.status,
      },
      create: {
        title: paperData.title,
        abstract: paperData.abstract,
        authors: paperData.authors,
        publicationYear: paperData.publicationYear,
        doi: paperData.doi,
        sourceName: paperData.sourceName,
        sourceUrl: paperData.sourceUrl,
        pdfUrl: paperData.pdfUrl,
        categoryId,
        keywords: paperData.keywords,
        language: paperData.language,
        status: paperData.status,
      },
    });

    await prisma.paperSource.upsert({
      where: {
        provider_externalId: {
          provider: paperData.source.provider,
          externalId: paperData.source.externalId,
        },
      },
      update: {
        paperId: paper.id,
        rawMetadata: paperData.source.rawMetadata,
        fetchedAt: new Date(),
      },
      create: {
        paperId: paper.id,
        provider: paperData.source.provider,
        externalId: paperData.source.externalId,
        rawMetadata: paperData.source.rawMetadata,
      },
    });

    await prisma.paperClassification.upsert({
      where: {
        paperId: paper.id,
      },
      update: paperData.classification,
      create: {
        paperId: paper.id,
        ...paperData.classification,
      },
    });
  }
}

await main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
