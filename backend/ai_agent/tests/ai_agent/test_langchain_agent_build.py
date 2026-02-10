# Filename: backend/tests/ai_agent/test_vectorstore_persistence.py
# Step 1: Imports
from pathlib import Path
from unittest.mock import MagicMock

import pytest


# Step 2: Test "rebuild path" (forced rebuild)
def test_rebuilds_and_saves_when_forced(monkeypatch, tmp_path: Path):
    """
    When rebuild is forced via REBUILD_INDEX=True,
    the vectorstore should rebuild and save to disk.
    """
    # Step 3: Import module under test
    from ai_agent import vectorstore as vs

    # Step 4: Even if index exists, rebuild should happen
    (tmp_path / "index.faiss").write_bytes(b"old-faiss")
    (tmp_path / "index.pkl").write_bytes(b"old-pkl")

    monkeypatch.setattr(vs, "INDEX_DIR", tmp_path)
    monkeypatch.setattr(vs, "REBUILD_INDEX", True)

    # Step 5: Patch indexer pipeline to avoid filesystem scan
    monkeypatch.setattr(vs, "load_project_documents", MagicMock(return_value=["DOC1"]))
    monkeypatch.setattr(vs, "split_documents", MagicMock(return_value=["CHUNK1", "CHUNK2"]))

    # Step 6: Mock FAISS.from_documents to return a vectorstore with save_local()
    vectorstore_instance = MagicMock()
    vectorstore_instance.save_local = MagicMock()

    from_documents_mock = MagicMock(return_value=vectorstore_instance)
    load_local_mock = MagicMock(side_effect=AssertionError("Should not load when forced rebuild"))

    fake_faiss = MagicMock()
    fake_faiss.from_documents = from_documents_mock
    fake_faiss.load_local = load_local_mock
    monkeypatch.setattr(vs, "FAISS", fake_faiss)

    # Step 7: Execute
    result = vs.load_or_build_faiss(embeddings=object())

    # Step 8: Assert rebuild path
    assert result == vectorstore_instance
    from_documents_mock.assert_called_once()
    vectorstore_instance.save_local.assert_called_once_with(tmp_path)
    assert load_local_mock.call_count == 0
