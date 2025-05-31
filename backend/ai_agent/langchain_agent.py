# backend/ai_agent/langchain_agent.py

import os
from langchain.document_loaders import TextLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.embeddings import OpenAIEmbeddings
from langchain.vectorstores import FAISS
from langchain.chains import RetrievalQA
from langchain.llms import OpenAI
from dotenv import load_dotenv

load_dotenv()  # ✅ Load .env for your OpenAI key

# --- Step 1: Define directories to index ---
TARGET_DIRS = [
    "backend/chat",
    "backend/game",
    "backend/friends",
    "backend/users",
    "backend/utils",
    
    # Frontend React files
    "tic-tac-toe/src/components",
    "tic-tac-toe/src/reducers",         
    "tic-tac-toe/src/context",          
]

EXCLUDE_DIRS = [
    "migrations",
    "__pycache__",
    "static",
    "media",
    "migrations",
    "__pycache__",
    "static",
    "media",
    "node_modules",
    "public",
    "build",
    ".git",
    ".vscode",
]

EXCLUDE_FILES = [
    "settings.py",
    "secrets.py",
    ".env",
    "manage.py",
    "apps.py",
    "admin.py",
    "tokens.py",
    "permissions.py",
    "serializers.py",  # optionally include later
]

VALID_EXTENSIONS = [
    ".py", ".md", ".txt",
    ".jsx", ".tsx", ".js", ".ts",
]

# --- Step 2: Load and process files ---
def load_project_documents():
    documents = []
    for base_dir in TARGET_DIRS:
        for root, dirs, files in os.walk(base_dir):
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            for file in files:
                if file in EXCLUDE_FILES:
                    continue
                if any(file.endswith(ext) for ext in VALID_EXTENSIONS):
                    path = os.path.join(root, file)
                    loader = TextLoader(path, encoding="utf-8")
                    documents.extend(loader.load_and_split())
    return documents

# --- Step 3: Build retriever pipeline ---
def build_agent():
    docs = load_project_documents()

    # Split large docs for better embeddings
    splitter = RecursiveCharacterTextSplitter(
    chunk_size=800,
    chunk_overlap=100
    )
    chunks = splitter.split_documents(docs)

    embeddings = OpenAIEmbeddings()
    vectorstore = FAISS.from_documents(chunks, embeddings)

    retriever = vectorstore.as_retriever()
    chain = RetrievalQA.from_chain_type(
        llm=OpenAI(temperature=0),
        chain_type="stuff",
        retriever=retriever
    )
    return chain
