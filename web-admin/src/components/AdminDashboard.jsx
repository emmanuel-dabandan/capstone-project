import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import TeacherUpload from './TeacherUpload';
import StudentAnalytics from './StudentAnalytics';
import ModuleDatabase from './ModuleDatabase';
import Announcements from './Announcements';
import ManageStudents from './ManageStudents';
import { LogOut, Users, Upload, Database, Megaphone, Settings } from 'lucide-react';

export default function AdminDashboard({ session }) {
  const [activeTab, setActiveTab] = useState('students');

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <div style={styles.container}>
      <aside style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <div style={styles.logoRow}>
            <h2 style={styles.sidebarTitle}>Learnify</h2>
          </div>
          <p style={styles.sidebarSubtitle}>{session?.user?.email}</p>
        </div>

        <nav style={styles.nav}>
          <div style={styles.tabWrapper}>
            {activeTab === 'students' && <div style={styles.topCurve} />}
            <button onClick={() => setActiveTab('students')} style={getTabStyle(activeTab === 'students')}>
               <Users size={18} style={{ marginRight: '12px' }} /> Student Analytics
            </button>
            {activeTab === 'students' && <div style={styles.bottomCurve} />}
          </div>

          <div style={styles.tabWrapper}>
            {activeTab === 'upload' && <div style={styles.topCurve} />}
            <button onClick={() => setActiveTab('upload')} style={getTabStyle(activeTab === 'upload')}>
               <Upload size={18} style={{ marginRight: '12px' }} /> Upload Module
            </button>
            {activeTab === 'upload' && <div style={styles.bottomCurve} />}
          </div>

          <div style={styles.tabWrapper}>
            {activeTab === 'database' && <div style={styles.topCurve} />}
            <button onClick={() => setActiveTab('database')} style={getTabStyle(activeTab === 'database')}>
               <Database size={18} style={{ marginRight: '12px' }} /> Module Database
            </button>
            {activeTab === 'database' && <div style={styles.bottomCurve} />}
          </div>

          <div style={styles.tabWrapper}>
            {activeTab === 'announcements' && <div style={styles.topCurve} />}
            <button onClick={() => setActiveTab('announcements')} style={getTabStyle(activeTab === 'announcements')}>
               <Megaphone size={18} style={{ marginRight: '12px' }} /> Announcements
            </button>
            {activeTab === 'announcements' && <div style={styles.bottomCurve} />}
          </div>

          <div style={styles.tabWrapper}>
            {activeTab === 'manage' && <div style={styles.topCurve} />}
            <button onClick={() => setActiveTab('manage')} style={getTabStyle(activeTab === 'manage')}>
               <Settings size={18} style={{ marginRight: '12px' }} /> Manage Students
            </button>
            {activeTab === 'manage' && <div style={styles.bottomCurve} />}
          </div>
        </nav>

        <div style={styles.logoutContainer}>
          <button onClick={handleLogout} style={styles.logoutButton}>
            <LogOut size={18} style={{ marginRight: '8px' }} />
            Log Out
          </button>
        </div>
      </aside>

      <main style={styles.mainContent}>
        {activeTab === 'students' && <StudentAnalytics />}
        {activeTab === 'upload' && <TeacherUpload />}
        {activeTab === 'database' && <ModuleDatabase />}
        {activeTab === 'announcements' && <Announcements />}
        {activeTab === 'manage' && <ManageStudents />}
      </main>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    height: '100vh',
    backgroundColor: '#EEF1F6',
    fontFamily: "'Inter', system-ui, sans-serif"
  },
  sidebar: {
    width: '260px',
    backgroundColor: '#3F569B',
    display: 'flex',
    flexDirection: 'column',
    padding: '32px 0 24px 16px',
    boxSizing: 'border-box',
    borderTopRightRadius: '32px',
    borderBottomRightRadius: '32px',
  },
  sidebarHeader: {
    padding: '0 16px 32px 12px',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    color: 'white',
  },
  sidebarTitle: {
    margin: 0,
    fontSize: '26px',
    fontWeight: 'bold',
    color: '#FFFFFF'
  },
  sidebarSubtitle: {
    margin: '6px 0 0 0',
    fontSize: '13px',
    color: 'rgba(255,255,255,0.7)',
    wordBreak: 'break-all',
    paddingLeft: '2px'
  },
  nav: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  tabWrapper: {
    position: 'relative',
    display: 'block',
    width: '100%',
  },
  topCurve: {
    position: 'absolute',
    top: '-24px',
    right: '0',
    width: '24px',
    height: '24px',
    backgroundColor: 'transparent',
    borderBottomRightRadius: '24px',
    boxShadow: '12px 12px 0 12px #EEF1F6',
    pointerEvents: 'none',
    zIndex: 1,
  },
  bottomCurve: {
    position: 'absolute',
    bottom: '-24px',
    right: '0',
    width: '24px',
    height: '24px',
    backgroundColor: 'transparent',
    borderTopRightRadius: '24px',
    boxShadow: '12px -12px 0 12px #EEF1F6',
    pointerEvents: 'none',
    zIndex: 1,
  },
  logoutContainer: {
    padding: '24px 16px 0 12px',
    marginRight: '16px',
    borderTop: '1px solid rgba(255,255,255,0.15)'
  },
  logoutButton: {
    width: '100%',
    padding: '12px',
    backgroundColor: 'transparent',
    color: 'rgba(255, 255, 255, 0.9)',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '15px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    transition: 'all 0.2s',
  },
  mainContent: {
    flex: 1,
    overflowY: 'auto',
    padding: '40px',
    boxSizing: 'border-box'
  }
};

const getTabStyle = (isActive) => ({
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  padding: '16px 20px',
  textAlign: 'left',
  border: 'none',
  cursor: 'pointer',
  fontSize: '15px',
  fontWeight: '600',
  transition: 'all 0.2s ease',
  backgroundColor: isActive ? '#EEF1F6' : 'transparent',
  color: isActive ? '#3F569B' : 'rgba(255, 255, 255, 0.9)',
  borderTopLeftRadius: isActive ? '28px' : '0px',
  borderBottomLeftRadius: isActive ? '28px' : '0px',
  boxSizing: 'border-box',
  position: 'relative',
  zIndex: 2,
});