import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../services/AuthContext';

const Header = ({ onRefresh, onOpenProfile, onOpenSettings, theme, onToggleTheme }) => {
  const [showSettings, setShowSettings] = useState(false);
  const { logout } = useAuth();
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

  const handleLogout = () => {
    logout();
  };

  const handleSettings = () => {
    setShowSettings(false);
    if (onOpenSettings) onOpenSettings();
  };

  const handleProfile = () => {
    setShowSettings(false);
    if (onOpenProfile) onOpenProfile();
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

          <button className="refresh-btn" onClick={(e) => { e.stopPropagation(); if (onRefresh) onRefresh(); }} title="Refresh data">
            Refresh Data
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
              <button onClick={handleSettings} className="dropdown-item">
                ⚙️ Settings
              </button>
              <button onClick={handleProfile} className="dropdown-item">
                👤 Profile
              </button>
              <div className="dropdown-divider"></div>
              <button onClick={handleLogout} className="dropdown-item danger">
                🚪 Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;