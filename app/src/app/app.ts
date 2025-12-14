import { Component, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Subscription, interval } from 'rxjs';
import { SchedulePlotComponent } from './schedule-plot/schedule-plot';

export interface Job {
  id: number;
  name: string;
  duration: number;
  dependencies: number[];
  min_chunk_size: number;
}

export interface TaskChunk {
  job: Job;
  machine: number;
  start: number;
  end: number;
  chunk_id: number;
  total_chunks: number;
  size: number;
}

export interface CapacityViolation {
  job_id: number;
  job_name: string;
  machine: number;
  chunk_size: number;
  exceeded_by: number;
  start: number;
  end: number;
}

export interface ScheduleResult {
  success: boolean;
  makespan: number;
  execution_time: number;
  schedule: TaskChunk[][];
  logs: string[];
  iterations?: number;
  splits_info: { [key: number]: number };
  efficiency?: number;
  total_work?: number;
  total_idle_time?: number;
  total_machine_time?: number;
  performance_details?: any;
  performance_plot?: string;
  capacity_violations?: CapacityViolation[];
  machine_loads?: number[];
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule, SchedulePlotComponent],
  template: `
    <div class="container">
      <!-- Header -->
      <div class="header">
        <div class="header-content">
          <h1>
            <span class="icon">🏭</span>
            Smart Job Scheduling System
            <span class="version">v12.0</span>
          </h1>
          <p class="subtitle">Advanced scheduling with strict machine capacity limits</p>
        </div>
        
        <div class="badges-container">
          <div class="badge" [class.active]="algorithm === 'cultural'">
            <span class="badge-icon">🧬</span>
            <span>Cultural Algorithm</span>
          </div>
          <div class="badge" [class.active]="algorithm === 'backtracking'">
            <span class="badge-icon">🔍</span>
            <span>Backtracking</span>
          </div>
          <div class="badge capacity-badge" [class.exceeded]="hasCapacityViolations">
            <span class="badge-icon">⚡</span>
            <span>Capacity: 40 units</span>
            <span *ngIf="hasCapacityViolations" class="violation-count">
              ⚠️ {{ result?.capacity_violations?.length }}
            </span>
          </div>
          <div class="badge">
            <span class="badge-icon">📊</span>
            <span>Performance Plot</span>
          </div>
        </div>
      </div>

      <div class="main-layout">
        <!-- Left Panel: Configuration -->
        <div class="panel config-panel">
          <div class="card">
            <div class="card-header">
              <h3>
                <span class="icon">📋</span>
                Task Management
              </h3>
              <div class="card-stats">
                <span class="stat">{{ jobs.length }} tasks</span>
                <span class="stat">{{ totalDuration }} total units</span>
                <span class="stat" [class.warning]="totalDuration > 120">
                  {{ ((totalDuration / 120) * 100).toFixed(1) }}% capacity
                </span>
              </div>
            </div>
            
            <div class="card-body">
              <!-- Machine Capacity Display (FIXED AT 40) -->
              <div class="capacity-control">
                <label class="capacity-label">
                  <span class="label-icon">⚙️</span>
                  Machine Capacity:
                </label>
                <div class="capacity-display">
                  <span class="capacity-value">40</span>
                  <span class="capacity-unit">units (FIXED)</span>
                </div>
                <div class="capacity-info">
                  <span *ngIf="totalDuration > 120" class="capacity-warning-text">
                    ⚠️ Total work exceeds available capacity (120 units)!
                  </span>
                  <span *ngIf="totalDuration <= 120" class="capacity-ok-text">
                    ✓ Capacity sufficient for all tasks
                  </span>
                </div>
              </div>
              
              <button 
                (click)="addJob()" 
                class="btn btn-add" 
                [disabled]="isLoading"
                [class.disabled]="isLoading">
                <span class="btn-icon">➕</span>
                Add New Task
              </button>
              
              <div *ngIf="jobs.length === 0" class="empty-state">
                <div class="empty-icon">📭</div>
                <p>No tasks added yet</p>
                <small>Click "Add New Task" to get started</small>
              </div>
              
              <div class="jobs-list">
                <div *ngFor="let job of jobs; trackBy: trackByJobId" class="job-card"
                     [class.capacity-warning]="job.duration > 40">
                  <div class="job-header">
                    <div class="job-title">
                      <input 
                        [(ngModel)]="job.name" 
                        placeholder="Task name..." 
                        class="input-name"
                        [class.long-task]="job.duration > 5"
                        [class.exceeds-capacity]="job.duration > 40">
                      <span class="job-id">#{{ job.id }}</span>
                    </div>
                    <button 
                      (click)="removeJob(job.id)" 
                      class="btn-icon delete-btn"
                      title="Delete task">
                      🗑️
                    </button>
                  </div>
                  
                  <div class="job-details">
                    <div class="detail-row">
                      <label class="detail-label">
                        <span class="label-icon">⏱️</span>
                        Duration:
                      </label>
                      <div class="duration-controls">
                        <input 
                          type="range" 
                          [(ngModel)]="job.duration" 
                          min="1" 
                          max="100" 
                          class="duration-slider"
                          (change)="checkDuration(job)">
                        <span class="duration-value">{{ job.duration }}</span>
                        <span class="duration-unit">units</span>
                        <span *ngIf="job.duration > 40" class="capacity-alert">
                          ⚠️ Exceeds capacity!
                        </span>
                      </div>
                    </div>
                    
                    <div class="detail-row">
                      <label class="detail-label">
                        <span class="label-icon">🔗</span>
                        Dependencies:
                      </label>
                      <div class="deps-container">
                        <select 
                          multiple 
                          [(ngModel)]="job.dependencies" 
                          class="select-deps"
                          title="Select tasks that must complete before this one">
                          <option *ngFor="let other of getPossibleDependencies(job)" [value]="other.id">
                            {{ other.name }} (#{{ other.id }})
                          </option>
                        </select>
                        <div class="deps-badges">
                          <span *ngFor="let depId of job.dependencies" class="dep-badge">
                            {{ getJobName(depId) }}
                            <button (click)="removeDependency(job, depId)" class="dep-remove">×</button>
                          </span>
                          <span *ngIf="job.dependencies.length === 0" class="no-deps">
                            No dependencies
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div *ngIf="job.duration > 5" class="task-warning">
                      <span class="warning-icon">⚠️</span>
                      This task will be automatically split for better scheduling
                    </div>
                    
                    <div *ngIf="job.duration > 40" class="capacity-violation-warning">
                      <span class="warning-icon">❌</span>
                      <strong>ERROR:</strong> This task exceeds machine capacity (40 units)! It cannot be scheduled.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h3>
                <span class="icon">⚙️</span>
                Algorithm Settings
              </h3>
            </div>
            
            <div class="card-body">
              <div class="setting-group">
                <label class="setting-label">
                  <span class="label-icon">🤖</span>
                  Algorithm Type:
                </label>
                <div class="algorithm-options">
                  <button 
                    [class.active]="algorithm === 'backtracking'"
                    (click)="algorithm = 'backtracking'"
                    class="algo-btn">
                    <span class="algo-icon">🔍</span>
                    <div class="algo-info">
                      <strong>Backtracking</strong>
                      <small>Exact solution, best for small problems</small>
                    </div>
                  </button>
                  
                  <button 
                    [class.active]="algorithm === 'cultural'"
                    (click)="algorithm = 'cultural'"
                    class="algo-btn">
                    <span class="algo-icon">🧬</span>
                    <div class="algo-info">
                      <strong>Cultural Algorithm</strong>
                      <small>Heuristic, uses Belief Space learning</small>
                    </div>
                  </button>
                </div>
              </div>
              
              <div *ngIf="algorithm === 'cultural'" class="algo-description">
                <div class="description-header">
                  <span class="desc-icon">💡</span>
                  <strong>How it works:</strong>
                </div>
                <ul class="features-list">
                  <li>Uses <strong>Belief Space</strong> to track best solutions</li>
                  <li>Learns <strong>machine reputation</strong> patterns</li>
                  <li>Considers <strong>dependency constraints</strong></li>
                  <li><strong>REJECTS</strong> tasks exceeding 40 units capacity</li>
                  <li>Optimizes for <strong>minimum makespan</strong></li>
                </ul>
              </div>
              
              <div class="action-buttons">
                <button 
                  (click)="validateAndSolve()" 
                  class="btn btn-primary"
                  [disabled]="isLoading || jobs.length === 0"
                  [class.disabled]="isLoading || jobs.length === 0">
                  <span class="btn-icon">🚀</span>
                  {{ isLoading ? 'Optimizing...' : 'Generate Schedule' }}
                  <span *ngIf="jobs.length > 0" class="job-count">({{ jobs.length }} tasks)</span>
                </button>
                
                <button 
                  (click)="resetAll()" 
                  class="btn btn-secondary"
                  [disabled]="isLoading">
                  <span class="btn-icon">🔄</span>
                  Reset All
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Panel: Results -->
        <div class="panel results-panel">
          <!-- Error Message -->
          <div *ngIf="error" class="alert error">
            <div class="alert-header">
              <span class="alert-icon">❌</span>
              <strong>Error</strong>
            </div>
            <p>{{ error }}</p>
            <button (click)="error = null" class="alert-close">×</button>
          </div>

          <!-- Capacity Error Message -->
          <div *ngIf="result && !result.success && result.error_message" class="alert error">
            <div class="alert-header">
              <span class="alert-icon">🚫</span>
              <strong>Capacity Error</strong>
            </div>
            <p>{{ result.error_message }}</p>
            <p><strong>Action Required:</strong> Reduce task durations below 40 units or split large tasks.</p>
            <button (click)="error = null" class="alert-close">×</button>
          </div>

          <!-- Loading State -->
          <div *ngIf="isLoading" class="loading-state">
            <div class="loading-content">
              <div class="spinner"></div>
              <div class="loading-text">
                <h4>Optimizing Schedule...</h4>
                <p>Using {{ algorithm === 'cultural' ? 'Cultural Algorithm' : 'Backtracking' }} 
                   to find the best solution</p>
                <div class="loading-details">
                  <span class="loading-detail">
                    <span class="detail-icon">📊</span>
                    {{ jobs.length }} tasks
                  </span>
                  <span class="loading-detail">
                    <span class="detail-icon">⚙️</span>
                    Capacity: 40 units (FIXED)
                  </span>
                  <span class="loading-detail">
                    <span class="detail-icon">🔗</span>
                    {{ totalDependencies }} dependencies
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Results -->
          <div *ngIf="result && result.success && !isLoading" class="results-container">
            <!-- Statistics Cards -->
            <div class="stats-grid">
              <div class="stat-card primary">
                <div class="stat-content">
                  <div class="stat-icon">⏱️</div>
                  <div class="stat-info">
                    <div class="stat-label">Makespan</div>
                    <div class="stat-value">{{ result.makespan.toFixed(1) }}</div>
                    <div class="stat-unit">time units</div>
                  </div>
                </div>
              </div>
              
              <div class="stat-card success">
                <div class="stat-content">
                  <div class="stat-icon">📈</div>
                  <div class="stat-info">
                    <div class="stat-label">Efficiency</div>
                    <div class="stat-value">{{ (result.efficiency || 0).toFixed(1) }}%</div>
                    <div class="stat-unit">utilization</div>
                  </div>
                </div>
              </div>
              
              <div class="stat-card info">
                <div class="stat-content">
                  <div class="stat-icon">⚡</div>
                  <div class="stat-info">
                    <div class="stat-label">Execution Time</div>
                    <div class="stat-value">{{ result.execution_time.toFixed(3) }}s</div>
                    <div class="stat-unit">seconds</div>
                  </div>
                </div>
              </div>
              
              <div class="stat-card" [class.warning]="hasCapacityViolations" [class.success]="!hasCapacityViolations">
                <div class="stat-content">
                  <div class="stat-icon">
                    {{ hasCapacityViolations ? '⚠️' : '✅' }}
                  </div>
                  <div class="stat-info">
                    <div class="stat-label">Capacity Usage</div>
                    <div class="stat-unit">{{ hasCapacityViolations ? 'violations' : 'clean' }}</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Machine Load Indicators -->
            <div *ngIf="result.machine_loads" class="card load-card">
              <div class="card-header">
                <h3>
                  <span class="icon">📊</span>
                  Machine Load Distribution
                </h3>
              </div>
              <div class="card-body">
                <div class="load-bars">
                  <div *ngFor="let load of result.machine_loads; let i = index" 
                       class="load-bar-container">
                    <div class="load-label">
                      <span class="machine-icon">⚙️</span>
                      Machine {{ i + 1 }}
                    </div>
                    <div class="load-bar-wrapper">
                      <div class="load-bar-background">
                        <div class="load-bar-fill" 
                             [style.width]="(load > 100 ? 100 : load) + '%'"
                             [class.critical]="load > 100"
                             [class.high]="load > 80 && load <= 100"
                             [class.medium]="load > 50 && load <= 80"
                             [class.low]="load <= 50">
                          <span class="load-percentage">{{ load.toFixed(1) }}%</span>
                        </div>
                      </div>
                      <div class="load-stats">
                        <span class="load-stat">Capacity: 40 units</span>
                        <span class="load-stat" *ngIf="getMachineWork(i) > 0">
                          Work: {{ getMachineWork(i).toFixed(1) }} units
                        </span>
                        <span *ngIf="load > 100" class="load-warning">
                          ⚠️ Exceeds capacity!
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Gantt Chart -->
            <div class="card gantt-container">
              <div class="gantt-header">
                <h3>
                  <span class="icon">📅</span>
                  Gantt Chart Visualization
                </h3>
                <div class="gantt-controls">
                  <div class="animation-controls">
                    <button 
                      (click)="toggleAnimation()" 
                      class="control-btn"
                      [class.paused]="!showAnimation">
                      <span class="control-icon">
                        {{ showAnimation ? '⏸️' : '▶️' }}
                      </span>
                      {{ showAnimation ? 'Pause' : 'Play' }}
                    </button>
                    
                    <button 
                      (click)="resetAnimation()" 
                      class="control-btn secondary">
                      <span class="control-icon">🔁</span>
                      Reset
                    </button>
                    
                    <div class="speed-control">
                      <label>Speed:</label>
                      <input 
                        type="range" 
                        [(ngModel)]="animationSpeed" 
                        min="1" 
                        max="10" 
                        class="speed-slider">
                      <span class="speed-value">{{ animationSpeed }}x</span>
                    </div>
                  </div>
                  
                  <div class="time-control">
                    <div class="time-display">
                      <span class="time-label">Current Time:</span>
                      <span class="time-value">{{ currentTime.toFixed(1) }}</span>
                      <span class="time-separator">/</span>
                      <span class="time-total">{{ result.makespan }}</span>
                    </div>
                    <input 
                      type="range" 
                      [(ngModel)]="currentTime" 
                      [min]="0" 
                      [max]="result.makespan" 
                      step="0.1"
                      class="time-slider"
                      (input)="onTimeSliderChange()">
                  </div>
                </div>
              </div>
              
              <div class="gantt-body">
                <div class="timeline-header">
                  <div class="machine-label-header">Machine</div>
                  <div class="timeline-scale">
                    <span *ngFor="let tick of getTimeTicks(result.makespan)" 
                          class="time-tick"
                          [style.left]="(tick / result.makespan * 100) + '%'">
                      {{ tick }}
                    </span>
                    <!-- Capacity Line -->
                    <div class="capacity-line" 
                         [style.left]="(40 / result.makespan * 100) + '%'"
                         *ngIf="40 < result.makespan">
                      <div class="capacity-label">Capacity: 40</div>
                    </div>
                  </div>
                </div>
                
                <div class="machines-list">
                  <div *ngFor="let machine of result.schedule; let mId = index" 
                       class="machine-row">
                    <div class="machine-label">
                      <div class="machine-name">
                        <span class="machine-icon">⚙️</span>
                        Machine {{ mId + 1 }}
                      </div>
                      <div class="machine-stats">
                        <span class="machine-stat">
                          {{ countTasks(machine) }} tasks
                        </span>
                        <span class="machine-stat" [class.warning]="getMachineLoad(mId) > 100">
                          {{ getMachineLoad(mId).toFixed(1) }}% load
                        </span>
                      </div>
                    </div>
                    
                    <div class="timeline-track">
                      <div class="timeline-background"></div>
                      
                      <div *ngFor="let task of machine" 
                           class="task-block"
                           [class.active]="currentTime >= task.start && currentTime < task.end"
                           [class.completed]="currentTime >= task.end"
                           [class.split-task]="task.total_chunks > 1"
                           [class.capacity-violation]="isCapacityViolation(task)"
                           [style.left]="(task.start / result.makespan * 100) + '%'"
                           [style.width]="((task.end - task.start) / result.makespan * 100) + '%'"
                           [style.background]="getTaskColor(task.job.id)"
                           [title]="getTaskTooltip(task)">
                        <div class="task-content">
                          <span class="task-name">{{ task.job.name }}</span>
                          <span *ngIf="task.total_chunks > 1" class="chunk-badge">
                            Part {{ task.chunk_id }}/{{ task.total_chunks }}
                          </span>
                          <span *ngIf="isCapacityViolation(task)" class="violation-indicator">
                            ⚠️
                          </span>
                        </div>
                        <div class="task-times">
                          {{ task.start.toFixed(1) }} - {{ task.end.toFixed(1) }}
                        </div>
                      </div>
                      
                      <div class="current-time-line" 
                           [style.left]="(currentTime / result.makespan * 100) + '%'"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Performance Plot -->
            <app-schedule-plot 
              *ngIf="result.performance_plot" 
              [plotData]="result.performance_plot"
              [machineCapacity]="40"
              class="plot-section">
            </app-schedule-plot>

            <!-- Capacity Violations Details -->
            <div *ngIf="hasCapacityViolations" class="card violations-card">
              <div class="card-header warning">
                <h3>
                  <span class="icon">⚠️</span>
                  Capacity Violations Details
                  <span class="violations-count">({{ result.capacity_violations?.length }})</span>
                </h3>
              </div>
              <div class="card-body">
                <div class="violations-list">
                  <div *ngFor="let violation of result.capacity_violations" class="violation-item">
                    <div class="violation-header">
                      <span class="violation-job">{{ violation.job_name }}</span>
                      <span class="violation-machine">Machine {{ violation.machine + 1 }}</span>
                    </div>
                    <div class="violation-details">
                      <div class="detail-row">
                        <span class="detail-label">Time range:</span>
                        <span class="detail-value">{{ violation.start.toFixed(1) }} - {{ violation.end.toFixed(1) }}</span>
                      </div>
                      <div class="detail-row">
                        <span class="detail-label">Chunk size:</span>
                        <span class="detail-value">{{ violation.chunk_size }} units</span>
                      </div>
                      <div class="detail-row">
                        <span class="detail-label">Exceeded by:</span>
                        <span class="detail-value error">{{ violation.exceeded_by.toFixed(1) }} units</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="violation-note">
                  <span class="note-icon">💡</span>
                  <span>
                    These tasks exceeded the 40-unit machine capacity limit but were still scheduled.
                    Consider splitting large tasks or adjusting durations.
                  </span>
                </div>
              </div>
            </div>

            <!-- Logs -->
            <div class="card logs-card">
              <div class="logs-header">
                <h3>
                  <span class="icon">📝</span>
                  Execution Logs
                  <span class="logs-count">({{ result.logs.length }})</span>
                </h3>
                <button (click)="copyLogs()" class="btn-icon" title="Copy logs">
                  📋
                </button>
              </div>
              
              <div class="logs-container">
                <div *ngFor="let log of result.logs; let i = index" 
                     class="log-entry"
                     [class.error]="log.includes('❌') || log.includes('Error') || log.includes('CAPACITY VIOLATION')"
                     [class.warning]="log.includes('⚠️') || log.includes('Warning') || log.includes('Capacity')"
                     [class.success]="log.includes('✅') || log.includes('Success') || log.includes('clean')">
                  <span class="log-index">[{{ i + 1 | number:'3.0' }}]</span>
                  <span class="log-timestamp">{{ getLogTime(i) }}</span>
                  <span class="log-message" [innerHTML]="formatLog(log)"></span>
                </div>
              </div>
            </div>

            <!-- Splits Information -->
            <div *ngIf="result.splits_info" 
                 class="card splits-card">
              <h3>
                <span class="icon">🔀</span>
                Task Splits Information
              </h3>
              <div class="splits-grid">
                <div *ngFor="let jobId of getSplitJobIds()" class="split-info">
                  <div class="split-header">
                    <span class="split-job-name">{{ getJobName(jobId) }}</span>
                    <span class="split-count">
                      Split into {{ result.splits_info[jobId] }} parts
                    </span>
                  </div>
                  <div class="split-chunks">
                    <div *ngFor="let chunk of getJobChunks(jobId)" 
                         class="chunk-info"
                         [style.background]="getTaskColor(jobId)"
                         [class.capacity-violation]="isChunkCapacityViolation(chunk)">
                      <span class="chunk-machine">M{{ chunk.machine + 1 }}</span>
                      <span class="chunk-time">
                        {{ chunk.start.toFixed(1) }} - {{ chunk.end.toFixed(1) }}
                      </span>
                      <span class="chunk-part">Part {{ chunk.chunk_id }}</span>
                      <span *ngIf="isChunkCapacityViolation(chunk)" class="chunk-violation">⚠️</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty Results State -->
          <div *ngIf="!result && !isLoading && !error" class="empty-results">
            <div class="empty-content">
              <div class="empty-icon">📊</div>
              <h3>No Schedule Generated Yet</h3>
              <p>Add tasks and click "Generate Schedule" to see the optimized plan</p>
              <div class="empty-tips">
                <div class="tip">
                  <span class="tip-icon">💡</span>
                  <strong>Important:</strong> No task can exceed 40 units duration
                </div>
                <div class="tip">
                  <span class="tip-icon">⚙️</span>
                  <strong>Capacity:</strong> Each machine has a FIXED capacity of 40 units
                </div>
                <div class="tip">
                  <span class="tip-icon">⚡</span>
                  <strong>Fast:</strong> Cultural Algorithm works best for large problems
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="footer">
        <div class="footer-content">
          <div class="footer-info">
            <span class="footer-text">Smart Job Scheduling System v12.0</span>
            <span class="footer-separator">•</span>
            <span class="footer-text">Using {{ algorithm === 'cultural' ? 'Cultural Algorithm' : 'Backtracking' }}</span>
            <span class="footer-separator">•</span>
            <span class="footer-text">{{ jobs.length }} tasks loaded</span>
            <span class="footer-separator">•</span>
            <span class="footer-text">
              <strong>Capacity:</strong> 40 units per machine (FIXED)
            </span>
          </div>
          <div class="footer-actions">
            <button (click)="exportSchedule()" class="footer-btn">
              <span class="footer-icon">💾</span>
              Export
            </button>
            <button (click)="printSchedule()" class="footer-btn">
              <span class="footer-icon">🖨️</span>
              Print
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* Global Styles */
    :host {
      --primary-color: #4361ee;
      --primary-dark: #3a56d4;
      --secondary-color: #7209b7;
      --success-color: #4cc9f0;
      --warning-color: #f72585;
      --danger-color: #f94144;
      --info-color: #4895ef;
      --light-color: #f8f9fa;
      --dark-color: #212529;
      --gray-100: #f8f9fa;
      --gray-200: #e9ecef;
      --gray-300: #dee2e6;
      --gray-400: #ced4da;
      --gray-500: #adb5bd;
      --gray-600: #6c757d;
      --gray-700: #495057;
      --gray-800: #343a40;
      --gray-900: #212529;
      
      --border-radius: 12px;
      --box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
      --transition: all 0.3s ease;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    
    .container {
      max-width: 1600px;
      margin: 0 auto;
      background: white;
      border-radius: var(--border-radius);
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
      overflow: hidden;
    }
    
    /* Header */
    .header {
      background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
      color: white;
      padding: 30px 40px;
      position: relative;
      overflow: hidden;
    }
    
    .header::before {
      content: '';
      position: absolute;
      top: 0;
      right: 0;
      width: 300px;
      height: 300px;
      background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
    }
    
    .header-content h1 {
      font-size: 2.8rem;
      font-weight: 800;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 15px;
    }
    
    .header-content .icon {
      font-size: 3rem;
    }
    
    .header-content .version {
      background: rgba(255, 255, 255, 0.2);
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 1rem;
      font-weight: 600;
      margin-left: 10px;
    }
    
    .subtitle {
      font-size: 1.1rem;
      opacity: 0.9;
      max-width: 600px;
    }
    
    .badges-container {
      display: flex;
      gap: 15px;
      margin-top: 25px;
      flex-wrap: wrap;
    }
    
    .badge {
      background: rgba(255, 255, 255, 0.15);
      padding: 10px 20px;
      border-radius: 25px;
      display: flex;
      align-items: center;
      gap: 10px;
      transition: var(--transition);
      border: 2px solid transparent;
    }
    
    .badge.active {
      background: rgba(255, 255, 255, 0.3);
      border-color: white;
      transform: translateY(-2px);
    }
    
    .badge.capacity-badge {
      background: linear-gradient(135deg, rgba(76, 201, 240, 0.3), rgba(67, 97, 238, 0.3));
    }
    
    .badge.capacity-badge.exceeded {
      background: linear-gradient(135deg, rgba(249, 65, 68, 0.3), rgba(247, 37, 133, 0.3));
      animation: pulse 2s infinite;
    }
    
    .badge-icon {
      font-size: 1.2rem;
    }
    
    .violation-count {
      background: rgba(255, 255, 255, 0.3);
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.8rem;
      font-weight: bold;
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
    
    /* Main Layout */
    .main-layout {
      display: grid;
      grid-template-columns: 1fr 2fr;
      min-height: calc(100vh - 200px);
    }
    
    .panel {
      padding: 30px;
      overflow-y: auto;
    }
    
    .config-panel {
      border-right: 1px solid var(--gray-200);
      background: var(--gray-100);
    }
    
    .results-panel {
      background: white;
    }
    
    /* Cards */
    .card {
      background: white;
      border-radius: var(--border-radius);
      box-shadow: var(--box-shadow);
      margin-bottom: 25px;
      overflow: hidden;
      border: 1px solid var(--gray-200);
    }
    
    .card-header {
      background: linear-gradient(135deg, var(--primary-color), var(--primary-dark));
      color: white;
      padding: 20px 25px;
    }
    
    .card-header h3 {
      margin: 0;
      font-size: 1.3rem;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .card-stats {
      display: flex;
      gap: 15px;
      margin-top: 10px;
    }
    
    .stat {
      background: rgba(255, 255, 255, 0.2);
      padding: 5px 12px;
      border-radius: 15px;
      font-size: 0.9rem;
    }
    
    .stat.warning {
      background: rgba(247, 37, 133, 0.3);
    }
    
    .card-body {
      padding: 25px;
    }
    
    /* Capacity Control */
    .capacity-control {
      background: linear-gradient(135deg, rgba(67, 97, 238, 0.05), rgba(114, 9, 183, 0.05));
      padding: 20px;
      border-radius: 10px;
      margin-bottom: 25px;
      border: 2px solid var(--gray-200);
    }
    
    .capacity-label {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 600;
      color: var(--gray-800);
      margin-bottom: 15px;
    }
    
    .capacity-input-group {
      display: flex;
      align-items: center;
      gap: 15px;
      margin-bottom: 10px;
    }
    
    .capacity-slider {
      flex: 1;
      height: 6px;
      border-radius: 3px;
      background: var(--gray-300);
      outline: none;
      -webkit-appearance: none;
    }
    
    .capacity-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--primary-color);
      cursor: pointer;
      border: 3px solid white;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    }
    
    .capacity-value {
      font-weight: 700;
      color: var(--primary-color);
      min-width: 30px;
      font-size: 1.2rem;
    }
    
    .capacity-unit {
      color: var(--gray-600);
      font-size: 0.9rem;
    }
    
    .capacity-info {
      font-size: 0.9rem;
      padding: 8px 12px;
      border-radius: 6px;
    }
    
    .capacity-warning-text {
      color: var(--danger-color);
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .capacity-ok-text {
      color: var(--success-color);
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    /* Buttons */
    .btn {
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: var(--transition);
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 0.95rem;
    }
    
    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
    }
    
    .btn:active {
      transform: translateY(0);
    }
    
    .btn-primary {
      background: linear-gradient(135deg, var(--primary-color), var(--primary-dark));
      color: white;
    }
    
    .btn-secondary {
      background: var(--gray-200);
      color: var(--gray-800);
    }
    
    .btn-add {
      background: linear-gradient(135deg, var(--success-color), #3db5d8);
      color: white;
      width: 100%;
      justify-content: center;
      margin-bottom: 20px;
    }
    
    .btn-icon {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 1.2rem;
      padding: 5px;
      border-radius: 4px;
      transition: var(--transition);
    }
    
    .btn-icon:hover {
      background: var(--gray-200);
    }
    
    /* Empty States */
    .empty-state, .empty-results {
      text-align: center;
      padding: 40px 20px;
      color: var(--gray-600);
    }
    
    .empty-icon {
      font-size: 4rem;
      margin-bottom: 20px;
      opacity: 0.5;
    }
    
    .empty-tips {
      display: flex;
      flex-direction: column;
      gap: 15px;
      margin-top: 25px;
    }
    
    .tip {
      background: var(--gray-100);
      padding: 15px;
      border-radius: 8px;
      text-align: left;
      display: flex;
      gap: 10px;
    }
    
    .tip-icon {
      font-size: 1.2rem;
    }
    
    /* Jobs List */
    .jobs-list {
      display: flex;
      flex-direction: column;
      gap: 15px;
    }
    
    .job-card {
      background: white;
      border: 2px solid var(--gray-200);
      border-radius: 10px;
      padding: 20px;
      transition: var(--transition);
    }
    
    .job-card.capacity-warning {
      border-color: var(--danger-color);
      background: linear-gradient(135deg, rgba(249, 65, 68, 0.05), rgba(255, 255, 255, 0.95));
    }
    
    .job-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.05);
    }
    
    .job-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }
    
    .job-title {
      display: flex;
      align-items: center;
      gap: 10px;
      flex: 1;
    }
    
    .input-name {
      flex: 1;
      padding: 8px 12px;
      border: 2px solid var(--gray-300);
      border-radius: 6px;
      font-size: 1rem;
    }
    
    .input-name.exceeds-capacity {
      border-color: var(--danger-color);
      background: rgba(249, 65, 68, 0.05);
    }
    
    .job-id {
      background: var(--gray-200);
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.8rem;
      font-weight: 600;
    }
    
    .delete-btn {
      color: var(--danger-color);
    }
    
    /* Job Details */
    .job-details {
      display: flex;
      flex-direction: column;
      gap: 15px;
    }
    
    .detail-row {
      display: flex;
      align-items: center;
      gap: 15px;
    }
    
    .detail-label {
      width: 120px;
      font-weight: 600;
      color: var(--gray-700);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .duration-controls {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .duration-slider {
      flex: 1;
      height: 6px;
      border-radius: 3px;
      background: var(--gray-300);
      outline: none;
      -webkit-appearance: none;
    }
    
    .duration-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: var(--primary-color);
      cursor: pointer;
    }
    
    .duration-value {
      font-weight: 700;
      min-width: 25px;
    }
    
    .duration-unit {
      color: var(--gray-600);
      font-size: 0.9rem;
    }
    
    .capacity-alert {
      color: var(--danger-color);
      font-weight: 600;
      font-size: 0.8rem;
      background: rgba(249, 65, 68, 0.1);
      padding: 2px 8px;
      border-radius: 10px;
    }
    
    /* Dependencies */
    .deps-container {
      flex: 1;
    }
    
    .select-deps {
      width: 100%;
      height: 80px;
      border: 2px solid var(--gray-300);
      border-radius: 6px;
      padding: 8px;
      font-size: 0.9rem;
    }
    
    .deps-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 10px;
    }
    
    .dep-badge {
      background: linear-gradient(135deg, var(--info-color), #3a7bd5);
      color: white;
      padding: 4px 10px;
      border-radius: 15px;
      font-size: 0.8rem;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    
    .dep-remove {
      background: rgba(255, 255, 255, 0.3);
      border: none;
      color: white;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 0.7rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .no-deps {
      color: var(--gray-500);
      font-style: italic;
    }
    
    /* Warnings */
    .task-warning, .capacity-violation-warning {
      padding: 10px 15px;
      border-radius: 8px;
      font-size: 0.9rem;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .task-warning {
      background: linear-gradient(135deg, rgba(255, 193, 7, 0.1), rgba(255, 255, 255, 0.95));
      color: #856404;
      border-left: 4px solid #ffc107;
    }
    
    .capacity-violation-warning {
      background: linear-gradient(135deg, rgba(249, 65, 68, 0.1), rgba(255, 255, 255, 0.95));
      color: var(--danger-color);
      border-left: 4px solid var(--danger-color);
      margin-top: 10px;
    }
    
    .warning-icon {
      font-size: 1.2rem;
    }
    
    /* Algorithm Settings */
    .setting-group {
      margin-bottom: 25px;
    }
    
    .setting-label {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 600;
      color: var(--gray-800);
      margin-bottom: 15px;
    }
    
    .algorithm-options {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
    }
    
    .algo-btn {
      background: var(--gray-100);
      border: 2px solid var(--gray-300);
      border-radius: 10px;
      padding: 15px;
      cursor: pointer;
      transition: var(--transition);
      text-align: left;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .algo-btn:hover {
      background: var(--gray-200);
      transform: translateY(-2px);
    }
    
    .algo-btn.active {
      background: linear-gradient(135deg, rgba(67, 97, 238, 0.1), rgba(114, 9, 183, 0.1));
      border-color: var(--primary-color);
    }
    
    .algo-icon {
      font-size: 1.5rem;
    }
    
    .algo-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    
    .algo-info strong {
      font-size: 1rem;
    }
    
    .algo-info small {
      color: var(--gray-600);
      font-size: 0.8rem;
    }
    
    .algo-description {
      background: var(--gray-100);
      padding: 20px;
      border-radius: 10px;
      margin: 20px 0;
    }
    
    .description-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 15px;
    }
    
    .features-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .features-list li {
      padding: 5px 0;
      color: var(--gray-700);
    }
    
    .action-buttons {
      display: flex;
      gap: 15px;
      margin-top: 30px;
    }
    
    .btn.disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    
    .btn.disabled:hover {
      transform: none;
      box-shadow: none;
    }
    
    .job-count {
      margin-left: 8px;
      opacity: 0.8;
    }
    
    /* Alerts */
    .alert {
      padding: 20px;
      border-radius: 10px;
      margin-bottom: 25px;
      position: relative;
    }
    
    .alert.error {
      background: linear-gradient(135deg, rgba(249, 65, 68, 0.1), rgba(255, 255, 255, 0.95));
      border: 2px solid var(--danger-color);
    }
    
    .alert-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }
    
    .alert-close {
      position: absolute;
      top: 15px;
      right: 15px;
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: var(--gray-600);
    }
    
    /* Loading State */
    .loading-state {
      background: rgba(255, 255, 255, 0.9);
      padding: 40px;
      border-radius: 10px;
      text-align: center;
    }
    
    .loading-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 25px;
    }
    
    .spinner {
      width: 60px;
      height: 60px;
      border: 4px solid var(--gray-300);
      border-top: 4px solid var(--primary-color);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    .loading-details {
      display: flex;
      gap: 20px;
      margin-top: 15px;
    }
    
    .loading-detail {
      background: var(--gray-100);
      padding: 8px 15px;
      border-radius: 20px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    /* Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    
    .stat-card {
      background: white;
      border-radius: 12px;
      padding: 25px;
      box-shadow: var(--box-shadow);
      transition: var(--transition);
    }
    
    .stat-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
    }
    
    .stat-card.primary {
      background: linear-gradient(135deg, var(--primary-color), var(--primary-dark));
      color: white;
    }
    
    .stat-card.success {
      background: linear-gradient(135deg, var(--success-color), #3db5d8);
      color: white;
    }
    
    .stat-card.info {
      background: linear-gradient(135deg, var(--info-color), #3a7bd5);
      color: white;
    }
    
    .stat-card.warning {
      background: linear-gradient(135deg, #f94144, #e63946);
      color: white;
    }
    
    .stat-content {
      display: flex;
      align-items: center;
      gap: 20px;
    }
    
    .stat-icon {
      font-size: 2.5rem;
    }
    
    .stat-label {
      font-size: 0.9rem;
      opacity: 0.9;
      margin-bottom: 5px;
    }
    
    .stat-value {
      font-size: 2rem;
      font-weight: 800;
      line-height: 1;
    }
    
    .stat-unit {
      font-size: 0.8rem;
      opacity: 0.8;
      margin-top: 5px;
    }
    
    /* Load Card */
    .load-card .card-header {
      background: linear-gradient(135deg, #4895ef 0%, #3a7bd5 100%);
    }
    
    .load-bars {
      display: flex;
      flex-direction: column;
      gap: 25px;
    }
    
    .load-bar-container {
      display: flex;
      align-items: center;
      gap: 20px;
    }
    
    .load-label {
      width: 150px;
      font-weight: 600;
      color: var(--gray-800);
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .load-bar-wrapper {
      flex: 1;
    }
    
    .load-bar-background {
      height: 30px;
      background: var(--gray-200);
      border-radius: 15px;
      overflow: hidden;
      position: relative;
    }
    
    .load-bar-fill {
      height: 100%;
      border-radius: 15px;
      transition: width 0.5s ease;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .load-bar-fill.low {
      background: linear-gradient(135deg, #4cc9f0, #3db5d8);
    }
    
    .load-bar-fill.medium {
      background: linear-gradient(135deg, #4895ef, #3a7bd5);
    }
    
    .load-bar-fill.high {
      background: linear-gradient(135deg, #f8961e, #e07e0e);
    }
    
    .load-bar-fill.critical {
      background: linear-gradient(135deg, #f94144, #e63946);
      animation: pulse 2s infinite;
    }
    
    .load-percentage {
      color: white;
      font-weight: 600;
      font-size: 0.9rem;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    }
    
    .load-stats {
      display: flex;
      justify-content: space-between;
      margin-top: 5px;
      font-size: 0.8rem;
      color: var(--gray-600);
    }
    
    /* Gantt Chart */
    .gantt-container {
      margin-bottom: 30px;
    }
    
    .gantt-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 20px;
      margin-bottom: 25px;
    }
    
    .gantt-controls {
      display: flex;
      flex-direction: column;
      gap: 15px;
      width: 100%;
    }
    
    .animation-controls {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
    }
    
    .control-btn {
      padding: 8px 16px;
      background: var(--primary-color);
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.9rem;
    }
    
    .control-btn.secondary {
      background: var(--gray-200);
      color: var(--gray-800);
    }
    
    .speed-control {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-left: auto;
    }
    
    .speed-slider {
      width: 100px;
    }
    
    .speed-value {
      font-weight: 600;
      min-width: 30px;
    }
    
    .time-control {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    
    .time-display {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .time-slider {
      width: 100%;
    }
    
    .gantt-body {
      background: white;
      border-radius: 8px;
      overflow: auto;
    }
    
    .timeline-header {
      display: flex;
      background: var(--gray-100);
      border-bottom: 2px solid var(--gray-300);
      position: relative;
      height: 60px;
    }
    
    .machine-label-header {
      width: 200px;
      padding: 20px;
      font-weight: 600;
      color: var(--gray-700);
      display: flex;
      align-items: center;
    }
    
    .timeline-scale {
      flex: 1;
      position: relative;
      min-width: 800px;
    }
    
    .time-tick {
      position: absolute;
      top: 10px;
      transform: translateX(-50%);
      font-size: 0.8rem;
      color: var(--gray-600);
    }
    
    /* Capacity Line in Gantt */
    .capacity-line {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 2px;
      background: var(--danger-color);
      z-index: 2;
      transform: translateX(-50%);
    }
    
    .capacity-line::before {
      content: '';
      position: absolute;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
      border-top: 10px solid var(--danger-color);
    }
    
    .capacity-label {
      position: absolute;
      top: -25px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--danger-color);
      color: white;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.8rem;
      font-weight: 600;
      white-space: nowrap;
    }
    
    /* Machines List */
    .machines-list {
      display: flex;
      flex-direction: column;
    }
    
    .machine-row {
      display: flex;
      min-height: 80px;
      border-bottom: 1px solid var(--gray-200);
    }
    
    .machine-row:last-child {
      border-bottom: none;
    }
    
    .machine-label {
      width: 200px;
      padding: 20px;
      background: var(--gray-50);
      border-right: 1px solid var(--gray-200);
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    
    .machine-name {
      font-weight: 600;
      color: var(--gray-800);
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
    }
    
    .machine-stats {
      display: flex;
      gap: 10px;
      font-size: 0.8rem;
    }
    
    .machine-stat {
      background: var(--gray-200);
      padding: 3px 8px;
      border-radius: 10px;
    }
    
    .machine-stat.warning {
      background: rgba(249, 65, 68, 0.1);
      color: var(--danger-color);
    }
    
    .timeline-track {
      flex: 1;
      position: relative;
      min-width: 800px;
      padding: 20px 0;
    }
    
    .timeline-background {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      right: 0;
      background: repeating-linear-gradient(
        90deg,
        transparent,
        transparent 49px,
        var(--gray-100) 49px,
        var(--gray-100) 50px
      );
    }
    
    .task-block {
      position: absolute;
      top: 10px;
      height: 60px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      transition: all 0.3s ease;
      overflow: hidden;
      z-index: 1;
      border: 2px solid transparent;
    }
    
    .task-block:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 20px rgba(0, 0, 0, 0.15);
      z-index: 2;
    }
    
    .task-block.active {
      border-color: white;
      box-shadow: 0 0 0 3px var(--primary-color);
    }
    
    .task-block.completed {
      opacity: 0.8;
    }
    
    .task-block.split-task {
      border-style: dashed;
    }
    
    .task-block.capacity-violation {
      border: 2px dashed white;
      box-shadow: 0 0 0 2px var(--danger-color);
    }
    
    .task-content {
      padding: 10px 12px;
      color: white;
      height: 100%;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    
    .task-name {
      font-weight: 600;
      font-size: 0.9rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
    }
    
    .chunk-badge {
      background: rgba(255, 255, 255, 0.3);
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.7rem;
      font-weight: 600;
    }
    
    .violation-indicator {
      background: rgba(255, 255, 255, 0.3);
      padding: 2px 6px;
      border-radius: 10px;
      font-size: 0.8rem;
      margin-left: auto;
    }
    
    .task-times {
      position: absolute;
      bottom: 5px;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 0.7rem;
      opacity: 0.9;
      color: white;
    }
    
    .current-time-line {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 3px;
      background: var(--danger-color);
      z-index: 3;
      pointer-events: none;
    }
    
    .current-time-line::before {
      content: '';
      position: absolute;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-top: 12px solid var(--danger-color);
    }
    
    /* Plot Section */
    .plot-section {
      margin-bottom: 30px;
    }
    
    /* Violations Card */
    .violations-card .card-header.warning {
      background: linear-gradient(135deg, #f94144 0%, #e63946 100%);
    }
    
    .violations-count {
      background: rgba(255, 255, 255, 0.3);
      padding: 2px 10px;
      border-radius: 10px;
      font-size: 0.9rem;
      margin-left: 10px;
    }
    
    .violations-list {
      display: flex;
      flex-direction: column;
      gap: 15px;
    }
    
    .violation-item {
      background: linear-gradient(135deg, rgba(249, 65, 68, 0.05), rgba(255, 255, 255, 0.95));
      border: 1px solid rgba(249, 65, 68, 0.2);
      border-radius: 10px;
      padding: 20px;
    }
    
    .violation-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 1px solid rgba(249, 65, 68, 0.1);
    }
    
    .violation-job {
      font-weight: 600;
      color: var(--danger-color);
      font-size: 1.1rem;
    }
    
    .violation-machine {
      background: var(--danger-color);
      color: white;
      padding: 5px 12px;
      border-radius: 15px;
      font-size: 0.9rem;
      font-weight: 600;
    }
    
    .violation-details {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 10px;
    }
    
    .detail-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .detail-label {
      color: var(--gray-600);
      font-size: 0.9rem;
    }
    
    .detail-value {
      font-weight: 600;
      color: var(--gray-800);
    }
    
    .detail-value.error {
      color: var(--danger-color);
    }
    
    .violation-note {
      margin-top: 20px;
      padding: 15px;
      background: linear-gradient(135deg, rgba(255, 193, 7, 0.1), rgba(255, 255, 255, 0.95));
      border-radius: 8px;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      font-size: 0.9rem;
      color: var(--gray-700);
    }
    
    /* Logs Card */
    .logs-card {
      margin-bottom: 30px;
    }
    
    .logs-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .logs-count {
      font-size: 0.9rem;
      opacity: 0.7;
      margin-left: 8px;
    }
    
    .logs-container {
      max-height: 300px;
      overflow-y: auto;
      background: var(--gray-50);
      border-radius: 8px;
      padding: 15px;
    }
    
    .log-entry {
      padding: 10px 15px;
      margin-bottom: 8px;
      border-radius: 6px;
      background: white;
      font-family: 'Courier New', monospace;
      font-size: 0.9rem;
      display: flex;
      gap: 15px;
      align-items: center;
    }
    
    .log-entry.error {
      background: linear-gradient(135deg, rgba(249, 65, 68, 0.1), rgba(255, 255, 255, 0.95));
      border-left: 4px solid var(--danger-color);
    }
    
    .log-entry.warning {
      background: linear-gradient(135deg, rgba(255, 193, 7, 0.1), rgba(255, 255, 255, 0.95));
      border-left: 4px solid #ffc107;
    }
    
    .log-entry.success {
      background: linear-gradient(135deg, rgba(76, 201, 240, 0.1), rgba(255, 255, 255, 0.95));
      border-left: 4px solid var(--success-color);
    }
    
    .log-index {
      color: var(--gray-500);
      font-weight: 600;
      min-width: 40px;
    }
    
    .log-timestamp {
      color: var(--primary-color);
      font-weight: 600;
      min-width: 60px;
    }
    
    .log-message {
      flex: 1;
    }
    
    /* Splits Card */
    .splits-card {
      padding: 25px;
    }
    
    .splits-grid {
      display: flex;
      flex-direction: column;
      gap: 20px;
      margin-top: 20px;
    }
    
    .split-info {
      background: var(--gray-100);
      border-radius: 10px;
      padding: 20px;
    }
    
    .split-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--gray-300);
    }
    
    .split-job-name {
      font-weight: 600;
      color: var(--gray-800);
    }
    
    .split-count {
      background: var(--primary-color);
      color: white;
      padding: 5px 12px;
      border-radius: 15px;
      font-size: 0.9rem;
    }
    
    .split-chunks {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    
    .chunk-info {
      background: var(--gray-200);
      padding: 10px 15px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 0.9rem;
      color: white;
    }
    
    .chunk-info.capacity-violation {
      border: 2px dashed rgba(249, 65, 68, 0.5);
      box-shadow: 0 2px 8px rgba(249, 65, 68, 0.2);
    }
    
    .chunk-machine {
      font-weight: 600;
    }
    
    .chunk-violation {
      background: var(--danger-color);
      color: white;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.8rem;
      margin-left: auto;
    }
    
    /* Footer */
    .footer {
      background: var(--gray-900);
      color: white;
      padding: 20px 40px;
    }
    
    .footer-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 20px;
    }
    
    .footer-info {
      display: flex;
      align-items: center;
      gap: 15px;
      flex-wrap: wrap;
    }
    
    .footer-separator {
      opacity: 0.5;
    }
    
    .footer-text.warning {
      color: #ff6b6b;
      font-weight: 600;
      animation: pulse 2s infinite;
    }
    
    .footer-actions {
      display: flex;
      gap: 10px;
    }
    
    .footer-btn {
      background: rgba(255, 255, 255, 0.1);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.2);
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: var(--transition);
    }
    
    .footer-btn:hover {
      background: rgba(255, 255, 255, 0.2);
    }
    
    /* Responsive Design */
    @media (max-width: 1200px) {
      .main-layout {
        grid-template-columns: 1fr;
      }
      
      .config-panel {
        border-right: none;
        border-bottom: 1px solid var(--gray-200);
      }
      
      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
      }
      
      .algorithm-options {
        grid-template-columns: 1fr;
      }
    }
    
    @media (max-width: 768px) {
      .header-content h1 {
        font-size: 2rem;
      }
      
      .stats-grid {
        grid-template-columns: 1fr;
      }
      
      .detail-row {
        flex-direction: column;
        align-items: flex-start;
      }
      
      .duration-controls {
        width: 100%;
      }
      
      .animation-controls {
        flex-direction: column;
        align-items: stretch;
      }
      
      .speed-control {
        margin-left: 0;
        justify-content: space-between;
      }
      
      .footer-content {
        flex-direction: column;
        gap: 15px;
        text-align: center;
      }
    }
    
    /* Utility Classes */
    .disabled {
      opacity: 0.6;
      cursor: not-allowed !important;
    }
    
    .disabled:hover::before {
      width: 0;
      height: 0;
    }
    
    /* Colors for tasks */
    .task-color-1 { background: linear-gradient(135deg, #4361ee, #3a56d4); }
    .task-color-2 { background: linear-gradient(135deg, #7209b7, #5a0b9c); }
    .task-color-3 { background: linear-gradient(135deg, #f72585, #d41a6d); }
    .task-color-4 { background: linear-gradient(135deg, #4cc9f0, #3db5d8); }
    .task-color-5 { background: linear-gradient(135deg, #4895ef, #3a7bd5); }
    .task-color-6 { background: linear-gradient(135deg, #560bad, #480ca8); }
    .task-color-7 { background: linear-gradient(135deg, #b5179e, #9c1490); }
    .task-color-8 { background: linear-gradient(135deg, #f94144, #e63946); }
    .task-color-9 { background: linear-gradient(135deg, #f8961e, #e07e0e); }
    .task-color-10 { background: linear-gradient(135deg, #90be6d, #7db357); }
  `]
})
export class App implements OnDestroy {
  jobs: Job[] = [];
  
