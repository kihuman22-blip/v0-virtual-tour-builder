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

  // Camera state
  const rotationRef = useRef({ yaw: scene.initialViewDirection.yaw, pitch: scene.initialViewDirection.pitch })
  const targetRotationRef = useRef({ yaw: scene.initialViewDirection.yaw, pitch: scene.initialViewDirection.pitch })

  // Pointer tracking
  const pointerState = useRef<{
    mode: 'none' | 'camera' | 'hotspot'
    startX: number
    startY: number
    moved: boolean
    hotspotId: string | null
    hotspotYaw: number
    hotspotPitch: number
    pointerId: number
  }>({ mode: 'none', startX: 0, startY: 0, moved: false, hotspotId: null, hotspotYaw: 0, hotspotPitch: 0, pointerId: -1 })

  // DOM refs for direct hotspot positioning
  const hotspotElsRef = useRef<Map<string, HTMLDivElement>>(new Map())
  const sceneRef = useRef(scene)
  sceneRef.current = scene

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

    const s = new THREE.Scene()
    threeSceneRef.current = s

    const geo = new THREE.SphereGeometry(500, 128, 80)
    geo.scale(-1, 1, 1)
    const mat = new THREE.MeshBasicMaterial({ color: 0x111111 })
    const mesh = new THREE.Mesh(geo, mat)
    s.add(mesh)
    sphereRef.current = mesh

    return () => {
      cancelAnimationFrame(frameIdRef.current)
      renderer.dispose()
      geo.dispose()
      mat.dispose()
      if (currentTextureRef.current) currentTextureRef.current.dispose()
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- Load texture on scene change ----
  useEffect(() => {
    if (!sphereRef.current || !scene.imageUrl) return
    setIsLoading(true)

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const tex = new THREE.Texture(img)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.minFilter = THREE.LinearFilter
      tex.magFilter = THREE.LinearFilter
      tex.generateMipmaps = false
      if (rendererRef.current) tex.anisotropy = rendererRef.current.capabilities.getMaxAnisotropy()
      tex.needsUpdate = true

      if (currentTextureRef.current) currentTextureRef.current.dispose()
      currentTextureRef.current = tex

      const newMat = new THREE.MeshBasicMaterial({ map: tex })
      if (sphereRef.current) {
        const old = sphereRef.current.material as THREE.MeshBasicMaterial
        sphereRef.current.material = newMat
        old.dispose()
      }
      setIsLoading(false)
    }
    img.onerror = () => setIsLoading(false)
    img.src = scene.imageUrl
  }, [scene.imageUrl, scene.id])

  // Reset view direction on scene change
  useEffect(() => {
    rotationRef.current = { yaw: scene.initialViewDirection.yaw, pitch: scene.initialViewDirection.pitch }
    targetRotationRef.current = { yaw: scene.initialViewDirection.yaw, pitch: scene.initialViewDirection.pitch }
  }, [scene.id, scene.initialViewDirection.yaw, scene.initialViewDirection.pitch])

  // ---- FOV ----
  useEffect(() => {
    if (cameraRef.current) { cameraRef.current.fov = fov; cameraRef.current.updateProjectionMatrix() }
  }, [fov])

  // ---- Animation loop ----
  useEffect(() => {
    const renderer = rendererRef.current
    const camera = cameraRef.current
    const ts = threeSceneRef.current
    const container = canvasContainerRef.current
    if (!renderer || !camera || !ts || !container) return

    let lastTime = performance.now()
    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate)
      const now = performance.now()
      const dt = (now - lastTime) / 1000
      lastTime = now

      if (pointerState.current.mode === 'none' && autoRotate) {
        targetRotationRef.current.yaw += autoRotateSpeed * dt * 10
      }

      // Freeze camera lerp while dragging a hotspot so raycast stays stable
      if (pointerState.current.mode !== 'hotspot') {
        const t = Math.min(1, dt * 14)
        rotationRef.current.yaw += (targetRotationRef.current.yaw - rotationRef.current.yaw) * t
        rotationRef.current.pitch += (targetRotationRef.current.pitch - rotationRef.current.pitch) * t
      }
      rotationRef.current.pitch = Math.max(-85, Math.min(85, rotationRef.current.pitch))
      targetRotationRef.current.pitch = Math.max(-85, Math.min(85, targetRotationRef.current.pitch))

      const yr = THREE.MathUtils.degToRad(rotationRef.current.yaw)
      const pr = THREE.MathUtils.degToRad(rotationRef.current.pitch)
      camera.lookAt(Math.cos(pr) * Math.sin(yr) * 100, Math.sin(pr) * 100, Math.cos(pr) * Math.cos(yr) * 100)
      renderer.render(ts, camera)

      // Position hotspot elements directly in DOM
      const w = container.clientWidth
      const h = container.clientHeight
      sceneRef.current.hotspots.forEach((hs) => {
        const el = hotspotElsRef.current.get(hs.id)
        if (!el) return
        const p = yawPitchToVector3(hs.position.yaw, hs.position.pitch, 480)
        const v = new THREE.Vector3(p.x, p.y, p.z)
        v.project(camera)
        if (v.z < 1) {
          el.style.display = ''
          el.style.left = `${((v.x * 0.5 + 0.5) * w).toFixed(1)}px`
          el.style.top = `${((-v.y * 0.5 + 0.5) * h).toFixed(1)}px`
          const sc = Math.max(0.6, Math.min(1.2, 1.0 / Math.max(0.5, Math.abs(v.z))))
          el.style.transform = `translate(-50%, -50%) scale(${sc.toFixed(3)})`
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
    const obs = new ResizeObserver(() => {
      camera.aspect = container.clientWidth / container.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(container.clientWidth, container.clientHeight)
    })
    obs.observe(container)
    return () => obs.disconnect()
  }, [])

  // ---- Raycast ----
  const screenToYawPitch = useCallback((cx: number, cy: number): HotspotPosition | null => {
    const container = canvasContainerRef.current
    const camera = cameraRef.current
    const sphere = sphereRef.current
    if (!container || !camera || !sphere) return null
    const rect = container.getBoundingClientRect()
    const mouse = new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1)
    const rc = new THREE.Raycaster()
    rc.setFromCamera(mouse, camera)
    const hits = rc.intersectObject(sphere)
    if (hits.length > 0) {
      const pt = hits[0].point
      // Sphere is scale(-1,1,1) so hit.x is negated; atan2(-pt.x, pt.z) corrects it
      const yaw = (Math.atan2(-pt.x, pt.z) * 180) / Math.PI
      const r = Math.sqrt(pt.x * pt.x + pt.y * pt.y + pt.z * pt.z)
      const pitch = (Math.asin(pt.y / r) * 180) / Math.PI
      return { yaw, pitch }
    }
    return null
  }, [])

  // ---- Unified pointer handling on the container ----
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Check if a hotspot element was the target
    const target = e.target as HTMLElement
    const hotspotEl = target.closest('[data-hotspot-id]') as HTMLElement | null

    if (hotspotEl && onHotspotMoved) {
      const hsId = hotspotEl.getAttribute('data-hotspot-id')!
      const hs = sceneRef.current.hotspots.find((h) => h.id === hsId)
      if (hs) {
        e.preventDefault()
        e.stopPropagation()
        pointerState.current = {
          mode: 'hotspot',
          startX: e.clientX, startY: e.clientY,
          moved: false,
          hotspotId: hsId,
          hotspotYaw: hs.position.yaw, hotspotPitch: hs.position.pitch,
          pointerId: e.pointerId,
        }
        containerRef.current?.setPointerCapture(e.pointerId)
        return
      }
    }

    // Camera drag
    pointerState.current = {
      mode: 'camera',
      startX: e.clientX, startY: e.clientY,
      moved: false,
      hotspotId: null, hotspotYaw: 0, hotspotPitch: 0,
      pointerId: e.pointerId,
    }
    containerRef.current?.setPointerCapture(e.pointerId)
  }, [onHotspotMoved])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const ps = pointerState.current
    if (ps.mode === 'none') return

    const dx = e.clientX - ps.startX
    const dy = e.clientY - ps.startY
    if (!ps.moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) ps.moved = true

    if (ps.mode === 'hotspot' && ps.moved && onHotspotMoved && ps.hotspotId) {
      // Inline raycast for precision -- no helper function, no frame delay
      const cont = canvasContainerRef.current
      const cam = cameraRef.current
      const sph = sphereRef.current
      if (cont && cam && sph) {
        const rect = cont.getBoundingClientRect()
        const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1
        const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1
        const rc = new THREE.Raycaster()
        rc.setFromCamera(new THREE.Vector2(ndcX, ndcY), cam)
        const hits = rc.intersectObject(sph)
        if (hits.length > 0) {
          const pt = hits[0].point
          // Sphere is scale(-1,1,1), so hit.x is negated vs world
          // yawPitchToVector3 uses: x = sin(yaw), z = cos(yaw)
          // atan2(-pt.x, pt.z) undoes the x flip to get the correct yaw
          const yaw = (Math.atan2(-pt.x, pt.z) * 180) / Math.PI
          const r = Math.sqrt(pt.x * pt.x + pt.y * pt.y + pt.z * pt.z)
          const pitch = (Math.asin(pt.y / r) * 180) / Math.PI
          ps.hotspotYaw = yaw
          ps.hotspotPitch = pitch
          onHotspotMoved(ps.hotspotId, { yaw, pitch })
        }
      }
    }

    if (ps.mode === 'camera') {
      if (e.buttons > 0 || e.pressure > 0) {
        targetRotationRef.current.yaw += e.movementX * 0.2
        targetRotationRef.current.pitch += e.movementY * 0.2
      }
    }
  }, [onHotspotMoved])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const ps = pointerState.current
    containerRef.current?.releasePointerCapture(e.pointerId)

    if (ps.mode === 'hotspot') {
      if (!ps.moved && onHotspotClick) {
        const hs = sceneRef.current.hotspots.find((h) => h.id === ps.hotspotId)
        if (hs) onHotspotClick(hs)
      }
    }

    if (ps.mode === 'camera' && !ps.moved) {
      // Click on panorama -- place hotspot or click hotspot
      const target = e.target as HTMLElement
      const hotspotEl = target.closest('[data-hotspot-id]') as HTMLElement | null
      if (hotspotEl && onHotspotClick && !onHotspotMoved) {
        const hsId = hotspotEl.getAttribute('data-hotspot-id')!
        const hs = sceneRef.current.hotspots.find((h) => h.id === hsId)
        if (hs) onHotspotClick(hs)
      } else if (isEditorMode && onSceneClick) {
        const pos = screenToYawPitch(e.clientX, e.clientY)
        if (pos) onSceneClick(pos)
      }
    }

    pointerState.current = { mode: 'none', startX: 0, startY: 0, moved: false, hotspotId: null, hotspotYaw: 0, hotspotPitch: 0, pointerId: -1 }
  }, [isEditorMode, onSceneClick, onHotspotClick, onHotspotMoved, screenToYawPitch])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const camera = cameraRef.current
    if (!camera) return
    camera.fov = Math.max(30, Math.min(100, camera.fov + e.deltaY * 0.05))
    camera.updateProjectionMatrix()
  }, [])

  // ---- Drag & drop ----
  const onDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-scene-id')) { e.preventDefault(); e.dataTransfer.dropEffect = 'link'; setIsDragOverViewer(true) }
  }, [])
  const onDragLeave = useCallback(() => setIsDragOverViewer(false), [])
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragOverViewer(false)
    const sid = e.dataTransfer.getData('application/x-scene-id')
    if (!sid || !onDropScene) return
    const pos = screenToYawPitch(e.clientX, e.clientY)
    if (pos) onDropScene(sid, pos)
  }, [onDropScene, screenToYawPitch])

  const setHotspotRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) hotspotElsRef.current.set(id, el); else hotspotElsRef.current.delete(id)
  }, [])

  const canDrag = !!onHotspotMoved

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden select-none ${className}`}
      style={{ touchAction: 'none', cursor: isEditorMode ? 'crosshair' : 'grab' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Three.js canvas */}
      <div ref={canvasContainerRef} className="absolute inset-0" />

      {/* Hotspot overlays */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
        {scene.hotspots.map((hotspot) => {
          const isSelected = hotspot.id === selectedHotspotId
          const targetScene = allScenes?.find((s) => s.id === hotspot.targetSceneId)

          return (
            <div
              key={hotspot.id}
              ref={(el) => setHotspotRef(hotspot.id, el)}
              data-hotspot-id={hotspot.id}
              className="absolute pointer-events-auto"
              style={{ left: 0, top: 0, display: 'none', willChange: 'transform, left, top', zIndex: isSelected ? 20 : 10 }}
            >
              {hotspot.type === 'scene-link' ? (
                <div className={`flex flex-col items-center ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} group/arrow`}>
                  {/* Arrow icon with pin stem */}
                  <div
                    className={`relative flex items-center justify-center rounded-full transition-all duration-200 group-hover/arrow:scale-110 ${isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-black/50' : ''}`}
                    style={{
                      width: 44, height: 44,
                      background: hotspot.color || '#4db8a4',
                      border: '2px solid rgba(255,255,255,0.5)',
                      boxShadow: '0 2px 12px rgba(0,0,0,0.35)',
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M6 15l6-6 6 6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  {/* Pin stem */}
                  <div className="w-0.5 h-3 bg-white/70 rounded-full" style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }} />
                  {targetScene && (
                    <div className="mt-1 px-2.5 py-0.5 rounded bg-black/70 backdrop-blur-sm whitespace-nowrap">
                      <span className="text-[10px] font-medium text-white">{targetScene.name}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className={`flex flex-col items-center ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} group/hs`}>
                  {/* Icon with pin stem - orange/amber style */}
                  <div
                    className={`flex items-center justify-center rounded-full transition-all duration-200 group-hover/hs:scale-110 ${isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-black/50' : ''}`}
                    style={{
                      width: 36, height: 36,
                      background: hotspot.color || '#f59e0b',
                      border: '2px solid rgba(255,255,255,0.5)',
                      boxShadow: '0 2px 12px rgba(0,0,0,0.35)',
                    }}
                  >
                    {hotspot.icon === 'eye' ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>
                    ) : hotspot.icon === 'link' ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                    ) : hotspot.icon === 'utensils' ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>
                    ) : hotspot.icon === 'menu' ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/><path d="M8 11h8"/><path d="M8 7h6"/></svg>
                    ) : hotspot.icon === 'chef' ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1Z"/><path d="M6 17h12"/></svg>
                    ) : hotspot.icon === 'wine' ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 22h8"/><path d="M7 10h10"/><path d="M12 15v7"/><path d="M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z"/></svg>
                    ) : hotspot.icon === 'coffee' ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/></svg>
                    ) : hotspot.icon === 'star' ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    ) : hotspot.icon === 'heart' ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                    ) : hotspot.icon === 'map-pin' ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>
                    ) : hotspot.icon === 'phone' ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    ) : hotspot.icon === 'clock' ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    ) : hotspot.icon === 'image' || hotspot.type === 'image' ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                    )}
                  </div>
                  {/* Pin stem */}
                  <div className="w-0.5 h-2.5 bg-white/70 rounded-full" style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }} />
                  {hotspot.title && (
                    <div className="mt-0.5 px-2 py-0.5 rounded bg-black/70 backdrop-blur-sm whitespace-nowrap">
                      <span className="text-[10px] font-medium text-white">{hotspot.title}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Drop overlay */}
      {isDragOverViewer && (
        <div className="absolute inset-0 z-30 bg-primary/10 border-4 border-dashed border-primary/50 flex items-center justify-center pointer-events-none">
          <div className="bg-card/90 backdrop-blur-xl rounded-xl px-6 py-4 text-center shadow-2xl">
            <p className="text-sm font-semibold text-foreground">Drop to create navigation arrow</p>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-20 bg-background/80 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <span className="text-xs text-muted-foreground">Loading panorama...</span>
          </div>
        </div>
      )}
    </div>
  )
}
