
import logging
from langchain_community.vectorstores import FAISS

from .settings import INDEX_DIR, REBUILD_INDEX
from .indexer import load_project_documents, split_documents

logger = logging.getLogger(__name__)


def load_or_build_faiss(embeddings):
    """
    Load persisted FAISS index from disk if present.
    Build and save only if missing or forced rebuild.
    """
    index_faiss = INDEX_DIR / "index.faiss"
    index_pkl = INDEX_DIR / "index.pkl"
    index_exists = index_faiss.exists() and index_pkl.exists()

    # Step 1: Load fast path
    if index_exists and not REBUILD_INDEX:
        logger.info("Loading FAISS index from disk: %s", INDEX_DIR)
        return FAISS.load_local(
            INDEX_DIR,
            embeddings,
            allow_dangerous_deserialization=True,
        )

    # Step 2: Build path
    logger.info("Building FAISS index (rebuild=%s)", REBUILD_INDEX)

    docs = load_project_documents()
    chunks = split_documents(docs)

    if not chunks:
        raise ValueError("No document chunks generated for embedding.")

    vectorstore = FAISS.from_documents(chunks, embeddings)

    INDEX_DIR.mkdir(parents=True, exist_ok=True)
    vectorstore.save_local(INDEX_DIR)

    logger.info("FAISS index built and saved to disk.")
    return vectorstore
