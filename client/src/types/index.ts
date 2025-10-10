// Common types used across the application

export interface User {
  user_id: string;
  email: string;
  role: 'user' | 'admin';
  created_at: string;
  tos_accepted_at: string;
}

export interface Project {
  project_id: string;
  owner_user_id: string;
  name: string;
  description?: string;
  is_private: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  request_id?: string;
  timestamp?: string;
}

// More types will be added in future stories

