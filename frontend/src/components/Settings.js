import React, { useState, useEffect } from 'react';
import '../styles/settings.css';

const Settings = ({ onClose, theme, onThemeChange }) => {
  const [settings, setSettings] = useState({
    graphDepth: localStorage.getItem('graphDepth') || '2',
    autoRefresh: localStorage.getItem('autoRefresh') === 'true',
    refreshInterval: parseInt(localStorage.getItem('refreshInterval') || '30'),
    maxNodes: parseInt(localStorage.getItem('maxNodes') || '500'),
    highlightSearch: localStorage.getItem('highlightSearch') === 'true',
    notifications: localStorage.getItem('notifications') === 'true',
    fontSize: localStorage.getItem('fontSize') || 'medium',
    compactMode: localStorage.getItem('compactMode') === 'true'
  });

  const handleChange = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    
    // Save to localStorage
    if (typeof value === 'boolean') {
      localStorage.setItem(key, value.toString());
    } else {
      localStorage.setItem(key, value.toString());
    }
  };

  const handleReset = () => {
    if (window.confirm('Reset all settings to defaults?')) {
      const defaults = {
        graphDepth: '2',
        autoRefresh: false,
        refreshInterval: 30,
        maxNodes: 500,
        highlightSearch: true,
        notifications: true,
        fontSize: 'medium',
        compactMode: false
      };
      setSettings(defaults);
      Object.entries(defaults).forEach(([key, value]) => {
        localStorage.setItem(key, value.toString());
      });
    }
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>⚙️ Settings</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="settings-content">
          {/* Display Settings */}
          <div className="settings-section">
            <h3>Display</h3>
            
            <div className="setting-group">
              <label>Theme</label>
              <select value={theme} onChange={(e) => onThemeChange(e.target.value)}>
                <option value="dark">🌙 Dark</option>
                <option value="light">☀️ Light</option>
              </select>
            </div>

            <div className="setting-group">
              <label>Font Size</label>
              <select 
                value={settings.fontSize} 
                onChange={(e) => handleChange('fontSize', e.target.value)}
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </div>

            <div className="setting-group checkbox">
              <input 
                type="checkbox" 
                id="compactMode"
                checked={settings.compactMode}
                onChange={(e) => handleChange('compactMode', e.target.checked)}
              />
              <label htmlFor="compactMode">Compact Mode</label>
              <p className="setting-help">Reduces spacing for more content</p>
            </div>
          </div>

          {/* Graph Settings */}
          <div className="settings-section">
            <h3>Graph Visualization</h3>
            
            <div className="setting-group">
              <label>Graph Depth: {settings.graphDepth}</label>
              <input 
                type="range" 
                min="1" 
                max="5" 
                value={settings.graphDepth}
                onChange={(e) => handleChange('graphDepth', e.target.value)}
              />
              <p className="setting-help">How many levels deep to show related nodes</p>
            </div>

            <div className="setting-group">
              <label>Max Nodes: {settings.maxNodes}</label>
              <input 
                type="range" 
                min="100" 
                max="1000" 
                step="100"
                value={settings.maxNodes}
                onChange={(e) => handleChange('maxNodes', parseInt(e.target.value))}
              />
              <p className="setting-help">Maximum nodes to display (higher = more detailed but slower)</p>
            </div>

            <div className="setting-group checkbox">
              <input 
                type="checkbox" 
                id="highlightSearch"
                checked={settings.highlightSearch}
                onChange={(e) => handleChange('highlightSearch', e.target.checked)}
              />
              <label htmlFor="highlightSearch">Highlight Search Results</label>
            </div>
          </div>

          {/* Data & Refresh */}
          <div className="settings-section">
            <h3>Data & Refresh</h3>
            
            <div className="setting-group checkbox">
              <input 
                type="checkbox" 
                id="autoRefresh"
                checked={settings.autoRefresh}
                onChange={(e) => handleChange('autoRefresh', e.target.checked)}
              />
              <label htmlFor="autoRefresh">Auto-Refresh Data</label>
            </div>

            {settings.autoRefresh && (
              <div className="setting-group">
                <label>Refresh Interval: {settings.refreshInterval}s</label>
                <input 
                  type="range" 
                  min="10" 
                  max="300" 
                  step="10"
                  value={settings.refreshInterval}
                  onChange={(e) => handleChange('refreshInterval', parseInt(e.target.value))}
                />
              </div>
            )}
          </div>

          {/* Notifications */}
          <div className="settings-section">
            <h3>Notifications</h3>
            
            <div className="setting-group checkbox">
              <input 
                type="checkbox" 
                id="notifications"
                checked={settings.notifications}
                onChange={(e) => handleChange('notifications', e.target.checked)}
              />
              <label htmlFor="notifications">Enable Notifications</label>
              <p className="setting-help">Get alerts when processing completes</p>
            </div>
          </div>

          {/* Cache Settings */}
          <div className="settings-section">
            <h3>Cache & Storage</h3>
            
            <button className="btn-secondary" onClick={() => {
              localStorage.clear();
              window.location.reload();
            }} style={{ color: '#ff6b6b' }}>
              🗑️ Clear All Cache
            </button>
            <p className="setting-help">Clears all saved preferences and data</p>
          </div>
        </div>

        <div className="settings-footer">
          <button className="btn-secondary" onClick={handleReset}>
            ↺ Reset to Defaults
          </button>
          <button className="btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
