import React from 'react';
import '../styles/loadingScreen.css';

export default function LoadingScreen() {
  return (
    <div className="loading-screen-overlay">
      <div className="loading-screen-container">
        <div className="loading-content">
          <img 
            src="/logo.png" 
            alt="Knowledge Graph Logo" 
            className="loading-logo"
          />
          <div className="loading-spinner"></div>
          <h2 className="loading-title">Building Knowledge Graph</h2>
          <p className="loading-message">Indexing papers and concepts...</p>
          <div className="loading-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
    </div>
  );
}
