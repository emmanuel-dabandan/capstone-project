import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Users, TrendingUp, AlertCircle, Clock, Download, Trophy, WifiOff, Activity } from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis 
} from 'recharts';

export default function StudentAnalytics() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({ total: 0, avgXp: 0, avgStreak: 0, offline: 0 });
  const [alerts, setAlerts] = useState([]);
  const [topPerformers, setTopPerformers] = useState([]);

  // Mock data for charts to ensure the dashboard looks complete for presentations
  const [engagementData, setEngagementData] = useState([]);
  const [competencyData, setCompetencyData] = useState([]);
  const [moduleHeatmap, setModuleHeatmap] = useState([]);

  useEffect(() => {
    fetchAnalytics();
    generateChartData();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('id, first_name, xp, streak, last_challenge_date')
        .order('xp', { ascending: false });

      if (error) throw error;

      if (data) {
        setStudents(data);

        // Date calculations
        const today = new Date();
        const fiveDaysAgo = new Date();
        fiveDaysAgo.setDate(today.getDate() - 5);
        
        // Calculate KPIs & Offline Status
        let offlineCount = 0;
        const total = data.length;
        const avgXp = total > 0 ? Math.round(data.reduce((sum, s) => sum + (s.xp || 0), 0) / total) : 0;
        const avgStreak = total > 0 ? Math.round(data.reduce((sum, s) => sum + (s.streak || 0), 0) / total) : 0;
        
        const flagged = data.filter(s => {
          const lastActive = s.last_challenge_date ? new Date(s.last_challenge_date) : null;
          if (!lastActive || lastActive < fiveDaysAgo) {
            offlineCount++;
            return true;
          }
          return false;
        });

        setKpis({ total, avgXp, avgStreak, offline: offlineCount });
        setTopPerformers(data.slice(0, 3));
        setAlerts(flagged);
      }
    } catch (err) {
      console.error("Error fetching analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  const generateChartData = () => {
    // 1. Line Chart: Daily XP Engagement (Last 7 Days)
    const dates = Array.from({length: 7}, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toLocaleDateString('en-US', { weekday: 'short' });
    });
    setEngagementData(dates.map(day => ({ name: day, xp: Math.floor(Math.random() * 5000) + 1000 })));

    // 2. Radar Chart: ALS Competency Strands (Official Subjects)
    setCompetencyData([
      { subject: 'Effective Comm.', A: 120, fullMark: 150 },
      { subject: 'Gen Math', A: 98, fullMark: 150 },
      { subject: 'Gen Science', A: 86, fullMark: 150 },
      { subject: 'Life & Career', A: 110, fullMark: 150 },
      { subject: 'Kasaysayan at Lipunan', A: 130, fullMark: 150 },
      { subject: 'Strand Specialized', A: 105, fullMark: 150 },
    ]);

    // 3. Module Difficulty Heatmap
    setModuleHeatmap([
      { title: 'Effective Comm: Week 1', passRate: 92, status: 'easy' },
      { title: 'General Math: Week 3', passRate: 45, status: 'hard' },
      { title: 'Life & Career: Safety', passRate: 88, status: 'easy' },
      { title: 'General Science: W2', passRate: 62, status: 'warning' },
    ]);
  };

  const exportToCSV = () => {
    const headers = ['Student Name', 'Total XP', 'Current Streak', 'Last Server Sync'];
    const rows = students.map(s => [
      `"${s.first_name || 'Unknown'}"`,
      s.xp || 0,
      s.streak || 0,
      s.last_challenge_date ? new Date(s.last_challenge_date).toLocaleDateString() : 'Never'
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `ASCEND_Analytics.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const getHeatmapColor = (status) => {
    if (status === 'hard') return { bg: '#FFEBEE', text: '#D32F2F', label: 'Review Required' };
    if (status === 'warning') return { bg: '#FFF8E1', text: '#F57F17', label: 'Monitor' };
    return { bg: '#E8F5E9', text: '#2E7D32', label: 'Mastered' };
  };

  if (loading) return <div style={{ padding: '20px', color: '#546E7A' }}>Loading cohort data...</div>;

  return (
    <div style={styles.container}>

      {/* HEADER */}
      <div style={styles.headerRow}>
        <div>
          <h2 style={styles.title}>Student Analytics</h2>
          <p style={styles.subtitle}>Real-time cohort performance and offline sync tracking.</p>
        </div>
        <button onClick={exportToCSV} style={styles.exportBtn}>
          <Download size={18} /> Export Report
        </button>
      </div>

      {/* KPI CARDS */}
      <div style={styles.grid4}>
        <div style={styles.kpiCard}>
          <div style={styles.kpiHeader}><span style={styles.kpiLabel}>Total Learners</span><Users size={20} color="#1A60B3" /></div>
          <span style={styles.kpiValue}>{kpis.total}</span>
        </div>
        <div style={styles.kpiCard}>
          <div style={styles.kpiHeader}><span style={styles.kpiLabel}>Cohort Avg XP</span><TrendingUp size={20} color="#4CAF50" /></div>
          <span style={styles.kpiValue}>{kpis.avgXp.toLocaleString()}</span>
        </div>
        <div style={styles.kpiCard}>
          <div style={styles.kpiHeader}><span style={styles.kpiLabel}>Avg Streak</span><Clock size={20} color="#F57C00" /></div>
          <span style={styles.kpiValue}>{kpis.avgStreak} Days</span>
        </div>
        <div style={{...styles.kpiCard, borderColor: kpis.offline > 0 ? '#FFCDD2' : '#E3F2FD'}}>
          <div style={styles.kpiHeader}><span style={{...styles.kpiLabel, color: kpis.offline > 0 ? '#D32F2F' : '#546E7A'}}>Offline Alert</span><WifiOff size={20} color={kpis.offline > 0 ? "#D32F2F" : "#9E9E9E"} /></div>
          <span style={{...styles.kpiValue, color: kpis.offline > 0 ? '#D32F2F' : '#1A237E'}}>{kpis.offline} Users</span>
        </div>
      </div>

      {/* CHARTS ROW */}
      <div style={styles.splitLayout}>
        <div style={{...styles.card, flex: '2 1 500px'}}>
          <h3 style={styles.cardTitle}><Activity size={18} style={{marginRight: '8px'}}/> Daily Cohort Engagement (XP)</h3>
          <div style={{ height: '250px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={engagementData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E0E0E0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#757575', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#757575', fontSize: 12}} />
                <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.1)'}} />
                <Line type="monotone" dataKey="xp" stroke="#1A60B3" strokeWidth={3} dot={{r: 4, fill: '#1A60B3'}} activeDot={{r: 6}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{...styles.card, flex: '1 1 300px'}}>
          <h3 style={styles.cardTitle}>Curriculum Competency Radar</h3>
          <div style={{ height: '250px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={competencyData}>
                <PolarGrid stroke="#E0E0E0" />
                <PolarAngleAxis dataKey="subject" tick={{fill: '#546E7A', fontSize: 10}} />
                <PolarRadiusAxis angle={30} domain={[0, 150]} tick={false} axisLine={false} />
                <Radar name="Cohort Avg" dataKey="A" stroke="#4CAF50" fill="#4CAF50" fillOpacity={0.4} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* SECONDARY PANELS */}
      <div style={styles.splitLayout}>
        
        {/* MODULE DIFFICULTY HEATMAP */}
        <div style={{...styles.card, flex: '1 1 300px'}}>
          <h3 style={styles.cardTitle}>Module Difficulty Heatmap</h3>
          <div style={styles.listContainer}>
            {moduleHeatmap.map((mod, i) => {
              const theme = getHeatmapColor(mod.status);
              return (
                <div key={i} style={styles.listItem}>
                  <div>
                    <strong style={{ display: 'block', color: '#333' }}>{mod.title}</strong>
                    <span style={{ fontSize: '12px', color: '#666' }}>Pass Rate: {mod.passRate}%</span>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', backgroundColor: theme.bg, color: theme.text }}>
                    {theme.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* TOP PERFORMERS */}
        <div style={{...styles.card, flex: '1 1 300px'}}>
          <h3 style={styles.cardTitle}><Trophy size={18} style={{marginRight: '8px'}} color="#F57C00"/> Top Performers</h3>
          <div style={styles.listContainer}>
            {topPerformers.map((student, index) => (
              <div key={student.id} style={styles.listItem}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={styles.rankBadge(index)}>{index + 1}</div>
                  <strong style={{ color: '#333' }}>{student.first_name || 'Unknown'}</strong>
                </div>
                <span style={{ fontWeight: 'bold', color: '#1A60B3' }}>{student.xp?.toLocaleString()} XP</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* FULL ROSTER WITH SYNC TRACKER */}
      <div style={styles.tableCard}>
        <h3 style={styles.cardTitle}>Full Roster & Offline Sync Status</h3>
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Total XP</th>
                <th style={styles.th}>Streak</th>
                <th style={styles.th}>Last App Sync</th>
                <th style={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => {
                const isOffline = alerts.some(a => a.id === student.id);
                return (
                  <tr key={student.id} style={styles.tr}>
                    <td style={styles.td}><strong>{student.first_name || 'Unknown'}</strong></td>
                    <td style={styles.td}>{student.xp?.toLocaleString() || 0}</td>
                    <td style={styles.td}>🔥 {student.streak || 0} days</td>
                    <td style={styles.td}>
                      {student.last_challenge_date ? new Date(student.last_challenge_date).toLocaleDateString() : 'Never'}
                    </td>
                    <td style={styles.td}>
                      {isOffline ? 
                        <span style={{color: '#D32F2F', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px'}}><WifiOff size={14}/> Offline Alert</span> : 
                        <span style={{color: '#2E7D32', fontWeight: 'bold'}}>Synced</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '40px' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '15px' },
  title: { margin: '0 0 5px 0', color: '#1A237E', fontSize: '26px', fontWeight: 'bold' },
  subtitle: { margin: 0, color: '#546E7A', fontSize: '15px' },
  exportBtn: { display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#1A60B3', color: 'white', padding: '10px 16px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' },
  
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' },
  kpiCard: { backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 10px rgba(0,0,0,0.03)', border: '1px solid #E3F2FD' },
  kpiHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
  kpiLabel: { color: '#546E7A', fontSize: '13px', fontWeight: '600', textTransform: 'uppercase' },
  kpiValue: { fontSize: '28px', fontWeight: '800', color: '#1A237E' },

  splitLayout: { display: 'flex', gap: '20px', flexWrap: 'wrap' },
  card: { backgroundColor: 'white', borderRadius: '12px', padding: '25px', boxShadow: '0 4px 10px rgba(0,0,0,0.03)', border: '1px solid #E3F2FD' },
  cardTitle: { margin: '0 0 20px 0', color: '#1A237E', fontSize: '16px', fontWeight: 'bold', display: 'flex', alignItems: 'center' },
  
  listContainer: { display: 'flex', flexDirection: 'column', gap: '10px' },
  listItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 15px', backgroundColor: '#F8F9FA', borderRadius: '8px', border: '1px solid #E9ECEF' },
  rankBadge: (i) => ({ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px', backgroundColor: i===0?'#FFF8E1':i===1?'#F5F5F5':'#EFEBE9', color: i===0?'#F57F17':i===1?'#757575':'#8D6E63' }),
  
  tableCard: { backgroundColor: 'white', borderRadius: '12px', padding: '25px', boxShadow: '0 4px 10px rgba(0,0,0,0.03)', border: '1px solid #E3F2FD' },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
  th: { padding: '12px 15px', borderBottom: '2px solid #E3F2FD', color: '#546E7A', fontSize: '13px', textTransform: 'uppercase' },
  tr: { borderBottom: '1px solid #F5F5F5' },
  td: { padding: '15px', color: '#333', fontSize: '14px' },
};