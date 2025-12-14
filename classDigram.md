```mermaid
classDiagram
    %% Data Models
    class Job {
        +int id
        +string name
        +int duration
        +List~int~ dependencies
    }
    
    class ScheduleRequest {
        +List~Job~ jobs
        +int num_machines
        +string algorithm
    }
    
    class TaskResult {
        +Job job
        +int machine
        +int start
        +int end
    }
    
    class ScheduleResult {
        +bool success
        +float makespan
        +float execution_time
        +List~List~TaskResult~~ schedule
        +List~string~ logs
        +Optional~int~ iterations
    }
    
    %% Backtracking Algorithm
    class SimpleBacktracking {
        -List~Job~ jobs
        -int num_machines
        -float best_makespan
        -List best_schedule
        -int iterations
        -List~string~ logs
        +__init__(jobs, num_machines)
        +solve() ScheduleResult
        -_backtrack(job_idx, schedule, assigned)
        -_get_makespan(schedule) float
    }
    
    %% Cultural Algorithm
    class SimpleCultural {
        -List~Job~ jobs
        -int num_machines
        -int pop_size
        -int generations
        -List~string~ logs
        +__init__(jobs, num_machines)
        +solve() ScheduleResult
        -_random_solution() List
        -_fitness(solution) float
        -_mutate(solution) List
        -_to_schedule_format(solution) List
    }
    
    %% API Controller
    class FastAPIController {
        +solve_schedule(request) ScheduleResult
        +generate_random(num_jobs, num_machines) dict
    }
    
    %% Relationships
    ScheduleRequest "1" --> "*" Job : contains
    ScheduleResult "1" --> "*" TaskResult : contains
    TaskResult "*" --> "1" Job : references
    
    SimpleBacktracking ..> Job : uses
    SimpleBacktracking ..> ScheduleResult : returns
    SimpleBacktracking ..> TaskResult : creates
    
    SimpleCultural ..> Job : uses
    SimpleCultural ..> ScheduleResult : returns
    SimpleCultural ..> TaskResult : creates
    
    FastAPIController ..> ScheduleRequest : receives
    FastAPIController ..> ScheduleResult : returns
    FastAPIController ..> SimpleBacktracking : creates
    FastAPIController ..> SimpleCultural : creates
    
    %% Notes
    note for SimpleBacktracking "Uses recursive backtracking with pruning and constraint checking"
    note for SimpleCultural "Evolutionary algorithm with population, selection, and mutation"