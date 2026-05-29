import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

function isLand(lat: number, lon: number): boolean {
  const absLat = Math.abs(lat)
  const nLon = ((lon + 180) % 360) - 180

  if (absLat > 75) return false

  if (nLon > -130 && nLon < -60 && absLat < 55) return true
  if (nLon > -15 && nLon < 50 && absLat < 55) return true
  if (nLon > 60 && nLon < 145 && absLat < 55) return true
  if (nLon > 145 && nLon < 180 && absLat < 35) return true
  if (nLon > -180 && nLon < -130 && absLat < 62) return true

  if (absLat > 55 && absLat < 75 && nLon > -170 && nLon < -50) return true
  if (absLat > 55 && absLat < 75 && nLon > 10 && nLon < 150) return true

  if (absLat > 30 && absLat < 60 && nLon > 100 && nLon < 150) return true
  if (absLat < 25 && nLon > 95 && nLon < 160) return true

  if (absLat < 25 && nLon > -100 && nLon < -35) return true

  if (absLat > 15 && absLat < 55 && nLon > -15 && nLon < 75 && absLat > 20) return true

  if (absLat > -45 && absLat < 35 && nLon > -75 && nLon < -40) return true

  return false
}

const GLOBE_RADIUS = 1.8
const PARTICLE_COUNT = 12000

function generateLandPoints() {
  const positions: number[] = []
  const phi = Math.PI * (3 - Math.sqrt(5))

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const y = 1 - (i / (PARTICLE_COUNT - 1)) * 2
    const radius_at_y = Math.sqrt(1 - y * y)
    const theta = phi * i

    const x = Math.cos(theta) * radius_at_y
    const z = Math.sin(theta) * radius_at_y

    const lat = Math.asin(y) * (180 / Math.PI)
    const lon = Math.atan2(z, x) * (180 / Math.PI)

    if (isLand(lat, lon)) {
      positions.push(x * GLOBE_RADIUS, y * GLOBE_RADIUS, z * GLOBE_RADIUS)
    }
  }

  return new Float32Array(positions)
}

function Globe({ subtle = false }: { subtle?: boolean }) {
  const groupRef = useRef<THREE.Group>(null)
  const ringRef = useRef<THREE.Group>(null)
  const pointsRef = useRef<THREE.Points>(null)

  const landPositions = useMemo(() => generateLandPoints(), [])

  const particleOpacity = subtle ? 0.18 : 0.55
  const ringOpacity = subtle ? 0.025 : 0.06
  const rotationSpeed = subtle ? 0.025 : 0.06

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * rotationSpeed
    }
    if (ringRef.current) {
      ringRef.current.rotation.y += delta * rotationSpeed * 0.6
      ringRef.current.rotation.x += delta * 0.008
    }
    if (pointsRef.current && !subtle) {
      const material = pointsRef.current.material as THREE.PointsMaterial
      material.opacity = particleOpacity + Math.sin(state.clock.elapsedTime * 0.5) * 0.05
    }
  })

  const ringGeometry = useMemo(() => new THREE.TorusGeometry(GLOBE_RADIUS + 0.35, 0.008, 32, 200), [])

  return (
    <group ref={groupRef} rotation={[0.35, 0, 0]}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={landPositions.length / 3}
            array={landPositions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={subtle ? 0.02 : 0.025}
          color={subtle ? '#a0a0b0' : '#c8c8d0'}
          transparent
          opacity={particleOpacity}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      <group ref={ringRef}>
        <mesh geometry={ringGeometry}>
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={ringOpacity}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh geometry={ringGeometry} rotation={[Math.PI / 3, 0, 0]}>
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={ringOpacity * 0.7}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh geometry={ringGeometry} rotation={[-Math.PI / 3, 0, 0]}>
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={ringOpacity * 0.7}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {!subtle && (
        <>
          <pointLight intensity={2} distance={8} color="#4a4a6a" position={[3, 2, 4]} />
          <pointLight intensity={1} distance={6} color="#2a2a4a" position={[-3, -1, -2]} />
        </>
      )}
    </group>
  )
}

export default function DotGlobe({ subtle = false }: { subtle?: boolean }) {
  return (
    <Canvas
      camera={{ position: subtle ? [0.6, 1.2, 5.5] : [0.6, 1.2, 4.8], fov: subtle ? 35 : 38 }}
      style={{ background: 'transparent' }}
      gl={{ antialias: true, alpha: true }}
    >
      <Globe subtle={subtle} />
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        enableRotate={false}
      />
    </Canvas>
  )
}