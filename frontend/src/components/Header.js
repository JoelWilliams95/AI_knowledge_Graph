import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../services/AuthContext';
import { useCallback } from 'react';

const Header = ({ onRefresh, onOpenProfile, theme, onToggleTheme }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleHomeClick = () => {
    navigate('/');
  };

  const handleLogout = () => {
    logout();
  };


  const handleProfile = () => {
    if (onOpenProfile) onOpenProfile();
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (onRefresh) await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
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

          <button className="refresh-btn" onClick={(e) => { e.stopPropagation(); handleRefresh(); }} title="Refresh data and reset graph" disabled={isRefreshing}>
            {isRefreshing ? '⟳ Refreshing...' : '🔄 Refresh Data'}
          </button>

          {isAdmin() && (
            <button className="admin-btn" onClick={(e) => { e.stopPropagation(); navigate('/admin'); }} title="Go to admin panel">
              👤 Admin
            </button>
          )}

          <button className="profile-btn" onClick={(e) => {
            e.stopPropagation();
            handleProfile();
          }} title="View Profile">
            <span className="btn-icon">👤</span>
            <span>Profile</span>
          </button>

          <button className="logout-btn" onClick={(e) => {
            e.stopPropagation();
            handleLogout();
          }} title="Sign Out">
            <span className="btn-icon">↗️</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;