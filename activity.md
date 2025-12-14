```mermaid
graph TD
    Start([User Opens Application]) --> Input{Input Method?}
    
    %% Manual Input Path
    Input -->|Manual Entry| ManualInput[Enter Job Details:<br/>ID, Name, Duration, Dependencies]
    ManualInput --> SelectMachines[Specify Number of Machines]
    
    %% Random Generation Path
    Input -->|Generate Random| RandomParams[Set Parameters:<br/>num_jobs, num_machines]
    RandomParams --> GenerateRandom[API: Generate Random Problem]
    GenerateRandom --> PopulateForm[Auto-fill Form with Generated Data]
    PopulateForm --> SelectMachines
    
    %% Algorithm Selection
    SelectMachines --> SelectAlgo{Select Algorithm}
    
    %% Validation
    SelectAlgo --> Validate[Validate Input Data]
    Validate --> ValidCheck{Valid Input?}
    ValidCheck -->|No| ShowError[Display Validation Errors]
    ShowError --> ManualInput
    ValidCheck -->|Yes| SendRequest[Send Request to API]
    
    %% API Processing
    SendRequest --> CheckAlgo{Algorithm Type?}
    
    %% Backtracking Path
    CheckAlgo -->|Backtracking| InitBT[Initialize Backtracking Solver]
    InitBT --> BTLoop[Start Recursive Backtracking]
    BTLoop --> CheckDeps{Check Job<br/>Dependencies}
    CheckDeps -->|Not Satisfied| SkipJob[Skip to Next Job]
    CheckDeps -->|Satisfied| TryMachines[Try Each Machine]
    TryMachines --> CalcTime[Calculate Start/End Time]
    CalcTime --> Prune{Prune Branch?<br/>start >= best_makespan}
    Prune -->|Yes| Backtrack[Backtrack]
    Prune -->|No| AssignJob[Assign Job to Machine]
    AssignJob --> MoreJobs{More Jobs?}
    MoreJobs -->|Yes| BTLoop
    MoreJobs -->|No| UpdateBest[Update Best Solution]
    UpdateBest --> Backtrack
    Backtrack --> IterCheck{Iterations<br/>> 5000?}
    IterCheck -->|Yes| BTDone[Backtracking Complete]
    IterCheck -->|No| MoreJobs
    SkipJob --> MoreJobs
    BTDone --> BuildResult
    
    %% Cultural Algorithm Path
    CheckAlgo -->|Cultural| InitCA[Initialize Cultural Algorithm]
    InitCA --> InitPop[Generate Random Population<br/>Size: 20]
    InitPop --> EvalFitness[Evaluate Fitness<br/>Calculate Makespan]
    EvalFitness --> GenLoop{Generation < 30?}
    GenLoop -->|No| CADone[Cultural Algorithm Complete]
    GenLoop -->|Yes| Selection[Selection: Keep Top 20%]
    Selection --> Crossover[Generate Offspring]
    Crossover --> Mutation[Apply Mutation:<br/>Random Machine Change]
    Mutation --> NewEval[Evaluate New Generation]
    NewEval --> UpdateBestCA[Update Best Solution]
    UpdateBestCA --> NextGen[Increment Generation]
    NextGen --> GenLoop
    CADone --> BuildResult
    
    %% Result Processing
    BuildResult[Build Schedule Format]
    BuildResult --> CalcMakespan[Calculate Final Makespan]
    CalcMakespan --> FormatLogs[Format Execution Logs]
    FormatLogs --> SendResponse[Send Response to Frontend]
    
    %% Display Results
    SendResponse --> ParseResults[Parse JSON Response]
    ParseResults --> DisplayGantt[Display Gantt Chart]
    DisplayGantt --> DisplayLogs[Display Execution Logs]
    DisplayLogs --> DisplayMetrics[Display Performance Metrics:<br/>Makespan, Execution Time]
    DisplayMetrics --> UserAction{User Action?}
    
    %% User Options
    UserAction -->|Compare| Compare[Compare Both Algorithms]
    Compare --> DisplayMetrics
    UserAction -->|New Problem| Input
    UserAction -->|Exit| End([End])
    
    %% Styling
    style Start fill:#4CAF50,stroke:#2E7D32,color:#fff,stroke-width:3px
    style End fill:#F44336,stroke:#C62828,color:#fff,stroke-width:3px
    style Input fill:#2196F3,stroke:#1565C0,color:#fff
    style SelectAlgo fill:#2196F3,stroke:#1565C0,color:#fff
    style CheckAlgo fill:#FF9800,stroke:#E65100,color:#fff
    style ValidCheck fill:#FFC107,stroke:#F57F17,color:#000
    style Prune fill:#FFC107,stroke:#F57F17,color:#000
    style GenLoop fill:#FFC107,stroke:#F57F17,color:#000
    style MoreJobs fill:#FFC107,stroke:#F57F17,color:#000
    style IterCheck fill:#FFC107,stroke:#F57F17,color:#000
    style UserAction fill:#9C27B0,stroke:#6A1B9A,color:#fff
    style DisplayGantt fill:#00BCD4,stroke:#00838F,color:#fff
    style InitBT fill:#FFEB3B,stroke:#F57F17,color:#000
    style InitCA fill:#FF5722,stroke:#D84315,color:#fff