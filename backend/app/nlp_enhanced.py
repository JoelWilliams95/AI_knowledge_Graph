# nlp_enhanced.py - Quality-focused version for concise, meaningful graphs

import os
import re
import spacy
from typing import List, Dict, Any, Tuple, Set
from transformers import pipeline, AutoTokenizer, AutoModelForSeq2SeqLM
from langchain_text_splitters import RecursiveCharacterTextSplitter
try:
    from langchain.schema import Document
except ImportError:
    from langchain_core.documents import Document

# ------------------------------------------------------------------
# 1. Load spaCy with better NER
# ------------------------------------------------------------------
_nlp = None
def get_spacy():
    global _nlp
    if _nlp is None:
        _nlp = spacy.load("en_core_web_sm")
    return _nlp

# ------------------------------------------------------------------
# 2. REBEL model for relation extraction
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
    """Clean and normalize relation names"""
    text = re.sub(r"_TRIPLETPROFILES.*$", "", text)
    text = re.sub(r"^HAS_PART_TRIPLET.*", "HAS_PART", text)
    text = re.sub(r"[<>()\[\]{}|&*]", "", text.strip())
    text = text.upper().replace(" ", "_")
    return text or "RELATED_TO"

def extract_triplets_safe(text: str) -> List[Dict[str, str]]:
    """Safely parse REBEL output into triplets"""
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

# ------------------------------------------------------------------
# 3. Quality Filters for Entities
# ------------------------------------------------------------------
def is_meaningful_entity(text: str, entity_type: str) -> bool:
    """Filter out low-quality entities"""
    text = text.strip()
    
    # Too short or too long
    if len(text) < 3 or len(text) > 100:
        return False
    
    # Skip common words, numbers only, single letters
    if text.lower() in {'the', 'this', 'that', 'these', 'those', 'and', 'or', 'but', 'a', 'an'}:
        return False
    
    if text.isdigit() or len(text) == 1:
        return False
    
    # Skip URLs, emails
    if 'http' in text.lower() or '@' in text:
        return False
    
    # Skip dates like "2024", but keep ranges or specific formats
    if entity_type == 'DATE' and re.match(r'^\d{4}$', text):
        return False
    
    return True

def normalize_entity_name(text: str) -> str:
    """Normalize entity names for better deduplication"""
    # Remove common suffixes
    text = re.sub(r'\s+(et al\.?|Inc\.?|Ltd\.?|Corp\.?)$', '', text)
    # Remove extra whitespace
    text = ' '.join(text.split())
    return text.strip()

# ------------------------------------------------------------------
# 4. Enhanced Citation Extraction
# ------------------------------------------------------------------
def extract_citations_detailed(text: str) -> Dict[str, Any]:
    """Extract citations with context and metadata"""
    citations = {
        "papers": [],      # Referenced papers
        "authors": set(),  # Author names
        "years": set(),    # Publication years
        "dois": [],        # DOIs
        "arxiv_ids": [],   # arXiv identifiers
    }
    
    # DOI pattern
    doi_pattern = r'\b(10\.\d{4,}(?:\.\d+)*\/(?:(?!["&\'<>])\S)+)\b'
    citations["dois"] = list(set(re.findall(doi_pattern, text, re.IGNORECASE)))
    
    # arXiv pattern
    arxiv_pattern = r'arXiv:\s*(\d{4}\.\d{4,5})'
    citations["arxiv_ids"] = list(set(re.findall(arxiv_pattern, text, re.IGNORECASE)))
    
    # Citation patterns: "Author et al. (2020)" or "Smith and Jones (2021)"
    citation_pattern = r'([A-Z][a-z]+(?:\s+et\s+al\.?|\s+(?:and|&)\s+[A-Z][a-z]+)?)\s*[\(\[]\s*(\d{4})\s*[\)\]]'
    matches = re.findall(citation_pattern, text)
    
    for author, year in matches:
        citations["authors"].add(author.strip())
        citations["years"].add(year)
        citations["papers"].append({
            "citation": f"{author} ({year})",
            "author": author.strip(),
            "year": year
        })
    
    # Convert sets to sorted lists
    citations["authors"] = sorted(list(citations["authors"]))
    citations["years"] = sorted(list(citations["years"]))
    
    return citations

