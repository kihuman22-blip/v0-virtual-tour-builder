"use client"

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Layers, Navigation, Settings, MousePointerClick, Upload, Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase/client'
import PanoramaViewer from '@/components/panorama/panorama-viewer'
import HotspotPopup from '@/components/panorama/hotspot-popup'
import ViewerControls from '@/components/panorama/viewer-controls'
import ScenePanel from '@/components/editor/scene-panel'
import HotspotPanel from '@/components/editor/hotspot-panel'
import SettingsPanel from '@/components/editor/settings-panel'
import EditorToolbar from '@/components/editor/editor-toolbar'
import type { Tour, Hotspot, HotspotPosition } from '@/lib/tour-types'
import {
  useTour,
  useCurrentScene,
  useCurrentSceneId,
  useEditorMode,
  useAddHotspotType,
  useSelectedHotspotId,
  initTour,
  loadTour,
  addScene,
  setCurrentScene,
  addHotspotToScene,
  updateHotspot,
  selectHotspot,
  setEditorMode,
} from '@/lib/tour-store'

export default function EditorPage() {
  const tour = useTour()
  const currentScene = useCurrentScene()
  const currentSceneId = useCurrentSceneId()
  const editorMode = useEditorMode()
  const addHotspotType = useAddHotspotType()
  const selectedHotspotId = useSelectedHotspotId()
  const [activePopup, setActivePopup] = useState<Hotspot | null>(null)
  const [sidebarTab, setSidebarTab] = useState('scenes')
  const [viewportDragOver, setViewportDragOver] = useState(false)
  const viewportFileInputRef = useRef<HTMLInputElement>(null)
  const searchParams = useSearchParams()
  const tourDbId = searchParams.get('id')
  const [dbLoaded, setDbLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const supabase = createClient()

  // Load tour from Supabase if ?id= is present
  useEffect(() => {
    if (tourDbId && !dbLoaded) {
      const loadFromDb = async () => {
        const { data } = await supabase
          .from('tours')
          .select('*')
          .eq('id', tourDbId)
          .single()
        if (data?.tour_data) {
          loadTour(data.tour_data as unknown as Tour)
        }
        setDbLoaded(true)
      }
      loadFromDb()
    } else if (!tourDbId && !tour) {
      const blankTour = initTour('My Virtual Tour', 'An immersive 360 experience')
      loadTour(blankTour)
      setDbLoaded(true)
    }
  }, [tourDbId, dbLoaded, supabase, tour])

  // Auto-save to Supabase (debounced)
  const saveTour = useCallback(
    async (tourData: Tour) => {
      setSaving(true)
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return

        const payload = {
          user_id: user.id,
          name: tourData.name,
          description: tourData.description || null,
          tour_data: tourData as unknown as Record<string, unknown>,
          is_public: tourData.settings?.showSceneList ?? false,
          scene_count: tourData.scenes.length,
        }

        if (tourDbId) {
          await supabase.from('tours').update(payload).eq('id', tourDbId)
        } else {
          const { data } = await supabase.from('tours').insert(payload).select('id').single()
          if (data?.id) {
            // Update URL without reload
            window.history.replaceState(null, '', `/editor?id=${data.id}`)
          }
        }
        setLastSaved(new Date().toLocaleTimeString())
      } finally {
        setSaving(false)
      }
    },
    [tourDbId, supabase]
  )

  // Debounced auto-save: triggers 2 seconds after the last change
  useEffect(() => {
    if (!tour || !dbLoaded) return
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      saveTour(tour)
    }, 2000)
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [tour, dbLoaded, saveTour])

  const handleHotspotClick = useCallback(
    (hotspot: Hotspot) => {
      if (editorMode === 'view') {
        if (hotspot.type === 'scene-link' && hotspot.targetSceneId) {
          setCurrentScene(hotspot.targetSceneId)
        } else {
          setActivePopup(hotspot)
        }
      } else {
        selectHotspot(hotspot.id)
        setSidebarTab('hotspots')
      }
    },
    [editorMode]
  )

  const handleSceneClick = useCallback(
    (position: HotspotPosition) => {
      if (editorMode === 'add-hotspot' && currentSceneId) {
        const title =
          addHotspotType === 'scene-link'
            ? 'Go to scene'
            : addHotspotType === 'info'
              ? 'Information'
              : addHotspotType === 'image'
                ? 'Image'
                : 'Content'
        addHotspotToScene(currentSceneId, addHotspotType, position, title)
        setSidebarTab('hotspots')
      }
    },
    [editorMode, currentSceneId, addHotspotType]
  )

  const handleDropScene = useCallback(
    (droppedSceneId: string, position: HotspotPosition) => {
      if (!currentSceneId || droppedSceneId === currentSceneId) return
      const targetScene = tour?.scenes.find((s) => s.id === droppedSceneId)
      const title = targetScene ? `Go to ${targetScene.name}` : 'Go to scene'
      const hotspot = addHotspotToScene(currentSceneId, 'scene-link', position, title)
      updateHotspot(currentSceneId, hotspot.id, {
        targetSceneId: droppedSceneId,
        icon: 'arrow' as const,
        color: '#3b82f6',
      })
      setSidebarTab('hotspots')
    },
    [currentSceneId, tour?.scenes]
  )

  const handleSceneChange = useCallback((sceneId: string) => {
    setCurrentScene(sceneId)
    setActivePopup(null)
  }, [])

  if (!tour) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <EditorToolbar saving={saving} lastSaved={lastSaved} onSaveNow={() => saveTour(tour)} />

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-72 border-r border-border bg-card flex flex-col flex-shrink-0">
          <Tabs value={sidebarTab} onValueChange={setSidebarTab} className="flex flex-col h-full">
            <TabsList className="grid grid-cols-3 m-2 h-9">
              <TabsTrigger value="scenes" className="text-xs gap-1">
                <Layers className="h-3.5 w-3.5" />
                Scenes
              </TabsTrigger>
              <TabsTrigger value="hotspots" className="text-xs gap-1">
                <Navigation className="h-3.5 w-3.5" />
                Hotspots
              </TabsTrigger>
              <TabsTrigger value="settings" className="text-xs gap-1">
                <Settings className="h-3.5 w-3.5" />
                Settings
              </TabsTrigger>
            </TabsList>
            <TabsContent value="scenes" className="flex-1 overflow-hidden m-0">
              <ScenePanel />
            </TabsContent>
            <TabsContent value="hotspots" className="flex-1 overflow-hidden m-0">
              <HotspotPanel />
            </TabsContent>
            <TabsContent value="settings" className="flex-1 overflow-hidden m-0">
              <SettingsPanel />
            </TabsContent>
          </Tabs>
        </div>

        {/* Main viewport */}
        <div className="flex-1 relative bg-background">
          {currentScene ? (
            <>
              <PanoramaViewer
                scene={currentScene}
                fov={tour.settings.defaultFov}
                autoRotate={tour.settings.autoRotate}
                autoRotateSpeed={tour.settings.autoRotateSpeed}
                onHotspotClick={handleHotspotClick}
                onSceneClick={handleSceneClick}
                onDropScene={handleDropScene}
                isEditorMode={editorMode === 'add-hotspot'}
                selectedHotspotId={selectedHotspotId}
                allScenes={tour.scenes}
              />
              <ViewerControls
                scenes={tour.scenes}
                currentSceneId={currentScene.id}
                onSceneChange={handleSceneChange}
                showSceneList={tour.settings.showSceneList}
              />
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

              {/* Editor mode indicator */}
              {editorMode !== 'view' && (
                <div className="absolute top-3 right-3 z-20">
                  <button
                    onClick={() => setEditorMode('view')}
                    className="flex items-center gap-1.5 bg-card/90 backdrop-blur-sm border border-border rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <MousePointerClick className="h-3.5 w-3.5" />
                    Exit edit mode
                  </button>
                </div>
              )}
            </>
          ) : (
            <div
              className={`flex items-center justify-center h-full transition-colors ${viewportDragOver ? 'bg-primary/5' : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                setViewportDragOver(true)
              }}
              onDragLeave={() => setViewportDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setViewportDragOver(false)
                const files = Array.from(e.dataTransfer.files).filter((f) =>
                  f.type.startsWith('image/')
                )
                files.forEach((file) => {
                  const url = URL.createObjectURL(file)
                  const name = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
                  addScene(name, url)
                })
              }}
            >
              <input
                ref={viewportFileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = e.target.files
                  if (!files) return
                  Array.from(files).forEach((file) => {
                    if (!file.type.startsWith('image/')) return
                    const url = URL.createObjectURL(file)
                    const name = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
                    addScene(name, url)
                  })
                }}
              />
              {viewportDragOver ? (
                <div className="text-center">
                  <div className="mx-auto w-20 h-20 rounded-2xl border-2 border-dashed border-primary bg-primary/10 flex items-center justify-center mb-4">
                    <Upload className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-medium text-primary mb-1">Drop your images here</h3>
                  <p className="text-sm text-muted-foreground">
                    They will be added as panorama scenes
                  </p>
                </div>
              ) : (
                <div className="text-center max-w-md">
                  <div className="mx-auto w-20 h-20 rounded-2xl bg-secondary flex items-center justify-center mb-6">
                    <Compass className="h-10 w-10 text-muted-foreground/40" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2 text-balance">
                    Start building your virtual tour
                  </h3>
                  <p className="text-sm text-muted-foreground mb-6 leading-relaxed text-pretty">
                    Upload your 360-degree panorama images to create an immersive experience. You can
                    add multiple scenes and connect them with interactive hotspots.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <Button
                      size="lg"
                      className="gap-2"
                      onClick={() => viewportFileInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4" />
                      Upload Panorama Images
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground/50 mt-4">
                    or drag and drop images anywhere on this area
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
