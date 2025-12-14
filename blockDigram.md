```mermaid
graph TB
    %% User Interface Layer
    subgraph UI[" Frontend Layer - Angular "]
        UI1[Input Form<br/>Jobs, Machines, Dependencies]
        UI2[Algorithm Selector<br/>Backtracking / Cultural]
        UI3[Random Generator UI]
        UI4[Results Viewer]
        UI5[Gantt Chart Visualizer]
        UI6[Logs Display]
        UI7[Performance Comparator]
    end
    
    %% API Layer
    subgraph API[" API Layer - FastAPI "]
        API1[POST /api/solve]
        API2[POST /api/random]
    end
    
    %% Core Processing Layer
    subgraph CORE[" Core Processing Layer "]
        CORE1[Input Validator]
        CORE2[Dependency Resolver]
        CORE3[Algorithm Router]
    end
    
    %% Algorithm Layer
    subgraph ALG[" Algorithm Layer "]
        direction TB
        subgraph BT[" Backtracking Algorithm "]
            BT1[Recursive Solver]
            BT2[Constraint Checker]
            BT3[Pruning Logic]
            BT4[Best Solution Tracker]
        end
        
        subgraph CA[" Cultural Algorithm "]
            CA1[Population Generator]
            CA2[Fitness Evaluator]
            CA3[Selection Operator]
            CA4[Mutation Operator]
            CA5[Elite Preservation]
        end
    end
    
    %% Output Processing Layer
    subgraph OUTPUT[" Output Processing Layer "]
        OUT1[Schedule Builder]
        OUT2[Makespan Calculator]
        OUT3[Execution Logger]
        OUT4[Result Formatter]
    end
    
    %% Data Models
    subgraph DATA[" Data Models "]
        D1[(Job Model<br/>id, name, duration,<br/>dependencies)]
        D2[(Schedule Request<br/>jobs, machines,<br/>algorithm)]
        D3[(Schedule Result<br/>makespan, time,<br/>schedule, logs)]
        D4[(Task Result<br/>job, machine,<br/>start, end)]
    end
    
    %% Connections - UI to API
    UI1 --> API1
    UI2 --> API1
    UI3 --> API2
    
    %% Connections - API to Core
    API1 --> CORE1
    API1 --> D2
    API2 --> OUT4
    
    %% Connections - Core Processing
    CORE1 --> CORE2
    CORE2 --> CORE3
    
    %% Connections - Algorithm Router
    CORE3 --> BT
    CORE3 --> CA
    
    %% Connections - Backtracking Internal
    BT1 --> BT2
    BT2 --> BT3
    BT3 --> BT4
    
    %% Connections - Cultural Internal
    CA1 --> CA2
    CA2 --> CA3
    CA3 --> CA4
    CA4 --> CA5
    CA5 --> CA2
    
    %% Connections - Algorithm to Output
    BT4 --> OUT1
    CA5 --> OUT1
    
    %% Connections - Output Processing
    OUT1 --> OUT2
    OUT1 --> OUT3
    OUT2 --> OUT4
    OUT3 --> OUT4
    
    %% Connections - Output to UI
    OUT4 --> D3
    D3 --> UI4
    D3 --> UI5
    D3 --> UI6
    D3 --> UI7
    
    %% Connections - Data Models
    D1 -.-> CORE1
    D2 -.-> CORE3
    D4 -.-> OUT1
    
    %% Styling
    style UI fill:#E3F2FD,stroke:#1976D2,stroke-width:3px,color:#000
    style API fill:#FFF3E0,stroke:#F57C00,stroke-width:3px,color:#000
    style CORE fill:#F3E5F5,stroke:#7B1FA2,stroke-width:3px,color:#000
    style ALG fill:#E8F5E9,stroke:#388E3C,stroke-width:3px,color:#000
    style BT fill:#C8E6C9,stroke:#4CAF50,stroke-width:2px,color:#000
    style CA fill:#FFCCBC,stroke:#FF5722,stroke-width:2px,color:#000
    style OUTPUT fill:#FFF9C4,stroke:#FBC02D,stroke-width:3px,color:#000
    style DATA fill:#E1BEE7,stroke:#8E24AA,stroke-width:3px,color:#000
    
    style UI1 fill:#BBDEFB,stroke:#1976D2,color:#000
    style UI2 fill:#BBDEFB,stroke:#1976D2,color:#000
    style UI3 fill:#BBDEFB,stroke:#1976D2,color:#000
    style UI4 fill:#BBDEFB,stroke:#1976D2,color:#000
    style UI5 fill:#BBDEFB,stroke:#1976D2,color:#000
    style UI6 fill:#BBDEFB,stroke:#1976D2,color:#000
    style UI7 fill:#BBDEFB,stroke:#1976D2,color:#000