# ------------------------------------------------------------------
# 5. Chunking with Context Preservation
# ------------------------------------------------------------------
def chunk_text_smartly(text: str, chunk_size: int = 2000, 
                       chunk_overlap: int = 400) -> List[Document]:
    """Split text preserving context for better relation extraction"""
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        separators=["\n\n", "\n", ". ", " ", ""]
    )
    
    return text_splitter.create_documents([text])

# ------------------------------------------------------------------
# 6. Quality-Focused Relation Extraction
# ------------------------------------------------------------------
def extract_relations_quality(text: str, max_relations: int = 50) -> List[Dict[str, Any]]:
    """Extract high-quality relations using REBEL"""
    model, tokenizer = get_rebel()
    nlp = get_spacy()
    doc = nlp(text)
    
    relations = []
    seen_triplets = set()
    
    for sent in doc.sents:
        sent_text = sent.text.strip()
        
        # Skip very short or very long sentences
        if len(sent_text) < 20 or len(sent_text) > 500:
            continue
        
        # Skip sentences without proper nouns (likely unimportant)
        if not any(token.pos_ == 'PROPN' for token in sent):
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
            head = normalize_entity_name(t["head"])
            tail = normalize_entity_name(t["tail"])
            rel_type = clean_relation(t["type"])
            
            # Quality filters
            if not is_meaningful_entity(head, "Entity") or not is_meaningful_entity(tail, "Entity"):
                continue
            
            # Avoid duplicates
            triplet_sig = f"{head.lower()}|{rel_type}|{tail.lower()}"
            if triplet_sig in seen_triplets:
                continue
            seen_triplets.add(triplet_sig)
            
            relations.append({
                "source": head,
                "target": tail,
                "label": rel_type,
                "props": {
                    "sentence": sent_text[:150] + "..." if len(sent_text) > 150 else sent_text
                }
            })
            
            if len(relations) >= max_relations:
                break
        
        if len(relations) >= max_relations:
            break
    
    return relations

