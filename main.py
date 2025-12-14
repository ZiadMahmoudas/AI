import time
import random
import copy
import io
import base64
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from typing import List, Dict, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# ============================================================================
# APP SETUP
# ============================================================================

app = FastAPI(title="Job Scheduling API", version="16.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# MODELS
# ============================================================================

class Job(BaseModel):
    id: int
    name: str
    duration: int
    dependencies: List[int] = []
    min_chunk_size: int = 1

class ScheduleRequest(BaseModel):
    jobs: List[Job]
    algorithm: str = "backtracking"
    machine_capacity: Optional[int] = 40  # Fixed at 40

class TaskChunk(BaseModel):
    job: Job
    machine: int
    start: int
    end: int
    chunk_id: int
    total_chunks: int
    size: int

class ScheduleResult(BaseModel):
    success: bool
    makespan: float
    execution_time: float
    schedule: List[List[TaskChunk]]
    logs: List[str] = []
    iterations: Optional[int] = None
    splits_info: Dict[int, int] = {}
    efficiency: Optional[float] = None
    total_work: Optional[int] = None
    total_idle_time: Optional[float] = None
    total_machine_time: Optional[float] = None
    performance_details: Optional[Dict] = None
    performance_plot: Optional[str] = None
    capacity_violations: Optional[List[Dict]] = None  # For visualization only
    machine_loads: Optional[List[float]] = None
    error_message: Optional[str] = None  # For capacity errors

# ============================================================================
# CONSTANTS - CAPACITY FIXED AT 40
# ============================================================================
FIXED_MACHINE_CAPACITY = 40
NUM_MACHINES = 3
MAX_CHUNK_SIZE = 5
TOTAL_CAPACITY = FIXED_MACHINE_CAPACITY * NUM_MACHINES

# ============================================================================
# BELIEF SPACE
# ============================================================================

class BeliefSpace:
    def __init__(self, num_machines):
        self.num_machines = num_machines
        self.global_best_chromosome = None
        self.global_best_fitness = float('inf')
        self.global_best_schedule = None
        self.machine_reputation = {} 
        self.capacity_violations_history = []

    def update(self, population_fitness_list):
        sorted_pop = sorted(population_fitness_list, key=lambda x: x[0])
        acceptance_count = max(1, len(sorted_pop) // 5)
        accepted_individuals = sorted_pop[:acceptance_count]
        
        current_best = accepted_individuals[0]
        if current_best[0] < self.global_best_fitness:
            self.global_best_fitness = current_best[0]
            self.global_best_chromosome = copy.deepcopy(current_best[1])
            self.global_best_schedule = current_best[2]
            self.capacity_violations_history = current_best[3]
            
        for _, chromosome, _, _ in accepted_individuals:
            for job_id, chunks in chromosome.items():
                if job_id not in self.machine_reputation:
                    self.machine_reputation[job_id] = {}
                for chunk in chunks:
                    m_id = chunk['machine']
                    self.machine_reputation[job_id][m_id] = \
                        self.machine_reputation[job_id].get(m_id, 0) + 1

    def influence_mutation(self, job_id):
        if job_id in self.machine_reputation and random.random() < 0.7:
            scores = self.machine_reputation[job_id]
            if scores:
                return max(scores, key=scores.get)
        return None

# ============================================================================
# CULTURAL ALGORITHM - WITH STRICT CAPACITY LIMITS
# ============================================================================

class CulturalAlgorithm:
    def __init__(self, jobs: List[Job], machine_capacity: int = 40):
        self.jobs = jobs
        self.num_machines = NUM_MACHINES
        self.machine_capacity = FIXED_MACHINE_CAPACITY  # Always 40
        self.job_dict = {job.id: job for job in jobs}
        self.population_size = 60
        self.generations = 100
        self.mutation_rate = 0.5
        self.elite_size = 8
        self.belief_space = BeliefSpace(self.num_machines)
        self.logs = []
        self.history = []
        self.start_time = time.time()
        self.total_work = sum(job.duration for job in jobs)
        self.MAX_CHUNK_SIZE = MAX_CHUNK_SIZE
        self.capacity_violations = []
        self.has_capacity_error = False

    def solve(self):
        self.logs.append("🧬 Starting Cultural Algorithm...")
        self.logs.append(f"📊 Total jobs: {len(self.jobs)}")
        self.logs.append(f"📊 Total work: {self.total_work} units")
        self.logs.append(f"🏭 Machine Capacity: {self.machine_capacity} units per machine (FIXED)")
        
        # STRICT CAPACITY CHECK: Reject if any job exceeds 40
        for job in self.jobs:
            if job.duration > self.machine_capacity:
                self.has_capacity_error = True
                self.logs.append(f"❌ CAPACITY ERROR: Job '{job.name}' ({job.duration} units) exceeds 40-unit limit")
                return self._create_capacity_error_result(
                    f"Job '{job.name}' ({job.duration} units) exceeds the 40-unit machine capacity limit"
                )
        
        # Check total capacity
        if self.total_work > TOTAL_CAPACITY:
            self.logs.append(f"⚠️ WARNING: Total work exceeds total capacity ({TOTAL_CAPACITY} units)")
        
        for job in self.jobs:
            if job.duration > self.MAX_CHUNK_SIZE:
                chunks_needed = (job.duration + self.MAX_CHUNK_SIZE - 1) // self.MAX_CHUNK_SIZE
                self.logs.append(f"📦 {job.name} ({job.duration}) → {chunks_needed} chunks")
        
        topological_order = self._topological_sort()
        if not topological_order:
            return self._create_error_result("Cyclic dependencies detected!")

        population = []
        for _ in range(self.population_size):
            chrom = self._create_smart_chromosome(topological_order)
            population.append(chrom)
            
        for generation in range(self.generations):
            fitness_scores = []
            for chromosome in population:
                fitness, schedule, violations = self._evaluate_chromosome(chromosome, topological_order)
                if fitness < float('inf'):
                    fitness_scores.append((fitness, chromosome, schedule, violations))
            
            if not fitness_scores:
                continue
                
            self.belief_space.update(fitness_scores)
            self.history.append(self.belief_space.global_best_fitness)
            
            parents = self._select_parents(fitness_scores)
            new_population = []
            
            sorted_fitness = sorted(fitness_scores, key=lambda x: x[0])
            for i in range(min(self.elite_size, len(sorted_fitness))):
                new_population.append(copy.deepcopy(sorted_fitness[i][1]))
            
            while len(new_population) < self.population_size:
                p1 = random.choice(parents)
                p2 = random.choice(parents)
                child = self._crossover(p1, p2, topological_order) if random.random() < 0.9 else copy.deepcopy(p1)
                
                if random.random() < self.mutation_rate:
                    child = self._mutate(child, topological_order)
                new_population.append(child)
            
            population = new_population

        execution_time = time.time() - self.start_time
        best_makespan = self.belief_space.global_best_fitness
        best_schedule = self.belief_space.global_best_schedule
        self.capacity_violations = self.belief_space.capacity_violations_history
        
        if best_schedule and best_makespan < float('inf'):
            plot_base64 = self._generate_plot()
            eff, idle, tm, machine_loads = self._calculate_performance_stats(best_schedule, best_makespan)
            final_schedule = self._build_final_schedule(best_schedule)
            splits = self._calculate_splits_info(best_schedule)
            
            self.logs.append(f"\n🏆 Final Best Makespan: {best_makespan}")
            self.logs.append(f"📊 Efficiency: {eff:.2f}%")
            self._analyze_schedule(best_schedule, best_makespan)
            
            return ScheduleResult(
                success=True, makespan=best_makespan, execution_time=execution_time,
                schedule=final_schedule, logs=self.logs, splits_info=splits,
                efficiency=eff, total_work=self.total_work, total_idle_time=idle,
                total_machine_time=tm, performance_plot=plot_base64,
                capacity_violations=self.capacity_violations,
                machine_loads=machine_loads,
                performance_details={
                    "generations": self.generations, 
                    "population": self.population_size,
                    "machine_capacity": self.machine_capacity
                }
            )
        return self._create_error_result("No valid solution found")

    def _create_smart_chromosome(self, topological_order):
        chrom = {}
        for job in topological_order:
            if job.duration <= self.MAX_CHUNK_SIZE:
                chrom[job.id] = [{
                    'machine': random.randint(0, self.num_machines - 1),
                    'size': job.duration,
                    'order': 0
                }]
            else:
                chrom[job.id] = self._create_intelligent_split(job)
        return chrom

    def _create_intelligent_split(self, job):
        num_chunks = (job.duration + self.MAX_CHUNK_SIZE - 1) // self.MAX_CHUNK_SIZE
        base = job.duration // num_chunks
        remainder = job.duration % num_chunks
        
        initial_sizes = []
        for i in range(num_chunks):
            if i < remainder:
                initial_sizes.append(base + 1)
            else:
                initial_sizes.append(base)
        
        final_sizes = []
        for size in initial_sizes:
            if size > self.MAX_CHUNK_SIZE:
                sub_chunks = (size + self.MAX_CHUNK_SIZE - 1) // self.MAX_CHUNK_SIZE
                sub_base = size // sub_chunks
                sub_rem = size % sub_chunks
                
                for j in range(sub_chunks):
                    if j < sub_rem:
                        final_sizes.append(sub_base + 1)
                    else:
                        final_sizes.append(sub_base)
            else:
                final_sizes.append(size)
        
        num_final_chunks = len(final_sizes)
        machines = list(range(self.num_machines))
        random.shuffle(machines)
        
        chunks = []
        for i in range(num_final_chunks):
            chunks.append({
                'machine': machines[i % self.num_machines],
                'size': final_sizes[i],
                'order': i
            })
        
        total = sum(c['size'] for c in chunks)
        assert total == job.duration, f"Split error: {total} != {job.duration}"
        
        return chunks

    def _mutate(self, chromosome, topological_order):
        mutated = copy.deepcopy(chromosome)
        if not topological_order: 
            return mutated
        
        job = random.choice(topological_order)
        if job.id not in mutated: 
            return mutated
        
        mutation_type = random.random()
        
        if job.duration > self.MAX_CHUNK_SIZE:
            if mutation_type < 0.5:
                mutated[job.id] = self._create_intelligent_split(job)
            else:
                if mutated[job.id]:
                    chunk_idx = random.randint(0, len(mutated[job.id]) - 1)
                    mutated[job.id][chunk_idx]['machine'] = random.randint(0, self.num_machines - 1)
        else:
            influenced = self.belief_space.influence_mutation(job.id)
            if influenced is not None:
                mutated[job.id][0]['machine'] = influenced
            else:
                mutated[job.id][0]['machine'] = random.randint(0, self.num_machines - 1)
        
        return mutated

    def _evaluate_chromosome(self, chrom, order):
        for job_id, chunks in chrom.items():
            total_size = sum(chunk['size'] for chunk in chunks)
            if total_size != self.job_dict[job_id].duration:
                return float('inf'), [], []
            for chunk in chunks:
                if chunk['size'] > self.MAX_CHUNK_SIZE:
                    return float('inf'), [], []
        
        m_times = [0] * self.num_machines
        m_scheds = [[] for _ in range(self.num_machines)]
        completed = {}
        violations = []
        machine_loads = [0] * self.num_machines
        
        for job in order:
            start_time = 0
            for dep_id in job.dependencies:
                if dep_id in completed:
                    start_time = max(start_time, completed[dep_id])
                else:
                    return float('inf'), [], []
            
            chunks = chrom.get(job.id, [])
            if not chunks:
                return float('inf'), [], []
            
            chunks = sorted(chunks, key=lambda x: x['order'])
            current_time = start_time
            
            for chunk in chunks:
                machine = chunk['machine']
                size = chunk['size']
                
                chunk_start = max(current_time, m_times[machine])
                chunk_end = chunk_start + size
                
                # Check for capacity violations (for visualization only)
                if chunk_end > self.machine_capacity:
                    violations.append({
                        'job_id': job.id,
                        'job_name': job.name,
                        'machine': machine,
                        'chunk_size': size,
                        'exceeded_by': chunk_end - self.machine_capacity,
                        'start': chunk_start,
                        'end': chunk_end
                    })
                
                m_times[machine] = chunk_end
                machine_loads[machine] += size
                m_scheds[machine].append((job, chunk_start, chunk_end, size))
                current_time = chunk_end
            
            completed[job.id] = current_time
        
        makespan = max(m_times)
        
        # Penalty for capacity violations
        violation_penalty = len(violations) * 10
        
        total_machine_time = makespan * self.num_machines
        total_work = sum(sum(size for _, _, _, size in sched) for sched in m_scheds)
        efficiency = total_work / total_machine_time if total_machine_time > 0 else 0
        
        penalty = (1 - efficiency) * makespan * 0.4
        machine_utilization = [sum(size for _, _, _, size in m_sched) / max(1, m_times[m]) 
                          for m, m_sched in enumerate(m_scheds)]
        load_balance_penalty = (max(machine_utilization) - min(machine_utilization)) * makespan * 0.2
        adjusted_makespan = makespan + penalty + load_balance_penalty + violation_penalty
        
        return adjusted_makespan, m_scheds, violations

    def _analyze_schedule(self, schedule, makespan):
        self.logs.append("\n📈 ===== SCHEDULE ANALYSIS =====")
        
        for machine_id, machine_schedule in enumerate(schedule):
            total_work = sum(size for _, _, _, size in machine_schedule)
            utilization = (total_work / makespan * 100) if makespan > 0 else 0
            
            self.logs.append(f"\nMachine {machine_id + 1}:")
            self.logs.append(f"  Total work: {total_work}")
            self.logs.append(f"  Utilization: {utilization:.1f}%")
            self.logs.append(f"  Capacity: {self.machine_capacity} units")
            self.logs.append(f"  Capacity usage: {min(100, (total_work/self.machine_capacity)*100):.1f}%")
            self.logs.append(f"  Tasks: {len(machine_schedule)}")
            
            if total_work > self.machine_capacity:
                exceed = total_work - self.machine_capacity
                self.logs.append(f"  ⚠️ WARNING: Exceeded capacity by {exceed:.1f} units")
            
            for job, start, end, size in machine_schedule:
                self.logs.append(f"    {job.name}: {start}-{end} ({size} units)")
        
        if self.capacity_violations:
            self.logs.append("\n⚠️ ===== CAPACITY VIOLATIONS =====")
            for violation in self.capacity_violations:
                self.logs.append(f"  ⚠️ Job {violation['job_name']} (ID: {violation['job_id']})")
                self.logs.append(f"    Machine {violation['machine'] + 1}: {violation['start']}-{violation['end']}")
                self.logs.append(f"    Exceeded capacity by {violation['exceeded_by']} units")

    def _generate_plot(self):
        try:
            plt.figure(figsize=(12, 6))
            plt.subplot(1, 2, 1)
            plt.plot(self.history, label='Best Makespan', color='blue', linewidth=2)
            plt.title('Cultural Algorithm Performance', fontsize=14, fontweight='bold')
            plt.xlabel('Generation', fontsize=12)
            plt.ylabel('Makespan', fontsize=12)
            plt.grid(True, alpha=0.3)
            plt.legend()
            
            plt.subplot(1, 2, 2)
            # Draw capacity line
            plt.axhline(y=FIXED_MACHINE_CAPACITY, color='red', linestyle='--', label=f'Capacity: {FIXED_MACHINE_CAPACITY}')
            
            if self.capacity_violations:
                warnings_count = min(len(self.history), len(self.capacity_violations))
                if warnings_count > 0:
                    warnings_data = [1] * warnings_count  # Simplified
                    plt.plot(warnings_data, label='Capacity Warnings', color='orange', linewidth=2)
            
            plt.title('Capacity Monitoring', fontsize=14, fontweight='bold')
            plt.xlabel('Generation', fontsize=12)
            plt.ylabel('Units', fontsize=12)
            plt.grid(True, alpha=0.3)
            plt.legend()
            
            plt.tight_layout()
            buf = io.BytesIO()
            plt.savefig(buf, format='png', dpi=100, bbox_inches='tight')
            buf.seek(0)
            img_str = base64.b64encode(buf.read()).decode('utf-8')
            plt.close()
            return img_str
        except Exception as e:
            print(f"Error generating plot: {e}")
            return None

    def _select_parents(self, fitness_scores):
        parents = []
        for _ in range(len(fitness_scores)):
            tournament = random.sample(fitness_scores, min(5, len(fitness_scores)))
            best = min(tournament, key=lambda x: x[0])
            parents.append(best[1])
        return parents

    def _crossover(self, p1, p2, order):
        child = {}
        for job in order:
            if random.random() < 0.5:
                if job.id in p1:
                    child[job.id] = copy.deepcopy(p1[job.id])
            else:
                if job.id in p2:
                    child[job.id] = copy.deepcopy(p2[job.id])
        return child

    def _calculate_performance_stats(self, schedule, makespan):
        total_machine_time = makespan * self.num_machines
        total_work_time = 0
        machine_work = [0] * self.num_machines
        
        for machine_id, machine_schedule in enumerate(schedule):
            for job, start, end, size in machine_schedule:
                total_work_time += size
                machine_work[machine_id] += size
        
        efficiency = (total_work_time / total_machine_time * 100) if total_machine_time > 0 else 0
        idle_time = total_machine_time - total_work_time
        
        machine_loads = []
        for work in machine_work:
            load_pct = (work / self.machine_capacity * 100) if self.machine_capacity > 0 else 0
            machine_loads.append(load_pct)
        
        return efficiency, idle_time, total_machine_time, machine_loads

    def _calculate_splits_info(self, schedule):
        splits = {}
        for machine_schedule in schedule:
            for job, _, _, _ in machine_schedule:
                splits[job.id] = splits.get(job.id, 0) + 1
        return splits

    def _build_final_schedule(self, schedule):
        final = [[] for _ in range(self.num_machines)]
        
        all_chunks = []
        for machine_id, machine_schedule in enumerate(schedule):
            for job, start, end, size in machine_schedule:
                all_chunks.append((machine_id, job, start, end, size))
        
        job_chunks = {}
        for machine_id, job, start, end, size in all_chunks:
            if job.id not in job_chunks:
                job_chunks[job.id] = []
            job_chunks[job.id].append((machine_id, start, end, job, size))
        
        for job_id, chunks in job_chunks.items():
            chunks.sort(key=lambda x: x[2])
            total = len(chunks)
            
            for idx, (machine_id, start, end, job, size) in enumerate(chunks):
                final[machine_id].append(TaskChunk(
                    job=job,
                    machine=machine_id,
                    start=start,
                    end=end,
                    chunk_id=idx + 1,
                    total_chunks=total,
                    size=size
                ))
        
        for machine_schedule in final:
            machine_schedule.sort(key=lambda x: x.start)
        
        return final

    def _topological_sort(self):
        visited = set()
        temp = set()
        result = []
        
        def dfs(job_id):
            if job_id in temp:
                return False
            if job_id in visited:
                return True
            
            temp.add(job_id)
            
            job = self.job_dict.get(job_id)
            if not job:
                return True
            
            for dep_id in job.dependencies:
                if not dfs(dep_id):
                    return False
            
            temp.remove(job_id)
            visited.add(job_id)
            result.append(job)
            return True
        
        for job in self.jobs:
            if job.id not in visited:
                if not dfs(job.id):
                    return None
        
        return result

    def _create_error_result(self, msg):
        return ScheduleResult(
            success=False, 
            makespan=0, 
            execution_time=time.time() - self.start_time, 
            schedule=[], 
            logs=[msg]
        )
    
    def _create_capacity_error_result(self, msg):
        return ScheduleResult(
            success=False,
            makespan=0,
            execution_time=time.time() - self.start_time,
            schedule=[],
            logs=[f"❌ {msg}"],
            error_message=msg
        )

# ============================================================================
# BACKTRACKING SOLVER - WITH STRICT CAPACITY LIMITS
# ============================================================================

class BacktrackingSolver:
    def __init__(self, jobs: List[Job], machine_capacity: int = 40):
        self.jobs = jobs
        self.num_machines = NUM_MACHINES
        self.machine_capacity = FIXED_MACHINE_CAPACITY  # Always 40
        self.job_dict = {job.id: job for job in jobs}
        self.best_makespan = float('inf')
        self.best_schedule = None
        self.iterations = 0
        self.logs = []
        self.start_time = time.time()
        self.total_work = sum(job.duration for job in jobs)
        self.MAX_CHUNK_SIZE = MAX_CHUNK_SIZE
        self.capacity_violations = []
        self.has_capacity_error = False

    def solve(self):
        self.logs.append("🔍 Starting Backtracking Algorithm...")
        self.logs.append(f"📊 Total jobs: {len(self.jobs)}")
        self.logs.append(f"📊 Total work: {self.total_work} units")
        self.logs.append(f"🏭 Machine Capacity: {self.machine_capacity} units per machine (FIXED)")
        
        # STRICT CAPACITY CHECK: Reject if any job exceeds 40
        for job in self.jobs:
            if job.duration > self.machine_capacity:
                self.has_capacity_error = True
                self.logs.append(f"❌ CAPACITY ERROR: Job '{job.name}' ({job.duration} units) exceeds 40-unit limit")
                return self._create_capacity_error_result(
                    f"Job '{job.name}' ({job.duration} units) exceeds the 40-unit machine capacity limit"
                )
        
        # Check total capacity
        if self.total_work > TOTAL_CAPACITY:
            self.logs.append(f"⚠️ WARNING: Total work exceeds total capacity ({TOTAL_CAPACITY} units)")
        
        for job in self.jobs:
            if job.duration > self.MAX_CHUNK_SIZE:
                chunks_needed = (job.duration + self.MAX_CHUNK_SIZE - 1) // self.MAX_CHUNK_SIZE
                self.logs.append(f"📦 {job.name} ({job.duration}) → {chunks_needed} chunks")
        
        topological = self._topological_sort()
        if not topological:
            return self._create_error_result("Cycle Detected")
        
        machine_times = [0, 0, 0]
        machine_schedules = [[] for _ in range(3)]
        
        for job in topological:
            self.logs.append(f"\n📝 Processing: {job.name} (Duration: {job.duration})")
            
            earliest_start = 0
            for dep_id in job.dependencies:
                for m_sched in machine_schedules:
                    for dep_job, _, dep_end, _ in m_sched:
                        if dep_job.id == dep_id:
                            earliest_start = max(earliest_start, dep_end)
            
            if job.duration > self.MAX_CHUNK_SIZE:
                chunks_needed = (job.duration + self.MAX_CHUNK_SIZE - 1) // self.MAX_CHUNK_SIZE
                self.logs.append(f"   Needs splitting into {chunks_needed} chunks")
                
                base = job.duration // chunks_needed
                remainder = job.duration % chunks_needed
                
                chunk_sizes = []
                for i in range(chunks_needed):
                    if i < remainder:
                        chunk_sizes.append(base + 1)
                    else:
                        chunk_sizes.append(base)
                
                final_sizes = []
                for size in chunk_sizes:
                    if size > self.MAX_CHUNK_SIZE:
                        sub_chunks = (size + self.MAX_CHUNK_SIZE - 1) // self.MAX_CHUNK_SIZE
                        sub_base = size // sub_chunks
                        sub_rem = size % sub_chunks
                        
                        for j in range(sub_chunks):
                            if j < sub_rem:
                                final_sizes.append(sub_base + 1)
                            else:
                                final_sizes.append(sub_base)
                    else:
                        final_sizes.append(size)
                
                self.logs.append(f"   Chunk sizes: {final_sizes}")
                
                current_time = earliest_start
                
                for i, chunk_size in enumerate(final_sizes):
                    min_machine = min(range(self.num_machines), key=lambda m: machine_times[m])
                    start_time = max(current_time, machine_times[min_machine])
                    end_time = start_time + chunk_size
                    
                    # Check capacity (for visualization only)
                    if end_time > self.machine_capacity:
                        self.capacity_violations.append({
                            'job_id': job.id,
                            'job_name': job.name,
                            'machine': min_machine,
                            'chunk_size': chunk_size,
                            'exceeded_by': end_time - self.machine_capacity,
                            'start': start_time,
                            'end': end_time
                        })
                        self.logs.append(f"   ⚠️ Capacity warning on Machine {min_machine+1}")
                    
                    machine_times[min_machine] = end_time
                    machine_schedules[min_machine].append((job, start_time, end_time, chunk_size))
                    
                    self.logs.append(f"   Chunk {i+1}: Size={chunk_size}, Machine={min_machine+1}, Start={start_time}, End={end_time}")
                    current_time = end_time
            
            else:
                min_machine = min(range(self.num_machines), key=lambda m: machine_times[m])
                start_time = max(earliest_start, machine_times[min_machine])
                end_time = start_time + job.duration
                
                # Check capacity (for visualization only)
                if end_time > self.machine_capacity:
                    self.capacity_violations.append({
                        'job_id': job.id,
                        'job_name': job.name,
                        'machine': min_machine,
                        'chunk_size': job.duration,
                        'exceeded_by': end_time - self.machine_capacity,
                        'start': start_time,
                        'end': end_time
                    })
                    self.logs.append(f"   ⚠️ Capacity warning on Machine {min_machine+1}")
                
                machine_times[min_machine] = end_time
                machine_schedules[min_machine].append((job, start_time, end_time, job.duration))
                
                self.logs.append(f"   No splitting needed. Machine={min_machine+1}, Start={start_time}, End={end_time}")
        
        makespan = max(machine_times)
        self.best_makespan = makespan
        self.best_schedule = {'schedules': machine_schedules}
        
        self._analyze_schedule(machine_schedules, makespan)
        
        exec_time = time.time() - self.start_time
        eff, idle, tm, machine_loads = self._calc_stats()
        
        return ScheduleResult(
            success=True, makespan=makespan, execution_time=exec_time,
            schedule=self._build_final(), logs=self.logs, splits_info=self._calc_splits(),
            efficiency=eff, total_work=self.total_work, total_idle_time=idle,
            total_machine_time=tm, iterations=self.iterations,
            capacity_violations=self.capacity_violations,
            machine_loads=machine_loads
        )

    def _analyze_schedule(self, schedules, makespan):
        self.logs.append("\n📈 ===== SCHEDULE ANALYSIS =====")
        
        for machine_id, machine_schedule in enumerate(schedules):
            total_work = sum(size for _, _, _, size in machine_schedule)
            utilization = (total_work / makespan * 100) if makespan > 0 else 0
            
            self.logs.append(f"\nMachine {machine_id + 1}:")
            self.logs.append(f"  Total work: {total_work}")
            self.logs.append(f"  Utilization: {utilization:.1f}%")
            self.logs.append(f"  Capacity: {self.machine_capacity} units")
            self.logs.append(f"  Capacity usage: {min(100, (total_work/self.machine_capacity)*100):.1f}%")
            self.logs.append(f"  Tasks: {len(machine_schedule)}")
            
            if total_work > self.machine_capacity:
                exceed = total_work - self.machine_capacity
                self.logs.append(f"  ⚠️ WARNING: Exceeded capacity by {exceed:.1f} units")
            
            for job, start, end, size in machine_schedule:
                self.logs.append(f"    {job.name}: {start}-{end} ({size} units)")
        
        if self.capacity_violations:
            self.logs.append("\n⚠️ ===== CAPACITY VIOLATIONS =====")
            for violation in self.capacity_violations:
                self.logs.append(f"  ⚠️ Job {violation['job_name']} (ID: {violation['job_id']})")
                self.logs.append(f"    Machine {violation['machine'] + 1}: {violation['start']}-{violation['end']}")
                self.logs.append(f"    Exceeded capacity by {violation['exceeded_by']:.1f} units")

    def _topological_sort(self):
        visited = set()
        temp = set()
        result = []
        
        def dfs(job_id):
            if job_id in temp:
                return False
            if job_id in visited:
                return True
            
            temp.add(job_id)
            job = self.job_dict.get(job_id)
            
            if job:
                for dep_id in job.dependencies:
                    if not dfs(dep_id):
                        return False
            
            temp.remove(job_id)
            visited.add(job_id)
            result.append(self.job_dict[job_id])
            return True
        
        for job in self.jobs:
            if job.id not in visited:
                if not dfs(job.id):
                    return None
        
        return result

    def _calc_stats(self):
        if not self.best_schedule:
            return 0, 0, 0, [0, 0, 0]
        
        total_machine_time = self.best_makespan * 3
        total_work_time = 0
        machine_work = [0] * 3
        
        for machine_id, machine_schedule in enumerate(self.best_schedule['schedules']):
            for job, start, end, size in machine_schedule:
                total_work_time += size
                machine_work[machine_id] += size
        
        efficiency = (total_work_time / total_machine_time * 100) if total_machine_time > 0 else 0
        idle_time = total_machine_time - total_work_time
        
        machine_loads = []
        for work in machine_work:
            load_pct = (work / self.machine_capacity * 100) if self.machine_capacity > 0 else 0
            machine_loads.append(load_pct)
        
        return efficiency, idle_time, total_machine_time, machine_loads

    def _calc_splits(self):
        if not self.best_schedule:
            return {}
        
        splits = {}
        for machine_schedule in self.best_schedule['schedules']:
            for job, _, _, _ in machine_schedule:
                splits[job.id] = splits.get(job.id, 0) + 1
        return splits

    def _build_final(self):
        if not self.best_schedule:
            return [[] for _ in range(3)]
        
        final = [[] for _ in range(3)]
        job_chunks = {}
        
        for machine_id, machine_schedule in enumerate(self.best_schedule['schedules']):
            for job, start, end, size in machine_schedule:
                if job.id not in job_chunks:
                    job_chunks[job.id] = []
                job_chunks[job.id].append((machine_id, start, end, job, size))
        
        for job_id, chunks in job_chunks.items():
            chunks.sort(key=lambda x: x[1])
            total = len(chunks)
            
            for idx, (machine_id, start, end, job, size) in enumerate(chunks):
                final[machine_id].append(TaskChunk(
                    job=job,
                    machine=machine_id,
                    start=start,
                    end=end,
                    chunk_id=idx + 1,
                    total_chunks=total,
                    size=size
                ))
        
        for machine_schedule in final:
            machine_schedule.sort(key=lambda x: x.start)
        
        return final

    def _create_error_result(self, msg):
        return ScheduleResult(
            success=False, 
            makespan=0, 
            execution_time=time.time() - self.start_time, 
            schedule=[], 
            logs=[msg]
        )
    
    def _create_capacity_error_result(self, msg):
        return ScheduleResult(
            success=False,
            makespan=0,
            execution_time=time.time() - self.start_time,
            schedule=[],
            logs=[f"❌ {msg}"],
            error_message=msg
        )

# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.post("/api/solve")
async def solve_schedule(request: ScheduleRequest):
    try:
        # Always use 40 as capacity
        machine_capacity = 40
        
        if request.algorithm == "backtracking":
            solver = BacktrackingSolver(request.jobs, machine_capacity)
        else:
            solver = CulturalAlgorithm(request.jobs, machine_capacity)
        
        return solver.solve()
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def root():
    return {
        "message": "Job Scheduling API v16.0 - Strict Capacity Limits 🚫", 
        "version": "16.0",
        "machine_capacity": "40 units per machine (FIXED)",
        "notes": "Tasks exceeding 40 units will be rejected"
    }

if __name__ == "__main__":
    print("🚀 Starting Job Scheduling API v16.0")
    print("⚙️ Machine Capacity: 40 units per machine (FIXED)")
    print("🚫 Tasks > 40 units will be REJECTED")
    print("⛓️ Sequential chunk execution")
    print("📌 Tasks > 5 split into sequential chunks")
    uvicorn.run(app, host="0.0.0.0", port=8000)