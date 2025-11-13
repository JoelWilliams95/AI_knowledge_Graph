import os
import spacy
from typing import List, Dict, Any, Tuple
from transformers import pipeline

# Load spaCy model lazily
_nlp = None


def get_spacy():
    global _nlp
    if _nlp is None:
        try:
            _nlp = spacy.load("en_core_web_sm")
        except Exception:
            # Informative fallback: user must download the model
            raise RuntimeError("spaCy model 'en_core_web_sm' not found. Run: python -m spacy download en_core_web_sm")
    return _nlp


def extract_entities(text: str) -> List[Dict[str, Any]]:
    nlp = get_spacy()
    doc = nlp(text)
    entities = []
    for ent in doc.ents:
        entities.append({
            "id": f"ent-{ent.start_char}-{ent.end_char}",
            "name": ent.text,
            "type": ent.label_,
            "props": {"start": ent.start_char, "end": ent.end_char},
        })
    return entities


def extract_relations(text: str) -> List[Dict[str, Any]]:
    """A simple heuristic relation extractor: create relations between entities
    that co-occur in the same sentence. This is a placeholder you can replace
    with a Hugging Face relation extraction model for higher quality.
    """
    nlp = get_spacy()
    doc = nlp(text)
    relations = []
    for sent in doc.sents:
        ents = [ent for ent in sent.ents]
        # Pairwise relations
        for i in range(len(ents)):
            for j in range(i + 1, len(ents)):
                a = ents[i]
                b = ents[j]
                relations.append({
                    "source": f"ent-{a.start_char}-{a.end_char}",
                    "target": f"ent-{b.start_char}-{b.end_char}",
                    "label": "cooccurs_in_sentence",
                    "props": {"sentence": sent.text.strip()},
                })
    return relations


def advanced_relation_extraction(text: str, model_name: str = "Babelscape/rebel-large") -> List[Dict[str, Any]]:
    """Optional: use a transformers pipeline or custom model to extract relations.
    This function is a stub showing how you'd plug a Hugging Face model.
    """
    # Example: load a relation extraction pipeline if a suitable model is available
    # NOTE: Many relation-extraction models require custom preprocessing and outputs.
    try:
        rel_pipe = pipeline("text-classification", model=model_name)
    except Exception:
        raise RuntimeError("Failed to load transformer pipeline for relation extraction")
    # Use rel_pipe on sentences or candidate pairs and convert outputs to graph edges
    return []


def process_text_to_graph(text: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    entities = extract_entities(text)
    relations = extract_relations(text)
    # Deduplicate entities by name
    seen = {}
    nodes = []
    for e in entities:
        key = e["name"].strip().lower()
        if key in seen:
            # prefer existing id
            continue
        seen[key] = e
        nodes.append(e)
    # Filter relations to only include known entities
    valid_ids = {n["id"] for n in nodes}
    edges = [r for r in relations if r["source"] in valid_ids and r["target"] in valid_ids]
    return nodes, edges
