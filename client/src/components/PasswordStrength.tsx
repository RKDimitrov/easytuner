/**
 * Password Strength Indicator
 * 
 * Displays visual feedback on password strength
 */

import { useMemo } from 'react'

interface PasswordStrengthProps {
  password: string
}

interface StrengthResult {
  score: number // 0-100
  level: 'weak' | 'medium' | 'strong'
  color: string
  label: string
  checks: {
    minLength: boolean
    hasLowercase: boolean
    hasUppercase: boolean
    hasNumber: boolean
    hasSpecial: boolean
  }
}

function calculatePasswordStrength(password: string): StrengthResult {
  const checks = {
    minLength: password.length >= 12,
    hasLowercase: /[a-z]/.test(password),
    hasUppercase: /[A-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[^a-zA-Z0-9]/.test(password),
  }

  // Calculate score (each check is worth 20 points)
  let score = 0
  if (checks.minLength) score += 20
  if (checks.hasLowercase) score += 20
  if (checks.hasUppercase) score += 20
  if (checks.hasNumber) score += 20
  if (checks.hasSpecial) score += 20

  // Determine level and styling
  let level: 'weak' | 'medium' | 'strong'
  let color: string
  let label: string

  if (score < 40) {
    level = 'weak'
    color = 'bg-red-500'
    label = 'Weak'
  } else if (score < 80) {
    level = 'medium'
    color = 'bg-yellow-500'
    label = 'Medium'
  } else {
    level = 'strong'
    color = 'bg-green-500'
    label = 'Strong'
  }

  return { score, level, color, label, checks }
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const strength = useMemo(() => calculatePasswordStrength(password), [password])

  if (!password) {
    return null
  }

  return (
    <div className="space-y-2">
      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${strength.color}`}
            style={{ width: `${strength.score}%` }}
          />
        </div>
        <span className="text-xs font-medium text-gray-600 min-w-[60px]">
          {strength.label}
        </span>
      </div>

      {/* Requirements checklist */}
      <div className="space-y-1 text-xs">
        <RequirementItem
          met={strength.checks.minLength}
          label="At least 12 characters"
        />
        <RequirementItem
          met={strength.checks.hasLowercase}
          label="Contains lowercase letter"
        />
        <RequirementItem
          met={strength.checks.hasUppercase}
          label="Contains uppercase letter"
        />
        <RequirementItem
          met={strength.checks.hasNumber}
          label="Contains number"
        />
        <RequirementItem
          met={strength.checks.hasSpecial}
          label="Contains special character"
        />
      </div>
    </div>
  )
}

interface RequirementItemProps {
  met: boolean
  label: string
}

function RequirementItem({ met, label }: RequirementItemProps) {
  return (
    <div className="flex items-center gap-2">
      {met ? (
        <svg
          className="w-4 h-4 text-green-500"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg
          className="w-4 h-4 text-gray-400"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <circle cx="12" cy="12" r="10" />
        </svg>
      )}
      <span className={met ? 'text-green-700' : 'text-gray-500'}>
        {label}
      </span>
    </div>
  )
}

