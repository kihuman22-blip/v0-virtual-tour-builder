"use client"

import { X, ArrowRight, Info, ImageIcon, FileText, Eye, Link as LinkIcon } from 'lucide-react'
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

  const accentColor = hotspot.color || '#4db8a4'

  return (
    <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
      <div className="pointer-events-auto bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.05)] max-w-sm w-full mx-4 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200">
        {/* Image -- full bleed at top */}
        {hotspot.type === 'image' && hotspot.imageUrl && (
          <div className="w-full max-h-56 overflow-hidden">
            <img
              src={hotspot.imageUrl}
              alt={hotspot.title}
              className="w-full h-full object-cover"
              crossOrigin="anonymous"
            />
          </div>
        )}

        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
              >
                {getIcon()}
              </div>
              <h3 className="font-semibold text-gray-900 text-sm leading-tight">{hotspot.title}</h3>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Description */}
          {hotspot.description && (
            <p className="text-sm text-gray-500 leading-relaxed">{hotspot.description}</p>
          )}

          {/* Content type */}
          {hotspot.type === 'content' && hotspot.content && (
            <div
              className="text-sm text-gray-500 leading-relaxed mt-2 prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: hotspot.content }}
            />
          )}

          {/* Navigate button for scene links */}
          {hotspot.type === 'scene-link' && hotspot.targetSceneId && (
            <Button
              onClick={() => onNavigate?.(hotspot.targetSceneId!)}
              className="w-full mt-3 text-white text-sm"
              style={{ backgroundColor: accentColor }}
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
