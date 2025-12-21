import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Header = ({ onRefresh, onOpenProfile, theme, onToggleTheme }) => {
  const [showSettings, setShowSettings] = useState(false);
  const navigate = useNavigate();

  const handleClickOutside = (e) => {
    if (!e.target.closest('.header-actions')) {
      setShowSettings(false);
    }
  };

  useEffect(() => {
    if (showSettings) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showSettings]);

  const handleHomeClick = () => {
    navigate('/');
  };

  return (
    <header className="app-header">
      <div className="header-content">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={handleHomeClick}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text)',
              cursor: 'pointer',
              fontSize: '1.1rem',
              padding: '4px 8px',
              borderRadius: '6px',
              transition: 'background 0.2s ease'
            }}
            onMouseEnter={(e) => e.target.style.background = 'var(--overlay-light)'}
            onMouseLeave={(e) => e.target.style.background = 'transparent'}
            title="Back to Home"
          >
            🏠
          </button>
          <h1>Research Knowledge Graph</h1>
        </div>
        <div className="header-actions">
          <button className="theme-toggle-btn" onClick={(e) => { e.stopPropagation(); if (onToggleTheme) onToggleTheme(); }} title="Toggle theme">
            {theme === 'dark' ? '🌙' : '☀️'}
          </button>

          <button className="profile-btn" onClick={(e) => {
            e.stopPropagation();
            setShowSettings(!showSettings);
          }}>
            <span className="btn-icon">👤</span>
            <span>Profile</span>
          </button>
          {showSettings && (
            <div className="profile-dropdown">
              <button onClick={() => { /* placeholder for settings */ }}>⚙️ Settings</button>
              <button onClick={() => { if (onOpenProfile) onOpenProfile(); }}>👤 Profile</button>
              <button onClick={() => { /* TODO: implement sign out */ }}>🚪 Sign Out</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;