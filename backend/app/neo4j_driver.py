# neo4j_driver.py - Fixed version with better graph retrieval

import os
from neo4j import GraphDatabase
from typing import List, Dict, Any

NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USER = os.getenv("NEO4J_USER")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

_driver = None

def get_driver():
    global _driver
    if _driver is None:
        if not (NEO4J_URI and NEO4J_USER and NEO4J_PASSWORD):
            raise RuntimeError("Neo4j credentials not set in environment variables")
        _driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    return _driver

def close_driver():
    global _driver
    if _driver:
        _driver.close()
        _driver = None

def upsert_paper(paper_id: str, filename: str, title: str, text: str, metadata: Dict[str, Any] = None):
    """Store a research paper in Neo4j"""
    driver = get_driver()
    with driver.session() as session:
        props = {
            "paper_id": paper_id,
            "id": paper_id,
            "name": title,
            "filename": filename,
            "title": title,
            "text": text,
            "upload_date": metadata.get("upload_date") if metadata else None,
            **(metadata or {})
        }
        cypher = "MERGE (p:Paper {paper_id: $paper_id}) SET p += $props RETURN p"
        session.run(cypher, paper_id=paper_id, props=props)

def upsert_graph_with_paper(paper_id: str, nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]):
    """Upsert nodes and edges linked to a specific paper"""
    driver = get_driver()
    with driver.session() as session:
        # Create or merge nodes and link them to the paper
        for n in nodes:
            nid = n.get("id") or n.get("name").lower().replace(" ", "_")
            label = n.get("type") or "Entity"
            props = n.get("props", {})
            props["name"] = n.get("name")
            props["paper_id"] = paper_id
            
            cypher = f"MERGE (a:{label} {{id: $id}}) SET a += $props RETURN a"
            session.run(cypher, id=nid, props=props)
           
            # Link entity to paper
            link_cypher = (
                "MATCH (p:Paper {paper_id: $paper_id}), (e {id: $entity_id}) "
                "MERGE (p)-[:CONTAINS]->(e)"
            )
            session.run(link_cypher, paper_id=paper_id, entity_id=nid)
        
        # Create edges
        for e in edges:
            src = e["source"]
            tgt = e["target"]
            rel = e.get("label", "RELATED_TO").upper().replace(" ", "_")
            props = e.get("props", {})
            props["paper_id"] = paper_id
            
            cypher = (
                "MATCH (a {id: $src}), (b {id: $tgt}) "
                f"MERGE (a)-[r:{rel}]->(b) SET r += $props RETURN r"
            )
            session.run(cypher, src=src, tgt=tgt, props=props)

def upsert_graph(nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]):
    """Legacy function - upsert nodes and edges into Neo4j without paper linking"""
    driver = get_driver()
    with driver.session() as session:
        for n in nodes:
            nid = n.get("id") or n.get("name").lower().replace(" ", "_")
            label = n.get("type") or "Entity"
            props = n.get("props", {})
            props["name"] = n.get("name")
            
            cypher = f"MERGE (a:{label} {{id: $id}}) SET a += $props RETURN a"
            session.run(cypher, id=nid, props=props)
        
        for e in edges:
            src = e["source"]
            tgt = e["target"]
            rel = e.get("label", "RELATED_TO").upper().replace(" ", "_")
            props = e.get("props", {})
            
            cypher = (
                "MATCH (a {id: $src}), (b {id: $tgt}) "
                f"MERGE (a)-[r:{rel}]->(b) SET r += $props RETURN r"
            )
            session.run(cypher, src=src, tgt=tgt, props=props)

def get_graph(limit: int = 1000):
    """
    Get the full graph - EXACTLY like Neo4j Aura's '*' button
    Includes Paper nodes and their CONTAINS relationships!
    """
    driver = get_driver()
    with driver.session() as session:
        
        # Get ALL relationships (including from Paper nodes)
        # This is EXACTLY what MATCH p=()-[]->() RETURN p does
        relationships_query = """
        MATCH (n)-[r]->(m)
        RETURN n, r, m
        LIMIT $limit
        """
        
        print(f"🔍 Fetching ALL relationships from Neo4j (including Paper nodes)...")
        relationships_result = session.run(relationships_query, limit=limit)
        
        nodes = {}
        edges = []
        edge_ids = set()
        
        for record in relationships_result:
            n = record["n"]
            m = record["m"]
            r = record["r"]
            
            # Add source node
            nid = n.get("id") or n.get("paper_id")
            if nid and nid not in nodes:
                nodes[nid] = {
                    "id": nid,
                    "label": n.get("name") or n.get("title") or nid,
                    "type": list(n.labels)[0] if list(n.labels) else "Entity",
                    "props": dict(n.items()),
                }
            
            # Add target node
            mid = m.get("id") or m.get("paper_id")
            if mid and mid not in nodes:
                nodes[mid] = {
                    "id": mid,
                    "label": m.get("name") or m.get("title") or mid,
                    "type": list(m.labels)[0] if list(m.labels) else "Entity",
                    "props": dict(m.items()),
                }
            
            # Add relationship
            if nid and mid:
                edge_id = str(r.id)
                if edge_id not in edge_ids:
                    edge_ids.add(edge_id)
                    edges.append({
                        "id": edge_id,
                        "source": nid,
                        "target": mid,
                        "label": r.type,
                        "props": dict(r.items()),
                    })
        
        print(f"📊 Found {len(nodes)} nodes and {len(edges)} relationships")
        
        # Add any disconnected nodes if there's room
        remaining = limit - len(nodes)
        if remaining > 0:
            disconnected_query = """
            MATCH (n)
            WHERE NOT (n)-[]-()
            RETURN n
            LIMIT $remaining
            """
            print(f"🔍 Fetching up to {remaining} disconnected nodes...")
            disconnected_result = session.run(disconnected_query, remaining=remaining)
            
            for record in disconnected_result:
                node = record["n"]
                nid = node.get("id") or node.get("paper_id")
                if nid and nid not in nodes:
                    nodes[nid] = {
                        "id": nid,
                        "label": node.get("name") or node.get("title") or nid,
                        "type": list(node.labels)[0] if list(node.labels) else "Entity",
                        "props": dict(node.items()),
                    }
            
            print(f"📊 Added {len(nodes) - len(edges)} disconnected nodes")
        
        print(f"✅ TOTAL: {len(nodes)} nodes and {len(edges)} edges")
        
        return list(nodes.values()), edges    
