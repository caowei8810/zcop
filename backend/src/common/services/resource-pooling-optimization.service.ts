import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ResourcePoolConfig {
  maxResources: number;
  minResources: number;
  acquireTimeout: number;
  idleTimeout: number;
  evictionRunIntervalMillis: number;
  numTestsPerEvictionRun: number;
}

export interface ResourcePoolStats {
  available: number;
  allocated: number;
  pending: number;
  max: number;
  min: number;
  utilization: number;
}

export interface OptimizedResource<T> {
  id: string;
  resource: T;
  createdAt: number;
  lastUsed: number;
  usageCount: number;
}

@Injectable()
export class ResourcePoolingOptimizationService {
  private readonly logger = new Logger(ResourcePoolingOptimizationService.name);
  private pools: Map<string, {
    resources: OptimizedResource<T>[];
    available: string[];
    allocated: Map<string, string>; // resource id -> client id
    config: ResourcePoolConfig;
    stats: {
      totalAcquired: number;
      totalReleased: number;
      totalCreated: number;
      totalDestroyed: number;
      waitCount: number;
      waitTimeTotal: number;
    };
  }> = new Map();

  constructor(private configService: ConfigService) {}

  /**
   * Initialize a resource pool with the given configuration
   */
  async initializePool<T>(poolName: string, config: ResourcePoolConfig): Promise<void> {
    if (this.pools.has(poolName)) {
      throw new Error(`Pool ${poolName} already exists`);
    }

    const pool = {
      resources: [] as OptimizedResource<T>[],
      available: [] as string[],
      allocated: new Map<string, string>(),
      config,
      stats: {
        totalAcquired: 0,
        totalReleased: 0,
        totalCreated: 0,
        totalDestroyed: 0,
        waitCount: 0,
        waitTimeTotal: 0,
      }
    };

    // Pre-populate the pool with minimum resources
    for (let i = 0; i < config.minResources; i++) {
      const resource = await this.createResource<T>(poolName);
      pool.resources.push(resource);
      pool.available.push(resource.id);
    }

    this.pools.set(poolName, pool);
    this.logger.log(`Initialized resource pool: ${poolName} with ${config.minResources} resources`);
  }

  /**
   * Acquire a resource from the pool
   */
  async acquire<T>(poolName: string, clientId: string): Promise<T> {
    const pool = this.pools.get(poolName);
    if (!pool) {
      throw new Error(`Pool ${poolName} does not exist`);
    }

    const startTime = Date.now();
    pool.stats.waitCount++;

    return new Promise<T>((resolve, reject) => {
      const tryAcquire = () => {
        if (pool.available.length > 0) {
          // Get an available resource
          const resourceId = pool.available.shift()!;
          const resource = pool.resources.find(r => r.id === resourceId)!;
          
          // Mark as allocated
          pool.allocated.set(resourceId, clientId);
          resource.lastUsed = Date.now();
          resource.usageCount++;
          
          pool.stats.totalAcquired++;
          pool.stats.waitTimeTotal += Date.now() - startTime;
          
          this.logger.debug(`Acquired resource ${resourceId} from pool ${poolName}`);
          resolve(resource.resource);
        } else if (pool.resources.length < pool.config.maxResources) {
          // Create a new resource if we're under the max limit
          this.createResource<T>(poolName)
            .then(resource => {
              pool.resources.push(resource);
              pool.allocated.set(resource.id, clientId);
              
              pool.stats.totalAcquired++;
              pool.stats.totalCreated++;
              pool.stats.waitTimeTotal += Date.now() - startTime;
              
              this.logger.debug(`Created and acquired new resource ${resource.id} from pool ${poolName}`);
              resolve(resource.resource);
            })
            .catch(reject);
        } else {
          // All resources are taken, wait for one to become available
          setTimeout(() => {
            // Check if timeout has been reached
            if (Date.now() - startTime >= pool.config.acquireTimeout) {
              pool.stats.waitCount--; // Don't count this as a successful wait
              reject(new Error(`Timeout acquiring resource from pool ${poolName}`));
            } else {
              tryAcquire();
            }
          }, 10);
        }
      };

      tryAcquire();
    });
  }

