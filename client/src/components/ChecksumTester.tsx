import { useState } from 'react'
import { useAnalysisStore } from '../store/analysisStore'
import { validateChecksum, type ChecksumConfig } from '../services/checksumService'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Loader2, CheckCircle2, XCircle, Zap } from 'lucide-react'
import { toast } from '../hooks/use-toast'
import { formatHexOffset } from '../lib/utils'

interface TestResult {
  config: ChecksumConfig
  result: {
    is_valid: boolean
    stored_checksum: number
    calculated_checksum: number
    stored_checksum_hex: string
    calculated_checksum_hex: string
  } | null
  error?: string
}

interface ChecksumTesterProps {
  fileSize: number
  onConfigFound?: (config: ChecksumConfig) => void
}

// Common ECU checksum configurations to test
const COMMON_CONFIGS: Omit<ChecksumConfig, 'checksum_range' | 'checksum_location'>[] = [
  { algorithm: 'simple_sum', checksum_size: 2, endianness: 'little' },
  { algorithm: 'simple_sum', checksum_size: 2, endianness: 'big' },
  { algorithm: 'simple_sum', checksum_size: 4, endianness: 'little' },
  { algorithm: 'simple_sum', checksum_size: 4, endianness: 'big' },
  { algorithm: 'crc16', checksum_size: 2, endianness: 'little' },
  { algorithm: 'crc16', checksum_size: 2, endianness: 'big' },
  { algorithm: 'crc32', checksum_size: 4, endianness: 'little' },
  { algorithm: 'crc32', checksum_size: 4, endianness: 'big' },
  { algorithm: 'xor', checksum_size: 2, endianness: 'little' },
  { algorithm: 'xor', checksum_size: 2, endianness: 'big' },
  { algorithm: 'twos_complement', checksum_size: 2, endianness: 'little' },
  { algorithm: 'twos_complement', checksum_size: 2, endianness: 'big' },
]

export function ChecksumTester({ fileSize, onConfigFound }: ChecksumTesterProps) {
  const fileId = useAnalysisStore((state) => state.fileId)
  const [isTesting, setIsTesting] = useState(false)
  const [results, setResults] = useState<TestResult[]>([])
  const [testedCount, setTestedCount] = useState(0)

  // Common checksum locations to test
  const commonLocations = [
    fileSize - 2,  // Last 2 bytes
    fileSize - 4,  // Last 4 bytes
    fileSize - 1,  // Last byte
    fileSize - 8,  // Last 8 bytes
    0,              // Start of file (uncommon but possible)
  ].filter(loc => loc >= 0 && loc < fileSize)

  const testConfigurations = async () => {
    if (!fileId) {
      toast.error('No file loaded')
      return
    }

    setIsTesting(true)
    setResults([])
    setTestedCount(0)

    const testResults: TestResult[] = []
    let validConfigFound = false

    try {
      // Test each algorithm with different locations and sizes
      for (const baseConfig of COMMON_CONFIGS) {
        if (validConfigFound) break // Stop if we found a valid one

        for (const location of commonLocations) {
          if (validConfigFound) break

          const checksumSize = baseConfig.checksum_size || 2
          
          // Skip if location + size exceeds file
          if (location + checksumSize > fileSize) continue

          // Range: from start to before checksum location
          const rangeEnd = location
          const rangeStart = 0

          // Skip if range is invalid
          if (rangeEnd <= rangeStart) continue

          const config: ChecksumConfig = {
            ...baseConfig,
            checksum_range: {
              start: rangeStart,
              end: rangeEnd,
            },
            checksum_location: location,
          }

          setTestedCount(testResults.length + 1)

          try {
            const result = await validateChecksum(fileId, config)
            
            testResults.push({
              config,
              result: {
                is_valid: result.is_valid,
                stored_checksum: result.stored_checksum,
                calculated_checksum: result.calculated_checksum,
                stored_checksum_hex: result.stored_checksum_hex,
                calculated_checksum_hex: result.calculated_checksum_hex,
              },
            })

            if (result.is_valid && !validConfigFound) {
              validConfigFound = true
              toast.success('Valid checksum configuration found!', {
                description: `${baseConfig.algorithm} at ${formatHexOffset(location)}`
              })
              if (onConfigFound) {
                onConfigFound(config)
              }
            }
          } catch (error) {
            testResults.push({
              config,
              result: null,
              error: error instanceof Error ? error.message : 'Unknown error',
            })
          }

          // Small delay to avoid overwhelming the server
          await new Promise(resolve => setTimeout(resolve, 50))
        }
      }

      setResults(testResults)

      if (!validConfigFound) {
        toast.info('No valid configuration found', {
          description: 'Try adjusting the checksum location or algorithm manually'
        })
      }
    } catch (error) {
      console.error('Failed to test configurations:', error)
      toast.error('Testing failed', {
        description: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsTesting(false)
    }
  }

  const validResults = results.filter(r => r.result?.is_valid)
  const invalidResults = results.filter(r => r.result && !r.result.is_valid)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5" />
          Checksum Auto-Tester
        </CardTitle>
        <CardDescription>
          Automatically test common checksum configurations to find the correct one for your ECU file
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={testConfigurations}
          disabled={isTesting || !fileId}
          className="w-full"
        >
          {isTesting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Testing... ({testedCount} configurations)
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 mr-2" />
              Test Common Configurations
            </>
          )}
        </Button>

        {results.length > 0 && (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {validResults.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-green-600 dark:text-green-400">
                  ✓ Valid Configurations ({validResults.length})
                </h4>
                {validResults.map((test, idx) => (
                  <Card key={idx} className="border-green-500 bg-green-50 dark:bg-green-950">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            <span className="font-mono text-sm">
                              {test.config.algorithm} @ {formatHexOffset(test.config.checksum_location)}
                            </span>
                            <Badge variant="default" className="bg-green-600">
                              Valid
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            <div>Size: {test.config.checksum_size} bytes, Endianness: {test.config.endianness}</div>
                            <div>Range: {formatHexOffset(test.config.checksum_range.start)} - {formatHexOffset(test.config.checksum_range.end)}</div>
                            {test.result && (
                              <div className="font-mono">
                                Stored: {test.result.stored_checksum_hex}, Calculated: {test.result.calculated_checksum_hex}
                              </div>
                            )}
                          </div>
                        </div>
                        {onConfigFound && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onConfigFound(test.config)}
                          >
                            Use This
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {invalidResults.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground">
                  Invalid Configurations ({invalidResults.length})
                </h4>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {invalidResults.slice(0, 10).map((test, idx) => (
                    <div key={idx} className="text-xs p-2 border rounded bg-muted/50">
                      <div className="flex items-center gap-2">
                        <XCircle className="w-3 h-3 text-muted-foreground" />
                        <span className="font-mono">
                          {test.config.algorithm} @ {formatHexOffset(test.config.checksum_location)}
                        </span>
                      </div>
                      {test.result && (
                        <div className="text-muted-foreground ml-5">
                          Stored: {test.result.stored_checksum_hex} ≠ Calculated: {test.result.calculated_checksum_hex}
                        </div>
                      )}
                    </div>
                  ))}
                  {invalidResults.length > 10 && (
                    <p className="text-xs text-muted-foreground text-center">
                      ... and {invalidResults.length - 10} more invalid configurations
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

