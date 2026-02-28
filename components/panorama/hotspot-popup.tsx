"use client"

import { X, ArrowRight, Info, ImageIcon, FileText, Eye, Link as LinkIcon, Share2, Maximize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Hotspot } from '@/lib/tour-types'

interface HotspotPopupProps {
  hotspot: Hotspot
  onClose: () => void
  onNavigate?: (sceneId: string) => void
}

export default function HotspotPopup({ hotspot, onClose, onNavigate }: HotspotPopupProps) {
  const getIcon = () => {
    switch (hotspot.icon) {
      case 'eye':
        return <Eye className="h-4 w-4" />
      case 'link':
        return <LinkIcon className="h-4 w-4" />
      default:
        switch (hotspot.type) {
          case 'scene-link':
            return <ArrowRight className="h-4 w-4" />
          case 'image':
            return <ImageIcon className="h-4 w-4" />
          case 'content':
            return <FileText className="h-4 w-4" />
          default:
            return <Info className="h-4 w-4" />
        }
    }
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
      <div className="pointer-events-auto bg-[#1a1a1a] rounded-xl shadow-[0_8px_50px_rgba(0,0,0,0.5)] max-w-sm w-full mx-4 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200">
        {/* Top action buttons */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
          <button
            className="h-8 w-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-black/60 transition-colors"
          >
            <Share2 className="h-4 w-4" />
          </button>
          <button
            className="h-8 w-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-black/60 transition-colors"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-black/60 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Image -- full bleed at top */}
        {hotspot.type === 'image' && hotspot.imageUrl && (
          <div className="w-full aspect-[4/5] max-h-80 overflow-hidden bg-black">
            <img
              src={hotspot.imageUrl}
              alt={hotspot.title}
              className="w-full h-full object-contain"
              crossOrigin="anonymous"
            />
          </div>
        )}

        {/* Content */}
        <div className="p-4">
          {/* Title */}
          <h3 className="font-medium text-white text-sm leading-tight">{hotspot.title}</h3>

          {/* Description */}
          {hotspot.description && (
            <p className="text-sm text-white/60 leading-relaxed mt-2">{hotspot.description}</p>
          )}

          {/* Content type */}
          {hotspot.type === 'content' && hotspot.content && (
            <div
              className="text-sm text-white/60 leading-relaxed mt-2 prose prose-sm prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: hotspot.content }}
            />
          )}

          {/* Navigate button for scene links */}
          {hotspot.type === 'scene-link' && hotspot.targetSceneId && (
            <Button
              onClick={() => onNavigate?.(hotspot.targetSceneId!)}
              className="w-full mt-4 bg-white text-black hover:bg-white/90 text-sm font-medium"
            >
              <ArrowRight className="h-4 w-4 mr-2" />
              Navigate
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