  /**
   * Release a resource back to the pool
   */
  release<T>(poolName: string, resource: T): void {
    const pool = this.pools.get(poolName);
    if (!pool) {
      throw new Error(`Pool ${poolName} does not exist`);
    }

    // Find the resource in the allocated map
    let resourceId: string | undefined;
    for (const [id, res] of pool.resources.entries()) {
      if (res.resource === resource) {
        resourceId = res.id;
        break;
      }
    }

    if (!resourceId) {
      throw new Error('Attempting to release unknown resource');
    }

    // Check if the resource is actually allocated
    if (!pool.allocated.has(resourceId)) {
      throw new Error(`Resource ${resourceId} is not currently allocated`);
    }

    // Remove from allocated and add to available
    pool.allocated.delete(resourceId);
    pool.available.push(resourceId);
    
    pool.stats.totalReleased++;

    this.logger.debug(`Released resource ${resourceId} back to pool ${poolName}`);
  }

  /**
   * Destroy a resource and remove it from the pool
   */
  async destroy<T>(poolName: string, resource: T): Promise<void> {
    const pool = this.pools.get(poolName);
    if (!pool) {
      throw new Error(`Pool ${poolName} does not exist`);
    }

    const resourceIndex = pool.resources.findIndex(r => r.resource === resource);
    if (resourceIndex === -1) {
      throw new Error('Attempting to destroy unknown resource');
    }

    const resourceEntry = pool.resources[resourceIndex];
    
    // If the resource is allocated, remove it from allocation
    if (pool.allocated.has(resourceEntry.id)) {
      pool.allocated.delete(resourceEntry.id);
    } else {
      // If it's available, remove it from available
      const availableIndex = pool.available.indexOf(resourceEntry.id);
      if (availableIndex !== -1) {
        pool.available.splice(availableIndex, 1);
      }
    }

    // Remove from resources
    pool.resources.splice(resourceIndex, 1);
    pool.stats.totalDestroyed++;

    this.logger.debug(`Destroyed resource ${resourceEntry.id} from pool ${poolName}`);
  }

  /**
   * Create a new resource
   */
  private async createResource<T>(poolName: string): Promise<OptimizedResource<T>> {
    // In a real implementation, this would create the actual resource
    // For now, we'll simulate with a placeholder resource
    const id = this.generateResourceId();
    
    // This is where you'd create the actual resource (e.g., database connection, HTTP client, etc.)
    const resource = {} as T; // Placeholder - implement actual resource creation
    
    return {
      id,
      resource,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      usageCount: 0,
    };
  }

  /**
   * Get pool statistics
   */
  getStats(poolName: string): ResourcePoolStats | null {
    const pool = this.pools.get(poolName);
    if (!pool) {
      return null;
    }

    const allocatedCount = pool.allocated.size;
    const availableCount = pool.available.length;
    const totalCount = pool.resources.length;
    
    return {
      available: availableCount,
      allocated: allocatedCount,
      pending: pool.stats.waitCount,
      max: pool.config.maxResources,
      min: pool.config.minResources,
      utilization: totalCount > 0 ? allocatedCount / totalCount : 0,
    };
  }

  /**
   * Get detailed pool information
   */
  getPoolInfo(poolName: string): any {
    const pool = this.pools.get(poolName);
    if (!pool) {
      return null;
    }

    return {
      config: pool.config,
      stats: pool.stats,
      resourceCount: pool.resources.length,
      allocatedCount: pool.allocated.size,
      availableCount: pool.available.length,
      resources: pool.resources.map(r => ({
        id: r.id,
        age: Date.now() - r.createdAt,
        timeSinceLastUsed: Date.now() - r.lastUsed,
        usageCount: r.usageCount,
      })),
    };
  }

