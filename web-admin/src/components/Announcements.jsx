import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Send, Bell } from 'lucide-react';

export default function Announcements() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');

  const handleBroadcast = async (e) => {
    e.preventDefault();
    setStatus('Sending...');
    const { error } = await supabase.from('announcements').insert([{ title, message }]);
    
    if (error) {
      setStatus(`Error: ${error.message}`);
    } else {
      setStatus('Announcement broadcasted successfully!');
      setTitle('');
      setMessage('');
      setTimeout(() => setStatus(''), 3000);
    }
  };

  return (
    <div style={{ width: '100%', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', border: '1px solid #E3F2FD', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '25px' }}>
          <h2 style={{ color: '#1A237E', margin: 0 }}>Global Broadcast</h2>
        </div>

        <form onSubmit={handleBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#546E7A', fontSize: '14px' }}>Announcement Title:</label>
            <input
              type="text"
              placeholder="e.g. System Maintenance, New Module Added..."
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #E3F2FD', backgroundColor: '#F8F9FA', fontSize: '15px', color: '#333', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#546E7A', fontSize: '14px' }}>Broadcast Message:</label>
            <textarea
              placeholder="Type your message to the ALS cohort..."
              value={message}
              onChange={e => setMessage(e.target.value)}
              required
              rows="6"
              style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #E3F2FD', backgroundColor: '#F8F9FA', fontSize: '15px', color: '#333', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
            />
          </div>

          <button type="submit" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '16px', backgroundColor: '#1A60B3', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px', transition: 'background-color 0.2s', marginTop: '10px' }}>
            <Send size={18} /> Send Announcement
          </button>
        </form>

        {status && (
          <div style={{ marginTop: '25px', padding: '20px', backgroundColor: '#F8F9FA', borderRadius: '8px', border: '1px solid #E3F2FD' }}>
            <p style={{ margin: 0, fontWeight: '500', color: status.includes('Error') ? '#D32F2F' : '#2E7D32', textAlign: 'center', fontSize: '14px' }}>
              {status}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}