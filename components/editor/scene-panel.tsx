"use client"

import { useState, useRef, useCallback } from 'react'
import {
  Plus,
  Trash2,
  Image as ImageIcon,
  Star,
  Upload,
  MoreHorizontal,
  Pencil,
  X,
  FolderOpen,
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
import { SAMPLE_PANORAMAS } from '@/lib/tour-types'
import {
  useTour,
  useCurrentSceneId,
  setCurrentScene,
  addScene,
  removeScene,
  updateScene,
  setStartScene,
} from '@/lib/tour-store'

export default function ScenePanel() {
  const tour = useTour()
  const currentSceneId = useCurrentSceneId()
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null)
  const [sceneName, setSceneName] = useState('')
  const [sceneUrl, setSceneUrl] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [uploadTab, setUploadTab] = useState<'upload' | 'url' | 'samples'>('upload')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropFileInputRef = useRef<HTMLInputElement>(null)

  if (!tour) return null

  const resetDialog = () => {
    setSceneName('')
    setSceneUrl('')
    setPreviewUrl('')
    setUploadTab('upload')
  }

  const openAddDialog = () => {
    resetDialog()
    setShowAddDialog(true)
  }

  const handleAddScene = () => {
    if (sceneName && sceneUrl) {
      addScene(sceneName, sceneUrl)
      resetDialog()
      setShowAddDialog(false)
    }
  }

  const handleAddSample = (sample: { name: string; url: string }) => {
    addScene(sample.name, sample.url)
    resetDialog()
    setShowAddDialog(false)
  }

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) return
    const url = URL.createObjectURL(file)
    setSceneUrl(url)
    setPreviewUrl(url)
    if (!sceneName) {
      setSceneName(file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '))
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const handleMultiFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    if (files.length === 1) {
      processFile(files[0])
      return
    }

    // Multiple files: add each one directly as a scene
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return
      const url = URL.createObjectURL(file)
      const name = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
      addScene(name, url)
    })
    resetDialog()
    setShowAddDialog(false)
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)

      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith('image/')
      )

      if (files.length === 0) return

      if (files.length === 1 && showAddDialog) {
        processFile(files[0])
        return
      }

      // Multiple files or dropping outside dialog: add all as scenes
      files.forEach((file) => {
        const url = URL.createObjectURL(file)
        const name = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
        addScene(name, url)
      })
      if (showAddDialog) {
        resetDialog()
        setShowAddDialog(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showAddDialog, sceneName]
  )

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }

  return (
    <div
      className="flex flex-col h-full"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Scenes</h3>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs gap-1"
          onClick={openAddDialog}
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>

      {/* Drag overlay for the whole panel */}
      {dragOver && (
        <div className="absolute inset-0 z-30 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center backdrop-blur-sm">
          <div className="text-center">
            <Upload className="h-8 w-8 text-primary mx-auto mb-2" />
            <p className="text-sm font-medium text-primary">Drop images here</p>
            <p className="text-xs text-muted-foreground mt-1">
              They will be added as scenes
            </p>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {/* Empty state with prominent upload action */}
          {tour.scenes.length === 0 && (
            <div className="text-center py-6 px-4">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <ImageIcon className="h-8 w-8 text-primary/60" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">
                No scenes yet
              </p>
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                Upload your 360 panorama images to start building your virtual tour.
              </p>
              <div className="flex flex-col gap-2">
                <Button
                  size="sm"
                  className="w-full text-xs gap-1.5"
                  onClick={openAddDialog}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload Images
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs gap-1.5"
                  onClick={() => {
                    setUploadTab('samples')
                    setShowAddDialog(true)
                  }}
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  Use Sample Panoramas
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground/60 mt-3">
                or drag and drop images here
              </p>
            </div>
          )}

          {/* Scene list */}
          {tour.scenes.map((scene) => (
            <div
              key={scene.id}
              role="button"
              tabIndex={0}
              onClick={() => setCurrentScene(scene.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setCurrentScene(scene.id)
                }
              }}
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
                    onKeyDown={(e) =>
                      e.key === 'Enter' && setEditingSceneId(null)
                    }
                    className="h-6 text-xs px-1"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <p className="text-xs font-medium text-foreground truncate">
                    {scene.name}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {scene.hotspots.length} hotspot
                  {scene.hotspots.length !== 1 ? 's' : ''}
                  {scene.id === tour.startSceneId && (
                    <span className="ml-1.5 text-primary">
                      <Star className="h-2.5 w-2.5 inline" /> Start
                    </span>
                  )}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger
                  asChild
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem
                    onClick={() => setEditingSceneId(scene.id)}
                  >
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
      <Dialog
        open={showAddDialog}
        onOpenChange={(open) => {
          setShowAddDialog(open)
          if (!open) resetDialog()
        }}
      >
        <DialogContent className="sm:max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-card-foreground">
              Add Scene
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Upload a 360-degree panorama image or pick a sample to get
              started.
            </DialogDescription>
          </DialogHeader>

          {/* Tab-style switcher */}
          <div className="flex gap-1 bg-secondary/50 rounded-lg p-1">
            {(
              [
                { key: 'upload', label: 'Upload' },
                { key: 'url', label: 'From URL' },
                { key: 'samples', label: 'Samples' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setUploadTab(tab.key)}
                className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
                  uploadTab === tab.key
                    ? 'bg-card text-card-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Upload tab */}
          {uploadTab === 'upload' && (
            <div className="space-y-4">
              <div
                onClick={() => dropFileInputRef.current?.click()}
                onDrop={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  const file = e.dataTransfer.files[0]
                  if (file) processFile(file)
                }}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
              >
                {previewUrl ? (
                  <div className="space-y-3">
                    <div className="w-full h-32 rounded-lg overflow-hidden bg-muted">
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Click to choose a different image
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                      <Upload className="h-5 w-5 text-primary" />
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Supports JPG, PNG, WebP -- equirectangular 360 images
                      work best
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-2">
                      You can also select multiple images at once
                    </p>
                  </>
                )}
              </div>
              <input
                ref={dropFileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleMultiFileUpload}
              />

              {previewUrl && (
                <div>
                  <Label className="text-card-foreground">Scene Name</Label>
                  <Input
                    value={sceneName}
                    onChange={(e) => setSceneName(e.target.value)}
                    placeholder="e.g., Living Room"
                    className="mt-1.5"
                    autoFocus
                  />
                </div>
              )}

              {previewUrl && (
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setPreviewUrl('')
                      setSceneUrl('')
                      setSceneName('')
                    }}
                  >
                    Clear
                  </Button>
                  <Button
                    onClick={handleAddScene}
                    disabled={!sceneName || !sceneUrl}
                  >
                    Add Scene
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* URL tab */}
          {uploadTab === 'url' && (
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
                <Input
                  value={sceneUrl}
                  onChange={(e) => {
                    setSceneUrl(e.target.value)
                    setPreviewUrl(e.target.value)
                  }}
                  placeholder="https://example.com/panorama.jpg"
                  className="mt-1.5"
                />
              </div>
              {previewUrl && sceneUrl.startsWith('http') && (
                <div className="w-full h-28 rounded-lg overflow-hidden bg-muted">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    crossOrigin="anonymous"
                    onError={() => setPreviewUrl('')}
                  />
                </div>
              )}
              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => setShowAddDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddScene}
                  disabled={!sceneName || !sceneUrl}
                >
                  Add Scene
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Samples tab */}
          {uploadTab === 'samples' && (
            <div>
              <p className="text-xs text-muted-foreground mb-3">
                Click a sample to instantly add it as a scene.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {SAMPLE_PANORAMAS.map((sample) => (
                  <button
                    key={sample.name}
                    onClick={() => handleAddSample(sample)}
                    className="group rounded-lg overflow-hidden border border-border hover:border-primary/50 transition-colors text-left"
                  >
                    <div className="h-20 bg-muted relative">
                      <img
                        src={sample.url}
                        alt={sample.name}
                        className="w-full h-full object-cover"
                        crossOrigin="anonymous"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                      <span className="absolute bottom-1.5 left-2 text-[11px] font-medium text-foreground">
                        {sample.name}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
