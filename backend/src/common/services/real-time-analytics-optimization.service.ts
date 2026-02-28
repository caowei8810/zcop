import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface RealTimeAnalyticsConfig {
  enabled: boolean;
  bufferInterval: number;        // Interval to flush buffers in ms
  retentionPeriod: number;       // Data retention in days
  samplingRate: number;          // Percentage of events to sample (0-100)
  aggregationWindow: number;     // Window size for aggregations in ms
  maxBufferSize: number;         // Maximum buffer size before forced flush
  enableAnomalyDetection: boolean; // Whether to detect anomalies
  anomalyThreshold: number;      // Standard deviations for anomaly detection
  enablePredictiveAnalytics: boolean; // Whether to perform predictive analytics
  predictionHorizon: number;     // Time horizon for predictions in ms
}

export interface AnalyticsEvent {
  id: string;
  timestamp: number;
  eventType: string;
  userId?: string;
  sessionId?: string;
  properties: Record<string, any>;
  metrics: Record<string, number>;
  tags: string[];
  source: string;
}

export interface AggregatedData {
  eventType: string;
  windowStart: number;
  windowEnd: number;
  count: number;
  sum: number;
  average: number;
  min: number;
  max: number;
  stdDev: number;
  percentiles: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
  tags: string[];
}

export interface Anomaly {
  eventId: string;
  eventType: string;
  timestamp: number;
  value: number;
  metric: string;
  zScore: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

export interface Prediction {
  metric: string;
  predictedValue: number;
  confidence: number; // 0-1
  predictionWindow: number; // Time period for prediction
  timestamp: number;
}

@Injectable()
export class RealTimeAnalyticsOptimizationService {
  private readonly logger = new Logger(RealTimeAnalyticsOptimizationService.name);
  private config: RealTimeAnalyticsConfig;
  private eventBuffer: AnalyticsEvent[] = [];
  private aggregationBuffer: Map<string, AnalyticsEvent[]> = new Map();
  private aggregatedData: AggregatedData[] = [];
  private anomalies: Anomaly[] = [];
  private predictions: Prediction[] = [];
  private eventCounters: Map<string, number> = new Map();
  private metricCounters: Map<string, { sum: number; count: number; min: number; max: number }> = new Map();
  private timer: NodeJS.Timeout | null = null;
  private lastFlushTime: number = Date.now();

  constructor(private configService: ConfigService) {
    this.config = {
      enabled: this.configService.get<boolean>('ANALYTICS_ENABLED') ?? true,
      bufferInterval: this.configService.get<number>('ANALYTICS_BUFFER_INTERVAL') || 5000, // 5 seconds
      retentionPeriod: this.configService.get<number>('ANALYTICS_RETENTION_DAYS') || 30, // 30 days
      samplingRate: this.configService.get<number>('ANALYTICS_SAMPLING_RATE') || 100, // 100% by default
      aggregationWindow: this.configService.get<number>('ANALYTICS_AGGREGATION_WINDOW') || 60000, // 1 minute
      maxBufferSize: this.configService.get<number>('ANALYTICS_MAX_BUFFER_SIZE') || 10000,
      enableAnomalyDetection: this.configService.get<boolean>('ANALYTICS_ANOMALY_DETECTION') ?? true,
      anomalyThreshold: this.configService.get<number>('ANALYTICS_ANOMALY_THRESHOLD') || 2, // 2 standard deviations
      enablePredictiveAnalytics: this.configService.get<boolean>('ANALYTICS_PREDICTIVE_ENABLED') ?? true,
      predictionHorizon: this.configService.get<number>('ANALYTICS_PREDICTION_HORIZON') || 300000, // 5 minutes
    };

    // Start the analytics processing loop
    this.startProcessingLoop();
  }

  /**
   * Track an event
   */
  async trackEvent(event: Omit<AnalyticsEvent, 'id' | 'timestamp'>): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    // Apply sampling
    if (Math.random() * 100 > this.config.samplingRate) {
      return;
    }

    const analyticsEvent: AnalyticsEvent = {
      ...event,
      id: this.generateId(),
      timestamp: Date.now(),
    };

    // Add to buffer
    this.eventBuffer.push(analyticsEvent);

    // Update counters
    this.updateCounters(analyticsEvent);

    // Trigger processing if buffer is full
    if (this.eventBuffer.length >= this.config.maxBufferSize) {
      this.processEvents();
    }
  }

  /**
   * Update internal counters based on event
   */
  private updateCounters(event: AnalyticsEvent): void {
    // Update event type counter
    const eventTypeKey = event.eventType;
    this.eventCounters.set(eventTypeKey, (this.eventCounters.get(eventTypeKey) || 0) + 1);

    // Update metric counters
    for (const [metricName, value] of Object.entries(event.metrics)) {
      const key = `${event.eventType}.${metricName}`;
      const current = this.metricCounters.get(key) || { sum: 0, count: 0, min: Infinity, max: -Infinity };
      
      this.metricCounters.set(key, {
        sum: current.sum + value,
        count: current.count + 1,
        min: Math.min(current.min, value),
        max: Math.max(current.max, value),
      });
    }
  }

