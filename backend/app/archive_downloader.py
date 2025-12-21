# archive_downloader.py - Download papers from Internet Archive

import os
import requests
from pathlib import Path
from typing import List, Dict, Any, Optional
import time
from urllib.parse import urlparse, quote
import json

PAPERS_DIR = os.getenv("PAPERS_DIR", "./papers")
ARCHIVE_CACHE_FILE = os.path.join(PAPERS_DIR, "archive_downloads.json")

def ensure_papers_directory():
    """Create papers directory if it doesn't exist"""
    Path(PAPERS_DIR).mkdir(parents=True, exist_ok=True)

def load_download_cache() -> Dict[str, Any]:
    """Load cache of previously downloaded papers"""
    ensure_papers_directory()
    if os.path.exists(ARCHIVE_CACHE_FILE):
        try:
            with open(ARCHIVE_CACHE_FILE, 'r') as f:
                return json.load(f)
        except Exception:
            pass
    return {"downloads": []}

def save_download_cache(cache: Dict[str, Any]):
    """Save download cache"""
    ensure_papers_directory()
    with open(ARCHIVE_CACHE_FILE, 'w') as f:
        json.dump(cache, f, indent=2)

def download_pdf_from_url(url: str, filename: str = None, 
                          target_dir: str = None) -> Optional[str]:
    """
    Download a PDF from a given URL
    
    Args:
        url: Direct URL to PDF file
        filename: Optional filename for saved PDF
        target_dir: Directory to save PDF (defaults to PAPERS_DIR)
    
    Returns:
        Path to downloaded file or None if failed
    """
    if target_dir is None:
        target_dir = PAPERS_DIR
    
    ensure_papers_directory()
    
    # Generate filename if not provided
    if filename is None:
        parsed = urlparse(url)
        filename = os.path.basename(parsed.path)
        if not filename.endswith('.pdf'):
            filename = f"paper_{int(time.time())}.pdf"
    
    filepath = os.path.join(target_dir, filename)
    
    try:
        print(f"Downloading from {url}...")
        
        # Use a proper user agent
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        response = requests.get(url, headers=headers, timeout=30, stream=True)
        response.raise_for_status()
        
        # Check if response is actually a PDF
        content_type = response.headers.get('content-type', '')
        if 'pdf' not in content_type.lower() and 'application/octet-stream' not in content_type.lower():
            print(f"Warning: Content-Type is {content_type}, might not be a PDF")
        
        # Save file
        with open(filepath, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        file_size = os.path.getsize(filepath)
        print(f"✓ Downloaded {filename} ({file_size / 1024:.1f} KB)")
        
        # Update cache
        cache = load_download_cache()
        cache["downloads"].append({
            "url": url,
            "filename": filename,
            "filepath": filepath,
            "download_date": time.time(),
            "size_bytes": file_size
        })
        save_download_cache(cache)
        
        return filepath
        
    except requests.exceptions.RequestException as e:
        print(f"✗ Failed to download {url}: {str(e)}")
        # Clean up partial download
        if os.path.exists(filepath):
            os.remove(filepath)
        return None

def download_from_archive_identifier(identifier: str, 
                                     format: str = "pdf") -> Optional[str]:
    """
    Download a file from Internet Archive using its identifier
    
    Args:
        identifier: Archive.org identifier (e.g., "arxiv-1706.03762")
        format: File format to download (default: "pdf")
    
    Returns:
        Path to downloaded file or None if failed
    """
    # Construct download URL
    # Format: https://archive.org/download/{identifier}/{identifier}.pdf
    base_url = f"https://archive.org/download/{identifier}/{identifier}.{format}"
    
    filename = f"{identifier}.{format}"
    return download_pdf_from_url(base_url, filename)

def search_archive(query: str, rows: int = 20) -> List[Dict[str, Any]]:
    """
    Search Internet Archive for papers
    
    Args:
        query: Search query
        rows: Number of results to return
    
    Returns:
        List of search results with metadata
    """
    search_url = "https://archive.org/advancedsearch.php"
    
    params = {
        "q": query,
        "fl[]": ["identifier", "title", "creator", "year", "description", "mediatype"],
        "rows": rows,
        "page": 1,
        "output": "json"
    }
    
    try:
        response = requests.get(search_url, params=params, timeout=15)
        response.raise_for_status()
        data = response.json()
        
        results = []
        for doc in data.get("response", {}).get("docs", []):
            results.append({
                "identifier": doc.get("identifier"),
                "title": doc.get("title", "Unknown Title"),
                "creator": doc.get("creator", ["Unknown"])[0] if isinstance(doc.get("creator"), list) else doc.get("creator", "Unknown"),
                "year": doc.get("year"),
                "description": doc.get("description", "")[:200] if doc.get("description") else "",
                "download_url": f"https://archive.org/download/{doc.get('identifier')}/{doc.get('identifier')}.pdf"
            })
        
        return results
        
    except Exception as e:
        print(f"Search failed: {str(e)}")
        return []

def batch_download_papers(identifiers: List[str], 
                         delay: float = 2.0) -> List[str]:
    """
    Download multiple papers with rate limiting
    
    Args:
        identifiers: List of Archive.org identifiers
        delay: Delay between downloads in seconds
    
    Returns:
        List of successfully downloaded file paths
    """
    downloaded = []
    
    for i, identifier in enumerate(identifiers):
        print(f"\n[{i+1}/{len(identifiers)}] Processing {identifier}")
        
        filepath = download_from_archive_identifier(identifier)
        if filepath:
            downloaded.append(filepath)
        
        # Rate limiting - be nice to archive.org
        if i < len(identifiers) - 1:
            time.sleep(delay)
    
    return downloaded

# ------------------------------------------------------------------
# Curated lists of interesting papers from Archive.org
# ------------------------------------------------------------------

SAMPLE_PAPERS = {
    "ai_ml": [
        "arxiv-1706.03762",  # Attention Is All You Need (Transformers)
        "arxiv-1512.03385",  # ResNet
        "arxiv-1409.0473",   # Neural Machine Translation (Seq2Seq)
    ],
    "knowledge_graphs": [
        "arxiv-1503.00759",  # Knowledge Graph Embedding
        "arxiv-1707.01476",  # Knowledge Graph Construction
    ],
    "nlp": [
        "arxiv-1810.04805",  # BERT
        "arxiv-1301.3781",   # Word2Vec
    ]
}

def download_sample_papers(category: str = "ai_ml", 
                          max_papers: int = 3) -> List[str]:
    """
    Download sample papers from a curated list
    
    Args:
        category: Category of papers (ai_ml, knowledge_graphs, nlp)
        max_papers: Maximum number of papers to download
    
    Returns:
        List of downloaded file paths
    """
    if category not in SAMPLE_PAPERS:
        print(f"Unknown category. Available: {list(SAMPLE_PAPERS.keys())}")
        return []
    
    identifiers = SAMPLE_PAPERS[category][:max_papers]
    print(f"Downloading {len(identifiers)} papers from '{category}' category...")
    
    return batch_download_papers(identifiers)

# ------------------------------------------------------------------
# CLI interface
# ------------------------------------------------------------------

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python archive_downloader.py search <query>")
        print("  python archive_downloader.py download <identifier>")
        print("  python archive_downloader.py batch <identifier1> <identifier2> ...")
        print("  python archive_downloader.py samples [category]")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "search":
        query = " ".join(sys.argv[2:])
        results = search_archive(query)
        print(f"\nFound {len(results)} results:\n")
        for i, r in enumerate(results, 1):
            print(f"{i}. {r['title']}")
            print(f"   ID: {r['identifier']}")
            print(f"   Author: {r['creator']}")
            print(f"   Year: {r['year']}")
            print(f"   URL: {r['download_url']}\n")
    
    elif command == "download":
        identifier = sys.argv[2]
        filepath = download_from_archive_identifier(identifier)
        if filepath:
            print(f"\nSuccess! Downloaded to: {filepath}")
    
    elif command == "batch":
        identifiers = sys.argv[2:]
        downloaded = batch_download_papers(identifiers)
        print(f"\nDownloaded {len(downloaded)}/{len(identifiers)} papers")
    
    elif command == "samples":
        category = sys.argv[2] if len(sys.argv) > 2 else "ai_ml"
        downloaded = download_sample_papers(category)
        print(f"\nDownloaded {len(downloaded)} sample papers")