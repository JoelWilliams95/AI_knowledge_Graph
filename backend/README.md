# Backend (FastAPI) for Research Knowledge Graph

This backend provides endpoints to upload PDFs, extract text, run a simple NLP pipeline to extract entities and relations, and store/query them in Neo4j AuraDB.

## Setup and Run Instructions

### 1. Create and activate Python virtual environment

```powershell
# Create virtual environment
python -m venv .venv

# Activate it (Windows PowerShell)
.\.venv\Scripts\Activate.ps1
# OR if using Command Prompt
# .\.venv\Scripts\activate.bat
```

### 2. Install dependencies

```powershell
pip install -r requirements.txt
```

### 3. Download SpaCy language model

```powershell
python -m spacy download en_core_web_sm
```

### 4. Configure Neo4j connection (Important!)

```powershell
# Create .env file from the example
Copy-Item .env.example .env
```

Then edit the `.env` file with your Neo4j AuraDB credentials:
- `NEO4J_URI`: Your Neo4j AuraDB URI (e.g., neo4j+s://12345678.databases.neo4j.io)
- `NEO4J_USER`: Your Neo4j username (usually "neo4j")
- `NEO4J_PASSWORD`: Your Neo4j password

### 5. Run the FastAPI application

```powershell
uvicorn app.main:app --reload --port 8000
```

The backend will start at http://localhost:8000

Endpoints

- POST /upload-pdf - upload a PDF file
- POST /process-text - provide JSON {"text": "..."}
- GET /graph - get nodes and edges
- GET /graph/{center_id}/expand - expand a node

Notes

- Relation extraction is heuristic (co-occurrence in the same sentence). Replace with transformer model for better results.
