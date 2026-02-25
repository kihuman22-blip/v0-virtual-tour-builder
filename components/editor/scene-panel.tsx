"use client"

import { useState, useRef } from 'react'
import {
  Plus,
  Trash2,
  GripVertical,
  Image as ImageIcon,
  Star,
  Upload,
  MoreHorizontal,
  Eye,
  Pencil,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import type { Tour, Scene } from '@/lib/tour-types'
import {
  useTour,
  useCurrentSceneId,
  setCurrentScene,
  addScene,
  removeScene,
  updateScene,
  setStartScene,
} from '@/lib/tour-store'
import { SAMPLE_PANORAMAS } from '@/lib/tour-types'

export default function ScenePanel() {
  const tour = useTour()
  const currentSceneId = useCurrentSceneId()
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null)
  const [sceneName, setSceneName] = useState('')
  const [sceneUrl, setSceneUrl] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!tour) return null

  const handleAddScene = () => {
    if (sceneName && sceneUrl) {
      addScene(sceneName, sceneUrl)
      setSceneName('')
      setSceneUrl('')
      setShowAddDialog(false)
    }
  }

  const handleAddSample = (sample: { name: string; url: string }) => {
    addScene(sample.name, sample.url)
    setShowAddDialog(false)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const url = URL.createObjectURL(file)
      setSceneUrl(url)
      if (!sceneName) setSceneName(file.name.replace(/\.[^/.]+$/, ''))
    }
  }

  const handleRenameScene = (sceneId: string, newName: string) => {
    updateScene(sceneId, { name: newName })
    setEditingSceneId(null)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Scenes</h3>
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setShowAddDialog(true)}>
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {tour.scenes.length === 0 && (
            <div className="text-center py-8 px-4">
              <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground mb-1">No scenes yet</p>
              <p className="text-xs text-muted-foreground/70 mb-3">Add panorama images to start building your tour</p>
              <Button size="sm" variant="outline" className="text-xs" onClick={() => setShowAddDialog(true)}>
                <Plus className="h-3 w-3 mr-1" />
                Add Scene
              </Button>
            </div>
          )}
          {tour.scenes.map((scene, index) => (
            <div
              key={scene.id}
              role="button"
              tabIndex={0}
              onClick={() => setCurrentScene(scene.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCurrentScene(scene.id) } }}
              className={`w-full group flex items-start gap-2 rounded-lg p-2 text-left transition-colors cursor-pointer ${
                scene.id === currentSceneId
                  ? 'bg-primary/10 border border-primary/30'
                  : 'hover:bg-secondary border border-transparent'
              }`}
            >
              <div className="w-16 h-10 rounded-md overflow-hidden bg-muted flex-shrink-0">
                <img
                  src={scene.imageUrl}
                  alt={scene.name}
                  className="w-full h-full object-cover"
                  crossOrigin="anonymous"
                />
              </div>
              <div className="flex-1 min-w-0">
                {editingSceneId === scene.id ? (
                  <Input
                    value={scene.name}
                    onChange={(e) => updateScene(scene.id, { name: e.target.value })}
                    onBlur={() => setEditingSceneId(null)}
                    onKeyDown={(e) => e.key === 'Enter' && setEditingSceneId(null)}
                    className="h-6 text-xs px-1"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <p className="text-xs font-medium text-foreground truncate">{scene.name}</p>
                )}
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {scene.hotspots.length} hotspot{scene.hotspots.length !== 1 ? 's' : ''}
                  {scene.id === tour.startSceneId && (
                    <span className="ml-1.5 text-primary">
                      <Star className="h-2.5 w-2.5 inline" /> Start
                    </span>
                  )}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => setEditingSceneId(scene.id)}>
                    <Pencil className="h-3.5 w-3.5 mr-2" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStartScene(scene.id)}>
                    <Star className="h-3.5 w-3.5 mr-2" />
                    Set as start
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => removeScene(scene.id)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Add Scene Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-card-foreground">Add Scene</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Add a 360-degree panorama image as a new scene in your tour.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-card-foreground">Scene Name</Label>
              <Input
                value={sceneName}
                onChange={(e) => setSceneName(e.target.value)}
                placeholder="e.g., Living Room"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label className="text-card-foreground">Image URL</Label>
              <div className="flex gap-2 mt-1.5">
                <Input
                  value={sceneUrl}
                  onChange={(e) => setSceneUrl(e.target.value)}
                  placeholder="https://example.com/panorama.jpg"
                  className="flex-1"
                />
                <Button variant="outline" size="icon" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4" />
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>

            <div>
              <Label className="text-muted-foreground text-xs">Or use a sample panorama</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {SAMPLE_PANORAMAS.slice(0, 4).map((sample) => (
                  <button
                    key={sample.name}
                    onClick={() => handleAddSample(sample)}
                    className="group rounded-lg overflow-hidden border border-border hover:border-primary/50 transition-colors"
                  >
                    <div className="h-16 bg-muted relative">
                      <img
                        src={sample.url}
                        alt={sample.name}
                        className="w-full h-full object-cover"
                        crossOrigin="anonymous"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                      <span className="absolute bottom-1 left-2 text-[10px] font-medium text-foreground">
                        {sample.name}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddScene} disabled={!sceneName || !sceneUrl}>
              Add Scene
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
