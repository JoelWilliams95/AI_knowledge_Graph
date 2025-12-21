import React, { useEffect, useRef, useState } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import cytoscape from 'cytoscape';
import axios from 'axios';

export default function GraphViewer({ graph, onSelectNode, apiBase }) {
  const cyRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const m = window.matchMedia('(max-width: 768px)');
    setIsMobile(m.matches);
    const handler = (e) => setIsMobile(e.matches);
    m.addEventListener('change', handler);
    return () => m.removeEventListener('change', handler);
  }, []);

  const elements = [
    ...graph.nodes.map((n) => ({ 
      data: { id: n.id, label: n.label, props: n.props },
      grabbable: true // Make sure nodes are grabbable
    })),
    ...graph.edges.map((e) => ({ 
      data: { id: e.id, source: e.source, target: e.target, label: e.label } 
    })),
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
    { 
      selector: 'node', 
      style: { 
        'label': 'data(label)', 
        'width': 40, 
        'height': 40, 
        'background-color': '#1976d2', 
        'color': '#fff', 
        'text-valign': 'center', 
        'text-halign': 'center',
        'font-size': '12px',
        'text-wrap': 'wrap',
        'text-max-width': '80px'
      } 
    },
    { 
      selector: 'node:active', 
      style: { 
        'overlay-opacity': 0.2,
        'overlay-color': '#2196f3',
        'overlay-padding': 8
      } 
    },
    { 
      selector: 'edge', 
      style: { 
        'label': 'data(label)', 
        'curve-style': 'bezier', 
        'target-arrow-shape': 'triangle',
        'width': 2,
        'line-color': '#666',
        'target-arrow-color': '#666',
        'font-size': '10px'
      } 
    },
  ];

  const handleNodeTap = async (evt) => {
    const node = evt.target;
    const id = node.id();
    onSelectNode({ id, label: node.data('label'), props: node.data('props') });

    if (isMobile) {
      try {
        const res = await axios.get(`${apiBase}/graph/${encodeURIComponent(id)}/expand`);
      } catch (err) {
        console.error('Expand failed', err);
      }
    }
  };

  // Handle when node is being dragged - reposition connected nodes
  const handleDragFree = (evt) => {
    if (!cyRef.current) return;
    
    const draggedNode = evt.target;
    const draggedPos = draggedNode.position();
    
    // Get all connected nodes
    const connectedNodes = draggedNode.neighborhood('node');
    
    // Apply physics-like effect to connected nodes
    connectedNodes.forEach((node) => {
      const currentPos = node.position();
      
      // Calculate direction from connected node to dragged node
      const dx = draggedPos.x - currentPos.x;
      const dy = draggedPos.y - currentPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 0) {
        // Apply force based on distance (spring-like behavior)
        const force = Math.min(0.3, 50 / distance); // Adjust force strength
        const moveX = dx * force;
        const moveY = dy * force;
        
        // Update position
        node.position({
          x: currentPos.x + moveX,
          y: currentPos.y + moveY
        });
      }
    });
    
    // Optionally save position
    const nodeId = draggedNode.id();
    const position = draggedNode.position();
    savePositionToBackend(nodeId, position);
  };

  // Handle continuous dragging for real-time updates
  const handleDrag = (evt) => {
    if (!cyRef.current) return;
    
    const draggedNode = evt.target;
    const draggedPos = draggedNode.position();
    
    // Get directly connected nodes only
    const connectedNodes = draggedNode.neighborhood('node');
    
    // Apply lighter real-time effect during drag
    connectedNodes.forEach((node) => {
      const currentPos = node.position();
      
      const dx = draggedPos.x - currentPos.x;
      const dy = draggedPos.y - currentPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 0 && distance < 200) { // Only affect nearby nodes
        const force = Math.min(0.1, 20 / distance);
        const moveX = dx * force;
        const moveY = dy * force;
        
        node.position({
          x: currentPos.x + moveX,
          y: currentPos.y + moveY
        });
      }
    });
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
          cy.on('drag', 'node', handleDrag); // Real-time during drag
          cy.on('dragfree', 'node', handleDragFree); // When drag ends
        }}
        layout={layout}
        stylesheet={style}
        autoungrabify={false} // Critical: allows nodes to be grabbed
        autounselectify={false} // Allows selection
      />
    </div>
  );
}