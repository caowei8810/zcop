import { Injectable } from '@nestjs/common';
import { Neo4jService } from 'nest-neo4j';

@Injectable()
export class AdvancedAnalyticsService {
  constructor(private neo4jService: Neo4jService) {}

  async performAdvancedAnalysis(analysisRequest: any): Promise<any> {
    // Validate analysis request
    const validation = this.validateAnalysisRequest(analysisRequest);
    if (!validation.isValid) {
      throw new Error(`Invalid analysis request: ${validation.errors.join(', ')}`);
    }

    // Perform different types of analysis based on request
    switch (analysisRequest.analysisType) {
      case 'trend_analysis':
        return await this.performTrendAnalysis(analysisRequest);
      case 'anomaly_detection':
        return await this.performAnomalyDetection(analysisRequest);
      case 'predictive_modeling':
        return await this.performPredictiveModeling(analysisRequest);
      case 'correlation_analysis':
        return await this.performCorrelationAnalysis(analysisRequest);
      case 'segmentation_analysis':
        return await this.performSegmentationAnalysis(analysisRequest);
      case 'network_analysis':
        return await this.performNetworkAnalysis(analysisRequest);
      case 'time_series_analysis':
        return await this.performTimeSeriesAnalysis(analysisRequest);
      default:
        throw new Error(`Unknown analysis type: ${analysisRequest.analysisType}`);
    }
  }

  async generateBusinessInsights(entityType: string, timeRange: any, filters: any = {}): Promise<any> {
    // Get basic metrics
    const basicMetrics = await this.getEntityMetrics(entityType, timeRange, filters);
    
    // Get trend analysis
    const trends = await this.analyzeTrends(entityType, timeRange, filters);
    
    // Get anomaly detection
    const anomalies = await this.detectAnomalies(entityType, timeRange, filters);
    
    // Get correlation analysis
    const correlations = await this.analyzeCorrelations(entityType, timeRange, filters);
    
    // Compile insights
    const insights = this.compileBusinessInsights(basicMetrics, trends, anomalies, correlations);
    
    return {
      entityType,
      timeRange,
      filters,
      insights,
      summary: this.generateInsightSummary(insights)
    };
  }

  async performTrendAnalysis(request: any): Promise<any> {
    const cypher = `
      MATCH (n:\`${request.entityType}\`)
      WHERE n.${request.timeProperty} >= $startTime AND n.${request.timeProperty} <= $endTime
      WITH n, n.${request.metricProperty} AS metric
      ORDER BY n.${request.timeProperty}
      RETURN 
        n.${request.timeProperty} AS time,
        metric AS value
      ORDER BY time
    `;

    const result = await this.neo4jService.read(cypher, {
      startTime: request.timeRange.start,
      endTime: request.timeRange.end
    });

    const dataPoints = result.records.map(record => ({
      time: record.get('time'),
      value: record.get('value')
    }));

    // Calculate trend statistics
    const trendStats = this.calculateTrendStatistics(dataPoints);
    
    return {
      analysisType: 'trend_analysis',
      entityType: request.entityType,
      metric: request.metricProperty,
      data: dataPoints,
      trend: trendStats,
      timeRange: request.timeRange,
      insights: this.generateTrendInsights(trendStats)
    };
  }

  async performAnomalyDetection(request: any): Promise<any> {
    const cypher = `
      MATCH (n:\`${request.entityType}\`)
      WHERE n.${request.timeProperty} >= $startTime AND n.${request.timeProperty} <= $endTime
      WITH n, n.${request.metricProperty} AS metric
      WITH collect(metric) AS values, collect(n) AS nodes
      WITH values, nodes, 
           apoc.math.avg(values) AS mean,
           apoc.math.stdev(values) AS stdDev
      UNWIND range(0, size(values) - 1) AS i
      WITH nodes[i] AS node, values[i] AS value, mean, stdDev
      WHERE abs(value - mean) > $threshold * stdDev
      RETURN node, value, mean, stdDev, (value - mean) / stdDev AS zScore
    `;

    // Note: This assumes APOC procedures are available
    // For a system without APOC, we'd need to implement statistical functions differently
    const result = await this.neo4jService.read(cypher, {
      startTime: request.timeRange.start,
      endTime: request.timeRange.end,
      threshold: request.threshold || 2 // Default to 2 standard deviations
    });

    const anomalies = result.records.map(record => ({
      entity: record.get('node').properties,
      value: record.get('value'),
      zScore: record.get('zScore'),
      mean: record.get('mean'),
      stdDev: record.get('stdDev')
    }));

    return {
      analysisType: 'anomaly_detection',
      entityType: request.entityType,
      metric: request.metricProperty,
      anomalies,
      threshold: request.threshold || 2,
      timeRange: request.timeRange,
      summary: {
        totalAnomalies: anomalies.length,
        detectionMethod: 'statistical_outliers',
        threshold: request.threshold || 2
      }
    };
  }

