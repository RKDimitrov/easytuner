import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Button } from './ui/button'
import { Checkbox } from './ui/checkbox'
import { AlertTriangle } from 'lucide-react'

interface TOSModalProps {
  open: boolean
  onAccept: () => void
}

export function TOSModal({ open, onAccept }: TOSModalProps) {
  const [tosChecked, setTosChecked] = useState(false)
  const [legalChecked, setLegalChecked] = useState(false)

  // Reset checkboxes when modal opens
  useEffect(() => {
    if (open) {
      setTosChecked(false)
      setLegalChecked(false)
    }
  }, [open])

  const handleAccept = () => {
    if (tosChecked && legalChecked) {
      onAccept()
    }
  }

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <AlertTriangle className="h-6 w-6 text-warning" />
            Terms of Service & Legal Attestation
          </DialogTitle>
          <DialogDescription>
            Please read and accept the following before proceeding
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Terms of Service Section */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">Terms of Service</h3>
            <div className="text-sm text-muted-foreground space-y-2 border-l-4 border-primary pl-4">
              <p>
                This ECU Map Recognition Platform ("Platform") is provided for <strong>research, educational, and authorized professional use only</strong>.
              </p>
              <p>By using this Platform, you agree to:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Use the Platform only for lawful, authorized purposes</li>
                <li>Not modify or tamper with emissions control systems on production vehicles</li>
                <li>Not reverse engineer ECUs without proper authorization</li>
                <li>Comply with all applicable local, state, federal, and international laws</li>
                <li>Accept that analysis results are provided "as-is" without warranties</li>
                <li>Understand that uploaded files are processed and temporarily stored</li>
              </ul>
            </div>
          </div>

          {/* Legal Attestation Section */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-destructive">Legal Attestation</h3>
            <div className="text-sm text-muted-foreground space-y-2 border-l-4 border-destructive pl-4">
              <p className="font-semibold">
                You must attest that you have legal authority to analyze the uploaded firmware file(s).
              </p>
              <p><strong>Authorized Use Cases:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>✅ Academic research with institutional approval</li>
                <li>✅ Security research on personally owned devices</li>
                <li>✅ Professional motorsport/off-road tuning with customer authorization</li>
                <li>✅ Manufacturer-authorized reverse engineering</li>
              </ul>
              <p className="mt-3"><strong>Prohibited Use Cases:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-4 text-destructive">
                <li>❌ Unauthorized tampering with production vehicle ECUs</li>
                <li>❌ Circumventing emissions control systems (EPA violation)</li>
                <li>❌ Analyzing firmware without legal authority</li>
                <li>❌ Commercial use without proper licensing</li>
              </ul>
            </div>
          </div>

          {/* Warning Box */}
          <div className="bg-warning/10 border border-warning rounded-lg p-4">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-warning mb-1">Important Notice</p>
                <p className="text-muted-foreground">
                  Violations of emissions regulations (e.g., EPA Clean Air Act in the US) can result in 
                  civil penalties up to $50,000 per violation. Unauthorized ECU modification may void 
                  vehicle warranties and violate intellectual property laws.
                </p>
              </div>
            </div>
          </div>

          {/* Checkboxes */}
          <div className="space-y-4 pt-4">
            <div className="flex items-start space-x-3 p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors">
              <Checkbox
                id="tos"
                checked={tosChecked}
                onCheckedChange={(checked) => setTosChecked(checked === true)}
                className="mt-1"
              />
              <label
                htmlFor="tos"
                className="text-sm leading-relaxed cursor-pointer flex-1"
              >
                I have read and agree to the <strong>Terms of Service</strong> and understand that 
                this platform is for authorized research and educational purposes only.
              </label>
            </div>

            <div className="flex items-start space-x-3 p-4 border border-destructive/50 rounded-lg hover:bg-destructive/10 transition-colors">
              <Checkbox
                id="legal"
                checked={legalChecked}
                onCheckedChange={(checked) => setLegalChecked(checked === true)}
                className="mt-1"
              />
              <label
                htmlFor="legal"
                className="text-sm leading-relaxed cursor-pointer flex-1"
              >
                I <strong>legally attest</strong> that I have proper authorization to analyze the 
                firmware file(s) I upload to this platform and will comply with all applicable laws.
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={handleAccept}
            disabled={!tosChecked || !legalChecked}
            className="w-full sm:w-auto"
            size="lg"
          >
            Accept & Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

