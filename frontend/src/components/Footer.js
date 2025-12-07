import React, { useState, useEffect } from 'react';

export default function Footer() {
  const [backendStatus, setBackendStatus] = useState('checking');
  const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

  useEffect(() => {
    const checkBackendStatus = async () => {
      try {
        const response = await fetch(`${API_BASE}/health`, {
          method: 'GET',
          timeout: 3000,
        });
        setBackendStatus(response.ok ? 'online' : 'offline');
      } catch (error) {
        setBackendStatus('offline');
      }
    };

    checkBackendStatus();
    const interval = setInterval(checkBackendStatus, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [API_BASE]);

  const getStatusText = () => {
    switch (backendStatus) {
      case 'online':
        return 'Backend: Online';
      case 'offline':
        return 'Backend: Offline';
      default:
        return 'Backend: Checking...';
    }
  };

  return (
    <footer className="app-footer">
      <div className="footer-content">
        <div className="footer-section">
          <span>© 2024 AI Knowledge Graph</span>
        </div>

        <div className="footer-links">
          <a href="https://github.com" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          <a href="https://docs.example.com" target="_blank" rel="noopener noreferrer">
            Docs
          </a>
          <a href="https://example.com/support" target="_blank" rel="noopener noreferrer">
            Support
          </a>
        </div>

        <div className="footer-status">
          <span className={`status-indicator ${backendStatus === 'offline' ? 'offline' : ''}`}></span>
          <span>{getStatusText()}</span>
        </div>
      </div>
    </footer>
  );
}
