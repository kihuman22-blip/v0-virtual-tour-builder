"use client"

import { X, ArrowRight, Info, ImageIcon, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Hotspot } from '@/lib/tour-types'

interface HotspotPopupProps {
  hotspot: Hotspot
  onClose: () => void
  onNavigate?: (sceneId: string) => void
}

export default function HotspotPopup({ hotspot, onClose, onNavigate }: HotspotPopupProps) {
  const getIcon = () => {
    switch (hotspot.type) {
      case 'scene-link':
        return <ArrowRight className="h-4 w-4" />
      case 'info':
        return <Info className="h-4 w-4" />
      case 'image':
        return <ImageIcon className="h-4 w-4" />
      case 'content':
        return <FileText className="h-4 w-4" />
      default:
        return <Info className="h-4 w-4" />
    }
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
      <div className="bg-card/95 backdrop-blur-xl border border-border rounded-xl shadow-2xl max-w-md w-full mx-4 pointer-events-auto animate-in fade-in-0 zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${hotspot.color || '#3b82f6'}20`, color: hotspot.color || '#3b82f6' }}
            >
              {getIcon()}
            </div>
            <h3 className="font-semibold text-card-foreground">{hotspot.title}</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-muted-foreground hover:text-card-foreground">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4">
          {hotspot.type === 'info' && hotspot.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{hotspot.description}</p>
          )}

          {hotspot.type === 'image' && hotspot.imageUrl && (
            <div className="space-y-3">
              <img
                src={hotspot.imageUrl}
                alt={hotspot.title}
                className="w-full rounded-lg object-cover max-h-64"
                crossOrigin="anonymous"
              />
              {hotspot.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">{hotspot.description}</p>
              )}
            </div>
          )}

          {hotspot.type === 'content' && (
            <div className="prose prose-sm prose-invert max-w-none">
              <div
                className="text-sm text-muted-foreground leading-relaxed"
                dangerouslySetInnerHTML={{ __html: hotspot.content || hotspot.description || '' }}
              />
            </div>
          )}

          {hotspot.type === 'scene-link' && (
            <div className="space-y-3">
              {hotspot.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">{hotspot.description}</p>
              )}
              <Button
                onClick={() => hotspot.targetSceneId && onNavigate?.(hotspot.targetSceneId)}
                className="w-full"
                style={{ backgroundColor: hotspot.color || '#3b82f6' }}
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                Navigate to scene
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
