import React from 'react';

interface BackboneVisualizerProps {
  neckAngle: number;
  slouchAngle: number;
  healthScore: number;
}

export const BackboneVisualizer: React.FC<BackboneVisualizerProps> = ({ neckAngle, slouchAngle, healthScore }) => {
  // Normalize angles for SVG (0 to max curve)
  const neckCurve = Math.min(neckAngle, 60); // max 60 deg visual
  const backCurve = Math.min(slouchAngle, 45); // max 45 deg visual
  
  // Calculate color based on healthScore
  const color = healthScore >= 80 ? '#4EAD63' : healthScore >= 60 ? '#FFAA2C' : '#FF5E5E';
  
  // Generate SVG path based on angles
  // Start from bottom (pelvis) to top (head)
  // X offset simulates the bend.
  const startX = 50;
  const startY = 90;
  
  const midY = 50;
  const midX = startX + (backCurve * 0.8);
  
  const topY = 15;
  const topX = midX + (neckCurve * 0.6);
  
  return (
    <div className="absolute left-4 top-1/2 transform -translate-y-1/2 w-16 h-32 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 flex flex-col items-center justify-center p-2 shadow-lg z-10 pointer-events-none">
      <div className="text-[10px] font-bold text-white mb-1 uppercase tracking-wider opacity-80">Cột sống</div>
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md">
        {/* Animated Backbone Path */}
        <path
          d={`M ${startX} ${startY} Q ${midX + (backCurve * 0.5)} ${midY} ${midX} ${midY} T ${topX} ${topY}`}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          className="transition-all duration-500 ease-in-out"
        />
        
        {/* Head Node */}
        <circle cx={topX} cy={topY - 5} r="6" fill={color} className="transition-all duration-500 ease-in-out" />
        
        {/* Vertebrae Dots */}
        <circle cx={startX} cy={startY} r="3" fill="#ffffff" />
        <circle cx={(startX + midX)/2} cy={(startY + midY)/2} r="3" fill="#ffffff" />
        <circle cx={midX} cy={midY} r="3" fill="#ffffff" />
        <circle cx={(midX + topX)/2} cy={(midY + topY)/2} r="3" fill="#ffffff" />
      </svg>
    </div>
  );
};

export default BackboneVisualizer;
