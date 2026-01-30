## System Architecture

```mermaid
graph TB
    subgraph "Frontend Layer"
        A["React 18 + TypeScript"]
        B["Arco Design Pro"]
        C["React Flow (Ontology Editor)"]
        D["Monaco Editor (Scripts)"]
        E["Zustand State Management"]
        F["WebSocket Client"]
    end

    subgraph "Backend Layer"
        G["NestJS API Server"]
        H["GraphQL (Apollo)"]
        I["WebSocket Server"]
        J["LangGraph Agentic Engine"]
        K["LLM Router"]
    end

    subgraph "Storage Layer"
        L["Neo4j (Knowledge Graph)"]
        M["PostgreSQL (Metadata)"]
        N["Redis (Cache)"]
        O["Qdrant (Vector DB)"]
    end

    subgraph "External Services"
        P["OpenAI GPT-4o"]
        Q["Anthropic Claude 3.5"]
        R["Alibaba Qwen"]
        S["Casdoor (Auth)"]
    end

    subgraph "Agentic Workflows"
        T["Planner Agent"]
        U["Intent Extraction Agent"]
        V["Orchestration Agent"]
        W["Execution Agent"]
    end

    A --> G
    B --> A
    C --> A
    D --> A
    E --> A
    F --> I
    
    G --> H
    G --> J
    H --> L
    H --> M
    I --> F
    J --> T
    J --> U
    J --> V
    J --> W
    K --> P
    K --> Q
    K --> R
    
    T --> L
    T --> O
    U --> L
    U --> O
    V --> L
    V --> O
    W --> L
    W --> M
    W --> N

    S --> G
    L --> N
    M --> N
    O --> J