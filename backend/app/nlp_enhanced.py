# nlp_enhanced.py - Enhanced version with LangChain and reference extraction

import os
import re
import spacy
from typing import List, Dict, Any, Tuple
from transformers import pipeline, AutoTokenizer, AutoModelForSeq2SeqLM
from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
try:
    from langchain.schema import Document
except ImportError:
    from langchain_core.documents import Document
#import requests
#from bs4 import BeautifulSoup

# ------------------------------------------------------------------
# 1. Load spaCy (small model is enough)
# ------------------------------------------------------------------
_nlp = None
def get_spacy():
    global _nlp
    if _nlp is None:
        _nlp = spacy.load("en_core_web_sm")
    return _nlp

# ------------------------------------------------------------------
# 2. REBEL model + safe triplet parser
# ------------------------------------------------------------------
_rebel = None
_tokenizer = None

def get_rebel():
    global _rebel, _tokenizer
    if _rebel is None:
        model_name = "Babelscape/rebel-large"
        _tokenizer = AutoTokenizer.from_pretrained(model_name)
        _rebel = AutoModelForSeq2SeqLM.from_pretrained(model_name)
        _rebel.eval()
    return _rebel, _tokenizer

def clean_relation(text: str) -> str:
    text = re.sub(r"_TRIPLETPROFILES.*$", "", text)
    text = re.sub(r"^HAS_PART_TRIPLET.*", "HAS_PART", text)
    text = re.sub(r"[<>()\[\]{}|&*]", "", text.strip())
    text = text.upper().replace(" ", "_")
    return text or "RELATED_TO"

def extract_triplets_safe(text: str) -> List[Dict[str, str]]:
    triplets = []
    relation = subject = object_ = ""
    current = "x"
    tokens = text.replace("<s>", "").replace("<pad>", "").replace("</s>", "").split()

    for token in tokens:
        if token == "<triplet>":
            current = "t"
            if relation:
                triplets.append({"head": subject.strip(), "type": relation.strip(), "tail": object_.strip()})
                relation = ""
            subject = ""
        elif token == "<subj>":
            current = "s"
            if relation:
                triplets.append({"head": subject.strip(), "type": relation.strip(), "tail": object_.strip()})
            object_ = ""
        elif token == "<obj>":
            current = "o"
            relation = ""
        else:
            if current == "t":
                subject += " " + token
            elif current == "s":
                object_ += " " + token
            elif current == "o":
                relation += " " + token

    if subject and relation and object_:
        triplets.append({"head": subject.strip(), "type": relation.strip(), "tail": object_.strip()})
    return triplets

def extract_relations_with_rebel(text: str) -> List[Dict[str, Any]]:
    model, tokenizer = get_rebel()
    nlp = get_spacy()
    doc = nlp(text)
    relations = []

    for sent in doc.sents:
        sent_text = sent.text.strip()
        if len(sent_text) < 10:
            continue

        inputs = tokenizer(sent_text, return_tensors="pt", truncation=True, max_length=512)
        generated = model.generate(
            inputs["input_ids"],
            max_length=512,
            num_beams=3,
            early_stopping=True,
        )
        decoded = tokenizer.decode(generated[0], skip_special_tokens=False)
        triplets = extract_triplets_safe(decoded)

        for t in triplets:
            rel_type = clean_relation(t["type"])
            relations.append({
                "source": t["head"],
                "target": t["tail"],
                "label": rel_type,
                "props": {"sentence": sent_text[:200] + "..." if len(sent_text) > 200 else sent_text}
            })
    return relations

# ------------------------------------------------------------------
# 3. Reference Extraction (Citations, DOIs, URLs, arXiv IDs)
# ------------------------------------------------------------------
def extract_references(text: str) -> Dict[str, List[str]]:
    """Extract various types of references from paper text"""
    references = {
        "dois": [],
        "arxiv_ids": [],
        "urls": [],
        "citations": [],
        "authors": set(),
        "years": []
    }
    
    # DOI pattern: 10.xxxx/xxxxx
    doi_pattern = r'\b(10\.\d{4,}(?:\.\d+)*\/(?:(?!["&\'<>])\S)+)\b'
    references["dois"] = list(set(re.findall(doi_pattern, text, re.IGNORECASE)))
    
    # arXiv ID pattern: arXiv:YYMM.NNNNN or arXiv:arch-ive/YYMMNNN
    arxiv_pattern = r'arXiv:\s*(\d{4}\.\d{4,5}|[a-z\-]+\/\d{7})'
    references["arxiv_ids"] = list(set(re.findall(arxiv_pattern, text, re.IGNORECASE)))
    
    # URL pattern (http/https)
    url_pattern = r'https?://[^\s<>"{}|\\^`\[\]]+'
    references["urls"] = list(set(re.findall(url_pattern, text)))
    
    # Year pattern (1900-2099)
    year_pattern = r'\b(19\d{2}|20\d{2})\b'
    references["years"] = sorted(list(set(re.findall(year_pattern, text))))
    
    # Extract author names from citations (simple pattern)
    # Matches patterns like "Smith et al. (2020)" or "Jones and Brown (2021)"
    citation_pattern = r'([A-Z][a-z]+(?:\s+et\s+al\.?|\s+and\s+[A-Z][a-z]+)?)\s*\((\d{4})\)'
    citations = re.findall(citation_pattern, text)
    references["citations"] = [f"{author} ({year})" for author, year in citations]
    
    # Extract potential author names from author section
    author_section = extract_author_section(text)
    if author_section:
        # Pattern for names: Firstname Lastname or F. Lastname
        name_pattern = r'([A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+)'
        authors = re.findall(name_pattern, author_section)
        references["authors"] = set(authors[:20])  # Limit to first 20
    
    return {k: list(v) if isinstance(v, set) else v for k, v in references.items()}

