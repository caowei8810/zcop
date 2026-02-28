import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';

export enum LoadBalancingAlgorithm {
  ROUND_ROBIN = 'round_robin',
  LEAST_CONNECTIONS = 'least_connections',
  IP_HASH = 'ip_hash',
  WEIGHTED_ROUND_ROBIN = 'weighted_round_robin',
}

export interface ServiceInstance {
  id: string;
  host: string;
  port: number;
  weight?: number;
  healthStatus: 'healthy' | 'unhealthy' | 'unknown';
  lastChecked: Date;
  connections: number;
  responseTime: number; // ms
  failureCount: number;
}

export interface LoadBalancerConfig {
  algorithm: LoadBalancingAlgorithm;
  healthCheckInterval: number; // ms
  unhealthyThreshold: number;
  healthyThreshold: number;
  failoverEnabled: boolean;
  stickySessions: boolean;
}

@Injectable()
export class LoadBalancerOptimizationService {
  private readonly logger = new Logger(LoadBalancerOptimizationService.name);
  private serviceInstances: Map<string, ServiceInstance> = new Map();
  private currentIndex = 0;
  private sessionAffinityMap: Map<string, string> = new Map(); // For sticky sessions
  private config: LoadBalancerConfig;

  constructor(private configService: ConfigService) {
    this.config = this.getDefaultConfig();
    this.startHealthChecks();
  }

  private getDefaultConfig(): LoadBalancerConfig {
    return {
      algorithm: LoadBalancingAlgorithm.ROUND_ROBIN,
      healthCheckInterval: this.configService.get<number>('LOAD_BALANCER_HEALTH_CHECK_INTERVAL') || 30000,
      unhealthyThreshold: this.configService.get<number>('LOAD_BALANCER_UNHEALTHY_THRESHOLD') || 3,
      healthyThreshold: this.configService.get<number>('LOAD_BALANCER_HEALTHY_THRESHOLD') || 2,
      failoverEnabled: this.configService.get<boolean>('LOAD_BALANCER_FAILOVER_ENABLED') ?? true,
      stickySessions: this.configService.get<boolean>('LOAD_BALANCER_STICKY_SESSIONS') ?? false,
    };
  }

  /**
   * Register a service instance
   */
  registerInstance(instance: Omit<ServiceInstance, 'connections' | 'responseTime' | 'failureCount'>): void {
    const newInstance: ServiceInstance = {
      ...instance,
      connections: 0,
      responseTime: 0,
      failureCount: 0,
    };
    
    this.serviceInstances.set(instance.id, newInstance);
    this.logger.log(`Registered service instance: ${instance.id} at ${instance.host}:${instance.port}`);
  }

  /**
   * Remove a service instance
   */
  removeInstance(instanceId: string): void {
    this.serviceInstances.delete(instanceId);
    this.logger.log(`Removed service instance: ${instanceId}`);
  }

  /**
   * Select the next available service instance based on the configured algorithm
   */
  getNextInstance(request?: Request): ServiceInstance | null {
    // Filter out unhealthy instances
    const healthyInstances = Array.from(this.serviceInstances.values())
      .filter(instance => instance.healthStatus === 'healthy');

    if (healthyInstances.length === 0) {
      if (this.config.failoverEnabled) {
        // If no healthy instances, return any instance as last resort
        const allInstances = Array.from(this.serviceInstances.values());
        return allInstances.length > 0 ? allInstances[0] : null;
      }
      return null;
    }

    // Handle sticky sessions if enabled
    if (this.config.stickySessions && request) {
      const sessionId = this.getSessionId(request);
      if (sessionId && this.sessionAffinityMap.has(sessionId)) {
        const preferredInstanceId = this.sessionAffinityMap.get(sessionId);
        const preferredInstance = this.serviceInstances.get(preferredInstanceId);
        
        if (preferredInstance && preferredInstance.healthStatus === 'healthy') {
          return preferredInstance;
        }
      }
    }

    let selectedInstance: ServiceInstance;

    switch (this.config.algorithm) {
      case LoadBalancingAlgorithm.ROUND_ROBIN:
        selectedInstance = this.getRoundRobinInstance(healthyInstances);
        break;
        
      case LoadBalancingAlgorithm.LEAST_CONNECTIONS:
        selectedInstance = this.getLeastConnectionsInstance(healthyInstances);
        break;
        
      case LoadBalancingAlgorithm.IP_HASH:
        selectedInstance = this.getIpHashInstance(healthyInstances, request);
        break;
        
      case LoadBalancingAlgorithm.WEIGHTED_ROUND_ROBIN:
        selectedInstance = this.getWeightedRoundRobinInstance(healthyInstances);
        break;
        
      default:
        selectedInstance = this.getRoundRobinInstance(healthyInstances);
    }

    // Update session affinity if enabled
    if (this.config.stickySessions && request && selectedInstance) {
      const sessionId = this.getSessionId(request);
      if (sessionId) {
        this.sessionAffinityMap.set(sessionId, selectedInstance.id);
      }
    }

    return selectedInstance;
  }

  private getRoundRobinInstance(instances: ServiceInstance[]): ServiceInstance {
    // Filter to only healthy instances
    const healthyInstances = instances.filter(i => i.healthStatus === 'healthy');
    
    if (healthyInstances.length === 0) {
      return null;
    }

    const instance = healthyInstances[this.currentIndex % healthyInstances.length];
    this.currentIndex = (this.currentIndex + 1) % healthyInstances.length;
    return instance;
  }