# ------------------------------------------------------------------
# 7. Main Enhanced Processing
# ------------------------------------------------------------------
def process_text_to_graph_enhanced(
    text: str, 
    extract_refs: bool = True,
    max_entities: int = 100,
    max_relations: int = 100
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], Dict[str, Any]]:
    """
    Process text into a concise, high-quality knowledge graph
    
    Focus on:
    - Important entities (people, organizations, concepts)
    - Meaningful relationships
    - Citation networks
    """
    
    # Extract citations first
    citations = extract_citations_detailed(text) if extract_refs else {}
    
    # Smart chunking
    chunks = chunk_text_smartly(text, chunk_size=2000, chunk_overlap=400)
    
    # Track entities across chunks
    entity_scores = {}  # id -> {name, type, frequency, importance}
    all_relations = []
    
    nlp = get_spacy()
    
    # Process first 8 chunks (enough for most papers)
    for i, chunk in enumerate(chunks[:8]):
        chunk_text = chunk.page_content
        
        # Extract entities with spaCy
        doc = nlp(chunk_text)
        
        for ent in doc.ents:
            # Filter entity types - focus on important ones
            if ent.label_ not in {'PERSON', 'ORG', 'GPE', 'PRODUCT', 'WORK_OF_ART', 'LAW', 'EVENT'}:
                continue
            
            ent_text = normalize_entity_name(ent.text)
            
            if not is_meaningful_entity(ent_text, ent.label_):
                continue
            
            ent_id = ent_text.lower().replace(" ", "_")
            
            if ent_id not in entity_scores:
                entity_scores[ent_id] = {
                    "id": ent_id,
                    "name": ent_text,
                    "type": ent.label_,
                    "frequency": 0,
                    "first_chunk": i,
                    "importance": 0
                }
            
            entity_scores[ent_id]["frequency"] += 1
            # Entities in early chunks are more important (title, abstract)
            entity_scores[ent_id]["importance"] += (10 - i) if i < 10 else 1
        
        # Extract relations from this chunk
        chunk_relations = extract_relations_quality(chunk_text, max_relations=25)
        all_relations.extend(chunk_relations)
    
    # Select top entities by importance
    sorted_entities = sorted(
        entity_scores.values(), 
        key=lambda x: x["importance"] * x["frequency"], 
        reverse=True
    )
    top_entities = sorted_entities[:max_entities]
    top_entity_ids = {e["id"] for e in top_entities}
    
    # Build nodes
    node_dict = {}
    
    # Add top entities
    for entity in top_entities:
        node_dict[entity["id"]] = {
            "id": entity["id"],
            "name": entity["name"],
            "type": entity["type"],
            "props": {
                "frequency": entity["frequency"],
                "importance": entity["importance"]
            }
        }
    
    # Add citation nodes (papers referenced)
    for i, paper in enumerate(citations.get("papers", [])[:20]):  # Top 20 citations
        cite_id = f"cite_{paper['citation'].replace(' ', '_').replace('(', '').replace(')', '')}"
        node_dict[cite_id] = {
            "id": cite_id,
            "name": paper["citation"],
            "type": "CITED_PAPER",
            "props": {
                "author": paper["author"],
                "year": paper["year"]
            }
        }
    
    # Add DOI nodes
    for doi in citations.get("dois", [])[:10]:
        doi_id = f"doi_{doi.replace('/', '_').replace('.', '_')}"
        node_dict[doi_id] = {
            "id": doi_id,
            "name": f"DOI: {doi}",
            "type": "DOI",
            "props": {"doi": doi}
        }
    
    # Build edges - only keep relations between existing nodes
    edges = []
    seen_edges = set()
    
    for rel in all_relations:
        src_id = rel["source"].lower().replace(" ", "_")
        tgt_id = rel["target"].lower().replace(" ", "_")
        
        # Only keep relations where both entities are in our top entities
        if src_id not in top_entity_ids or tgt_id not in top_entity_ids:
            continue
        
        edge_sig = f"{src_id}|{rel['label']}|{tgt_id}"
        if edge_sig in seen_edges:
            continue
        seen_edges.add(edge_sig)
        
        edges.append({
            "source": src_id,
            "target": tgt_id,
            "label": rel["label"],
            "props": rel["props"]
        })
        
        if len(edges) >= max_relations:
            break
    
    # Create citation edges (this paper cites other papers)
    for cite_id in [n["id"] for n in node_dict.values() if n["type"] == "CITED_PAPER"]:
        edges.append({
            "source": "this_paper",  # Special node representing current paper
            "target": cite_id,
            "label": "CITES",
            "props": {}
        })
    
    nodes = list(node_dict.values())
    
    # Metadata
    metadata = {
        "citations": {
            "total_papers_cited": len(citations.get("papers", [])),
            "unique_authors": len(citations.get("authors", [])),
            "year_range": f"{min(citations.get('years', ['N/A']))}-{max(citations.get('years', ['N/A']))}" if citations.get('years') else "N/A",
            "dois": len(citations.get("dois", [])),
            "arxiv_ids": len(citations.get("arxiv_ids", []))
        },
        "graph_stats": {
            "total_entities_found": len(entity_scores),
            "entities_kept": len(nodes),
            "relationships_kept": len(edges),
            "chunks_processed": min(len(chunks), 8)
        }
    }
    
    return nodes, edges, metadata

# ------------------------------------------------------------------
# 8. Backward compatibility
# ------------------------------------------------------------------
def process_text_to_graph(text: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Original function signature"""
    nodes, edges, _ = process_text_to_graph_enhanced(text, extract_refs=True)
    return nodes, edges