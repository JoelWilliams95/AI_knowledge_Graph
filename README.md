# Research Knowledge Graph

A knowledge graph system for research papers that allows you to search through a collection of academic papers, explore entities and relationships, and visualize knowledge as an interactive graph.

## 🔍 **Key Features**

- **Search Papers**: Find papers by keywords in titles, authors, or content
- **Entity Search**: Discover entities (people, organizations, concepts) across papers
- **Interactive Visualization**: Explore knowledge graphs with Cytoscape.js
- **Pre-loaded Collection**: System comes with papers ready to search
- **Add New Papers**: Optionally upload additional PDFs to expand the collection
- **Responsive Design**: Works on both desktop and mobile devices

## System Architecture

- **Backend**: Python FastAPI for PDF upload, text extraction, NLP processing
- **NLP**: SpaCy + Hugging Face for entity recognition and relationship extraction
- **Database**: Neo4j AuraDB (cloud) for storing the knowledge graph
- **Frontend**: React.js with Cytoscape.js for interactive graph visualization

## Quick Start Guide

This application requires two services:

1. The FastAPI backend server
2. The React frontend development server

### Step 1: Setup and Run the FastAPI Backend

```powershell
# Navigate to the backend folder
cd backend

# Create and activate a Python virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Download the SpaCy model
python -m spacy download en_core_web_sm

# Setup Neo4j connection (IMPORTANT)
# Copy .env.example to .env and add your Neo4j AuraDB credentials
Copy-Item .env.example .env
# Edit .env with your Neo4j AuraDB credentials

# Run the FastAPI backend
uvicorn app.main:app --reload
```

The backend will start on http://localhost:8000

### Step 2: Setup and Run the React Frontend

```powershell
# In a new terminal, navigate to the frontend folder
cd frontend

# Install dependencies
npm install

# Start the React development server
npm start
```

The frontend will start on http://localhost:3000

## Workflow

### Primary Use: Search Pre-loaded Papers
1. Open the frontend in your browser: http://localhost:3000
2. **Search papers** by keywords (title, authors, content)
3. **View individual paper graphs** or **search results graphs**
4. **Explore entities** and their relationships across papers
5. **Browse the complete collection** of research papers

### Optional: Add New Papers
1. Click "Add New Paper" to upload additional PDFs
2. The system processes new papers automatically
3. New papers become searchable immediately

### Admin: Bulk Load Papers
1. Place PDF files in `backend/papers/` directory
2. Use the "Process Directory" API endpoint
3. All PDFs are automatically processed and added to the collection

## Troubleshooting

- **Network Error**: If the frontend shows a network error, make sure the backend is running.
- **Missing Modules**: Run `pip install -r requirements.txt` in the backend folder.
- **Neo4j Connection**: Ensure your Neo4j AuraDB credentials are correctly set in the backend/.env file.