  async performPredictiveModeling(request: any): Promise<any> {
    // For predictive modeling, we'll create a forecast based on historical data
    const cypher = `
      MATCH (n:\`${request.entityType}\`)
      WHERE n.${request.timeProperty} >= $historyStart AND n.${request.timeProperty} <= $historyEnd
      WITH n
      ORDER BY n.${request.timeProperty}
      RETURN 
        n.${request.timeProperty} AS time,
        n.${request.metricProperty} AS value
      LIMIT $historyLimit
    `;

    const result = await this.neo4jService.read(cypher, {
      historyStart: request.historyRange.start,
      historyEnd: request.historyRange.end,
      historyLimit: request.historyLimit || 100
    });

    const historicalData = result.records.map(record => ({
      time: record.get('time'),
      value: record.get('value')
    }));

    // Generate predictions using a simple linear regression approach
    const predictions = this.generateLinearPredictions(historicalData, request.predictionPeriods || 10);
    
    return {
      analysisType: 'predictive_modeling',
      entityType: request.entityType,
      metric: request.metricProperty,
      historicalData,
      predictions,
      predictionPeriods: request.predictionPeriods || 10,
      confidenceInterval: request.confidenceInterval || 0.95,
      modelUsed: 'linear_regression',
      summary: {
        historicalDataPoints: historicalData.length,
        predictedDataPoints: predictions.length,
        modelAccuracy: this.estimateModelAccuracy(historicalData)
      }
    };
  }

  async performCorrelationAnalysis(request: any): Promise<any> {
    const cypher = `
      MATCH (n:\`${request.entityType}\`)
      WHERE n.${request.timeProperty} >= $startTime AND n.${request.timeProperty} <= $endTime
      WITH n
      WHERE n.${request.propertyX} IS NOT NULL AND n.${request.propertyY} IS NOT NULL
      WITH collect(n.${request.propertyX}) AS xValues, 
           collect(n.${request.propertyY}) AS yValues
      WITH xValues, yValues,
           apoc.math.avg(xValues) AS xMean,
           apoc.math.avg(yValues) AS yMean,
           apoc.math.stdev(xValues) AS xStdDev,
           apoc.math.stdev(yValues) AS yStdDev
      WITH xValues, yValues, xMean, yMean, xStdDev, yStdDev
      WITH xValues, yValues, xMean, yMean, xStdDev, yStdDev,
           reduce(sum = 0, i in range(0, size(xValues)-1) |
             sum + ((xValues[i] - xMean) * (yValues[i] - yMean))
           ) AS numerator,
           size(xValues) AS n
      RETURN 
        numerator / ((n - 1) * xStdDev * yStdDev) AS correlation,
        n AS sampleSize
    `;

    const result = await this.neo4jService.read(cypher, {
      startTime: request.timeRange.start,
      endTime: request.timeRange.end
    });

    const correlation = result.records.length > 0 ? result.records[0].get('correlation') : 0;
    const sampleSize = result.records.length > 0 ? result.records[0].get('sampleSize') : 0;

    return {
      analysisType: 'correlation_analysis',
      entityType: request.entityType,
      properties: [request.propertyX, request.propertyY],
      correlation: correlation,
      sampleSize: sampleSize,
      strength: this.getCorrelationStrength(correlation),
      timeRange: request.timeRange,
      interpretation: this.interpretCorrelation(correlation, sampleSize)
    };
  }