  /**
   * Run maintenance on the pool (remove stale resources)
   */
  async runMaintenance(poolName: string): Promise<void> {
    const pool = this.pools.get(poolName);
    if (!pool) {
      throw new Error(`Pool ${poolName} does not exist`);
    }

    const now = Date.now();
    const idleTimeout = pool.config.idleTimeout;
    
    // Identify resources that have been idle too long
    const staleResources = pool.resources.filter(resource => {
      return (now - resource.lastUsed) > idleTimeout && 
             pool.allocated.get(resource.id) === undefined; // Not currently allocated
    });

    // Remove stale resources
    for (const resource of staleResources) {
      const index = pool.resources.findIndex(r => r.id === resource.id);
      if (index !== -1) {
        pool.resources.splice(index, 1);
        const availableIndex = pool.available.indexOf(resource.id);
        if (availableIndex !== -1) {
          pool.available.splice(availableIndex, 1);
        }
        pool.stats.totalDestroyed++;
      }
    }

    this.logger.debug(`Maintenance on pool ${poolName}: removed ${staleResources.length} stale resources`);

    // Ensure we maintain the minimum number of resources
    const missingResources = pool.config.minResources - pool.resources.length;
    if (missingResources > 0) {
      for (let i = 0; i < missingResources; i++) {
        const resource = await this.createResource<T>(poolName);
        pool.resources.push(resource);
        pool.available.push(resource.id);
        pool.stats.totalCreated++;
      }
      
      this.logger.debug(`Maintenance on pool ${poolName}: added ${missingResources} resources to meet minimum`);
    }
  }

  /**
   * Run maintenance on all pools
   */
  async runMaintenanceAll(): Promise<void> {
    for (const poolName of this.pools.keys()) {
      await this.runMaintenance(poolName);
    }
  }

  /**
   * Close a pool and destroy all resources
   */
  async closePool(poolName: string): Promise<void> {
    const pool = this.pools.get(poolName);
    if (!pool) {
      throw new Error(`Pool ${poolName} does not exist`);
    }

    // Destroy all resources in the pool
    for (const resource of pool.resources) {
      // In a real implementation, you would properly dispose of the resource here
    }

    this.pools.delete(poolName);
    this.logger.log(`Closed resource pool: ${poolName}`);
  }

  /**
   * Generate a unique resource ID
   */
  private generateResourceId(): string {
    return `res_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`;
  }

  /**
   * Get all pool names
   */
  getPoolNames(): string[] {
    return Array.from(this.pools.keys());
  }

  /**
   * Adjust pool size dynamically
   */
  async adjustPoolSize(poolName: string, newSize: number): Promise<void> {
    const pool = this.pools.get(poolName);
    if (!pool) {
      throw new Error(`Pool ${poolName} does not exist`);
    }

    const currentSize = pool.resources.length;
    
    if (newSize > currentSize) {
      // Scale up
      const diff = newSize - currentSize;
      for (let i = 0; i < diff; i++) {
        const resource = await this.createResource<T>(poolName);
        pool.resources.push(resource);
        pool.available.push(resource.id);
        pool.stats.totalCreated++;
      }
      this.logger.log(`Scaled up pool ${poolName} from ${currentSize} to ${newSize} resources`);
    } else if (newSize < currentSize) {
      // Scale down (only remove unallocated resources)
      const allocatedCount = pool.allocated.size;
      if (newSize < allocatedCount) {
        throw new Error(`Cannot scale down pool ${poolName} to ${newSize} as ${allocatedCount} resources are currently allocated`);
      }
      
      const diff = currentSize - newSize;
      let removed = 0;
      
      for (let i = pool.resources.length - 1; i >= 0 && removed < diff; i--) {
        const resource = pool.resources[i];
        if (!pool.allocated.has(resource.id)) {
          // This resource is not allocated, safe to remove
          pool.resources.splice(i, 1);
          const availableIndex = pool.available.indexOf(resource.id);
          if (availableIndex !== -1) {
            pool.available.splice(availableIndex, 1);
          }
          pool.stats.totalDestroyed++;
          removed++;
        }
      }
      
      this.logger.log(`Scaled down pool ${poolName} from ${currentSize} to ${newSize} resources`);
    }
  }
}