# File: langchain_agent.py

import os
import logging
from pathlib import Path
from django.conf import settings

from langchain_community.document_loaders import TextLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.embeddings import OpenAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain.chains import RetrievalQA
from langchain_community.llms import OpenAI

logger = logging.getLogger(__name__)

# === 📁 Project Base Directory ===
PROJECT_ROOT = Path(__file__).parents[2].resolve()

# === 🎯 Target Directories to Crawl ===
TARGET_DIRS = [
    PROJECT_ROOT / "backend" / "chat",
    PROJECT_ROOT / "backend" / "game",
    PROJECT_ROOT / "backend" / "friends",
    PROJECT_ROOT / "backend" / "users",
    PROJECT_ROOT / "backend" / "utils",
    PROJECT_ROOT / "backend" / "ai_agent",  # ✅ Added for agent source code
    PROJECT_ROOT / "tic-tac-toe" / "src" / "components",
    PROJECT_ROOT / "tic-tac-toe" / "src" / "reducers",
    PROJECT_ROOT / "tic-tac-toe" / "src" / "context",
]

# Optional: Print path check for dev
# for dir in TARGET_DIRS:
#     print(f"[DEBUG] Checking dir exists: {dir} → {dir.exists()}")

# === 🚫 Filters ===
EXCLUDE_DIRS = {
    "migrations", "__pycache__", "static", "media", "node_modules",
    "public", "build", ".git", ".vscode",
}
EXCLUDE_FILES = {
    "settings.py", "secrets.py", ".env", "manage.py", "apps.py",
    "admin.py", "tokens.py", "permissions.py", "serializers.py",
}
VALID_EXTENSIONS = {".py", ".md", ".txt", ".jsx", ".tsx", ".js", ".ts"}

# === 📄 Load Project Files ===
def load_project_documents():
    logger.info("📚 Starting document loading process.")
    documents = []

    for base_dir in TARGET_DIRS:
        base_dir_str = str(base_dir)
        logger.info(f"🔍 Scanning directory: {base_dir_str}")
        if not os.path.exists(base_dir_str):
            logger.warning(f"⚠️ Directory does not exist: {base_dir_str}")
            continue

        for root, dirs, files in os.walk(base_dir_str):
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            for file in files:
                file_path = os.path.join(root, file)
                ext = os.path.splitext(file)[-1]

                if file in EXCLUDE_FILES:
                    logger.debug(f"⏭️ Skipping excluded file: {file_path}")
                    continue
                if ext not in VALID_EXTENSIONS:
                    logger.debug(f"🚫 Unsupported extension {ext}: {file_path}")
                    continue

                try:
                    loader = TextLoader(file_path, encoding="utf-8")
                    loaded_docs = loader.load_and_split()
                    for doc in loaded_docs:
                        doc.metadata["source"] = file_path  # ✅ Add metadata for traceability
                    documents.extend(loaded_docs)
                    logger.debug(f"✅ Loaded {len(loaded_docs)} docs from: {file_path}")
                except Exception as e:
                    logger.error(f"❌ Failed to load {file_path}: {e}")

    logger.info(f"🏁 Document loading complete. Total loaded: {len(documents)}")
    return documents

# === 🤖 Build the LangChain Agent ===
def build_agent():
    logger.info("🧠 Building LangChain agent.")
    docs = load_project_documents()

    splitter = RecursiveCharacterTextSplitter(chunk_size=1500, chunk_overlap=200)  # ✅ Larger chunks
    chunks = splitter.split_documents(docs)
    logger.debug(f"Chunks created: {len(chunks)}")

    if not chunks:
        logger.error("🛑 No document chunks available. Aborting agent build.")
        raise ValueError("No document chunks to embed. Check document loading.")

    # 🔐 Ensure API key is present
    if not settings.OPENAI_API_KEY:
        logger.critical("❌ OPENAI_API_KEY is missing from settings.")
        raise ValueError("OPENAI_API_KEY is not set. Add it to your .env file.")

    embeddings = OpenAIEmbeddings(openai_api_key=settings.OPENAI_API_KEY)
    logger.info("🔑 OpenAI Embeddings initialized.")

    vectorstore = FAISS.from_documents(chunks, embeddings)
    logger.info("📦 Vectorstore created using FAISS.")

    retriever = vectorstore.as_retriever()
    logger.info("📡 Retriever ready.")

    chain = RetrievalQA.from_chain_type(  # 🔁 Switch to RetrievalQAWithSourcesChain if desired
        llm=OpenAI(
            temperature=0,
            openai_api_key=settings.OPENAI_API_KEY
        ),
        chain_type="stuff",
        retriever=retriever,
    )

    logger.info("✅ LangChain RetrievalQA chain successfully built.")
    return chain
