import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Trash2, Edit3, BookOpen, Filter } from 'lucide-react';

export default function ModuleDatabase() {
  const [modules, setModules] = useState([]);
  const [filteredModules, setFilteredModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('All');

  const subjectsFilterList = [
    'All',
    'Effective Communication',
    'General Mathematics',
    'General Science',
    'Life and Career Skills',
    'Pag-aaral ng Kasaysayan at Lipunang Pilipino',
    'Strand-Based Specialized Subject'
  ];

  useEffect(() => {
    fetchModules();
  }, []);

  useEffect(() => {
    if (selectedSubjectFilter === 'All') {
      setFilteredModules(modules);
    } else {
      setFilteredModules(modules.filter(m => m.title === selectedSubjectFilter));
    }
  }, [selectedSubjectFilter, modules]);

  const fetchModules = async () => {
    const { data, error } = await supabase
      .from('ai_lessons')
      .select('id, title, subtitle, created_at')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setModules(data);
      setFilteredModules(data);
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this module? This will remove it from all student devices on their next sync.")) {
      await supabase.from('ai_lessons').delete().eq('id', id);
      const updated = modules.filter(m => m.id !== id);
      setModules(updated);
      setFilteredModules(
        selectedSubjectFilter === 'All'
          ? updated
          : updated.filter(m => m.title === selectedSubjectFilter)
      );
    }
  };

  if (loading) return <div>Loading modules...</div>;

  return (
    <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px', border: '1px solid #E3F2FD' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '20px' }}>
        <h2 style={{ color: '#1A237E', margin: 0 }}>Curriculum Database</h2>
      </div>

      {/* Subject Filter Pills */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
        {subjectsFilterList.map((subj, idx) => {
          const isActive = selectedSubjectFilter === subj;
          return (
            <button
              key={idx}
              onClick={() => setSelectedSubjectFilter(subj)}
              style={{
                padding: '8px 14px',
                borderRadius: '20px',
                border: isActive ? '1px solid #1A60B3' : '1px solid #E3F2FD',
                backgroundColor: isActive ? '#1A60B3' : '#F8F9FA',
                color: isActive ? 'white' : '#546E7A',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {subj}
            </button>
          );
        })}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #E3F2FD', textAlign: 'left' }}>
              <th style={{ padding: '12px', color: '#546E7A' }}>Subject</th>
              <th style={{ padding: '12px', color: '#546E7A' }}>Module Subtitle</th>
              <th style={{ padding: '12px', color: '#546E7A' }}>Date Generated</th>
              <th style={{ padding: '12px', color: '#546E7A', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredModules.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '30px', textAlign: 'center', color: '#757575' }}>
                  No modules found for this subject filter.
                </td>
              </tr>
            ) : (
              filteredModules.map(mod => (
                <tr key={mod.id} style={{ borderBottom: '1px solid #F5F5F5' }}>
                  <td style={{ padding: '15px', fontWeight: 'bold', color: '#1A237E' }}>{mod.title || 'Untitled Subject'}</td>
                  <td style={{ padding: '15px', color: '#333' }}>{mod.subtitle || '-'}</td>
                  <td style={{ padding: '15px', color: '#666' }}>{new Date(mod.created_at).toLocaleDateString()}</td>
                  <td style={{ padding: '15px', textAlign: 'right' }}>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1A60B3', marginRight: '15px' }} title="Edit Content">
                      <Edit3 size={18} />
                    </button>
                    <button onClick={() => handleDelete(mod.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D32F2F' }} title="Delete Module">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}