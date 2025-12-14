import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

interface CapacityWarning {
  job_id: number;
  job_name: string;
  machine: number;
  chunk_size: number;
  exceeded_by: number;
  start: number;
  end: number;
  machine_capacity: number;
  type: string;
}

@Component({
  selector: 'app-schedule-plot',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="plot-container" *ngIf="plotData">
      <div class="plot-header">
        <div class="plot-title">
          <h3>
            <span class="plot-icon">📈</span>
            Algorithm Performance Analysis
          </h3>
          <div class="plot-subtitle">
            Shows makespan improvement across generations
            <span *ngIf="capacityWarnings && capacityWarnings.length > 0" class="warning-badge">
              ⚠️ {{ capacityWarnings.length }} capacity warnings
            </span>
          </div>
        </div>
        
        <div class="plot-actions">
          <button (click)="downloadPlot()" class="action-btn primary">
            <span class="action-icon">📥</span>
            Download Chart
          </button>
          <button (click)="copyPlotData()" class="action-btn secondary">
            <span class="action-icon">📋</span>
            Copy Data
          </button>
        </div>
      </div>
      
      <div class="plot-content">
        <div class="plot-image-container">
          <img [src]="'data:image/png;base64,' + plotData" 
               alt="Algorithm Performance Plot"
               class="performance-plot"
               (load)="onImageLoad()"
               (error)="onImageError()">
          
          <div *ngIf="loading" class="plot-loading">
            <div class="loading-spinner"></div>
            <p>Loading chart...</p>
          </div>
          
          <div *ngIf="imageError" class="plot-error">
            <span class="error-icon">❌</span>
            <p>Failed to load chart image</p>
          </div>
        </div>
        
        <!-- Capacity Warnings Section -->
        <div *ngIf="capacityWarnings && capacityWarnings.length > 0" class="capacity-warnings">
          <div class="warnings-header">
            <span class="warnings-icon">⚠️</span>
            <h4>Capacity Warnings</h4>
            <span class="warnings-count">{{ capacityWarnings.length }} warning(s)</span>
          </div>
          <div class="warnings-info">
            <p>The following tasks exceeded machine capacity ({{ machineCapacity }} units):</p>
          </div>
          <div class="warnings-list">
            <div *ngFor="let warning of capacityWarnings" class="warning-item">
              <div class="warning-info">
                <span class="warning-job">{{ warning.job_name }}</span>
                <span class="warning-machine">Machine {{ warning.machine + 1 }}</span>
              </div>
              <div class="warning-details">
                <span class="detail">
                  <span class="detail-label">Time:</span>
                  <span class="detail-value">{{ warning.start.toFixed(1) }} - {{ warning.end.toFixed(1) }}</span>
                </span>
                <span class="detail">
                  <span class="detail-label">Exceeded by:</span>
                  <span class="detail-value warning">{{ warning.exceeded_by.toFixed(1) }} units</span>
                </span>
                <span class="detail">
                  <span class="detail-label">Capacity:</span>
                  <span class="detail-value">{{ warning.machine_capacity }} units</span>
                </span>
              </div>
            </div>
          </div>
          <div class="warnings-note">
            <span class="note-icon">ℹ️</span>
            <span class="note-text">
              <strong>Note:</strong> Tasks are still scheduled despite capacity warnings. 
              The algorithm continues to optimize but indicates when capacity is exceeded.
            </span>
          </div>
        </div>
        
        <div class="plot-info">
          <div class="info-section">
            <h4>📊 Chart Interpretation</h4>
            <ul class="info-list">
              <li><strong>X-axis:</strong> Generation number</li>
              <li><strong>Y-axis:</strong> Makespan (total completion time)</li>
              <li><strong>Line trend:</strong> Shows algorithm convergence</li>
              <li><strong>Steeper drops:</strong> Significant improvements</li>
            </ul>
          </div>
          
          <div class="info-section">
            <h4>⚙️ Machine Capacity Settings</h4>
            <ul class="info-list">
              <li><strong>Fixed capacity per machine:</strong> {{ machineCapacity }} units</li>
              <li><strong>Number of machines:</strong> 3 machines</li>
              <li><strong>Total available capacity:</strong> {{ machineCapacity * 3 }} units</li>
              <li><strong>Warning system:</strong> Alerts only, no task rejection</li>
            </ul>
          </div>
        </div>
      </div>
      
      <div class="plot-footer">
        <div class="footer-note">
          <span class="note-icon">💡</span>
          <span>
            The algorithm shows progressive improvement while monitoring machine capacity.
            <span *ngIf="capacityWarnings && capacityWarnings.length > 0" class="warning-note">
              ⚠️ {{ capacityWarnings.length }} task(s) exceeded machine capacity limits.
            </span>
          </span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .plot-container {
      background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
      border: 1px solid #e9ecef;
      overflow: hidden;
      margin: 25px 0;
      transition: all 0.3s ease;
    }
    
    .plot-container:hover {
      box-shadow: 0 12px 48px rgba(0, 0, 0, 0.12);
      transform: translateY(-2px);
    }
    
    .plot-header {
      background: linear-gradient(135deg, #4361ee 0%, #3a56d4 100%);
      padding: 25px 30px;
      color: white;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 20px;
    }
    
    .plot-title h3 {
      margin: 0 0 8px 0;
      font-size: 1.5rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .plot-icon {
      font-size: 1.8rem;
    }
    
    .plot-subtitle {
      opacity: 0.9;
      font-size: 0.95rem;
      max-width: 600px;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    
    .warning-badge {
      background: rgba(255, 255, 255, 0.2);
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 0.85rem;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    
    .plot-actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
    
    .action-btn {
      padding: 12px 24px;
      border: none;
      border-radius: 10px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.3s ease;
      font-size: 0.95rem;
    }
    
    .action-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
    }
    
    .action-btn:active {
      transform: translateY(0);
    }
    
    .action-btn.primary {
      background: white;
      color: #4361ee;
    }
    
    .action-btn.secondary {
      background: rgba(255, 255, 255, 0.2);
      color: white;
      border: 2px solid rgba(255, 255, 255, 0.3);
    }
    
    .action-btn.secondary:hover {
      background: rgba(255, 255, 255, 0.3);
    }
    
    .action-icon {
      font-size: 1.2rem;
    }
    
    .plot-content {
      padding: 30px;
      display: flex;
      flex-direction: column;
      gap: 30px;
    }
    
    .plot-image-container {
      position: relative;
      background: white;
      border-radius: 12px;
      padding: 20px;
      border: 2px solid #e9ecef;
      min-height: 400px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .performance-plot {
      max-width: 100%;
      max-height: 500px;
      object-fit: contain;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
    }
    
    .plot-loading, .plot-error {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 15px;
    }
    
    .loading-spinner {
      width: 50px;
      height: 50px;
      border: 4px solid #e9ecef;
      border-top: 4px solid #4361ee;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    .plot-error .error-icon {
      font-size: 3rem;
      color: #f94144;
    }
    
    /* Capacity Warnings Styling */
    .capacity-warnings {
      background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
      border: 2px solid #ffc107;
      border-radius: 12px;
      padding: 20px;
      animation: gentle-pulse 3s infinite;
    }
    
    @keyframes gentle-pulse {
      0%, 100% { border-color: #ffc107; opacity: 1; }
      50% { border-color: #ff9800; opacity: 0.9; }
    }
    
    .warnings-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 15px;
      color: #856404;
    }
    
    .warnings-icon {
      font-size: 1.8rem;
    }
    
    .warnings-header h4 {
      margin: 0;
      font-size: 1.3rem;
      font-weight: 700;
    }
    
    .warnings-count {
      background: rgba(133, 100, 4, 0.1);
      padding: 4px 12px;
      border-radius: 15px;
      font-size: 0.9rem;
      font-weight: 600;
      margin-left: auto;
    }
    
    .warnings-info {
      margin-bottom: 20px;
      color: #856404;
      font-size: 0.95rem;
    }
    
    .warnings-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 20px;
      max-height: 300px;
      overflow-y: auto;
      padding-right: 5px;
    }
    
    .warning-item {
      background: rgba(255, 255, 255, 0.8);
      border-radius: 10px;
      padding: 15px;
      border-left: 4px solid #ffc107;
      transition: all 0.3s ease;
    }
    
    .warning-item:hover {
      transform: translateX(5px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
    
    .warning-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    
    .warning-job {
      font-weight: 700;
      color: #856404;
      font-size: 1.1rem;
    }
    
    .warning-machine {
      background: #ffc107;
      color: #856404;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.9rem;
      font-weight: 600;
    }
    
    .warning-details {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 10px;
      font-size: 0.9rem;
    }
    
    .detail {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 0;
    }
    
    .detail-label {
      color: #666;
      font-weight: 500;
    }
    
    .detail-value {
      font-weight: 600;
      color: #333;
    }
    
    .detail-value.warning {
      color: #dc3545;
      font-weight: 700;
    }
    
    .warnings-note {
      background: rgba(255, 255, 255, 0.9);
      border-radius: 8px;
      padding: 15px;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      font-size: 0.9rem;
      color: #856404;
      border-top: 1px solid rgba(255, 193, 7, 0.3);
    }
    
    .note-icon {
      font-size: 1.2rem;
      flex-shrink: 0;
      margin-top: 2px;
    }
    
    .note-text {
      line-height: 1.5;
    }
    
    .warning-note {
      color: #dc3545;
      font-weight: 600;
      margin-left: 5px;
    }
    
    .plot-info {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 25px;
    }
    
    .info-section {
      background: white;
      padding: 25px;
      border-radius: 12px;
      border: 2px solid #e9ecef;
    }
    
    .info-section h4 {
      margin: 0 0 20px 0;
      color: #343a40;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 1.1rem;
    }
    
    .info-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    
    .info-list li {
      padding: 8px 0;
      border-bottom: 1px solid #f1f3f5;
      color: #495057;
    }
    
    .info-list li:last-child {
      border-bottom: none;
    }
    
    .info-list li strong {
      color: #212529;
    }
    
    .plot-footer {
      padding: 20px 30px;
      background: #f8f9fa;
      border-top: 1px solid #e9ecef;
    }
    
    .footer-note {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      color: #6c757d;
      font-size: 0.9rem;
      line-height: 1.5;
    }
    
    .note-icon {
      font-size: 1.2rem;
      flex-shrink: 0;
    }
    
    /* Responsive Design */
    @media (max-width: 768px) {
      .plot-header {
        flex-direction: column;
        text-align: center;
        align-items: stretch;
      }
      
      .plot-actions {
        justify-content: center;
      }
      
      .action-btn {
        flex: 1;
        justify-content: center;
        min-width: 150px;
      }
      
      .plot-info {
        grid-template-columns: 1fr;
      }
      
      .warning-details {
        grid-template-columns: 1fr;
      }
    }
    
    @media (max-width: 480px) {
      .plot-content {
        padding: 15px;
      }
      
      .plot-image-container {
        padding: 10px;
      }
      
      .action-btn {
        min-width: 100%;
      }
    }
  `]
})
export class SchedulePlotComponent implements OnChanges {
  @Input() plotData: string | null = null;
  @Input() capacityWarnings: CapacityWarning[] | null = null;
  @Input() machineCapacity: number = 40;
  
  loading = true;
  imageError = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['plotData']) {
      this.loading = true;
      this.imageError = false;
    }
  }

  onImageLoad(): void {
    this.loading = false;
    this.imageError = false;
  }

  onImageError(): void {
    this.loading = false;
    this.imageError = true;
  }

  downloadPlot(): void {
    if (!this.plotData) return;
    
    try {
      const link = document.createElement('a');
      link.href = 'data:image/png;base64,' + this.plotData;
      const warningText = this.capacityWarnings && this.capacityWarnings.length > 0 
        ? `_${this.capacityWarnings.length}warnings` 
        : '';
      link.download = `algorithm_performance_${new Date().toISOString().slice(0, 10)}${warningText}.png`;
      link.click();
    } catch (error) {
      console.error('Failed to download plot:', error);
      alert('Failed to download chart. Please try again.');
    }
  }

  copyPlotData(): void {
    if (!this.plotData) return;
    
    const warningCount = this.capacityWarnings?.length || 0;
    const text = `Algorithm Performance Plot
Generated: ${new Date().toISOString()}
Machine Capacity: ${this.machineCapacity} units per machine
Capacity Warnings: ${warningCount}
${warningCount > 0 ? '⚠️ Some tasks exceeded capacity (scheduled with warnings)' : '✓ All tasks within capacity limits'}
Image data available for download.`;
    
    navigator.clipboard.writeText(text)
      .then(() => {
        alert('Chart information copied to clipboard!');
      })
      .catch(err => {
        console.error('Failed to copy:', err);
      });
  }
}