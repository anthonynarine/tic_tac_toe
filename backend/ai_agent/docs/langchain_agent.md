# 🧩 Module: langchain_agent.py

## 📘 Purpose
This module builds and manages the **LangChain Retrieval-QA pipeline** used by the AI assistant.  
It loads the project’s source files, splits them into chunks, embeds them, and stores them in a FAISS vector index for retrieval.

---

## ⚙️ Core Responsibilities
1. **Scan the project** directories and collect `.py`, `.jsx`, `.tsx`, `.md`, etc.
2. **Split text** into 1500-character chunks with 200 overlap.
3. **Generate embeddings** using OpenAI models.
4. **Store vectors** in FAISS for semantic retrieval.
5. **Create a RetrievalQA chain** that answers questions from context.

---

## 🧠 Key Concepts (Teaching Notes)
- **LangChain**: framework for chaining language model logic.
- **FAISS**: vector similarity search library for embedding retrieval.
- **Embeddings**: numerical representations of text meaning.
- **RetrievalQA**: chain that combines retrieval (FAISS) + generation (OpenAI).

---

## 🔍 Functions

### `load_project_documents()`
- Walks through `TARGET_DIRS` and loads text files.
- Excludes non-relevant directories (`__pycache__`, `migrations`, etc.).
- Returns a list of `Document` objects with metadata for traceability.

### `build_agent()`
- Loads docs → splits chunks → builds embeddings → creates FAISS store.
- Initializes the **RetrievalQA** chain with an OpenAI LLM.

---

## 💡 Developer Insights
- Supports **development vs production** paths using `settings.DEBUG`.
- Uses detailed logging for transparency during agent construction.
- Modular design: easily extendable for new apps or file formats.

---
