export type WorkerStatus = "Available" | "Limited availability" | "Not available for hire";

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
  dealLabel?: string;
  experience: string;
  imageUrl: string;
  name: string;
  originalSalary?: string;
  paused?: boolean;
  profile: WorkerProfile;
  salary: string;
  skills: string[];
  slug: string;
  status: WorkerStatus;
  title: string;
};
