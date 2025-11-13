import React, { useState, useEffect } from 'react';
import UploadForm from './components/UploadForm';
import SearchInterface from './components/SearchInterface';
import GraphViewer from './components/GraphViewer';
import LoadingScreen from './components/LoadingScreen';
import axios from 'axios';
import './styles.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

export default function App() {
  const [graph, setGraph] = useState({ nodes: [], edges: [] });
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState(null);
  const [showUpload, setShowUpload] = useState(false);

  const fetchGraph = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_BASE}/graph`);
      setGraph(res.data);
      setSearchResults(null);
    } catch (err) {
      console.error("Failed to fetch graph:", err);
      setError(`Failed to connect to backend at ${API_BASE}. Make sure the FastAPI backend is running.`);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchResults = (nodes, edges, metadata) => {
    setGraph({ nodes, edges });
    setSearchResults(metadata);
    setError(null);
  };

  useEffect(() => {
    fetchGraph();
  }, []);

  return (
    <div className="app-root">
      {loading && <LoadingScreen />}
      <header className="app-header">
        <h1>Research Knowledge Graph</h1>
        {error && <div className="error-message">{error}</div>}
      </header>
      <main className="app-main">
        <aside className="left-pane">
          {!error ? (
            <>
              <SearchInterface onSearchResults={handleSearchResults} apiBase={API_BASE} />
              
              <div className="upload-section">
                <button 
                  onClick={() => setShowUpload(!showUpload)} 
                  className="toggle-upload-btn"
                >
                  {showUpload ? 'Hide' : 'Add New Paper'}
                </button>
                
                {showUpload && (
                  <UploadForm 
                    onProcessed={(nodes, edges) => setGraph({ nodes, edges })} 
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
                cd ../backend{'\n'}
                python -m venv .venv{'\n'}
                .\.venv\Scripts\Activate.ps1{'\n'}
                pip install -r requirements.txt{'\n'}
                python -m spacy download en_core_web_sm{'\n'}
                uvicorn app.main:app --reload
              </pre>
              <button onClick={fetchGraph}>Retry Connection</button>
            </div>
          )}
        </aside>
        <section className="graph-pane">
         {loading ? (
           <div className="loading">Loading graph data...</div>
         ) : (
          <GraphViewer graph={graph} onSelectNode={(n) => setSelected(n)} apiBase={API_BASE} />
         )}
        </section>
        <aside className="right-pane">
          <div className="info-panel">
            {searchResults && (
              <div className="search-info">
                <h4>Search Results</h4>
                {searchResults.query && <p><strong>Query:</strong> {searchResults.query}</p>}
                {searchResults.type === 'papers' && searchResults.papers && (
                  <p><strong>Found:</strong> {searchResults.papers.length} papers</p>
                )}
                {searchResults.type === 'entities' && searchResults.entities && (
                  <p><strong>Found:</strong> {searchResults.entities.length} entities</p>
                )}
              </div>
            )}
            
            {selected ? (
              <div className="node-details">
                <h3>{selected.label}</h3>
                <p><strong>Type:</strong> {selected.type}</p>
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
    </div>
  );
}
