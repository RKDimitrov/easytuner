/**
 * Authentication type definitions
 */

// User type
export interface User {
  user_id: string
  email: string
  role: 'user' | 'admin'
  is_active: boolean
  last_login_at: string | null
  tos_accepted_at: string | null
  tos_version: number | null
  created_at: string
  updated_at: string
  display_name: string | null
  avatar_url: string | null
}

// Login request
export interface LoginRequest {
  email: string
  password: string
}

// Registration request
export interface RegisterRequest {
  email: string
  password: string
  tos_accepted: boolean
}

// Token response
export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

// Auth response (login/register)
export interface AuthResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user?: User
}

// Refresh token request
export interface RefreshTokenRequest {
  refresh_token: string
}

// Password change request
export interface PasswordChangeRequest {
  current_password: string
  new_password: string
}

// Error response from API
export interface AuthError {
  detail: string
}

// Axios error with API response
export interface ApiError extends Error {
  response?: {
    data?: {
      detail?: string
    }
    status?: number
  }
}

