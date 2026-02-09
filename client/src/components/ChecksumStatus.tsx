import { useState, useEffect } from 'react'
import { useAnalysisStore } from '../store/analysisStore'
import { validateChecksum, updateChecksum, type ChecksumConfig, type ChecksumValidationResponse } from '../services/checksumService'
import { Button } from './ui/button'
import { Alert, AlertDescription, AlertTitle } from './ui/alert'
import { Badge } from './ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Wrench } from 'lucide-react'
import { toast } from '../hooks/use-toast'
import { formatHexOffset } from '../lib/utils'

interface ChecksumStatusProps {
  config: ChecksumConfig | null
  onConfigChange?: () => void
  /** Called after checksum is fixed so parent can refetch file data */
  onFixSuccess?: () => Promise<void>
}

export function ChecksumStatus({ config, onFixSuccess }: ChecksumStatusProps) {
  const fileId = useAnalysisStore((state) => state.fileId)
  const [validation, setValidation] = useState<ChecksumValidationResponse | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [isFixing, setIsFixing] = useState(false)
  const [lastValidated, setLastValidated] = useState<Date | null>(null)

  useEffect(() => {
    if (config && fileId) {
      validateChecksumNow()
    } else {
      setValidation(null)
      setLastValidated(null)
    }
  }, [config, fileId])

  const validateChecksumNow = async () => {
    if (!config || !fileId) return

    setIsValidating(true)
    try {
      const result = await validateChecksum(fileId, config)
      setValidation(result)
      setLastValidated(new Date())

      if (result.is_valid) {
        toast.success('Checksum valid', {
          description: `Stored: ${result.stored_checksum_hex}, Calculated: ${result.calculated_checksum_hex}`
        })
      } else {
        toast.error('Checksum mismatch', {
          description: `Stored: ${result.stored_checksum_hex}, Calculated: ${result.calculated_checksum_hex}`
        })
      }
    } catch (error) {
      console.error('Failed to validate checksum:', error)
      toast.error('Validation failed', {
        description: error instanceof Error ? error.message : 'Unknown error'
      })
      setValidation(null)
    } finally {
      setIsValidating(false)
    }
  }

  const handleFixChecksum = async () => {
    if (!config || !fileId) return
    setIsFixing(true)
    try {
      await updateChecksum(fileId, config)
      await onFixSuccess?.()
      toast.success('Checksum updated', {
        description: `Correct value written at ${formatHexOffset(config.checksum_location)}`
      })
      await validateChecksumNow()
    } catch (error) {
      console.error('Failed to fix checksum:', error)
      toast.error('Fix failed', {
        description: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsFixing(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Checksum Status</CardTitle>
          {validation && (
            <Badge variant={validation.is_valid ? 'default' : 'destructive'}>
              {validation.is_valid ? 'Valid' : 'Invalid'}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!config ? (
          <div className="text-center py-4">
            <AlertTriangle className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No checksum configuration. Click "Configure Checksum" to set up.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="text-xs font-mono text-muted-foreground space-y-0.5">
                  <div>Algorithm: <span className="font-semibold">{config.algorithm}</span></div>
                  <div>Location: <span className="font-semibold">{formatHexOffset(config.checksum_location)}</span></div>
                  <div>Size: <span className="font-semibold">{config.checksum_size} bytes</span></div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={validateChecksumNow}
                disabled={isValidating || !fileId}
              >
                {isValidating ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Validating...
                  </>
                ) : (
                  'Validate'
                )}
              </Button>
            </div>

            {validation && (
              <Alert variant={validation.is_valid ? 'default' : 'destructive'} className="mt-2">
                {validation.is_valid ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <AlertTitle className="text-sm">
                  {validation.is_valid ? 'Checksum Valid' : 'Checksum Mismatch'}
                </AlertTitle>
                <AlertDescription className="text-xs space-y-1">
                  <div className="font-mono space-y-0.5">
                    <div>
                      <span className="text-muted-foreground">Stored:</span>{' '}
                      {validation.stored_checksum_hex} ({validation.stored_checksum})
                    </div>
                    <div>
                      <span className="text-muted-foreground">Calculated:</span>{' '}
                      {validation.calculated_checksum_hex} ({validation.calculated_checksum})
                    </div>
                    {!validation.is_valid && (
                      <div className="pt-1 border-t border-border/50 mt-1">
                        <span className="text-muted-foreground">Fix: </span>
                        Change bytes at <span className="font-semibold">{formatHexOffset(validation.checksum_location)}</span> to{' '}
                        <span className="font-semibold">{validation.calculated_checksum_hex}</span>.
                      </div>
                    )}
                  </div>
                  {!validation.is_valid && (
                    <p className="text-xs mt-1.5">
                      The stored checksum does not match the calculated value.
                      Use &quot;Fix checksum&quot; to write the correct value to the file.
                    </p>
                  )}
                  {!validation.is_valid && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={handleFixChecksum}
                      disabled={isFixing}
                    >
                      {isFixing ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          Fixing...
                        </>
                      ) : (
                        <>
                          <Wrench className="w-3 h-3 mr-1" />
                          Fix checksum
                        </>
                      )}
                    </Button>
                  )}
                  {lastValidated && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Last validated: {lastValidated.toLocaleTimeString()}
                    </p>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {!validation && !isValidating && (
              <p className="text-xs text-muted-foreground text-center py-2">
                Click "Validate" to check the checksum status.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