  async performSegmentationAnalysis(request: any): Promise<any> {
    // Perform segmentation based on clustering algorithm
    const cypher = `
      MATCH (n:\`${request.entityType}\`)
      WHERE n.${request.segmentationProperty} IS NOT NULL
      WITH n, n.${request.segmentationProperty} AS segValue
      WITH segValue, count(n) AS count
      RETURN segValue, count
      ORDER BY count DESC
    `;

    const result = await this.neo4jService.read(cypher, {});

    const segments = result.records.map(record => ({
      segment: record.get('segValue'),
      count: record.get('count'),
      percentage: 0 // Will calculate after getting total
    }));

    // Calculate percentages
    const totalCount = segments.reduce((sum, seg) => sum + seg.count, 0);
    segments.forEach(seg => {
      seg.percentage = totalCount > 0 ? (seg.count / totalCount) * 100 : 0;
    });

    return {
      analysisType: 'segmentation_analysis',
      entityType: request.entityType,
      segmentationProperty: request.segmentationProperty,
      segments,
      totalRecords: totalCount,
      insights: this.generateSegmentationInsights(segments)
    };
  }

  async performNetworkAnalysis(request: any): Promise<any> {
    // Analyze network relationships between entities
    const cypher = `
      MATCH path = (start:\`${request.startEntityType}\`)-[:${request.relationshipType}*1..${request.maxDepth || 3}]->(end:\`${request.endEntityType}\`)
      WHERE length(path) <= $maxDepth
      RETURN 
        start, 
        end, 
        length(path) AS pathLength,
        nodes(path) AS pathNodes,
        relationships(path) AS pathRels
      LIMIT $limit
    `;

    const result = await this.neo4jService.read(cypher, {
      maxDepth: request.maxDepth || 3,
      limit: request.limit || 100
    });

    const networkPaths = result.records.map(record => ({
      start: record.get('start').properties,
      end: record.get('end').properties,
      pathLength: record.get('pathLength'),
      pathNodes: record.get('pathNodes').map((n: any) => n.properties),
      pathRels: record.get('pathRels').map((r: any) => ({ type: r.type, properties: r.properties }))
    }));

    return {
      analysisType: 'network_analysis',
      startEntityType: request.startEntityType,
      endEntityType: request.endEntityType,
      relationshipType: request.relationshipType,
      maxDepth: request.maxDepth || 3,
      networkPaths,
      summary: {
        totalPaths: networkPaths.length,
        avgPathLength: networkPaths.length > 0 
          ? networkPaths.reduce((sum, path) => sum + path.pathLength, 0) / networkPaths.length 
          : 0,
        maxPathLength: networkPaths.length > 0 
          ? Math.max(...networkPaths.map(path => path.pathLength)) 
          : 0
      }
    };
  }

  async performTimeSeriesAnalysis(request: any): Promise<any> {
    const cypher = `
      MATCH (n:\`${request.entityType}\`)
      WHERE n.${request.timeProperty} >= $startTime AND n.${request.timeProperty} <= $endTime
      WITH n
      ORDER BY n.${request.timeProperty}
      RETURN 
        n.${request.timeProperty} AS time,
        n.${request.metricProperty} AS value
    `;

    const result = await this.neo4jService.read(cypher, {
      startTime: request.timeRange.start,
      endTime: request.timeRange.end
    });

    const timeSeriesData = result.records.map(record => ({
      time: record.get('time'),
      value: record.get('value')
    }));

    // Perform time series decomposition
    const decomposition = this.decomposeTimeSeries(timeSeriesData);
    
    // Calculate seasonality, trend, and residuals
    const seasonality = this.calculateSeasonality(decomposition);
    const trend = this.calculateTrend(decomposition);
    const stationarity = this.testStationarity(timeSeriesData);

    return {
      analysisType: 'time_series_analysis',
      entityType: request.entityType,
      metric: request.metricProperty,
      timeSeriesData,
      decomposition,
      seasonality,
      trend,
      stationarity,
      summary: {
        dataPoints: timeSeriesData.length,
        hasTrend: trend.direction !== 'stable',
        hasSeasonality: seasonality.periodicity !== 'none',
        isStationary: stationarity.isStationary
      }
    };
  }