  algorithm: 'backtracking' | 'cultural' = 'cultural';
  result: ScheduleResult | null | any = null;
  isLoading = false;
  error: string | null = null;
  machineCapacity = 40; // FIXED - لا يمكن تغييره
  
  // Animation
  showAnimation = false;
  currentTime = 0;
  animationSpeed = 3;
  animationInterval: any;
  private animationSubscription?: Subscription;
  
  // Colors for tasks
  private taskColors: string[] = [
    '#4361ee', '#7209b7', '#f72585', '#4cc9f0', '#4895ef',
    '#560bad', '#b5179e', '#f94144', '#f8961e', '#90be6d'
  ];

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  // Getters
  get totalDuration(): number {
    return this.jobs.reduce((sum, job) => sum + job.duration, 0);
  }

  get totalDependencies(): number {
    return this.jobs.reduce((sum, job) => sum + job.dependencies.length, 0);
  }

  get hasCapacityViolations(): boolean {
    return !!(this.result?.capacity_violations && this.result.capacity_violations.length > 0);
  }

  getJobName(jobId: number): string {
    const job = this.jobs.find(j => j.id === jobId);
    return job ? job.name : `Task ${jobId}`;
  }

  getTaskColor(jobId: number): string {
    const index = jobId % this.taskColors.length;
    return this.taskColors[index];
  }

getTaskTooltip(task: TaskChunk): string {
  const job = task.job;
  
  // الحصول على أسماء الـ dependencies
  const dependencyNames = job.dependencies
    .map(depId => {
      const depJob = this.jobs.find(j => j.id === depId);
      return depJob ? `${depJob.name} (#${depJob.id})` : `Task ${depId}`;
    });
  
  // الحصول على المهام التي تعتمد على هذه المهمة
  const dependentOnThis = this.jobs
    .filter(j => j.dependencies.includes(job.id))
    .map(j => `${j.name} (#${j.id})`);
  
  let tooltip = `
<b>${job.name}</b> (ID: ${job.id})
Part ${task.chunk_id}/${task.total_chunks}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Duration: ${(task.end - task.start).toFixed(1)} units
• Chunk Size: ${task.size} units
• Machine: Machine ${task.machine + 1}
• Time: ${task.start.toFixed(1)} → ${task.end.toFixed(1)}
• Capacity Limit: 40 units
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<u>DEPENDENCIES</u> (must finish first):
`;
  
  if (dependencyNames.length > 0) {
    dependencyNames.forEach((dep, index) => {
      tooltip += `  ${index + 1}. ${dep}\n`;
    });
  } else {
    tooltip += "  • No dependencies\n";
  }
  
  if (dependentOnThis.length > 0) {
    dependentOnThis.forEach((dep, index) => {
      tooltip += `  ${index + 1}. ${dep}\n`;
    });
  } else {
    tooltip += "  • No tasks depend on this\n";
  }
  
  tooltip += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
  
  if (this.isCapacityViolation(task)) {
    tooltip += "❌ <b>EXCEEDS MACHINE CAPACITY</b>";
  } else {
    tooltip += "✅ <b>Within capacity limit</b>";
  }
  
  return tooltip;
}

