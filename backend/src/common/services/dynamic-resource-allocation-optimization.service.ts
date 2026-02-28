import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface DynamicResourceAllocationConfig {
  enabled: boolean;
  minResources: number;
  maxResources: number;
  scalingFactor: number;         // Factor to determine scaling sensitivity
  scalingCooldown: number;      // Time in ms before next scaling decision
  resourceCheckInterval: number; // How often to check resource usage
  cpuThreshold: number;         // CPU usage percentage that triggers scaling
  memoryThreshold: number;      // Memory usage percentage that triggers scaling
  throughputThreshold: number;  // Requests per second that triggers scaling
  costPerResource: number;      // Cost per resource unit
  benefitPerRequest: number;    // Benefit per request served
}

export interface ResourceMetrics {
  cpuUsage: number;             // Percentage
  memoryUsage: number;          // Percentage
  activeConnections: number;
  requestsPerSecond: number;
  averageResponseTime: number;  // In milliseconds
  errorRate: number;            // Percentage
  allocatedResources: number;
  availableResources: number;
  totalResources: number;
}

export interface AllocationDecision {
  action: 'scale-up' | 'scale-down' | 'maintain';
  amount: number;              // Number of resources to add/remove
  reason: string;              // Reason for the decision
  confidence: number;          // Confidence level (0-1)
  costBenefitRatio: number;    // Calculated cost-benefit ratio
}

export interface ResourcePool {
  id: string;
  type: string;               // 'compute', 'storage', 'network', etc.
  allocated: number;
  available: number;
  maxCapacity: number;
  utilization: number;         // Current utilization percentage
  efficiency: number;          // Efficiency rating (0-1)
  lastScalingAction: number;   // Timestamp of last scaling action
}

@Injectable()
export class DynamicResourceAllocationOptimizationService {
  private readonly logger = new Logger(DynamicResourceAllocationOptimizationService.name);
  private config: DynamicResourceAllocationConfig;
  private resourcePools: Map<string, ResourcePool> = new Map();
  private metricsHistory: ResourceMetrics[] = [];
  private lastScalingDecision: number = 0;
  private currentAllocation: number = 0;
  private timer: NodeJS.Timeout | null = null;
  private costAccumulator: number = 0;
  private benefitAccumulator: number = 0;

  constructor(private configService: ConfigService) {
    this.config = {
      enabled: this.configService.get<boolean>('RESOURCE_SCALING_ENABLED') ?? true,
      minResources: this.configService.get<number>('RESOURCE_MIN_COUNT') || 2,
      maxResources: this.configService.get<number>('RESOURCE_MAX_COUNT') || 20,
      scalingFactor: this.configService.get<number>('RESOURCE_SCALING_FACTOR') || 1.5,
      scalingCooldown: this.configService.get<number>('RESOURCE_SCALING_COOLDOWN') || 30000, // 30 seconds
      resourceCheckInterval: this.configService.get<number>('RESOURCE_CHECK_INTERVAL') || 10000, // 10 seconds
      cpuThreshold: this.configService.get<number>('RESOURCE_CPU_THRESHOLD') || 75, // 75%
      memoryThreshold: this.configService.get<number>('RESOURCE_MEMORY_THRESHOLD') || 80, // 80%
      throughputThreshold: this.configService.get<number>('RESOURCE_THROUGHPUT_THRESHOLD') || 100, // 100 RPS
      costPerResource: this.configService.get<number>('RESOURCE_COST_PER_UNIT') || 0.1,
      benefitPerRequest: this.configService.get<number>('RESOURCE_BENEFIT_PER_REQUEST') || 0.01,
    };

    this.currentAllocation = this.config.minResources;
    
    // Initialize default resource pools
    this.initializeDefaultPools();
    
    // Start the monitoring loop
    this.startMonitoring();
  }

  /**
   * Initialize default resource pools
   */
  private initializeDefaultPools(): void {
    // Compute pool
    this.resourcePools.set('compute', {
      id: 'compute',
      type: 'compute',
      allocated: this.currentAllocation,
      available: 0, // Initially all allocated
      maxCapacity: this.config.maxResources,
      utilization: 0,
      efficiency: 1.0,
      lastScalingAction: Date.now(),
    });

    // Storage pool
    this.resourcePools.set('storage', {
      id: 'storage',
      type: 'storage',
      allocated: Math.floor(this.currentAllocation * 0.5), // Half of compute
      available: 0,
      maxCapacity: Math.floor(this.config.maxResources * 0.8),
      utilization: 0,
      efficiency: 1.0,
      lastScalingAction: Date.now(),
    });

    // Network pool
    this.resourcePools.set('network', {
      id: 'network',
      type: 'network',
      allocated: Math.floor(this.currentAllocation * 0.3), // 30% of compute
      available: 0,
      maxCapacity: Math.floor(this.config.maxResources * 0.6),
      utilization: 0,
      efficiency: 1.0,
      lastScalingAction: Date.now(),
    });
  }

