/**
 * Register Page
 * 
 * Allows new users to create an account with email, password, and TOS acceptance
 */

import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { usePageTitle } from '../hooks/usePageTitle'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { EyeIcon, EyeOffIcon } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Checkbox } from '../components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { PasswordStrength } from '../components/PasswordStrength'
import { toast } from 'sonner'

// Validation schema
const registerSchema = z
  .object({
    email: z.string().email('Invalid email address'),
    password: z
      .string()
      .min(12, 'Password must be at least 12 characters')
      .regex(/[a-z]/, 'Password must contain lowercase letter')
      .regex(/[A-Z]/, 'Password must contain uppercase letter')
      .regex(/[0-9]/, 'Password must contain number')
      .regex(/[^a-zA-Z0-9]/, 'Password must contain special character'),
    confirmPassword: z.string(),
    tosAccepted: z.boolean().refine((val) => val === true, {
      message: 'You must accept the Terms of Service',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type RegisterFormData = z.infer<typeof registerSchema>

export function Register() {
  usePageTitle('Create Account')
  const navigate = useNavigate()
  const { register: registerUser, isAuthenticated, isLoading } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      tosAccepted: false,
    },
  })

  // Watch password for strength indicator
  const password = watch('password', '')

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/projects')
    }
  }, [isAuthenticated, navigate])

  const onSubmit = async (data: RegisterFormData) => {
    try {
      await registerUser({
        email: data.email,
        password: data.password,
        tos_accepted: data.tosAccepted,
      })
      toast.success('Welcome to EasyTuner!', {
        description: 'Your account has been created successfully.',
      })
      navigate('/projects')
    } catch (error) {
      toast.error('Registration failed', {
        description: (error as Error).message || 'Please try again.',
      })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Create an Account
          </CardTitle>
          <CardDescription className="text-center">
            Sign up to start analyzing ECU firmware
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                {...register('email')}
                disabled={isLoading}
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a strong password"
                  autoComplete="new-password"
                  {...register('password')}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOffIcon className="h-4 w-4" />
                  ) : (
                    <EyeIcon className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-red-500">{errors.password.message}</p>
              )}
              
              {/* Password Strength Indicator */}
              <PasswordStrength password={password} />
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm your password"
                  autoComplete="new-password"
                  {...register('confirmPassword')}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  tabIndex={-1}
                  aria-label={
                    showConfirmPassword ? 'Hide password' : 'Show password'
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOffIcon className="h-4 w-4" />
                  ) : (
                    <EyeIcon className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-sm text-red-500">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            {/* Terms of Service */}
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="tosAccepted"
                  checked={watch('tosAccepted')}
                  onCheckedChange={(checked) => {
                    setValue('tosAccepted', checked === true, { shouldValidate: true })
                  }}
                  disabled={isLoading}
                  className="mt-1"
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="tosAccepted"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    I accept the Terms of Service
                  </label>
                  <p className="text-sm text-muted-foreground">
                    By creating an account, you agree to our{' '}
                    <a
                      href="#"
                      className="text-primary hover:underline"
                      onClick={(e) => {
                        e.preventDefault()
                        toast.info('Terms of Service', {
                          description: 'Full TOS modal would open here.',
                        })
                      }}
                    >
                      Terms of Service
                    </a>{' '}
                    and{' '}
                    <a
                      href="#"
                      className="text-primary hover:underline"
                      onClick={(e) => {
                        e.preventDefault()
                        toast.info('Privacy Policy', {
                          description: 'Privacy policy would open here.',
                        })
                      }}
                    >
                      Privacy Policy
                    </a>
                    .
                  </p>
                </div>
              </div>
              {errors.tosAccepted && (
                <p className="text-sm text-red-500">
                  {errors.tosAccepted.message}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Creating account...' : 'Create Account'}
            </Button>

            {/* Login Link */}
            <div className="text-center text-sm">
              <span className="text-gray-600">Already have an account? </span>
              <Link
                to="/login"
                className="text-primary hover:underline font-medium"
              >
                Sign in
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