def get_subgraph(center_id: str, depth: int = 1):
    """Get subgraph around a center node"""
    driver = get_driver()
    depth = max(1, min(depth, 2))

    with driver.session() as session:
        query = f"""
        MATCH (c {{id: $center_id}})
        MATCH (c)-[r*1..{depth}]-(n)
        WHERE NOT 'Paper' IN labels(c)
          AND NOT 'Paper' IN labels(n)
        WITH DISTINCT c, n, r
        UNWIND r AS rel
        RETURN DISTINCT c, n, rel
        """

        result = session.run(query, center_id=center_id)
        nodes = {}
        edges = []

        for record in result:
            for node in [record["c"], record["n"]]:
                nid = node.get("id")
                if nid and nid not in nodes:
                    nodes[nid] = {
                        "id": nid,
                        "label": node.get("name") or nid,
                        "type": list(node.labels)[0] if node.labels else "Entity",
                        "props": dict(node.items()),
                    }

            rel = record["rel"]
            if rel:
                sid = rel.start_node.get("id")
                tid = rel.end_node.get("id")

                if sid in nodes and tid in nodes:
                    edge_id = str(rel.id)
                    if not any(e["id"] == edge_id for e in edges):
                        edges.append({
                            "id": edge_id,
                            "source": sid,
                            "target": tid,
                            "label": rel.type,
                            "props": dict(rel.items()),
                        })

        return list(nodes.values()), edges

def search_papers(query: str, limit: int = 20) -> List[Dict[str, Any]]:
    """Search papers by keywords"""
    driver = get_driver()
    with driver.session() as session:
        cypher = """
        MATCH (p:Paper)
        WHERE toLower(p.title) CONTAINS toLower($query)
           OR toLower(p.text) CONTAINS toLower($query)
           OR toLower(p.authors) CONTAINS toLower($query)
           OR toLower(p.journal) CONTAINS toLower($query)
        RETURN p
        ORDER BY
          CASE WHEN toLower(p.title) CONTAINS toLower($query) THEN 1 ELSE 2 END,
          p.upload_date DESC
        LIMIT $limit
        """
        result = session.run(cypher, query=query, limit=limit)
        papers = []
        
        for record in result:
            paper = record["p"]
            papers.append({
                "paper_id": paper.get("paper_id"),
                "title": paper.get("title"),
                "authors": paper.get("authors"),
                "year": paper.get("year"),
                "journal": paper.get("journal"),
                "filename": paper.get("filename"),
                "upload_date": paper.get("upload_date"),
                "text_snippet": (paper.get("text", "")[:300] + "...") if len(paper.get("text", "")) > 300 else paper.get("text", "")
            })
        
        return papers

def search_entities(query: str, limit: int = 50) -> List[Dict[str, Any]]:
    """Search entities by name or type"""
    driver = get_driver()
    with driver.session() as session:
        cypher = """
        MATCH (e)
        WHERE (e:Entity OR e:PERSON OR e:ORG OR e:GPE OR e:WORK_OF_ART OR e:CONCEPT OR e:CITED_PAPER)
        AND (toLower(e.name) CONTAINS toLower($query) OR toLower(labels(e)[0]) CONTAINS toLower($query))
        RETURN DISTINCT e, labels(e) as entity_labels
        LIMIT $limit
        """
        result = session.run(cypher, query=query, limit=limit)
        entities = []
        
        for record in result:
            entity = record["e"]
            labels = record["entity_labels"]
            entities.append({
                "id": entity.get("id"),
                "name": entity.get("name"),
                "type": labels[0] if labels else "Entity",
                "paper_id": entity.get("paper_id"),
                "props": dict(entity.items())
            })
        
        return entities

