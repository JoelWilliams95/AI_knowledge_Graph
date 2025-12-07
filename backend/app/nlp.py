# nlp.py  –  FIXED VERSION (copy-paste this entire file)

import os
import re
import spacy
from typing import List, Dict, Any, Tuple
from transformers import pipeline, AutoTokenizer, AutoModelForSeq2SeqLM

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
    text = re.sub(r"_TRIPLETPROFILES.*$", "", text)        # ← add this
    text = re.sub(r"^HAS_PART_TRIPLET.*", "HAS_PART", text) # ← add this
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
# 3. Final processing function (clean IDs, dedup, etc.)
# ------------------------------------------------------------------
def process_text_to_graph(text: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    # 1. Entities from spaCy
    spacy_ents = {}
    for ent in get_spacy()(text).ents:
        norm = ent.text.strip().lower()
        spacy_ents[norm] = {
            "id": norm.replace(" ", "_"),
            "name": ent.text.strip(),
            "type": "MISC" if ent.label_ == "MISC" else ent.label_,
            "props": {"start": ent.start_char, "end": ent.end_char}
        }

    # 2. Relations from REBEL
    raw_relations = extract_relations_with_rebel(text)

    # 3. Build final nodes & edges
    node_dict = {}
    edges = []

    for rel in raw_relations:
        src_norm = rel["source"].strip().lower()
        tgt_norm = rel["target"].strip().lower()

        src_id = src_norm.replace(" ", "_")
        tgt_id = tgt_norm.replace(" ", "_")

        # Node for source
        if src_id not in node_dict:
            node_dict[src_id] = spacy_ents.get(src_norm, {
                "id": src_id,
                "name": rel["source"].strip(),
                "type": "Entity",
                "props": {}
            })
        # Node for target
        if tgt_id not in node_dict:
            node_dict[tgt_id] = spacy_ents.get(tgt_norm, {
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
    return nodes, edges