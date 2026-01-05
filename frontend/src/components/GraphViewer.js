import React, { useEffect, useRef, useState } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import cytoscape from 'cytoscape';
import axios from 'axios';

export default function GraphViewer({ graph, onSelectNode, apiBase }) {
  const cyRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);
  const lastPosRef = useRef(null);

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
cy.on('grab', 'node', handleGrab);        // when grab starts
cy.on('drag', 'node', handleDrag);        // during drag
cy.on('free', 'node', handleDragFree);    // when released (use 'free' instead of 'dragfree') // or 'free' if you prefer // When drag ends
        }}
        layout={layout}
        stylesheet={style}
        autoungrabify={false} // Critical: allows nodes to be grabbed
        autounselectify={false} // Allows selection
      />
    </div>
  );
}