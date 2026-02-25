import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ChevronDown, Upload, ScanSearch, BarChart3 } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { usePageTitle } from '../hooks/usePageTitle'
import etlogo from '../etlogo.png'

export function Landing() {
  usePageTitle()
  const navigate = useNavigate()
  const featuresRef = useRef<HTMLElement>(null)

  const scrollToFeatures = () => {
    featuresRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const features = [
    {
      icon: Upload,
      title: 'Upload Firmware',
      description:
        'Upload ECU firmware binary files directly. Supports a wide range of ECU formats from major automotive manufacturers.',
    },
    {
      icon: ScanSearch,
      title: 'Automatic Scan',
      description:
        'The engine automatically detects and identifies ECU maps — fuel tables, ignition timing, boost pressure, and more.',
    },
    {
      icon: BarChart3,
      title: 'Analyze & Export',
      description:
        'Inspect detected maps in hex, text, or 3D visualization modes. Annotate, edit values, and export your results.',
    },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Minimal header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center space-x-2">
            <img src={etlogo} alt="EasyTuner" className="h-8 w-8 rounded-lg object-contain" />
            <span className="text-xl font-bold">EasyTuner</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/login')}>
            Sign In
          </Button>
        </div>
      </header>

      {/* Hero section */}
      <main className="flex-1">
        <section className="flex flex-col items-center justify-center text-center px-4 py-24 md:py-36">
          <img src={etlogo} alt="EasyTuner" className="h-20 w-20 rounded-2xl object-contain shadow-lg mb-8" />

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
            Easy<span className="text-primary">Tuner</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground font-medium mb-4">
            ECU Map Recognition Platform
          </p>

          <p className="max-w-xl text-muted-foreground mb-10 leading-relaxed">
            Upload ECU firmware, automatically detect and identify maps, and gain full
            visibility into your engine's calibration data — all in one place.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Button size="lg" onClick={() => navigate('/login')} className="gap-2 px-8">
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="ghost" onClick={scrollToFeatures} className="gap-2">
              Learn More
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        </section>

        {/* Features section */}
        <section ref={featuresRef} className="border-t bg-muted/30 px-4 py-20">
          <div className="container max-w-5xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">
              Everything you need for ECU tuning
            </h2>
            <p className="text-center text-muted-foreground mb-12 max-w-lg mx-auto">
              A streamlined workflow from raw firmware to fully annotated map data.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {features.map((feature) => {
                const Icon = feature.icon
                return (
                  <Card key={feature.title} className="border bg-card">
                    <CardHeader className="pb-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-3">
                        <Icon className="h-5 w-5" />
                      </div>
                      <CardTitle className="text-base">{feature.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {feature.description}
                      </p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {/* Bottom CTA */}
            <div className="mt-14 text-center">
              <Button size="lg" onClick={() => navigate('/login')} className="gap-2 px-10">
                Start for free
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-6 px-4">
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <img src={etlogo} alt="EasyTuner" className="h-5 w-5 rounded object-contain" />
            <span>EasyTuner</span>
          </div>
          <span>© {new Date().getFullYear()} EasyTuner. All rights reserved.</span>
        </div>
      </footer>
    </div>
  )
}
