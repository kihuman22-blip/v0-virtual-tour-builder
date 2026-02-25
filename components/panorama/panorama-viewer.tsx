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
  const currentTextureRef = useRef<THREE.Texture | null>(null)
  const frameIdRef = useRef<number>(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isDragOverViewer, setIsDragOverViewer] = useState(false)

  // Camera control refs
  const isDraggingCamera = useRef(false)
  const cameraPointerStart = useRef({ x: 0, y: 0 })
  const rotationRef = useRef({ yaw: scene.initialViewDirection.yaw, pitch: scene.initialViewDirection.pitch })
  const targetRotationRef = useRef({ yaw: scene.initialViewDirection.yaw, pitch: scene.initialViewDirection.pitch })

  // Hotspot drag refs
  const draggingHotspotId = useRef<string | null>(null)
  const dragDidMove = useRef(false)
  const dragPointerStart = useRef({ x: 0, y: 0 })

  // DOM refs for each hotspot element -- direct DOM manipulation, no React re-renders
  const hotspotElementsRef = useRef<Map<string, HTMLDivElement>>(new Map())

  // Keep latest props in refs so the animation loop can access them without re-creating
  const sceneRef = useRef(scene)
  sceneRef.current = scene
  const selectedHotspotIdRef = useRef(selectedHotspotId)
  selectedHotspotIdRef.current = selectedHotspotId

  // ---- Three.js init ----
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

  // ---- Load texture ----
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
      if (rendererRef.current) {
        texture.anisotropy = rendererRef.current.capabilities.getMaxAnisotropy()
      }
      texture.needsUpdate = true

      if (currentTextureRef.current) currentTextureRef.current.dispose()
      currentTextureRef.current = texture

      const material = new THREE.MeshBasicMaterial({ map: texture })
      if (sphereRef.current) {
        const oldMat = sphereRef.current.material as THREE.MeshBasicMaterial
        sphereRef.current.material = material
        oldMat.dispose()
      }
      setIsLoading(false)
    }
    img.onerror = () => setIsLoading(false)
    img.src = scene.imageUrl
  }, [scene.imageUrl])

  // ---- FOV ----
  useEffect(() => {
    if (cameraRef.current) {
      cameraRef.current.fov = fov
      cameraRef.current.updateProjectionMatrix()
    }
  }, [fov])

  // ---- Animation loop: render + position hotspot DOM elements directly ----
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
      const dt = (now - lastTime) / 1000
      lastTime = now

      // Auto-rotate
      if (!isDraggingCamera.current && !draggingHotspotId.current && autoRotate) {
        targetRotationRef.current.yaw += autoRotateSpeed * dt * 10
      }

      // Smooth lerp
      const t = Math.min(1, dt * 14)
      rotationRef.current.yaw += (targetRotationRef.current.yaw - rotationRef.current.yaw) * t
      rotationRef.current.pitch += (targetRotationRef.current.pitch - rotationRef.current.pitch) * t
      rotationRef.current.pitch = Math.max(-85, Math.min(85, rotationRef.current.pitch))
      targetRotationRef.current.pitch = Math.max(-85, Math.min(85, targetRotationRef.current.pitch))

      const yawRad = THREE.MathUtils.degToRad(rotationRef.current.yaw)
      const pitchRad = THREE.MathUtils.degToRad(rotationRef.current.pitch)
      camera.lookAt(
        Math.cos(pitchRad) * Math.sin(yawRad) * 100,
        Math.sin(pitchRad) * 100,
        Math.cos(pitchRad) * Math.cos(yawRad) * 100
      )
      renderer.render(threeScene, camera)

      // Update hotspot DOM positions directly (no React re-renders!)
      const w = container.clientWidth
      const h = container.clientHeight
      const currentScene = sceneRef.current

      currentScene.hotspots.forEach((hotspot) => {
        const el = hotspotElementsRef.current.get(hotspot.id)
        if (!el) return

        const p = yawPitchToVector3(hotspot.position.yaw, hotspot.position.pitch, 480)
        const v = new THREE.Vector3(p.x, p.y, p.z)
        v.project(camera)

        const visible = v.z < 1
        const sx = (v.x * 0.5 + 0.5) * w
        const sy = (-v.y * 0.5 + 0.5) * h
        const sc = Math.max(0.5, Math.min(1.3, 1.0 / Math.max(0.5, Math.abs(v.z))))

        if (visible) {
          el.style.display = ''
          el.style.transform = `translate(-50%, -50%) scale(${sc.toFixed(3)})`
          el.style.left = `${sx.toFixed(1)}px`
          el.style.top = `${sy.toFixed(1)}px`
        } else {
          el.style.display = 'none'
        }
      })
    }

    animate()
    return () => cancelAnimationFrame(frameIdRef.current)
  }, [autoRotate, autoRotateSpeed])

  // ---- Resize ----
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

    const obs = new ResizeObserver(handleResize)
    obs.observe(container)
    return () => obs.disconnect()
  }, [])

  // ---- Raycast helper ----
  const screenToYawPitch = useCallback(
    (cx: number, cy: number): HotspotPosition | null => {
      const container = canvasContainerRef.current
      const camera = cameraRef.current
      const sphere = sphereRef.current
      if (!container || !camera || !sphere) return null

      const rect = container.getBoundingClientRect()
      const mouse = new THREE.Vector2(
        ((cx - rect.left) / rect.width) * 2 - 1,
        -((cy - rect.top) / rect.height) * 2 + 1
      )
      const rc = new THREE.Raycaster()
      rc.setFromCamera(mouse, camera)
      const hits = rc.intersectObject(sphere)
      if (hits.length > 0) {
        const pt = hits[0].point
        const pos = vector3ToYawPitch(pt.x, pt.y, pt.z)
        return { yaw: -pos.yaw, pitch: pos.pitch }
      }
      return null
    },
    []
  )

  // ---- Camera pointer events ----
  const onCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    if (draggingHotspotId.current) return
    isDraggingCamera.current = false
    cameraPointerStart.current = { x: e.clientX, y: e.clientY }
    canvasContainerRef.current?.setPointerCapture(e.pointerId)
  }, [])

  const onCanvasPointerMove = useCallback((e: React.PointerEvent) => {
    if (draggingHotspotId.current) return
    const dx = e.clientX - cameraPointerStart.current.x
    const dy = e.clientY - cameraPointerStart.current.y
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) isDraggingCamera.current = true
    if (e.buttons > 0) {
      targetRotationRef.current.yaw += dx * 0.2
      targetRotationRef.current.pitch += dy * 0.2
    }
    cameraPointerStart.current = { x: e.clientX, y: e.clientY }
  }, [])

  const onCanvasPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (draggingHotspotId.current) return
      canvasContainerRef.current?.releasePointerCapture(e.pointerId)
      if (isDraggingCamera.current) {
        isDraggingCamera.current = false
        return
      }
      if (isEditorMode && onSceneClick) {
        const pos = screenToYawPitch(e.clientX, e.clientY)
        if (pos) onSceneClick(pos)
      }
    },
    [isEditorMode, onSceneClick, screenToYawPitch]
  )

  const onCanvasWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const camera = cameraRef.current
    if (!camera) return
    camera.fov = Math.max(30, Math.min(100, camera.fov + e.deltaY * 0.05))
    camera.updateProjectionMatrix()
  }, [])

  // ---- Hotspot pointer events (drag to move) ----
  const onHotspotDown = useCallback((e: React.PointerEvent, hotspotId: string) => {
    e.stopPropagation()
    e.preventDefault()
    draggingHotspotId.current = hotspotId
    dragDidMove.current = false
    dragPointerStart.current = { x: e.clientX, y: e.clientY }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const onHotspotMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingHotspotId.current || !onHotspotMoved) return
      e.stopPropagation()
      e.preventDefault()

      const dx = e.clientX - dragPointerStart.current.x
      const dy = e.clientY - dragPointerStart.current.y
      if (!dragDidMove.current && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
        dragDidMove.current = true
      }

      if (dragDidMove.current) {
        const pos = screenToYawPitch(e.clientX, e.clientY)
        if (pos) onHotspotMoved(draggingHotspotId.current, pos)
      }
    },
    [onHotspotMoved, screenToYawPitch]
  )

  const onHotspotUp = useCallback(
    (e: React.PointerEvent, hotspot: Hotspot) => {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
      e.stopPropagation()
      e.preventDefault()

      if (!dragDidMove.current && onHotspotClick) {
        onHotspotClick(hotspot)
      }
      draggingHotspotId.current = null
      dragDidMove.current = false
    },
    [onHotspotClick]
  )

  // ---- Drag & drop (scene linking) ----
  const onDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-scene-id')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'link'
      setIsDragOverViewer(true)
    }
  }, [])
  const onDragLeave = useCallback(() => setIsDragOverViewer(false), [])
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOverViewer(false)
      const sid = e.dataTransfer.getData('application/x-scene-id')
      if (!sid || !onDropScene) return
      const pos = screenToYawPitch(e.clientX, e.clientY)
      if (pos) onDropScene(sid, pos)
    },
    [onDropScene, screenToYawPitch]
  )

  // Store ref for each hotspot DOM element
  const setHotspotRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) {
      hotspotElementsRef.current.set(id, el)
    } else {
      hotspotElementsRef.current.delete(id)
    }
  }, [])

  const canDrag = !!onHotspotMoved

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
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onCanvasPointerMove}
        onPointerUp={onCanvasPointerUp}
        onWheel={onCanvasWheel}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        style={{ cursor: isEditorMode ? 'crosshair' : 'grab' }}
      />

      {/* Hotspot overlay: one div per hotspot, positioned via direct DOM in animation loop */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
        {scene.hotspots.map((hotspot) => {
          const isSelected = hotspot.id === selectedHotspotId
          const targetScene = allScenes?.find((s) => s.id === hotspot.targetSceneId)

          return (
            <div
              key={hotspot.id}
              ref={(el) => setHotspotRef(hotspot.id, el)}
              className="absolute pointer-events-auto"
              style={{
                left: 0,
                top: 0,
                display: 'none',
                willChange: 'transform, left, top',
                zIndex: isSelected ? 20 : 10,
              }}
              onPointerDown={canDrag ? (e) => onHotspotDown(e, hotspot.id) : undefined}
              onPointerMove={canDrag ? onHotspotMove : undefined}
              onPointerUp={canDrag ? (e) => onHotspotUp(e, hotspot) : undefined}
              onClick={!canDrag ? (e) => { e.stopPropagation(); onHotspotClick?.(hotspot) } : undefined}
            >
              {hotspot.type === 'scene-link' ? (
                /* ---- Navigation arrow: white circle, colored thick border, chevron ---- */
                <div className={`flex flex-col items-center ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}>
                  <div
                    className={`relative flex items-center justify-center rounded-full transition-shadow duration-150 hover:shadow-xl ${isSelected ? 'ring-2 ring-white/70 ring-offset-2 ring-offset-transparent' : ''}`}
                    style={{
                      width: 52,
                      height: 52,
                      background: 'rgba(255,255,255,0.95)',
                      border: `4.5px solid ${hotspot.color || '#8B2020'}`,
                      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                    }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path d="M6 15l6-6 6 6" stroke={hotspot.color || '#8B2020'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  {targetScene && (
                    <div className="mt-1.5 px-2.5 py-0.5 rounded bg-black/75 backdrop-blur-sm whitespace-nowrap">
                      <span className="text-[10px] font-medium text-white">{targetScene.name}</span>
                    </div>
                  )}
                </div>
              ) : (
                /* ---- Info / Image / Content hotspot ---- */
                <div className={`flex flex-col items-center ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}>
                  <div
                    className={`flex items-center justify-center rounded-full transition-shadow duration-150 hover:shadow-xl ${isSelected ? 'ring-2 ring-white/70 ring-offset-2 ring-offset-transparent' : ''}`}
                    style={{
                      width: 42,
                      height: 42,
                      background: hotspot.color || '#3b82f6',
                      boxShadow: `0 4px 20px ${hotspot.color || '#3b82f6'}80, 0 2px 8px rgba(0,0,0,0.4)`,
                    }}
                  >
                    {hotspot.icon === 'info' || hotspot.type === 'info' ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 16v-4" />
                        <path d="M12 8h.01" />
                      </svg>
                    ) : hotspot.icon === 'image' || hotspot.type === 'image' ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                        <circle cx="9" cy="9" r="2" />
                        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                      </svg>
                    ) : hotspot.icon === 'eye' ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
                      </svg>
                    )}
                  </div>

                  {/* Image shown directly below icon */}
                  {hotspot.type === 'image' && hotspot.imageUrl && (
                    <div className="mt-1.5 rounded-lg overflow-hidden border-2 border-white/40 shadow-xl" style={{ maxWidth: 160 }}>
                      <img src={hotspot.imageUrl} alt={hotspot.title || 'Image'} className="w-full h-auto object-cover" style={{ maxHeight: 100 }} draggable={false} />
                    </div>
                  )}

                  {/* Title label on hover */}
                  {hotspot.title && !(hotspot.type === 'image' && hotspot.imageUrl) && (
                    <div className="mt-1 px-2.5 py-0.5 rounded bg-black/75 backdrop-blur-sm whitespace-nowrap opacity-0 hover:opacity-100 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <span className="text-[10px] font-medium text-white">{hotspot.title}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-20">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <span className="text-sm text-muted-foreground">Loading panorama...</span>
          </div>
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
