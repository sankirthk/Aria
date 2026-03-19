import prisma from "../clients/prismaClient";
import { getLogger } from "../config/logger";

const logger = getLogger("SeedProviders");

const PROVIDERS = [
  {
    name: "Dr. Sarah Chen",
    specialty: "Orthopedics",
    keywords: [
      "knee", "joint", "bone", "fracture", "broken bone", "back", "back pain", "spine",
      "shoulder", "hip", "wrist", "ankle", "leg pain", "arm pain", "sports injury",
      "sports medicine", "arthritis", "sprain", "strain", "muscle pain", "orthopedic",
    ],
    bio: "Dr. Chen specializes in orthopedic surgery and sports medicine with over 15 years of experience treating musculoskeletal conditions.",
  },
  {
    name: "Dr. James Okafor",
    specialty: "Cardiology",
    keywords: [
      "heart", "heart issue", "chest", "chest pain", "palpitations", "blood pressure",
      "high blood pressure", "cardiovascular", "shortness of breath", "breathing trouble",
      "heart racing", "arrhythmia", "circulation", "cardiac", "cardiology",
    ],
    bio: "Dr. Okafor is a board-certified cardiologist focused on preventive cardiology and the management of heart disease.",
  },
  {
    name: "Dr. Priya Nair",
    specialty: "Dermatology",
    keywords: [
      "skin", "skin issue", "rash", "acne", "mole", "eczema", "psoriasis",
      "itching", "itchy skin", "dry skin", "hair", "hair loss", "scalp", "nail",
      "wound", "lesion", "skin infection", "dermatology", "dermatologist",
    ],
    bio: "Dr. Nair is a dermatologist specializing in medical and cosmetic skin conditions for patients of all ages.",
  },
  {
    name: "Dr. Michael Torres",
    specialty: "Gastroenterology",
    keywords: [
      "stomach", "stomach pain", "gut", "bowel", "digestion", "digestive", "digestive issues",
      "digestive concerns", "gi", "gastro", "gastroenterology", "acid reflux", "heartburn",
      "nausea", "vomiting", "diarrhea", "constipation", "ibs", "crohn's", "colonoscopy",
      "liver", "abdominal", "abdomen", "abdominal pain", "bloating",
    ],
    bio: "Dr. Torres treats a wide range of digestive disorders and performs diagnostic and therapeutic endoscopic procedures.",
  },
  {
    name: "Dr. Emily Hoffman",
    specialty: "Neurology",
    keywords: [
      "brain", "headache", "migraine", "nerve", "neurology", "neurologist", "numbness",
      "tingling", "dizziness", "vertigo", "seizure", "memory", "memory loss", "stroke",
      "tremor", "weakness", "balance issues", "nerve pain",
    ],
    bio: "Dr. Hoffman is a neurologist with expertise in headache disorders, epilepsy, and neurodegenerative diseases.",
  },
];

export async function seedProviders() {
  logger.info("Provider seed check started");
  const existing = await prisma.provider.count();
  if (existing > 0) {
    logger.info("Providers already seeded, skipping", { existing });
    return;
  }

  await prisma.provider.createMany({ data: PROVIDERS });
  logger.info("Providers seeded", { count: PROVIDERS.length });
}
