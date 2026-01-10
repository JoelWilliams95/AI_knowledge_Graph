import React, { useEffect, useRef, useState } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import cytoscape from 'cytoscape';
import axios from 'axios';

export default function GraphViewer({ graph, onSelectNode, apiBase, theme = 'dark' }) {
  const cyRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
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
      highlightGlow: '#fbbf24'
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
      highlightGlow: '#f59e0b'
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
        'width': 50, 
        'height': 50, 
        'background-color': currentColors.pdfNode, 
        'color': '#000',
        'text-valign': 'center', 
        'text-halign': 'center',
        'font-size': '11px',
        'font-weight': '600',
        'text-wrap': 'wrap',
        'text-max-width': '80px',
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
        'width': 35, 
        'height': 35, 
        'background-color': currentColors.entityNode, 
        'color': currentColors.textPrimary, 
        'text-valign': 'center', 
        'text-halign': 'center',
        'font-size': '11px',
        'text-wrap': 'wrap',
        'text-max-width': '70px'
      } 
    },
    // Selected Node Highlight
    {
      selector: 'node:selected',
      style: {
        'background-color': currentColors.selectedNode,
        'border-width': 3,
        'border-color': currentColors.highlightGlow,
        'box-shadow': `0 0 15px ${currentColors.highlightGlow}80`,
        'width': 50,
        'height': 50,
        'color': '#000',
        'z-index': 10
      }
    },
    // Node on hover
    {
      selector: 'node:active',
      style: {
        'overlay-opacity': 0.3,
        'overlay-color': currentColors.highlightGlow,
        'overlay-padding': 10
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

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
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
    </div>
  );
}