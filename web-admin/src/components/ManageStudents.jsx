import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Edit2, Trash2, UserX, Save, X } from 'lucide-react';

export default function ManageStudents() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  
  const [editForm, setEditForm] = useState({ xp: 0, streak: 0 });

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    const { data, error } = await supabase
      .from('students')
      .select('id, first_name, xp, streak')
      .order('first_name', { ascending: true });

    if (!error && data) {
      setStudents(data);
    }
    setLoading(false);
  };

  const startEditing = (student) => {
    setEditingId(student.id);
    setEditForm({ xp: student.xp || 0, streak: student.streak || 0 });
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const handleSave = async (id) => {
    const { error } = await supabase
      .from('students')
      .update({ xp: editForm.xp, streak: editForm.streak })
      .eq('id', id);

    if (!error) {
      setStudents(students.map(s => s.id === id ? { ...s, xp: editForm.xp, streak: editForm.streak } : s));
      setEditingId(null);
    } else {
      alert(`Update failed: ${error.message}`);
    }
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Are you sure you want to remove ${name} from the roster? This cannot be undone.`)) {
      const { error } = await supabase.from('students').delete().eq('id', id);
      if (!error) {
        setStudents(students.filter(s => s.id !== id));
      } else {
        alert(`Deletion failed: ${error.message}`);
      }
    }
  };

  if (loading) return <div style={{ padding: '20px', color: '#546E7A', fontFamily: "'Inter', system-ui, sans-serif" }}>Loading student records...</div>;

  return (
    <div style={{ width: '100%', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', border: '1px solid #E3F2FD', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
        <h2 style={{ color: '#1A237E', margin: '0 0 25px 0' }}>Student Management</h2>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #E3F2FD' }}>
              <th style={{ padding: '12px', color: '#546E7A', fontWeight: 'bold' }}>Student Name</th>
              <th style={{ padding: '12px', color: '#546E7A', fontWeight: 'bold' }}>Total XP</th>
              <th style={{ padding: '12px', color: '#546E7A', fontWeight: 'bold' }}>Streak</th>
              <th style={{ padding: '12px', color: '#546E7A', fontWeight: 'bold', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => {
              const isEditing = editingId === student.id;

              return (
                <tr key={student.id} style={{ borderBottom: '1px solid #F5F5F5' }}>
                  <td style={{ padding: '15px', fontWeight: 'bold', color: '#333' }}>
                    {student.first_name || 'Unknown'}
                  </td>

                  <td style={{ padding: '15px' }}>
                    {isEditing ? (
                      <input
                        type="number"
                        value={editForm.xp}
                        onChange={(e) => setEditForm({...editForm, xp: parseInt(e.target.value) || 0})}
                        style={styles.input}
                      />
                    ) : (
                      student.xp?.toLocaleString() || 0
                    )}
                  </td>

                  <td style={{ padding: '15px' }}>
                    {isEditing ? (
                      <input
                        type="number"
                        value={editForm.streak}
                        onChange={(e) => setEditForm({...editForm, streak: parseInt(e.target.value) || 0})}
                        style={styles.input}
                      />
                    ) : (
                      <span style={{ color: '#666' }}>{student.streak || 0} days</span>
                    )}
                  </td>

                  <td style={{ padding: '15px', textAlign: 'right' }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                        <button onClick={() => handleSave(student.id)} style={styles.iconBtn('#2E7D32')} title="Save">
                          <Save size={18} />
                        </button>
                        <button onClick={cancelEditing} style={styles.iconBtn('#546E7A')} title="Cancel">
                          <X size={18} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
                        <button onClick={() => startEditing(student)} style={styles.iconBtn('#1A60B3')} title="Edit XP/Streak">
                          <Edit2 size={18} />
                        </button>
                        <button onClick={() => handleDelete(student.id, student.first_name)} style={styles.iconBtn('#D32F2F')} title="Remove Student">
                          <UserX size={18} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles = {
  input: {
    width: '90px',
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid #E3F2FD',
    backgroundColor: '#F8F9FA',
    fontSize: '14px',
    color: '#333',
    outline: 'none'
  },
  iconBtn: (color) => ({
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: color,
    padding: '5px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'opacity 0.2s',
  })
};