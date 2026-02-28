import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface MemoryPoolConfig {
  maxPoolSize: number; // Maximum size of the memory pool in bytes
  gcThreshold: number; // Threshold to trigger garbage collection
  cleanupInterval: number; // Interval for cleanup operations in ms
  objectRetentionTime: number; // How long to retain objects in ms
}

export interface PooledObject<T> {
  id: string;
  data: T;
  createdAt: number;
  lastAccessed: number;
  refCount: number;
}

@Injectable()
export class MemoryManagementOptimizationService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(MemoryManagementOptimizationService.name);
  private memoryPool: Map<string, PooledObject<any>> = new Map();
  private memoryPoolSize = 0;
  private readonly maxPoolSize: number;
  private readonly gcThreshold: number;
  private readonly cleanupInterval: number;
  private readonly objectRetentionTime: number;
  private cleanupTimer: NodeJS.Timeout;
  private gcTimer: NodeJS.Timeout;

  constructor(private configService: ConfigService) {
    this.maxPoolSize = this.configService.get<number>('MEMORY_POOL_MAX_SIZE') || 100 * 1024 * 1024; // 100MB default
    this.gcThreshold = this.configService.get<number>('MEMORY_GC_THRESHOLD') || 0.8; // 80% threshold
    this.cleanupInterval = this.configService.get<number>('MEMORY_CLEANUP_INTERVAL') || 30000; // 30s default
    this.objectRetentionTime = this.configService.get<number>('MEMORY_OBJECT_RETENTION_TIME') || 300000; // 5min default
  }

  async onApplicationBootstrap() {
    this.startCleanupProcess();
    this.startGCMonitoring();
    this.logger.log('Memory management optimization service initialized');
  }

  async onApplicationShutdown() {
    this.stopCleanupProcess();
    this.clearMemoryPool();
    this.logger.log('Memory management optimization service shut down');
  }

  /**
   * Allocate memory in the pool
   */
  allocate<T>(id: string, data: T): PooledObject<T> {
    // Check if object already exists
    if (this.memoryPool.has(id)) {
      const pooledObj = this.memoryPool.get(id) as PooledObject<T>;
      pooledObj.lastAccessed = Date.now();
      pooledObj.refCount++;
      return pooledObj;
    }

    // Estimate size of the object (simplified estimation)
    const estimatedSize = this.estimateSize(data);
    
    // Check if adding this object would exceed the pool size
    if (this.memoryPoolSize + estimatedSize > this.maxPoolSize) {
      this.logger.warn(`Memory pool size would exceed maximum. Initiating cleanup.`);
      this.cleanupExpiredObjects();
      
      // If still exceeding after cleanup, try to evict least recently used objects
      if (this.memoryPoolSize + estimatedSize > this.maxPoolSize) {
        this.evictLRUObjects(estimatedSize);
      }
    }

    const pooledObject: PooledObject<T> = {
      id,
      data,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      refCount: 1,
    };

    this.memoryPool.set(id, pooledObject as PooledObject<any>);
    this.memoryPoolSize += estimatedSize;

    this.logger.debug(`Allocated memory for object: ${id}. Pool size: ${this.memoryPoolSize}/${this.maxPoolSize} bytes`);

    return pooledObject;
  }

  /**
   * Deallocate memory from the pool
   */
  deallocate(id: string): boolean {
    const pooledObj = this.memoryPool.get(id);
    if (!pooledObj) {
      return false;
    }

    // Decrement reference count
    pooledObj.refCount--;
    
    // If no more references, remove from pool
    if (pooledObj.refCount <= 0) {
      const estimatedSize = this.estimateSize(pooledObj.data);
      this.memoryPool.delete(id);
      this.memoryPoolSize -= estimatedSize;
      
      this.logger.debug(`Deallocated memory for object: ${id}. Pool size: ${this.memoryPoolSize}/${this.maxPoolSize} bytes`);
    }

    return true;
  }

  /**
   * Get object from memory pool
   */
  get<T>(id: string): T | null {
    const pooledObj = this.memoryPool.get(id);
    if (!pooledObj) {
      return null;
    }

    // Update last accessed time
    pooledObj.lastAccessed = Date.now();
    return pooledObj.data as T;
  }

  /**
   * Borrow an object (increment reference count)
   */
  borrow<T>(id: string): T | null {
    const pooledObj = this.memoryPool.get(id);
    if (!pooledObj) {
      return null;
    }

    pooledObj.refCount++;
    pooledObj.lastAccessed = Date.now();
    
    return pooledObj.data as T;
  }

  /**
   * Return borrowed object (decrement reference count)
   */
  return(id: string): boolean {
    const pooledObj = this.memoryPool.get(id);
    if (!pooledObj) {
      return false;
    }

    pooledObj.refCount = Math.max(0, pooledObj.refCount - 1);
    return true;
  }

  /**
   * Check if object exists in pool
   */
  has(id: string): boolean {
    return this.memoryPool.has(id);
  }

  /**
   * Get current memory pool statistics
   */
  getStats(): {
    poolSize: number;
    maxPoolSize: number;
    utilization: number;
    objectCount: number;
    gcThreshold: number;
    isNearThreshold: boolean;
  } {
    const utilization = this.memoryPoolSize / this.maxPoolSize;
    
    return {
      poolSize: this.memoryPoolSize,
      maxPoolSize: this.maxPoolSize,
      utilization,
      objectCount: this.memoryPool.size,
      gcThreshold: this.gcThreshold,
      isNearThreshold: utilization >= this.gcThreshold,
    };
  }

  /**
   * Force garbage collection if possible
   */
  forceGarbageCollection(): void {
    // In production, you might want to use a library like 'weak-napi' or rely on V8's GC
    // For Node.js with --expose-gc flag, you can call gc if available
    if (global.gc) {
      global.gc();
      this.logger.log('Forced garbage collection executed');
    } else {
      this.logger.log('Garbage collection not exposed. Run Node.js with --expose-gc flag for manual GC.');
    }
  }

  /**
   * Clear expired objects from memory pool
   */
  cleanupExpiredObjects(): void {
    const now = Date.now();
    let cleanedSize = 0;
    let cleanedCount = 0;

    for (const [id, pooledObj] of this.memoryPool.entries()) {
      // Remove objects that haven't been accessed in a while AND have no references
      if (pooledObj.refCount <= 0 && 
          (now - pooledObj.lastAccessed) > this.objectRetentionTime) {
        
        const estimatedSize = this.estimateSize(pooledObj.data);
        this.memoryPool.delete(id);
        this.memoryPoolSize -= estimatedSize;
        
        cleanedSize += estimatedSize;
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.log(`Cleaned up ${cleanedCount} expired objects, freed ${cleanedSize} bytes`);
    }
  }

  /**
   * Evict least recently used objects to make space
   */
  private evictLRUObjects(requiredSpace: number): void {
    // Sort objects by last accessed time (oldest first)
    const sortedObjects = Array.from(this.memoryPool.values())
      .filter(obj => obj.refCount <= 0) // Only evict unreferenced objects
      .sort((a, b) => a.lastAccessed - b.lastAccessed);

    let evictedSize = 0;
    for (const pooledObj of sortedObjects) {
      if (evictedSize >= requiredSpace) {
        break;
      }

      const estimatedSize = this.estimateSize(pooledObj.data);
      this.memoryPool.delete(pooledObj.id);
      this.memoryPoolSize -= estimatedSize;
      evictedSize += estimatedSize;
    }

    this.logger.log(`Evicted ${sortedObjects.length} LRU objects to free ${evictedSize} bytes`);
  }

  /**
   * Estimate object size in memory (simplified approach)
   */
  private estimateSize(obj: any): number {
    try {
      // Simple approach: serialize to JSON and measure length
      // This is a rough estimation, not accurate for all object types
      return JSON.stringify(obj).length;
    } catch (error) {
      // If serialization fails, return a default size
      return 1024; // 1KB default
    }
  }

  /**
   * Start cleanup process
   */
  private startCleanupProcess(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredObjects();
    }, this.cleanupInterval);
  }

  /**
   * Start garbage collection monitoring
   */
  private startGCMonitoring(): void {
    this.gcTimer = setInterval(() => {
      const stats = this.getStats();
      if (stats.utilization >= this.gcThreshold) {
        this.logger.warn(`Memory pool utilization is high: ${(stats.utilization * 100).toFixed(2)}%`);
        this.forceGarbageCollection();
        this.cleanupExpiredObjects();
      }
    }, this.cleanupInterval / 2); // Check more frequently than cleanup
  }

  /**
   * Stop cleanup process
   */
  private stopCleanupProcess(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
    }
  }

  /**
   * Clear entire memory pool
   */
  private clearMemoryPool(): void {
    this.memoryPool.clear();
    this.memoryPoolSize = 0;
  }

  /**
   * Resize the memory pool
   */
  resizePool(newMaxSize: number): void {
    const oldMaxSize = this.maxPoolSize;
    this.maxPoolSize = newMaxSize;
    
    this.logger.log(`Memory pool resized from ${oldMaxSize} to ${newMaxSize} bytes`);
    
    // If new size is smaller, clean up excess
    if (newMaxSize < oldMaxSize && this.memoryPoolSize > newMaxSize) {
      this.logger.warn(`New pool size is smaller than current usage. Initiating cleanup.`);
      this.cleanupExpiredObjects();
      if (this.memoryPoolSize > newMaxSize) {
        this.evictLRUObjects(this.memoryPoolSize - newMaxSize);
      }
    }
  }

  /**
   * Get memory usage information from Node.js
   */
  getNodeMemoryUsage(): NodeJS.MemoryUsage {
    return process.memoryUsage();
  }

  /**
   * Get heap statistics from V8
   */
  getHeapStatistics(): any {
    if (v8.getHeapStatistics) {
      return v8.getHeapStatistics();
    }
    return {};
  }
}

// Import v8 for heap statistics
import * as v8 from 'v8';