  isCapacityViolation(task: TaskChunk): boolean {
    if (!this.result?.capacity_violations) return false;
    return this.result.capacity_violations.some(
      (v:any) => v.job_id === task.job.id && 
           Math.abs(v.start - task.start) < 0.1
    );
  }

  isChunkCapacityViolation(chunk: TaskChunk): boolean {
    return this.isCapacityViolation(chunk);
  }

  getTimeTicks(makespan: number): number[] {
    const ticks = [];
    const step = Math.ceil(makespan / 10);
    for (let i = 0; i <= makespan; i += step) {
      ticks.push(i);
    }
    return ticks;
  }

  countTasks(machine: TaskChunk[]): number {
    return machine.length;
  }

  getMachineWork(machineId: number): number {
    if (!this.result?.schedule[machineId]) return 0;
    return this.result.schedule[machineId].reduce((sum:any, task:any) => sum + (task.end - task.start), 0);
  }

  getMachineLoad(machineId: number): number {
    if (!this.result?.machine_loads) return 0;
    return this.result.machine_loads[machineId] || 0;
  }

  getSplitJobIds(): number[] {
    if (!this.result?.splits_info) return [];
    return Object.keys(this.result.splits_info)
      .map(id => parseInt(id))
      .filter(id => this.result!.splits_info[id] > 1);
  }

