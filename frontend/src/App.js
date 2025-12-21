import React, { useState, useEffect } from 'react';
import UploadForm from './components/UploadForm';
import SearchInterface from './components/SearchInterface';
import GraphViewer from './components/GraphViewer';
import Header from './components/Header';
import Footer from './components/Footer';
import Modal from './components/Modal';
import { useGraphData } from './hooks/useGraphData';
import { useTheme } from './hooks/useTheme';
import { API_BASE } from './utils/constants';
import axios from 'axios';

export default function App() {
  const graphData = useGraphData();
  const { theme, toggleTheme } = useTheme();
  const [selected, setSelected] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [papers, setPapers] = useState([]);
  const [selectedPaperId, setSelectedPaperId] = useState(null);
  const [paperLoading, setPaperLoading] = useState(false);

  // Fetch papers data on component mount
  useEffect(() => {
    const fetchPapers = async () => {
      try {
        const response = await axios.get(`${API_BASE}/papers`);
        setPapers(response.data.papers || []);
      } catch (error) {
        console.error('Failed to fetch papers:', error);
      }
    };

    fetchPapers();
  }, []);

  const handlePaperSelect = async (paperId) => {
    setSelectedPaperId(paperId);
    setSelected(null);
    setPaperLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/papers/${paperId}/graph`);
      if (response.data) {
        graphData.setGraph({
          nodes: response.data.nodes || [],
          edges: response.data.edges || []
        });
      }
    } catch (error) {
      console.error('Failed to fetch paper graph:', error);
      // Fallback to empty graph
      graphData.setGraph({ nodes: [], edges: [] });
    } finally {
      setPaperLoading(false);
    }
  };

  useEffect(() => {
    if (graphData.error) {
      setShowErrorModal(true);
    }
  }, [graphData.error]);

  return (
    <div className="app-root">
      <Header
        onRefresh={graphData.fetchGraph}
        onOpenProfile={() => setShowProfileModal(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <Modal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        message={graphData.error}
        type="error"
        duration={5000}
      />

      <Modal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        type="profile"
      >
        <div style={{ minWidth: 280 }}>
          <h3 style={{ marginTop: 0 }}>User Profile</h3>
          <p>
            <strong>Name:</strong> Demo User
          </p>
          <p>
            <strong>Email:</strong> demo@example.com
          </p>
          <div
            style={{
              marginTop: 12,
              display: 'flex',
              gap: 8,
              justifyContent: 'flex-end',
            }}
          >
            <button
              onClick={() => setShowProfileModal(false)}
              className="secondary-btn"
            >
              Close
            </button>
            <button className="view-graph-btn">Edit</button>
          </div>
        </div>
      </Modal>

      <main className="app-main">
        <aside className="left-pane">
          {!graphData.error ? (
            <>
              <div className="papers-list-section">
                <h3 className="section-title">Available Papers</h3>
                <div className="papers-list-container">
                  {papers && papers.length > 0 ? (
                    papers.map((paper) => (
                      <div
                        key={paper.paper_id}
                        className={`paper-item ${selectedPaperId === paper.paper_id ? 'active' : ''}`}
                        onClick={() => handlePaperSelect(paper.paper_id)}
                      >
                        <div className="paper-title">{paper.title || 'Untitled'}</div>
                        <div className="paper-year">{paper.year || 'N/A'}</div>
                      </div>
                    ))
                  ) : (
                    <p className="no-papers">No papers available</p>
                  )}
                </div>
              </div>

              <SearchInterface
                onSearchResults={graphData.handleSearchResults}
                apiBase={API_BASE}
              />
              <div className="upload-section">
                <button
                  onClick={() => setShowUpload(!showUpload)}
                  className="toggle-upload-btn"
                >
                  {showUpload ? 'Hide' : 'Add New Paper'}
                </button>
                {showUpload && (
                  <UploadForm
                    onProcessed={(nodes, edges) =>
                      graphData.setGraph({ nodes, edges })
                    }
                    apiBase={API_BASE}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="backend-status">
              <h3>Backend not connected</h3>
              <p>To start the backend server:</p>
              <pre>
                {`cd ../backend
python -m venv .venv
.\\venv\\Scripts\\Activate.ps1
pip install -r requirements.txt
python -m spacy download en_core_web_sm
uvicorn app.main:app --reload`}
              </pre>
              <button onClick={graphData.fetchGraph}>Retry Connection</button>
            </div>
          )}
        </aside>

        <section className="graph-pane">
          {paperLoading ? (
            <div className="loading">Loading paper graph...</div>
          ) : graphData.loading ? (
            <div className="loading">Loading graph data...</div>
          ) : (
            <GraphViewer
              graph={graphData.graph}
              onSelectNode={(n) => setSelected(n)}
              apiBase={API_BASE}
            />
          )}
        </section>

        <aside className="right-pane">
          <div className="info-panel">
            {graphData.searchResults && (
              <div className="search-info">
                <h4>Search Results</h4>
                {graphData.searchResults.query && (
                  <p>
                    <strong>Query:</strong> {graphData.searchResults.query}
                  </p>
                )}
                {graphData.searchResults.type === 'papers' &&
                  graphData.searchResults.papers && (
                    <p>
                      <strong>Found:</strong>{' '}
                      {graphData.searchResults.papers.length} papers
                    </p>
                  )}
                {graphData.searchResults.type === 'entities' &&
                  graphData.searchResults.entities && (
                    <p>
                      <strong>Found:</strong>{' '}
                      {graphData.searchResults.entities.length} entities
                    </p>
                  )}
              </div>
            )}

            {selected && selected.id ? (
              <div className="node-details">
                {selected.type === 'paper' ? (
                  (() => {
                    const paper = papers.find(p => p.paper_id === selected.id);
                    return paper ? (
                      <div className="paper-details">
                        <h4>{paper.title || 'Untitled Paper'}</h4>
                        <div className="paper-info">
                          <div className="info-row">
                            <span className="label">Year:</span>
                            <span className="value">{paper.year || 'N/A'}</span>
                          </div>
                          <div className="info-row">
                            <span className="label">Upload Date:</span>
                            <span className="value">{paper.upload_date ? new Date(paper.upload_date).toLocaleDateString() : 'N/A'}</span>
                          </div>
                          <div className="info-row">
                            <span className="label">Journal:</span>
                            <span className="value">{paper.journal || 'N/A'}</span>
                          </div>
                          <div className="info-row">
                            <span className="label">Authors:</span>
                            <span className="value">{paper.authors || 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="paper-details">
                        <h4>{selected.label || 'Node'}</h4>
                        <p className="no-data">No paper details found</p>
                      </div>
                    );
                  })()
                ) : (
                  <div className="paper-details">
                    <h4>{selected.label || 'Entity'}</h4>
                    <div className="info-row">
                      <span className="label">Type:</span>
                      <span className="value">{selected.type || 'Entity'}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="help-text">
                <p>Select a node to see details</p>
                <p>Click on main nodes to expand and see their connections</p>
              </div>
            )}
          </div>
        </aside>
      </main>

      <Footer />
    </div>
  );
}
