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

export default function App() {
  const graphData = useGraphData();
  const { theme, toggleTheme } = useTheme();
  const [selected, setSelected] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

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
          {graphData.loading ? (
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

            {selected ? (
              <div className="node-details">
                <h3>{selected.label}</h3>
                <p>
                  <strong>Type:</strong> {selected.type}
                </p>
                <div className="node-properties">
                  <h4>Properties:</h4>
                  <pre>{JSON.stringify(selected.props, null, 2)}</pre>
                </div>
              </div>
            ) : (
              <div className="help-text">
                <p>Select a node to see details</p>
                <p>Use the search interface to find papers and entities</p>
              </div>
            )}
          </div>
        </aside>
      </main>

      <Footer />
    </div>
  );
}
