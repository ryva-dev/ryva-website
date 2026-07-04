export type WorkerStatus = "Available" | "Limited availability";

export type Review = {
  company: string;
  name: string;
  quote: string;
  rating: number;
};

export type WorkerProfile = {
  availabilityNote: string;
  category: string;
  experienceSummary: string;
  industry: string;
  philosophy: string;
  responsibilities: string[];
  reviews: Review[];
  sampleWork: string[];
  specialties: string[];
  summaryTitle: string;
};

export type Worker = {
  description: string;
  department: string;
  experience: string;
  imageUrl: string;
  name: string;
  profile: WorkerProfile;
  salary: string;
  skills: string[];
  slug: string;
  status: WorkerStatus;
  title: string;
};
