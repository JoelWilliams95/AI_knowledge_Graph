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
    ...graph.nodes.map((n) => ({ data: { id: n.id, label: n.label, props: n.props } })),
    ...graph.edges.map((e) => ({ data: { id: e.id, source: e.source, target: e.target, label: e.label } })),
  ];

  const layout = { name: 'cose' };

  const style = [
    { selector: 'node', style: { 'label': 'data(label)', 'width': 40, 'height': 40, 'background-color': '#1976d2', 'color': '#fff', 'text-valign': 'center', 'text-halign': 'center' } },
    { selector: 'edge', style: { 'label': 'data(label)', 'curve-style': 'bezier', 'target-arrow-shape': 'triangle' } },
  ];

  const handleNodeTap = async (evt) => {
    const node = evt.target;
    const id = node.id();
    onSelectNode({ id, label: node.data('label'), props: node.data('props') });

    if (isMobile) {
      // On mobile, fetch expansion
      try {
        const res = await axios.get(`${apiBase}/graph/${encodeURIComponent(id)}/expand`);
        // merge with existing graph: simple replacement for demo
        // Ideally you'd merge into cytoscape graph
        // For now, call onSelectNode to show info
      } catch (err) {
        console.error('Expand failed', err);
      }
    }
  };

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <CytoscapeComponent
        elements={elements}
        style={{ width: '100%', height: '100%' }}
        cy={(cy) => {
          cyRef.current = cy;
          cy.on('tap', 'node', handleNodeTap);
        }}
        layout={layout}
        stylesheet={style}
      />
    </div>
  );
}
