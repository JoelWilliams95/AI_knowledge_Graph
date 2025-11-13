import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function SearchInterface({ onSearchResults, apiBase }) {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState('papers'); // 'papers' or 'entities'
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState(null);

  // Load all papers on component mount
  useEffect(() => {
    loadAllPapers();
  }, []);

  const loadAllPapers = async () => {
    try {
      const response = await axios.get(`${apiBase}/papers`);
      setPapers(response.data.papers || []);
    } catch (error) {
      console.error('Failed to load papers:', error);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      if (searchType === 'papers') {
        // Search papers and update graph
        const [papersResponse, graphResponse] = await Promise.all([
          axios.get(`${apiBase}/papers/search?q=${encodeURIComponent(query)}`),
          axios.get(`${apiBase}/graph/search?q=${encodeURIComponent(query)}`)
        ]);
        
        onSearchResults(graphResponse.data.nodes, graphResponse.data.edges, {
          papers: papersResponse.data.papers,
          query: query,
          type: 'papers'
        });
      } else {
        // Search entities
        const entitiesResponse = await axios.get(`${apiBase}/entities/search?q=${encodeURIComponent(query)}`);
        onSearchResults([], [], {
          entities: entitiesResponse.data.entities,
          query: query,
          type: 'entities'
        });
      }
    } catch (error) {
      console.error('Search failed:', error);
      alert('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const viewPaperGraph = async (paperId) => {
    try {
      const response = await axios.get(`${apiBase}/papers/${paperId}/graph`);
      onSearchResults(response.data.nodes, response.data.edges, {
        paper_id: paperId,
        type: 'single_paper'
      });
      setSelectedPaper(paperId);
    } catch (error) {
      console.error('Failed to load paper graph:', error);
    }
  };

  const loadFullGraph = async () => {
    try {
      const response = await axios.get(`${apiBase}/graph`);
      onSearchResults(response.data.nodes, response.data.edges, {
        type: 'full_graph'
      });
      setSelectedPaper(null);
      setQuery('');
    } catch (error) {
      console.error('Failed to load full graph:', error);
    }
  };

  return (
    <div className="search-interface">
      <h3>Search Research Papers</h3>
      
      {/* Search Form */}
      <form onSubmit={handleSearch} className="search-form">
        <div className="search-controls">
          <select 
            value={searchType} 
            onChange={(e) => setSearchType(e.target.value)}
            className="search-type-select"
          >
            <option value="papers">Search Papers</option>
            <option value="entities">Search Entities</option>
          </select>
          
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchType === 'papers' ? 'Enter keywords to search papers...' : 'Search for entities...'}
            className="search-input"
          />
          
          <button type="submit" disabled={loading || !query.trim()}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>

      <div className="action-buttons">
        <button onClick={loadFullGraph} className="secondary-btn">
          View Full Graph
        </button>
        <button onClick={loadAllPapers} className="secondary-btn">
          Refresh Papers
        </button>
      </div>

      {/* Papers List */}
      <div className="papers-section">
        <h4>Available Papers ({papers.length})</h4>
        <div className="papers-list">
          {papers.map((paper) => (
            <div 
              key={paper.paper_id} 
              className={`paper-item ${selectedPaper === paper.paper_id ? 'selected' : ''}`}
            >
              <h5>{paper.title}</h5>
              {paper.authors && <p className="paper-authors">By: {paper.authors}</p>}
              {paper.year && <span className="paper-year">{paper.year}</span>}
              {paper.journal && <span className="paper-journal"> • {paper.journal}</span>}
              
              <div className="paper-actions">
                <button 
                  onClick={() => viewPaperGraph(paper.paper_id)}
                  className="view-graph-btn"
                >
                  View Graph
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}