import os
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import uuid
from dotenv import load_dotenv

load_dotenv()

from .pdf_utils import extract_text_from_pdf
from .nlp import process_text_to_graph
from .neo4j_driver import (upsert_graph, upsert_paper, upsert_graph_with_paper, 
                          get_graph, get_subgraph, search_papers, search_entities, 
                          get_papers_by_entity, get_graph_by_search)
from .papers_manager import (get_preloaded_papers, add_paper_to_collection, 
                           process_papers_directory, initialize_demo_papers)

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Research KG Backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Initialize papers collection on startup"""
    try:
        initialize_demo_papers()
        print("Papers collection initialized")
    except Exception as e:
        print(f"Warning: Could not initialize papers: {e}")


@app.post("/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")
    file_id = str(uuid.uuid4())
    dest = Path(UPLOAD_DIR) / f"{file_id}.pdf"
    with open(dest, "wb") as f:
        content = await file.read()
        f.write(content)
    text = extract_text_from_pdf(str(dest))
    return JSONResponse({"file_id": file_id, "text_snippet": text[:1000]})


@app.post("/process-text")
async def process_text(payload: dict):
    text = payload.get("text")
    if not text:
        raise HTTPException(status_code=400, detail="'text' is required in payload")
    nodes, edges = process_text_to_graph(text)
    # Upsert to Neo4j
    try:
        upsert_graph(nodes, edges)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"nodes": nodes, "edges": edges}


@app.get("/graph")
async def read_graph(limit: int = 100):
    nodes, edges = get_graph(limit=limit)
    return {"nodes": nodes, "edges": edges}


@app.get("/graph/{center_id}/expand")
async def expand_node(center_id: str, depth: int = 1):
    nodes, edges = get_subgraph(center_id=center_id, depth=depth)
    return {"nodes": nodes, "edges": edges}


# NEW SEARCH AND PAPERS ENDPOINTS

@app.get("/papers")
async def list_papers():
    """Get list of all papers in the collection"""
    papers = get_preloaded_papers()
    return {"papers": papers}


@app.get("/papers/search")
async def search_papers_endpoint(q: str, limit: int = 20):
    """Search papers by keywords"""
    if not q.strip():
        return {"papers": []}
    papers = search_papers(q, limit=limit)
    return {"papers": papers, "query": q}


@app.get("/entities/search") 
async def search_entities_endpoint(q: str, limit: int = 50):
    """Search entities by name or type"""
    if not q.strip():
        return {"entities": []}
    entities = search_entities(q, limit=limit)
    return {"entities": entities, "query": q}


@app.get("/graph/search")
async def search_graph(q: str, limit: int = 100):
    """Get graph data filtered by search query"""
    if not q.strip():
        return get_graph(limit=limit)
    nodes, edges = get_graph_by_search(q, limit=limit)
    return {"nodes": nodes, "edges": edges, "query": q}


@app.get("/papers/{paper_id}/graph")
async def get_paper_graph(paper_id: str):
    """Get graph data for a specific paper"""
    # This would get entities and relationships from a specific paper
    nodes, edges = get_graph_by_search(paper_id, limit=200)  # Using paper_id as search term
    return {"nodes": nodes, "edges": edges, "paper_id": paper_id}


@app.post("/papers/initialize")
async def initialize_papers():
    """Initialize the system with demo papers or process papers directory"""
    try:
        initialize_demo_papers()
        papers = get_preloaded_papers()
        return {"message": "Papers initialized successfully", "count": len(papers)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/papers/process-directory")
async def process_directory():
    """Process all PDFs in the papers directory"""
    try:
        results = process_papers_directory()
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.on_event("shutdown")
def shutdown_event():
    try:
        from .neo4j_driver import close_driver
        close_driver()
    except Exception:
        pass
