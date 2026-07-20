import React, { useRef, useMemo, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, Float, ContactShadows, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { useLanguage } from '../contexts/LanguageContext';

export type PetState = 'good' | 'slouch' | 'close' | 'writing' | 'tired' | 'success' | 'sleep';

interface OliverPetProps {
  state: PetState;
  customText?: string;
  size?: number;
  petLevel?: number;
  equippedItems?: Record<string, string>;
  hideBubble?: boolean;
  hideBadge?: boolean;
  /** Reduce geometry detail for small render sizes (FloatingPet). */
  lowDetail?: boolean;
}

const PandaModel = ({
  state,
  petLevel,
  equippedItems,
  lowDetail = false,
}: {
  state: PetState;
  petLevel: number;
  equippedItems?: Record<string, string>;
  lowDetail?: boolean;
}) => {
  const group = useRef<THREE.Group>(null);
  const leftPupil = useRef<THREE.Mesh>(null);
  const rightPupil = useRef<THREE.Mesh>(null);
  const mouthRef = useRef<THREE.Mesh>(null);
  const zzzRef = useRef<THREE.Group>(null);

  // Segment count adapts to detail level
  const seg = lowDetail ? 16 : 32;

  // Memoised geometries / materials so they aren't recreated each frame
  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.65 }), []);
  const blackMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1f2937', roughness: 0.8 }), []);
  const noseMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#111827' }), []);
  const blushMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#F9A8D4', transparent: true, opacity: 0.65, roughness: 0.6 }), []);
  const bellyMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#F3F4F6', roughness: 0.7 }), []);
  const pupilMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#0f172a' }), []);

  useFrame((stateObj) => {
    if (!group.current) return;
    const time = stateObj.clock.getElapsedTime();

    // Base breathing animation
    const breatheY = Math.sin(time * 2) * 0.05;

    let targetRotationX = 0;
    let targetPositionY = breatheY;
    let targetScale = 1;

    if (state === 'slouch') {
      targetRotationX = 0.3;
      targetPositionY -= 0.15;
    } else if (state === 'tired') {
      targetRotationX = 0.2;
      targetPositionY -= 0.1;
    } else if (state === 'close') {
      targetScale = 1.25;
    } else if (state === 'sleep') {
      targetRotationX = 0.1;
      targetPositionY -= 0.2;
    } else if (state === 'success') {
      // Joyful bounce + slight spin
      targetPositionY = Math.abs(Math.sin(time * 4)) * 0.3;
      group.current.rotation.y = time * 1.2;
    } else if (state === 'good') {
      // Gentle wave
      group.current.rotation.z = Math.sin(time * 1.5) * 0.04;
    }

    // Only lerp rotation.y back when not success (avoid fighting the spin)
    if (state !== 'success') {
      group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, 0, 0.1);
      group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, state === 'good' ? Math.sin(time * 1.5) * 0.04 : 0, 0.1);
    }
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, targetRotationX, 0.1);
    group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, targetPositionY, 0.1);
    group.current.scale.setScalar(THREE.MathUtils.lerp(group.current.scale.x, targetScale, 0.1));

    // Iris movement: eyes track a slow Lissajous path (life-like)
    if (state !== 'sleep' && state !== 'close' && leftPupil.current && rightPupil.current) {
      const ix = Math.sin(time * 0.7) * 0.04;
      const iy = Math.cos(time * 0.5) * 0.03;
      leftPupil.current.position.x = -0.28 + ix;
      leftPupil.current.position.y = 0.92 + iy;
      rightPupil.current.position.x = 0.28 + ix;
      rightPupil.current.position.y = 0.92 + iy;
    }

    // Mouth subtle motion on 'good' / 'success'
    if (mouthRef.current && (state === 'good' || state === 'success')) {
      const smile = Math.sin(time * 2) * 0.05;
      mouthRef.current.scale.y = 1 + smile;
    }

    // Zzz bubbles for sleep
    if (zzzRef.current) {
      const visible = state === 'sleep';
      zzzRef.current.visible = visible;
      if (visible) {
        zzzRef.current.children.forEach((child, i) => {
          const phase = (time * 0.6 + i * 0.4) % 1;
          child.position.y = 1.5 + phase * 0.8;
          child.position.x = 0.45 + Math.sin(phase * 6) * 0.08;
          const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
          if (mat) mat.opacity = 1 - phase;
        });
      }
    }
  });

  const floatSpeed = state === 'sleep' ? 0.4 : 2;

  return (
    <group ref={group} dispose={null}>
      <Float speed={floatSpeed} rotationIntensity={0.2} floatIntensity={0.5}>
        {/* Body */}
        <Sphere args={[0.9, seg, seg]} position={[0, -0.3, 0]} castShadow material={bodyMat} />

        {/* Belly patch — lighter oval on front of body */}
        <Sphere args={[0.55, seg, seg]} position={[0, -0.35, 0.55]} scale={[0.7, 0.9, 0.25]} castShadow material={bellyMat} />

        {/* Head */}
        <Sphere args={[0.75, seg, seg]} position={[0, 0.8, 0]} castShadow material={bodyMat} />

        {/* Ears */}
        <Sphere args={[0.25, seg, seg]} position={[-0.55, 1.3, -0.1]} castShadow material={blackMat} />
        <Sphere args={[0.25, seg, seg]} position={[0.55, 1.3, -0.1]} castShadow material={blackMat} />

        {/* Eye patches */}
        <Sphere args={[0.22, seg, seg]} position={[-0.3, 0.9, 0.6]} scale={[1.2, 0.9, 0.5]} rotation={[0, 0, -0.2]} castShadow material={blackMat} />
        <Sphere args={[0.22, seg, seg]} position={[0.3, 0.9, 0.6]} scale={[1.2, 0.9, 0.5]} rotation={[0, 0, 0.2]} castShadow material={blackMat} />

        {/* Pupils (white highlights) — iris moved via refs */}
        {state !== 'sleep' && state !== 'close' && (
          <>
            <Sphere ref={leftPupil} args={[0.08, 16, 16]} position={[-0.28, 0.92, 0.72]} castShadow material={pupilMat} />
            <Sphere ref={rightPupil} args={[0.08, 16, 16]} position={[0.28, 0.92, 0.72]} castShadow material={pupilMat} />
            {/* Tiny sparkle highlight */}
            <Sphere args={[0.025, 8, 8]} position={[-0.25, 0.95, 0.79]}>
              <meshBasicMaterial color="#ffffff" />
            </Sphere>
            <Sphere args={[0.025, 8, 8]} position={[0.31, 0.95, 0.79]}>
              <meshBasicMaterial color="#ffffff" />
            </Sphere>
          </>
        )}

        {/* Blush marks */}
        <Sphere args={[0.1, 16, 16]} position={[-0.5, 0.62, 0.62]} scale={[1, 0.7, 0.4]} castShadow material={blushMat} />
        <Sphere args={[0.1, 16, 16]} position={[0.5, 0.62, 0.62]} scale={[1, 0.7, 0.4]} castShadow material={blushMat} />

        {/* Closed-eye lines */}
        {(state === 'sleep' || state === 'close') && (
          <group position={[0, 0.9, 0.75]}>
            <mesh position={[-0.3, 0, 0]} rotation={[0, 0, 0.2]}>
              <boxGeometry args={[0.15, 0.02, 0.02]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
            <mesh position={[0.3, 0, 0]} rotation={[0, 0, -0.2]}>
              <boxGeometry args={[0.15, 0.02, 0.02]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          </group>
        )}

        {/* Nose */}
        <Sphere args={[0.1, 16, 16]} position={[0, 0.7, 0.72]} scale={[1.3, 0.8, 1]} castShadow material={noseMat} />

        {/* Mouth (happy smile) */}
        {(state === 'good' || state === 'success') && (
          <mesh ref={mouthRef} position={[0, 0.55, 0.75]} rotation={[0, 0, Math.PI]}>
            <torusGeometry args={[0.08, 0.02, 16, 32, Math.PI]} />
            <meshStandardMaterial color="#111827" />
          </mesh>
        )}
        {(state === 'tired' || state === 'sleep') && (
          <mesh position={[0, 0.55, 0.75]} rotation={[0, 0, 0]}>
            <torusGeometry args={[0.08, 0.02, 16, 32, Math.PI]} />
            <meshStandardMaterial color="#111827" />
          </mesh>
        )}
        {(state === 'slouch' || state === 'close') && (
          <group position={[0, 0.58, 0.75]}>
            <mesh>
              <boxGeometry args={[0.1, 0.02, 0.02]} />
              <meshStandardMaterial color="#111827" />
            </mesh>
            <mesh position={[-0.25, 0.45, 0.02]} rotation={[0, 0, -0.3]}>
              <boxGeometry args={[0.15, 0.03, 0.02]} />
              <meshStandardMaterial color="#ef4444" />
            </mesh>
            <mesh position={[0.25, 0.45, 0.02]} rotation={[0, 0, 0.3]}>
              <boxGeometry args={[0.15, 0.03, 0.02]} />
              <meshStandardMaterial color="#ef4444" />
            </mesh>
          </group>
        )}

        {/* Arms */}
        <Sphere args={[0.2, 16, 16]} position={[-0.7, -0.1, 0.3]} scale={[0.8, 2.2, 0.8]} rotation={[0, 0, -0.5]} castShadow material={blackMat} />
        <Sphere args={[0.2, 16, 16]} position={[0.7, -0.1, 0.3]} scale={[0.8, 2.2, 0.8]} rotation={[0, 0, 0.5]} castShadow material={blackMat} />

        {/* Legs */}
        <Sphere args={[0.25, 16, 16]} position={[-0.4, -0.9, 0.4]} scale={[1, 1, 1.3]} castShadow material={blackMat} />
        <Sphere args={[0.25, 16, 16]} position={[0.4, -0.9, 0.4]} scale={[1, 1, 1.3]} castShadow material={blackMat} />

        {/* Toe details */}
        <Sphere args={[0.07, 8, 8]} position={[-0.5, -1.1, 0.55]} material={blackMat} />
        <Sphere args={[0.07, 8, 8]} position={[-0.3, -1.1, 0.55]} material={blackMat} />
        <Sphere args={[0.07, 8, 8]} position={[0.3, -1.1, 0.55]} material={blackMat} />
        <Sphere args={[0.07, 8, 8]} position={[0.5, -1.1, 0.55]} material={blackMat} />

        {/* Hats */}
        {(petLevel >= 5 || equippedItems?.head === 'hat_crown_gold') && (
          <mesh position={[0, 1.6, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.2, 6]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.2} />
          </mesh>
        )}
        {equippedItems?.head === 'hat_crown_silver' && (
          <mesh position={[0, 1.6, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.2, 6]} />
            <meshStandardMaterial color="#e5e7eb" metalness={0.8} roughness={0.2} />
          </mesh>
        )}
        {equippedItems?.head === 'hat_scholar' && (
          <group position={[0, 1.55, 0]}>
            <mesh>
              <boxGeometry args={[0.6, 0.05, 0.6]} />
              <meshStandardMaterial color="#1f2937" />
            </mesh>
            <mesh position={[0, -0.1, 0]}>
              <cylinderGeometry args={[0.2, 0.2, 0.2, 16]} />
              <meshStandardMaterial color="#1f2937" />
            </mesh>
            <mesh position={[0.25, -0.15, 0]} rotation={[0, 0, 0.5]}>
              <cylinderGeometry args={[0.01, 0.01, 0.3]} />
              <meshStandardMaterial color="#fbbf24" />
            </mesh>
          </group>
        )}

        {/* Glasses */}
        {equippedItems?.eyes === 'eyes_glasses' && (
          <group position={[0, 0.92, 0.8]}>
            <mesh position={[-0.28, 0, 0]}>
              <torusGeometry args={[0.15, 0.03, 16, 32]} />
              <meshStandardMaterial color="#1f2937" />
            </mesh>
            <mesh position={[0.28, 0, 0]}>
              <torusGeometry args={[0.15, 0.03, 16, 32]} />
              <meshStandardMaterial color="#1f2937" />
            </mesh>
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[0.2, 0.03, 0.03]} />
              <meshStandardMaterial color="#1f2937" />
            </mesh>
          </group>
        )}
        {equippedItems?.eyes === 'eyes_sunglasses' && (
          <group position={[0, 0.92, 0.8]}>
            <mesh position={[-0.28, 0, 0]}>
              <cylinderGeometry args={[0.16, 0.16, 0.05, 32]} />
              <meshStandardMaterial color="#111827" roughness={0.1} />
            </mesh>
            <mesh position={[0.28, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.16, 0.16, 0.05, 32]} />
              <meshStandardMaterial color="#111827" roughness={0.1} />
            </mesh>
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[0.2, 0.05, 0.05]} />
              <meshStandardMaterial color="#111827" />
            </mesh>
          </group>
        )}

        {/* Cape */}
        {equippedItems?.body === 'body_cape' && (
          <mesh position={[0, -0.2, -0.9]} rotation={[-0.2, 0, 0]}>
            <planeGeometry args={[1.5, 1.8]} />
            <meshStandardMaterial color="#ef4444" side={THREE.DoubleSide} />
          </mesh>
        )}

        {/* Slouch eyebrows (angry) */}
        {(state === 'slouch' || state === 'close') && (
          <group position={[0, 1.1, 0.7]}>
            <mesh position={[-0.2, 0, 0]} rotation={[0, 0, 0.3]}>
              <boxGeometry args={[0.15, 0.02, 0.02]} />
              <meshStandardMaterial color="#1f2937" />
            </mesh>
            <mesh position={[0.2, 0, 0]} rotation={[0, 0, -0.3]}>
              <boxGeometry args={[0.15, 0.02, 0.02]} />
              <meshStandardMaterial color="#1f2937" />
            </mesh>
          </group>
        )}

        {/* Sleep Zzz bubbles */}
        <group ref={zzzRef} visible={false}>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[0.45, 1.5 + i * 0.3, 0]}>
              <torusGeometry args={[0.05 + i * 0.02, 0.015, 8, 24, Math.PI * 1.5]} />
              <meshStandardMaterial color="#9ca3af" transparent opacity={1} />
            </mesh>
          ))}
        </group>

        {/* Sparkles — skipped in low-detail mode for performance */}
        {state === 'good' && !lowDetail && !equippedItems?.aura && (
          <Sparkles count={30} scale={3} size={2} color="#4EAD63" speed={0.4} opacity={0.5} />
        )}
        {state === 'success' && !lowDetail && !equippedItems?.aura && (
          <Sparkles count={50} scale={4} size={3} color="#7E5BEF" speed={1} opacity={0.8} />
        )}

        {/* Aura effects */}
        {equippedItems?.aura === 'aura_fire' && !lowDetail && (
          <Sparkles count={150} scale={3} size={4} speed={0.4} opacity={0.6} color="#f97316" position={[0, 0.5, 0]} />
        )}
        {equippedItems?.aura === 'aura_ice' && !lowDetail && (
          <Sparkles count={100} scale={4} size={2} speed={0.2} opacity={0.8} color="#38bdf8" position={[0, 0.5, 0]} />
        )}
        {equippedItems?.aura === 'aura_electric' && !lowDetail && (
          <Sparkles count={80} scale={3.5} size={3} speed={1} opacity={0.9} color="#eab308" position={[0, 0.5, 0]} noise={1} />
        )}
      </Float>
    </group>
  );
};