def extract_author_section(text: str) -> str:
    """Try to extract the author section from paper text"""
    lines = text.split('\n')
    author_text = ""
    
    # Look for common patterns
    for i, line in enumerate(lines[:50]):  # Check first 50 lines
        if any(keyword in line.lower() for keyword in ['author', 'affiliation', 'university', 'institute']):
            # Get context around this line
            start = max(0, i-2)
            end = min(len(lines), i+10)
            author_text = '\n'.join(lines[start:end])
            break
    
    return author_text

# ------------------------------------------------------------------
# 4. LangChain Text Chunking for Better Processing
# ------------------------------------------------------------------
def chunk_text_with_langchain(text: str, chunk_size: int = 1000, 
                               chunk_overlap: int = 200) -> List[Document]:
    """Split text into chunks using LangChain's RecursiveCharacterTextSplitter"""
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        separators=["\n\n", "\n", ". ", " ", ""]
    )
    
    chunks = text_splitter.create_documents([text])
    return chunks

# ------------------------------------------------------------------
# 5. Enhanced Processing with Chunking
# ------------------------------------------------------------------
def process_text_to_graph_enhanced(text: str, 
                                   extract_refs: bool = True) -> Tuple[List[Dict[str, Any]], 
                                                                        List[Dict[str, Any]], 
                                                                        Dict[str, Any]]:
    """
    Enhanced processing with:
    - Chunking for large texts
    - Reference extraction
    - Better entity deduplication
    """
    # Extract references first
    references = extract_references(text) if extract_refs else {}
    
    # Chunk text for better processing
    chunks = chunk_text_with_langchain(text, chunk_size=1000, chunk_overlap=200)
    
    # Process each chunk
    all_entities = {}
    all_relations = []
    
    nlp = get_spacy()
    
    for i, chunk in enumerate(chunks[:10]):  # Process first 10 chunks to save time
        chunk_text = chunk.page_content
        
        # 1. Extract entities from spaCy
        doc = nlp(chunk_text)
        for ent in doc.ents:
            norm = ent.text.strip().lower()
            ent_id = norm.replace(" ", "_")
            
            if ent_id not in all_entities:
                all_entities[ent_id] = {
                    "id": ent_id,
                    "name": ent.text.strip(),
                    "type": "MISC" if ent.label_ == "MISC" else ent.label_,
                    "props": {
                        "frequency": 1,
                        "first_seen_chunk": i
                    }
                }
            else:
                all_entities[ent_id]["props"]["frequency"] += 1
        
        # 2. Extract relations from chunk
        chunk_relations = extract_relations_with_rebel(chunk_text)
        all_relations.extend(chunk_relations)
    
    # 3. Build final nodes & edges
    node_dict = {}
    edges = []
    
    # Add reference entities (DOIs, arXiv papers as nodes)
    for doi in references.get("dois", [])[:10]:  # Limit to first 10
        doi_id = f"doi_{doi.replace('/', '_').replace('.', '_')}"
        node_dict[doi_id] = {
            "id": doi_id,
            "name": doi,
            "type": "DOI",
            "props": {"doi": doi}
        }
    
    for arxiv in references.get("arxiv_ids", [])[:10]:
        arxiv_id = f"arxiv_{arxiv.replace('.', '_').replace('/', '_')}"
        node_dict[arxiv_id] = {
            "id": arxiv_id,
            "name": arxiv,
            "type": "ARXIV",
            "props": {"arxiv_id": arxiv}
        }
    
    # Process relations
    for rel in all_relations:
        src_norm = rel["source"].strip().lower()
        tgt_norm = rel["target"].strip().lower()

        src_id = src_norm.replace(" ", "_")
        tgt_id = tgt_norm.replace(" ", "_")

        # Node for source
        if src_id not in node_dict:
            node_dict[src_id] = all_entities.get(src_id, {
                "id": src_id,
                "name": rel["source"].strip(),
                "type": "Entity",
                "props": {}
            })
        
        # Node for target
        if tgt_id not in node_dict:
            node_dict[tgt_id] = all_entities.get(tgt_id, {
                "id": tgt_id,
                "name": rel["target"].strip(),
                "type": "Entity",
                "props": {}
            })

        edges.append({
            "source": src_id,
            "target": tgt_id,
            "label": rel["label"],
            "props": rel["props"]
        })
    
    nodes = list(node_dict.values())
    
    # Add metadata
    metadata = {
        "references": references,
        "num_chunks_processed": min(len(chunks), 10),
        "total_chunks": len(chunks),
        "unique_entities": len(nodes),
        "total_relations": len(edges)
    }
    
    return nodes, edges, metadata

# ------------------------------------------------------------------
# 6. Backward compatible function
# ------------------------------------------------------------------
def process_text_to_graph(text: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Original function signature for backward compatibility"""
    nodes, edges, _ = process_text_to_graph_enhanced(text, extract_refs=True)
    return nodes, edges