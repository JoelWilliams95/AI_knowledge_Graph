import React, { useState, useEffect } from 'react';

const Header = ({ onRefresh, onOpenProfile, theme, onToggleTheme }) => {
  const [showSettings, setShowSettings] = useState(false);

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

  return (
    <header className="app-header">
      <div className="header-content">
        <h1>Research Knowledge Graph</h1>
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