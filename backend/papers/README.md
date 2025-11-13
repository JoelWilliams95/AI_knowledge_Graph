# Papers Directory

This directory is for storing research papers (PDF files) that will be automatically processed and added to the knowledge graph.

## Usage

1. **Add PDFs**: Place your research paper PDF files in this directory
2. **Process Papers**: The system will automatically process papers on startup, or you can manually trigger processing via the API
3. **Search**: Use the frontend search interface to find and explore papers

## API Endpoints for Processing

- `POST /papers/process-directory` - Process all PDFs in this directory
- `POST /papers/initialize` - Initialize system with demo data
- `GET /papers` - List all papers in the collection

## File Organization

You can organize papers in subdirectories if needed. The system will search recursively for PDF files.

Example structure:
```
papers/
├── machine-learning/
│   ├── paper1.pdf
│   └── paper2.pdf
├── knowledge-graphs/
│   ├── kg-paper1.pdf
│   └── kg-paper2.pdf
└── nlp/
    └── nlp-paper.pdf
```

The system will extract:
- Title (from filename or PDF content)
- Text content for NLP processing
- Entities (people, organizations, concepts)
- Relationships between entities