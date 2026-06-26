// Calibration Component for setting baseline student landmarks

import React, { useState, useEffect } from 'react';
import { Camera, CheckCircle, HelpCircle } from 'lucide-react';
import type { Landmark, CalibrationData } from '../services/postureAI';
import { saveCalibration } from '../services/db';

interface CalibrationProps {
  poseLandmarks: Landmark[] | null;
  faceLandmarks: Landmark[] | null;
  onCalibrationComplete: (data: CalibrationData) => void;
  isModelReady: boolean;
}

export const Calibration: React.FC<CalibrationProps> = ({
  poseLandmarks,
  faceLandmarks,
  onCalibrationComplete,
  isModelReady,
}) => {
  const [step, setStep] = useState<'idle' | 'counting' | 'saving' | 'complete'>('idle');
  const [countdown, setCountdown] = useState<number>(3);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timer: any;
    if (step === 'counting') {
      if (countdown > 0) {
        timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      } else {
        performCalibration();
      }
    }
    return () => clearTimeout(timer);
  }, [step, countdown]);

  const startCalibration = () => {
    if (!isModelReady || !poseLandmarks || !faceLandmarks) {
      setError('Vui lòng đợi mô hình AI tải xong và webcam hiển thị rõ mặt.');
      return;
    }
    setError(null);
    setCountdown(3);
    setStep('counting');
  };

  const performCalibration = () => {
    if (!poseLandmarks || !faceLandmarks || poseLandmarks.length < 13 || faceLandmarks.length < 363) {
      setError('Không tìm thấy khuôn mặt hoặc cơ thể. Hãy ngồi chính giữa khung hình.');
      setStep('idle');
      return;
    }

    try {
      const nose = poseLandmarks[0];
      const leftShoulder = poseLandmarks[11];
      const rightShoulder = poseLandmarks[12];
      const headTop = faceLandmarks[10] || nose;

      const shoulderMid = {
        x: (leftShoulder.x + rightShoulder.x) / 2,
        y: (leftShoulder.y + rightShoulder.y) / 2,
      };

      // 1. Base Eye distance in pixels
      const leftEyeOuter = faceLandmarks[33];
      const leftEyeInner = faceLandmarks[133];
      const rightEyeInner = faceLandmarks[362];
      const rightEyeOuter = faceLandmarks[263];

      const leftEyeCenter = {
        x: (leftEyeOuter.x + leftEyeInner.x) / 2,
        y: (leftEyeOuter.y + leftEyeInner.y) / 2,
      };
      const rightEyeCenter = {
        x: (rightEyeInner.x + rightEyeOuter.x) / 2,
        y: (rightEyeInner.y + rightEyeOuter.y) / 2,
      };

      // We assume standard canvas size of 640x480 for calculation scaling
      const baseEyeDistance = Math.sqrt(
        Math.pow(leftEyeCenter.x - rightEyeCenter.x, 2) + Math.pow(leftEyeCenter.y - rightEyeCenter.y, 2)
      ) * 640;

      // 2. Base Neck Offset (vertical length)
      const baseNeckYOffset = (shoulderMid.y - nose.y) * 480;

      // 3. Base Shoulder height difference
      const baseShoulderYDiff = Math.abs(leftShoulder.y - rightShoulder.y) * 480;

      // 4. Base Torso Height (head top to shoulders)
      const baseTorsoHeight = (shoulderMid.y - headTop.y) * 480;

      // 5. Base Eye Aspect Ratio (EAR)
      // EAR = average left/right EAR
      const calculateEARLocal = (p1: Landmark, p2: Landmark, p3: Landmark, p4: Landmark, p5: Landmark, p6: Landmark) => {
        const v1 = Math.sqrt(Math.pow(p2.x - p6.x, 2) + Math.pow(p2.y - p6.y, 2));
        const v2 = Math.sqrt(Math.pow(p3.x - p5.x, 2) + Math.pow(p3.y - p5.y, 2));
        const h = Math.sqrt(Math.pow(p1.x - p4.x, 2) + Math.pow(p1.y - p4.y, 2));
        return h === 0 ? 0 : (v1 + v2) / (2.0 * h);
      };

      const leftEAR = calculateEARLocal(
        faceLandmarks[133], faceLandmarks[159], faceLandmarks[158],
        faceLandmarks[33], faceLandmarks[145], faceLandmarks[153]
      );
      const rightEAR = calculateEARLocal(
        faceLandmarks[362], faceLandmarks[386], faceLandmarks[385],
        faceLandmarks[263], faceLandmarks[374], faceLandmarks[380]
      );

      const baseEAR = (leftEAR + rightEAR) / 2;

      const calibrationData: CalibrationData = {
        baseEyeDistance: Math.max(40, baseEyeDistance),
        baseNeckYOffset: Math.max(50, baseNeckYOffset),
        baseShoulderYDiff,
        baseTorsoHeight: Math.max(100, baseTorsoHeight),
        baseEAR: Math.max(0.18, baseEAR),
      };

      saveCalibration(calibrationData);
      setStep('complete');
      setTimeout(() => {
        onCalibrationComplete(calibrationData);
      }, 1000);
    } catch (e) {
      console.error(e);
      setError('Lỗi tính toán chỉ số hiệu chuẩn. Hãy thử lại.');
      setStep('idle');
    }
  };

  return (
    <div className="glass-card p-6 flex flex-col items-center justify-center text-center max-w-lg mx-auto my-6 fade-in">
      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-green-600 mb-4">
        <Camera size={32} />
      </div>
      
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Hiệu chỉnh Tư thế Chuẩn</h2>
      <p className="text-gray-600 mb-6 leading-relaxed">
        Để hệ thống AI đo lường tư thế gù lưng và khoảng cách mắt chính xác nhất, bạn vui lòng:
        <br />
        <strong className="text-green-600">1. Ngồi thẳng lưng chuẩn.</strong>
        <br />
        <strong className="text-green-600">2. Mắt nhìn thẳng vào màn hình, cách camera 50cm - 70cm.</strong>
      </p>

      {step === 'idle' && (
        <button
          onClick={startCalibration}
          disabled={!isModelReady}
          className={`px-8 py-3 rounded-xl font-semibold shadow-sm transition-all duration-300 ${
            isModelReady 
              ? 'bg-green-600 text-white hover:bg-green-700 hover:shadow-md' 
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {isModelReady ? 'Bắt đầu Hiệu chỉnh' : 'Đang tải AI Model...'}
        </button>
      )}

      {step === 'counting' && (
        <div className="text-6xl font-black text-green-600 animate-ping">
          {countdown}
        </div>
      )}

      {step === 'complete' && (
        <div className="flex flex-col items-center text-green-600">
          <CheckCircle size={48} className="animate-bounce mb-2" />
          <span className="font-semibold text-lg">Đã lưu tư thế chuẩn thành công!</span>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">
          {error}
        </div>
      )}

      <div className="mt-6 flex items-center gap-2 text-xs text-gray-400 bg-gray-50 p-3 rounded-xl">
        <HelpCircle size={16} className="text-gray-400 flex-shrink-0" />
        <span>Hệ thống chỉ lưu tọa độ số liệu khung xương ảo trên máy của bạn. Tuyệt đối không lưu ảnh thực tế.</span>
      </div>
    </div>
  );
};
export default Calibration;
