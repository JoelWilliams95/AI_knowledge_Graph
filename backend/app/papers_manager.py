import os
import json
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime
import uuid

from .pdf_utils import extract_text_from_pdf
from .nlp import process_text_to_graph
from .neo4j_driver import upsert_paper, upsert_graph_with_paper

# Directory containing pre-loaded research papers
PAPERS_DIR = os.getenv("PAPERS_DIR", "./papers")
PAPERS_INDEX_FILE = os.path.join(PAPERS_DIR, "papers_index.json")

def ensure_papers_directory():
    """Create papers directory and index if they don't exist"""
    Path(PAPERS_DIR).mkdir(parents=True, exist_ok=True)
    if not os.path.exists(PAPERS_INDEX_FILE):
        with open(PAPERS_INDEX_FILE, 'w') as f:
            json.dump({"papers": []}, f, indent=2)

def load_papers_index() -> Dict[str, Any]:
    """Load the papers index from JSON file"""
    ensure_papers_directory()
    try:
        with open(PAPERS_INDEX_FILE, 'r') as f:
            return json.load(f)
    except Exception:
        return {"papers": []}

def save_papers_index(index: Dict[str, Any]):
    """Save the papers index to JSON file"""
    ensure_papers_directory()
    with open(PAPERS_INDEX_FILE, 'w') as f:
        json.dump(index, f, indent=2)

def get_preloaded_papers() -> List[Dict[str, Any]]:
    """Get list of all pre-loaded papers"""
    index = load_papers_index()
    return index.get("papers", [])

def add_paper_to_collection(pdf_path: str, title: str = None, authors: str = None, 
                           year: str = None, journal: str = None) -> str:
    """Add a paper to the collection and process it"""
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF file not found: {pdf_path}")
    
    # Generate unique paper ID
    paper_id = str(uuid.uuid4())
    filename = os.path.basename(pdf_path)
    
    # Extract text from PDF
    text = extract_text_from_pdf(pdf_path)
    if not text.strip():
        raise ValueError("Could not extract text from PDF")
    
    # If no title provided, use filename or extract from first lines
    if not title:
        title = filename.replace('.pdf', '').replace('_', ' ').replace('-', ' ').title()
        # Try to get title from first non-empty lines
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        if lines:
            potential_title = lines[0]
            if len(potential_title) < 200 and not potential_title.lower().startswith('abstract'):
                title = potential_title
    
    # Create paper metadata
    paper_metadata = {
        "paper_id": paper_id,
        "filename": filename,
        "title": title,
        "authors": authors,
        "year": year,
        "journal": journal,
        "upload_date": datetime.now().isoformat(),
        "text_length": len(text),
        "pdf_path": pdf_path
    }
    
    # Process text with NLP
    nodes, edges = process_text_to_graph(text)
    
    # Store in Neo4j
    upsert_paper(paper_id, filename, title, text, paper_metadata)
    upsert_graph_with_paper(paper_id, nodes, edges)
    
    # Update papers index
    index = load_papers_index()
    index["papers"].append(paper_metadata)
    save_papers_index(index)
    
    return paper_id

def process_papers_directory(papers_dir: str = None):
    """Process all PDF files in a directory and add them to the collection"""
    if papers_dir is None:
        papers_dir = PAPERS_DIR
    
    if not os.path.exists(papers_dir):
        print(f"Papers directory not found: {papers_dir}")
        return []
    
    processed_papers = []
    pdf_files = list(Path(papers_dir).glob("*.pdf"))
    
    print(f"Found {len(pdf_files)} PDF files to process...")
    
    for pdf_file in pdf_files:
        try:
            print(f"Processing: {pdf_file.name}")
            paper_id = add_paper_to_collection(str(pdf_file))
            processed_papers.append({
                "paper_id": paper_id,
                "filename": pdf_file.name,
                "status": "success"
            })
        except Exception as e:
            print(f"Error processing {pdf_file.name}: {str(e)}")
            processed_papers.append({
                "filename": pdf_file.name,
                "status": "error",
                "error": str(e)
            })
    
    return processed_papers

def initialize_demo_papers():
    """Initialize system with some demo papers if none exist"""
    papers = get_preloaded_papers()
    if not papers:
        print("No papers found in collection. You can:")
        print(f"1. Add PDF files to {PAPERS_DIR} directory")
        print("2. Run process_papers_directory() to load them")
        print("3. Use the upload feature to add papers through the web interface")
        
        # Create a sample paper entry for demonstration
        sample_paper = {
            "paper_id": "demo-1",
            "filename": "sample_paper.txt", 
            "title": "Sample Research Paper on Knowledge Graphs",
            "authors": "Demo Authors",
            "year": "2024",
            "journal": "Demo Journal",
            "upload_date": datetime.now().isoformat(),
            "text_length": 1000,
            "is_demo": True
        }
        
        index = {"papers": [sample_paper]}
        save_papers_index(index)
        
        # Add sample data to Neo4j for demonstration
        sample_text = """
        Knowledge graphs represent structured information about entities and their relationships. 
        Machine learning algorithms can extract meaningful patterns from research papers. 
        Natural language processing enables automatic entity recognition in scientific literature.
        Graph databases like Neo4j provide efficient storage for connected data structures.
        """
        
        nodes, edges = process_text_to_graph(sample_text)
        upsert_paper("demo-1", "sample_paper.txt", "Sample Research Paper on Knowledge Graphs", 
                    sample_text, sample_paper)
        upsert_graph_with_paper("demo-1", nodes, edges)
        
        print("Created demo paper for testing")

if __name__ == "__main__":
    # Example usage
    initialize_demo_papers()
    # process_papers_directory()