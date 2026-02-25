"use client"

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  Compass,
  Maximize,
  Minimize,
  Share2,
  Copy,
  Check,
  Code,
  X,
  Download,
  ArrowLeft,
  Layers,
  ChevronUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import PanoramaViewer from '@/components/panorama/panorama-viewer'
import HotspotPopup from '@/components/panorama/hotspot-popup'
import type { Tour, Hotspot, Scene } from '@/lib/tour-types'
import {
  useTour,
  useCurrentScene,
  useCurrentSceneId,
  loadTour,
  setCurrentScene,
  createDemoTour,
  exportTour,
} from '@/lib/tour-store'

function ViewerHeader({
  tourName,
  onShare,
  onBack,
  onFullscreen,
  isFullscreen,
}: {
  tourName: string
  onShare: () => void
  onBack: () => void
  onFullscreen: () => void
  isFullscreen: boolean
}) {
  return (
    <header className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-background/80 via-background/40 to-transparent pointer-events-none">
      <div className="flex items-center gap-3 pointer-events-auto">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href="/">
              <Button variant="secondary" size="icon" className="h-9 w-9 bg-secondary/80 backdrop-blur-sm">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
          </TooltipTrigger>
          <TooltipContent>Back to home</TooltipContent>
        </Tooltip>
        <div className="flex items-center gap-2 bg-secondary/80 backdrop-blur-sm rounded-lg px-3 py-1.5">
          <Compass className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-secondary-foreground">{tourName}</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 pointer-events-auto">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              className="h-9 w-9 bg-secondary/80 backdrop-blur-sm"
              onClick={onShare}
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Share tour</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              className="h-9 w-9 bg-secondary/80 backdrop-blur-sm"
              onClick={onFullscreen}
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}</TooltipContent>
        </Tooltip>
      </div>
    </header>
  )
}