export const OliverPet: React.FC<OliverPetProps> = ({
  state,
  customText,
  size = 200,
  petLevel = 1,
  equippedItems = {},
  hideBubble = false,
  hideBadge = false,
  lowDetail = false,
}) => {
  const { t } = useLanguage();
  const getDialogueText = useCallback(() => {
    if (customText) return customText;
    switch (state) {
      case 'good': return t('pet.dialogueGood');
      case 'slouch': return t('pet.dialogueSlouch');
      case 'close': return t('pet.dialogueClose');
      case 'writing': return t('pet.dialogueWriting');
      case 'tired': return t('pet.dialogueTired');
      case 'success': return t('pet.dialogueSuccess');
      case 'sleep': return t('pet.dialogueSleep');
      default: return t('pet.dialogueDefault');
    }
  }, [customText, state, t]);

  const getThemeColor = useCallback(() => {
    switch (state) {
      case 'good': return 'rgba(78, 173, 99, 1)';
      case 'success': return 'rgba(126, 91, 239, 1)';
      case 'writing': return 'rgba(59, 130, 246, 1)';
      case 'tired': return 'rgba(255, 94, 94, 1)';
      case 'slouch': return 'rgba(255, 170, 44, 1)';
      case 'close': return 'rgba(255, 94, 94, 1)';
      case 'sleep': return 'rgba(156, 163, 175, 1)';
      default: return 'rgba(78, 173, 99, 1)';
    }
  }, [state]);

  const themeColor = getThemeColor();
  const isMinimal = hideBubble && hideBadge;

  // Lower dpr for low-detail (small) renders
  const dpr: [number, number] = lowDetail ? [1, 1.2] : [1, 1.5];

  return (
    <div
      className={
        isMinimal
          ? 'flex flex-col items-center justify-center select-none'
          : 'flex flex-col items-center justify-center p-6 bg-white/40 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 hover:shadow-[0_8px_40px_rgb(0,0,0,0.08)] transition-all duration-500 w-full select-none'
      }
      style={isMinimal ? {} : { maxWidth: '380px' }}
    >
      {!hideBubble && (
        <div
          className="relative px-5 py-3.5 mb-6 text-sm font-semibold rounded-2xl text-center shadow-sm w-full transition-all duration-300 transform hover:scale-105"
          style={{
            backgroundColor: themeColor.replace('1)', '0.1)'),
            color: themeColor,
            border: `1.5px solid ${themeColor.replace('1)', '0.3)')}`,
            backdropFilter: 'blur(10px)',
          }}
        >
          {getDialogueText()}
          <div
            className="absolute bottom-[-8px] left-1/2 transform -translate-x-1/2 w-4 h-4 rotate-45 border-r-1.5 border-b-1.5"
            style={{
              backgroundColor: 'inherit',
              borderColor: themeColor.replace('1)', '0.3)'),
              borderRight: `1.5px solid ${themeColor.replace('1)', '0.3)')}`,
              borderBottom: `1.5px solid ${themeColor.replace('1)', '0.3)')}`,
            }}
          />
        </div>
      )}

      <div
        className="relative flex items-center justify-center cursor-grab active:cursor-grabbing rounded-full transition-transform duration-300"
        style={{ width: size, height: size }}
      >
        <div
          className="absolute inset-0 rounded-full transition-all duration-700 opacity-20 blur-xl"
          style={{ backgroundColor: themeColor, transform: 'scale(0.8)' }}
        />
        <Canvas shadows camera={{ position: [0, 1, 6], fov: 40 }} dpr={dpr} gl={{ antialias: !lowDetail, alpha: true }}>
          <ambientLight intensity={0.6} />
          <spotLight position={[5, 10, 5]} intensity={1.5} castShadow angle={0.3} penumbra={1} />
          <directionalLight position={[-5, 5, 5]} intensity={0.8} />
          {/* Rim light for depth */}
          <pointLight position={[-4, 2, -3]} intensity={0.4} color="#A78BFA" />
          <PandaModel state={state} petLevel={petLevel} equippedItems={equippedItems} lowDetail={lowDetail} />
          {/* Drop ContactShadows in low-detail mode — blur={2.5} is GPU-heavy */}
          {!lowDetail && <ContactShadows position={[0, -1.2, 0]} opacity={0.6} scale={5} blur={2.5} far={4} />}
          <OrbitControls
            enablePan={false}
            enableZoom={false}
            minPolarAngle={Math.PI / 3}
            maxPolarAngle={Math.PI / 2}
            target={[0, 0.2, 0]}
          />
        </Canvas>
      </div>

      {!hideBadge && (
        <div
          className="mt-6 px-4 py-1.5 text-xs font-bold rounded-full uppercase tracking-widest shadow-sm transition-all duration-300"
          style={{ backgroundColor: themeColor, color: '#ffffff' }}
        >
          {state === 'good' && t('pet.stateGood')}
          {state === 'slouch' && t('pet.stateSlouch')}
          {state === 'close' && t('pet.stateClose')}
          {state === 'writing' && t('pet.stateWriting')}
          {state === 'tired' && t('pet.stateTired')}
          {state === 'success' && t('pet.stateSuccess')}
          {state === 'sleep' && t('pet.stateSleep')}
        </div>
      )}
    </div>
  );
};

export default OliverPet;