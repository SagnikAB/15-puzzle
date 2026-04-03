import { Canvas, useFrame } from '@react-three/fiber'
import { Float, Grid, Sparkles } from '@react-three/drei'
import { Suspense, useRef } from 'react'
import type { Group, Mesh } from 'three'

function TorusKnotHero() {
  const mesh = useRef<Mesh>(null)
  useFrame((s) => {
    if (mesh.current) {
      mesh.current.rotation.x = s.clock.elapsedTime * 0.11
      mesh.current.rotation.y = s.clock.elapsedTime * 0.19
    }
  })
  return (
    <Float speed={1.8} floatIntensity={0.55} rotationIntensity={0.15}>
      <mesh ref={mesh} scale={1.15}>
        <torusKnotGeometry args={[0.72, 0.26, 128, 16]} />
        <meshStandardMaterial
          color="#64748b"
          metalness={0.92}
          roughness={0.18}
          emissive="#312e81"
          emissiveIntensity={0.35}
        />
      </mesh>
    </Float>
  )
}

function AccentRings() {
  const g = useRef<Group>(null)
  useFrame((s) => {
    if (g.current) g.current.rotation.z = s.clock.elapsedTime * 0.06
  })
  return (
    <group ref={g} position={[0, 0.2, -1]}>
      <mesh rotation={[1.1, 0.4, 0]}>
        <torusGeometry args={[2.8, 0.035, 16, 100]} />
        <meshStandardMaterial
          color="#14b8a6"
          transparent
          opacity={0.45}
          metalness={0.95}
          roughness={0.15}
        />
      </mesh>
      <mesh rotation={[0.9, -0.5, 0.3]}>
        <torusGeometry args={[3.4, 0.02, 16, 80]} />
        <meshStandardMaterial
          color="#a78bfa"
          transparent
          opacity={0.28}
          metalness={0.9}
          roughness={0.25}
        />
      </mesh>
    </group>
  )
}

function Scene() {
  return (
    <>
      <color attach="background" args={['#030306']} />
      <fog attach="fog" args={['#030306', 12, 28]} />

      <ambientLight intensity={0.18} />
      <spotLight
        position={[8, 12, 10]}
        angle={0.35}
        penumbra={0.9}
        intensity={1.4}
        color="#c4b5fd"
        castShadow={false}
      />
      <pointLight position={[-10, 4, -6]} intensity={0.9} color="#22d3ee" />
      <pointLight position={[6, -6, 4]} intensity={0.45} color="#34d399" />

      <TorusKnotHero />
      <AccentRings />

      <Grid
        infiniteGrid
        fadeDistance={22}
        fadeStrength={5}
        sectionSize={1}
        sectionColor="#4b5563"
        sectionThickness={0.6}
        cellSize={0.85}
        cellColor="#1e293b"
        cellThickness={0.4}
        position={[0, -2.2, -2]}
        rotation={[0, 0, 0]}
      />

      <Sparkles
        count={120}
        scale={[14, 8, 8]}
        position={[0, 1, -3]}
        size={2}
        speed={0.35}
        opacity={0.55}
        color="#a5b4fc"
      />
    </>
  )
}

export function SceneBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
      <Suspense fallback={null}>
        <Canvas
          camera={{ position: [0, 0.2, 9], fov: 42 }}
          dpr={[1, Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2)]}
          gl={{
            alpha: false,
            antialias: true,
            powerPreference: 'high-performance',
            stencil: false,
            depth: true,
          }}
        >
          <Scene />
        </Canvas>
      </Suspense>
      {/* Soft vignette + brand gradient wash */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,rgba(15,23,42,0.15),rgba(3,3,6,0.85))]"
        style={{ mixBlendMode: 'multiply' }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/20 to-slate-950/90" />
    </div>
  )
}