  getJobChunks(jobId: number): TaskChunk[] {
    if (!this.result) return [];
    const chunks: TaskChunk[] = [];
    this.result.schedule.forEach((machine:any, machineId:any) => {
      machine.forEach((task:any) => {
        if (task.job.id === jobId) {
          chunks.push(task);
        }
      });
    });
    return chunks.sort((a, b) => a.start - b.start);
  }

  // Job Management
  trackByJobId(index: number, job: Job): number {
    return job.id;
  }

  addJob(): void {
    const newId = this.jobs.length > 0 ? Math.max(...this.jobs.map(j => j.id)) + 1 : 1;
    this.jobs.push({
      id: newId,
      name: `Task ${newId}`,
      duration: 5,
      dependencies: [],
      min_chunk_size: 1
    });
    this.updateCapacityWarning();
  }

  removeJob(id: number): void {
    this.jobs = this.jobs.filter(job => job.id !== id);
    // Remove references from dependencies
    this.jobs.forEach(job => {
      job.dependencies = job.dependencies.filter(dep => dep !== id);
    });
    this.stopAnimation();
    this.updateCapacityWarning();
  }

  removeDependency(job: Job, depId: number): void {
    job.dependencies = job.dependencies.filter(id => id !== depId);
  }

  getPossibleDependencies(job: Job): Job[] {
    return this.jobs.filter(j => j.id !== job.id);
  }

