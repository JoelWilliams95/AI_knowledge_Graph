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
            nid = n.get("id") or n.get("name")
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
            rel = e.get("label", "RELATED_TO")
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
        # Create or merge nodes
        for n in nodes:
            nid = n.get("id") or n.get("name")
            label = n.get("type") or "Entity"
            props = n.get("props", {})
            props["name"] = n.get("name")
            cypher = f"MERGE (a:{label} {{id: $id}}) SET a += $props RETURN a"
            session.run(cypher, id=nid, props=props)

        # Create edges
        for e in edges:
            src = e["source"]
            tgt = e["target"]
            rel = e.get("label", "RELATED_TO")
            props = e.get("props", {})
            cypher = (
                "MATCH (a {id: $src}), (b {id: $tgt}) "
                f"MERGE (a)-[r:{rel}]->(b) SET r += $props RETURN r"
            )
            session.run(cypher, src=src, tgt=tgt, props=props)


def get_graph(limit: int = 100):
    driver = get_driver()
    with driver.session() as session:
        q = (
            "MATCH (n)-[r]-(m) "
            "RETURN n,r,m LIMIT $limit"
        )
        res = session.run(q, limit=limit)
        nodes = {}
        edges = []
        for record in res:
            n = record["n"]
            m = record["m"]
            r = record["r"]
            for node in (n, m):
                nid = node.get("id")
                if nid not in nodes:
                    nodes[nid] = {
                        "id": nid,
                        "label": node.get("name") or nid,
                        "type": list(node.labels)[0] if list(node.labels) else "Entity",
                        "props": dict(node.items()),
                    }
            edges.append({
                "id": str(r.id),
                "source": n.get("id"),
                "target": m.get("id"),
                "label": type(r).__name__ if hasattr(r, "type") else r.type if hasattr(r, "type") else "RELATED_TO",
+                "props": dict(r.items()),
            })
        return list(nodes.values()), edges


def get_subgraph(center_id: str, depth: int = 1):
    driver = get_driver()
    with driver.session() as session:
        q = (
            "MATCH (c {id: $center_id})-[*1..$depth]-(n) "
            "RETURN DISTINCT c, n LIMIT 100"
        )
        res = session.run(q, center_id=center_id, depth=depth)
        nodes = {}
        edges = []
        # Simple expansion: return neighbors and relationships
        # For more precise control, adapt the query
        for record in res:
            c = record["c"]
            n = record["n"]
            for node in (c, n):
                nid = node.get("id")
                if nid not in nodes:
                    nodes[nid] = {
                        "id": nid,
                        "label": node.get("name") or nid,
                        "type": list(node.labels)[0] if list(node.labels) else "Entity",
                        "props": dict(node.items()),
                    }
        # Fetch relationships separately
        q2 = (
            "MATCH (a)-[r]-(b) WHERE a.id IN $ids AND b.id IN $ids RETURN a,r,b LIMIT 200"
        )
        res2 = session.run(q2, ids=list(nodes.keys()))
        for record in res2:
            a = record["a"]
            b = record["b"]
            r = record["r"]
            edges.append({
                "id": str(r.id),
                "source": a.get("id"),
                "target": b.get("id"),
                "label": r.type if hasattr(r, "type") else "RELATED_TO",
                "props": dict(r.items()),
            })
        return list(nodes.values()), edges


def search_papers(query: str, limit: int = 20) -> List[Dict[str, Any]]:
    """Search papers by keywords in title, text, or metadata"""
    driver = get_driver()
    with driver.session() as session:
        # Search in paper titles and text content
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
        WHERE e:Entity OR e:PERSON OR e:ORG OR e:GPE OR e:WORK_OF_ART
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


def get_graph_by_search(query: str, limit: int = 100):
    """Get graph data filtered by search query"""
    driver = get_driver()
    with driver.session() as session:
        # First find papers matching the query
        papers_cypher = """
        MATCH (p:Paper)
        WHERE toLower(p.title) CONTAINS toLower($query)
           OR toLower(p.text) CONTAINS toLower($query)
           OR toLower(p.authors) CONTAINS toLower($query)
        RETURN collect(p.paper_id) as paper_ids
        """
        
        papers_result = session.run(papers_cypher, query=query)
        paper_ids = papers_result.single()["paper_ids"] if papers_result.peek() else []
        
        if not paper_ids:
            return [], []
        
        # Get entities and relationships from matching papers
        graph_cypher = """
        MATCH (n)-[r]-(m)
        WHERE n.paper_id IN $paper_ids OR m.paper_id IN $paper_ids
        RETURN n, r, m
        LIMIT $limit
        """
        
        graph_result = session.run(graph_cypher, paper_ids=paper_ids, limit=limit)
        nodes = {}
        edges = []
        
        for record in graph_result:
            n = record["n"]
            m = record["m"]  
            r = record["r"]
            
            for node in (n, m):
                if "Paper" in list(node.labels):
                    continue  # Skip paper nodes in visualization
                    
                nid = node.get("id")
                if nid and nid not in nodes:
                    nodes[nid] = {
                        "id": nid,
                        "label": node.get("name") or nid,
                        "type": list(node.labels)[0] if list(node.labels) else "Entity",
                        "props": dict(node.items()),
                    }
            
            # Only add edges between entities (not involving papers)
            if ("Paper" not in list(n.labels) and "Paper" not in list(m.labels) and 
                n.get("id") and m.get("id")):
                edges.append({
                    "id": str(r.id),
                    "source": n.get("id"),
                    "target": m.get("id"),
                    "label": r.type if hasattr(r, "type") else "RELATED_TO",
                    "props": dict(r.items()),
                })
        
        return list(nodes.values()), edges
