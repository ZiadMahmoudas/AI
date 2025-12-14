```mermaid
graph TD
    %% Actors
    A[User / Frontend]
    B[System / Backend]
    
    %% Use Cases - Primary Functions
    subgraph Scheduling
        UC1(Submit Scheduling Request)
    end
    
    subgraph Algorithm Execution
        UC3(Run Backtracking Algorithm)
        UC4(Run Cultural Algorithm)
    end
    
    subgraph Results & Comparison
        UC5(View Schedule Results)
        UC6(View Execution Logs)
        UC7(Compare Performance)
    end
    
    %% Use Cases - Utility & Constraints
    subgraph System Utilities
        UC8(Validate Input Data)
    end
    
    %% Relationships - User Initiated
    A --> UC1
    A --> UC3
    A --> UC4
    A --> UC5
    A --> UC6
    A --> UC7
    
    %% Relationships - System Interactions
    B --> UC8
    
    %% Relationships - Includes (Mandatory Dependency)
    UC1 -.->|includes| UC8
    
    
    %% Relationships - Generalization (View capabilities)
    UC7 -.->|generalizes| UC5
    UC7 -.->|generalizes| UC6
    
    %% Styling
    style A fill:#D0E8F2,stroke:#3AA7C0,stroke-width:2px,color:#000
    style B fill:#F5E8C7,stroke:#A78A00,stroke-width:2px,color:#000
    style UC1 fill:#E6FFCC,stroke:#8BC34A,color:#000
    style UC3 fill:#FFEBCC,stroke:#FF9800,color:#000
    style UC4 fill:#FFEBCC,stroke:#FF9800,color:#000
    style UC5 fill:#CCE5FF,stroke:#2196F3,color:#000
    style UC6 fill:#CCE5FF,stroke:#2196F3,color:#000
    style UC7 fill:#CCE5FF,stroke:#2196F3,color:#000
    style UC8 fill:#F2D0E8,stroke:#C03AA7,color:#000

