"use client"

import { useEffect, useState, useCallback } from 'react'
import { Layers, Navigation, Settings, MousePointerClick } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import PanoramaViewer from '@/components/panorama/panorama-viewer'
import HotspotPopup from '@/components/panorama/hotspot-popup'
import ViewerControls from '@/components/panorama/viewer-controls'
import ScenePanel from '@/components/editor/scene-panel'
import HotspotPanel from '@/components/editor/hotspot-panel'
import SettingsPanel from '@/components/editor/settings-panel'
import EditorToolbar from '@/components/editor/editor-toolbar'
import type { Hotspot, HotspotPosition } from '@/lib/tour-types'
import {
  useTour,
  useCurrentScene,
  useCurrentSceneId,
  useEditorMode,
  useAddHotspotType,
  useSelectedHotspotId,
  loadTour,
  setCurrentScene,
  addHotspotToScene,
  selectHotspot,
  setEditorMode,
  createDemoTour,
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

  // Initialize with demo tour
  useEffect(() => {
    if (!tour) {
      const demoTour = createDemoTour()
      loadTour(demoTour)
    }
  }, [tour])

  const handleHotspotClick = useCallback(
    (hotspot: Hotspot) => {
      if (editorMode === 'view') {
        // In view mode, handle the hotspot action
        if (hotspot.type === 'scene-link' && hotspot.targetSceneId) {
          setCurrentScene(hotspot.targetSceneId)
        } else {
          setActivePopup(hotspot)
        }
      } else {
        // In editor mode, select the hotspot for editing
        selectHotspot(hotspot.id)
        setSidebarTab('hotspots')
      }
    },
    [editorMode]
  )

  const handleSceneClick = useCallback(
    (position: HotspotPosition) => {
      if (editorMode === 'add-hotspot' && currentSceneId) {
        const title = addHotspotType === 'scene-link'
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
      <EditorToolbar />

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
                isEditorMode={editorMode === 'add-hotspot'}
                selectedHotspotId={selectedHotspotId}
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
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Layers className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-1">No scene selected</h3>
                <p className="text-sm text-muted-foreground">
                  Add a panorama scene from the left panel to get started
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
