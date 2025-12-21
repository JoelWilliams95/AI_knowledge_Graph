# papers_manager.py - Fixed version with better metadata extraction

import os
import json
import re  # MOVED TO TOP - This was the bug!
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime
import uuid

from .pdf_utils import extract_text_from_pdf
from .nlp_enhanced import process_text_to_graph_enhanced
from .neo4j_driver import upsert_paper, upsert_graph_with_paper

# Directory containing research papers
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
    """Get list of all papers in the collection"""
    index = load_papers_index()
    return index.get("papers", [])

def extract_title_from_text(text: str, filename: str = None) -> str:
    """
    Extract paper title from text with improved heuristics
    """
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    
    if not lines:
        return filename or "Untitled Paper"
    
    # Filter out common junk lines
    skip_patterns = [
        r'^\d+$',  # Just numbers (like "3" or "4")
        r'^[ivxlcdm]+$',  # Roman numerals
        r'arxiv:',
        r'^\s*abstract\s*$',
        r'^\s*introduction\s*$',
        r'^doi:',
        r'^http',
        r'^www\.',
        r'^\d{4}$',  # Just a year
        r'^[a-z]$',  # Single letter
        r'^preprint',
        r'^draft',
        r'^page \d+',
    ]
    
    # Look through first 20 lines for a good title
    for line in lines[:20]:
        # Skip short lines
        if len(line) < 10:
            continue
            
        # Skip lines matching skip patterns
        if any(re.search(pattern, line, re.IGNORECASE) for pattern in skip_patterns):
            continue
        
        # Skip lines that are all uppercase (likely headers)
        if line.isupper() and len(line) < 50:
            continue
        
        # Good title candidate: reasonable length, ends properly
        if 15 <= len(line) <= 300:
            # Clean up the title
            title = line.strip()
            # Remove trailing punctuation that shouldn't be there
            title = re.sub(r'[∗†‡§¶]+$', '', title)
            return title
    
    # Fallback: first non-trivial line
    for line in lines[:10]:
        if len(line) > 10:
            return line[:200]
    
    return filename or "Untitled Paper"

def extract_authors_from_text(text: str) -> str:
    """
    Extract authors from paper text with improved pattern matching
    """
    lines = text.split('\n')[:50]  # Check first 50 lines
    
    # Pattern 1: Look for lines after title that contain names
    title_found = False
    potential_author_lines = []
    
    for i, line in enumerate(lines):
        line = line.strip()
        if not line or len(line) < 5:
            continue
        
        # Skip title line (first substantial line)
        if not title_found and len(line) > 15:
            title_found = True
            continue
        
        # Stop at abstract
        if re.search(r'^\s*abstract\s*$', line, re.IGNORECASE):
            break
        
        # Look for author patterns after title
        if title_found and i < 20:
            # Check if line contains name-like patterns
            if re.search(r'[A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+', line):
                potential_author_lines.append(line)
    
    # Try to extract names from collected lines
    if potential_author_lines:
        author_text = ' '.join(potential_author_lines[:5])
        # Find name patterns: "Firstname Lastname" or "F. Lastname"
        name_pattern = r'\b([A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+)\b'
        authors = re.findall(name_pattern, author_text)
        if authors:
            # Deduplicate and limit to first 10
            unique_authors = []
            for author in authors:
                if author not in unique_authors and len(author) > 5:
                    unique_authors.append(author)
            if unique_authors:
                return ', '.join(unique_authors[:10])
    
    # Pattern 2: Look for email addresses (authors usually near emails)
    email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    for i, line in enumerate(lines[:30]):
        if re.search(email_pattern, line):
            # Check surrounding lines for names
            context = ' '.join(lines[max(0, i-3):i])
            names = re.findall(r'\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b', context)
            if names:
                return ', '.join(names[:5])
    
    return "Unknown Authors"

def extract_year_from_text(text: str, filename: str = None) -> str:
    """Extract publication year from text"""
    # Try filename first (e.g., "1706.03762v7.pdf" -> arXiv from 2017)
    if filename:
        # arXiv pattern: YYMM.NNNNN
        arxiv_match = re.search(r'(\d{2})(\d{2})\.\d+', filename)
        if arxiv_match:
            year_prefix = arxiv_match.group(1)
            # arXiv started in 1991, so 91+ = 19XX, otherwise 20XX
            if int(year_prefix) >= 91:
                return f"19{year_prefix}"
            else:
                return f"20{year_prefix}"
    
    # Look for year in first 3000 chars (usually in metadata area)
    header_text = text[:3000]
    
    # Look for explicit year patterns
    year_patterns = [
        r'\b(20[0-2]\d)\b',  # 2000-2029
        r'\b(19[789]\d)\b',  # 1970-1999
        r'\((\d{4})\)',      # (2023)
        r'©\s*(\d{4})',      # © 2023
    ]
    
    for pattern in year_patterns:
        matches = re.findall(pattern, header_text)
        if matches:
            # Return the most recent reasonable year
            years = [int(y) for y in matches if 1990 <= int(y) <= 2025]
            if years:
                return str(max(years))
    
    return None

