
import logging
from django.conf import settings

from langchain_community.embeddings import OpenAIEmbeddings
from langchain_community.llms import OpenAI
from langchain.chains import RetrievalQA

from .vectorstore import load_or_build_faiss

logger = logging.getLogger(__name__)


def build_agent():
    """Build RetrievalQA chain using persisted FAISS vectorstore."""
    if not settings.OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY is not set.")

    embeddings = OpenAIEmbeddings(openai_api_key=settings.OPENAI_API_KEY)
    vectorstore = load_or_build_faiss(embeddings)

    retriever = vectorstore.as_retriever()

    chain = RetrievalQA.from_chain_type(
        llm=OpenAI(
            temperature=0,
            openai_api_key=settings.OPENAI_API_KEY,
        ),
        chain_type="stuff",
        retriever=retriever,
    )

    logger.info("LangChain agent ready.")
    return chain