  /**
   * Start the resource monitoring loop
   */
  private startMonitoring(): void {
    this.timer = setInterval(async () => {
      await this.evaluateAndScale();
    }, this.config.resourceCheckInterval);

    this.logger.log(`Started dynamic resource allocation monitor with ${this.config.resourceCheckInterval}ms interval`);
  }

  /**
   * Evaluate current metrics and decide on scaling action
   */
  async evaluateAndScale(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    // Get current metrics
    const metrics = await this.collectMetrics();
    this.metricsHistory.push(metrics);
    
    // Keep only recent history
    if (this.metricsHistory.length > 100) {
      this.metricsHistory.shift();
    }

    // Make scaling decision
    const decision = this.makeAllocationDecision(metrics);
    
    // Apply decision if appropriate
    if (decision.action !== 'maintain' && 
        Date.now() - this.lastScalingDecision > this.config.scalingCooldown) {
      
      await this.executeScalingAction(decision);
      this.lastScalingDecision = Date.now();
      
      // Update resource pool timestamps
      for (const pool of this.resourcePools.values()) {
        pool.lastScalingAction = Date.now();
      }
    }

    // Update efficiency metrics
    this.updateEfficiencyMetrics(metrics);
  }

  /**
   * Collect current system metrics
   */
  async collectMetrics(): Promise<ResourceMetrics> {
    // In a real implementation, this would collect actual system metrics
    // For this example, we'll simulate metrics based on current allocation and load

    // Simulate metrics with some randomness
    const cpuUsage = Math.min(100, Math.max(0, 
      30 + (this.currentAllocation / this.config.maxResources) * 60 + (Math.random() * 10 - 5)
    ));
    
    const memoryUsage = Math.min(100, Math.max(0,
      25 + (this.currentAllocation / this.config.maxResources) * 65 + (Math.random() * 10 - 5)
    ));
    
    // Simulate requests per second based on allocation
    const baseRps = 50;
    const requestsPerSecond = Math.max(baseRps, 
      baseRps * (this.currentAllocation / this.config.minResources) + (Math.random() * 20 - 10)
    );
    
    // Average response time decreases with more resources
    const averageResponseTime = Math.max(50,
      200 / (this.currentAllocation / this.config.minResources) + (Math.random() * 20 - 10)
    );
    
    // Error rate increases when resources are strained
    const errorRate = Math.min(10,
      cpuUsage > 90 || memoryUsage > 90 ? 5 + (Math.random() * 5) : Math.random() * 2
    );

    const metrics: ResourceMetrics = {
      cpuUsage,
      memoryUsage,
      activeConnections: Math.floor(requestsPerSecond * averageResponseTime / 1000),
      requestsPerSecond,
      averageResponseTime,
      errorRate,
      allocatedResources: this.currentAllocation,
      availableResources: Math.max(0, this.config.maxResources - this.currentAllocation),
      totalResources: this.config.maxResources,
    };

    return metrics;
  }

