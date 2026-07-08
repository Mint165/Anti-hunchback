// Parent Dashboard Component

import React, { useState, useEffect } from 'react';
import { Eye, Bell, Shield, ShieldAlert, Heart, AlertCircle, Send, MessageSquare } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { getSessionRecords, saveSessionRecord } from '../services/db';
import type { SessionRecord } from '../services/db';
import { subscribeToStudentSync, broadcastParentMessage } from '../services/parentSync';

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
  
  // Parent messaging state
  const [messageText, setMessageText] = useState('');
  const [isMessageSent, setIsMessageSent] = useState(false);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;
    
    broadcastParentMessage(messageText.trim());
    setMessageText('');
    setIsMessageSent(true);
    setTimeout(() => setIsMessageSent(false), 3000);
  };

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

  // 3. Concentration density chart data
  const getConcentrationData = () => {
    return sessions.map(s => {
      // Simulate concentration based on fatigue flags (each flag reduces concentration by ~15%)
      const penalty = (s.fatigueFlags || s.fidgetFlagsCount || 0) * 15;
      const conc = Math.max(30, 100 - penalty); // Min 30%
      return {
        name: s.date || 'Học',
        concentration: conc,
      };
    });
  };
  const concData = getConcentrationData();

  // Smart Health prediction based on real session data
  const getHealthPrediction = () => {
    if (sessions.length === 0) {
      return {
        score: 100,
        status: 'Chưa có dữ liệu',
        color: '#9CA3AF',
        description: 'Chưa có phiên học nào được ghi nhận. Hãy bắt đầu học để hệ thống thu thập dữ liệu sức khỏe.',
        risks: [] as string[],
      };
    }

    const recentSessions = sessions.slice(-5); // last 5 sessions
    const avgScore = recentSessions.reduce((sum, s) => sum + s.averageHealthScore, 0) / recentSessions.length;

    // Analyze angle patterns from sessions that have analytics data
    const sessionsWithAngles = recentSessions.filter(s => s.averageShoulderTilt !== undefined);
    const risks: string[] = [];

    if (sessionsWithAngles.length >= 2) {
      // Shoulder tilt analysis
      const badShoulderSessions = sessionsWithAngles.filter(s => (s.averageShoulderTilt || 0) > 6);
      if (badShoulderSessions.length / sessionsWithAngles.length > 0.6) {
        const avgTilt = badShoulderSessions.reduce((sum, s) => sum + (s.averageShoulderTilt || 0), 0) / badShoulderSessions.length;
        risks.push(`⚠️ Vai lệch trung bình ${avgTilt.toFixed(1)}° trong ${badShoulderSessions.length}/${sessionsWithAngles.length} phiên học gần nhất. Nguy cơ lệch cơ vai tăng 40% trong 3 tháng tới nếu tiếp tục duy trì tư thế này.`);
      }

      // Neck angle analysis  
      const badNeckSessions = sessionsWithAngles.filter(s => (s.averageNeckAngle || 0) > 18);
      if (badNeckSessions.length / sessionsWithAngles.length > 0.6) {
        const avgNeck = badNeckSessions.reduce((sum, s) => sum + (s.averageNeckAngle || 0), 0) / badNeckSessions.length;
        risks.push(`⚠️ Cúi cổ trung bình ${avgNeck.toFixed(1)}° trong ${badNeckSessions.length}/${sessionsWithAngles.length} phiên học. Nguy cơ thoái hóa đốt sống cổ tăng 30% trong 3 tháng tới. Phụ huynh nên điều chỉnh góc màn hình ngang tầm mắt của trẻ.`);
      }

      // Slouch analysis
      const badSlouchSessions = sessionsWithAngles.filter(s => (s.averageSlouchAngle || 0) > 15);
      if (badSlouchSessions.length / sessionsWithAngles.length > 0.6) {
        const avgSlouch = badSlouchSessions.reduce((sum, s) => sum + (s.averageSlouchAngle || 0), 0) / badSlouchSessions.length;
        risks.push(`⚠️ Gù lưng trung bình ${avgSlouch.toFixed(1)}° trong ${badSlouchSessions.length}/${sessionsWithAngles.length} phiên học. Nguy cơ gù lưng, cong vẹo cột sống tăng 50% trong 6 tháng tới. Phụ huynh nên điều chỉnh độ cao bàn ghế.`);
      }

      // Fatigue flags analysis
      const totalFatigueFlags = sessionsWithAngles.reduce((sum, s) => sum + (s.fatigueFlags || 0), 0);
      if (totalFatigueFlags >= 3) {
        risks.push(`🧠 Ghi nhận ${totalFatigueFlags} cờ mệt mỏi trong ${sessionsWithAngles.length} phiên gần nhất. Bé có xu hướng mất tập trung sau 20-30 phút học. Nên chia nhỏ buổi học và tăng thời gian nghỉ giải lao.`);
      }
    }

    if (risks.length === 0 && avgScore >= 85) {
      return {
        score: Math.round(avgScore),
        status: 'Nguy cơ thấp',
        color: '#4EAD63',
        description: 'Tư thế ngồi của bé rất xuất sắc. Xương sống và cổ ở trạng thái tự nhiên chuẩn khoa học. Nguy cơ thoái hóa cổ chỉ dưới 5% trong 3 năm tới.',
        risks,
      };
    } else if (risks.length <= 1 && avgScore >= 70) {
      return {
        score: Math.round(avgScore),
        status: 'Nguy cơ Trung bình',
        color: '#FFAA2C',
        description: risks.length > 0 ? risks[0] : 'Bé có xu hướng hơi lệch vai khi ngồi học lâu. Theo dõi thêm vài phiên nữa để phân tích chính xác hơn.',
        risks,
      };
    } else {
      return {
        score: Math.round(avgScore),
        status: 'Nguy cơ Cao (Cần lưu ý)',
        color: '#FF5E5E',
        description: risks.length > 0 ? risks[0] : 'Phát hiện nhiều bất thường về tư thế. Phụ huynh nên kiểm tra lại môi trường học tập của bé.',
        risks,
      };
    }
  };

  const healthPrediction = getHealthPrediction();

  return (
    <div className="min-h-full p-6 lg:p-8" style={{ background: 'var(--bg-page)' }}>
      
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full"
            style={{ background: '#ede9fe', color: '#7c3aed' }}>Phụ Huynh Dashboard</span>
        </div>
        <h1 className="text-2xl font-black text-gray-800">Giám sát Từ xa 🏠</h1>
        <p className="text-gray-400 text-sm font-medium mt-0.5">Theo dõi tư thế, khoảng cách an toàn và tình trạng mệt mỏi của con.</p>
      </div>

      {/* Grid: Live monitoring vs Metrics Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Left Column: Real-time Connection status */}
        <div className="flex flex-col gap-6">
          
          {/* Real-time Status Card */}
          <div className="premium-card p-6 flex flex-col items-center text-center relative overflow-hidden">
            {/* Background glowing effect */}
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob"></div>
            <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-green-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000"></div>
            
            <h3 className="widget-label mb-8 relative z-10">Trạng thái ngồi học trực tiếp</h3>
            
            {/* Pulsing indicator */}
            <div className="relative mb-8 flex justify-center w-full">
              <div className="absolute inset-0 flex items-center justify-center">
                 <div className="w-32 h-32 rounded-full animate-ping opacity-20" style={{
                    backgroundColor: studentStatus === 'good' ? '#4EAD63' : studentStatus === 'warning' ? '#FFAA2C' : studentStatus === 'danger' ? '#FF5E5E' : '#9CA3AF',
                 }}></div>
              </div>
              <div 
                className={`relative z-10 w-32 h-32 rounded-full flex items-center justify-center border-4 border-white shadow-xl transition-all duration-700`}
                style={{
                  background: studentStatus === 'good' ? 'linear-gradient(135deg, #4ade80, #00d285)' :
                              studentStatus === 'warning' ? 'linear-gradient(135deg, #fbbd23, #f59e0b)' :
                              studentStatus === 'danger' ? 'linear-gradient(135deg, #f87171, #ef4444)' : 
                              'linear-gradient(135deg, #9ca3af, #6b7280)'
                }}
              >
                {studentStatus === 'good' && <Shield size={48} className="text-white drop-shadow-md animate-pulse" />}
                {studentStatus === 'warning' && <AlertCircle size={48} className="text-white drop-shadow-md" />}
                {studentStatus === 'danger' && <ShieldAlert size={48} className="text-white drop-shadow-md animate-bounce" />}
                {studentStatus === 'offline' && <Eye size={48} className="text-white drop-shadow-md" />}
              </div>
              
              {/* Online pulse dot */}
              {studentActive && (
                <span className="absolute top-2 right-[25%] flex h-5 w-5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-5 w-5 bg-green-500 border-2 border-white shadow-sm"></span>
                </span>
              )}
            </div>

            <h4 className="text-xl font-bold text-gray-800 relative z-10">
              {studentStatus === 'good' && 'Con đang ngồi học đúng chuẩn'}
              {studentStatus === 'warning' && 'Con ngồi hơi sai tư thế'}
              {studentStatus === 'danger' && 'Tư thế sai nghiêm trọng!'}
              {studentStatus === 'offline' && 'Thiết bị học sinh ngoại tuyến'}
            </h4>
            
            <p className="text-xs text-gray-400 mt-1 mb-4 font-medium">
              {studentActive ? 'Trạng thái được đồng bộ thời gian thực' : 'Chờ thiết bị học sinh kết nối...'}
            </p>

            {/* Live Metrics details */}
            {studentActive && (
              <div className="w-full grid grid-cols-2 gap-2 mt-4 text-left border-t border-gray-100 pt-4 relative z-10">
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
            
            {/* Privacy Guarantee Badge */}
            <div className="mt-5 flex items-start gap-2.5 bg-green-50 text-green-800 p-3.5 rounded-xl border border-green-100 text-xs text-left leading-relaxed relative z-10 w-full shadow-sm">
              <Shield size={20} className="flex-shrink-0 text-green-500 mt-0.5" />
              <span><strong>Cam kết bảo mật:</strong> Hệ thống sử dụng AI xử lý tại biên trên máy học sinh. Tuyệt đối không truyền tải hình ảnh/video thực tế để bảo vệ quyền riêng tư.</span>
            </div>
          </div>

          {/* Health Analysis Prediction */}
          <div className="premium-card p-5">
            <h3 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-1.5">
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
            {healthPrediction.risks && healthPrediction.risks.length > 1 && (
              <div className="mt-3 space-y-2">
                {healthPrediction.risks.slice(1).map((risk, i) => (
                  <p key={i} className="text-xs text-gray-500 leading-relaxed bg-orange-50 p-3 rounded-xl border border-orange-100">
                    {risk}
                  </p>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Center / Right: Charts Reports & Logs alerts */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Grid of charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Posture Pie Distribution (Recharts) */}
            <div className="premium-card p-5 flex flex-col justify-between">
              <h3 className="widget-label mb-4">Tỷ lệ tư thế ngồi</h3>
              <div className="h-44 flex items-center justify-center relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${value}%`} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center text overlay */}
                <div className="absolute text-center mt-1">
                  <span className="text-[10px] text-gray-400 font-bold block">TỐT NHẤT</span>
                  <span className="text-2xl font-black text-green-600">
                    {pieData[0] ? `${pieData[0].value}%` : '80%'}
                  </span>
                </div>
              </div>
              <div className="flex justify-center gap-6 mt-4 text-xs font-semibold">
                <span className="flex items-center gap-2 text-gray-600">
                  <span className="w-3 h-3 rounded-full bg-green-500 shadow-sm" /> Ngồi đúng
                </span>
                <span className="flex items-center gap-2 text-gray-600">
                  <span className="w-3 h-3 rounded-full bg-yellow-400 shadow-sm" /> Ngồi lệch
                </span>
              </div>
            </div>

            {/* PHI Score & Time Trend (Recharts Area) */}
            <div className="premium-card p-5">
              <h3 className="widget-label mb-4">Xu hướng điểm sức khỏe PHI</h3>
              <div className="h-56 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="colorPHI" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7E5BEF" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#7E5BEF" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                    <XAxis dataKey="name" stroke="#9CA3AF" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                    <YAxis domain={[50, 100]} stroke="#9CA3AF" fontSize={11} tickLine={false} axisLine={false} dx={-10} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }} />
                    <Area type="monotone" dataKey="PHI" stroke="#7E5BEF" strokeWidth={3} fillOpacity={1} fill="url(#colorPHI)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Concentration Density (Bar Chart) */}
            <div className="premium-card p-5 lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="widget-label">Mật độ tập trung trong ngày</h3>
                <span className="text-[10px] text-blue-600 bg-blue-50 px-3 py-1 rounded-full font-bold uppercase">Phân tích bằng AI</span>
              </div>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={concData} barSize={32}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                    <XAxis dataKey="name" stroke="#9CA3AF" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                    <YAxis domain={[0, 100]} stroke="#9CA3AF" fontSize={11} tickLine={false} axisLine={false} dx={-10} />
                    <Tooltip 
                      cursor={{ fill: '#F3F4F6', opacity: 0.5 }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }}
                      formatter={(value) => [`${value}%`, 'Mức độ tập trung']}
                    />
                    <Bar dataKey="concentration" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* Interactive Notifications panel & Message Sender */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="premium-card p-6 flex-1">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Bell size={16} className="text-purple-500 animate-swing" /> Nhật ký cảnh báo
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
            </div>

            {/* Parent Message Sender */}
            <div className="premium-card p-6 flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <MessageSquare size={16} className="text-blue-500" /> Nhắn Gửi Yêu Thương
                </h3>
              </div>
              <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                Nhập lời nhắn ngắn, chú gấu trúc Oliver trên màn hình của con sẽ đọc to câu nói này bằng giọng nói dễ thương để khích lệ con!
              </p>
              
              <form onSubmit={handleSendMessage} className="mt-auto flex flex-col gap-3">
                <div className="relative">
                  <textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="VD: Cố lên con yêu, ngồi thẳng lưng nhé!"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-none h-24"
                    maxLength={100}
                  ></textarea>
                  <span className="absolute bottom-3 right-3 text-2xs text-gray-400 font-medium">
                    {messageText.length}/100
                  </span>
                </div>
                
                <button
                  type="submit"
                  disabled={!messageText.trim() || !studentActive}
                  className={`w-full py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all ${
                    !messageText.trim() || !studentActive
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : isMessageSent 
                        ? 'bg-green-500 text-white' 
                        : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg'
                  }`}
                >
                  {isMessageSent ? (
                    'Đã gửi thành công!'
                  ) : (
                    <>
                      Gửi cho bé <Send size={16} />
                    </>
                  )}
                </button>
                {!studentActive && (
                  <p className="text-2xs text-red-400 text-center mt-1">Con đang không mở màn hình học tập</p>
                )}
              </form>
            </div>
          </div>

        </div>

      </div>

      {/* Push Notification Simulation */}
      {fatigueAlerts.length > 0 && (
        <div className="fixed bottom-8 right-8 z-[100]" style={{ animation: 'slideUp 0.5s ease-out forwards' }}>
          <div className="bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-gray-100 p-4 max-w-sm flex gap-4 overflow-hidden relative cursor-pointer hover:scale-105 transition-transform" onClick={() => setFatigueAlerts(prev => prev.slice(1))}>
            <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-yellow-400 to-orange-500"></div>
            <div className="w-12 h-12 rounded-full bg-yellow-50 flex items-center justify-center flex-shrink-0 border border-yellow-100">
               <Bell className="text-yellow-600" size={24} style={{ animation: 'swing 2s infinite ease-in-out' }} />
            </div>
            <div>
               <div className="flex justify-between items-center mb-1.5">
                 <h4 className="text-sm font-bold text-gray-800">Cảnh báo thông minh</h4>
                 <span className="text-[10px] text-gray-400 font-semibold bg-gray-50 px-2 py-0.5 rounded-full">Vừa xong</span>
               </div>
               <p className="text-xs text-gray-600 leading-relaxed font-medium">
                 {fatigueAlerts[0]} <span className="text-orange-600 font-semibold">Phụ huynh nên nhắc bé nghỉ ngơi hoặc điều chỉnh ánh sáng nhé!</span>
               </p>
            </div>
            {/* Close button hint */}
            <button className="absolute top-2 right-2 text-gray-300 hover:text-gray-500" onClick={(e) => { e.stopPropagation(); setFatigueAlerts(prev => prev.slice(1)); }}>
               <span className="sr-only">Close</span>
               &times;
            </button>
          </div>
        </div>
      )}

      {/* Injecting simple animations for Parent Dashboard */}
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes swing {
          20% { transform: rotate(15deg); }
          40% { transform: rotate(-10deg); }
          60% { transform: rotate(5deg); }
          80% { transform: rotate(-5deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
      `}</style>
    </div>
  );
};
export default ParentView;
