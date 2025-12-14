import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, timeout, retry } from 'rxjs/operators';

export interface Job {
  id: number;
  name: string;
  duration: number;
  dependencies: number[];
  min_chunk_size: number;
}

export interface ScheduleRequest {
  jobs: Job[];
  algorithm: 'backtracking' | 'cultural';
}

export interface TaskChunk {
  job: Job;
  machine: number;
  start: number;
  end: number;
  chunk_id: number;
  total_chunks: number;
}

export interface ScheduleResult {
  success: boolean;
  makespan: number;
  execution_time: number;
  schedule: TaskChunk[][];
  logs: string[];
  iterations?: number;
  splits_info: { [jobId: number]: number };
  efficiency?: number;
  total_work?: number;
  total_idle_time?: number;
  total_machine_time?: number;
  performance_details?: any;
  performance_plot?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SchedulingService {
  private apiUrl = 'http://localhost:8000/api';
  private defaultTimeout = 30000; // 30 seconds

  constructor(private http: HttpClient) {}

  solveSchedule(request: ScheduleRequest): Observable<ScheduleResult> {
    // Validate request before sending
    const validationError = this.validateRequest(request);
    if (validationError) {
      return throwError(() => new Error(validationError));
    }

    return this.http.post<ScheduleResult>(`${this.apiUrl}/solve`, request)
      .pipe(
        timeout(this.defaultTimeout),
        retry(2),
        catchError(this.handleError)
      );
  }

  private validateRequest(request: ScheduleRequest): string | null {
    if (!request.jobs || request.jobs.length === 0) {
      return 'At least one job is required';
    }

    // Check for duplicate IDs
    const ids = request.jobs.map(job => job.id);
    if (new Set(ids).size !== ids.length) {
      return 'Duplicate job IDs found';
    }

    // Validate dependencies
    const allIds = new Set(ids);
    for (const job of request.jobs) {
      for (const depId of job.dependencies) {
        if (!allIds.has(depId)) {
          return `Dependency ${depId} for job ${job.id} does not exist`;
        }
      }
    }

    // Check for cycles
    if (this.hasCyclicDependencies(request.jobs)) {
      return 'Cyclic dependencies detected';
    }

    return null;
  }

  hasCyclicDependencies(jobs: Job[]): boolean {
    const visited = new Set<number>();
    const temp = new Set<number>();
    const jobMap = new Map<number, Job>();
    
    jobs.forEach(job => jobMap.set(job.id, job));

    const dfs = (jobId: number): boolean => {
      if (temp.has(jobId)) return true;
      if (visited.has(jobId)) return false;
      
      temp.add(jobId);
      const job = jobMap.get(jobId);
      
      if (job) {
        for (const depId of job.dependencies) {
          if (dfs(depId)) return true;
        }
      }
      
      temp.delete(jobId);
      visited.add(jobId);
      return false;
    };

    for (const job of jobs) {
      if (!visited.has(job.id)) {
        if (dfs(job.id)) return true;
      }
    }
    
    return false;
  }

  private handleError(error: any): Observable<never> {
    let errorMessage = 'An unknown error occurred';
    
    if (error.name === 'TimeoutError') {
      errorMessage = 'Request timeout. The server is taking too long to respond.';
    } else if (error.status === 0) {
      errorMessage = 'Unable to connect to the server. Please check your connection.';
    } else if (error.status === 400) {
      errorMessage = error.error?.detail || 'Invalid request data';
    } else if (error.status === 500) {
      errorMessage = 'Server error. Please try again later.';
    } else if (error.error instanceof ErrorEvent) {
      errorMessage = error.error.message;
    } else {
      errorMessage = error.message || error.statusText;
    }

    return throwError(() => new Error(errorMessage));
  }

  // Utility methods for the frontend
  calculateJobStats(jobs: Job[]): {
    totalDuration: number;
    totalDependencies: number;
    maxDuration: number;
    minDuration: number;
    avgDuration: number;
  } {
    const durations = jobs.map(job => job.duration);
    const totalDuration = durations.reduce((a, b) => a + b, 0);
    const totalDependencies = jobs.reduce((sum, job) => sum + job.dependencies.length, 0);
    
    return {
      totalDuration,
      totalDependencies,
      maxDuration: Math.max(...durations),
      minDuration: Math.min(...durations),
      avgDuration: totalDuration / jobs.length
    };
  }

}