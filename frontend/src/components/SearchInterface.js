import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

export default function SearchInterface({ onSearchResults, apiBase, graphData }) {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState('papers'); // 'papers' or 'entities'
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const suggestionsRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Load all papers on component mount
  useEffect(() => {
    loadAllPapers();
  }, []);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadAllPapers = async () => {
    try {
      const response = await axios.get(`${apiBase}/papers`);
      setPapers(response.data.papers || []);
    } catch (error) {
      console.error('Failed to load papers:', error);
    }
  };

  const fetchSuggestions = async (searchQuery) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    setSuggestionsLoading(true);
    try {
      const response = await axios.get(`${apiBase}/suggest?q=${encodeURIComponent(searchQuery)}&limit=5`);
      
      // Also get suggestions from the current graph
      const graphSuggestions = getGraphSuggestions(searchQuery);
      
      setSuggestions({
        papers: response.data.papers || [],
        entities: response.data.entities || [],
        graphEntities: graphSuggestions
      });
      setShowSuggestions(true);
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  // Get suggestions from the current graph
  const getGraphSuggestions = (searchQuery) => {
    if (!graphData?.nodes || graphData.nodes.length === 0) {
      return [];
    }

    const lowerQuery = searchQuery.toLowerCase();
    const uniqueEntities = new Map();

    // Filter nodes that match the query and aren't papers
    graphData.nodes.forEach(node => {
      if (node.label && node.label.toLowerCase().includes(lowerQuery)) {
        // Avoid duplicates by using label as key
        if (!uniqueEntities.has(node.label)) {
          uniqueEntities.set(node.label, {
            name: node.label,
            type: node.type || 'Entity',
            source: 'graph', // Mark as from graph
            id: node.id
          });
        }
      }
    });

    // Return up to 5 suggestions, sorted by length (exact matches first)
    return Array.from(uniqueEntities.values())
      .sort((a, b) => a.name.length - b.name.length)
      .slice(0, 5);
  };

  const handleQueryChange = (e) => {
    const value = e.target.value;
    setQuery(value);

    // Debounce suggestions fetch
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (value.trim().length >= 2) {
      debounceTimerRef.current = setTimeout(() => {
        fetchSuggestions(value);
      }, 300); // 300ms debounce
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    if (suggestion.type === 'paper') {
      setQuery(suggestion.title);
      setShowSuggestions(false);
    } else if (suggestion.type && (suggestion.type !== 'paper')) {
      setQuery(suggestion.name || suggestion.title);
      setShowSuggestions(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setShowSuggestions(false);
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
        // Search entities - also fetch the graph data
        const [entitiesResponse, graphResponse] = await Promise.all([
          axios.get(`${apiBase}/entities/search?q=${encodeURIComponent(query)}`),
          axios.get(`${apiBase}/graph/search?q=${encodeURIComponent(query)}`)
        ]);
        onSearchResults(graphResponse.data.nodes || [], graphResponse.data.edges || [], {
          entities: entitiesResponse.data.entities,
          query: query,
          type: 'entities'
        });
      }
    } catch (error) {
      console.error('Search failed:', error);
      if (toast) {
        toast.error('Search failed. Please try again.');
      } else {
        alert('Search failed. Please try again.');
      }
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
          
          <div className="search-input-wrapper" ref={suggestionsRef}>
            <input
              type="text"
              value={query}
              onChange={handleQueryChange}
              onFocus={() => query.length >= 2 && suggestions.length > 0 && setShowSuggestions(true)}
              placeholder={searchType === 'papers' ? 'Enter keywords to search papers...' : 'Search for entities...'}
              className="search-input"
              autoComplete="off"
            />
            
            {showSuggestions && (suggestions.papers?.length > 0 || suggestions.entities?.length > 0 || suggestions.graphEntities?.length > 0) && (
              <div className="suggestions-dropdown">
                {suggestionsLoading ? (
                  <div className="suggestion-item disabled">Loading suggestions...</div>
                ) : (
                  <>
                    {suggestions.graphEntities && suggestions.graphEntities.length > 0 && (
                      <div className="suggestions-group">
                        <div className="suggestions-group-title">📊 From Current Graph</div>
                        {suggestions.graphEntities.map((entity, idx) => (
                          <div
                            key={`graph-entity-${idx}`}
                            className="suggestion-item"
                            onClick={() => handleSuggestionClick(entity)}
                          >
                            <div className="suggestion-text">{entity.name}</div>
                            <div className="suggestion-meta">{entity.type}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {suggestions.papers && suggestions.papers.length > 0 && (
                      <div className="suggestions-group">
                        <div className="suggestions-group-title">📄 Papers</div>
                        {suggestions.papers.map((paper, idx) => (
                          <div
                            key={`paper-${idx}`}
                            className="suggestion-item"
                            onClick={() => handleSuggestionClick(paper)}
                          >
                            <div className="suggestion-text">{paper.title}</div>
                            <div className="suggestion-meta">{paper.paper_id?.substring(0, 8)}...</div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {suggestions.entities && suggestions.entities.length > 0 && (
                      <div className="suggestions-group">
                        <div className="suggestions-group-title">🔤 Database Entities</div>
                        {suggestions.entities.map((entity, idx) => (
                          <div
                            key={`entity-${idx}`}
                            className="suggestion-item"
                            onClick={() => handleSuggestionClick(entity)}
                          >
                            <div className="suggestion-text">{entity.name}</div>
                            <div className="suggestion-meta">{entity.type}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
          
          <button type="submit" disabled={loading || !query.trim()}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>

      {/* Search Results Display */}
      {suggestions.query && (
        <div className="search-results-section">
          {loading && (
            <div className="results-placeholder">Searching...</div>
          )}

          {!loading && suggestions.graphEntities && suggestions.graphEntities.length > 0 && (
            <div className="results-group">
              <div className="results-group-title">📊 From Current Graph ({suggestions.graphEntities.length})</div>
              <div className="results-items">
                {suggestions.graphEntities.map((entity, idx) => (
                  <div key={`result-graph-entity-${idx}`} className="result-item">
                    <div className="result-title">{entity.name}</div>
                    <div className="result-meta">{entity.type}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && suggestions.papers && suggestions.papers.length > 0 && (
            <div className="results-group">
              <div className="results-group-title">📄 Papers Found ({suggestions.papers.length})</div>
              <div className="results-items">
                {suggestions.papers.map((paper, idx) => (
                  <div key={`result-paper-${idx}`} className="result-item">
                    <div className="result-title">{paper.title}</div>
                    <div className="result-meta">{paper.paper_id?.substring(0, 8)}...</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && suggestions.entities && suggestions.entities.length > 0 && (
            <div className="results-group">
              <div className="results-group-title">🔤 Database Entities ({suggestions.entities.length})</div>
              <div className="results-items">
                {suggestions.entities.map((entity, idx) => (
                  <div key={`result-entity-${idx}`} className="result-item">
                    <div className="result-title">{entity.name}</div>
                    <div className="result-meta">{entity.type}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && (!suggestions.papers || suggestions.papers.length === 0) && 
           (!suggestions.entities || suggestions.entities.length === 0) && (
            <div className="results-placeholder">No results found for "{suggestions.query}"</div>
          )}
        </div>
      )}
    </div>
  );
}