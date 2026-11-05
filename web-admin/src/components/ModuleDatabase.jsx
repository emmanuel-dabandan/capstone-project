import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Trash2, Edit3, BookOpen } from 'lucide-react';

export default function ModuleDatabase() {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchModules();
  }, []);

  const fetchModules = async () => {
    const { data, error } = await supabase
      .from('ai_lessons')
      .select('id, title, subtitle, created_at')
      .order('created_at', { ascending: false });

    if (!error && data) setModules(data);
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this module? This will remove it from all student devices on their next sync.")) {
      await supabase.from('ai_lessons').delete().eq('id', id);
      setModules(modules.filter(m => m.id !== id));
    }
  };

  if (loading) return <div>Loading modules...</div>;

  return (
    <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px', border: '1px solid #E3F2FD' }}>
      <h2 style={{ color: '#1A237E', marginTop: 0 }}>Curriculum Database</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #E3F2FD', textAlign: 'left' }}>
            <th style={{ padding: '12px', color: '#546E7A' }}>Module Title</th>
            <th style={{ padding: '12px', color: '#546E7A' }}>Subtitle</th>
            <th style={{ padding: '12px', color: '#546E7A' }}>Date Generated</th>
            <th style={{ padding: '12px', color: '#546E7A', textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {modules.map(mod => (
            <tr key={mod.id} style={{ borderBottom: '1px solid #F5F5F5' }}>
              <td style={{ padding: '15px', fontWeight: 'bold' }}>{mod.title || 'Untitled Module'}</td>
              <td style={{ padding: '15px' }}>{mod.subtitle || '-'}</td>
              <td style={{ padding: '15px', color: '#666' }}>{new Date(mod.created_at).toLocaleDateString()}</td>
              <td style={{ padding: '15px', textAlign: 'right' }}>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1A60B3', marginRight: '15px' }} title="Edit Content"><Edit3 size={18} /></button>
                <button onClick={() => handleDelete(mod.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D32F2F' }} title="Delete Module"><Trash2 size={18} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}