  /**
   * Make a scaling decision based on metrics
   */
  makeAllocationDecision(metrics: ResourceMetrics): AllocationDecision {
    // Calculate various factors for decision making
    const cpuPressure = metrics.cpuUsage / this.config.cpuThreshold;
    const memoryPressure = metrics.memoryUsage / this.config.memoryThreshold;
    const throughputPressure = metrics.requestsPerSecond / this.config.throughputThreshold;
    
    // Determine if we need to scale up or down
    const pressure = Math.max(cpuPressure, memoryPressure, throughputPressure);
    
    // Calculate how much to scale
    let amount = 0;
    let action: 'scale-up' | 'scale-down' | 'maintain' = 'maintain';
    let reason = '';
    let confidence = 0.5; // Default confidence
    
    if (pressure > 1.1) {
      // Scale up
      action = 'scale-up';
      amount = Math.ceil((pressure - 1) * this.config.scalingFactor);
      reason = `Resource pressure (CPU: ${metrics.cpuUsage}%, Memory: ${metrics.memoryUsage}%, Throughput: ${metrics.requestsPerSecond} RPS) exceeds thresholds`;
      confidence = Math.min(0.9, pressure / 2); // Higher pressure = higher confidence
    } else if (pressure < 0.7 && this.currentAllocation > this.config.minResources) {
      // Scale down
      action = 'scale-down';
      amount = Math.min(
        Math.floor((1 - pressure) * this.config.scalingFactor),
        this.currentAllocation - this.config.minResources
      );
      reason = `Low resource utilization (CPU: ${metrics.cpuUsage}%, Memory: ${metrics.memoryUsage}%, Throughput: ${metrics.requestsPerSecond} RPS)`;
      confidence = Math.min(0.8, (1 - pressure) / 2);
    } else {
      // Maintain current allocation
      action = 'maintain';
      amount = 0;
      reason = `Current allocation sufficient (CPU: ${metrics.cpuUsage}%, Memory: ${metrics.memoryUsage}%, Throughput: ${metrics.requestsPerSecond} RPS)`;
      confidence = 0.7; // We're confident the current state is OK
    }
    
    // Ensure we don't exceed bounds
    if (action === 'scale-up' && this.currentAllocation + amount > this.config.maxResources) {
      amount = this.config.maxResources - this.currentAllocation;
    } else if (action === 'scale-down' && this.currentAllocation - amount < this.config.minResources) {
      amount = this.currentAllocation - this.config.minResources;
    }
    
    // Calculate cost-benefit ratio
    const cost = amount * this.config.costPerResource;
    const benefit = amount * metrics.requestsPerSecond * this.config.benefitPerRequest;
    const costBenefitRatio = benefit > 0 ? cost / benefit : Infinity;
    
    return {
      action,
      amount,
      reason,
      confidence,
      costBenefitRatio,
    };
  }

  /**
   * Execute the scaling action
   */
  async executeScalingAction(decision: AllocationDecision): Promise<void> {
    if (decision.amount <= 0) {
      return;
    }

    if (decision.action === 'scale-up') {
      await this.scaleUp(decision.amount);
      this.logger.log(`Scaled up by ${decision.amount} resources. Reason: ${decision.reason}`);
    } else if (decision.action === 'scale-down') {
      await this.scaleDown(decision.amount);
      this.logger.log(`Scaled down by ${decision.amount} resources. Reason: ${decision.reason}`);
    }

    // Update cost and benefit accumulators
    const cost = decision.amount * this.config.costPerResource;
    const benefit = decision.amount * this.config.throughputThreshold * this.config.benefitPerRequest;
    
    this.costAccumulator += cost;
    this.benefitAccumulator += benefit;
  }

  /**
   * Scale up resources
   */
  async scaleUp(amount: number): Promise<void> {
    const newAllocation = Math.min(this.currentAllocation + amount, this.config.maxResources);
    const actualIncrease = newAllocation - this.currentAllocation;
    
    if (actualIncrease <= 0) {
      return;
    }

    // Update resource pools proportionally
    for (const pool of this.resourcePools.values()) {
      const currentRatio = pool.allocated / this.currentAllocation;
      const newAllocation = Math.min(
        Math.round(currentRatio * newAllocation),
        pool.maxCapacity
      );
      
      pool.allocated = newAllocation;
      pool.available = pool.maxCapacity - pool.allocated;
    }

    this.currentAllocation = newAllocation;
    this.logger.debug(`Scaled up: ${actualIncrease} resources added, total: ${this.currentAllocation}`);
  }

  /**
   * Scale down resources
   */
  async scaleDown(amount: number): Promise<void> {
    const newAllocation = Math.max(this.currentAllocation - amount, this.config.minResources);
    const actualDecrease = this.currentAllocation - newAllocation;
    
    if (actualDecrease <= 0) {
      return;
    }

    // Update resource pools proportionally
    for (const pool of this.resourcePools.values()) {
      const currentRatio = pool.allocated / this.currentAllocation;
      const newAllocation = Math.max(
        Math.round(currentRatio * newAllocation),
        pool.id === 'compute' ? this.config.minResources : Math.floor(this.config.minResources * 0.5)
      );
      
      pool.allocated = newAllocation;
      pool.available = pool.maxCapacity - pool.allocated;
    }

    this.currentAllocation = newAllocation;
    this.logger.debug(`Scaled down: ${actualDecrease} resources removed, total: ${this.currentAllocation}`);
  }

