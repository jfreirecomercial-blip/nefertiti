export interface ContraceptiveSettings {
  enabled: boolean;
  type: "pill" | "iud" | "injection" | "implonon" | "none";
  brandName?: string;
  time?: string; // Format "HH:MM" e.g., "08:30"
  reminderEnabled: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  age?: number;
  cycleLength: number; // e.g., 28 days
  periodLength: number; // e.g., 5 days
  lastPeriodDate: string; // ISO Date String "YYYY-MM-DD"
  contraceptive: ContraceptiveSettings;
  createdAt: string; // ISO String
  updatedAt: string; // ISO String
}

export interface NutritionLog {
  breakfast?: string;
  lunch?: string;
  dinner?: string;
  snacks?: string[];
  notes?: string;
}

export interface DailyLog {
  id: string; // Format: "uid_YYYY-MM-DD"
  userId: string;
  date: string; // Format "YYYY-MM-DD"
  waterIntakeMl: number;
  waterTargetMl: number;
  symptoms: string[]; // e.g., ["cramps", "headache", "bloating", "tender-breasts"]
  mood: "happy" | "calm" | "anxious" | "tired" | "sensitive" | "energetic" | "focused";
  flow: "none" | "light" | "medium" | "heavy";
  nutrition: NutritionLog;
  sleepHours?: number;
  notes?: string;
  createdAt: string; // ISO String
  updatedAt: string; // ISO String
}

export interface Appointment {
  id: string;
  userId: string;
  professionalId: string;
  professionalName: string;
  professionalSpecialty: "ginecologista" | "nutricionista" | "psicologa" | "endocrinologista";
  professionalPhoto?: string;
  dateTime: string; // ISO string for the booking time
  durationMinutes: number;
  status: "scheduled" | "completed" | "cancelled";
  notes?: string;
  telehealthLink?: string;
  createdAt: string; // ISO String
  updatedAt: string; // ISO String
}

export interface ProfessionalProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  specialty: "ginecologista" | "nutricionista" | "psicologa" | "endocrinologista" | "obstetra" | "doula";
  bio: string;
  licenseNumber: string; // Ex: CRM, CRP
  priceRange?: string; // Opcional
  approvalStatus: "pending" | "approved" | "rejected";
  identityUrl: string; // Documento de identidade privado
  certificateUrl: string; // Certificado/Diploma privado
  averageRating: number;
  totalReviews: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProfessionalReview {
  id: string;
  professionalId: string;
  authorId: string;
  authorName: string;
  rating: number; // 1 a 5
  comment: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Social Module Types
// ---------------------------------------------------------------------------

// Social Profile settings
export interface SocialProfile {
  userId: string;
  bio: string;
  whatsappNumber: string;    // Optional, e.g. "5511999999999"
  allowScraps: boolean;      // Allow public wall messages
  allowDirectChat: boolean;  // Allow direct chat initiation
  interests: string[];       // Interest tags
  createdAt: string;
  updatedAt: string;
}

// Friendship
export interface Friendship {
  id: string;
  users: string[];           // [userIdA, userIdB]
  status: "pending" | "accepted" | "declined";
  senderId: string;
  createdAt: string;
  updatedAt: string;
}

// Scrap (wall message)
export interface Scrap {
  id: string;
  recipientId: string;
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  content: string;
  createdAt: string;
}

// Community
export interface Community {
  id: string;
  name: string;
  description: string;
  category: string;
  creatorId: string;
  creatorName: string;
  moderators: string[];
  memberCount: number;
  imageUrl?: string;
  createdAt: string;
}

// Community Member (subcollection document)
export interface CommunityMember {
  userId: string;
  userName: string;
  userPhoto?: string;
  joinedAt: string;
  role: "member" | "moderator" | "owner";
}

// Community Topic (subcollection document)
export interface CommunityTopic {
  id: string;
  title: string;
  creatorId: string;
  creatorName: string;
  creatorPhoto?: string;
  isAnonymous: boolean;
  createdAt: string;
  lastActiveAt: string;
  postCount: number;
}

// Topic Post (subcollection document)
export interface TopicPost {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  isAnonymous: boolean;
  createdAt: string;
  reactions: {
    love: string[];
    hug: string[];
    sad: string[];
    laugh: string[];
  };
}

// User Photo
export interface UserPhoto {
  id: string;
  userId: string;
  imageUrl: string;
  caption: string;
  createdAt: string;
  likes: string[];
  reactions: {
    love: number;
    wow: number;
    cool: number;
  };
}

// Photo Comment (subcollection document)
export interface PhotoComment {
  id: string;
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  content: string;
  createdAt: string;
}

// Post Comment (subcollection document for social_posts)
export interface PostComment {
  id: string;
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  content: string;
  createdAt: string;
}
