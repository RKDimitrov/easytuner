/**
 * Data & Privacy Tab Component
 * 
 * Manages data export, account deletion, and privacy settings
 */

import { useState } from 'react'
import { Database, Download, Trash2, AlertTriangle, Shield } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import { Switch } from '../ui/switch'
import { Separator } from '../ui/separator'
import { Alert, AlertDescription } from '../ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../ui/alert-dialog'
import { toast } from 'sonner'

export function DataPrivacyTab() {
  const [isExportingData, setIsExportingData] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true)
  const [marketingEmails, setMarketingEmails] = useState(false)

  const handleExportData = async () => {
    setIsExportingData(true)
    try {
      // TODO: Replace with actual API call when backend is ready
      // await dataService.exportUserData()
      
      // For now, simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      toast.success('Data export initiated', {
        description: 'You will receive an email when your data is ready for download.',
      })
    } catch (error) {
      toast.error('Failed to export data', {
        description: 'Please try again later.',
      })
    } finally {
      setIsExportingData(false)
    }
  }

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true)
    try {
      // TODO: Replace with actual API call when backend is ready
      // await authService.deleteAccount()
      
      // For now, simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      toast.success('Account deletion initiated', {
        description: 'Your account will be permanently deleted within 30 days.',
      })
    } catch (error) {
      toast.error('Failed to delete account', {
        description: 'Please contact support if this issue persists.',
      })
    } finally {
      setIsDeletingAccount(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Data Export */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Your Data
          </CardTitle>
          <CardDescription>
            Download a copy of all your data in a portable format
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You can request a copy of all your personal data, including projects, files, 
            scans, and annotations. The data will be provided in JSON format.
          </p>
          
          <div className="space-y-2">
            <h4 className="font-medium">What's included in the export:</h4>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>Account information and profile data</li>
              <li>All projects and their metadata</li>
              <li>Uploaded files and scan results</li>
              <li>Annotations and bookmarks</li>
              <li>Account activity logs</li>
            </ul>
          </div>

          <Button 
            onClick={handleExportData}
            disabled={isExportingData}
            className="w-full sm:w-auto"
          >
            <Download className="h-4 w-4 mr-2" />
            {isExportingData ? 'Preparing Export...' : 'Request Data Export'}
          </Button>
        </CardContent>
      </Card>

      {/* Privacy Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Privacy Settings
          </CardTitle>
          <CardDescription>
            Control how your data is used and shared
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="analytics">Usage Analytics</Label>
              <p className="text-sm text-muted-foreground">
                Help improve the application by sharing anonymous usage data
              </p>
            </div>
            <Switch
              id="analytics"
              checked={analyticsEnabled}
              onCheckedChange={setAnalyticsEnabled}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="marketing">Marketing Emails</Label>
              <p className="text-sm text-muted-foreground">
                Receive updates about new features and improvements
              </p>
            </div>
            <Switch
              id="marketing"
              checked={marketingEmails}
              onCheckedChange={setMarketingEmails}
            />
          </div>
        </CardContent>
      </Card>

      {/* Account Deletion */}
      <Card className="border-red-200 dark:border-red-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <Trash2 className="h-5 w-5" />
            Delete Account
          </CardTitle>
          <CardDescription>
            Permanently delete your account and all associated data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-red-200 dark:border-red-800">
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <AlertDescription className="text-red-800 dark:text-red-200">
              <strong>Warning:</strong> This action cannot be undone. All your data, 
              including projects, files, and scan results, will be permanently deleted.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <h4 className="font-medium">What will be deleted:</h4>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>Your account and profile information</li>
              <li>All projects and their contents</li>
              <li>All uploaded files and scan results</li>
              <li>All annotations and bookmarks</li>
              <li>All account activity and logs</li>
            </ul>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="destructive" 
                className="w-full sm:w-auto"
                disabled={isDeletingAccount}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {isDeletingAccount ? 'Deleting Account...' : 'Delete Account'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete your 
                  account and remove all your data from our servers. You will lose:
                  <br /><br />
                  • All projects and files<br />
                  • All scan results and annotations<br />
                  • All account settings and preferences<br />
                  • Access to all paid features<br /><br />
                  If you're sure you want to proceed, type "DELETE" in the confirmation field.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Yes, Delete My Account
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* Data Retention */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Data Retention
          </CardTitle>
          <CardDescription>
            Information about how long we keep your data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="space-y-1">
              <h4 className="font-medium">Account Data</h4>
              <p className="text-sm text-muted-foreground">
                Retained until account deletion or 3 years of inactivity
              </p>
            </div>
            
            <div className="space-y-1">
              <h4 className="font-medium">Project Data</h4>
              <p className="text-sm text-muted-foreground">
                Retained until project deletion or account deletion
              </p>
            </div>
            
            <div className="space-y-1">
              <h4 className="font-medium">Activity Logs</h4>
              <p className="text-sm text-muted-foreground">
                Retained for 1 year for security and debugging purposes
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
