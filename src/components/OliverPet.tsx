// Oliver the Panda Interactive SVG Component

import React from 'react';

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

export const OliverPet: React.FC<OliverPetProps> = ({ state, customText, size = 200, petLevel = 1, equippedItems = {}, hideBubble = false, hideBadge = false }) => {
  // Determine dialogue text based on state
  const getDialogueText = () => {
    if (customText) return customText;
    switch (state) {
      case 'good':
        return 'Tớ đang bảo vệ sức khỏe của bạn! Cố lên nhé!';
      case 'slouch':
        return 'Chủ nhân ơi, lưng tớ đau quá! Hãy ngồi thẳng lên!';
      case 'close':
        return 'Gần quá tớ không thấy đường! Hãy lùi ra xa nhé!';
      case 'writing':
        return 'Chủ nhân đang rất tập trung viết bài, giữ im lặng nào...';
      case 'tired':
        return 'Tớ mệt quá rồi... Cùng sửa tư thế nhé!';
      case 'success':
        return 'Tuyệt cú mèo! Lưng thẳng tắp, mắt sáng ngời!';
      case 'sleep':
        return 'Zzz... Nhấn Bắt đầu để gọi tớ dậy nhé!';
      default:
        return 'Tớ đồng hành cùng bạn học tập!';
    }
  };

  // Determine state color schemes
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

  const themeColor = getThemeColor();
  const isMinimal = hideBubble && hideBadge;

  return (
    <div 
      className={isMinimal ? "flex flex-col items-center justify-center" : "flex flex-col items-center justify-center p-4 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 w-full"} 
      style={isMinimal ? {} : { maxWidth: '350px' }}
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
          {/* Arrow for bubble */}
          <div 
            className="absolute bottom-[-8px] left-1/2 transform -translate-x-1/2 w-3 h-3 rotate-45 border-r border-b"
            style={{
              backgroundColor: '#ffffff',
              borderColor: `${themeColor}40`,
            }}
          />
        </div>
      )}

      {/* Interactive SVG Panda */}
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        
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
          <svg className="absolute w-full h-full shield-active-glow" viewBox="0 0 100 100">
            <circle 
              cx="50" 
              cy="50" 
              r="44" 
              fill="none" 
              stroke="#4EAD63" 
              strokeWidth="2.5" 
              strokeDasharray="6,4" 
              className="opacity-70"
            />
            <circle 
              cx="50" 
              cy="50" 
              r="40" 
              fill="#4EAD63" 
              className="opacity-5"
            />
          </svg>
        )}

        {/* Panda SVG Body */}
        <svg 
          width="90%" 
          height="90%" 
          viewBox="0 0 100 100" 
          className={`transition-all duration-500 ${state === 'slouch' ? 'translate-y-2' : ''} ${state === 'close' ? 'scale-110' : ''}`}
        >
          {/* Sparkles for Level 5 */}
          {petLevel >= 5 && state !== 'sleep' && (
            <g className="animate-pulse opacity-80">
              <polygon points="15,20 17,25 22,27 17,29 15,34 13,29 8,27 13,25" fill="#FBBF24" />
              <polygon points="85,30 86,33 89,34 86,35 85,38 84,35 81,34 84,33" fill="#FBBF24" />
              <polygon points="20,70 21,72 23,73 21,74 20,76 19,74 17,73 19,72" fill="#FBBF24" />
            </g>
          )}

          {/* Shadow */}
          <ellipse cx="50" cy="88" rx="25" ry="5" fill="#E5E7EB" />

          {/* Ears */}
          {/* Left Ear */}
          <circle cx="28" cy="24" r="8" fill="#1F2937" />
          <circle cx="28" cy="24" r="4" fill="#374151" />
          
          {/* Right Ear */}
          <circle cx="72" cy="24" r="8" fill="#1F2937" />
          <circle cx="72" cy="24" r="4" fill="#374151" />

          {/* Royal Cape (Level 5) */}
          {petLevel >= 5 && (
            <path d="M 25 50 Q 10 90 20 85 Q 50 95 80 85 Q 90 90 75 50 Z" fill="#EF4444" opacity="0.9" />
          )}

          {/* Body/Torso */}
          <ellipse cx="50" cy="68" rx="22" ry="18" fill="#FFFFFF" stroke="#1F2937" strokeWidth="2" />
          {/* Belly patch */}
          <ellipse cx="50" cy="71" rx="15" ry="11" fill="#F3F4F6" />

          {/* Equipped Body Cape */}
          {equippedItems['body'] === 'body_cape' && (
            <path d="M 28 50 Q 15 90 25 85 Q 50 95 75 85 Q 85 90 72 50 Z" fill="#EF4444" opacity="0.9" />
          )}

          {/* Guardian Armor (Level 4+) */}
          {petLevel >= 4 && (
            <path d="M 36 60 Q 50 75 64 60 Q 50 50 36 60" fill="#9CA3AF" stroke="#6B7280" strokeWidth="1" />
          )}

          {/* Left Arm / Shoulder */}
          <path 
            d={
              state === 'slouch'
                ? "M 28 60 Q 20 68 28 76" // drooping down
                : state === 'close'
                ? "M 28 60 Q 32 46 36 50" // covering face
                : "M 28 60 Q 20 54 24 48" // regular wave
            }
            stroke="#1F2937" 
            strokeWidth="8" 
            strokeLinecap="round" 
            fill="none" 
          />

          {/* Right Arm */}
          <path 
            d={
              state === 'slouch'
                ? "M 72 60 Q 80 68 72 76" // drooping down
                : state === 'close'
                ? "M 72 60 Q 68 46 64 50" // covering face
                : state === 'success'
                ? "M 72 60 Q 82 45 88 50" // cheering up
                : "M 72 60 Q 80 54 76 48" // regular
            }
            stroke="#1F2937" 
            strokeWidth="8" 
            strokeLinecap="round" 
            fill="none" 
          />

          {/* Legs */}
          <ellipse cx="36" cy="85" rx="6" ry="5" fill="#1F2937" />
          <ellipse cx="64" cy="85" rx="6" ry="5" fill="#1F2937" />

          {/* Student Bag (Level 2+) */}
          {petLevel >= 2 && petLevel < 5 && (
            <rect x="70" y="55" width="12" height="16" rx="3" fill="#3B82F6" stroke="#2563EB" strokeWidth="1" transform="rotate(-15 70 55)" />
          )}

          {/* Head base */}
          <ellipse 
            cx="50" 
            cy="38" 
            rx="24" 
            ry="20" 
            fill="#FFFFFF" 
            stroke="#1F2937" 
            strokeWidth="2.5" 
            style={{ 
              transformOrigin: '50% 50%',
              // Slouch tilts the head forward
              transform: state === 'slouch' ? 'rotate(8deg) translateY(2px)' : 'none' 
            }} 
          />

          {/* Face Elements group (moves slightly depending on posture) */}
          <g style={{
            transform: state === 'slouch' 
              ? 'translate(-2px, 3px)' 
              : state === 'close' 
              ? 'scale(1.05) translate(0px, 1px)' 
              : 'none',
            transformOrigin: '50% 38%'
          }}>
            {/* Eye Patches (Panda signature black circles) */}
            {/* Left Eye Patch */}
            <ellipse cx="40" cy="36" rx="6" ry="8" fill="#1F2937" style={{ transform: 'rotate(-10deg)', transformOrigin: '40px 36px' }} />
            {/* Right Eye Patch */}
            <ellipse cx="60" cy="36" rx="6" ry="8" fill="#1F2937" style={{ transform: 'rotate(10deg)', transformOrigin: '60px 36px' }} />

            {/* Equipped Glasses */}
            {(equippedItems['eyes'] === 'eyes_glasses' || petLevel >= 2) && equippedItems['eyes'] !== 'eyes_sunglasses' && (
              <g stroke="#FBBF24" strokeWidth="1.5" fill="none">
                <circle cx="40" cy="36" r="8" />
                <circle cx="60" cy="36" r="8" />
                <path d="M 48 36 L 52 36" />
              </g>
            )}

            {equippedItems['eyes'] === 'eyes_sunglasses' && (
              <g>
                <path d="M 30 36 Q 40 30 48 36 Q 40 42 30 36" fill="#111827" stroke="#000" strokeWidth="1" />
                <path d="M 52 36 Q 60 30 70 36 Q 60 42 52 36" fill="#111827" stroke="#000" strokeWidth="1" />
                <path d="M 48 34 L 52 34" stroke="#111827" strokeWidth="2" />
              </g>
            )}

            {/* Eyes */}
            {state === 'close' || state === 'sleep' ? (
              // Crying / squinting / closed eyes
              <>
                <path d="M 37 36 L 43 36 M 38 34 L 42 38" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M 57 36 L 63 36 M 58 38 L 62 34" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
              </>
            ) : state === 'slouch' || state === 'tired' ? (
              // Sad / drooping eyes
              <>
                <path d="M 37 38 Q 40 34 43 37" fill="none" stroke="#FFFFFF" strokeWidth="2.0" strokeLinecap="round" />
                <path d="M 57 37 Q 60 34 63 38" fill="none" stroke="#FFFFFF" strokeWidth="2.0" strokeLinecap="round" />
                {state === 'tired' && (
                   <>
                     <circle cx="35" cy="40" r="1.5" fill="#60A5FA" />
                     <circle cx="65" cy="40" r="1.5" fill="#60A5FA" />
                   </>
                )}
              </>
            ) : (
              // Normal happy / sparkling eyes
              <>
                <circle cx="41" cy="35" r="2.5" fill="#FFFFFF" />
                <circle cx="42" cy="34" r="1.0" fill="#FFFFFF" />
                <circle cx="59" cy="35" r="2.5" fill="#FFFFFF" />
                <circle cx="60" cy="34" r="1.0" fill="#FFFFFF" />
              </>
            )}

            {/* Cheeks blush */}
            {state === 'good' || state === 'success' ? (
              <>
                <circle cx="32" cy="42" r="2.5" fill="#FF8A8A" opacity="0.6" />
                <circle cx="68" cy="42" r="2.5" fill="#FF8A8A" opacity="0.6" />
              </>
            ) : null}

            {/* Snout */}
            <ellipse cx="50" cy="44" rx="6" ry="4" fill="#F3F4F6" stroke="#E5E7EB" strokeWidth="0.5" />
            
            {/* Nose */}
            <path d="M 48 43 L 52 43 L 50 45 Z" fill="#1F2937" />

            {/* Mouth */}
            {state === 'good' || state === 'success' || state === 'writing' ? (
              // Happy mouth
              <path d="M 47 47 Q 50 50 53 47" fill="none" stroke="#1F2937" strokeWidth="1.5" strokeLinecap="round" />
            ) : state === 'sleep' ? (
              // Sleep mouth
              <circle cx="50" cy="48" r="1.5" fill="#1F2937" />
            ) : (
              // Sad / flat mouth
              <path d="M 47 49 Q 50 46 53 49" fill="none" stroke="#1F2937" strokeWidth="1.5" strokeLinecap="round" />
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
    </div>
  );
};
export default OliverPet;
