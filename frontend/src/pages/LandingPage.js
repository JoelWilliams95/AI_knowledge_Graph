import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../services/AuthContext';

export default function LandingPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleExploreGraph = () => {
    navigate('/dashboard');
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="landing-page">
      <div className="landing-header">
        <div className="landing-nav">
          <h1 className="landing-title">AI Knowledge Graph</h1>
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </div>

      <div className="landing-hero">
        <div className="hero-content">
          <h2>Welcome to Your Knowledge Hub</h2>
          <p>
            Explore interconnected research papers, discover relationships between concepts,
            and uncover insights from your academic documents.
          </p>
          <button onClick={handleExploreGraph} className="explore-btn">
            Explore Knowledge Graph
          </button>
        </div>

        <div className="hero-stats">
          <div className="stat-card">
            <div className="stat-number">2</div>
            <div className="stat-label">Papers</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">∞</div>
            <div className="stat-label">Connections</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">AI</div>
            <div className="stat-label">Powered</div>
          </div>
        </div>
      </div>

      <div className="landing-features">
        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-icon">📄</div>
            <h3>Upload Papers</h3>
            <p>Upload PDF research papers and automatically extract entities and relationships</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🔍</div>
            <h3>Smart Search</h3>
            <p>Search through papers and entities with intelligent filtering</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🕸️</div>
            <h3>Visual Graph</h3>
            <p>Explore connections between concepts in an interactive graph view</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🤖</div>
            <h3>AI Analysis</h3>
            <p>Leverage AI to understand relationships and extract insights</p>
          </div>
        </div>
      </div>
    </div>
  );
}