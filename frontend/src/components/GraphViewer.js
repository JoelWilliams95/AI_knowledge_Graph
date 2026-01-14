import React, { useEffect, useRef, useState } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import cytoscape from 'cytoscape';
import axios from 'axios';

export default function GraphViewer({ graph, onSelectNode, apiBase, theme = 'dark' }) {
  const cyRef = useRef(null);
  const containerRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const lastPosRef = useRef(null);

  useEffect(() => {
    const m = window.matchMedia('(max-width: 768px)');
    setIsMobile(m.matches);
    const handler = (e) => setIsMobile(e.matches);
    m.addEventListener('change', handler);
    return () => m.removeEventListener('change', handler);
  }, []);

  // Color scheme based on theme
  const colors = {
    dark: {
      pdfNode: '#fbbf24',        // amber
      entityNode: '#60a5fa',     // blue
      edge: '#64748b',           // slate
      edgeArrow: '#64748b',
      selectedNode: '#fbbf24',
      selectedEdge: '#fbbf24',
      textPrimary: '#f8fafc',
      textSecondary: '#cbd5e1',
      textBg: '#1e293b',
        // subtle blue to match dark background
    },
    light: {
      pdfNode: '#f59e0b',        // amber (darker for light mode)
      entityNode: '#0ea5e9',     // blue (darker for light mode)
      edge: '#cbd5e1',           // slate
      edgeArrow: '#cbd5e1',
      selectedNode: '#f59e0b',
      selectedEdge: '#f59e0b',
      textPrimary: '#1e293b',
      textSecondary: '#475569',
      textBg: '#f1f5f9',
      highlightGlow: '#3b82f6'   // subtle blue to match light background
    }
  };

  const currentColors = colors[theme] || colors.dark;

  const elements = [
    ...((graph?.nodes || []).map((n) => ({ 
      data: { id: n.id, label: n.label, props: n.props, isPdf: n.label?.endsWith('.pdf') || false },
      grabbable: true
    })) || []),
    ...((graph?.edges || []).map((e) => ({ 
      data: { id: e.id, source: e.source, target: e.target, label: e.label } 
    })) || []),
  ];

  const layout = {
    name: 'cose',
    animate: true,
    animationDuration: 1000,
    fit: true,
    padding: 30,
    randomize: false,
    componentSpacing: 100,
    nodeRepulsion: 400000,
    nodeOverlap: 20,
    idealEdgeLength: 100,
    edgeElasticity: 100,
    nestingFactor: 5,
    gravity: 80,
    numIter: 1000,
    initialTemp: 200,
    coolingFactor: 0.95,
    minTemp: 1.0
  };

  const style = [
    // PDF Nodes (center nodes)
    {
      selector: 'node[isPdf]',
      style: {
        'label': 'data(label)',
        'width': 80,
        'height': 80,
        'background-color': currentColors.pdfNode,
        'color': '#000',
        'text-valign': 'center',
        'text-halign': 'center',
        'font-size': '12px',
        'font-weight': '600',
        'text-wrap': 'wrap',
        'text-max-width': '68px',
        'text-overflow-wrap': 'anywhere',
        'text-justification': 'center',
        'text-margin-x': '3px',
        'text-margin-y': '3px',
        'border-width': 2,
        'border-color': currentColors.pdfNode,
        'box-shadow': `0 0 10px ${currentColors.pdfNode}40`
      }
    },
    // Regular Entity Nodes
    {
      selector: 'node:not([isPdf])',
      style: {
        'label': 'data(label)',
        'width': 60,
        'height': 60,
        'background-color': currentColors.entityNode,
        'color': currentColors.textPrimary,
        'text-valign': 'center',
        'text-halign': 'center',
        'font-size': '11px',
        'text-wrap': 'wrap',
        'text-max-width': '48px',
        'text-overflow-wrap': 'anywhere',
        'text-justification': 'center',
        'text-margin-x': '2px',
        'text-margin-y': '2px'
      }
    },
    // Selected Node Highlight
    {
      selector: 'node:selected',
      style: {
        'background-color': currentColors.selectedNode,
        'width': function(ele) {
          // Make selected nodes larger based on their original type
          return ele.data('isPdf') ? 100 : 75;
        },
        'height': function(ele) {
          // Make selected nodes larger based on their original type
          return ele.data('isPdf') ? 100 : 75;
        },
        'font-size': '14px',
        'font-weight': '0',
        'text-max-width': function(ele) {
          // Ensure text stays within node boundaries with padding
          return ele.data('isPdf') ? '84px' : '59px';
        },
        'text-margin-x': function(ele) {
          // Add padding from node edges
          return ele.data('isPdf') ? '4px' : '3px';
        },
        'text-margin-y': function(ele) {
          // Add padding from node edges
          return ele.data('isPdf') ? '4px' : '3px';
        },
        'color': '#000',
        'z-index': 10
      }
    },
    // Node on hover
    
    // Node on active (dragging)
    {
      selector: 'node:active',
      style: {
        'overlay-opacity': 0.4,
        'overlay-color': currentColors.highlightGlow,
        'overlay-padding': 15
      }
    },
    // Regular Edges
    { 
      selector: 'edge', 
      style: { 
        'label': 'data(label)', 
        'curve-style': 'bezier', 
        'target-arrow-shape': 'triangle',
        'width': 2,
        'line-color': currentColors.edge,
        'target-arrow-color': currentColors.edgeArrow,
        'opacity': 0.6,
        'font-size': '10px',
        'color': currentColors.textSecondary,
        'text-background-color': currentColors.textBg,
        'text-background-opacity': 0.95,
        'text-background-padding': '3px',
        'text-border-width': 0,
        'font-weight': 500
      } 
    },
    // Highlighted edges (connected to selected node)
    {
      selector: 'edge.highlighted',
      style: {
        'line-color': currentColors.selectedEdge,
        'target-arrow-color': currentColors.selectedEdge,
        'width': 3,
        'opacity': 1,
        'z-index': 10
      }
    },
    // Faded edges (not connected to selected node)
    {
      selector: 'edge.faded',
      style: {
        'opacity': 0.2
      }
    }
  ];

  const handleNodeTap = async (evt) => {
    const node = evt.target;
    const id = node.id();
    
    // Set selected node
    setSelectedNodeId(id);
    
    // Clear all previous highlighting
    if (cyRef.current) {
      cyRef.current.elements().removeClass('highlighted faded');
      cyRef.current.nodes().unselect();
    }
    
    // Select the clicked node
    node.select();
    
    // Get connected edges
    const connectedEdges = node.connectedEdges();
    const connectedNodeIds = new Set([id]);
    
    // Highlight connected edges and collect connected node IDs
    connectedEdges.forEach(edge => {
      edge.addClass('highlighted');
      connectedNodeIds.add(edge.source().id());
      connectedNodeIds.add(edge.target().id());
    });
    
    // Fade non-connected edges
    cyRef.current.edges().forEach(edge => {
      if (!edge.hasClass('highlighted')) {
        edge.addClass('faded');
      }
    });
    
    // Highlight connected nodes
    cyRef.current.nodes().forEach(n => {
      if (connectedNodeIds.has(n.id())) {
        n.addClass('highlighted');
      }
    });
    
    onSelectNode({ id, label: node.data('label'), props: node.data('props') });

    if (isMobile) {
      try {
        const res = await axios.get(`${apiBase}/graph/${encodeURIComponent(id)}/expand`);
      } catch (err) {
        console.error('Expand failed', err);
      }
    }
  };

  const handleCanvasTap = (evt) => {
    // Only clear if tapping on canvas (not on a node)
    if (evt.target === evt.cy) {
      setSelectedNodeId(null);
      if (cyRef.current) {
        cyRef.current.elements().removeClass('highlighted faded');
        cyRef.current.nodes().unselect();
      }
      onSelectNode(null);
    }
  };

  // Handle when node is being dragged - reposition connected nodes
  const handleGrab = (evt) => {
    const draggedNode = evt.target;
    const draggedLabel = draggedNode.data('label');
    
    // Check if the dragged node is the central node (ends with .pdf)
    const isCentralNode = draggedLabel && draggedLabel.endsWith('.pdf');
    
    // If central node, drag the whole connected component; otherwise, just this node
    const component = isCentralNode 
      ? draggedNode.closedNeighborhood() 
      : cyRef.current.collection(draggedNode);

    lastPosRef.current = {
      pos: { ...draggedNode.position() },
      component: component,
      draggedNodeId: draggedNode.id(),
      isCentralNode: isCentralNode
    };
  };

  const handleDrag = (evt) => {
    const draggedNode = evt.target;

    if (!lastPosRef.current) return;

    const currentPos = draggedNode.position();
    const dx = currentPos.x - lastPosRef.current.pos.x;
    const dy = currentPos.y - lastPosRef.current.pos.y;

    if (dx === 0 && dy === 0) return;

    if (lastPosRef.current.isCentralNode) {
      // Central node: move all connected nodes with it
      lastPosRef.current.component.forEach((node) => {
        if (node.id() !== lastPosRef.current.draggedNodeId && node.grabbable() && !node.locked()) {
          const pos = node.position();
          node.position({
            x: pos.x + dx,
            y: pos.y + dy,
          });
        }
      });
    }
    // If not central node, the natural Cytoscape drag handles it (only this node moves)

    // Update reference position for next drag event
    lastPosRef.current.pos = { ...currentPos };
  };

  const handleDragFree = (evt) => {
    const node = evt.target;

    // Optional: save final position
    //savePositionToBackend(node.id(), node.position());

    // Cleanup
    lastPosRef.current = null;
  };

  // Optional: Save position to backend
  const savePositionToBackend = async (nodeId, position) => {
    try {
      await axios.post(`${apiBase}/graph/node/${encodeURIComponent(nodeId)}/position`, {
        x: position.x,
        y: position.y
      });
    } catch (err) {
      // Silently fail - backend endpoint might not exist
      console.debug('Position save skipped:', err.message);
    }
  };

  // Zoom control functions
  const handleZoomIn = () => {
    if (cyRef.current) {
      cyRef.current.zoom(cyRef.current.zoom() * 1.2);
    }
  };

  const handleZoomOut = () => {
    if (cyRef.current) {
      cyRef.current.zoom(cyRef.current.zoom() * 0.8);
    }
  };

  const handleFitToView = () => {
    if (cyRef.current) {
      cyRef.current.fit(undefined, 50); // Fit all elements with 50px padding
    }
  };

  const handleFullscreen = () => {
    if (!isFullscreen) {
      // Request fullscreen
      if (containerRef.current) {
        if (containerRef.current.requestFullscreen) {
          containerRef.current.requestFullscreen();
        } else if (containerRef.current.webkitRequestFullscreen) {
          containerRef.current.webkitRequestFullscreen();
        } else if (containerRef.current.mozRequestFullScreen) {
          containerRef.current.mozRequestFullScreen();
        } else if (containerRef.current.msRequestFullscreen) {
          containerRef.current.msRequestFullscreen();
        }
      }
    } else {
      // Exit fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  };


  // Keyboard shortcuts for zoom and controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Check if user is typing in an input/textarea - ignore shortcuts
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }

      const cy = cyRef.current;
      if (!cy) return;

      // Zoom in: Ctrl/Cmd + Plus/Equals
      if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        cy.zoom(cy.zoom() * 1.2);
      }
      // Zoom out: Ctrl/Cmd + Minus
      else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        cy.zoom(cy.zoom() * 0.8);
      }
      // Fit to view: F key
      else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        cy.fit(undefined, 50);
      }
      // Fullscreen: H key
      else if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        handleFullscreen();
      }
      // Clear selection: Escape
      else if (e.key === 'Escape') {
        e.preventDefault();
        // Clear selection
        setSelectedNodeId(null);
        cy.elements().removeClass('highlighted faded');
        cy.nodes().unselect();
        onSelectNode(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSelectNode]); // Empty deps - cyRef is stable and we check it inside

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
      setIsFullscreen(isCurrentlyFullscreen);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'relative' }}
      className={isFullscreen ? 'graph-viewer-fullscreen' : ''}
    >
      <CytoscapeComponent
        elements={elements}
        style={{ width: '100%', height: '100%' }}
        cy={(cy) => {
          cyRef.current = cy;

          // Set user interaction options
          cy.userZoomingEnabled(true);
          cy.userPanningEnabled(true);
          cy.boxSelectionEnabled(false);

          // Make sure all nodes are grabbable
          cy.nodes().grabify();

          // Add event listeners
          cy.on('tap', 'node', handleNodeTap);
          cy.on('tap', handleCanvasTap);
          cy.on('grab', 'node', handleGrab);        // when grab starts
          cy.on('drag', 'node', handleDrag);        // during drag
          cy.on('free', 'node', handleDragFree);    // when released
        }}
        layout={layout}
        stylesheet={style}
        autoungrabify={false} // Critical: allows nodes to be grabbed
        autounselectify={false} // Allows selection
      />

      {/* Graph Control Panel */}
      <div className="graph-controls-panel">
        <button
          className="graph-control-btn"
          onClick={handleZoomIn}
          title="Zoom In (Ctrl/Cmd + Plus)"
          aria-label="Zoom In"
        >
          <span className="control-icon">+</span>
        </button>
        <button
          className="graph-control-btn"
          onClick={handleZoomOut}
          title="Zoom Out (Ctrl/Cmd + Minus)"
          aria-label="Zoom Out"
        >
          <span className="control-icon">−</span>
        </button>
        <button
          className="graph-control-btn"
          onClick={handleFitToView}
          title="Fit to View (F key)"
          aria-label="Fit to View"
        >
          <span className="control-icon">⛶</span>
        </button>
        <button
          className="graph-control-btn"
          onClick={() => {
            // Clear selection
            setSelectedNodeId(null);
            if (cyRef.current) {
              cyRef.current.elements().removeClass('highlighted faded');
              cyRef.current.nodes().unselect();
            }
            onSelectNode(null);
          }}
          title="Clear Selection (Escape)"
          aria-label="Clear Selection"
        >
          <span className="control-icon">✕</span>
        </button>
        <button
          className="graph-control-btn"
          onClick={handleFullscreen}
          title={isFullscreen ? "Exit Fullscreen (H key)" : "Fullscreen (H key)"}
          aria-label={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
        >
          <span className="control-icon">{isFullscreen ? '⛶' : '□'}</span>
        </button>
      </div>
    </div>
  );
}