  private getLeastConnectionsInstance(instances: ServiceInstance[]): ServiceInstance {
    return instances.reduce((prev, current) => 
      prev.connections <= current.connections ? prev : current
    );
  }

  private getIpHashInstance(instances: ServiceInstance[], request?: Request): ServiceInstance {
    if (!request) {
      return this.getRoundRobinInstance(instances);
    }

    const clientIp = this.getClientIP(request);
    const hash = this.simpleHash(clientIp);
    return instances[hash % instances.length];
  }

  private getWeightedRoundRobinInstance(instances: ServiceInstance[]): ServiceInstance {
    // Calculate total weight
    const totalWeight = instances.reduce((sum, instance) => sum + (instance.weight || 1), 0);
    
    // Calculate effective weights and select based on weighted round robin
    let currentWeight = 0;
    const randomWeight = Math.random() * totalWeight;
    
    for (const instance of instances) {
      currentWeight += instance.weight || 1;
      if (randomWeight <= currentWeight) {
        return instance;
      }
    }
    
    // Fallback to first instance
    return instances[0];
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  private getSessionId(request: Request): string | null {
    // Try to get session ID from various sources
    return request.cookies?.sessionId || 
           request.headers['x-session-id'] as string || 
           request.headers['x-client-id'] as string ||
           null;
  }

  private getClientIP(request: Request): string {
    return request.ip ||
      request.headers['x-forwarded-for'] as string ||
      request.headers['x-real-ip'] as string ||
      request.connection.remoteAddress ||
      request.socket.remoteAddress ||
      (request.connection as any).remoteAddress;
  }

  /**
   * Mark a request as started for the given instance
   */
  markRequestStarted(instanceId: string): void {
    const instance = this.serviceInstances.get(instanceId);
    if (instance) {
      instance.connections++;
    }
  }

  /**
   * Mark a request as completed for the given instance
   */
  markRequestCompleted(instanceId: string, responseTime: number, success: boolean): void {
    const instance = this.serviceInstances.get(instanceId);
    if (instance) {
      instance.connections--;
      
      // Update response time average (simple moving average)
      instance.responseTime = (instance.responseTime + responseTime) / 2;
      
      // Update failure count
      if (!success) {
        instance.failureCount++;
        if (instance.failureCount >= this.config.unhealthyThreshold) {
          instance.healthStatus = 'unhealthy';
          this.logger.warn(`Marked instance ${instanceId} as unhealthy due to failures`);
        }
      } else {
        // Reset failure count on success
        instance.failureCount = Math.max(0, instance.failureCount - 1);
        if (instance.healthStatus !== 'healthy' && instance.failureCount <= this.config.healthyThreshold) {
          instance.healthStatus = 'healthy';
          this.logger.log(`Marked instance ${instanceId} as healthy after recoveries`);
        }
      }
    }
  }

  /**
   * Perform health checks on all registered instances
   */
  private async performHealthChecks(): Promise<void> {
    const healthCheckPromises = Array.from(this.serviceInstances.values()).map(async (instance) => {
      try {
        // In a real implementation, this would perform an actual health check
        // For now, we'll simulate a health check
        const isHealthy = await this.simulateHealthCheck(instance);
        
        if (isHealthy) {
          instance.healthStatus = 'healthy';
          instance.lastChecked = new Date();
        } else {
          instance.healthStatus = 'unhealthy';
          instance.lastChecked = new Date();
        }
      } catch (error) {
        instance.healthStatus = 'unhealthy';
        instance.lastChecked = new Date();
        this.logger.error(`Health check failed for instance ${instance.id}: ${error.message}`);
      }
    });

    await Promise.all(healthCheckPromises);
  }

  private async simulateHealthCheck(instance: ServiceInstance): Promise<boolean> {
    // Simulate a health check - in real implementation, make HTTP request to health endpoint
    return new Promise((resolve) => {
      // Simulate network delay
      const delay = Math.floor(Math.random() * 100);
      
      setTimeout(() => {
        // Simulate 95% success rate
        resolve(Math.random() > 0.05);
      }, delay);
    });
  }

  private startHealthChecks(): void {
    // Start periodic health checks
    setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.healthCheckInterval);
  }

  /**
   * Get load balancer statistics
   */
  getStatistics() {
    const instances = Array.from(this.serviceInstances.values());
    
    return {
      totalInstances: instances.length,
      healthyInstances: instances.filter(i => i.healthStatus === 'healthy').length,
      unhealthyInstances: instances.filter(i => i.healthStatus === 'unhealthy').length,
      unknownInstances: instances.filter(i => i.healthStatus === 'unknown').length,
      algorithm: this.config.algorithm,
      stickySessions: this.config.stickySessions,
      instances: instances.map(instance => ({
        id: instance.id,
        host: instance.host,
        port: instance.port,
        weight: instance.weight,
        healthStatus: instance.healthStatus,
        connections: instance.connections,
        responseTime: instance.responseTime,
        failureCount: instance.failureCount,
      })),
    };
  }

  /**
   * Update load balancer configuration
   */
  updateConfig(newConfig: Partial<LoadBalancerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.log(`Updated load balancer configuration: ${JSON.stringify(newConfig)}`);
  }
}