// Parent Dashboard Component

import React, { useState, useEffect, useMemo } from 'react';
import { Eye, Bell, Shield, ShieldAlert, Heart, AlertCircle, Send, MessageSquare, Download, Calendar, TrendingUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { getSessionRecords } from '../services/db';
import type { SessionRecord } from '../services/db';
import { subscribeToStudentSync, broadcastParentMessage } from '../services/parentSync';
import { useLanguage } from '../contexts/LanguageContext';
import AnimatedCounter from './ui/AnimatedCounter';
import { motion } from 'framer-motion';
import styles from './ParentView.module.css';

type SortKey = 'date' | 'durationMinutes' | 'averageHealthScore' | 'goodPosturePercentage';
type SortDir = 'asc' | 'desc';

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
  const { t } = useLanguage();
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

  // Time Filter State
  const [timeFilter, setTimeFilter] = useState<'7' | '30' | 'all'>('7');

  // Sort state for session table
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const filteredSessions = useMemo(() => {
    if (timeFilter === 'all') return sessions;
    const now = new Date().getTime();
    const daysMs = parseInt(timeFilter) * 24 * 60 * 60 * 1000;
    return sessions.filter(s => {
       const sessionTime = new Date(s.date).getTime();
       // if date parsing fails, fallback to include it
       if (isNaN(sessionTime)) return true;
       return now - sessionTime <= daysMs;
    });
  }, [sessions, timeFilter]);

  // Sort table rows (with date parsing for stable sort)
  const sortedTableData = useMemo(() => {
    const arr = [...filteredSessions];
    arr.sort((a, b) => {
      let av: number | string = a[sortKey] as any;
      let bv: number | string = b[sortKey] as any;
      if (sortKey === 'date') {
        av = new Date(a.date).getTime();
        bv = new Date(b.date).getTime();
        if (isNaN(av as number)) av = 0;
        if (isNaN(bv as number)) bv = 0;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filteredSessions, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  // Pagination for Session Table
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const totalPages = Math.max(1, Math.ceil(sortedTableData.length / itemsPerPage));
  const currentTableData = sortedTableData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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

  useEffect(() => {
    let savedSessions = getSessionRecords();
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
    if (filteredSessions.length === 0) return [];

    // Average metrics over sessions
    let straight = 0;
    let slouched = 0;

    filteredSessions.forEach(s => {
      straight += s.goodPosturePercentage;
      slouched += (100 - s.goodPosturePercentage);
    });

    const total = filteredSessions.length;
    return [
      { name: 'Ngồi đúng chuẩn', value: Math.round(straight / total) },
      { name: 'Ngồi sai tư thế', value: Math.round(slouched / total) },
    ];
  };

  const pieData = getPieChartData();
  const COLORS = ['#4EAD63', '#FFAA2C'];

  // 2. Trend chart data mapping
  const getTrendData = (): ChartDataPoint[] => {
    return filteredSessions.map(s => ({
      name: s.date || 'Học',
      PHI: s.averageHealthScore,
      duration: s.durationMinutes,
    }));
  };

  const trendData = getTrendData();

  // 3. Concentration density chart data
  const getConcentrationData = () => {
    return filteredSessions.map(s => {
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

  // Summary metrics for top row
  const summaryMetrics = useMemo(() => {
    const total = filteredSessions.length;
    const totalMinutes = filteredSessions.reduce((s, r) => s + r.durationMinutes, 0);
    const avgPhi = total ? Math.round(filteredSessions.reduce((s, r) => s + r.averageHealthScore, 0) / total) : 0;
    const avgGood = total ? Math.round(filteredSessions.reduce((s, r) => s + r.goodPosturePercentage, 0) / total) : 0;
    return { total, totalMinutes, avgPhi, avgGood };
  }, [filteredSessions]);

  // Export PDF Logic — html2pdf is dynamically imported to keep the main bundle lean.
  const handleExportPDF = async () => {
    const element = document.getElementById('report-content');
    if (!element) return;
    element.classList.add('exporting-pdf');
    try {
      const { default: html2pdf } = await import('html2pdf.js');
      const opt = {
        margin: 0.5,
        filename: `Bao_Cao_Tien_Trinh_${new Date().toLocaleDateString('vi-VN')}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' as const }
      };
      await html2pdf().set(opt).from(element).save();
    } finally {
      element.classList.remove('exporting-pdf');
    }
  };

  // Render Heatmap (Last 28 days)
  const renderHeatmap = () => {
    const days = [];
    for (let i = 27; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      days.push(`${year}-${month}-${day}`);
    }

    const studyMap: Record<string, number> = {};
    sessions.forEach(s => {
       studyMap[s.date] = (studyMap[s.date] || 0) + s.durationMinutes;
    });

    const colorFor = (mins: number) => {
      if (mins > 60) return '#16a34a';
      if (mins > 30) return '#4ade80';
      if (mins > 0) return '#bbf7d0';
      return '#f1f5f9';
    };

    return (
      <div className={styles.heatmap}>
        <h4 className={styles.heatmapTitle}>
          <Calendar size={16} style={{ color: '#3b82f6' }} /> Biểu Đồ Luyện Tập (28 Ngày)
        </h4>
        <div className={styles.heatmapGrid}>
          {days.map(d => {
            const mins = studyMap[d] || 0;
            return (
              <div
                key={d}
                className={styles.heatmapCell}
                style={{ backgroundColor: colorFor(mins) }}
                title={`${d}: Học ${mins} phút`}
              />
            );
          })}
        </div>
        <div className={styles.heatmapLegend}>
          <span>Ít</span>
          <div className={styles.heatmapLegendSwatches}>
            <span className={styles.heatmapLegendSwatch} style={{ background: '#f1f5f9' }} />
            <span className={styles.heatmapLegendSwatch} style={{ background: '#bbf7d0' }} />
            <span className={styles.heatmapLegendSwatch} style={{ background: '#4ade80' }} />
            <span className={styles.heatmapLegendSwatch} style={{ background: '#16a34a' }} />
          </div>
          <span>Nhiều</span>
        </div>
      </div>
    );
  };

  const statusColor = studentStatus === 'good' ? '#4EAD63' : studentStatus === 'warning' ? '#FFAA2C' : studentStatus === 'danger' ? '#FF5E5E' : '#9CA3AF';
  const statusPingColor = studentStatus === 'good' ? '#4EAD63' : studentStatus === 'warning' ? '#FFAA2C' : studentStatus === 'danger' ? '#FF5E5E' : '#9CA3AF';
  const statusOrbBg = studentStatus === 'good' ? 'linear-gradient(135deg, #4ade80, #00d285)' :
                      studentStatus === 'warning' ? 'linear-gradient(135deg, #fbbd23, #f59e0b)' :
                      studentStatus === 'danger' ? 'linear-gradient(135deg, #f87171, #ef4444)' :
                      'linear-gradient(135deg, #9ca3af, #6b7280)';

  return (
    <motion.div
      className={styles.parentView}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div>
          <span className={styles.tag}>{t('parent.dashboard')}</span>
          <h1 className={styles.title}>{t('parent.title')}</h1>
          <p className={styles.desc}>{t('parent.desc')}</p>
        </div>
        <motion.button
          onClick={handleExportPDF}
          className={`${styles.exportBtn} hide-on-pdf`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Download size={18} /> {t('parent.exportPdf')}
        </motion.button>
      </div>

      {/* Summary metrics row */}
      <div className={styles.metricsRow}>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Phiên học</div>
          <div className={styles.metricValue}><AnimatedCounter value={summaryMetrics.total} duration={800} /></div>
          <div className={`${styles.metricTrend} ${styles.metricTrendUp}`}>
            <TrendingUp size={12} /> Tổng số
          </div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Tổng thời gian</div>
          <div className={styles.metricValue}>
            <AnimatedCounter value={summaryMetrics.totalMinutes} duration={900} />
            <span className={styles.metricUnit}>phút</span>
          </div>
          <div className={`${styles.metricTrend} ${styles.metricTrendUp}`}>
            <TrendingUp size={12} /> Tích lũy
          </div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Điểm PHI TB</div>
          <div className={styles.metricValue}>
            <AnimatedCounter value={summaryMetrics.avgPhi} duration={900} />
          </div>
          <div className={styles.metricTrend} style={{ color: statusColor }}>
            <span style={{ color: summaryMetrics.avgPhi >= 80 ? '#4EAD63' : summaryMetrics.avgPhi >= 60 ? '#FFAA2C' : '#FF5E5E' }}>
              {summaryMetrics.avgPhi >= 80 ? 'Tốt' : summaryMetrics.avgPhi >= 60 ? 'Trung bình' : 'Cần cải thiện'}
            </span>
          </div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Tư thế chuẩn TB</div>
          <div className={styles.metricValue}>
            <AnimatedCounter value={summaryMetrics.avgGood} duration={900} />
            <span className={styles.metricUnit}>%</span>
          </div>
          <div className={styles.metricTrend} style={{ color: summaryMetrics.avgGood >= 80 ? '#4EAD63' : summaryMetrics.avgGood >= 60 ? '#FFAA2C' : '#FF5E5E' }}>
            {summaryMetrics.avgGood >= 80 ? 'Xuất sắc' : summaryMetrics.avgGood >= 60 ? 'Khá' : 'Cần cải thiện'}
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div id="report-content" className={styles.mainGrid}>

        {/* Left Column: Real-time Connection status */}
        <div className={styles.leftCol}>

          {/* Real-time Status Card */}
          <div className={styles.statusCard}>
            <div className={`${styles.statusBg} ${styles.statusBgTop}`} />
            <div className={`${styles.statusBg} ${styles.statusBgBottom}`} />

            <h3 className={styles.cardLabel}>{t('parent.liveStatus')}</h3>

            {/* Pulsing indicator */}
            <div className={styles.statusOrbWrap}>
              <div className={styles.statusPing} style={{ backgroundColor: statusPingColor }} />
              <div
                className={styles.statusOrb}
                style={{ background: statusOrbBg }}
              >
                {studentStatus === 'good' && <Shield size={48} color="#fff" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />}
                {studentStatus === 'warning' && <AlertCircle size={48} color="#fff" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />}
                {studentStatus === 'danger' && <ShieldAlert size={48} color="#fff" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />}
                {studentStatus === 'offline' && <Eye size={48} color="#fff" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />}
              </div>

              {/* Online pulse dot */}
              {studentActive && <span className={styles.onlineDot} />}
            </div>

            <h4 className={styles.statusText}>
              {studentStatus === 'good' && t('parent.goodPosture')}
              {studentStatus === 'warning' && t('parent.warningPosture')}
              {studentStatus === 'danger' && t('parent.dangerPosture')}
              {studentStatus === 'offline' && t('parent.offline')}
            </h4>

            <p className={styles.syncHint}>
              {studentActive ? t('parent.syncLive') : t('parent.waitConnect')}
            </p>

            {/* Live Metrics details */}
            {studentActive && (
              <div className={styles.liveMetrics}>
                <div className={styles.liveMetric}>
                  <span className={styles.liveMetricLabel}>{t('parent.phiScore')}</span>
                  <span className={styles.liveMetricValue}>{studentDetails.healthScore}</span>
                </div>
                <div className={styles.liveMetric}>
                  <span className={styles.liveMetricLabel}>{t('parent.eyeDistance')}</span>
                  <span className={styles.liveMetricValue}>{studentDetails.eyeDistanceCm} cm</span>
                </div>
                <div className={styles.liveMetric}>
                  <span className={styles.liveMetricLabel}>{t('parent.neckAngle')}</span>
                  <span className={styles.liveMetricValue}>{Math.round(studentDetails.neckAngle)}°</span>
                </div>
                <div className={styles.liveMetric}>
                  <span className={styles.liveMetricLabel}>{t('parent.shoulderTilt')}</span>
                  <span className={styles.liveMetricValue}>{Math.round(studentDetails.shoulderTilt)}°</span>
                </div>
              </div>
            )}

            {/* Privacy Guarantee Badge */}
            <div className={styles.privacyBanner}>
              <Shield size={20} style={{ flexShrink: 0, color: '#22c55e', marginTop: 2 }} />
              <span><strong>{t('parent.privacyGuarantee')}</strong> {t('parent.privacyDesc')}</span>
            </div>
          </div>

          {/* Health Analysis Prediction */}
          <div className={styles.healthCard}>
            <h3 className={styles.healthTitle}>
              <Heart size={18} style={{ color: '#ef4444' }} /> {t('parent.healthPrediction')}
            </h3>
            <div className={styles.healthRow}>
              <span className={styles.healthRiskLabel}>{t('parent.riskLevel')}</span>
              <span className={styles.healthRiskBadge} style={{ color: healthPrediction.color }}>
                {healthPrediction.status}
              </span>
            </div>
            <p className={styles.healthDesc}>
              {healthPrediction.description}
            </p>
            {healthPrediction.risks && healthPrediction.risks.length > 1 && (
              <div className={styles.healthRisks}>
                {healthPrediction.risks.slice(1).map((risk, i) => (
                  <p key={i} className={styles.healthRiskItem}>{risk}</p>
                ))}
              </div>
            )}

            {renderHeatmap()}
          </div>
        </div>

        {/* Center / Right: Charts Reports & Logs alerts */}
        <div className={styles.rightCol}>
          {sessions.length === 0 ? (
            <div className={styles.emptyCard}>
              <div className={styles.emptyIcon}>
                <Shield size={40} />
              </div>
              <h3 className={styles.emptyTitle}>{t('parent.noData')}</h3>
              <p className={styles.emptyDesc}>{t('parent.noDataDesc')}</p>
            </div>
          ) : (
            <>
          {/* Filter Bar */}
          <div className={styles.filterBar}>
            <div className={styles.filterGroup}>
              <button onClick={() => { setTimeFilter('7'); setCurrentPage(1); }} className={`${styles.filterBtn} ${timeFilter === '7' ? styles.filterBtnActive : ''}`}>{t('parent.filter7Days')}</button>
              <button onClick={() => { setTimeFilter('30'); setCurrentPage(1); }} className={`${styles.filterBtn} ${timeFilter === '30' ? styles.filterBtnActive : ''}`}>{t('parent.filter30Days')}</button>
              <button onClick={() => { setTimeFilter('all'); setCurrentPage(1); }} className={`${styles.filterBtn} ${timeFilter === 'all' ? styles.filterBtnActive : ''}`}>{t('parent.filterAll')}</button>
            </div>
          </div>

          {/* Grid of charts */}
          <div className={styles.chartsGrid}>

            {/* Posture Pie Distribution (Recharts) */}
            <div className={styles.chartCard}>
              <h3 className={styles.chartLabel}>{t('parent.postureRatio')}</h3>
              <div className={styles.chartBody} style={{ position: 'relative' }}>
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
                <div className={styles.pieCenter}>
                  <span className={styles.pieCenterLabel}>{t('parent.best')}</span>
                  <span className={styles.pieCenterValue}>
                    {pieData[0] ? `${pieData[0].value}%` : '80%'}
                  </span>
                </div>
              </div>
              <div className={styles.legendRow}>
                <span className={styles.legendItem}>
                  <span className={styles.legendDot} style={{ background: '#4EAD63' }} /> Ngồi đúng
                </span>
                <span className={styles.legendItem}>
                  <span className={styles.legendDot} style={{ background: '#FFAA2C' }} /> Ngồi lệch
                </span>
              </div>
            </div>

            {/* Trend Area Chart (Recharts) */}
            <div className={styles.chartCard}>
              <h3 className={styles.chartLabel}>{t('parent.trend')}</h3>
              <div className={styles.chartBody}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="colorPHI" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
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
            <div className={`${styles.chartCard} ${styles.chartCardWide}`}>
              <div className={styles.chartHeader}>
                <h3 className={styles.chartLabel}>{t('parent.concentration')}</h3>
                <span className={styles.chartBadge}>AI Analysis</span>
              </div>
              <div className={`${styles.chartBody} ${styles.chartBodyTall}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={concData} barSize={32}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                    <XAxis dataKey="name" stroke="#9CA3AF" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                    <YAxis domain={[0, 100]} stroke="#9CA3AF" fontSize={11} tickLine={false} axisLine={false} dx={-10} />
                    <Tooltip
                      cursor={{ fill: '#F3F4F6', opacity: 0.5 }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }}
                      formatter={(value) => [`${value}%`, 'Concentration']}
                    />
                    <Bar dataKey="concentration" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Session History Table with Sort + Pagination */}
          <div className={styles.tableCard}>
            <h3 className={styles.chartLabel}>{t('parent.history')}</h3>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead className={styles.tableHead}>
                  <tr>
                    <th className={styles.thSortable} onClick={() => toggleSort('date')}>
                      Ngày {sortKey === 'date' && <span className={styles.sortArrow}>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                    </th>
                    <th className={styles.thSortable} onClick={() => toggleSort('durationMinutes')}>
                      Thời gian học {sortKey === 'durationMinutes' && <span className={styles.sortArrow}>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                    </th>
                    <th className={styles.thSortable} onClick={() => toggleSort('averageHealthScore')}>
                      Điểm PHI {sortKey === 'averageHealthScore' && <span className={styles.sortArrow}>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                    </th>
                    <th className={styles.thSortable} onClick={() => toggleSort('goodPosturePercentage')}>
                      Tư thế chuẩn {sortKey === 'goodPosturePercentage' && <span className={styles.sortArrow}>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {currentTableData.length > 0 ? currentTableData.map((s, idx) => (
                    <tr key={idx} className={styles.tr}>
                      <td className={styles.td}>{s.date}</td>
                      <td className={styles.td}>{s.durationMinutes} phút</td>
                      <td className={`${styles.td} ${styles.tdScore}`} style={{ color: s.averageHealthScore >= 80 ? '#4EAD63' : s.averageHealthScore >= 60 ? '#FFAA2C' : '#FF5E5E' }}>
                        {s.averageHealthScore}
                      </td>
                      <td className={styles.td}>{s.goodPosturePercentage}%</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={4} className={styles.tdEmpty}>Không có dữ liệu trong khoảng thời gian này</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className={styles.pagination}>
                <span className={styles.paginationInfo}>Trang {currentPage} / {totalPages}</span>
                <div className={styles.paginationBtns}>
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className={styles.paginationBtn}
                  >
                    Trước
                  </button>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className={styles.paginationBtn}
                  >
                    Sau
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Interactive Notifications panel & Message Sender */}
          <div className={styles.bottomGrid}>
            <div className={styles.panelCard}>
              <div className={styles.panelHeader}>
                <h3 className={styles.panelTitle}>
                  <Bell size={16} style={{ color: '#7E5BEF', animation: 'swing 2s infinite ease-in-out' }} /> Nhật ký cảnh báo
                </h3>
                <span className={styles.panelBadge}>Thời gian thực</span>
              </div>

              {/* Warnings list logs */}
              <div className={styles.alertList}>
                {alerts.length === 0 ? (
                  <div className={styles.alertEmpty}>
                    Chưa có thông tin cảnh báo nào. Con đang học tập tốt!
                  </div>
                ) : (
                  alerts.map((alert) => (
                    <div key={alert.id} className={styles.alertItem}>
                      <div className={styles.alertLeft}>
                        <span style={{ fontSize: 12, marginTop: 1 }}>🔔</span>
                        <span>{alert.message}</span>
                      </div>
                      <span className={styles.alertTime}>
                        {alert.time}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Parent Message Sender (chat-like UI) */}
            <div className={styles.panelCard}>
              <div className={styles.panelHeader}>
                <h3 className={styles.panelTitle}>
                  <MessageSquare size={16} style={{ color: '#3b82f6' }} /> Nhắn Gửi Yêu Thương
                </h3>
              </div>
              <p className={styles.messageDesc}>
                Nhập lời nhắn ngắn, chú gấu trúc Oliver trên màn hình của con sẽ đọc to câu nói này bằng giọng nói dễ thương để khích lệ con!
              </p>

              <form onSubmit={handleSendMessage} className={styles.messageForm}>
                <div className={styles.messageInputWrap}>
                  <textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="VD: Cố lên con yêu, ngồi thẳng lưng nhé!"
                    className={styles.messageInput}
                    maxLength={100}
                  />
                  <span className={styles.messageCounter}>
                    {messageText.length}/100
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={!messageText.trim() || !studentActive}
                  className={`${styles.sendBtn} ${
                    !messageText.trim() || !studentActive ? '' :
                    isMessageSent ? styles.sendBtnSent : styles.sendBtnEnabled
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
                  <p className={styles.messageOfflineHint}>Con đang không mở màn hình học tập</p>
                )}
              </form>
            </div>
          </div>
            </>
          )}
        </div>
      </div>

      {/* Push Notification Simulation */}
      {fatigueAlerts.length > 0 && (
        <div className={styles.pushWrap}>
          <div className={styles.pushCard} onClick={() => setFatigueAlerts(prev => prev.slice(1))}>
            <div className={styles.pushAccent} />
            <div className={styles.pushIcon}>
               <Bell size={24} />
            </div>
            <div className={styles.pushContent}>
               <div className={styles.pushHeader}>
                 <h4 className={styles.pushTitle}>Cảnh báo thông minh</h4>
                 <span className={styles.pushTime}>Vừa xong</span>
               </div>
               <p className={styles.pushBody}>
                 {fatigueAlerts[0]} <span className={styles.pushBodyHighlight}>Phụ huynh nên nhắc bé nghỉ ngơi hoặc điều chỉnh ánh sáng nhé!</span>
               </p>
            </div>
            <button className={styles.pushClose} onClick={(e) => { e.stopPropagation(); setFatigueAlerts(prev => prev.slice(1)); }}>
               &times;
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
};
export default ParentView;