  /**
   * Update efficiency metrics based on performance
   */
  private updateEfficiencyMetrics(metrics: ResourceMetrics): void {
    // Calculate efficiency for each resource pool
    for (const pool of this.resourcePools.values()) {
      // Efficiency is inversely related to resource pressure and directly related to performance
      const cpuEfficiency = 1 - (metrics.cpuUsage / 100);
      const perfEfficiency = 1 / (1 + metrics.averageResponseTime / 100); // Lower response time = higher efficiency
      const errorPenalty = 1 - (metrics.errorRate / 100); // Lower error rate = higher efficiency
      
      // Weighted combination of factors
      pool.efficiency = (cpuEfficiency * 0.4) + (perfEfficiency * 0.4) + (errorPenalty * 0.2);
      pool.utilization = (pool.allocated / pool.maxCapacity) * 100;
    }
  }

  /**
   * Get current resource allocation status
   */
  getResourceStatus(): {
    currentAllocation: number;
    metrics: ResourceMetrics;
    pools: ResourcePool[];
    decision: AllocationDecision | null;
    costAccumulator: number;
    benefitAccumulator: number;
  } {
    const metrics = this.metricsHistory.length > 0 
      ? this.metricsHistory[this.metricsHistory.length - 1] 
      : null;
      
    const decision = metrics ? this.makeAllocationDecision(metrics) : null;
    
    return {
      currentAllocation: this.currentAllocation,
      metrics: metrics!,
      pools: Array.from(this.resourcePools.values()),
      decision,
      costAccumulator: this.costAccumulator,
      benefitAccumulator: this.benefitAccumulator,
    };
  }

  /**
   * Get resource allocation recommendations
   */
  getRecommendations(): {
    suggestedAllocation: number;
    reasons: string[];
    confidence: number;
  } {
    if (this.metricsHistory.length === 0) {
      return {
        suggestedAllocation: this.currentAllocation,
        reasons: ['No metrics collected yet'],
        confidence: 0,
      };
    }

    const latestMetrics = this.metricsHistory[this.metricsHistory.length - 1];
    const decision = this.makeAllocationDecision(latestMetrics);

    return {
      suggestedAllocation: decision.action === 'scale-up' 
        ? this.currentAllocation + decision.amount
        : decision.action === 'scale-down'
        ? this.currentAllocation - decision.amount
        : this.currentAllocation,
      reasons: [decision.reason],
      confidence: decision.confidence,
    };
  }

  /**
   * Manually trigger scaling evaluation
   */
  async triggerEvaluation(): Promise<void> {
    await this.evaluateAndScale();
  }

  /**
   * Override current allocation (use with caution)
   */
  async setAllocation(target: number): Promise<void> {
    if (target < this.config.minResources || target > this.config.maxResources) {
      throw new Error(`Target allocation ${target} is outside allowed range [${this.config.minResources}, ${this.config.maxResources}]`);
    }

    const diff = target - this.currentAllocation;
    if (diff > 0) {
      await this.scaleUp(diff);
    } else if (diff < 0) {
      await this.scaleDown(Math.abs(diff));
    }

    this.logger.log(`Manually set allocation to ${target} resources`);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<DynamicResourceAllocationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.log('Updated dynamic resource allocation configuration');
  }

  /**
   * Get efficiency report
   */
  getEfficiencyReport(): {
    overallEfficiency: number;
    poolEfficiencies: { poolId: string; efficiency: number }[];
    utilizationReport: { poolId: string; utilization: number }[];
    costBenefitAnalysis: {
      totalCost: number;
      totalBenefit: number;
      netBenefit: number;
      roi: number;
    };
  } {
    // Calculate overall efficiency as average of pool efficiencies
    const poolEfficiencies = Array.from(this.resourcePools.values())
      .map(pool => ({ poolId: pool.id, efficiency: pool.efficiency }));
    
    const overallEfficiency = poolEfficiencies.reduce((sum, p) => sum + p.efficiency, 0) / poolEfficiencies.length;
    
    // Utilization report
    const utilizationReport = Array.from(this.resourcePools.values())
      .map(pool => ({ poolId: pool.id, utilization: pool.utilization }));
    
    // Cost-benefit analysis
    const costBenefitAnalysis = {
      totalCost: this.costAccumulator,
      totalBenefit: this.benefitAccumulator,
      netBenefit: this.benefitAccumulator - this.costAccumulator,
      roi: this.costAccumulator > 0 ? (this.benefitAccumulator - this.costAccumulator) / this.costAccumulator : 0,
    };

    return {
      overallEfficiency,
      poolEfficiencies,
      utilizationReport,
      costBenefitAnalysis,
    };
  }

  /**
   * Close the resource allocation service
   */
  close(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.logger.log('Dynamic resource allocation service closed');
  }
}