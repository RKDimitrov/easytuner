import { useState } from 'react'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Alert, AlertDescription, AlertTitle } from './ui/alert'
import { Loader2, Download, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import type { ChecksumConfig, ChecksumValidationResponse } from '../services/checksumService'

interface ExportDialogProps {
  open: boolean
  onClose: () => void
  onExport: () => void
  checksumConfig: ChecksumConfig | null
  validationResult: ChecksumValidationResponse | null
  isValidating: boolean
  fileName: string
}

export function ExportDialog({
  open,
  onClose,
  onExport,
  checksumConfig,
  validationResult,
  isValidating,
  fileName,
}: ExportDialogProps) {
  const [forceExport, setForceExport] = useState(false)

  const handleExport = () => {
    setForceExport(false)
    onExport()
  }

  const handleForceExport = () => {
    setForceExport(true)
    onExport()
  }

  // Reset force export when dialog closes
  const handleClose = () => {
    setForceExport(false)
    onClose()
  }

  const hasChecksumConfig = checksumConfig !== null
  const checksumValid = validationResult?.is_valid ?? false
  const checksumFailed = validationResult && !validationResult.is_valid

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Export File</DialogTitle>
          <DialogDescription>
            Export {fileName} to your computer
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Checksum Validation Status */}
          {hasChecksumConfig ? (
            <div className="space-y-2">
              <div className="text-sm font-medium">Checksum Validation</div>
              {isValidating ? (
                <Alert>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <AlertTitle>Validating checksum...</AlertTitle>
                  <AlertDescription>
                    Please wait while we verify the file integrity.
                  </AlertDescription>
                </Alert>
              ) : checksumValid ? (
                <Alert variant="default">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-600">Checksum Valid</AlertTitle>
                  <AlertDescription>
                    File integrity verified. The checksum matches the calculated value.
                  </AlertDescription>
                </Alert>
              ) : checksumFailed ? (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Checksum Mismatch</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <div>
                      The stored checksum does not match the calculated value.
                      <div className="font-mono text-xs mt-1 space-y-0.5">
                        <div>Stored: {validationResult.stored_checksum_hex}</div>
                        <div>Calculated: {validationResult.calculated_checksum_hex}</div>
                      </div>
                    </div>
                    <p className="text-xs mt-2">
                      This may indicate file corruption. You can still export the file, but it may not work correctly in your ECU.
                    </p>
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Not Validated</AlertTitle>
                  <AlertDescription>
                    Checksum has not been validated. Click "Validate" in the checksum status panel first.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ) : (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>No Checksum Configuration</AlertTitle>
              <AlertDescription>
                A checksum configuration is required before exporting. Please configure checksum settings first.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          {hasChecksumConfig && checksumValid ? (
            <Button onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              Export File
            </Button>
          ) : hasChecksumConfig && checksumFailed ? (
            <Button variant="destructive" onClick={handleForceExport}>
              <Download className="w-4 h-4 mr-2" />
              Export Anyway
            </Button>
          ) : hasChecksumConfig && !isValidating && !validationResult ? (
            <Button variant="outline" disabled>
              Validate Checksum First
            </Button>
          ) : (
            <Button variant="outline" disabled>
              Configure Checksum First
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

