                                
                    LangChain Trinity Assistant – System Architecture                            
                                
                                
                                ┌──────────────────────────┐
                                │      React Frontend      │
                                │                          │
                                │  TrinityOverlay.jsx      │
                                │  TrinityDrawer.jsx       │
                                │  Trinity.jsx             │
                                │  useAuthAxios            │
                                └──────────┬───────────────┘
                                           │
                             POST /api/ask-agent/
                                           │
                                ┌──────────▼────────────┐
                                │     Django Backend     │
                                │                        │
                                │   AskAgentView (APIView)│
                                │        (views.py)       │
                                └──────────┬─────────────┘
                                           │
                               get_agent() │
                                ┌──────────▼─────────────┐
                                │   Agent Manager Layer   │
                                │   (agent_manager.py)    │
                                │ - Singleton Agent Pool  │
                                │ - Thread-safe Locking   │
                                └──────────┬──────────────┘
                                           │
                                ┌──────────▼─────────────┐
                                │   LangChain Agent Core  │
                                │   (langchain_agent.py)  │
                                │                         │
                                │ • Load .py/.jsx/.md     │
                                │ • Split into Chunks     │
                                │ • Embed via OpenAI      │
                                │ • VectorStore (FAISS)   │
                                │ • RetrievalQA Chain     │
                                └────────────────────────┘
