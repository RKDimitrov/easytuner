/**
 * Library Page
 * 
 * Browse and manage map templates, common patterns, and reference data
 */

import { Header } from '../components/Header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { 
  BookOpen, 
  Search, 
  Filter,
  Download,
  Star,
  FileCode,
  Grid3x3,
  List
} from 'lucide-react'

export function Library() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Map Library</h1>
              <p className="text-muted-foreground mt-1">
                Browse common ECU map patterns, templates, and reference data
              </p>
            </div>
          </div>

          {/* Search and Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search maps, patterns, or templates..."
                    className="pl-10"
                  />
                </div>
                <Button variant="outline">
                  <Filter className="w-4 h-4 mr-2" />
                  Filters
                </Button>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon">
                    <Grid3x3 className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="icon">
                    <List className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Categories */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="cursor-pointer hover:border-primary transition-colors">
              <CardHeader>
                <CardTitle className="text-lg">2D Maps</CardTitle>
                <CardDescription>Two-dimensional calibration maps</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">24</div>
                <p className="text-xs text-muted-foreground">Available templates</p>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:border-primary transition-colors">
              <CardHeader>
                <CardTitle className="text-lg">3D Maps</CardTitle>
                <CardDescription>Three-dimensional lookup tables</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">12</div>
                <p className="text-xs text-muted-foreground">Available templates</p>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:border-primary transition-colors">
              <CardHeader>
                <CardTitle className="text-lg">1D Tables</CardTitle>
                <CardDescription>One-dimensional lookup tables</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">18</div>
                <p className="text-xs text-muted-foreground">Available templates</p>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:border-primary transition-colors">
              <CardHeader>
                <CardTitle className="text-lg">Patterns</CardTitle>
                <CardDescription>Common detection patterns</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">8</div>
                <p className="text-xs text-muted-foreground">Available patterns</p>
              </CardContent>
            </Card>
          </div>

          {/* Featured Maps */}
          <Card>
            <CardHeader>
              <CardTitle>Featured Maps</CardTitle>
              <CardDescription>
                Popular and commonly used map templates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="hover:border-primary transition-colors">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <FileCode className="w-5 h-5 text-primary" />
                          <CardTitle className="text-base">Ignition Timing Map</CardTitle>
                        </div>
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      </div>
                      <CardDescription>
                        16x16 2D map for ignition timing calibration
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="flex gap-2">
                          <Badge variant="secondary">2D</Badge>
                          <Badge variant="outline">16x16</Badge>
                        </div>
                        <Button variant="outline" size="sm">
                          <Download className="w-4 h-4 mr-2" />
                          Use
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Coming Soon Notice */}
          <Card className="border-dashed">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <BookOpen className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Library Coming Soon</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  The map library feature is under development. Soon you'll be able to browse,
                  download, and use common ECU map templates and patterns.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

