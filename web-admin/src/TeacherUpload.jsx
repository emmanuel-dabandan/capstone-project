import React, { useState } from 'react';

export default function TeacherUpload() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  // 🟢 State to hold the chosen subject
  const [subject, setSubject] = useState('Cookery & Food Safety'); 

  // The 6 subjects from your mobile app
  const subjects = [
    'Cookery & Food Safety', 
    'Oral Communication', 
    'General Mathematics', 
    'Personal Development', 
    'Earth & Life Science', 
    'Understanding Culture'
  ];

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setMessage("Please select a PDF file first.");
      return;
    }

    setLoading(true);
    setMessage("Uploading and parsing module...");

    // 🟢 Append BOTH the file and the selected subject
    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('subject', subject); 

    try {
      const response = await fetch('https://glorious-happiness-x5955j7qpxqgfp4p9-5173.app.github.dev/api/upload-lesson', {
        method: 'POST',
        body: formData, // Automatically sets correct multipart/form-data headers
      });

      const data = await response.json();
      if (data.success) {
        setMessage(data.message);
        setFile(null); // Clear the file input
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (err) {
      setMessage(`Upload failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '500px', margin: '0 auto' }}>
      <h2>Upload New Module</h2>
      
      <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        
        {/* Dropdown to select the subject */}
        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Target Subject:</label>
          <select 
            value={subject} 
            onChange={(e) => setSubject(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: '5px' }}
          >
            {subjects.map((sub, index) => (
              <option key={index} value={sub}>{sub}</option>
            ))}
          </select>
        </div>

        {/* File input */}
        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>PDF Module:</label>
          <input 
            type="file" 
            accept="application/pdf" 
            onChange={(e) => setFile(e.target.files[0])}
            style={{ width: '100%', padding: '10px', backgroundColor: '#f4f4f4', borderRadius: '5px' }}
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          style={{ 
            padding: '12px', 
            backgroundColor: loading ? '#ccc' : '#3B82F6', 
            color: 'white', 
            border: 'none', 
            borderRadius: '5px',
            fontWeight: 'bold',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Processing...' : 'Upload Module'}
        </button>
      </form>

      {message && (
        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#EBF3FF', borderRadius: '5px' }}>
          <p style={{ margin: 0 }}>{message}</p>
        </div>
      )}
    </div>
  );
}