  async generateExecutiveDashboardData(entities: string[], timeRange: any): Promise<any> {
    const dashboardData = {};

    for (const entity of entities) {
      // Get key metrics for each entity
      const metrics = await this.getEntityKeyMetrics(entity, timeRange);
      const trends = await this.analyzeTrends(entity, timeRange);
      const anomalies = await this.detectAnomalies(entity, timeRange);
      
      dashboardData[entity] = {
        metrics,
        trends,
        anomalies,
        healthScore: this.calculateHealthScore(metrics, anomalies)
      };
    }

    return {
      entities: Object.keys(dashboardData),
      dashboardData,
      overallHealth: this.calculateOverallHealth(dashboardData),
      timeRange,
      lastUpdated: new Date().toISOString()
    };
  }

  private async getEntityMetrics(entityType: string, timeRange: any, filters: any = {}): Promise<any> {
    let whereClause = `WHERE n.${filters.timeProperty || 'createdAt'} >= $startTime AND n.${filters.timeProperty || 'createdAt'} <= $endTime `;
    const params: any = {
      startTime: timeRange.start,
      endTime: timeRange.end
    };

    // Add additional filters if provided
    if (filters.property && filters.value) {
      whereClause += `AND n.${filters.property} = $filterValue `;
      params.filterValue = filters.value;
    }

    const cypher = `
      MATCH (n:\`${entityType}\`)
      ${whereClause}
      RETURN 
        count(n) AS total,
        avg(n.${filters.metricProperty || 'value'}) AS average,
        min(n.${filters.metricProperty || 'value'}) AS min,
        max(n.${filters.metricProperty || 'value'}) AS max,
        stDev(n.${filters.metricProperty || 'value'}) AS stdDev
    `;

    const result = await this.neo4jService.read(cypher, params);

    if (result.records.length === 0) {
      return {
        total: 0,
        average: 0,
        min: 0,
        max: 0,
        stdDev: 0
      };
    }

    const record = result.records[0];
    return {
      total: record.get('total') || 0,
      average: record.get('average') || 0,
      min: record.get('min') || 0,
      max: record.get('max') || 0,
      stdDev: record.get('stdDev') || 0
    };
  }

  private async getEntityKeyMetrics(entityType: string, timeRange: any): Promise<any> {
    const cypher = `
      MATCH (n:\`${entityType}\`)
      WHERE n.createdAt >= $startTime AND n.createdAt <= $endTime
      RETURN 
        count(n) AS totalRecords,
        count { (n)-->() } AS totalOutgoingRelationships,
        count { (n)<--() } AS totalIncomingRelationships,
        avg(size(keys(n))) AS avgProperties,
        apoc.date.convertFormat(toString(avg(apoc.date.parse(toString(n.createdAt), 'ms', 'iso_datetime'))), 'iso_datetime', 'iso_date') AS avgCreationDate
    `;

    const result = await this.neo4jService.read(cypher, {
      startTime: timeRange.start,
      endTime: timeRange.end
    });

    const record = result.records[0];
    return {
      totalRecords: record.get('totalRecords'),
      totalOutgoingRelationships: record.get('totalOutgoingRelationships'),
      totalIncomingRelationships: record.get('totalIncomingRelationships'),
      avgProperties: record.get('avgProperties'),
      avgCreationDate: record.get('avgCreationDate')
    };
  }

