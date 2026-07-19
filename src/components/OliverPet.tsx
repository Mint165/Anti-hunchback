import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, Float, ContactShadows, Sparkles } from '@react-three/drei';
import * as THREE from 'three';

export type PetState = 'good' | 'slouch' | 'close' | 'writing' | 'tired' | 'success' | 'sleep';

interface OliverPetProps {
  state: PetState;
  customText?: string;
  size?: number;
  petLevel?: number;
  equippedItems?: Record<string, string>;
  hideBubble?: boolean;
  hideBadge?: boolean;
}

const PandaModel = ({ state, petLevel, equippedItems }: any) => {
  const group = useRef<THREE.Group>(null);
  
  useFrame((stateObj) => {
    if (!group.current) return;
    const time = stateObj.clock.getElapsedTime();
    
    // Base breathing animation
    const breatheY = Math.sin(time * 2) * 0.05;
    
    // Targets
    let targetRotationX = 0;
    let targetPositionY = breatheY;
    let targetScale = 1;
    
    // Adjust based on posture state
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
      targetPositionY = Math.abs(Math.sin(time * 4)) * 0.3; // Jumping
    }
    
    // Smooth interpolation
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, targetRotationX, 0.1);
    group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, targetPositionY, 0.1);
    group.current.scale.setScalar(THREE.MathUtils.lerp(group.current.scale.x, targetScale, 0.1));
  });

  return (
    <group ref={group} dispose={null}>
      <Float speed={state === 'sleep' ? 0 : 2} rotationIntensity={0.2} floatIntensity={0.5}>
        {/* Body */}
        <Sphere args={[0.9, 32, 32]} position={[0, -0.3, 0]} castShadow>
          <meshStandardMaterial color="#ffffff" roughness={0.7} />
        </Sphere>
        
        {/* Head */}
        <Sphere args={[0.75, 32, 32]} position={[0, 0.8, 0]} castShadow>
          <meshStandardMaterial color="#ffffff" roughness={0.7} />
        </Sphere>
        
        {/* Ears */}
        <Sphere args={[0.25, 32, 32]} position={[-0.55, 1.3, -0.1]} castShadow>
          <meshStandardMaterial color="#1f2937" roughness={0.8} />
        </Sphere>
        <Sphere args={[0.25, 32, 32]} position={[0.55, 1.3, -0.1]} castShadow>
          <meshStandardMaterial color="#1f2937" roughness={0.8} />
        </Sphere>
        
        {/* Eye Patches */}
        <Sphere args={[0.22, 32, 32]} position={[-0.3, 0.9, 0.6]} castShadow scale={[1.2, 0.9, 0.5]} rotation={[0, 0, -0.2]}>
          <meshStandardMaterial color="#1f2937" roughness={0.8} />
        </Sphere>
        <Sphere args={[0.22, 32, 32]} position={[0.3, 0.9, 0.6]} castShadow scale={[1.2, 0.9, 0.5]} rotation={[0, 0, 0.2]}>
          <meshStandardMaterial color="#1f2937" roughness={0.8} />
        </Sphere>
        
        {/* Pupils */}
        {(state !== 'sleep' && state !== 'close') && (
          <>
            <Sphere args={[0.07, 16, 16]} position={[-0.28, 0.92, 0.72]} castShadow>
              <meshStandardMaterial color="#ffffff" />
            </Sphere>
            <Sphere args={[0.07, 16, 16]} position={[0.28, 0.92, 0.72]} castShadow>
              <meshStandardMaterial color="#ffffff" />
            </Sphere>
          </>
        )}
        
        {/* Sleep/Close Eyes lines (simulated with tiny rotated boxes) */}
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
        <Sphere args={[0.1, 16, 16]} position={[0, 0.7, 0.72]} scale={[1.3, 0.8, 1]} castShadow>
          <meshStandardMaterial color="#111827" />
        </Sphere>
        
        {/* Arms */}
        <Sphere args={[0.2, 16, 16]} position={[-0.7, -0.1, 0.3]} scale={[0.8, 2.2, 0.8]} rotation={[0, 0, -0.5]} castShadow>
          <meshStandardMaterial color="#1f2937" roughness={0.8} />
        </Sphere>
        <Sphere args={[0.2, 16, 16]} position={[0.7, -0.1, 0.3]} scale={[0.8, 2.2, 0.8]} rotation={[0, 0, 0.5]} castShadow>
          <meshStandardMaterial color="#1f2937" roughness={0.8} />
        </Sphere>
        
        {/* Legs */}
        <Sphere args={[0.25, 16, 16]} position={[-0.4, -0.9, 0.4]} scale={[1, 1, 1.3]} castShadow>
          <meshStandardMaterial color="#1f2937" roughness={0.8} />
        </Sphere>
        <Sphere args={[0.25, 16, 16]} position={[0.4, -0.9, 0.4]} scale={[1, 1, 1.3]} castShadow>
          <meshStandardMaterial color="#1f2937" roughness={0.8} />
        </Sphere>
        
        {/* Royal Crown */}
        {(petLevel >= 5 || equippedItems?.head === 'hat_crown_gold') && (
           <mesh position={[0, 1.6, 0]}>
             <cylinderGeometry args={[0.2, 0.2, 0.2, 6]} />
             <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.2} />
           </mesh>
        )}
        
        {/* Particles / Sparkles for Good State */}
        {state === 'good' && (
          <Sparkles count={30} scale={3} size={2} color="#4EAD63" speed={0.4} opacity={0.5} />
        )}
        {state === 'success' && (
          <Sparkles count={50} scale={4} size={3} color="#7E5BEF" speed={1} opacity={0.8} />
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
}) => {
  
  const getDialogueText = () => {
    if (customText) return customText;
    switch (state) {
      case 'good': return 'Tuyệt vời! Hãy duy trì tư thế này nhé!';
      case 'slouch': return 'Úi, lưng bạn cong quá kìa! Thẳng lên nào!';
      case 'close': return 'Bạn đang ngồi quá sát màn hình rồi!';
      case 'writing': return 'Đang tập trung viết bài, Oliver sẽ im lặng...';
      case 'tired': return 'Oliver thấy bạn có vẻ mỏi cổ, hãy xoay cổ một chút nhé!';
      case 'success': return 'Chúc mừng bạn đã hoàn thành mục tiêu!';
      case 'sleep': return 'Zzz... Oliver đang nghỉ ngơi...';
      default: return 'Oliver luôn đồng hành cùng bạn!';
    }
  };

  const getThemeColor = () => {
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
  };

  const themeColor = getThemeColor();
  const isMinimal = hideBubble && hideBadge;

  return (
    <div 
      className={
        isMinimal 
          ? 'flex flex-col items-center justify-center select-none' 
          : 'flex flex-col items-center justify-center p-6 bg-white/40 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 hover:shadow-[0_8px_40px_rgb(0,0,0,0.08)] transition-all duration-500 w-full select-none'
      }
      style={isMinimal ? {} : { maxWidth: '380px' }}
    >
      {/* Dialogue Bubble */}
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

      {/* 3D Canvas */}
      <div 
        className="relative flex items-center justify-center cursor-grab active:cursor-grabbing rounded-full transition-transform duration-300"
        style={{ width: size, height: size }}
      >
        <div 
          className="absolute inset-0 rounded-full transition-all duration-700 opacity-20 blur-xl"
          style={{ backgroundColor: themeColor, transform: 'scale(0.8)' }}
        />
        <Canvas shadows camera={{ position: [0, 1, 6], fov: 40 }}>
          <ambientLight intensity={0.6} />
          <spotLight position={[5, 10, 5]} intensity={1.5} castShadow angle={0.3} penumbra={1} />
          <directionalLight position={[-5, 5, 5]} intensity={0.8} />
          <PandaModel state={state} petLevel={petLevel} equippedItems={equippedItems} />
          <ContactShadows position={[0, -1.8, 0]} opacity={0.6} scale={5} blur={2.5} far={4} />
          <OrbitControls 
            enablePan={false} 
            enableZoom={false} 
            minPolarAngle={Math.PI / 3} 
            maxPolarAngle={Math.PI / 2} 
          />
        </Canvas>
      </div>

      {/* State Badge */}
      {!hideBadge && (
        <div
          className="mt-6 px-4 py-1.5 text-xs font-bold rounded-full uppercase tracking-widest shadow-sm transition-all duration-300"
          style={{
            backgroundColor: themeColor,
            color: '#ffffff',
          }}
        >
          {state === 'good' && 'Tư thế Tốt'}
          {state === 'slouch' && 'Cảnh báo Lưng'}
          {state === 'close' && 'Nhìn quá sát'}
          {state === 'writing' && 'Đang Viết'}
          {state === 'tired' && 'Mệt mỏi'}
          {state === 'success' && 'Hoàn thành'}
          {state === 'sleep' && 'Nghỉ ngơi'}
        </div>
      )}
    </div>
  );
};

export default OliverPet;