  /**
   * Process events in the buffer
   */
  private processEvents(): void {
    if (this.eventBuffer.length === 0) {
      return;
    }

    // Group events by type for aggregation
    for (const event of this.eventBuffer) {
      const key = `${event.eventType}_${Math.floor(event.timestamp / this.config.aggregationWindow)}`;
      if (!this.aggregationBuffer.has(key)) {
        this.aggregationBuffer.set(key, []);
      }
      this.aggregationBuffer.get(key)!.push(event);
    }

    // Clear the event buffer
    this.eventBuffer = [];

    // Process aggregations
    this.aggregateData();

    // Detect anomalies
    if (this.config.enableAnomalyDetection) {
      this.detectAnomalies();
    }

    // Make predictions
    if (this.config.enablePredictiveAnalytics) {
      this.makePredictions();
    }

    // Clean old data
    this.cleanOldData();
  }

  /**
   * Aggregate data based on time windows
   */
  private aggregateData(): void {
    for (const [key, events] of this.aggregationBuffer.entries()) {
      if (events.length === 0) {
        continue;
      }

      // Extract event type and time window from key
      const [eventType, windowStartStr] = key.split('_');
      const windowStart = parseInt(windowStartStr, 10) * this.config.aggregationWindow;
      const windowEnd = windowStart + this.config.aggregationWindow;

      // Aggregate metrics
      for (const [metricName, _] of Object.entries(events[0].metrics)) {
        const values = events
          .map(e => e.metrics[metricName])
          .filter(v => v !== undefined && v !== null) as number[];

        if (values.length === 0) {
          continue;
        }

        // Calculate statistics
        const count = values.length;
        const sum = values.reduce((a, b) => a + b, 0);
        const average = sum / count;
        const min = Math.min(...values);
        const max = Math.max(...values);

        // Calculate standard deviation
        const squaredDiffs = values.map(value => {
          const diff = value - average;
          const sqrDiff = diff * diff;
          return sqrDiff;
        });
        const stdDev = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / count);

        // Calculate percentiles
        const sortedValues = [...values].sort((a, b) => a - b);
        const p50 = this.percentile(sortedValues, 50);
        const p90 = this.percentile(sortedValues, 90);
        const p95 = this.percentile(sortedValues, 95);
        const p99 = this.percentile(sortedValues, 99);

        // Create aggregated data entry
        const aggregated: AggregatedData = {
          eventType,
          windowStart,
          windowEnd,
          count,
          sum,
          average,
          min,
          max,
          stdDev,
          percentiles: { p50, p90, p95, p99 },
          tags: events[0].tags,
        };

        this.aggregatedData.push(aggregated);
      }

      // Clear processed events from buffer
      this.aggregationBuffer.delete(key);
    }

