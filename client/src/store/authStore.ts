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
  sessionExpired: boolean

  // Actions
  login: (credentials: LoginRequest) => Promise<void>
  register: (data: RegisterRequest) => Promise<void>
  logout: () => Promise<void>
  refreshTokens: () => Promise<void>
  fetchCurrentUser: () => Promise<void>
  clearError: () => void
  setTokens: (accessToken: string, refreshToken: string) => void
  reset: () => void
  handleSessionExpired: () => void
  /** Revalidate session on app load when we have persisted tokens */
  initializeAuth: () => Promise<void>
}

const initialState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  sessionExpired: false,
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
              sessionExpired: false,
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
              sessionExpired: false,
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
          } finally {
            // Always clear local state
            set(initialState)
          }
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
              sessionExpired: false,
            })
          } catch (error) {
            // If refresh fails, mark session as expired and clear auth state
            set({
              user: null,
              accessToken: null,
              refreshToken: null,
              isAuthenticated: false,
              isLoading: false,
              error: 'Session expired. Please login again.',
              sessionExpired: true,
            })
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
            sessionExpired: false,
          })
        },

        /**
         * Reset auth state to initial values
         */
        reset: () => set(initialState),

        /**
         * Handle session expiration without triggering API logout
         */
        handleSessionExpired: () => {
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false,
            error: 'Session expired. Please login again.',
            sessionExpired: true,
          })
        },

        /**
         * Revalidate session on app load. Call once after persist has rehydrated.
         * If we have persisted tokens, validates them (refresh + fetch user).
         * On failure clears auth so ProtectedRoute redirects to login.
         */
        initializeAuth: async () => {
          const { accessToken, refreshToken } = get()
          if (!accessToken && !refreshToken) {
            set({ isAuthenticated: false, isLoading: false })
            return
          }
          set({ isLoading: true })
          try {
            if (refreshToken) {
              await get().refreshTokens()
            }
            await get().fetchCurrentUser()
            set({ isLoading: false })
          } catch {
            set({
              ...initialState,
              isLoading: false,
            })
          }
        },
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
let isRefreshing = false
let refreshPromise: Promise<void> | null = null
const failedQueue: Array<{
  resolve: (value?: any) => void
  reject: (error?: any) => void
}> = []

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue.length = 0
}

export function setupAuthInterceptor() {
  // Dynamic import to avoid ESM/require issues
  import('axios').then(({ default: axios }) => {
    // Request interceptor: Add auth token to all requests
    axios.interceptors.request.use(
      (config) => {
        const { accessToken, sessionExpired } = useAuthStore.getState()
        
        // Don't add token if session is expired
        if (sessionExpired) {
          return Promise.reject(new Error('Session expired'))
        }
        
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
          // If already refreshing, queue this request
          if (isRefreshing) {
            return new Promise((resolve, reject) => {
              failedQueue.push({ resolve, reject })
            })
              .then((token) => {
                originalRequest.headers.Authorization = `Bearer ${token}`
                return axios(originalRequest)
              })
              .catch((err) => {
                return Promise.reject(err)
              })
          }

          originalRequest._retry = true
          isRefreshing = true

          // Create refresh promise
          refreshPromise = useAuthStore
            .getState()
            .refreshTokens()
            .then(() => {
              const { accessToken } = useAuthStore.getState()
              processQueue(null, accessToken)
              return accessToken
            })
            .catch((refreshError) => {
              // Refresh failed - immediately logout and redirect
              const authStore = useAuthStore.getState()
              authStore.handleSessionExpired()
              
              // Process queue with error
              processQueue(refreshError, null)
              
              // Redirect to login after a short delay to allow state update
              setTimeout(() => {
                window.location.href = '/login'
              }, 100)
              
              return Promise.reject(refreshError)
            })
            .finally(() => {
              isRefreshing = false
              refreshPromise = null
            })

          try {
            const token = await refreshPromise
            
            // Retry original request with new token
            originalRequest.headers.Authorization = `Bearer ${token}`
            return axios(originalRequest)
          } catch (refreshError) {
            // Already handled in refreshPromise catch
            return Promise.reject(refreshError)
          }
        }

        return Promise.reject(error)
      }
    )
  })
}

