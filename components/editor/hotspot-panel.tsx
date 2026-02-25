"use client"

import { useState } from 'react'
import {
  ArrowRight,
  Info,
  ImageIcon,
  FileText,
  Trash2,
  Navigation,
  MousePointerClick,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import type { Hotspot } from '@/lib/tour-types'
import {
  useTour,
  useCurrentScene,
  useCurrentSceneId,
  useSelectedHotspot,
  useSelectedHotspotId,
  useEditorMode,
  useAddHotspotType,
  updateHotspot,
  removeHotspot,
  selectHotspot,
  setEditorMode,
  setAddHotspotType,
} from '@/lib/tour-store'

const HOTSPOT_TYPES: { type: Hotspot['type']; label: string; icon: React.ReactNode; desc: string }[] = [
  { type: 'scene-link', label: 'Scene Link', icon: <ArrowRight className="h-4 w-4" />, desc: 'Navigate to another scene' },
  { type: 'info', label: 'Info', icon: <Info className="h-4 w-4" />, desc: 'Display text information' },
  { type: 'image', label: 'Image', icon: <ImageIcon className="h-4 w-4" />, desc: 'Show an image popup' },
  { type: 'content', label: 'Content', icon: <FileText className="h-4 w-4" />, desc: 'Rich text content' },
]

const HOTSPOT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#ffffff']

export default function HotspotPanel() {
  const tour = useTour()
  const currentScene = useCurrentScene()
  const currentSceneId = useCurrentSceneId()
  const selectedHotspot = useSelectedHotspot()
  const selectedHotspotId = useSelectedHotspotId()
  const editorMode = useEditorMode()
  const addHotspotType = useAddHotspotType()

  if (!tour || !currentScene || !currentSceneId) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <Navigation className="h-10 w-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">Select a scene to manage hotspots</p>
      </div>
    )
  }

  // Add hotspot mode
  if (editorMode === 'add-hotspot') {
    return (
      <div className="flex flex-col h-full">
        <div className="p-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Add Hotspot</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Select type, then click on the panorama</p>
        </div>
        <div className="p-3 space-y-2">
          {HOTSPOT_TYPES.map((ht) => (
            <button
              key={ht.type}
              onClick={() => setAddHotspotType(ht.type)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                addHotspotType === ht.type
                  ? 'border-primary/50 bg-primary/10'
                  : 'border-border hover:bg-secondary'
              }`}
            >
              <div className={`h-8 w-8 rounded-md flex items-center justify-center ${
                addHotspotType === ht.type ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
              }`}>
                {ht.icon}
              </div>
              <div>
                <p className="text-xs font-medium text-foreground">{ht.label}</p>
                <p className="text-[10px] text-muted-foreground">{ht.desc}</p>
              </div>
            </button>
          ))}
        </div>
        <div className="p-3 mt-auto border-t border-border">
          <Button variant="ghost" size="sm" className="w-full" onClick={() => setEditorMode('view')}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  // Edit selected hotspot
  if (editorMode === 'edit-hotspot' && selectedHotspot) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Edit Hotspot</h3>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-4">
            {/* Title */}
            <div>
              <Label className="text-xs text-muted-foreground">Title</Label>
              <Input
                value={selectedHotspot.title}
                onChange={(e) => updateHotspot(currentSceneId, selectedHotspot.id, { title: e.target.value })}
                className="mt-1 h-8 text-sm"
                placeholder="Hotspot title"
              />
            </div>

            {/* Type */}
            <div>
              <Label className="text-xs text-muted-foreground">Type</Label>
              <Select
                value={selectedHotspot.type}
                onValueChange={(val) =>
                  updateHotspot(currentSceneId, selectedHotspot.id, { type: val as Hotspot['type'] })
                }
              >
                <SelectTrigger className="mt-1 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOTSPOT_TYPES.map((ht) => (
                    <SelectItem key={ht.type} value={ht.type}>
                      <span className="flex items-center gap-2">
                        {ht.icon}
                        {ht.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Target scene (for scene-link) */}
            {selectedHotspot.type === 'scene-link' && (
              <div>
                <Label className="text-xs text-muted-foreground">Target Scene</Label>
                <Select
                  value={selectedHotspot.targetSceneId || ''}
                  onValueChange={(val) =>
                    updateHotspot(currentSceneId, selectedHotspot.id, { targetSceneId: val })
                  }
                >
                  <SelectTrigger className="mt-1 h-8 text-sm">
                    <SelectValue placeholder="Select scene" />
                  </SelectTrigger>
                  <SelectContent>
                    {tour.scenes
                      .filter((s) => s.id !== currentSceneId)
                      .map((scene) => (
                        <SelectItem key={scene.id} value={scene.id}>
                          {scene.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Description */}
            <div>
              <Label className="text-xs text-muted-foreground">Description</Label>
              <Textarea
                value={selectedHotspot.description || ''}
                onChange={(e) =>
                  updateHotspot(currentSceneId, selectedHotspot.id, { description: e.target.value })
                }
                className="mt-1 text-sm min-h-[80px]"
                placeholder="Enter description..."
              />
            </div>

            {/* Image URL (for image type) */}
            {selectedHotspot.type === 'image' && (
              <div>
                <Label className="text-xs text-muted-foreground">Image URL</Label>
                <Input
                  value={selectedHotspot.imageUrl || ''}
                  onChange={(e) =>
                    updateHotspot(currentSceneId, selectedHotspot.id, { imageUrl: e.target.value })
                  }
                  className="mt-1 h-8 text-sm"
                  placeholder="https://example.com/image.jpg"
                />
              </div>
            )}

            {/* Content (for content type) */}
            {selectedHotspot.type === 'content' && (
              <div>
                <Label className="text-xs text-muted-foreground">Content (HTML supported)</Label>
                <Textarea
                  value={selectedHotspot.content || ''}
                  onChange={(e) =>
                    updateHotspot(currentSceneId, selectedHotspot.id, { content: e.target.value })
                  }
                  className="mt-1 text-sm min-h-[100px] font-mono"
                  placeholder="<h3>Title</h3><p>Content here...</p>"
                />
              </div>
            )}

            {/* Color */}
            <div>
              <Label className="text-xs text-muted-foreground">Color</Label>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                {HOTSPOT_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => updateHotspot(currentSceneId, selectedHotspot.id, { color })}
                    className={`h-7 w-7 rounded-full border-2 transition-all ${
                      selectedHotspot.color === color ? 'border-foreground scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            {/* Position */}
            <div>
              <Label className="text-xs text-muted-foreground">Position</Label>
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Yaw</Label>
                  <Input
                    type="number"
                    value={Math.round(selectedHotspot.position.yaw)}
                    onChange={(e) =>
                      updateHotspot(currentSceneId, selectedHotspot.id, {
                        position: { ...selectedHotspot.position, yaw: parseFloat(e.target.value) || 0 },
                      })
                    }
                    className="h-7 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Pitch</Label>
                  <Input
                    type="number"
                    value={Math.round(selectedHotspot.position.pitch)}
                    onChange={(e) =>
                      updateHotspot(currentSceneId, selectedHotspot.id, {
                        position: { ...selectedHotspot.position, pitch: parseFloat(e.target.value) || 0 },
                      })
                    }
                    className="h-7 text-xs"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Delete */}
            <Button
              variant="destructive"
              size="sm"
              className="w-full"
              onClick={() => {
                removeHotspot(currentSceneId, selectedHotspot.id)
                setEditorMode('view')
              }}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Delete Hotspot
            </Button>
          </div>
        </ScrollArea>
        <div className="p-3 border-t border-border">
          <Button variant="ghost" size="sm" className="w-full" onClick={() => selectHotspot(null)}>
            Done
          </Button>
        </div>
      </div>
    )
  }

  // Hotspot list view
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Hotspots</h3>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs gap-1"
          onClick={() => setEditorMode('add-hotspot')}
        >
          <MousePointerClick className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {currentScene.hotspots.length === 0 && (
            <div className="text-center py-8 px-4">
              <MousePointerClick className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground mb-1">No hotspots yet</p>
              <p className="text-xs text-muted-foreground/70 mb-3">
                Add interactive points to this scene
              </p>
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={() => setEditorMode('add-hotspot')}
              >
                <MousePointerClick className="h-3 w-3 mr-1" />
                Add Hotspot
              </Button>
            </div>
          )}
          {currentScene.hotspots.map((hotspot) => {
            const typeIcon =
              hotspot.type === 'scene-link' ? (
                <ArrowRight className="h-3.5 w-3.5" />
              ) : hotspot.type === 'info' ? (
                <Info className="h-3.5 w-3.5" />
              ) : hotspot.type === 'image' ? (
                <ImageIcon className="h-3.5 w-3.5" />
              ) : (
                <FileText className="h-3.5 w-3.5" />
              )

            return (
              <button
                key={hotspot.id}
                onClick={() => selectHotspot(hotspot.id)}
                className={`w-full flex items-center gap-2.5 rounded-lg p-2.5 text-left transition-colors ${
                  hotspot.id === selectedHotspotId
                    ? 'bg-primary/10 border border-primary/30'
                    : 'hover:bg-secondary border border-transparent'
                }`}
              >
                <div
                  className="h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${hotspot.color || '#3b82f6'}20`, color: hotspot.color || '#3b82f6' }}
                >
                  {typeIcon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{hotspot.title}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{hotspot.type.replace('-', ' ')}</p>
                </div>
              </button>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
