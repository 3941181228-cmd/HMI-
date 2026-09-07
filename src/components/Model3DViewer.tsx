// 3D 模型查看器组件：基于 react-three-fiber + drei 加载并展示 GLB 模型
import { Suspense, useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, OrbitControls, Center, Bounds, Environment, Html, useProgress } from '@react-three/drei'
import * as THREE from 'three'

interface Model3DViewerProps {
  /** GLB 模型地址（建议使用代理地址规避 CORS） */
  modelUrl: string
  className?: string
}

/** 加载并居中显示单个 GLB 模型 */
function GlbModel({ url }: { url: string }) {
  const { scene } = useGLTF(url)
  // 克隆场景避免复用同一对象引用导致的状态污染
  const cloned = useMemo(() => scene.clone(true), [scene])
  return (
    <Bounds fit clip observe margin={1.2}>
      <Center>
        <primitive object={cloned} />
      </Center>
    </Bounds>
  )
}

/** 加载进度提示 */
function Loader() {
  const { progress } = useProgress()
  return (
    <Html center>
      <div className="flex flex-col items-center gap-2 px-4 py-3 rounded-xl bg-black/40 backdrop-blur-md text-white">
        <div className="w-32 h-1 rounded-full bg-white/20 overflow-hidden">
          <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-[11px] tracking-wide">加载模型 {progress.toFixed(0)}%</span>
      </div>
    </Html>
  )
}

/** 自动缓慢旋转的包裹器，让模型在闲置时有微动效 */
function AutoRotate({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.15
  })
  return <group ref={ref}>{children}</group>
}

export default function Model3DViewer({ modelUrl, className }: Model3DViewerProps) {
  return (
    <div className={className} style={{ width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [3, 2, 5], fov: 45 }}
        dpr={[1, 2]}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
      >
        {/* 环境光与主光源 */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />
        <directionalLight position={[-5, -3, -5]} intensity={0.4} />

        <Suspense fallback={<Loader />}>
          <AutoRotate>
            <GlbModel url={modelUrl} />
          </AutoRotate>
          <Environment preset="city" />
        </Suspense>

        <OrbitControls
          enablePan
          enableZoom
          enableRotate
          minDistance={1.5}
          maxDistance={20}
          makeDefault
        />
      </Canvas>
    </div>
  )
}
