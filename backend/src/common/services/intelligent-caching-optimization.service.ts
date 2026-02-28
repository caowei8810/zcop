import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface IntelligentCachingConfig {
  defaultTtl: number;           // Default time-to-live in seconds
  maxCacheSize: number;         // Maximum cache size in bytes
  evictionPolicy: 'LRU' | 'LFU' | 'FIFO' | 'TTL'; // Cache eviction policy
  compressionEnabled: boolean;  // Whether to compress cached values
  encryptionEnabled: boolean;   // Whether to encrypt cached values
  persistenceEnabled: boolean;  // Whether to persist cache to storage
  metricsEnabled: boolean;      // Whether to collect metrics
  keyPrefix: string;            // Prefix for all cache keys
}

export interface CacheItem {
  key: string;
  value: any;
  ttl: number;                  // Unix timestamp when item expires
  size: number;                 // Approximate size in bytes
  accessCount: number;          // Number of times accessed
  createdAt: number;            // Unix timestamp when created
  updatedAt: number;            // Unix timestamp when last updated
  compressed?: boolean;         // Whether the value is compressed
  encrypted?: boolean;          // Whether the value is encrypted
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  currentItems: number;
  currentSize: number;
  hitRate: number;
  evictedItems: number;
}

@Injectable()
export class IntelligentCachingOptimizationService {
  private readonly logger = new Logger(IntelligentCachingOptimizationService.name);
  private cache: Map<string, CacheItem> = new Map();
  private config: IntelligentCachingConfig;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    currentItems: 0,
    currentSize: 0,
    hitRate: 0,
    evictedItems: 0,
  };
  private encryptionKey: Buffer;
  private timer: NodeJS.Timeout | null = null;

  constructor(private configService: ConfigService) {
    this.config = {
      defaultTtl: this.configService.get<number>('CACHE_DEFAULT_TTL') || 300, // 5 minutes
      maxCacheSize: this.configService.get<number>('CACHE_MAX_SIZE') || 50 * 1024 * 1024, // 50MB
      evictionPolicy: this.configService.get<'LRU' | 'LFU' | 'FIFO' | 'TTL'>('CACHE_EVICTION_POLICY') || 'LRU',
      compressionEnabled: this.configService.get<boolean>('CACHE_COMPRESSION_ENABLED') || true,
      encryptionEnabled: this.configService.get<boolean>('CACHE_ENCRYPTION_ENABLED') || false,
      persistenceEnabled: this.configService.get<boolean>('CACHE_PERSISTENCE_ENABLED') || false,
      metricsEnabled: this.configService.get<boolean>('CACHE_METRICS_ENABLED') || true,
      keyPrefix: this.configService.get<string>('CACHE_KEY_PREFIX') || 'zcop:',
    };

    // Generate encryption key if encryption is enabled
    if (this.config.encryptionEnabled) {
      const key = this.configService.get<string>('CACHE_ENCRYPTION_KEY');
      if (key) {
        this.encryptionKey = Buffer.from(key, 'hex');
      } else {
        this.encryptionKey = crypto.randomBytes(32); // AES-256
        this.logger.warn('No encryption key provided. Generated a random key for this session.');
      }
    }

    // Start periodic cleanup if TTL policy is enabled
    if (this.config.evictionPolicy === 'TTL') {
      this.startCleanupTimer();
    }
  }

  /**
   * Get a value from the cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    const fullKey = this.config.keyPrefix + key;
    const item = this.cache.get(fullKey);

    if (!item) {
      if (this.config.metricsEnabled) {
        this.stats.misses++;
        this.updateHitRate();
      }
      return null;
    }

    // Check if item has expired
    if (Date.now() > item.ttl) {
      await this.delete(key);
      if (this.config.metricsEnabled) {
        this.stats.misses++;
        this.updateHitRate();
      }
      return null;
    }

    // Update access count
    item.accessCount++;
    item.updatedAt = Date.now();

    // Apply eviction policy if needed
    this.applyEvictionPolicy();

    // Decompress and decrypt if necessary
    let value = item.value;
    if (item.compressed) {
      value = this.decompress(value);
    }
    if (item.encrypted) {
      value = this.decrypt(value);
    }

    if (this.config.metricsEnabled) {
      this.stats.hits++;
      this.updateHitRate();
    }

    return value as T;
  }

  /**
   * Set a value in the cache
   */
  async set<T = any>(key: string, value: T, ttl?: number): Promise<boolean> {
    const fullKey = this.config.keyPrefix + key;
    const expiration = ttl ? Date.now() + (ttl * 1000) : Date.now() + (this.config.defaultTtl * 1000);

    // Serialize the value to estimate size
    let processedValue = value;
    let compressed = false;
    let encrypted = false;

    // Compress if enabled and value is large enough
    if (this.config.compressionEnabled) {
      const serialized = JSON.stringify(value);
      if (serialized.length > 1024) { // Only compress if larger than 1KB
        processedValue = this.compress(serialized);
        compressed = true;
      }
    }

    // Encrypt if enabled
    if (this.config.encryptionEnabled) {
      processedValue = this.encrypt(processedValue);
      encrypted = true;
    }

    // Calculate size
    const size = this.getSize(processedValue);

    // Check if adding this item would exceed max size
    if (this.stats.currentSize + size > this.config.maxCacheSize) {
      this.evictItems(size);
    }

    // Create or update cache item
    const item: CacheItem = {
      key: fullKey,
      value: processedValue,
      ttl: expiration,
      size,
      accessCount: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      compressed,
      encrypted,
    };

    const existingItem = this.cache.get(fullKey);
    if (existingItem) {
      // Update size accounting
      this.stats.currentSize -= existingItem.size;
    } else {
      this.stats.currentItems++;
    }

    this.cache.set(fullKey, item);
    this.stats.currentSize += size;
    this.stats.sets++;

    // Apply eviction policy
    this.applyEvictionPolicy();

    return true;
  }

  /**
   * Delete a value from the cache
   */
  async delete(key: string): Promise<boolean> {
    const fullKey = this.config.keyPrefix + key;
    const item = this.cache.get(fullKey);

    if (!item) {
      return false;
    }

    this.cache.delete(fullKey);
    this.stats.currentSize -= item.size;
    this.stats.currentItems--;
    this.stats.deletes++;

    return true;
  }

  /**
   * Check if a key exists in the cache
   */
  async has(key: string): Promise<boolean> {
    const fullKey = this.config.keyPrefix + key;
    const item = this.cache.get(fullKey);

    if (!item) {
      return false;
    }

    // Check if item has expired
    if (Date.now() > item.ttl) {
      await this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Clear the entire cache
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.stats.currentItems = 0;
    this.stats.currentSize = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get cache info for a specific key
   */
  async getInfo(key: string): Promise<CacheItem | null> {
    const fullKey = this.config.keyPrefix + key;
    const item = this.cache.get(fullKey);

    if (!item) {
      return null;
    }

    // Check if item has expired
    if (Date.now() > item.ttl) {
      await this.delete(key);
      return null;
    }

    return { ...item };
  }

  /**
   * Get all keys in the cache
   */
  async getKeys(): Promise<string[]> {
    const now = Date.now();
    const validKeys: string[] = [];

    for (const [key, item] of this.cache.entries()) {
      if (now <= item.ttl) {
        // Remove prefix from returned key
        validKeys.push(key.substring(this.config.keyPrefix.length));
      } else {
        // Clean up expired item
        this.cache.delete(key);
        this.stats.currentSize -= item.size;
        this.stats.currentItems--;
      }
    }

    return validKeys;
  }

  /**
   * Update the cache configuration
   */
  updateConfig(newConfig: Partial<IntelligentCachingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart cleanup timer if TTL policy changed
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    
    if (this.config.evictionPolicy === 'TTL') {
      this.startCleanupTimer();
    }
    
    this.logger.log('Cache configuration updated');
  }

  /**
   * Force run eviction based on current policy
   */
  async forceEviction(): Promise<number> {
    const count = this.evictItems(0); // Evict without needing space for new item
    return count;
  }

  /**
   * Apply the configured eviction policy
   */
  private applyEvictionPolicy(): void {
    switch (this.config.evictionPolicy) {
      case 'TTL':
        // Handled by the cleanup timer
        break;
      case 'LRU':
        if (this.stats.currentSize > this.config.maxCacheSize) {
          this.evictLRU();
        }
        break;
      case 'LFU':
        if (this.stats.currentSize > this.config.maxCacheSize) {
          this.evictLFU();
        }
        break;
      case 'FIFO':
        if (this.stats.currentSize > this.config.maxCacheSize) {
          this.evictFIFO();
        }
        break;
    }
  }

  /**
   * Evict items to make space for new data
   */
  private evictItems(neededSpace: number): number {
    let evictedCount = 0;
    let freedSpace = 0;

    // Try to evict expired items first
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.ttl) {
        this.cache.delete(key);
        this.stats.currentSize -= item.size;
        this.stats.currentItems--;
        freedSpace += item.size;
        evictedCount++;
        this.stats.evictedItems++;
      }
    }

    // If we still need more space, apply the configured eviction policy
    if (freedSpace < neededSpace) {
      switch (this.config.evictionPolicy) {
        case 'LRU':
          evictedCount += this.evictLRU(neededSpace - freedSpace);
          break;
        case 'LFU':
          evictedCount += this.evictLFU(neededSpace - freedSpace);
          break;
        case 'FIFO':
          evictedCount += this.evictFIFO(neededSpace - freedSpace);
          break;
        case 'TTL':
          // TTL-only eviction already handled above
          break;
      }
    }

    return evictedCount;
  }

  /**
   * Evict items using LRU (Least Recently Used) policy
   */
  private evictLRU(neededSpace: number = 0): number {
    let evictedCount = 0;
    let freedSpace = 0;

    // Sort items by last access time (updatedAt)
    const sortedItems = Array.from(this.cache.entries())
      .map(([key, item]) => ({ key, item }))
      .filter(({ item }) => !item.encrypted) // Don't evict encrypted items if possible
      .sort((a, b) => a.item.updatedAt - b.item.updatedAt);

    for (const { key, item } of sortedItems) {
      if (freedSpace >= neededSpace && this.stats.currentSize <= this.config.maxCacheSize) {
        break;
      }

      this.cache.delete(key);
      this.stats.currentSize -= item.size;
      this.stats.currentItems--;
      freedSpace += item.size;
      evictedCount++;
      this.stats.evictedItems++;
    }

    return evictedCount;
  }

  /**
   * Evict items using LFU (Least Frequently Used) policy
   */
  private evictLFU(neededSpace: number = 0): number {
    let evictedCount = 0;
    let freedSpace = 0;

    // Sort items by access count
    const sortedItems = Array.from(this.cache.entries())
      .map(([key, item]) => ({ key, item }))
      .filter(({ item }) => !item.encrypted) // Don't evict encrypted items if possible
      .sort((a, b) => a.item.accessCount - b.item.accessCount);

    for (const { key, item } of sortedItems) {
      if (freedSpace >= neededSpace && this.stats.currentSize <= this.config.maxCacheSize) {
        break;
      }

      this.cache.delete(key);
      this.stats.currentSize -= item.size;
      this.stats.currentItems--;
      freedSpace += item.size;
      evictedCount++;
      this.stats.evictedItems++;
    }

    return evictedCount;
  }

  /**
   * Evict items using FIFO (First In, First Out) policy
   */
  private evictFIFO(neededSpace: number = 0): number {
    let evictedCount = 0;
    let freedSpace = 0;

    // Sort items by creation time
    const sortedItems = Array.from(this.cache.entries())
      .map(([key, item]) => ({ key, item }))
      .filter(({ item }) => !item.encrypted) // Don't evict encrypted items if possible
      .sort((a, b) => a.item.createdAt - b.item.createdAt);

    for (const { key, item } of sortedItems) {
      if (freedSpace >= neededSpace && this.stats.currentSize <= this.config.maxCacheSize) {
        break;
      }

      this.cache.delete(key);
      this.stats.currentSize -= item.size;
      this.stats.currentItems--;
      freedSpace += item.size;
      evictedCount++;
      this.stats.evictedItems++;
    }

    return evictedCount;
  }

  /**
   * Start the cleanup timer for TTL-based eviction
   */
  private startCleanupTimer(): void {
    this.timer = setInterval(() => {
      this.cleanupExpiredItems();
    }, 30000); // Clean up every 30 seconds
  }

  /**
   * Clean up expired items
   */
  private cleanupExpiredItems(): void {
    const now = Date.now();
    let cleanedCount = 0;
    let freedSpace = 0;

    for (const [key, item] of this.cache.entries()) {
      if (now > item.ttl) {
        this.cache.delete(key);
        this.stats.currentSize -= item.size;
        this.stats.currentItems--;
        freedSpace += item.size;
        cleanedCount++;
        this.stats.evictedItems++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(`Cleaned up ${cleanedCount} expired cache items, freed ${freedSpace} bytes`);
    }
  }

  /**
   * Compress data using a simple algorithm
   */
  private compress(data: any): string {
    // In a real implementation, you would use a proper compression algorithm like gzip
    // For this example, we'll just return the data as-is since implementing full compression would require additional dependencies
    return typeof data === 'string' ? data : JSON.stringify(data);
  }

  /**
   * Decompress data
   */
  private decompress(compressedData: string): any {
    // In a real implementation, you would decompress the data
    try {
      return JSON.parse(compressedData);
    } catch {
      return compressedData;
    }
  }

  /**
   * Encrypt data
   */
  private encrypt(data: any): string {
    if (!this.config.encryptionEnabled || !this.encryptionKey) {
      return typeof data === 'string' ? data : JSON.stringify(data);
    }

    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
      let encrypted = cipher.update(typeof data === 'string' ? data : JSON.stringify(data), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Include IV with encrypted data
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      this.logger.error(`Encryption failed: ${error.message}`);
      return typeof data === 'string' ? data : JSON.stringify(data);
    }
  }

  /**
   * Decrypt data
   */
  private decrypt(encryptedData: string): any {
    if (!this.config.encryptionEnabled || !this.encryptionKey) {
      try {
        return JSON.parse(encryptedData);
      } catch {
        return encryptedData;
      }
    }

    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      
      const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      this.logger.error(`Decryption failed: ${error.message}`);
      return encryptedData;
    }
  }

  /**
   * Get approximate size of an object in bytes
   */
  private getSize(obj: any): number {
    try {
      const serialized = typeof obj === 'string' ? obj : JSON.stringify(obj);
      return Buffer.byteLength(serialized);
    } catch {
      return 0;
    }
  }

  /**
   * Update the hit rate statistic
   */
  private updateHitRate(): void {
    if (this.config.metricsEnabled) {
      const total = this.stats.hits + this.stats.misses;
      this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
    }
  }

  /**
   * Close the cache service and clean up resources
   */
  async close(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    // Persist cache if enabled
    if (this.config.persistenceEnabled) {
      await this.persistCache();
    }

    this.logger.log('Cache service closed');
  }

  /**
   * Persist cache to storage (placeholder implementation)
   */
  private async persistCache(): Promise<void> {
    // In a real implementation, this would save the cache to disk or another persistent store
    this.logger.log('Cache persistence not implemented in this example');
  }
}