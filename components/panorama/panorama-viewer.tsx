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
  onSceneClick?: (position: HotspotPosition) => void
  onViewChange?: (yaw: number, pitch: number) => void
  isEditorMode?: boolean
  selectedHotspotId?: string | null
  className?: string
  transitionFrom?: string | null
}

export default function PanoramaViewer({
  scene,
  fov = 75,
  autoRotate = false,
  autoRotateSpeed = 0.5,
  onHotspotClick,
  onSceneClick,
  onViewChange,
  isEditorMode = false,
  selectedHotspotId,
  className = '',
}: PanoramaViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const threeSceneRef = useRef<THREE.Scene | null>(null)
  const sphereRef = useRef<THREE.Mesh | null>(null)
  const hotspotGroupRef = useRef<THREE.Group | null>(null)
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster())
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2())
  const isDraggingRef = useRef(false)
  const previousMouseRef = useRef({ x: 0, y: 0 })
  const rotationRef = useRef({ yaw: scene.initialViewDirection.yaw, pitch: scene.initialViewDirection.pitch })
  const targetRotationRef = useRef({ yaw: scene.initialViewDirection.yaw, pitch: scene.initialViewDirection.pitch })
  const frameIdRef = useRef<number>(0)
  const hotspotSpritesRef = useRef<Map<string, THREE.Sprite>>(new Map())
  const textureLoaderRef = useRef(new THREE.TextureLoader())
  const currentTextureRef = useRef<THREE.Texture | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Initialize Three.js scene
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Camera
    const camera = new THREE.PerspectiveCamera(fov, container.clientWidth / container.clientHeight, 1, 1100)
    camera.target = new THREE.Vector3(0, 0, 0)
    cameraRef.current = camera

    // Scene
    const threeScene = new THREE.Scene()
    threeSceneRef.current = threeScene

    // Panorama sphere
    const geometry = new THREE.SphereGeometry(500, 60, 40)
    geometry.scale(-1, 1, 1) // Invert for inside view
    const material = new THREE.MeshBasicMaterial({ color: 0x111111 })
    const sphere = new THREE.Mesh(geometry, material)
    threeScene.add(sphere)
    sphereRef.current = sphere

    // Hotspot group
    const hotspotGroup = new THREE.Group()
    threeScene.add(hotspotGroup)
    hotspotGroupRef.current = hotspotGroup

    // Ambient light (for sprites)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1)
    threeScene.add(ambientLight)

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
    const loader = textureLoaderRef.current

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const texture = new THREE.Texture(img)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.needsUpdate = true

      if (currentTextureRef.current) {
        currentTextureRef.current.dispose()
      }
      currentTextureRef.current = texture

      const material = new THREE.MeshBasicMaterial({ map: texture })
      if (sphereRef.current) {
        const oldMaterial = sphereRef.current.material as THREE.MeshBasicMaterial
        sphereRef.current.material = material
        oldMaterial.dispose()
      }
      setIsLoading(false)
    }
    img.onerror = () => {
      setIsLoading(false)
    }
    img.src = scene.imageUrl
  }, [scene.imageUrl])

  // Create hotspot sprites
  useEffect(() => {
    const group = hotspotGroupRef.current
    if (!group) return

    // Clear old sprites
    while (group.children.length > 0) {
      const child = group.children[0]
      group.remove(child)
      if (child instanceof THREE.Sprite) {
        ;(child.material as THREE.SpriteMaterial).dispose()
        if ((child.material as THREE.SpriteMaterial).map) {
          ;(child.material as THREE.SpriteMaterial).map!.dispose()
        }
      }
    }
    hotspotSpritesRef.current.clear()

    // Create new sprites for each hotspot
    scene.hotspots.forEach((hotspot) => {
      const canvas = document.createElement('canvas')
      canvas.width = 128
      canvas.height = 128
      const ctx = canvas.getContext('2d')!

      const isSelected = hotspot.id === selectedHotspotId
      const baseColor = hotspot.color || '#3b82f6'

      // Outer ring with pulse
      ctx.beginPath()
      ctx.arc(64, 64, isSelected ? 56 : 48, 0, Math.PI * 2)
      ctx.fillStyle = isSelected ? `${baseColor}40` : `${baseColor}25`
      ctx.fill()

      // Main circle
      ctx.beginPath()
      ctx.arc(64, 64, 32, 0, Math.PI * 2)
      ctx.fillStyle = isSelected ? baseColor : `${baseColor}cc`
      ctx.fill()

      // Border
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 3
      ctx.stroke()

      // Icon
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 24px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      const iconMap: Record<string, string> = {
        arrow: '\u279C',
        info: 'i',
        image: '\u29C9',
        link: '\u2197',
        eye: '\u25C9',
      }
      ctx.fillText(iconMap[hotspot.icon || 'info'] || 'i', 64, 64)

      const texture = new THREE.CanvasTexture(canvas)
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
      })
      const sprite = new THREE.Sprite(material)

      const pos = yawPitchToVector3(hotspot.position.yaw, hotspot.position.pitch, 480)
      sprite.position.set(pos.x, pos.y, pos.z)
      sprite.scale.set(50, 50, 1)
      sprite.userData = { hotspotId: hotspot.id }

      group.add(sprite)
      hotspotSpritesRef.current.set(hotspot.id, sprite)
    })
  }, [scene.hotspots, selectedHotspotId])

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
    if (!renderer || !camera || !threeScene) return

    let lastTime = performance.now()

    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate)

      const now = performance.now()
      const delta = (now - lastTime) / 1000
      lastTime = now

      // Smooth camera rotation
      if (!isDraggingRef.current && autoRotate) {
        targetRotationRef.current.yaw += autoRotateSpeed * delta * 10
      }

      // Lerp towards target
      const lerpFactor = Math.min(1, delta * 8)
      rotationRef.current.yaw += (targetRotationRef.current.yaw - rotationRef.current.yaw) * lerpFactor
      rotationRef.current.pitch += (targetRotationRef.current.pitch - rotationRef.current.pitch) * lerpFactor

      // Clamp pitch
      rotationRef.current.pitch = Math.max(-85, Math.min(85, rotationRef.current.pitch))
      targetRotationRef.current.pitch = Math.max(-85, Math.min(85, targetRotationRef.current.pitch))

      // Update camera
      const yawRad = THREE.MathUtils.degToRad(rotationRef.current.yaw)
      const pitchRad = THREE.MathUtils.degToRad(rotationRef.current.pitch)

      const lookAt = new THREE.Vector3(
        Math.cos(pitchRad) * Math.sin(yawRad),
        Math.sin(pitchRad),
        Math.cos(pitchRad) * Math.cos(yawRad)
      ).multiplyScalar(100)

      camera.lookAt(lookAt)

      // Animate hotspot sprites (pulse effect)
      hotspotSpritesRef.current.forEach((sprite) => {
        const baseScale = 50
        const pulse = Math.sin(now * 0.003) * 3
        sprite.scale.set(baseScale + pulse, baseScale + pulse, 1)
      })

      renderer.render(threeScene, camera)
    }

    animate()

    return () => {
      cancelAnimationFrame(frameIdRef.current)
    }
  }, [autoRotate, autoRotateSpeed])

  // Handle resize
  useEffect(() => {
    const container = containerRef.current
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

  // Mouse/touch interaction handlers
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    isDraggingRef.current = false
    previousMouseRef.current = { x: e.clientX, y: e.clientY }
    const container = containerRef.current
    if (container) {
      container.setPointerCapture(e.pointerId)
    }
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const dx = e.clientX - previousMouseRef.current.x
    const dy = e.clientY - previousMouseRef.current.y

    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      isDraggingRef.current = true
    }

    if (e.buttons > 0) {
      targetRotationRef.current.yaw -= dx * 0.15
      targetRotationRef.current.pitch += dy * 0.15
      targetRotationRef.current.pitch = Math.max(-85, Math.min(85, targetRotationRef.current.pitch))
    }

    previousMouseRef.current = { x: e.clientX, y: e.clientY }

    // Update mouse for raycasting
    const container = containerRef.current
    if (container) {
      const rect = container.getBoundingClientRect()
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    }
  }, [])

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const container = containerRef.current
      if (container) {
        container.releasePointerCapture(e.pointerId)
      }

      if (isDraggingRef.current) {
        isDraggingRef.current = false
        return
      }

      // Raycast to check for hotspot clicks
      const camera = cameraRef.current
      const hotspotGroup = hotspotGroupRef.current
      if (!camera || !hotspotGroup) return

      raycasterRef.current.setFromCamera(mouseRef.current, camera)
      const intersects = raycasterRef.current.intersectObjects(hotspotGroup.children, true)

      if (intersects.length > 0) {
        const sprite = intersects[0].object
        const hotspotId = sprite.userData.hotspotId
        if (hotspotId) {
          const hotspot = scene.hotspots.find((h) => h.id === hotspotId)
          if (hotspot && onHotspotClick) {
            onHotspotClick(hotspot)
          }
        }
      } else if (isEditorMode && onSceneClick) {
        // In editor mode, clicking on the panorama adds a hotspot
        raycasterRef.current.setFromCamera(mouseRef.current, camera)
        const sphereMesh = sphereRef.current
        if (sphereMesh) {
          const intersects = raycasterRef.current.intersectObject(sphereMesh)
          if (intersects.length > 0) {
            const point = intersects[0].point
            const pos = vector3ToYawPitch(point.x, point.y, point.z)
            // Invert yaw because sphere is inverted
            onSceneClick({ yaw: -pos.yaw, pitch: pos.pitch })
          }
        }
      }
    },
    [scene.hotspots, onHotspotClick, isEditorMode, onSceneClick]
  )

  // Scroll to zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const camera = cameraRef.current
      if (!camera) return
      camera.fov = Math.max(30, Math.min(100, camera.fov + e.deltaY * 0.05))
      camera.updateProjectionMatrix()
    },
    []
  )

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden select-none ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      style={{ cursor: isDraggingRef.current ? 'grabbing' : 'grab', touchAction: 'none' }}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <span className="text-sm text-muted-foreground">Loading panorama...</span>
          </div>
        </div>
      )}
      {isEditorMode && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-primary/90 text-primary-foreground px-4 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm">
          Click on the panorama to place a hotspot
        </div>
      )}
    </div>
  )
}
