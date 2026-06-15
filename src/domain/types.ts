export type UserRole = 'patient' | 'psychologist';

export type AppLanguage = 'en' | 'es' | 'pt';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  fullName: string | null;
  age: string | null;
  address: string | null;
  phone: string | null;
  language: AppLanguage | null;
  isAdmin: boolean;
}

export interface AuthContext {
  userId: string;
  email: string;
  role: UserRole;
  isAdmin: boolean;
  accessToken: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}