  checkDuration(job: Job): void {
    job.min_chunk_size = job.duration > 5 ? 2 : 1;
    this.updateCapacityWarning();
  }

  updateCapacityWarning(): void {
    // This method triggers UI updates for capacity warnings
    this.cdr.detectChanges();
  }

  // Algorithm Execution
  async validateAndSolve(): Promise<void> {
    // Reset previous results
    this.result = null;
    this.error = null;
    
    // Validate dependencies
    if (!this.validateDependencies()) {
      this.error = 'Cyclic dependencies detected! Please check your task dependencies.';
      return;
    }

    // Validate no duplicate IDs
    const ids = this.jobs.map(job => job.id);
    if (new Set(ids).size !== ids.length) {
      this.error = 'Duplicate task IDs found! Please ensure each task has a unique ID.';
      return;
    }

    // STRICT CAPACITY CHECK: No task can exceed 40 units
    const exceedingTasks = this.jobs.filter(job => job.duration > 40);
    if (exceedingTasks.length > 0) {
      const taskNames = exceedingTasks.map(job => 
        `${job.name} (${job.duration} units)`
      ).join('\n');
      
      this.error = `CAPACITY ERROR: ${exceedingTasks.length} task(s) exceed the 40-unit machine capacity:\n${taskNames}\n\nPlease reduce task durations below 40 units.`;
      return;
    }

    await this.solve();
  }