function SceneStrip({
  scenes,
  currentSceneId,
  onSceneChange,
  visible,
  onToggle,
}: {
  scenes: Scene[]
  currentSceneId: string
  onSceneChange: (id: string) => void
  visible: boolean
  onToggle: () => void
}) {
  if (scenes.length <= 1) return null

  return (
    <>
      {/* Toggle button */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20">
        <Button
          variant="secondary"
          size="sm"
          className="bg-secondary/80 backdrop-blur-sm gap-1.5 text-xs"
          onClick={onToggle}
        >
          <Layers className="h-3.5 w-3.5" />
          {visible ? 'Hide Scenes' : 'Show Scenes'}
          <ChevronUp className={`h-3 w-3 transition-transform ${visible ? '' : 'rotate-180'}`} />
        </Button>
      </div>

      {/* Strip */}
      {visible && (
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-secondary/80 backdrop-blur-xl rounded-xl p-2 border border-border/50 max-w-[90vw] overflow-x-auto animate-in slide-in-from-bottom-4 duration-300">
          {scenes.map((scene) => (
            <button
              key={scene.id}
              onClick={() => onSceneChange(scene.id)}
              className={`flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                scene.id === currentSceneId
                  ? 'border-primary ring-2 ring-primary/30 scale-105'
                  : 'border-transparent hover:border-muted-foreground/30 opacity-70 hover:opacity-100'
              }`}
            >
              <div className="w-24 h-14 bg-muted relative">
                <img
                  src={scene.imageUrl}
                  alt={scene.name}
                  className="w-full h-full object-cover"
                  crossOrigin="anonymous"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/70 to-transparent" />
                <span className="absolute bottom-1 left-1.5 text-[10px] font-medium text-foreground truncate max-w-[84px]">
                  {scene.name}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  )
}

function BottomBar({
  scenes,
  currentSceneId,
  onSceneChange,
}: {
  scenes: Scene[]
  currentSceneId: string
  onSceneChange: (id: string) => void
}) {
  const currentIndex = scenes.findIndex((s) => s.id === currentSceneId)
  const prevScene = currentIndex > 0 ? scenes[currentIndex - 1] : null
  const nextScene = currentIndex < scenes.length - 1 ? scenes[currentIndex + 1] : null
  const currentScene = scenes.find((s) => s.id === currentSceneId)

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none">
      <div className="flex items-center justify-between px-4 py-4 bg-gradient-to-t from-background/80 via-background/40 to-transparent">
        {/* Prev */}
        <div className="pointer-events-auto">
          {prevScene ? (
            <button
              onClick={() => onSceneChange(prevScene.id)}
              className="flex items-center gap-2 bg-secondary/80 backdrop-blur-sm rounded-lg px-3 py-2 hover:bg-secondary transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-secondary-foreground">{prevScene.name}</span>
            </button>
          ) : (
            <div />
          )}
        </div>

        {/* Current info */}
        <div className="text-center pointer-events-auto">
          <p className="text-sm font-medium text-foreground">{currentScene?.name}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Scene {currentIndex + 1} of {scenes.length}
          </p>
        </div>

        {/* Next */}
        <div className="pointer-events-auto">
          {nextScene ? (
            <button
              onClick={() => onSceneChange(nextScene.id)}
              className="flex items-center gap-2 bg-secondary/80 backdrop-blur-sm rounded-lg px-3 py-2 hover:bg-secondary transition-colors"
            >
              <span className="text-xs text-secondary-foreground">{nextScene.name}</span>
              <ArrowLeft className="h-3.5 w-3.5 text-muted-foreground rotate-180" />
            </button>
          ) : (
            <div />
          )}
        </div>
      </div>
    </div>
  )
}

function ShareDialog({
  open,
  onClose,
  tour,
}: {
  open: boolean
  onClose: () => void
  tour: Tour
}) {
  const [copied, setCopied] = useState<string | null>(null)

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/viewer` : '/viewer'
  const embedCode = `<iframe src="${shareUrl}" width="100%" height="600" frameborder="0" allowfullscreen></iframe>`

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // fallback
    }
  }

  const handleExportJson = () => {
    const json = exportTour()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${tour.name.toLowerCase().replace(/\s+/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-card-foreground">Share Tour</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Share your virtual tour or embed it on your website.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* URL */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tour Link</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-secondary rounded-lg px-3 py-2 text-sm text-secondary-foreground font-mono truncate">
                {shareUrl}
              </div>
              <Button
                variant="outline"
                size="icon"
                className="flex-shrink-0"
                onClick={() => handleCopy(shareUrl, 'url')}
              >
                {copied === 'url' ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Embed */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              <Code className="h-3 w-3 inline mr-1" />
              Embed Code
            </label>
            <div className="flex items-start gap-2">
              <div className="flex-1 bg-secondary rounded-lg px-3 py-2 text-xs text-muted-foreground font-mono break-all max-h-20 overflow-y-auto">
                {embedCode}
              </div>
              <Button
                variant="outline"
                size="icon"
                className="flex-shrink-0 mt-0.5"
                onClick={() => handleCopy(embedCode, 'embed')}
              >
                {copied === 'embed' ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Export JSON */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Export</label>
            <Button variant="outline" className="w-full gap-2" onClick={handleExportJson}>
              <Download className="h-4 w-4" />
              Download Tour as JSON
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function ViewerPage() {
  const tour = useTour()
  const currentScene = useCurrentScene()
  const currentSceneId = useCurrentSceneId()
  const [activePopup, setActivePopup] = useState<Hotspot | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [showScenes, setShowScenes] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Initialize with demo tour
  useEffect(() => {
    if (!tour) {
      const demoTour = createDemoTour()
      loadTour(demoTour)
    }
  }, [tour])

  const handleHotspotClick = useCallback((hotspot: Hotspot) => {
    if (hotspot.type === 'scene-link' && hotspot.targetSceneId) {
      setCurrentScene(hotspot.targetSceneId)
      setActivePopup(null)
    } else {
      setActivePopup(hotspot)
    }
  }, [])

  const handleSceneChange = useCallback((sceneId: string) => {
    setCurrentScene(sceneId)
    setActivePopup(null)
  }, [])

  const handleFullscreen = useCallback(() => {
    const el = containerRef.current
    if (!el) return

    if (!document.fullscreenElement) {
      el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }, [])

  // Listen for fullscreen change
  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  if (!tour || !currentScene || !currentSceneId) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <span className="text-sm text-muted-foreground">Loading tour...</span>
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div ref={containerRef} className="h-screen w-screen bg-background relative overflow-hidden">
        {/* Panorama viewer fills the entire screen */}
        <PanoramaViewer
          scene={currentScene}
          fov={tour.settings.defaultFov}
          autoRotate={tour.settings.autoRotate}
          autoRotateSpeed={tour.settings.autoRotateSpeed}
          onHotspotClick={handleHotspotClick}
          isEditorMode={false}
          selectedHotspotId={null}
        />

        {/* Overlay UI */}
        <ViewerHeader
          tourName={tour.name}
          onShare={() => setShowShare(true)}
          onBack={() => {}}
          onFullscreen={handleFullscreen}
          isFullscreen={isFullscreen}
        />

        <BottomBar
          scenes={tour.scenes}
          currentSceneId={currentSceneId}
          onSceneChange={handleSceneChange}
        />

        <SceneStrip
          scenes={tour.scenes}
          currentSceneId={currentSceneId}
          onSceneChange={handleSceneChange}
          visible={showScenes}
          onToggle={() => setShowScenes(!showScenes)}
        />

        {/* Hotspot popup */}
        {activePopup && (
          <HotspotPopup
            hotspot={activePopup}
            onClose={() => setActivePopup(null)}
            onNavigate={(sceneId) => {
              setCurrentScene(sceneId)
              setActivePopup(null)
            }}
          />
        )}

        {/* Share dialog */}
        <ShareDialog open={showShare} onClose={() => setShowShare(false)} tour={tour} />

        {/* Instructions overlay on first load */}
        <ViewerInstructions />
      </div>
    </TooltipProvider>
  )
}

function ViewerInstructions() {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 5000)
    return () => clearTimeout(timer)
  }, [])

  if (!visible) return null

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none animate-in fade-in-0 duration-500"
      style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.5s' }}
    >
      <div className="bg-card/90 backdrop-blur-xl border border-border rounded-xl px-6 py-4 text-center pointer-events-auto shadow-2xl max-w-sm mx-4 animate-in zoom-in-95 duration-300">
        <Compass className="h-8 w-8 text-primary mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-card-foreground mb-1">Explore the Tour</h3>
        <p className="text-xs text-muted-foreground leading-relaxed mb-3">
          Drag to look around. Click hotspots to navigate between scenes or view information. Scroll to zoom.
        </p>
        <Button
          size="sm"
          variant="secondary"
          className="text-xs"
          onClick={() => setVisible(false)}
        >
          Got it
        </Button>
      </div>
    </div>
  )
}
