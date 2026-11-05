import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User, Lock, Eye, EyeOff } from 'lucide-react';

// Make sure these images are in your web-admin/src/assets/ folder
import loginImage from '../assets/HS1.jpg'; 
import logoImage from '../assets/AlsLogo.png'; 

export default function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Manage responsiveness without a CSS file
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 850);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 850);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    // 1. Authenticate the email and password
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setMessage(`Login failed: ${authError.message}`);
      setLoading(false);
      return;
    }

    // 2. ROLE CHECK: Verify they are an actual teacher
    const { data: teacherData, error: roleError } = await supabase
      .from('teachers')
      .select('id')
      .eq('id', authData.user.id)
      .single();

    if (roleError || !teacherData) {
      // It's a student! Kick them out.
      await supabase.auth.signOut();
      setMessage('Access Denied: This portal is restricted to authorized instructors.');
      setLoading(false);
      return;
    }

    // 3. Success! They are a teacher.
    setMessage('Login successful!');
    onLogin(authData.session); 
  };

  // Dynamic styles based on screen size
  const cardRadius = isMobile ? '16px' : '16px 0 0 16px';
  const layoutJustify = isMobile ? 'center' : 'flex-end';

  return (
    <div style={styles.appContainer}>
      
      

      {/* Split Layout Wrapper */}
      <div style={{...styles.splitLayout, flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '20px' : '0'}}>
        
        {/* LEFT SIDE: Login Box */}
        <div style={{...styles.layoutLeft, justifyContent: layoutJustify}}>
          <div style={{...styles.authCard, borderRadius: cardRadius}}>
            
            <div style={styles.cardHeader}>
              <h2 style={styles.cardTitle}>Teacher Portal</h2>
              <p style={styles.cardSubtitle}>Sign in to manage and upload AI modules</p>
            </div>

            {message && (
              <div style={{...styles.alert, backgroundColor: message.includes('success') ? '#E8F5E9' : '#FFEBEE', color: message.includes('success') ? '#2E7D32' : '#C62828'}}>
                {message}
              </div>
            )}

            <form onSubmit={handleLogin} style={styles.authForm}>
              
              <div style={styles.inputGroup}>
                <label style={styles.inputLabel}>Admin Email</label>
                <div style={styles.inputWrapper}>
                  <User size={20} style={styles.inputIcon} />
                  <input 
                    type="email" 
                    placeholder="Enter your Email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={styles.inputField}
                    required 
                  />
                </div>
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.inputLabel}>Password</label>
                <div style={styles.inputWrapper}>
                  <Lock size={20} style={styles.inputIcon} />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="••••••••" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={styles.inputField}
                    required 
                  />
                  <button 
                    type="button" 
                    style={styles.togglePassword}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? "Hide" : "Show"}
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div style={styles.formActions}>
                <label style={styles.rememberMe}>
                  <input type="checkbox" />
                  <span>Remember Me</span>
                </label>
                <a href="#" style={styles.forgotPassword}>Forgot Password?</a>
              </div>

              <button 
                type="submit" 
                disabled={loading} 
                style={{...styles.loginBtn, backgroundColor: loading ? '#90CAF9' : '#1565C0', cursor: loading ? 'not-allowed' : 'pointer'}}
              >
                {loading ? 'Authenticating...' : 'SIGN IN'}
              </button>
            </form>

            <div style={styles.divider}>
              <span style={styles.dividerText}>SECURE ACCESS</span>
            </div>

            <div style={styles.toggleAuth}>
              <p style={{ color: '#546E7A', fontSize: '13px', margin: 0 }}>
                Only authorized faculty may access this portal.
              </p>
            </div>

          </div>
        </div>

        {/* RIGHT SIDE: Image Placeholder (Hidden on mobile) */}
        {!isMobile && (
          <div style={styles.layoutRight}>
            <img 
              src={loginImage} 
              alt="Teacher Portal" 
              style={styles.heroImage} 
            />
          </div>
        )}

      </div>

      {/* Footer Branding */}
      <footer style={styles.appFooter}>
        <div style={styles.logosPlaceholder}>
          <span>DepED | ALS Philippines</span>
        </div>
        <p style={styles.versionText}>ASCEND Web Admin v1.0.0</p>
      </footer>
    </div>
  );
}

