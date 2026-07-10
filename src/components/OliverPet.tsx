// Oliver the Panda – Interactive Pseudo-3D Pet Component
// Features: floating, breathing, mouse-tracking eyes, 3D tilt parallax,
// dynamic aura glow, click interactions, particles

import React, { useState, useEffect, useRef, useCallback } from 'react';

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

// Particle type for click effects
interface Particle {
  id: number;
  x: number;
  y: number;
  emoji: string;
  dx: number;
  dy: number;
  life: number;
}

export const OliverPet: React.FC<OliverPetProps> = ({
  state,
  customText,
  size = 200,
  petLevel = 1,
  equippedItems = {},
  hideBubble = false,
  hideBadge = false,
}) => {
  // Mouse tracking for eyes
  const containerRef = useRef<HTMLDivElement>(null);
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });

  // 3D tilt
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 });
  const [isHovered, setIsHovered] = useState(false);

  // Click interaction
  const [isJumping, setIsJumping] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const particleIdRef = useRef(0);

  // Dialogue text
  const getDialogueText = () => {
    if (customText) return customText;
    switch (state) {
      case 'good': return 'Tớ đang bảo vệ sức khỏe của bạn! Cố lên nhé!';
      case 'slouch': return 'Chủ nhân ơi, lưng tớ đau quá! Hãy ngồi thẳng lên!';
      case 'close': return 'Gần quá tớ không thấy đường! Hãy lùi ra xa nhé!';
      case 'writing': return 'Chủ nhân đang rất tập trung viết bài, giữ im lặng nào...';
      case 'tired': return 'Tớ mệt quá rồi... Cùng sửa tư thế nhé!';
      case 'success': return 'Tuyệt cú mèo! Lưng thẳng tắp, mắt sáng ngời!';
      case 'sleep': return 'Zzz... Nhấn Bắt đầu để gọi tớ dậy nhé!';
      default: return 'Tớ đồng hành cùng bạn học tập!';
    }
  };

  // Theme color by state
  const getThemeColor = () => {
    switch (state) {
      case 'good': return '#4EAD63';
      case 'success': return '#7E5BEF';
      case 'writing': return '#3B82F6';
      case 'tired': return '#FF5E5E';
      case 'slouch': return '#FFAA2C';
      case 'close': return '#FF5E5E';
      case 'sleep': return '#9CA3AF';
      default: return '#4EAD63';
    }
  };

  // Aura glow color (more vibrant)
  const getAuraColor = () => {
    switch (state) {
      case 'good': return '0 0 30px rgba(78,173,99,0.4), 0 0 60px rgba(78,173,99,0.15)';
      case 'success': return '0 0 30px rgba(126,91,239,0.5), 0 0 60px rgba(126,91,239,0.2)';
      case 'writing': return '0 0 20px rgba(59,130,246,0.3), 0 0 40px rgba(59,130,246,0.1)';
      case 'tired': return '0 0 25px rgba(255,94,94,0.4), 0 0 50px rgba(255,94,94,0.15)';
      case 'slouch': return '0 0 25px rgba(255,170,44,0.4), 0 0 50px rgba(255,170,44,0.15)';
      case 'close': return '0 0 30px rgba(255,94,94,0.5), 0 0 60px rgba(255,94,94,0.2)';
      case 'sleep': return '0 0 15px rgba(156,163,175,0.2)';
      default: return '0 0 20px rgba(78,173,99,0.3)';
    }
  };

  const themeColor = getThemeColor();
  const isMinimal = hideBubble && hideBadge;

  // Mouse tracking for 3D tilt + eye follow
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const deltaX = (e.clientX - centerX) / (rect.width / 2);
    const deltaY = (e.clientY - centerY) / (rect.height / 2);

    // Eye offset (clamped)
    setEyeOffset({
      x: Math.max(-3, Math.min(3, deltaX * 3)),
      y: Math.max(-2, Math.min(2, deltaY * 2)),
    });

    // 3D tilt
    setTilt({
      rotateY: deltaX * 12,
      rotateX: -deltaY * 8,
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setEyeOffset({ x: 0, y: 0 });
    setTilt({ rotateX: 0, rotateY: 0 });
    setIsHovered(false);
  }, []);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  // Click interaction – jump + particles
  const handleClick = useCallback(() => {
    if (state === 'sleep') return;
    setIsJumping(true);
    setTimeout(() => setIsJumping(false), 600);

    // Spawn particles
    const emojis = ['💖', '✨', '🌟', '⭐', '💫', '🎉'];
    const newParticles: Particle[] = Array.from({ length: 6 }, (_, i) => ({
      id: ++particleIdRef.current,
      x: 50 + (Math.random() - 0.5) * 40,
      y: 40 + (Math.random() - 0.5) * 20,
      emoji: emojis[i % emojis.length],
      dx: (Math.random() - 0.5) * 4,
      dy: -(Math.random() * 3 + 1),
      life: 1,
    }));
    setParticles(prev => [...prev, ...newParticles]);
  }, [state]);

  // Animate particles
  useEffect(() => {
    if (particles.length === 0) return;
    const raf = setInterval(() => {
      setParticles(prev =>
        prev
          .map(p => ({
            ...p,
            x: p.x + p.dx,
            y: p.y + p.dy,
            dy: p.dy + 0.05,
            life: p.life - 0.025,
          }))
          .filter(p => p.life > 0)
      );
    }, 30);
    return () => clearInterval(raf);
  }, [particles.length > 0]);

  return (
    <div
      ref={containerRef}
      className={
        isMinimal
          ? 'flex flex-col items-center justify-center select-none'
          : 'flex flex-col items-center justify-center p-4 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 w-full select-none'
      }
      style={isMinimal ? {} : { maxWidth: '350px' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={handleMouseEnter}
    >
      {/* Dialogue Bubble */}
      {!hideBubble && (
        <div
          className="relative px-4 py-3 mb-6 text-sm font-medium rounded-2xl text-center shadow-sm w-full transition-all duration-300"
          style={{
            backgroundColor: `${themeColor}12`,
            color: themeColor,
            border: `1.5px solid ${themeColor}40`,
          }}
        >
          {getDialogueText()}
          <div
            className="absolute bottom-[-8px] left-1/2 transform -translate-x-1/2 w-3 h-3 rotate-45 border-r border-b"
            style={{
              backgroundColor: '#ffffff',
              borderColor: `${themeColor}40`,
            }}
          />
        </div>
      )}

      {/* 3D Pet Container with perspective */}
      <div
        className="relative flex items-center justify-center cursor-pointer"
        style={{
          width: size,
          height: size,
          perspective: '600px',
        }}
        onClick={handleClick}
      >
        {/* Aura glow ring */}
        <div
          className="absolute inset-0 rounded-full transition-all duration-700"
          style={{
            boxShadow: getAuraColor(),
            transform: `scale(${isHovered ? 1.08 : 1})`,
            opacity: state === 'sleep' ? 0.3 : 1,
          }}
        />

        {/* 3D tilt wrapper */}
        <div
          className="relative w-full h-full transition-transform duration-200 ease-out"
          style={{
            transformStyle: 'preserve-3d',
            transform: `rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg)`,
          }}
        >
          {/* Floating + Breathing animation wrapper */}
          <div
            className={`w-full h-full ${state === 'sleep' ? '' : 'oliver-float'} ${isJumping ? 'oliver-jump' : ''}`}
          >
            {/* Particles overlay */}
            {particles.length > 0 && (
              <div className="absolute inset-0 pointer-events-none z-20 overflow-visible">
                {particles.map(p => (
                  <span
                    key={p.id}
                    className="absolute text-lg"
                    style={{
                      left: `${p.x}%`,
                      top: `${p.y}%`,
                      opacity: p.life,
                      transform: `scale(${0.5 + p.life * 0.5})`,
                      transition: 'none',
                    }}
                  >
                    {p.emoji}
                  </span>
                ))}
              </div>
            )}

            {/* Equipped Background Aura */}
            {equippedItems['background'] === 'bg_aura' && (
              <svg className="absolute w-full h-full" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="48" fill="url(#auraGrad)" opacity="0.6" className="animate-spin-slow" />
                <defs>
                  <radialGradient id="auraGrad" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#FDE047" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#FDE047" stopOpacity="0" />
                  </radialGradient>
                </defs>
              </svg>
            )}

            {/* Good Posture Green Protective Shield */}
            {state === 'good' && (
              <svg className="absolute w-full h-full" viewBox="0 0 100 100">
                <circle
                  cx="50" cy="50" r="44"
                  fill="none" stroke="#4EAD63" strokeWidth="2.5"
                  strokeDasharray="6,4" className="opacity-70 oliver-shield-rotate"
                />
                <circle cx="50" cy="50" r="40" fill="#4EAD63" className="opacity-5" />
              </svg>
            )}

            {/* SVG Panda Body with breathing and 3D effects */}
            <svg
              width="90%" height="90%"
              viewBox="0 0 100 100"
              className={`transition-all duration-500 oliver-breathe ${
                state === 'slouch' ? 'translate-y-2' : ''
              } ${state === 'close' ? 'scale-110' : ''}`}
            >
              <defs>
                {/* 3D Gradients */}
                <radialGradient id="bodyGrad" cx="40%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="#FFFFFF" />
                  <stop offset="70%" stopColor="#F3F4F6" />
                  <stop offset="100%" stopColor="#D1D5DB" />
                </radialGradient>
                
                <radialGradient id="blackGrad" cx="40%" cy="30%" r="60%">
                  <stop offset="0%" stopColor="#374151" />
                  <stop offset="70%" stopColor="#1F2937" />
                  <stop offset="100%" stopColor="#111827" />
                </radialGradient>

                <radialGradient id="headGrad" cx="35%" cy="30%" r="65%">
                  <stop offset="0%" stopColor="#FFFFFF" />
                  <stop offset="75%" stopColor="#F9FAFB" />
                  <stop offset="100%" stopColor="#E5E7EB" />
                </radialGradient>
                
                <radialGradient id="blushGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#FF8A8A" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#FF8A8A" stopOpacity="0" />
                </radialGradient>

                <filter id="furTexture" x="-20%" y="-20%" width="140%" height="140%">
                   <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" result="noise" />
                   <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.05 0" in="noise" result="coloredNoise" />
                   <feComposite operator="in" in="coloredNoise" in2="SourceGraphic" result="texture" />
                   <feBlend mode="multiply" in="texture" in2="SourceGraphic" />
                </filter>
                
                <filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.15" />
                </filter>
              </defs>

              {/* Sparkles for Level 5 */}
              {petLevel >= 5 && state !== 'sleep' && (
                <g className="animate-pulse opacity-80">
                  <polygon points="15,20 17,25 22,27 17,29 15,34 13,29 8,27 13,25" fill="#FBBF24" />
                  <polygon points="85,30 86,33 89,34 86,35 85,38 84,35 81,34 84,33" fill="#FBBF24" />
                  <polygon points="20,70 21,72 23,73 21,74 20,76 19,74 17,73 19,72" fill="#FBBF24" />
                </g>
              )}

              {/* Shadow */}
              <ellipse cx="50" cy="88" rx="25" ry="5" fill="#E5E7EB" className="oliver-shadow" />

              <g filter="url(#dropShadow)">
                {/* Ears */}
                <circle cx="28" cy="24" r="8" fill="url(#blackGrad)" />
                <circle cx="28" cy="24" r="4" fill="#111827" />
                <circle cx="72" cy="24" r="8" fill="url(#blackGrad)" />
                <circle cx="72" cy="24" r="4" fill="#111827" />

                {/* Royal Cape (Level 5) */}
                {petLevel >= 5 && (
                  <path d="M 25 50 Q 10 90 20 85 Q 50 95 80 85 Q 90 90 75 50 Z" fill="#EF4444" opacity="0.9" />
                )}

                {/* Body/Torso */}
                <ellipse cx="50" cy="68" rx="22" ry="18" fill="url(#bodyGrad)" filter="url(#furTexture)" />
                <ellipse cx="50" cy="71" rx="15" ry="11" fill="#FFFFFF" opacity="0.8" />

                {/* Equipped Body Cape */}
                {equippedItems['body'] === 'body_cape' && (
                  <path d="M 28 50 Q 15 90 25 85 Q 50 95 75 85 Q 85 90 72 50 Z" fill="#EF4444" opacity="0.9" />
                )}

                {/* Guardian Armor (Level 4+) */}
                {petLevel >= 4 && (
                  <path d="M 36 60 Q 50 75 64 60 Q 50 50 36 60" fill="#9CA3AF" stroke="#6B7280" strokeWidth="1" />
                )}

                {/* Left Arm */}
                <path
                  d={
                    state === 'slouch' ? "M 28 60 Q 20 68 28 76"
                      : state === 'close' ? "M 28 60 Q 32 46 36 50"
                      : "M 28 60 Q 20 54 24 48"
                  }
                  stroke="url(#blackGrad)" strokeWidth="8" strokeLinecap="round" fill="none"
                  filter="url(#dropShadow)"
                />

                {/* Right Arm */}
                <path
                  d={
                    state === 'slouch' ? "M 72 60 Q 80 68 72 76"
                      : state === 'close' ? "M 72 60 Q 68 46 64 50"
                      : state === 'success' ? "M 72 60 Q 82 45 88 50"
                      : "M 72 60 Q 80 54 76 48"
                  }
                  stroke="url(#blackGrad)" strokeWidth="8" strokeLinecap="round" fill="none"
                  filter="url(#dropShadow)"
                />

                {/* Legs */}
                <ellipse cx="36" cy="85" rx="7" ry="5" fill="url(#blackGrad)" />
                <ellipse cx="64" cy="85" rx="7" ry="5" fill="url(#blackGrad)" />

                {/* Student Bag (Level 2+) */}
                {petLevel >= 2 && petLevel < 5 && (
                  <rect x="70" y="55" width="12" height="16" rx="3" fill="#3B82F6" stroke="#2563EB" strokeWidth="1" transform="rotate(-15 70 55)" />
                )}

                {/* Head base */}
                <ellipse
                  cx="50" cy="38" rx="25" ry="21"
                  fill="url(#headGrad)"
                  filter="url(#furTexture)"
                  style={{
                    transformOrigin: '50% 50%',
                    transform: state === 'slouch' ? 'rotate(8deg) translateY(2px)' : 'none',
                  }}
                />
              </g>

              {/* Face Elements – eyes follow mouse */}
              <g style={{
                transform: state === 'slouch'
                  ? 'translate(-2px, 3px)'
                  : state === 'close'
                  ? 'scale(1.05) translate(0px, 1px)'
                  : 'none',
                transformOrigin: '50% 38%',
              }}>
                {/* Eye Patches */}
                <ellipse cx="39" cy="36" rx="7" ry="9" fill="url(#blackGrad)" style={{ transform: 'rotate(-12deg)', transformOrigin: '39px 36px' }} />
                <ellipse cx="61" cy="36" rx="7" ry="9" fill="url(#blackGrad)" style={{ transform: 'rotate(12deg)', transformOrigin: '61px 36px' }} />

                {/* Equipped Glasses */}
                {(equippedItems['eyes'] === 'eyes_glasses' || petLevel >= 2) && equippedItems['eyes'] !== 'eyes_sunglasses' && (
                  <g stroke="#FBBF24" strokeWidth="1.5" fill="none">
                    <circle cx="39" cy="36" r="8" />
                    <circle cx="61" cy="36" r="8" />
                    <path d="M 47 36 L 53 36" />
                  </g>
                )}

                {equippedItems['eyes'] === 'eyes_sunglasses' && (
                  <g>
                    <path d="M 29 36 Q 39 30 47 36 Q 39 42 29 36" fill="#111827" stroke="#000" strokeWidth="1" />
                    <path d="M 53 36 Q 61 30 71 36 Q 61 42 53 36" fill="#111827" stroke="#000" strokeWidth="1" />
                    <path d="M 47 34 L 53 34" stroke="#111827" strokeWidth="2" />
                  </g>
                )}

                {/* Eyes – follow mouse! */}
                {state === 'close' || state === 'sleep' ? (
                  <>
                    <path d="M 36 36 L 42 36 M 37 34 L 41 38" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M 58 36 L 64 36 M 59 38 L 63 34" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
                  </>
                ) : state === 'slouch' || state === 'tired' ? (
                  <>
                    <path d="M 36 38 Q 39 34 42 37" fill="none" stroke="#FFFFFF" strokeWidth="2.0" strokeLinecap="round" />
                    <path d="M 58 37 Q 61 34 64 38" fill="none" stroke="#FFFFFF" strokeWidth="2.0" strokeLinecap="round" />
                    {state === 'tired' && (
                      <>
                        <circle cx="34" cy="40" r="1.5" fill="#60A5FA" />
                        <circle cx="66" cy="40" r="1.5" fill="#60A5FA" />
                      </>
                    )}
                  </>
                ) : (
                  /* Normal eyes that track mouse */
                  <>
                    <circle cx={40 + eyeOffset.x} cy={35 + eyeOffset.y} r="2.8" fill="#FFFFFF" />
                    <circle cx={41.5 + eyeOffset.x * 0.5} cy={34 + eyeOffset.y * 0.5} r="1.2" fill="#FFFFFF" />
                    <circle cx={60 + eyeOffset.x} cy={35 + eyeOffset.y} r="2.8" fill="#FFFFFF" />
                    <circle cx={61.5 + eyeOffset.x * 0.5} cy={34 + eyeOffset.y * 0.5} r="1.2" fill="#FFFFFF" />
                  </>
                )}

                {/* Cheeks blush */}
                {(state === 'good' || state === 'success') && (
                  <>
                    <circle cx="30" cy="42" r="3.5" fill="url(#blushGrad)" />
                    <circle cx="70" cy="42" r="3.5" fill="url(#blushGrad)" />
                  </>
                )}

                {/* Snout */}
                <ellipse cx="50" cy="45" rx="7" ry="5" fill="#FFFFFF" stroke="#E5E7EB" strokeWidth="0.5" filter="url(#dropShadow)" />

                {/* Nose */}
                <path d="M 47.5 44 L 52.5 44 L 50 46 Z" fill="#1F2937" />

                {/* Mouth */}
                {state === 'good' || state === 'success' || state === 'writing' ? (
                  <path d="M 46 48 Q 50 51 54 48" fill="none" stroke="#1F2937" strokeWidth="1.5" strokeLinecap="round" />
                ) : state === 'sleep' ? (
                  <circle cx="50" cy="49" r="1.5" fill="#1F2937" />
                ) : (
                  <path d="M 46 50 Q 50 47 54 50" fill="none" stroke="#1F2937" strokeWidth="1.5" strokeLinecap="round" />
                )}
              </g>

              {/* Scholar Hat (Level 3) */}
              {(equippedItems['head'] === 'hat_scholar' || petLevel === 3) && equippedItems['head'] !== 'hat_crown_silver' && equippedItems['head'] !== 'hat_crown_gold' && (
                <g transform="translate(35, 10)">
                  <polygon points="0,15 15,5 30,15 15,25" fill="#1F2937" />
                  <rect x="10" y="15" width="10" height="8" fill="#1F2937" />
                  <path d="M 28 15 L 32 22" stroke="#FBBF24" strokeWidth="1.5" />
                </g>
              )}

              {/* Silver Crown (Level 4) */}
              {(equippedItems['head'] === 'hat_crown_silver' || petLevel === 4) && equippedItems['head'] !== 'hat_crown_gold' && equippedItems['head'] !== 'hat_scholar' && (
                <g transform="translate(38, 8) scale(0.6)">
                  <polygon points="10,30 20,10 30,25 40,10 50,30" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="3" strokeLinejoin="round" />
                </g>
              )}

              {/* Gold Emperor Crown (Level 5) */}
              {(equippedItems['head'] === 'hat_crown_gold' || petLevel >= 5) && equippedItems['head'] !== 'hat_scholar' && equippedItems['head'] !== 'hat_crown_silver' && (
                <g transform="translate(30, 2) scale(0.8)">
                  <polygon points="10,30 20,5 30,20 40,5 50,30" fill="#FBBF24" stroke="#D97706" strokeWidth="3" strokeLinejoin="round" />
                  <circle cx="10" cy="30" r="3" fill="#EF4444" />
                  <circle cx="20" cy="5" r="4" fill="#3B82F6" />
                  <circle cx="30" cy="20" r="3" fill="#10B981" />
                  <circle cx="40" cy="5" r="4" fill="#3B82F6" />
                  <circle cx="50" cy="30" r="3" fill="#EF4444" />
                </g>
              )}

              {/* Success Crown */}
              {state === 'success' && (
                <g transform="translate(40, 8) scale(0.25)">
                  <polygon points="10,30 20,10 30,25 40,10 50,30" fill="#FBBF24" stroke="#D97706" strokeWidth="3" strokeLinejoin="round" />
                  <circle cx="10" cy="30" r="2.5" fill="#D97706" />
                  <circle cx="20" cy="10" r="2.5" fill="#D97706" />
                  <circle cx="30" cy="25" r="2.5" fill="#D97706" />
                  <circle cx="40" cy="10" r="2.5" fill="#D97706" />
                  <circle cx="50" cy="30" r="2.5" fill="#D97706" />
                </g>
              )}
            </svg>
          </div>
        </div>
      </div>

      {/* State Badge */}
      {!hideBadge && (
        <div
          className="mt-4 px-3 py-1 text-xs font-semibold rounded-full uppercase tracking-wider shadow-sm transition-all duration-300"
          style={{
            backgroundColor: themeColor,
            color: '#ffffff',
          }}
        >
          {state === 'good' && 'Tư thế Tốt'}
          {state === 'slouch' && 'Cảnh báo Tư thế'}
          {state === 'close' && 'Nhìn quá sát'}
          {state === 'writing' && 'Viết bài'}
          {state === 'tired' && 'Mệt mỏi'}
          {state === 'success' && 'Hoàn thành'}
          {state === 'sleep' && 'Nghỉ ngơi'}
        </div>
      )}

      {/* CSS Animations – injected once */}
      <style>{`
        @keyframes oliver-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        .oliver-float {
          animation: oliver-float 3s ease-in-out infinite;
        }

        @keyframes oliver-breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.015); }
        }
        .oliver-breathe {
          animation: oliver-breathe 4s ease-in-out infinite;
        }

        @keyframes oliver-jump {
          0% { transform: translateY(0) scale(1); }
          30% { transform: translateY(-18px) scale(1.05); }
          50% { transform: translateY(-20px) scale(1.08) rotate(5deg); }
          70% { transform: translateY(-10px) scale(1.02); }
          100% { transform: translateY(0) scale(1); }
        }
        .oliver-jump {
          animation: oliver-jump 0.6s ease-out forwards !important;
        }

        @keyframes oliver-shield-spin {
          from { transform-origin: 50% 50%; transform: rotate(0deg); }
          to { transform-origin: 50% 50%; transform: rotate(360deg); }
        }
        .oliver-shield-rotate {
          animation: oliver-shield-spin 20s linear infinite;
        }

        @keyframes oliver-shadow-pulse {
          0%, 100% { rx: 25; opacity: 0.3; }
          50% { rx: 22; opacity: 0.5; }
        }
        .oliver-shadow {
          animation: oliver-shadow-pulse 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default OliverPet;
