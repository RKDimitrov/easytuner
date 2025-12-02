/**
 * Authentication State Store (Zustand)
 * 
 * Manages user authentication state, tokens, and auth-related actions
 */

import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import * as authService from '../services/authService'
import type { User, LoginRequest, RegisterRequest, ApiError } from '../types/auth'

interface AuthState {
  // State
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  // Actions
  login: (credentials: LoginRequest) => Promise<void>
  register: (data: RegisterRequest) => Promise<void>
  logout: () => Promise<void>
  refreshTokens: () => Promise<void>
  fetchCurrentUser: () => Promise<void>
  clearError: () => void
  setTokens: (accessToken: string, refreshToken: string) => void
  reset: () => void
}

const initialState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        /**
         * Login user with email and password
         */
        login: async (credentials: LoginRequest) => {
          set({ isLoading: true, error: null })
          try {
            const response = await authService.login(credentials)
            
            set({
              accessToken: response.access_token,
              refreshToken: response.refresh_token,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            })

            // Fetch user details after login
            await get().fetchCurrentUser()
          } catch (error) {
            const apiError = error as ApiError
            const errorMessage = apiError.response?.data?.detail || apiError.message || 'Login failed'
            set({
              isLoading: false,
              error: errorMessage,
              isAuthenticated: false,
            })
            throw new Error(errorMessage)
          }
        },

        /**
         * Register a new user account
         */
        register: async (data: RegisterRequest) => {
          set({ isLoading: true, error: null })
          try {
            const response = await authService.register(data)
            
            set({
              accessToken: response.access_token,
              refreshToken: response.refresh_token,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            })

            // Fetch user details after registration
            await get().fetchCurrentUser()
          } catch (error) {
            const apiError = error as ApiError
            const errorMessage = apiError.response?.data?.detail || apiError.message || 'Registration failed'
            set({
              isLoading: false,
              error: errorMessage,
              isAuthenticated: false,
            })
            throw new Error(errorMessage)
          }
        },

        /**
         * Logout user and clear tokens
         */
        logout: async () => {
          const { accessToken, refreshToken } = get()
          
          try {
            if (accessToken && refreshToken) {
              await authService.logout(accessToken, refreshToken)
            }
          } catch (error) {
            console.error('Logout error:', error)
            // Continue with local logout even if API call fails
          }
          
          set(initialState)
        },

        /**
         * Refresh access token using refresh token
         */
        refreshTokens: async () => {
          const { refreshToken } = get()
          
          if (!refreshToken) {
            throw new Error('No refresh token available')
          }

          try {
            const response = await authService.refreshToken(refreshToken)
            
            set({
              accessToken: response.access_token,
              refreshToken: response.refresh_token,
              error: null,
            })
          } catch (error) {
            // If refresh fails, logout user
            set(initialState)
            throw new Error('Session expired. Please login again.')
          }
        },

        /**
         * Fetch current user information
         */
        fetchCurrentUser: async () => {
          const { accessToken } = get()
          
          if (!accessToken) {
            throw new Error('No access token available')
          }

          try {
            const user = await authService.getCurrentUser(accessToken)
            set({ user })
          } catch (error) {
            const apiError = error as ApiError
            const errorMessage = apiError.response?.data?.detail || 'Failed to fetch user'
            set({ error: errorMessage })
            throw new Error(errorMessage)
          }
        },

        /**
         * Clear error message
         */
        clearError: () => set({ error: null }),

        /**
         * Set tokens manually (useful for testing or external auth flows)
         */
        setTokens: (accessToken: string, refreshToken: string) => {
          set({
            accessToken,
            refreshToken,
            isAuthenticated: true,
          })
        },

        /**
         * Reset auth state to initial values
         */
        reset: () => set(initialState),
      }),
      {
        name: 'auth-storage',
        // Only persist tokens and user, not loading/error states
        partialize: (state) => ({
          user: state.user,
          accessToken: state.accessToken,
          refreshToken: state.refreshToken,
          isAuthenticated: state.isAuthenticated,
        }),
      }
    ),
    { name: 'auth-store' }
  )
)

/**
 * Setup axios interceptor to automatically add auth token to requests
 * and handle token refresh on 401 errors
 */
export function setupAuthInterceptor() {
  // Dynamic import to avoid ESM/require issues
  import('axios').then(({ default: axios }) => {
    // Request interceptor: Add auth token to all requests
    axios.interceptors.request.use(
      (config) => {
        const { accessToken } = useAuthStore.getState()
        if (accessToken && !config.headers.Authorization) {
          config.headers.Authorization = `Bearer ${accessToken}`
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    // Response interceptor: Handle 401 errors and refresh token
    axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config

        // If 401 and we haven't tried to refresh yet
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true

          try {
            await useAuthStore.getState().refreshTokens()
            
            // Retry original request with new token
            const { accessToken } = useAuthStore.getState()
            originalRequest.headers.Authorization = `Bearer ${accessToken}`
            return axios(originalRequest)
          } catch (refreshError) {
            // Refresh failed, logout user
            useAuthStore.getState().logout()
            return Promise.reject(refreshError)
          }
        }

        return Promise.reject(error)
      }
    )
  })
}

