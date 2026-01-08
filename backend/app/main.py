# main.py - Enhanced version with new features

import os
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Depends
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import uuid
from dotenv import load_dotenv
from pydantic import BaseModel
from typing import Optional, List
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

load_dotenv()

from .pdf_utils import extract_text_from_pdf
from .nlp_enhanced import process_text_to_graph, process_text_to_graph_enhanced
from .neo4j_driver import (upsert_graph, upsert_paper, upsert_graph_with_paper,
                          get_graph, get_subgraph, search_papers, search_entities,
                          get_papers_by_entity, get_graph_by_search)
from .papers_manager import (get_preloaded_papers, add_paper_to_collection,
                           process_papers_directory, initialize_demo_papers)
from .archive_downloader import (download_from_archive_identifier, 
                                search_archive, download_sample_papers,
                                download_pdf_from_url)
from .auth.router import router as auth_router
from .auth.jwt_handler import decode_access_token

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="Research KG Backend - Enhanced",
    description="Knowledge Graph extraction from research papers with LangChain & RefExtractor",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include authentication router
app.include_router(auth_router)

# Security
security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Dependency to verify JWT token"""
    token = credentials.credentials
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid token")
    return payload

# Pydantic models for request validation
class ProcessTextRequest(BaseModel):
    text: str
    extract_references: bool = True

class DownloadPaperRequest(BaseModel):
    identifier: Optional[str] = None
    url: Optional[str] = None
    title: Optional[str] = None
    authors: Optional[str] = None

class BatchDownloadRequest(BaseModel):
    identifiers: List[str]

@app.on_event("startup")
async def startup_event():
    """Initialize papers collection on startup"""
    try:
        initialize_demo_papers()
        print("✓ Papers collection initialized")
    except Exception as e:
        print(f"⚠ Warning: Could not initialize papers: {e}")

# ------------------------------------------------------------------
# Original Endpoints
# ------------------------------------------------------------------

@app.post("/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):
    """Upload a PDF file for processing"""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")
    
    file_id = str(uuid.uuid4())
    dest = Path(UPLOAD_DIR) / f"{file_id}.pdf"
    
    with open(dest, "wb") as f:
        content = await file.read()
        f.write(content)
    
    text = extract_text_from_pdf(str(dest))
    
    return JSONResponse({
        "file_id": file_id,
        "text_snippet": text[:1000],
        "text_length": len(text),
        "filepath": str(dest)
    })

@app.post("/process-text")
async def process_text(payload: ProcessTextRequest):
    """Process text and extract entities/relationships"""
    text = payload.text
    if not text:
        raise HTTPException(status_code=400, detail="'text' is required")
    
    # Use enhanced processing
    nodes, edges, metadata = process_text_to_graph_enhanced(
        text, 
        extract_refs=payload.extract_references
    )
    
    # Upsert to Neo4j
    try:
        upsert_graph(nodes, edges)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    return {
        "nodes": nodes,
        "edges": edges,
        "metadata": metadata
    }

@app.get("/graph")
async def read_graph(limit: int = 100):
    """Get the entire graph with a limit"""
    nodes, edges = get_graph(limit=limit)
    return {"nodes": nodes, "edges": edges}

@app.get("/graph/{center_id}/expand")
async def expand_node(center_id: str, depth: int = 1):
    """Expand graph from a center node"""
    nodes, edges = get_subgraph(center_id=center_id, depth=depth)
    return {"nodes": nodes, "edges": edges}

# ------------------------------------------------------------------
# Papers Management Endpoints
# ------------------------------------------------------------------

@app.get("/papers")
async def list_papers():
    """Get list of all papers in the collection"""
    papers = get_preloaded_papers()
    return {"papers": papers, "count": len(papers)}

@app.get("/papers/search")
async def search_papers_endpoint(q: str, limit: int = 20):
    """Search papers by keywords"""
    if not q.strip():
        return {"papers": []}
    papers = search_papers(q, limit=limit)
    return {"papers": papers, "query": q, "count": len(papers)}

@app.get("/papers/{paper_id}")
async def get_paper_details(paper_id: str):
    """Get detailed information about a specific paper"""
    papers = get_preloaded_papers()
    paper = next((p for p in papers if p["paper_id"] == paper_id), None)
    
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    # Get graph data for this paper
    nodes, edges = get_graph_by_search(paper_id, limit=200)
    
    return {
        "paper": paper,
        "graph": {"nodes": nodes, "edges": edges}
    }

@app.get("/papers/{paper_id}/graph")
async def get_paper_graph(paper_id: str):
    """Get graph data for a specific paper"""
    nodes, edges = get_graph_by_search(paper_id, limit=200)
    return {"nodes": nodes, "edges": edges, "paper_id": paper_id}

@app.post("/papers/initialize")
async def initialize_papers():
    """Initialize the system with demo papers"""
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
        return {"results": results, "count": len(results)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ------------------------------------------------------------------
# NEW: Internet Archive Integration
# ------------------------------------------------------------------

@app.get("/archive/search")
async def search_archive_endpoint(q: str, rows: int = 20):
    """
    Search Internet Archive for papers
    
    Args:
        q: Search query
        rows: Number of results (max 50)
    """
    if not q.strip():
        return {"results": [], "query": q}
    
    rows = min(rows, 50)  # Limit to 50
    results = search_archive(q, rows=rows)
    
    return {
        "results": results,
        "query": q,
        "count": len(results)
    }

@app.post("/archive/download")
async def download_from_archive(
    request: DownloadPaperRequest,
    background_tasks: BackgroundTasks
):
    """
    Download a paper from Internet Archive or direct URL
    
    Provide either:
    - identifier: Archive.org identifier (e.g., "arxiv-1706.03762")
    - url: Direct URL to PDF file
    """
    if not request.identifier and not request.url:
        raise HTTPException(
            status_code=400,
            detail="Either 'identifier' or 'url' must be provided"
        )
    
    try:
        # Download the file
        if request.identifier:
            filepath = download_from_archive_identifier(request.identifier)
        else:
            filepath = download_pdf_from_url(request.url)
        
        if not filepath:
            raise HTTPException(
                status_code=500,
                detail="Failed to download paper"
            )
        
        # Process and add to collection in background
        def process_paper():
            try:
                paper_id = add_paper_to_collection(
                    pdf_path=filepath,
                    title=request.title,
                    authors=request.authors
                )
                print(f"✓ Processed paper: {paper_id}")
            except Exception as e:
                print(f"✗ Error processing paper: {e}")
        
        background_tasks.add_task(process_paper)
        
        return {
            "message": "Paper downloaded successfully",
            "filepath": filepath,
            "status": "processing"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/archive/download-samples")
async def download_sample_papers_endpoint(
    category: str = "ai_ml",
    max_papers: int = 3,
    background_tasks: BackgroundTasks = None
):
    """
    Download sample papers from curated lists
    
    Categories:
    - ai_ml: AI/ML foundational papers
    - knowledge_graphs: Knowledge graph papers
    - nlp: NLP papers
    """
    try:
        filepaths = download_sample_papers(category, max_papers)
        
        # Process papers in background
        if background_tasks:
            def process_all():
                for filepath in filepaths:
                    try:
                        paper_id = add_paper_to_collection(pdf_path=filepath)
                        print(f"✓ Processed: {paper_id}")
                    except Exception as e:
                        print(f"✗ Error: {e}")
            
            background_tasks.add_task(process_all)
        
        return {
            "message": f"Downloaded {len(filepaths)} sample papers",
            "count": len(filepaths),
            "category": category,
            "status": "processing"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/archive/batch-download")
async def batch_download_papers(
    request: BatchDownloadRequest,
    background_tasks: BackgroundTasks
):
    """Download multiple papers by identifier"""
    if not request.identifiers:
        raise HTTPException(
            status_code=400,
            detail="No identifiers provided"
        )
    
    def download_and_process():
        results = []
        for identifier in request.identifiers:
            try:
                filepath = download_from_archive_identifier(identifier)
                if filepath:
                    paper_id = add_paper_to_collection(pdf_path=filepath)
                    results.append({
                        "identifier": identifier,
                        "status": "success",
                        "paper_id": paper_id
                    })
                else:
                    results.append({
                        "identifier": identifier,
                        "status": "failed"
                    })
            except Exception as e:
                results.append({
                    "identifier": identifier,
                    "status": "error",
                    "error": str(e)
                })
        print(f"Batch download complete: {len(results)} papers")
        return results
    
    background_tasks.add_task(download_and_process)
    
    return {
        "message": f"Batch download started for {len(request.identifiers)} papers",
        "status": "processing"
    }

# ------------------------------------------------------------------
# Entity & Relationship Search
# ------------------------------------------------------------------

@app.get("/entities/search")
async def search_entities_endpoint(q: str, limit: int = 50):
    """Search entities by name or type"""
    if not q.strip():
        return {"entities": []}
    entities = search_entities(q, limit=limit)
    return {"entities": entities, "query": q, "count": len(entities)}

@app.get("/entities/{entity_id}/papers")
async def get_entity_papers(entity_id: str):
    """Get all papers that mention a specific entity"""
    papers = get_papers_by_entity(entity_id)
    return {"entity_id": entity_id, "papers": papers, "count": len(papers)}

@app.get("/graph/search")
async def search_graph(q: str, limit: int = 100):
    """Get graph data filtered by search query"""
    if not q.strip():
        return get_graph(limit=limit)
    nodes, edges = get_graph_by_search(q, limit=limit)
    return {"nodes": nodes, "edges": edges, "query": q}

# ------------------------------------------------------------------
# Health Check
# ------------------------------------------------------------------

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": "2.0.0",
        "features": [
            "pdf_upload",
            "entity_extraction",
            "relation_extraction",
            "reference_extraction",
            "archive_integration",
            "langchain_chunking"
        ]
    }

@app.get("/stats")
async def get_stats():
    """Get system statistics"""
    papers = get_preloaded_papers()
    nodes, edges = get_graph(limit=10000)
    
    return {
        "total_papers": len(papers),
        "total_entities": len(nodes),
        "total_relationships": len(edges),
        "papers_directory": os.getenv("PAPERS_DIR", "./papers"),
        "upload_directory": UPLOAD_DIR
    }

@app.on_event("shutdown")
def shutdown_event():
    """Cleanup on shutdown"""
    try:
        from .neo4j_driver import close_driver
        close_driver()
        print("✓ Neo4j driver closed")
    except Exception:
        pass