def add_paper_to_collection(
    pdf_path: str, 
    title: str = None, 
    authors: str = None,
    year: str = None, 
    journal: str = None
) -> str:
    """
    Add a paper to the collection and process it into the knowledge graph
    
    Returns: paper_id
    """
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF file not found: {pdf_path}")
    
    # Generate unique paper ID
    paper_id = str(uuid.uuid4())
    filename = os.path.basename(pdf_path)
    
    print(f"📄 Processing: {filename}")
    
    # Extract text from PDF
    text = extract_text_from_pdf(pdf_path)
    if not text.strip():
        raise ValueError("Could not extract text from PDF")
    
    print(f"✓ Extracted {len(text)} characters")
    
    # Auto-extract metadata if not provided
    if not title:
        title = extract_title_from_text(text, filename)
        print(f"✓ Detected title: {title[:80]}...")
    
    if not authors:
        authors = extract_authors_from_text(text)
        print(f"✓ Detected authors: {authors[:80]}...")
    
    if not year:
        year = extract_year_from_text(text, filename)
        if year:
            print(f"✓ Detected year: {year}")
    
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
    
    print(f"🔍 Extracting entities and relationships...")
    
    # Process text with enhanced NLP (quality-focused)
    nodes, edges, metadata = process_text_to_graph_enhanced(
        text, 
        extract_refs=True,
        max_entities=80,      # Focused on most important entities
        max_relations=100      # Quality over quantity
    )
    
    print(f"✓ Found {len(nodes)} entities and {len(edges)} relationships")
    print(f"✓ Citations: {metadata['citations']['total_papers_cited']} papers cited")
    
    # Store in Neo4j
    print(f"💾 Storing in Neo4j...")
    upsert_paper(paper_id, filename, title, text, paper_metadata)
    upsert_graph_with_paper(paper_id, nodes, edges)
    
    # Update papers index
    index = load_papers_index()
    index["papers"].append(paper_metadata)
    save_papers_index(index)
    
    print(f"✅ Paper processed successfully: {paper_id}")
    
    return paper_id

def process_papers_directory(papers_dir: str = None):
    """Process all PDF files in a directory"""
    if papers_dir is None:
        papers_dir = PAPERS_DIR
    
    if not os.path.exists(papers_dir):
        print(f"❌ Papers directory not found: {papers_dir}")
        return []
    
    processed_papers = []
    pdf_files = list(Path(papers_dir).glob("*.pdf"))
    
    print(f"\n📚 Found {len(pdf_files)} PDF files to process\n")
    
    for i, pdf_file in enumerate(pdf_files, 1):
        print(f"\n[{i}/{len(pdf_files)}] Processing: {pdf_file.name}")
        print("-" * 60)
        
        try:
            paper_id = add_paper_to_collection(pdf_path=str(pdf_file))
            processed_papers.append({
                "paper_id": paper_id,
                "filename": pdf_file.name,
                "status": "success"
            })
        except Exception as e:
            print(f"❌ Error: {str(e)}")
            processed_papers.append({
                "filename": pdf_file.name,
                "status": "error",
                "error": str(e)
            })
    
    print(f"\n" + "="*60)
    print(f"✅ Processed {len([p for p in processed_papers if p['status'] == 'success'])} papers successfully")
    print(f"❌ Failed {len([p for p in processed_papers if p['status'] == 'error'])} papers")
    
    return processed_papers

def initialize_demo_papers():
    """Initialize system - just ensure directories exist, no demo data"""
    ensure_papers_directory()
    papers = get_preloaded_papers()
    
    if not papers:
        print("\n📋 Papers collection is empty")
        print(f"📁 Papers directory: {PAPERS_DIR}")
        print("\nTo add papers:")
        print("  1. Use /archive/search endpoint to find papers")
        print("  2. Use /archive/download endpoint to download them")
        print("  3. Papers will be automatically processed and added to the graph")
    else:
        print(f"📚 Found {len(papers)} papers in collection")

if __name__ == "__main__":
    # Just initialize directories, no demo papers
    initialize_demo_papers()