  validateDependencies(): boolean {
    const visited = new Set<number>();
    const temp = new Set<number>();
    
    const hasCycle = (jobId: number): boolean => {
      if (temp.has(jobId)) return true;
      if (visited.has(jobId)) return false;
      
      temp.add(jobId);
      const job = this.jobs.find(j => j.id === jobId);
      
      if (job) {
        for (const depId of job.dependencies) {
          if (hasCycle(depId)) return true;
        }
      }
      
      temp.delete(jobId);
      visited.add(jobId);
      return false;
    };
    
    for (const job of this.jobs) {
      if (!visited.has(job.id)) {
        if (hasCycle(job.id)) return false;
      }
    }
    
    return true;
  }

  solve(): void {
    this.isLoading = true;
    this.error = null;
    this.result = null;
    this.stopAnimation();

    const payload = {
      jobs: this.jobs,
      algorithm: this.algorithm,
      machine_capacity: 40 // Always send 40
    };

    this.http.post<ScheduleResult>('http://localhost:8000/api/solve', payload)
      .subscribe({
        next: (res) => {
          this.result = res;
          this.isLoading = false;
          
          if (res.success) {
            // Auto-start animation after a short delay
            setTimeout(() => this.toggleAnimation(), 1000);
          } 
        },
        error: (err) => {
          this.isLoading = false;
          this.error = err.error?.detail || err.message || 'Server error occurred';
          console.error('Error:', err);
        }
      });
  }

