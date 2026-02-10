# ✅ New Code
import os
import logging
from pathlib import Path
from typing import List

from langchain_core.documents import Document
from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

from .settings import TARGET_DIRS, EXCLUDE_DIRS, EXCLUDE_FILES, VALID_EXTENSIONS

logger = logging.getLogger(__name__)


def load_project_documents() -> List[Document]:
    """Load raw documents from project source directories (no splitting here)."""
    documents: List[Document] = []

    for base_dir in TARGET_DIRS:
        if not base_dir.exists():
            continue

        for root, dirs, files in os.walk(base_dir):
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]

            for file in files:
                ext = Path(file).suffix
                if file in EXCLUDE_FILES or ext not in VALID_EXTENSIONS:
                    continue

                file_path = Path(root) / file
                try:
                    loader = TextLoader(str(file_path), encoding="utf-8")
                    loaded_docs = loader.load()

                    for doc in loaded_docs:
                        doc.metadata["source"] = str(file_path)

                    documents.extend(loaded_docs)
                except Exception as exc:
                    logger.warning("Failed to load file %s: %s", file_path, exc)

    logger.info("Loaded %d raw documents", len(documents))
    return documents


def split_documents(docs: List[Document]) -> List[Document]:
    """Split documents exactly once using RecursiveCharacterTextSplitter."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1500,
        chunk_overlap=200,
    )
    chunks = splitter.split_documents(docs)
    logger.info("Split into %d chunks", len(chunks))
    return chunks