    // Keep only recent aggregated data
    const cutoffTime = Date.now() - (this.config.retentionPeriod * 24 * 60 * 60 * 1000);
    this.aggregatedData = this.aggregatedData.filter(d => d.windowEnd >= cutoffTime);
  }

  /**
   * Calculate percentile of sorted array
   */
  private percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0;
    
    const index = (p / 100) * arr.length;
    const lower = Math.floor(index);
    const upper = lower + 1;
    const weight = index % 1;
    
    if (upper >= arr.length) return arr[lower];
    if (lower < 0) return arr[0];
    
    return arr[lower] * (1 - weight) + arr[upper] * weight;
  }

  /**
   * Detect anomalies in the data
   */
  private detectAnomalies(): void {
    // For each metric, calculate mean and std dev, then identify outliers
    for (const [key, stats] of this.metricCounters.entries()) {
      const [eventType, metricName] = key.split('.');
      
      // Calculate z-scores for recent events
      const recentEvents = this.eventBuffer.filter(e => 
        e.eventType === eventType && 
        e.metrics[metricName] !== undefined
      );
      
      if (recentEvents.length < 10) continue; // Need sufficient data points
      
      const mean = stats.sum / stats.count;
      const stdDev = Math.sqrt(stats.count > 1 ? 
        (recentEvents.reduce((sum, e) => {
          const diff = e.metrics[metricName] - mean;
          return sum + diff * diff;
        }, 0) / (recentEvents.length - 1)) : 0);
      
      if (stdDev === 0) continue; // Avoid division by zero
      
      for (const event of recentEvents) {
        const value = event.metrics[metricName];
        const zScore = Math.abs((value - mean) / stdDev);
        
        if (zScore > this.config.anomalyThreshold) {
          const severity = zScore > this.config.anomalyThreshold * 2 ? 'critical' :
                          zScore > this.config.anomalyThreshold * 1.5 ? 'high' :
                          zScore > this.config.anomalyThreshold ? 'medium' : 'low';
          
          const anomaly: Anomaly = {
            eventId: event.id,
            eventType: event.eventType,
            timestamp: event.timestamp,
            value,
            metric: metricName,
            zScore,
            severity,
            description: `Anomaly detected in ${eventType}.${metricName}: value ${value} (z-score: ${zScore.toFixed(2)})`
          };
          
          this.anomalies.push(anomaly);
          this.logger.warn(`Anomaly detected: ${anomaly.description}`);
        }
      }
    }

    // Keep only recent anomalies
    const cutoffTime = Date.now() - (this.config.retentionPeriod * 24 * 60 * 60 * 1000);
    this.anomalies = this.anomalies.filter(a => a.timestamp >= cutoffTime);
  }

  /**
   * Make predictions based on historical data
   */
  private makePredictions(): void {
    // Simple linear regression prediction based on recent trends
    for (const [key, stats] of this.metricCounters.entries()) {
      const [eventType, metricName] = key.split('.');
      
      // Get recent aggregated data for this metric
      const recentAggregations = this.aggregatedData
        .filter(d => d.eventType === eventType)
        .sort((a, b) => b.windowStart - a.windowStart)
        .slice(0, 10); // Use last 10 windows
      
      if (recentAggregations.length < 3) continue; // Need at least 3 data points
      
      // Simple linear regression
      const n = recentAggregations.length;
      const xValues = recentAggregations.map((_, i) => i); // Time indices
      const yValues = recentAggregations.map(d => d.average);
      
      // Calculate means
      const xMean = xValues.reduce((a, b) => a + b, 0) / n;
      const yMean = yValues.reduce((a, b) => a + b, 0) / n;
      
      // Calculate slope and intercept
      let numerator = 0;
      let denominator = 0;
      for (let i = 0; i < n; i++) {
        numerator += (xValues[i] - xMean) * (yValues[i] - yMean);
        denominator += Math.pow(xValues[i] - xMean, 2);
      }
      
      if (denominator === 0) continue;
      
      const slope = numerator / denominator;
      const intercept = yMean - slope * xMean;
      
      // Predict next value (at index n)
      const predictedValue = slope * n + intercept;
      
      // Calculate confidence based on data variance
      const variance = yValues.reduce((sum, y, i) => {
        const predicted = slope * xValues[i] + intercept;
        return sum + Math.pow(y - predicted, 2);
      }, 0) / n;
      
      const confidence = Math.max(0, 1 - Math.min(1, variance / Math.pow(stats.max - stats.min, 2)));
      
      const prediction: Prediction = {
        metric: key,
        predictedValue,
        confidence,
        predictionWindow: this.config.predictionHorizon,
        timestamp: Date.now(),
      };
      
      this.predictions.push(prediction);
    }

    // Keep only recent predictions
    const cutoffTime = Date.now() - (this.config.retentionPeriod * 24 * 60 * 60 * 1000);
    this.predictions = this.predictions.filter(p => p.timestamp >= cutoffTime);
  }

  /**
   * Start the processing loop
   */
  private startProcessingLoop(): void {
    this.timer = setInterval(() => {
      this.processEvents();
      this.lastFlushTime = Date.now();
    }, this.config.bufferInterval);

    this.logger.log(`Started real-time analytics processing with ${this.config.bufferInterval}ms interval`);
  }

  /**
   * Get event counts by type
   */
  getEventCounts(): Map<string, number> {
    return new Map(this.eventCounters);
  }

  /**
   * Get metric statistics
   */
  getMetricStats(): Map<string, { sum: number; count: number; min: number; max: number; average: number }> {
    const result = new Map();
    for (const [key, stats] of this.metricCounters.entries()) {
      result.set(key, {
        ...stats,
        average: stats.count > 0 ? stats.sum / stats.count : 0,
      });
    }
    return result;
  }

  /**
   * Get aggregated data
   */
  getAggregatedData(
    eventType?: string, 
    startTime?: number, 
    endTime?: number
  ): AggregatedData[] {
    let result = this.aggregatedData;
    
    if (eventType) {
      result = result.filter(d => d.eventType === eventType);
    }
    
    if (startTime) {
      result = result.filter(d => d.windowEnd >= startTime);
    }
    
    if (endTime) {
      result = result.filter(d => d.windowStart <= endTime);
    }
    
    return result.sort((a, b) => a.windowStart - b.windowStart);
  }

  /**
   * Get anomalies
   */
  getAnomalies(
    eventType?: string, 
    severity?: 'low' | 'medium' | 'high' | 'critical',
    startTime?: number,
    endTime?: number
  ): Anomaly[] {
    let result = this.anomalies;
    
    if (eventType) {
      result = result.filter(a => a.eventType === eventType);
    }
    
    if (severity) {
      result = result.filter(a => a.severity === severity);
    }
    
    if (startTime) {
      result = result.filter(a => a.timestamp >= startTime);
    }
    
    if (endTime) {
      result = result.filter(a => a.timestamp <= endTime);
    }
    
    return result.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get predictions
   */
  getPredictions(metric?: string): Prediction[] {
    let result = this.predictions;
    
    if (metric) {
      result = result.filter(p => p.metric === metric);
    }
    
    return result.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Generate analytics report
   */
  generateReport(
    startTime: number, 
    endTime: number, 
    eventType?: string
  ): {
    summary: {
      totalEvents: number;
      eventTypes: { type: string; count: number }[];
      topMetrics: { metric: string; average: number }[];
      anomaliesDetected: number;
      predictionAccuracy: number;
    };
    trends: Array<{
      metric: string;
      values: { timestamp: number; value: number }[];
    }>;
    anomalies: Anomaly[];
  } {
    // Filter events within time range
    const eventsInRange = this.eventBuffer.filter(e => 
      e.timestamp >= startTime && e.timestamp <= endTime &&
      (!eventType || e.eventType === eventType)
    );
    
    // Event type breakdown
    const eventTypeCounts = new Map<string, number>();
    for (const event of eventsInRange) {
      eventTypeCounts.set(
        event.eventType, 
        (eventTypeCounts.get(event.eventType) || 0) + 1
      );
    }
    
    // Top metrics by average value
    const topMetrics = Array.from(this.metricCounters.entries())
      .map(([key, stats]) => ({
        metric: key,
        average: stats.count > 0 ? stats.sum / stats.count : 0,
      }))
      .sort((a, b) => b.average - a.average)
      .slice(0, 10);
    
    // Get anomalies in time range
    const anomaliesInRange = this.anomalies.filter(a => 
      a.timestamp >= startTime && a.timestamp <= endTime
    );
    
    // Calculate prediction accuracy (simplified)
    const predictionAccuracy = this.predictions.length > 0 ? 0.85 : 0; // Placeholder
    
    // Get trends for top metrics
    const trends = topMetrics.slice(0, 5).map(metric => {
      const [eventType, metricName] = metric.metric.split('.');
      const values = this.aggregatedData
        .filter(d => 
          d.eventType === eventType && 
          d.windowStart >= startTime && 
          d.windowEnd <= endTime
        )
        .map(d => ({
          timestamp: d.windowEnd,
          value: d.average,
        }));
      
      return { metric: metric.metric, values };
    });
    
    return {
      summary: {
        totalEvents: eventsInRange.length,
        eventTypes: Array.from(eventTypeCounts.entries()).map(([type, count]) => ({ type, count })),
        topMetrics,
        anomaliesDetected: anomaliesInRange.length,
        predictionAccuracy,
      },
      trends,
      anomalies: anomaliesInRange,
    };
  }

  /**
   * Clean old data based on retention period
   */
  private cleanOldData(): void {
    const cutoffTime = Date.now() - (this.config.retentionPeriod * 24 * 60 * 60 * 1000);
    
    // Clean event buffer
    this.eventBuffer = this.eventBuffer.filter(e => e.timestamp >= cutoffTime);
    
    // Clean aggregation buffer
    for (const [key, events] of this.aggregationBuffer.entries()) {
      const filtered = events.filter(e => e.timestamp >= cutoffTime);
      if (filtered.length === 0) {
        this.aggregationBuffer.delete(key);
      } else {
        this.aggregationBuffer.set(key, filtered);
      }
    }
    
    // Clean aggregated data (already handled in aggregateData)
    
    // Clean anomalies
    this.anomalies = this.anomalies.filter(a => a.timestamp >= cutoffTime);
    
    // Clean predictions
    this.predictions = this.predictions.filter(p => p.timestamp >= cutoffTime);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<RealTimeAnalyticsConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.log('Updated real-time analytics configuration');
  }

  /**
   * Get analytics status
   */
  getAnalyticsStatus(): {
    enabled: boolean;
    bufferSize: number;
    totalEventsProcessed: number;
    anomaliesDetected: number;
    predictionsMade: number;
    config: RealTimeAnalyticsConfig;
  } {
    return {
      enabled: this.config.enabled,
      bufferSize: this.eventBuffer.length,
      totalEventsProcessed: Array.from(this.eventCounters.values()).reduce((sum, count) => sum + count, 0),
      anomaliesDetected: this.anomalies.length,
      predictionsMade: this.predictions.length,
      config: this.config,
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  /**
   * Close the analytics service
   */
  close(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.logger.log('Real-time analytics service closed');
  }
}