// Inline Styles Object mapping the old CSS exactly
const styles = {
  appContainer: { minHeight: '100vh', width: '100vw', backgroundColor: '#8ebcea', display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: "'Inter', system-ui, sans-serif", boxSizing: 'border-box' },
  appHeader: { background: 'linear-gradient(180deg, #1A60B3 0%, #154D90 100%)', color: 'white', padding: '20px 5%', width: '100%', boxSizing: 'border-box', display: 'flex', justifyContent: 'flex-start' },
  headerBrand: { display: 'flex', alignItems: 'center', gap: '15px' },
  headerLogo: { width: '70px', height: '70px', objectFit: 'contain' },
  headerText: { display: 'flex', flexDirection: 'column', textAlign: 'left' },
  headerTitle: { fontSize: '24px', fontWeight: '700', margin: '0 0 4px 0' },
  headerSubtitle: { fontSize: '14px', margin: 0, opacity: 0.9 },
  
  splitLayout: { display: 'flex', flex: 1, width: '100%', maxWidth: '1000px', margin: '0 auto', alignItems: 'stretch', justifyContent: 'center', padding: '40px 20px', boxSizing: 'border-box' },
  layoutLeft: { flex: 1, display: 'flex', alignItems: 'stretch', width: '100%' },
  layoutRight: { flex: 1, display: 'flex', justifyContent: 'flex-start', alignItems: 'stretch' },
  
  authCard: { background: 'white', width: '100%', maxWidth: '420px', padding: '30px 25px', boxShadow: '-5px 10px 25px rgba(0,0,0,0.08)', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center' },
  cardHeader: { textAlign: 'center', marginBottom: '25px' },
  cardTitle: { color: '#1A237E', fontSize: '24px', margin: '0 0 8px 0', fontWeight: 'bold' },
  cardSubtitle: { color: '#546E7A', fontSize: '14px', margin: 0 },
  
  alert: { padding: '10px', borderRadius: '6px', fontSize: '13px', marginBottom: '15px', textAlign: 'center' },
  
  authForm: { display: 'flex', flexDirection: 'column', gap: '18px' },
  inputGroup: { display: 'block' },
  inputLabel: { display: 'block', fontSize: '13px', fontWeight: '600', color: '#333', marginBottom: '6px' },
  inputWrapper: { position: 'relative', display: 'flex', alignItems: 'center' },
  inputIcon: { position: 'absolute', left: '12px', color: '#1565C0' },
  inputField: { width: '100%', padding: '12px 40px', border: '1.5px solid #90CAF9', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' },
  togglePassword: { position: 'absolute', right: '10px', background: 'none', border: 'none', color: '#1565C0', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', padding: 0 },
  
  formActions: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' },
  rememberMe: { display: 'flex', alignItems: 'center', gap: '6px', color: '#333', cursor: 'pointer' },
  forgotPassword: { color: '#1565C0', textDecoration: 'underline', fontWeight: '500' },
  
  loginBtn: { color: 'white', border: 'none', borderRadius: '25px', padding: '14px', fontSize: '15px', fontWeight: '700', marginTop: '10px' },
  
  divider: { display: 'flex', alignItems: 'center', textAlign: 'center', margin: '25px 0', color: '#90CAF9', fontSize: '12px' },
  dividerText: { padding: '0 10px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  toggleAuth: { textAlign: 'center', fontSize: '14px', color: '#333' },
  
  heroImage: { width: '100%', maxWidth: '500px', height: '100%', minHeight: '420px', objectFit: 'cover', borderRadius: '0 16px 16px 0', boxShadow: '5px 10px 25px rgba(0,0,0,0.08)' },
  
  appFooter: { marginTop: 'auto', padding: '20px', textAlign: 'center', color: '#495057' },
  logosPlaceholder: { display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '10px', fontWeight: 'bold', fontSize: '18px', color: '#1A237E' },
  versionText: { fontSize: '11px', opacity: 0.8, margin: 0 }
};