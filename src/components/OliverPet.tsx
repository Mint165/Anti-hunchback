// Oliver the Panda Interactive SVG Component

import React from 'react';

export type PetState = 'good' | 'slouch' | 'close' | 'writing' | 'tired' | 'success';

interface OliverPetProps {
  state: PetState;
  customText?: string;
  size?: number;
}

export const OliverPet: React.FC<OliverPetProps> = ({ state, customText, size = 200 }) => {
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
        return 'Mắt mỏi quá rồi, chớp mắt nhiều hơn hoặc nhắm mắt thư giãn đi!';
      case 'success':
        return 'Tuyệt cú mèo! Lưng thẳng tắp, mắt sáng ngời!';
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
      case 'tired':
      case 'slouch': return '#FFAA2C';
      case 'close': return '#FF5E5E';
      default: return '#4EAD63';
    }
  };

  const themeColor = getThemeColor();

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 w-full" style={{ maxWidth: '350px' }}>
      
      {/* Dialogue Bubble */}
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

      {/* Interactive SVG Panda */}
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        
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
          {/* Shadow */}
          <ellipse cx="50" cy="88" rx="25" ry="5" fill="#E5E7EB" />

          {/* Ears */}
          {/* Left Ear */}
          <circle cx="28" cy="24" r="8" fill="#1F2937" />
          <circle cx="28" cy="24" r="4" fill="#374151" />
          
          {/* Right Ear */}
          <circle cx="72" cy="24" r="8" fill="#1F2937" />
          <circle cx="72" cy="24" r="4" fill="#374151" />

          {/* Body/Torso */}
          <ellipse cx="50" cy="68" rx="22" ry="18" fill="#FFFFFF" stroke="#1F2937" strokeWidth="2" />
          {/* Belly patch */}
          <ellipse cx="50" cy="71" rx="15" ry="11" fill="#F3F4F6" />

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

            {/* Eyes */}
            {state === 'close' ? (
              // Crying / squinting eyes
              <>
                <path d="M 37 36 L 43 36 M 38 34 L 42 38" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M 57 36 L 63 36 M 58 38 L 62 34" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
              </>
            ) : state === 'slouch' || state === 'tired' ? (
              // Sad / drooping eyes
              <>
                <path d="M 37 38 Q 40 34 43 37" fill="none" stroke="#FFFFFF" strokeWidth="2.0" strokeLinecap="round" />
                <path d="M 57 37 Q 60 34 63 38" fill="none" stroke="#FFFFFF" strokeWidth="2.0" strokeLinecap="round" />
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
            ) : (
              // Sad / flat mouth
              <path d="M 47 49 Q 50 46 53 49" fill="none" stroke="#1F2937" strokeWidth="1.5" strokeLinecap="round" />
            )}
          </g>

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
        {state === 'tired' && 'Cần nhấp nháy mắt'}
        {state === 'success' && 'Hoàn thành'}
      </div>
    </div>
  );
};
export default OliverPet;
