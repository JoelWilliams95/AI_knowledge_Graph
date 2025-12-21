import React, { useState, useEffect } from 'react';

export default function Footer() {
  const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

  return (
    <footer className="app-footer">
      <div className="footer-content">
        <div className="footer-section">
          <span>© 2024 AI Knowledge Graph</span>
        </div>

        <div className="footer-links">
          <a href="https://github.com/JoelWilliams95/AI_knowledge_Graph" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          <a href="https://docs.example.com" target="_blank" rel="noopener noreferrer">
            Docs
          </a>
          <a href="https://example.com/support" target="_blank" rel="noopener noreferrer">
            Support
          </a>
        </div>
      </div>
    </footer>
  );
}