def get_papers_by_entity(entity_id: str) -> List[Dict[str, Any]]:
    """Get all papers that contain a specific entity"""
    driver = get_driver()
    with driver.session() as session:
        cypher = """
        MATCH (p:Paper)-[:CONTAINS]->(e {id: $entity_id})
        RETURN p
        ORDER BY p.upload_date DESC
        """
        result = session.run(cypher, entity_id=entity_id)
        papers = []
        
        for record in result:
            paper = record["p"]
            papers.append({
                "paper_id": paper.get("paper_id"),
                "title": paper.get("title"),
                "authors": paper.get("authors"),
                "year": paper.get("year"),
                "filename": paper.get("filename")
            })
        
        return papers

def get_graph_by_search(query: str, limit: int = 500):
    """
    Get graph data filtered by search query OR by paper_id
    This mimics the Neo4j Aura '*' button by showing ALL entities, not just connected ones
    """
    driver = get_driver()
    with driver.session() as session:
        # Check if query is a paper_id (UUID format)
        if len(query) == 36 and '-' in query:
            print(f"🔍 Searching for paper_id: {query}")
            
            # STEP 1: Get ALL nodes for this paper (even disconnected ones)
            nodes_cypher = """
            MATCH (n)
            WHERE n.paper_id = $query
            AND NOT 'Paper' IN labels(n)
            RETURN n
            LIMIT $limit
            """
            nodes_result = session.run(nodes_cypher, query=query, limit=limit)
            
            # STEP 2: Get ALL relationships between these nodes
            edges_cypher = """
            MATCH (n)-[r]-(m)
            WHERE n.paper_id = $query AND m.paper_id = $query
            AND NOT 'Paper' IN labels(n) AND NOT 'Paper' IN labels(m)
            RETURN DISTINCT n, r, m
            LIMIT $limit
            """
            edges_result = session.run(edges_cypher, query=query, limit=limit)
            
        else:
            print(f"🔍 Text search: {query}")
            
            # Find papers first
            papers_cypher = """
            MATCH (p:Paper)
            WHERE toLower(p.title) CONTAINS toLower($query)
               OR toLower(p.text) CONTAINS toLower($query)
               OR toLower(p.authors) CONTAINS toLower($query)
            RETURN collect(p.paper_id) as paper_ids
            """
            papers_result = session.run(papers_cypher, query=query)
            paper_ids_record = papers_result.single()
            paper_ids = paper_ids_record["paper_ids"] if paper_ids_record else []
            
            print(f"📄 Found {len(paper_ids)} matching papers")
            
            if not paper_ids:
                return [], []
            
            # STEP 1: Get ALL nodes for these papers
            nodes_cypher = """
            MATCH (n)
            WHERE n.paper_id IN $paper_ids
            AND NOT 'Paper' IN labels(n)
            RETURN n
            LIMIT $limit
            """
            nodes_result = session.run(nodes_cypher, paper_ids=paper_ids, limit=limit)
            
            # STEP 2: Get ALL relationships
            edges_cypher = """
            MATCH (n)-[r]-(m)
            WHERE n.paper_id IN $paper_ids AND m.paper_id IN $paper_ids
            AND NOT 'Paper' IN labels(n) AND NOT 'Paper' IN labels(m)
            RETURN DISTINCT n, r, m
            LIMIT $limit
            """
            edges_result = session.run(edges_cypher, paper_ids=paper_ids, limit=limit)
        
        # Process nodes from STEP 1
        nodes = {}
        for record in nodes_result:
            node = record["n"]
            nid = node.get("id")
            if nid and nid not in nodes:
                nodes[nid] = {
                    "id": nid,
                    "label": node.get("name") or nid,
                    "type": list(node.labels)[0] if list(node.labels) else "Entity",
                    "props": dict(node.items()),
                }
        
        # Process edges from STEP 2
        edges = []
        edge_ids = set()
        
        for record in edges_result:
            n = record["n"]
            m = record["m"]
            r = record["r"]
            
            # Make sure nodes are in our nodes dict
            for node in (n, m):
                nid = node.get("id")
                if nid and nid not in nodes:
                    nodes[nid] = {
                        "id": nid,
                        "label": node.get("name") or nid,
                        "type": list(node.labels)[0] if list(node.labels) else "Entity",
                        "props": dict(node.items()),
                    }
            
            # Add edge only once (avoid bidirectional duplicates)
            if n.get("id") and m.get("id"):
                edge_id = str(r.id)
                
                # Only add if we haven't seen this edge yet
                if edge_id not in edge_ids:
                    edge_ids.add(edge_id)
                    edges.append({
                        "id": edge_id,
                        "source": n.get("id"),
                        "target": m.get("id"),
                        "label": r.type,
                        "props": dict(r.items()),
                    })
        
        print(f"📊 Retrieved {len(nodes)} nodes and {len(edges)} edges for query: {query[:50]}")
        
        return list(nodes.values()), edges