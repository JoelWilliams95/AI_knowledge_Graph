import os
import uuid
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from dotenv import load_dotenv
load_dotenv()

# ---------------------------------------------------------
# AUTH IMPORTS
# ---------------------------------------------------------
from .auth.router import router as auth_router
from .auth.database import Base, engine

# Create database tables at startup
Base.metadata.create_all(bind=engine)


# ---------------------------------------------------------
# NLP & NEO4J IMPORTS
# ---------------------------------------------------------
from .pdf_utils import extract_text_from_pdf
from .nlp import process_text_to_graph
from .neo4j_driver import (
    upsert_graph,
    get_graph,
    get_subgraph,
    search_papers,
    search_entities,
    get_graph_by_search
)

from .papers_manager import (
    get_preloaded_papers,
    add_paper_to_collection,
    process_papers_directory,
    initialize_demo_papers
)


# ---------------------------------------------------------
# CREATE FASTAPI APPLICATION
# ---------------------------------------------------------
app = FastAPI(title="AI Knowledge Graph Backend")


# ---------------------------------------------------------
# CORS CONFIG (VERY IMPORTANT FOR REACT)
# ---------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # frontend React
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------
# REGISTER AUTH ROUTES
# ---------------------------------------------------------
app.include_router(auth_router)


# ---------------------------------------------------------
# UPLOAD DIRECTORY (create if missing)
# ---------------------------------------------------------
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------
# STARTUP EVENT
# ---------------------------------------------------------
@app.on_event("startup")
async def startup_event():
    try:
        initialize_demo_papers()
        print("✨ Demo papers initialized")
    except Exception as e:
        print("⚠️ Error initializing papers:", e)


# ---------------------------------------------------------
# ROUTE: Upload PDF
# ---------------------------------------------------------
@app.post("/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are accepted")

    file_id = str(uuid.uuid4())
    dest = Path(UPLOAD_DIR) / f"{file_id}.pdf"

    with open(dest, "wb") as f:
        f.write(await file.read())

    text = extract_text_from_pdf(str(dest))
    return {"file_id": file_id, "text_snippet": text[:1000]}


# ---------------------------------------------------------
# ROUTE: Process text → NLP → Graph
# ---------------------------------------------------------
@app.post("/process-text")
async def process_text(payload: dict):

    text = payload.get("text")
    if not text:
        raise HTTPException(400, "'text' field is required")

    nodes, edges = process_text_to_graph(text)

    try:
        upsert_graph(nodes, edges)
    except Exception as e:
        raise HTTPException(500, str(e))

    return {"nodes": nodes, "edges": edges}


# ---------------------------------------------------------
# ROUTE: Get Graph
# ---------------------------------------------------------
@app.get("/graph")
async def read_graph(limit: int = 100):
    nodes, edges = get_graph(limit=limit)
    return {"nodes": nodes, "edges": edges}


# ---------------------------------------------------------
# ROUTE: Expand Node
# ---------------------------------------------------------
@app.get("/graph/{center_id}/expand")
async def expand_node(center_id: str, depth: int = 1):
    nodes, edges = get_subgraph(center_id, depth)
    return {"nodes": nodes, "edges": edges}


# ---------------------------------------------------------
# ROUTES: Papers
# ---------------------------------------------------------
@app.get("/papers")
async def list_papers():
    return {"papers": get_preloaded_papers()}


@app.get("/papers/search")
async def search_papers_endpoint(q: str, limit: int = 20):
    if not q.strip():
        return {"papers": []}
    return {"papers": search_papers(q, limit), "query": q}


@app.get("/entities/search")
async def search_entities_endpoint(q: str, limit: int = 50):
    if not q.strip():
        return {"entities": []}
    return {"entities": search_entities(q, limit), "query": q}


@app.get("/graph/search")
async def search_graph(q: str, limit: int = 100):
    if not q.strip():
        return get_graph(limit)
    nodes, edges = get_graph_by_search(q, limit)
    return {"nodes": nodes, "edges": edges}


@app.post("/papers/process-directory")
async def process_directory():
    try:
        return {"results": process_papers_directory()}
    except Exception as e:
        raise HTTPException(500, str(e))


# ---------------------------------------------------------
# SHUTDOWN EVENT
# ---------------------------------------------------------
@app.on_event("shutdown")
def shutdown_event():
    try:
        from .neo4j_driver import close_driver
        close_driver()
    except:
        pass