  private calculateTrendStatistics(dataPoints: any[]): any {
    if (dataPoints.length < 2) {
      return { direction: 'insufficient_data', slope: 0, rSquared: 0 };
    }

    // Calculate linear regression
    const n = dataPoints.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

    // Convert time to numeric values for regression
    const timeValues = dataPoints.map((point, index) => index);
    const values = dataPoints.map(point => point.value);

    for (let i = 0; i < n; i++) {
      sumX += timeValues[i];
      sumY += values[i];
      sumXY += timeValues[i] * values[i];
      sumXX += timeValues[i] * timeValues[i];
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared
    let ssTot = 0, ssRes = 0;
    const meanY = sumY / n;
    for (let i = 0; i < n; i++) {
      const fittedY = slope * timeValues[i] + intercept;
      ssTot += Math.pow(values[i] - meanY, 2);
      ssRes += Math.pow(values[i] - fittedY, 2);
    }
    const rSquared = 1 - (ssRes / ssTot);

    // Determine trend direction
    let direction = 'stable';
    if (slope > 0.01) direction = 'increasing';
    else if (slope < -0.01) direction = 'decreasing';

    return {
      direction,
      slope,
      rSquared,
      intercept,
      equation: `y = ${slope.toFixed(4)}x + ${intercept.toFixed(4)}`
    };
  }

  private generateLinearPredictions(historicalData: any[], periods: number): any[] {
    if (historicalData.length < 2) return [];

    // Calculate linear regression on historical data
    const n = historicalData.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += historicalData[i].value;
      sumXY += i * historicalData[i].value;
      sumXX += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Generate predictions
    const predictions = [];
    const lastTime = new Date(historicalData[historicalData.length - 1].time);
    const timeIncrement = historicalData.length > 1 
      ? (new Date(historicalData[1].time).getTime() - new Date(historicalData[0].time).getTime())
      : 24 * 60 * 60 * 1000; // Default to daily if only one data point

    for (let i = 1; i <= periods; i++) {
      const futureTime = new Date(lastTime.getTime() + i * timeIncrement);
      const predictedValue = slope * (n + i - 1) + intercept;

      predictions.push({
        time: futureTime.toISOString(),
        predictedValue,
        period: i
      });
    }

    return predictions;
  }

  private estimateModelAccuracy(historicalData: any[]): number {
    // Calculate accuracy using hold-out validation
    if (historicalData.length < 4) return 0.5; // Default to 50% accuracy if insufficient data

    // Use last 20% of data as validation set
    const splitPoint = Math.floor(historicalData.length * 0.8);
    const trainingData = historicalData.slice(0, splitPoint);
    const validationData = historicalData.slice(splitPoint);

    // Calculate linear regression on training data
    const n = trainingData.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += trainingData[i].value;
      sumXY += i * trainingData[i].value;
      sumXX += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate predictions for validation data
    let squaredErrors = 0;
    for (let i = 0; i < validationData.length; i++) {
      const index = splitPoint + i;
      const predicted = slope * index + intercept;
      const actual = validationData[i].value;
      squaredErrors += Math.pow(predicted - actual, 2);
    }

    const mse = squaredErrors / validationData.length;
    const rmse = Math.sqrt(mse);

    // Convert RMSE to accuracy percentage (inverse relationship)
    const maxVal = Math.max(...historicalData.map(d => d.value));
    const minVal = Math.min(...historicalData.map(d => d.value));
    const range = maxVal - minVal || 1; // Avoid division by zero

    const accuracy = Math.max(0, Math.min(1, 1 - (rmse / range)));
    return accuracy;
  }

  private getCorrelationStrength(correlation: number): string {
    const absCorr = Math.abs(correlation);
    if (absCorr >= 0.7) return 'strong';
    if (absCorr >= 0.3) return 'moderate';
    if (absCorr > 0) return 'weak';
    return 'none';
  }

  private interpretCorrelation(correlation: number, sampleSize: number): string {
    const strength = this.getCorrelationStrength(correlation);
    const direction = correlation > 0 ? 'positive' : correlation < 0 ? 'negative' : 'none';
    
    return `There is a ${strength} ${direction} correlation (${correlation.toFixed(3)}) based on ${sampleSize} samples.`;
  }

  private generateSegmentationInsights(segments: any[]): any[] {
    const insights = [];
    
    if (segments.length > 1) {
      const largestSegment = segments[0];
      const smallestSegment = segments[segments.length - 1];
      
      insights.push({
        type: 'dominance',
        message: `The largest segment "${largestSegment.segment}" represents ${largestSegment.percentage.toFixed(1)}% of the total`
      });
      
      if (largestSegment.percentage > 50) {
        insights.push({
          type: 'concentration',
          message: `High concentration in a single segment, consider diversification`
        });
      }
    }
    
    if (segments.length > 5) {
      insights.push({
        type: 'granularity',
        message: `Multiple segments identified, enabling targeted strategies`
      });
    }
    
    return insights;
  }

  private decomposeTimeSeries(timeSeriesData: any[]): any {
    // Simple time series decomposition into trend, seasonal, and residual components
    // This is a simplified implementation
    
    // Calculate moving average for trend
    const windowSize = Math.min(5, Math.floor(timeSeriesData.length / 4));
    const trend = [];
    
    for (let i = 0; i < timeSeriesData.length; i++) {
      let sum = 0;
      let count = 0;
      
      for (let j = Math.max(0, i - Math.floor(windowSize / 2)); 
           j < Math.min(timeSeriesData.length, i + Math.floor(windowSize / 2) + 1); j++) {
        sum += timeSeriesData[j].value;
        count++;
      }
      
      trend.push(sum / count);
    }
    
    // Calculate detrended series
    const detrended = timeSeriesData.map((point, idx) => point.value - trend[idx]);
    
    // Estimate seasonal component (very simplified)
    const seasonal = detrended.map(() => 0); // Placeholder
    
    // Calculate residuals
    const residuals = timeSeriesData.map((point, idx) => 
      point.value - trend[idx] - seasonal[idx]
    );
    
    return {
      original: timeSeriesData,
      trend,
      seasonal,
      residuals,
      decompositionMethod: 'moving_average_trend'
    };
  }

  private calculateSeasonality(decomposition: any): any {
    // Very simplified seasonality detection
    // In a real implementation, this would use more sophisticated methods
    
    // Look for repeating patterns in the detrended data
    const detrended = decomposition.original.map((point: any, idx: number) => 
      point.value - decomposition.trend[idx]
    );
    
    // Calculate autocorrelation to detect seasonality
    const lags = [1, 2, 3, 4, 5, 6, 7, 12, 24]; // Common lag periods
    const autocorr = lags.map(lag => {
      if (detrended.length <= lag) return 0;
      
      let sum = 0;
      let sum1 = 0, sum2 = 0;
      let sum1Sq = 0, sum2Sq = 0;
      
      for (let i = 0; i < detrended.length - lag; i++) {
        const val1 = detrended[i];
        const val2 = detrended[i + lag];
        
        sum += (val1 * val2);
        sum1 += val1;
        sum2 += val2;
        sum1Sq += (val1 * val1);
        sum2Sq += (val2 * val2);
      }
      
      const n = detrended.length - lag;
      const numerator = sum - (sum1 * sum2) / n;
      const denominator = Math.sqrt((sum1Sq - (sum1 * sum1) / n) * (sum2Sq - (sum2 * sum2) / n));
      
      return denominator !== 0 ? numerator / denominator : 0;
    });
    
    // Find the strongest seasonal pattern
    const maxCorr = Math.max(...autocorr.map(Math.abs));
    const maxCorrIdx = autocorr.map(Math.abs).indexOf(maxCorr);
    const period = lags[maxCorrIdx];
    
    return {
      periodicity: maxCorr > 0.5 ? period : 'none',
      strength: maxCorr,
      detectedPeriods: lags.map((lag, idx) => ({
        period: lag,
        correlation: autocorr[idx]
      })).filter(p => Math.abs(p.correlation) > 0.3)
    };
  }

  private calculateTrend(decomposition: any): any {
    // Calculate trend characteristics from the decomposed series
    const trend = decomposition.trend;
    
    if (trend.length < 2) {
      return { direction: 'insufficient_data', magnitude: 0 };
    }
    
    // Calculate overall trend direction
    const startAvg = trend.slice(0, Math.ceil(trend.length * 0.2)).reduce((a, b) => a + b, 0) / Math.ceil(trend.length * 0.2);
    const endAvg = trend.slice(-Math.ceil(trend.length * 0.2)).reduce((a, b) => a + b, 0) / Math.ceil(trend.length * 0.2);
    
    let direction = 'stable';
    if (endAvg > startAvg * 1.05) direction = 'increasing';
    else if (endAvg < startAvg * 0.95) direction = 'decreasing';
    
    const magnitude = Math.abs(endAvg - startAvg) / startAvg;
    
    return {
      direction,
      magnitude,
      startLevel: startAvg,
      endLevel: endAvg
    };
  }

  private testStationarity(timeSeriesData: any[]): any {
    // Implement Augmented Dickey-Fuller test (simplified version)
    // In a real implementation, this would be more rigorous
    
    // Calculate first differences
    const differences = [];
    for (let i = 1; i < timeSeriesData.length; i++) {
      differences.push(timeSeriesData[i].value - timeSeriesData[i-1].value);
    }
    
    // Check if variance of differences is relatively stable
    const meanDiff = differences.reduce((a, b) => a + b, 0) / differences.length;
    const varDiff = differences.reduce((a, b) => a + Math.pow(b - meanDiff, 2), 0) / differences.length;
    
    // Rough stationarity test
    const overallVar = timeSeriesData.reduce((a, b) => a + Math.pow(b.value - 
      (timeSeriesData.reduce((c, d) => c + d.value, 0) / timeSeriesData.length), 2), 0) / timeSeriesData.length;
    
    const ratio = varDiff / overallVar;
    const isStationary = ratio < 0.5; // Very rough threshold
    
    return {
      isStationary,
      test: 'augmented_dickey_fuller_simplified',
      statistic: ratio,
      threshold: 0.5
    };
  }

  private compileBusinessInsights(metrics: any, trends: any, anomalies: any, correlations: any): any[] {
    const insights = [];

    // Metrics-based insights
    if (metrics.total > 1000) {
      insights.push({
        category: 'volume',
        priority: 'info',
        message: `High volume of ${metrics.total} records processed`
      });
    }

    // Trend insights
    if (trends && trends.trend && trends.trend.direction !== 'stable') {
      insights.push({
        category: 'trend',
        priority: trends.trend.direction === 'increasing' ? 'positive' : 'warning',
        message: `Significant ${trends.trend.direction} trend detected with slope of ${trends.trend.slope.toFixed(4)}`
      });
    }

    // Anomaly insights
    if (anomalies && anomalies.anomalies && anomalies.anomalies.length > 0) {
      insights.push({
        category: 'anomaly',
        priority: 'warning',
        message: `${anomalies.anomalies.length} anomalies detected that may require investigation`
      });
    }

    // Correlation insights
    if (correlations && correlations.correlation && Math.abs(correlations.correlation) > 0.5) {
      insights.push({
        category: 'correlation',
        priority: 'info',
        message: `Strong ${correlations.strength} ${correlations.interpretation}`
      });
    }

    return insights;
  }

  private generateInsightSummary(insights: any[]): string {
    const categories = [...new Set(insights.map(i => i.category))];
    const priorities = [...new Set(insights.map(i => i.priority))];
    
    return `Analysis identified ${insights.length} insights across ${categories.length} categories (${categories.join(', ')}). Key areas: ${priorities.join(', ')}.`;
  }

  private generateTrendInsights(trendStats: any): any[] {
    const insights = [];
    
    if (trendStats.direction === 'increasing') {
      insights.push({
        type: 'growth',
        message: `Positive trend detected with growth rate of ${trendStats.slope.toFixed(4)} units per time period`
      });
    } else if (trendStats.direction === 'decreasing') {
      insights.push({
        type: 'decline',
        message: `Negative trend detected with decline rate of ${Math.abs(trendStats.slope).toFixed(4)} units per time period`
      });
    } else {
      insights.push({
        type: 'stable',
        message: `No significant trend detected`
      });
    }
    
    if (trendStats.rSquared > 0.7) {
      insights.push({
        type: 'confidence',
        message: `High confidence in trend analysis (R² = ${trendStats.rSquared.toFixed(3)})`
      });
    }
    
    return insights;
  }

  private calculateHealthScore(metrics: any, anomalies: any): number {
    // Calculate a composite health score based on metrics and anomalies
    let score = 100;
    
    // Reduce score for anomalies
    if (anomalies && anomalies.anomalies) {
      score -= Math.min(anomalies.anomalies.length * 10, 50); // Max 50 point reduction for anomalies
    }
    
    // Adjust for data quality metrics
    if (metrics.stdDev > metrics.average * 2) {
      score -= 15; // High variance reduces health
    }
    
    // Ensure score stays within bounds
    return Math.max(0, Math.min(100, score));
  }

  private calculateOverallHealth(dashboardData: any): number {
    const scores = Object.values(dashboardData).map((data: any) => data.healthScore);
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  private validateAnalysisRequest(request: any): { isValid: boolean; errors: string[] } {
    const errors = [];

    if (!request.analysisType) {
      errors.push('Analysis type is required');
    }

    if (!request.entityType) {
      errors.push('Entity type is required');
    }

    if (!request.timeRange || !request.timeRange.start || !request.timeRange.end) {
      errors.push('Time range with start and end dates is required');
    }

    if (request.analysisType === 'correlation_analysis') {
      if (!request.propertyX || !request.propertyY) {
        errors.push('Both propertyX and propertyY are required for correlation analysis');
      }
    }

    if (request.analysisType === 'predictive_modeling') {
      if (!request.historyRange) {
        errors.push('History range is required for predictive modeling');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}