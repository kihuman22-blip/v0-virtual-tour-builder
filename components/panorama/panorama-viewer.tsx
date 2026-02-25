"use client"

import { useEffect, useRef, useCallback, useState } from 'react'
import * as THREE from 'three'
import type { Scene, Hotspot, HotspotPosition } from '@/lib/tour-types'
import { yawPitchToVector3, vector3ToYawPitch } from '@/lib/tour-types'

interface PanoramaViewerProps {
  scene: Scene
  fov?: number
  autoRotate?: boolean
  autoRotateSpeed?: number
  onHotspotClick?: (hotspot: Hotspot) => void
  onHotspotMoved?: (hotspotId: string, newPosition: HotspotPosition) => void
  onSceneClick?: (position: HotspotPosition) => void
  onViewChange?: (yaw: number, pitch: number) => void
  onDropScene?: (sceneId: string, position: HotspotPosition) => void
  isEditorMode?: boolean
  selectedHotspotId?: string | null
  className?: string
  allScenes?: Scene[]
}

export default function PanoramaViewer({
  scene,
  fov = 75,
  autoRotate = false,
  autoRotateSpeed = 0.5,
  onHotspotClick,
  onHotspotMoved,
  onSceneClick,
  onDropScene,
  isEditorMode = false,
  selectedHotspotId,
  className = '',
  allScenes,
}: PanoramaViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const threeSceneRef = useRef<THREE.Scene | null>(null)
  const sphereRef = useRef<THREE.Mesh | null>(null)
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2())
  const isDraggingRef = useRef(false)
  const previousMouseRef = useRef({ x: 0, y: 0 })
  const rotationRef = useRef({ yaw: scene.initialViewDirection.yaw, pitch: scene.initialViewDirection.pitch })
  const targetRotationRef = useRef({ yaw: scene.initialViewDirection.yaw, pitch: scene.initialViewDirection.pitch })
  const frameIdRef = useRef<number>(0)
  const currentTextureRef = useRef<THREE.Texture | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDragOverViewer, setIsDragOverViewer] = useState(false)
  const [hotspotScreenPositions, setHotspotScreenPositions] = useState<Map<string, { x: number; y: number; visible: boolean; scale: number }>>(new Map())

  // For hotspot dragging
  const [draggingHotspotId, setDraggingHotspotId] = useState<string | null>(null)
  const hotspotDragStartRef = useRef<{ x: number; y: number } | null>(null)
  const hotspotDidMoveRef = useRef(false)

  // Initialize Three.js
  useEffect(() => {
    const container = canvasContainerRef.current
    if (!container) return

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const camera = new THREE.PerspectiveCamera(fov, container.clientWidth / container.clientHeight, 1, 1100)
    cameraRef.current = camera

    const threeScene = new THREE.Scene()
    threeSceneRef.current = threeScene

    const geometry = new THREE.SphereGeometry(500, 128, 80)
    geometry.scale(-1, 1, 1)
    const material = new THREE.MeshBasicMaterial({ color: 0x111111 })
    const sphere = new THREE.Mesh(geometry, material)
    threeScene.add(sphere)
    sphereRef.current = sphere

    return () => {
      cancelAnimationFrame(frameIdRef.current)
      renderer.dispose()
      geometry.dispose()
      material.dispose()
      if (currentTextureRef.current) currentTextureRef.current.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load panorama texture
  useEffect(() => {
    if (!sphereRef.current || !scene.imageUrl) return
    setIsLoading(true)

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const texture = new THREE.Texture(img)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.minFilter = THREE.LinearFilter
      texture.magFilter = THREE.LinearFilter
      texture.generateMipmaps = false
      const renderer = rendererRef.current
      if (renderer) {
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
      }
      texture.needsUpdate = true

      if (currentTextureRef.current) currentTextureRef.current.dispose()
      currentTextureRef.current = texture

      const material = new THREE.MeshBasicMaterial({ map: texture })
      if (sphereRef.current) {
        const oldMaterial = sphereRef.current.material as THREE.MeshBasicMaterial
        sphereRef.current.material = material
        oldMaterial.dispose()
      }
      setIsLoading(false)
    }
    img.onerror = () => setIsLoading(false)
    img.src = scene.imageUrl
  }, [scene.imageUrl])

  // Update FOV
  useEffect(() => {
    if (cameraRef.current) {
      cameraRef.current.fov = fov
      cameraRef.current.updateProjectionMatrix()
    }
  }, [fov])

  // Animation loop
  useEffect(() => {
    const renderer = rendererRef.current
    const camera = cameraRef.current
    const threeScene = threeSceneRef.current
    const container = canvasContainerRef.current
    if (!renderer || !camera || !threeScene || !container) return

    let lastTime = performance.now()

    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate)
      const now = performance.now()
      const delta = (now - lastTime) / 1000
      lastTime = now

      if (!isDraggingRef.current && autoRotate) {
        targetRotationRef.current.yaw += autoRotateSpeed * delta * 10
      }

      const lerpFactor = Math.min(1, delta * 8)
      rotationRef.current.yaw += (targetRotationRef.current.yaw - rotationRef.current.yaw) * lerpFactor
      rotationRef.current.pitch += (targetRotationRef.current.pitch - rotationRef.current.pitch) * lerpFactor
      rotationRef.current.pitch = Math.max(-85, Math.min(85, rotationRef.current.pitch))
      targetRotationRef.current.pitch = Math.max(-85, Math.min(85, targetRotationRef.current.pitch))

      const yawRad = THREE.MathUtils.degToRad(rotationRef.current.yaw)
      const pitchRad = THREE.MathUtils.degToRad(rotationRef.current.pitch)

      const lookAt = new THREE.Vector3(
        Math.cos(pitchRad) * Math.sin(yawRad),
        Math.sin(pitchRad),
        Math.cos(pitchRad) * Math.cos(yawRad)
      ).multiplyScalar(100)

      camera.lookAt(lookAt)
      renderer.render(threeScene, camera)

      // Project hotspot positions to screen
      const width = container.clientWidth
      const height = container.clientHeight
      const newPositions = new Map<string, { x: number; y: number; visible: boolean; scale: number }>()

      scene.hotspots.forEach((hotspot) => {
        const pos3d = yawPitchToVector3(hotspot.position.yaw, hotspot.position.pitch, 480)
        const vec = new THREE.Vector3(pos3d.x, pos3d.y, pos3d.z)
        vec.project(camera)

        const x = (vec.x * 0.5 + 0.5) * width
        const y = (-vec.y * 0.5 + 0.5) * height
        const visible = vec.z < 1

        const scale = Math.max(0.5, Math.min(1.3, 1.0 / Math.max(0.5, Math.abs(vec.z))))
        newPositions.set(hotspot.id, { x, y, visible, scale })
      })

      setHotspotScreenPositions(newPositions)
    }

    animate()
    return () => cancelAnimationFrame(frameIdRef.current)
  }, [autoRotate, autoRotateSpeed, scene.hotspots])

  // Handle resize
  useEffect(() => {
    const container = canvasContainerRef.current
    const renderer = rendererRef.current
    const camera = cameraRef.current
    if (!container || !renderer || !camera) return

    const handleResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(container.clientWidth, container.clientHeight)
    }

    const observer = new ResizeObserver(handleResize)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // Raycast: screen coords -> yaw/pitch
  const screenToYawPitch = useCallback(
    (clientX: number, clientY: number): HotspotPosition | null => {
      const container = canvasContainerRef.current
      const camera = cameraRef.current
      const sphere = sphereRef.current
      if (!container || !camera || !sphere) return null

      const rect = container.getBoundingClientRect()
      const mouse = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      )
      const rc = new THREE.Raycaster()
      rc.setFromCamera(mouse, camera)
      const hits = rc.intersectObject(sphere)
      if (hits.length > 0) {
        const point = hits[0].point
        const pos = vector3ToYawPitch(point.x, point.y, point.z)
        return { yaw: -pos.yaw, pitch: pos.pitch }
      }
      return null
    },
    []
  )

  // Canvas pointer events (pan to look around)
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    isDraggingRef.current = false
    previousMouseRef.current = { x: e.clientX, y: e.clientY }
    canvasContainerRef.current?.setPointerCapture(e.pointerId)
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const dx = e.clientX - previousMouseRef.current.x
    const dy = e.clientY - previousMouseRef.current.y

    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      isDraggingRef.current = true
    }

    if (e.buttons > 0) {
      targetRotationRef.current.yaw += dx * 0.2
      targetRotationRef.current.pitch += dy * 0.2
      targetRotationRef.current.pitch = Math.max(-85, Math.min(85, targetRotationRef.current.pitch))
    }

    previousMouseRef.current = { x: e.clientX, y: e.clientY }

    const container = canvasContainerRef.current
    if (container) {
      const rect = container.getBoundingClientRect()
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    }
  }, [])

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      canvasContainerRef.current?.releasePointerCapture(e.pointerId)
      if (isDraggingRef.current) {
        isDraggingRef.current = false
        return
      }
      if (isEditorMode && onSceneClick) {
        const pos = screenToYawPitch(e.clientX, e.clientY)
        if (pos) onSceneClick(pos)
      }
    },
    [isEditorMode, onSceneClick, screenToYawPitch]
  )

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const camera = cameraRef.current
    if (!camera) return
    camera.fov = Math.max(30, Math.min(100, camera.fov + e.deltaY * 0.05))
    camera.updateProjectionMatrix()
  }, [])

  // Drag-and-drop scene linking
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-scene-id')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'link'
      setIsDragOverViewer(true)
    }
  }, [])

  const handleDragLeave = useCallback(() => setIsDragOverViewer(false), [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOverViewer(false)
      const sceneId = e.dataTransfer.getData('application/x-scene-id')
      if (!sceneId || !onDropScene) return
      const pos = screenToYawPitch(e.clientX, e.clientY)
      if (pos) onDropScene(sceneId, pos)
    },
    [onDropScene, screenToYawPitch]
  )

  // Hotspot click
  const handleHotspotElementClick = useCallback(
    (e: React.MouseEvent, hotspot: Hotspot) => {
      e.stopPropagation()
      e.preventDefault()
      if (onHotspotClick) onHotspotClick(hotspot)
    },
    [onHotspotClick]
  )

  // Hotspot dragging to reposition
  const handleHotspotPointerDown = useCallback(
    (e: React.PointerEvent, hotspotId: string) => {
      // Only allow repositioning in editor (not viewer)
      if (!onHotspotMoved) return
      e.stopPropagation()
      e.preventDefault()
      hotspotDragStartRef.current = { x: e.clientX, y: e.clientY }
      hotspotDidMoveRef.current = false
      setDraggingHotspotId(hotspotId)
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [onHotspotMoved]
  )

  const handleHotspotPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingHotspotId || !hotspotDragStartRef.current) return
      e.stopPropagation()
      e.preventDefault()
      const dx = e.clientX - hotspotDragStartRef.current.x
      const dy = e.clientY - hotspotDragStartRef.current.y
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        hotspotDidMoveRef.current = true
      }
      if (hotspotDidMoveRef.current && onHotspotMoved) {
        const pos = screenToYawPitch(e.clientX, e.clientY)
        if (pos) {
          onHotspotMoved(draggingHotspotId, pos)
        }
      }
    },
    [draggingHotspotId, onHotspotMoved, screenToYawPitch]
  )

  const handleHotspotPointerUp = useCallback(
    (e: React.PointerEvent, hotspot: Hotspot) => {
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
      if (!hotspotDidMoveRef.current && onHotspotClick) {
        // Was a click, not a drag
        onHotspotClick(hotspot)
      }
      setDraggingHotspotId(null)
      hotspotDragStartRef.current = null
      hotspotDidMoveRef.current = false
    },
    [onHotspotClick]
  )

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden select-none ${className}`}
      style={{ touchAction: 'none' }}
    >
      {/* Three.js canvas */}
      <div
        ref={canvasContainerRef}
        className="absolute inset-0"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{ cursor: isEditorMode ? 'crosshair' : 'grab' }}
      />

      {/* HTML overlay for hotspots */}
      <div className="absolute inset-0 pointer-events-none z-10">
        {scene.hotspots.map((hotspot) => {
          const screenPos = hotspotScreenPositions.get(hotspot.id)
          if (!screenPos || !screenPos.visible) return null

          const isSelected = hotspot.id === selectedHotspotId
          const isDragging = hotspot.id === draggingHotspotId
          const targetScene = allScenes?.find((s) => s.id === hotspot.targetSceneId)
          const canDrag = !!onHotspotMoved

          if (hotspot.type === 'scene-link') {
            const arrowColor = hotspot.color || '#8B2020'
            // Floor arrow: white circle with thick colored border and chevron inside (like reference image)
            return (
              <div
                key={hotspot.id}
                className="absolute pointer-events-auto"
                style={{
                  left: screenPos.x,
                  top: screenPos.y,
                  transform: `translate(-50%, -50%) scale(${screenPos.scale})`,
                  zIndex: isDragging ? 50 : isSelected ? 20 : 10,
                }}
              >
                <div
                  className={`group relative flex flex-col items-center ${canDrag ? 'cursor-grab' : 'cursor-pointer'} ${isDragging ? 'cursor-grabbing' : ''}`}
                  onPointerDown={(e) => canDrag ? handleHotspotPointerDown(e, hotspot.id) : undefined}
                  onPointerMove={handleHotspotPointerMove}
                  onPointerUp={(e) => handleHotspotPointerUp(e, hotspot)}
                  onClick={(e) => !canDrag ? handleHotspotElementClick(e, hotspot) : undefined}
                  role="button"
                  tabIndex={0}
                  aria-label={hotspot.title || 'Navigation arrow'}
                >
                  {/* Outer glow ring */}
                  <div
                    className="absolute rounded-full opacity-30 animate-ping"
                    style={{
                      width: 72,
                      height: 72,
                      top: -4,
                      left: '50%',
                      marginLeft: -36,
                      borderWidth: 2,
                      borderStyle: 'solid',
                      borderColor: arrowColor,
                      animationDuration: '2.5s',
                    }}
                  />
                  {/* Main arrow circle: white bg with thick colored border */}
                  <div
                    className={`
                      relative flex items-center justify-center rounded-full
                      transition-transform duration-150
                      ${isSelected ? 'scale-110' : 'group-hover:scale-110'}
                    `}
                    style={{
                      width: 64,
                      height: 64,
                      background: 'rgba(255,255,255,0.95)',
                      border: `5px solid ${arrowColor}`,
                      boxShadow: `0 4px 20px rgba(0,0,0,0.4), 0 0 0 2px rgba(255,255,255,0.2)`,
                    }}
                  >
                    {/* Chevron arrow pointing upward */}
                    <svg
                      width="32"
                      height="32"
                      viewBox="0 0 24 24"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path
                        d="M6 15l6-6 6 6"
                        stroke={arrowColor}
                        strokeWidth="3"
                      />
                    </svg>
                  </div>

                  {/* Target scene name label */}
                  {targetScene && (
                    <div className="mt-1.5 px-3 py-1 rounded-full bg-black/70 backdrop-blur-sm border border-white/10 whitespace-nowrap">
                      <span className="text-[11px] font-medium text-white/90">
                        {targetScene.name}
                      </span>
                    </div>
                  )}

                  {/* Selected indicator ring */}
                  {isSelected && (
                    <div
                      className="absolute rounded-full pointer-events-none"
                      style={{
                        width: 76,
                        height: 76,
                        top: -6,
                        left: '50%',
                        marginLeft: -38,
                        border: '2px dashed rgba(255,255,255,0.7)',
                      }}
                    />
                  )}
                </div>
              </div>
            )
          }

          // Info / image / content hotspots
          return (
            <div
              key={hotspot.id}
              className="absolute pointer-events-auto"
              style={{
                left: screenPos.x,
                top: screenPos.y,
                transform: `translate(-50%, -50%) scale(${screenPos.scale})`,
                zIndex: isDragging ? 50 : isSelected ? 20 : 10,
              }}
            >
              <div
                className={`group relative flex flex-col items-center ${canDrag ? 'cursor-grab' : 'cursor-pointer'} ${isDragging ? 'cursor-grabbing' : ''}`}
                onPointerDown={(e) => canDrag ? handleHotspotPointerDown(e, hotspot.id) : undefined}
                onPointerMove={handleHotspotPointerMove}
                onPointerUp={(e) => handleHotspotPointerUp(e, hotspot)}
                onClick={(e) => !canDrag ? handleHotspotElementClick(e, hotspot) : undefined}
                role="button"
                tabIndex={0}
                aria-label={hotspot.title || 'Hotspot'}
              >
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center
                    transition-transform duration-150
                    ${isSelected ? 'scale-110' : 'group-hover:scale-110'}
                  `}
                  style={{
                    background: `radial-gradient(circle, ${hotspot.color || '#10b981'}ee 0%, ${hotspot.color || '#10b981'}99 100%)`,
                    boxShadow: `0 0 16px ${hotspot.color || '#10b981'}66, 0 4px 8px rgba(0,0,0,0.3)`,
                  }}
                >
                  {hotspot.type === 'info' && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 16v-4" />
                      <path d="M12 8h.01" />
                    </svg>
                  )}
                  {hotspot.type === 'image' && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                      <circle cx="9" cy="9" r="2" />
                      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                    </svg>
                  )}
                  {hotspot.type === 'content' && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
                    </svg>
                  )}
                </div>
                {hotspot.title && (
                  <div className="mt-1.5 px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[10px] font-medium text-white/90">{hotspot.title}</span>
                  </div>
                )}
                {isSelected && (
                  <div
                    className="absolute rounded-full pointer-events-none"
                    style={{
                      width: 52,
                      height: 52,
                      top: -6,
                      left: '50%',
                      marginLeft: -26,
                      border: '2px dashed rgba(255,255,255,0.7)',
                    }}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-20">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <span className="text-sm text-muted-foreground">Loading panorama...</span>
          </div>
        </div>
      )}

      {/* Editor mode hint */}
      {isEditorMode && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-primary/90 text-primary-foreground px-4 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm">
          Click on the panorama to place a hotspot
        </div>
      )}

      {/* Drop overlay */}
      {isDragOverViewer && (
        <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
          <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-lg" />
          <div className="relative bg-card/95 backdrop-blur-xl border border-primary/50 rounded-xl px-6 py-4 shadow-2xl text-center">
            <p className="text-sm font-medium text-foreground">Drop to create arrow link</p>
            <p className="text-xs text-muted-foreground mt-0.5">A navigation arrow will appear here</p>
          </div>
        </div>
      )}
    </div>
  )
}
