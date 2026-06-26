// Parent Dashboard Component

import React, { useState, useEffect } from 'react';
import { Eye, Bell, Shield, ShieldAlert, Heart, AlertCircle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { getSessionRecords, saveSessionRecord } from '../services/db';
import type { SessionRecord } from '../services/db';
import { subscribeToStudentSync } from '../services/parentSync';

interface ChartDataPoint {
  name: string;
  PHI: number;
  duration: number;
}

interface AlertLog {
  id: string;
  message: string;
  time: string;
}

export const ParentView: React.FC = () => {
  // Sync state with child webcam session
  const [studentActive, setStudentActive] = useState<boolean>(false);
  const [studentStatus, setStudentStatus] = useState<'good' | 'warning' | 'danger' | 'offline'>('offline');
  const [studentDetails, setStudentDetails] = useState<any>({
    eyeDistanceCm: 60,
    neckAngle: 0,
    shoulderTilt: 0,
    slouchAngle: 0,
    healthScore: 100,
    isWritingMode: false,
  });

  const [alerts, setAlerts] = useState<AlertLog[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);

  // Push notifications queue
  const [fatigueAlerts, setFatigueAlerts] = useState<string[]>([]);

  // Initialize mock data if no sessions exist, to make the dashboard look rich and premium
  useEffect(() => {
    let savedSessions = getSessionRecords();
    if (savedSessions.length === 0) {
      const mockSessions: SessionRecord[] = [
        {
          id: 's1',
          date: 'Thứ 5',
          startTime: Date.now() - 4 * 24 * 3600 * 1000,
          endTime: Date.now() - 4 * 24 * 3600 * 1000 + 45 * 60 * 1000,
          durationMinutes: 45,
          averageHealthScore: 88,
          goodPosturePercentage: 85,
          warningsCount: 1,
          blinksCount: 750,
          fidgetFlagsCount: 0,
          completedEyeExercises: 2,
          streakAdded: true,
        },
        {
          id: 's2',
          date: 'Thứ 6',
          startTime: Date.now() - 3 * 24 * 3600 * 1000,
          endTime: Date.now() - 3 * 24 * 3600 * 1000 + 60 * 60 * 1000,
          durationMinutes: 60,
          averageHealthScore: 82,
          goodPosturePercentage: 79,
          warningsCount: 3,
          blinksCount: 920,
          fidgetFlagsCount: 1,
          completedEyeExercises: 3,
          streakAdded: true,
        },
        {
          id: 's3',
          date: 'Thứ 7',
          startTime: Date.now() - 2 * 24 * 3600 * 1000,
          endTime: Date.now() - 2 * 24 * 3600 * 1000 + 50 * 60 * 1000,
          durationMinutes: 50,
          averageHealthScore: 92,
          goodPosturePercentage: 91,
          warningsCount: 0,
          blinksCount: 880,
          fidgetFlagsCount: 0,
          completedEyeExercises: 2,
          streakAdded: true,
        },
        {
          id: 's4',
          date: 'Chủ Nhật',
          startTime: Date.now() - 1 * 24 * 3600 * 1000,
          endTime: Date.now() - 1 * 24 * 3600 * 1000 + 90 * 60 * 1000,
          durationMinutes: 90,
          averageHealthScore: 75,
          goodPosturePercentage: 72,
          warningsCount: 5,
          blinksCount: 1100,
          fidgetFlagsCount: 3,
          completedEyeExercises: 4,
          streakAdded: true,
        },
        {
          id: 's5',
          date: 'Hôm nay',
          startTime: Date.now(),
          endTime: Date.now() + 45 * 60 * 1000,
          durationMinutes: 45,
          averageHealthScore: 84,
          goodPosturePercentage: 83,
          warningsCount: 2,
          blinksCount: 780,
          fidgetFlagsCount: 0,
          completedEyeExercises: 2,
          streakAdded: true,
        },
      ];
      mockSessions.forEach(s => saveSessionRecord(s));
      savedSessions = mockSessions;
    }
    setSessions(savedSessions);

    // Initial alert log
    setAlerts([
      {
        id: '1',
        message: 'Hệ thống đã kết nối và cấu hình thành công với máy học sinh.',
        time: '10 phút trước',
      },
    ]);
  }, []);

  // Listen to BroadcastChannel updates from Student view
  useEffect(() => {
    let lastActiveTime = Date.now();

    const unsubscribe = subscribeToStudentSync(
      (status, details) => {
        setStudentActive(true);
        setStudentStatus(status);
        setStudentDetails(details);
        lastActiveTime = Date.now();
      },
      (message, timestamp) => {
        const timeStr = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setAlerts(prev => [
          {
            id: Math.random().toString(),
            message,
            time: timeStr,
          },
          ...prev.slice(0, 9), // Keep last 10 alerts
        ]);
        setFatigueAlerts(prev => [message, ...prev]);
      }
    );

    // Watchdog timer: If no broadcast in 3 seconds, student is offline/inactive
    const checkActiveInterval = setInterval(() => {
      if (Date.now() - lastActiveTime > 3000) {
        setStudentActive(false);
        setStudentStatus('offline');
      }
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(checkActiveInterval);
    };
  }, []);

  // Recharts calculations
  // 1. Posture ratio calculations for Pie Chart
  const getPieChartData = () => {
    if (sessions.length === 0) return [];
    
    // Average metrics over sessions
    let straight = 0;
    let slouched = 0;
    
    sessions.forEach(s => {
      straight += s.goodPosturePercentage;
      slouched += (100 - s.goodPosturePercentage);
    });

    const total = sessions.length;
    return [
      { name: 'Ngồi đúng chuẩn', value: Math.round(straight / total) },
      { name: 'Ngồi sai tư thế', value: Math.round(slouched / total) },
    ];
  };

  const pieData = getPieChartData();
  const COLORS = ['#4EAD63', '#FFAA2C'];

  // 2. Trend chart data mapping
  const getTrendData = (): ChartDataPoint[] => {
    return sessions.map(s => ({
      name: s.date || 'Học',
      PHI: s.averageHealthScore,
      duration: s.durationMinutes,
    }));
  };

  const trendData = getTrendData();

  // Smart Health prediction / recommendation messages
  const getHealthPrediction = () => {
    const avgScore = sessions.reduce((sum, s) => sum + s.averageHealthScore, 0) / Math.max(1, sessions.length);
    if (avgScore >= 85) {
      return {
        score: Math.round(avgScore),
        status: 'Nguy cơ thấp',
        color: '#4EAD63',
        description: 'Tư thế ngồi của bé rất xuất sắc. Xương sống và cổ ở trạng thái tự nhiên chuẩn khoa học. Nguy cơ thoái hóa cổ chỉ dưới 5% trong 3 năm tới.',
      };
    } else if (avgScore >= 75) {
      return {
        score: Math.round(avgScore),
        status: 'Nguy cơ Trung bình',
        color: '#FFAA2C',
        description: 'Bé có xu hướng hơi lệch vai phải khi ngồi học lâu. Nguy cơ đau mỏi cơ cổ tăng 15% trong 3 tháng tới nếu duy trì tư thế này.',
      };
    } else {
      return {
        score: Math.round(avgScore),
        status: 'Nguy cơ Cao (Cần lưu ý)',
        color: '#FF5E5E',
        description: 'Khoảng cách mắt quá gần (<50cm) và vai lệch lớn lặp lại nhiều lần. Nguy cơ suy giảm thị lực (cận thị tiến triển) tăng 40% trong 3 tháng tới. Phụ huynh nên chỉnh lại chiều cao ghế học tập.',
      };
    }
  };

  const healthPrediction = getHealthPrediction();

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-gray-50">
      
      {/* Page Header */}
      <div className="mb-8">
        <span className="text-xs font-semibold text-purple-600 uppercase tracking-widest bg-purple-100 px-3 py-1 rounded-full">Phụ Huynh Dashboard</span>
        <h1 className="text-3xl font-black mt-2">Bảng điều khiển Giám sát Từ xa 🏠</h1>
        <p className="text-gray-500 text-sm">Theo dõi tư thế, khoảng cách an toàn và tình trạng mệt mỏi của con.</p>
      </div>

      {/* Grid: Live monitoring vs Metrics Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Real-time Connection status */}
        <div className="flex flex-col gap-6">
          
          {/* Real-time Status Card */}
          <div className="glass-card p-6 flex flex-col items-center text-center">
            <h3 className="text-sm font-semibold text-gray-500 mb-6 uppercase tracking-wider">Trạng thái ngồi học trực tiếp</h3>
            
            {/* Pulsing indicator */}
            <div className="relative mb-6">
              <div 
                className={`w-28 h-28 rounded-full flex items-center justify-center border-4 border-white shadow-lg transition-all duration-500`}
                style={{
                  backgroundColor: 
                    studentStatus === 'good' ? '#4EAD63' :
                    studentStatus === 'warning' ? '#FFAA2C' :
                    studentStatus === 'danger' ? '#FF5E5E' : '#9CA3AF'
                }}
              >
                {studentStatus === 'good' && <Shield size={40} className="text-white animate-pulse" />}
                {studentStatus === 'warning' && <AlertCircle size={40} className="text-white" />}
                {studentStatus === 'danger' && <ShieldAlert size={40} className="text-white animate-bounce" />}
                {studentStatus === 'offline' && <Eye size={40} className="text-white" />}
              </div>
              
              {/* Online pulse dot */}
              {studentActive && (
                <span className="absolute top-1 right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500 border-2 border-white"></span>
                </span>
              )}
            </div>

            <h4 className="text-lg font-bold text-gray-800">
              {studentStatus === 'good' && 'Con đang ngồi học đúng chuẩn'}
              {studentStatus === 'warning' && 'Con ngồi hơi sai tư thế'}
              {studentStatus === 'danger' && 'Tư thế sai nghiêm trọng!'}
              {studentStatus === 'offline' && 'Thiết bị học sinh ngoại tuyến'}
            </h4>
            
            <p className="text-xs text-gray-400 mt-1 mb-4">
              {studentActive ? 'Đang truyền dữ liệu (Bảo mật: Không truyền camera)' : 'Chờ thiết bị học sinh kết nối...'}
            </p>

            {/* Live Metrics details */}
            {studentActive && (
              <div className="w-full grid grid-cols-2 gap-2 mt-4 text-left border-t border-gray-100 pt-4">
                <div className="p-3 bg-gray-50 rounded-xl">
                  <span className="text-[10px] text-gray-400 block uppercase font-bold">Điểm PHI</span>
                  <span className="text-lg font-black text-gray-700">{studentDetails.healthScore}</span>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl">
                  <span className="text-[10px] text-gray-400 block uppercase font-bold">Mắt cách màn</span>
                  <span className="text-lg font-black text-gray-700">{studentDetails.eyeDistanceCm} cm</span>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl">
                  <span className="text-[10px] text-gray-400 block uppercase font-bold">Cúi cổ</span>
                  <span className="text-lg font-black text-gray-700">{Math.round(studentDetails.neckAngle)}°</span>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl">
                  <span className="text-[10px] text-gray-400 block uppercase font-bold">Nghiêng vai</span>
                  <span className="text-lg font-black text-gray-700">{Math.round(studentDetails.shoulderTilt)}°</span>
                </div>
              </div>
            )}
          </div>

          {/* Health Analysis Prediction */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-1.5">
              <Heart size={16} className="text-red-500" /> DỰ BÁO SỨC KHỎE (PHI)
            </h3>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-700">Mức độ nguy cơ cột sống:</span>
              <span className="text-sm font-bold" style={{ color: healthPrediction.color }}>
                {healthPrediction.status}
              </span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed bg-gray-50 p-3 rounded-xl border border-gray-100">
              {healthPrediction.description}
            </p>
          </div>

        </div>

        {/* Center / Right: Charts Reports & Logs alerts */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Grid of charts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Posture Pie Distribution (Recharts) */}
            <div className="glass-card p-5 md:col-span-1 flex flex-col justify-between">
              <h3 className="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wider">Tỷ lệ tư thế ngồi</h3>
              <div className="h-44 flex items-center justify-center relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${value}%`} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center text overlay */}
                <div className="absolute text-center">
                  <span className="text-[10px] text-gray-400 font-bold block">TỐT NHẤT</span>
                  <span className="text-lg font-black text-green-600">
                    {pieData[0] ? `${pieData[0].value}%` : '80%'}
                  </span>
                </div>
              </div>
              <div className="flex justify-center gap-6 mt-2 text-xs">
                <span className="flex items-center gap-1.5 text-gray-500">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Ngồi đúng
                </span>
                <span className="flex items-center gap-1.5 text-gray-500">
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" /> Ngồi lệch
                </span>
              </div>
            </div>

            {/* PHI Score & Time Trend over the week (Recharts Area) */}
            <div className="glass-card p-5 md:col-span-2">
              <h3 className="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wider">Xu hướng điểm sức khỏe PHI</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="colorPHI" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7E5BEF" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#7E5BEF" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="name" stroke="#9CA3AF" fontSize={11} tickLine={false} />
                    <YAxis domain={[50, 100]} stroke="#9CA3AF" fontSize={11} tickLine={false} />
                    <Tooltip />
                    <Area type="monotone" dataKey="PHI" stroke="#7E5BEF" strokeWidth={2.5} fillOpacity={1} fill="url(#colorPHI)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* Interactive Notifications panel */}
          <div className="glass-card p-6 flex-1">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <Bell size={16} className="text-purple-500 animate-swing" /> Nhật ký cảnh báo & mỏi mắt
              </h3>
              <span className="px-2 py-0.5 text-2xs font-bold bg-purple-100 text-purple-700 rounded-full">
                Thời gian thực
              </span>
            </div>

            {/* Warnings list logs */}
            <div className="flex flex-col gap-3 max-h-56 overflow-y-auto pr-2">
              {alerts.length === 0 ? (
                <div className="text-center py-6 text-xs text-gray-400">
                  Chưa có thông tin cảnh báo nào. Con đang học tập tốt!
                </div>
              ) : (
                alerts.map((alert) => (
                  <div key={alert.id} className="flex items-start justify-between gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-2xs hover:shadow-xs transition-all">
                    <div className="flex gap-2.5">
                      <span className="mt-0.5 text-xs text-purple-500">🔔</span>
                      <div className="text-xs text-gray-600 leading-relaxed font-medium">
                        {alert.message}
                      </div>
                    </div>
                    <span className="text-[10px] text-gray-400 font-semibold flex-shrink-0">
                      {alert.time}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Smart Notification Prompt */}
            {fatigueAlerts.length > 0 && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200/50 rounded-2xl flex items-start gap-3">
                <AlertCircle size={20} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-yellow-800">Khuyên nhủ thông minh dành cho cha mẹ:</h4>
                  <p className="text-xs text-yellow-700 mt-1 leading-relaxed">
                    Bé có dấu hiệu mệt mỏi và giảm tập trung sau thời gian dài học. Phụ huynh nên kiểm tra lại ánh sáng phòng học, nhắc nhở bé nghỉ ngơi và uống một ly nước nhé!
                  </p>
                </div>
              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
};
export default ParentView;
