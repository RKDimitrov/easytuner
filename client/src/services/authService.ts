/**
 * Authentication Service Layer
 * 
 * Handles all authentication-related API calls
 */

import axios from 'axios'
import type {
  LoginRequest,
  RegisterRequest,
  TokenResponse,
  User,
  PasswordChangeRequest,
} from '../types/auth'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const AUTH_API = `${API_BASE_URL}/api/v1/auth`

/**
 * Login with email and password
 */
export async function login(credentials: LoginRequest): Promise<TokenResponse> {
  const response = await axios.post<TokenResponse>(
    `${AUTH_API}/login`,
    credentials
  )
  return response.data
}

/**
 * Register a new user account
 */
export async function register(data: RegisterRequest): Promise<TokenResponse> {
  const response = await axios.post<TokenResponse>(
    `${AUTH_API}/register`,
    data
  )
  return response.data
}

/**
 * Get current user information
 */
export async function getCurrentUser(accessToken: string): Promise<User> {
  const response = await axios.get<User>(`${AUTH_API}/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
  return response.data
}

/**
 * Refresh access token using refresh token
 */
export async function refreshToken(refreshToken: string): Promise<TokenResponse> {
  const response = await axios.post<TokenResponse>(
    `${AUTH_API}/refresh`,
    { refresh_token: refreshToken }
  )
  return response.data
}

/**
 * Logout user (invalidate refresh token)
 */
export async function logout(
  accessToken: string,
  refreshToken: string
): Promise<void> {
  await axios.post(
    `${AUTH_API}/logout`,
    { refresh_token: refreshToken },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )
}

/**
 * Change user password
 */
export async function changePassword(
  accessToken: string,
  data: PasswordChangeRequest
): Promise<void> {
  await axios.post(`${AUTH_API}/change-password`, data, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
}

/**
 * Request password reset email
 */
export async function requestPasswordReset(email: string): Promise<void> {
  // TODO: Implement when backend endpoint is available
  // eslint-disable-next-line no-console
  console.log('Password reset requested for:', email)
  throw new Error('Password reset not yet implemented')
}

/**
 * Reset password with token
 */
export async function resetPassword(
  token: string,
  newPassword: string
): Promise<void> {
  // TODO: Implement when backend endpoint is available
  // eslint-disable-next-line no-console
  console.log('Password reset with token:', token, 'New password length:', newPassword.length)
  throw new Error('Password reset not yet implemented')
}

