import React, { useState, useEffect } from 'react';
import { FileText, Upload } from 'lucide-react';

export default function TeacherUpload() {
  // ... rest of your code
  const [files, setFiles] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState(0);

  
  const [subject, setSubject] = useState('Cookery & Food Safety'); 
  const [week, setWeek] = useState('Week 1');

  const subjects = [
    'Cookery & Food Safety', 
    'Oral Communication', 
    'General Mathematics', 
    'Personal Development', 
    'Earth & Life Science', 
    'Understanding Culture'
  ];

  const weeks = Array.from({ length: 10 }, (_, i) => `Week ${i + 1}`);

  useEffect(() => {
    let interval;
    if (loading && progress < 90) {
      interval = setInterval(() => {
        setProgress((prev) => (prev < 90 ? prev + 1 : prev));
      }, 500); 
    } else if (!loading) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [loading, progress]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!files || files.length === 0) {
      setMessage("Please select at least one PDF file.");
      return;
    }

    setLoading(true);
    setProgress(0);
    setMessage(`Uploading files and generating AI module for ${week}... This may take a minute.`);

    const formData = new FormData();
    
    formData.append('subject', subject);

    Array.from(files).forEach((file) => {
      formData.append('files', file);
    });

    try {
      const backendUrl = 'https://glorious-happiness-x5955j7qpxqgfp4p9-3000.app.github.dev/api/upload';

      const response = await fetch(backendUrl, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        setProgress(100);
        setMessage(`✅ Success! ${week} module is now live on the mobile app.`);
        document.getElementById('file-upload').value = '';
        setFiles([]);
      } else {
        setProgress(0);
        setMessage(`Error: ${data.error}`);
      }
    } catch (err) {
      setProgress(0);
      setMessage(`Upload failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ width: '100%', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Removed the 700px max-width constraint so it stretches like ModuleDatabase */}
      <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', border: '1px solid #E3F2FD', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
        <h2 style={{ color: '#1A237E', marginTop: 0, marginBottom: '25px' }}>
          Create Interactive Module
        </h2>

        <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          <div style={{ display: 'flex', gap: '15px' }}>
            <div style={{ flex: 2 }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#546E7A', fontSize: '14px' }}>Target Subject:</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #E3F2FD', backgroundColor: '#F8F9FA', color: '#333', fontSize: '15px', outline: 'none' }}
              >
                {subjects.map((sub, index) => (
                  <option key={index} value={sub}>{sub}</option>
                ))}
              </select>
            </div>

            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#546E7A', fontSize: '14px' }}>Target Week:</label>
              <select
                value={week}
                onChange={(e) => setWeek(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #E3F2FD', backgroundColor: '#F8F9FA', color: '#333', fontSize: '15px', outline: 'none' }}
              >
                {weeks.map((w, index) => (
                  <option key={index} value={w}>{w}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#546E7A', fontSize: '14px' }}>
              Reference Documents (Select multiple if needed):
            </label>

            {/* Hidden native file input */}
            <input
              id="file-upload"
              type="file"
              accept="application/pdf"
              multiple
              onChange={(e) => setFiles(e.target.files)}
              style={{ display: 'none' }}
            />

            {/* Custom styled dropzone with blue gradient */}
            <label
              htmlFor="file-upload"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                padding: '40px 20px',
                background: 'linear-gradient(to bottom right, #F8FAFC, #E3F2FD)',
                border: '2px dashed #90CAF9',
                borderRadius: '12px',
                cursor: 'pointer',
                boxSizing: 'border-box',
                textAlign: 'center',
                transition: 'all 0.2s ease',
                boxShadow: 'inset 0 2px 15px rgba(26, 96, 179, 0.05)'
              }}
            >
              {/* Icons Row */}
              <div style={{ display: 'flex', gap: '20px', marginBottom: '15px', alignItems: 'center' }}>
                <div style={{ backgroundColor: 'white', padding: '10px', borderRadius: '8px', boxShadow: '0 2px 6px rgba(26, 96, 179, 0.1)' }}>
                  <FileText color="#1A60B3" size={28} />
                </div>
                <div style={{ backgroundColor: '#E3F2FD', padding: '12px', borderRadius: '50%' }}>
                  <Upload color="#1A60B3" size={24} />
                </div>
              </div>

              {/* Main Text */}
              <p style={{ margin: '0 0 15px 0', color: '#1A237E', fontSize: '15px', fontWeight: '600' }}>
                Drag and drop your files here or upload manually
              </p>

              {/* Mock Button */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                backgroundColor: 'white',
                border: '1px solid #90CAF9',
                borderRadius: '6px',
                color: '#1A60B3',
                fontSize: '14px',
                fontWeight: '600',
                marginBottom: '15px',
                boxShadow: '0 1px 2px rgba(26, 96, 179, 0.1)'
              }}>
                <Upload size={16} /> Select file
              </div>

              {/* Helper Text */}
              <p style={{ margin: 0, color: '#546E7A', fontSize: '13px' }}>
                Supported file types: Text (.txt), Word(.docx), PDF(.pdf)
              </p>
            </label>

            {/* Selected Files Feedback */}
            {files.length > 0 && (
              <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#F8F9FA', border: '1px solid #E3F2FD', borderRadius: '8px' }}>
                <p style={{ fontSize: '14px', color: '#1A60B3', margin: '0 0 8px 0', fontWeight: 'bold' }}>
                  ✓ {files.length} file(s) selected
                </p>
                <ul style={{ margin: 0, paddingLeft: '20px', color: '#546E7A', fontSize: '13px' }}>
                  {Array.from(files).map((file, idx) => (
                    <li key={idx} style={{ marginBottom: '4px' }}>{file.name}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '16px',
              backgroundColor: loading ? '#90CAF9' : '#1A60B3',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              fontSize: '16px',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s',
              marginTop: '10px'
            }}
          >
            {loading ? 'Processing...' : 'Generate AI Module'}
          </button>
        </form>

        {(loading || message) && (
          <div style={{ marginTop: '25px', padding: '20px', backgroundColor: '#F8F9FA', borderRadius: '8px', border: '1px solid #E3F2FD' }}>
            {loading && (
              <div style={{ height: '8px', backgroundColor: '#E3F2FD', borderRadius: '4px', overflow: 'hidden', marginBottom: '15px' }}>
                <div style={{
                  height: '100%',
                  width: `${progress}%`,
                  backgroundColor: progress === 100 ? '#4CAF50' : '#1A60B3',
                  transition: 'width 0.5s ease-out'
                }} />
              </div>
            )}
            <p style={{ margin: 0, fontWeight: '500', color: progress === 100 ? '#2E7D32' : '#546E7A', textAlign: 'center', fontSize: '14px' }}>
              {message} {loading && `${progress}%`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}