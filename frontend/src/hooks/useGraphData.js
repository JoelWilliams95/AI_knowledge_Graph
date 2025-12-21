import { useState, useEffect } from 'react';
import { graphService } from '../services/graphService';

export const useGraphData = () => {
  const [graph, setGraph] = useState({ nodes: [], edges: [] });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState(null);

  const fetchGraph = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await graphService.fetchGraph();
      setGraph(data);
      setSearchResults(null);
    } catch (err) {
      console.error('Failed to fetch graph:', err);
      setError(
        `Failed to connect to backend. Make sure the FastAPI backend is running.`
      );
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

  return {
    graph,
    setGraph,
    error,
    setError,
    loading,
    searchResults,
    fetchGraph,
    handleSearchResults,
  };
};