  resetAll(): void {
    this.jobs = [];
    this.result = null;
    this.error = null;
    this.stopAnimation();
    this.addJob(); // Add one initial job
  }

  // Animation
  toggleAnimation(): void {
    if (!this.result) return;
    
    this.showAnimation = !this.showAnimation;
    
    if (this.showAnimation) {
      this.animationSubscription = interval(100 / this.animationSpeed).subscribe(() => {
        if (this.currentTime < this.result!.makespan) {
          this.currentTime += 0.1;
          this.cdr.detectChanges();
        } else {
          this.stopAnimation();
        }
      });
    } else {
      this.animationSubscription?.unsubscribe();
    }
  }

  resetAnimation(): void {
    this.stopAnimation();
    this.currentTime = 0;
  }

  stopAnimation(): void {
    this.showAnimation = false;
    this.animationSubscription?.unsubscribe();
  }

  onTimeSliderChange(): void {
    this.stopAnimation();
  }

  // Logs
  getLogTime(index: number): string {
    if (!this.result?.execution_time) return '00:00';
    const time = (index / (this.result.logs.length || 1)) * this.result.execution_time;
    return time.toFixed(3) + 's';
  }

  formatLog(log: string): string {
    // Convert emojis to colored spans
    return log
      .replace(/🧬/g, '<span style="color: #4cc9f0">🧬</span>')
      .replace(/🔍/g, '<span style="color: #f8961e">🔍</span>')
      .replace(/📊/g, '<span style="color: #4895ef">📊</span>')
      .replace(/🔄/g, '<span style="color: #7209b7">🔄</span>')
      .replace(/🏆/g, '<span style="color: #90be6d">🏆</span>')
      .replace(/❌/g, '<span style="color: #f94144">❌</span>')
      .replace(/⚠️/g, '<span style="color: #f8961e">⚠️</span>')
      .replace(/✅/g, '<span style="color: #90be6d">✅</span>')
      .replace(/⚙️/g, '<span style="color: #4361ee">⚙️</span>')
      .replace(/CAPACITY VIOLATION/g, '<span style="color: #f94144; font-weight: bold">CAPACITY VIOLATION</span>')
      .replace(/CAPACITY ERROR/g, '<span style="color: #f94144; font-weight: bold">CAPACITY ERROR</span>');
  }

  copyLogs(): void {
    if (!this.result?.logs) return;
    
    const logsText = this.result.logs.join('\n');
    navigator.clipboard.writeText(logsText)
      .then(() => {
        alert('Logs copied to clipboard!');
      })
      .catch(err => {
        console.error('Failed to copy logs:', err);
      });
  }

  // Export/Print
  exportSchedule(): void {
    if (!this.result) return;
    
    const data = {
      jobs: this.jobs,
      algorithm: this.algorithm,
      machine_capacity: 40, // Fixed
      result: this.result,
      exportTime: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `schedule_${new Date().toISOString().slice(0, 10)}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  }

  printSchedule(): void {
    window.print();
  }

  ngOnDestroy(): void {
    this.stopAnimation();
  }
}