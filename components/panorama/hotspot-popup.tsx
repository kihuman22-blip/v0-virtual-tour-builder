"use client"

import { useState, useEffect, useRef } from 'react'
import { X, ArrowRight, Info, ImageIcon, FileText, Eye, Link as LinkIcon, Share2, Maximize2, ExternalLink, Utensils, BookOpen, ChefHat, Wine, Coffee, Star, Heart, MapPin, Phone, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Hotspot } from '@/lib/tour-types'

interface HotspotPopupProps {
  hotspot: Hotspot
  onClose: () => void
  onNavigate?: (sceneId: string) => void
}

export default function HotspotPopup({ hotspot, onClose, onNavigate }: HotspotPopupProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => setIsVisible(true))
  }, [])

  const handleClose = () => {
    setIsClosing(true)
    setTimeout(onClose, 200)
  }

  const getIcon = () => {
    const iconClass = "h-4 w-4"
    switch (hotspot.icon) {
      case 'eye': return <Eye className={iconClass} />
      case 'link': return <LinkIcon className={iconClass} />
      case 'utensils': return <Utensils className={iconClass} />
      case 'menu': return <BookOpen className={iconClass} />
      case 'chef': return <ChefHat className={iconClass} />
      case 'wine': return <Wine className={iconClass} />
      case 'coffee': return <Coffee className={iconClass} />
      case 'star': return <Star className={iconClass} />
      case 'heart': return <Heart className={iconClass} />
      case 'map-pin': return <MapPin className={iconClass} />
      case 'phone': return <Phone className={iconClass} />
      case 'clock': return <Clock className={iconClass} />
      default:
        switch (hotspot.type) {
          case 'scene-link': return <ArrowRight className={iconClass} />
          case 'image': return <ImageIcon className={iconClass} />
          case 'content': return <FileText className={iconClass} />
          default: return <Info className={iconClass} />
        }
    }
  }

  const accentColor = hotspot.color || '#f59e0b'

  return (
    <div 
      className={`absolute inset-0 flex items-center justify-center z-30 transition-all duration-200 ${
        isVisible && !isClosing ? 'bg-black/20 backdrop-blur-[2px]' : 'bg-transparent'
      }`}
      onClick={handleClose}
    >
      <div 
        ref={contentRef}
        onClick={(e) => e.stopPropagation()}
        className={`
          relative bg-white rounded-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25),0_0_0_1px_rgba(0,0,0,0.05)]
          max-w-md w-[calc(100%-2rem)] mx-4 overflow-hidden
          transition-all duration-300 ease-out
          ${isVisible && !isClosing 
            ? 'opacity-100 scale-100 translate-y-0' 
            : 'opacity-0 scale-95 translate-y-4'
          }
        `}
        style={{ maxHeight: '85vh' }}
      >
        {/* Header with icon badge and close button */}
        <div className="flex items-start justify-between p-4 pb-0">
          <div className="flex items-center gap-3">
            {/* Icon badge */}
            <div 
              className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
              style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
            >
              {getIcon()}
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 text-base leading-tight truncate">
                {hotspot.title}
              </h3>
              <span className="text-xs text-gray-400 capitalize">
                {hotspot.type === 'scene-link' ? 'Navigation' : hotspot.type}
              </span>
            </div>
          </div>
          
          {/* Action buttons */}
          <div className="flex items-center gap-1 -mt-0.5 -mr-1">
            <button
              className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title="Share"
            >
              <Share2 className="h-4 w-4" />
            </button>
            <button
              onClick={handleClose}
              className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable content area */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(85vh - 80px)' }}>
          {/* Image section -- full width with elegant styling */}
          {hotspot.type === 'image' && hotspot.imageUrl && (
            <div className="px-4 pt-4">
              <div className="rounded-xl overflow-hidden bg-gray-100 shadow-inner">
                <img
                  src={hotspot.imageUrl}
                  alt={hotspot.title}
                  className="w-full h-auto max-h-72 object-contain"
                  crossOrigin="anonymous"
                />
              </div>
            </div>
          )}

          {/* Description / Content */}
          <div className="p-4 space-y-3">
            {hotspot.description && (
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                {hotspot.description}
              </p>
            )}

            {hotspot.type === 'content' && hotspot.content && (
              <div
                className="text-sm text-gray-600 leading-relaxed prose prose-sm prose-gray max-w-none
                  prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
                  prose-strong:text-gray-900 prose-headings:text-gray-900"
                dangerouslySetInnerHTML={{ __html: hotspot.content }}
              />
            )}

            {/* Link preview if URL in description */}
            {hotspot.description?.includes('http') && (
              <a 
                href={hotspot.description.match(/https?:\/\/[^\s)]+/)?.[0] || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 transition-colors mt-2"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Link öffnen</span>
              </a>
            )}
          </div>

          {/* Navigate button for scene links */}
          {hotspot.type === 'scene-link' && hotspot.targetSceneId && (
            <div className="px-4 pb-4">
              <Button
                onClick={() => onNavigate?.(hotspot.targetSceneId!)}
                className="w-full h-11 rounded-xl font-medium text-sm shadow-sm transition-all duration-200 hover:shadow-md"
                style={{ 
                  backgroundColor: accentColor,
                  color: 'white'
                }}
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                Zur Szene navigieren
              </Button>
            </div>
          )}
        </div>

        {/* Subtle bottom accent line */}
        <div 
          className="h-1 w-full"
          style={{ backgroundColor: accentColor }}
        />
      </div>
    </div>
  )
}
