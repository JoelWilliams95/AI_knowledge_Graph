import React, { useState } from 'react';
import axios from 'axios';

export default function UploadForm({ onProcessed, apiBase, toast }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const uploadAndProcess = async () => {
    if (!file) return;
    setLoading(true);
    const form = new FormData();
    form.append('file', file);
    try {
      const up = await axios.post(`${apiBase}/upload-pdf`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const text = (await up).data.text_snippet || '';
      // For demo, send full file text to process-text; ideally the backend should extract and persist
      const res = await axios.post(`${apiBase}/process-text`, { text: text });
      const nodeCount = res.data.nodes?.length || 0;
      const edgeCount = res.data.edges?.length || 0;
      onProcessed(res.data.nodes, res.data.edges);
      if (toast) {
        toast.success(`Successfully processed paper! Extracted ${nodeCount} entities and ${edgeCount} relationships.`);
      }
    } catch (err) {
      console.error(err);
      // More user-friendly error message that provides guidance
      if (toast) {
        if (err.message === 'Network Error') {
          toast.error(`Cannot connect to the backend server. Please make sure the FastAPI backend is running at: ${apiBase}`);
        } else {
          toast.error(`Error: ${err.response?.data?.detail || err.message || 'Unknown error'}`);
        }
      } else {
        // Fallback to alert if toast not available
        if (err.message === 'Network Error') {
          alert('Cannot connect to the backend server. Please make sure the FastAPI backend is running at: ' + apiBase);
        } else {
          alert(`Error: ${err.response?.data?.detail || err.message || 'Unknown error'}`);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h3>Upload PDF</h3>
      <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files[0])} />
      <button onClick={uploadAndProcess} disabled={!file || loading}>
        {loading ? 'Processing...' : 'Upload & Process'}
      </button>
    </div>
  );
}
