import { cn } from '../lib/utils'
import { getConfidenceColor } from '../lib/utils'

interface ConfidenceGaugeProps {
  confidence: number
  showLabel?: boolean
  className?: string
}

export function ConfidenceGauge({ 
  confidence, 
  showLabel = true,
  className 
}: ConfidenceGaugeProps) {
  const color = getConfidenceColor(confidence)
  
  const colorClasses = {
    success: 'bg-success',
    warning: 'bg-warning',
    destructive: 'bg-destructive',
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full transition-all duration-300 rounded-full',
            colorClasses[color]
          )}
          style={{ width: `${confidence}%` }}
        />
      </div>
      {showLabel && (
        <span className={cn('text-sm font-mono font-semibold min-w-[3rem] text-right', {
          'text-success': color === 'success',
          'text-warning': color === 'warning',
          'text-destructive': color === 'destructive',
        })}>
          {confidence}%
        </span>
      )}
    </div>
  )
}

