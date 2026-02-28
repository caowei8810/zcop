import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AdaptiveLoadBalancerConfig {
  algorithm: 'round-robin' | 'least-connections' | 'weighted-response-time' | 'ip-hash';
  healthCheckInterval: number;
  healthCheckTimeout: number;
  failoverThreshold: number;
  stickySessions: boolean;
  maxRetries: number;
}

export interface ServerInstance {
  id: string;
  host: string;
  port: number;
  weight: number;
  isHealthy: boolean;
  lastHealthCheck: number;
  responseTime: number;
  activeConnections: number;
  failureCount: number;
  tags?: string[];
}

export interface LoadBalancingResult {
  server: ServerInstance;
  reason: string;
  routeTime: number;
}

@Injectable()
export class AdaptiveLoadBalancerOptimizationService {
  private readonly logger = new Logger(AdaptiveLoadBalancerOptimizationService.name);
  private servers: Map<string, ServerInstance> = new Map();
  private config: AdaptiveLoadBalancerConfig;
  private currentServerIndex: number = 0; // For round-robin
  private sessionMap: Map<string, string> = new Map(); // For sticky sessions
  private healthCheckTimer: NodeJS.Timeout | null = null;

  constructor(private configService: ConfigService) {
    this.config = {
      algorithm: this.configService.get<'round-robin' | 'least-connections' | 'weighted-response-time' | 'ip-hash'>
        ('LOAD_BALANCER_ALGORITHM') || 'least-connections',
      healthCheckInterval: this.configService.get<number>('LOAD_BALANCER_HEALTH_CHECK_INTERVAL') || 30000,
      healthCheckTimeout: this.configService.get<number>('LOAD_BALANCER_HEALTH_CHECK_TIMEOUT') || 5000,
      failoverThreshold: this.configService.get<number>('LOAD_BALANCER_FAILOVER_THRESHOLD') || 3,
      stickySessions: this.configService.get<boolean>('LOAD_BALANCER_STICKY_SESSIONS') || false,
      maxRetries: this.configService.get<number>('LOAD_BALANCER_MAX_RETRIES') || 3,
    };
  }

  /**
   * Register a server instance with the load balancer
   */
  registerServer(server: Omit<ServerInstance, 'isHealthy' | 'lastHealthCheck' | 'responseTime' | 'activeConnections' | 'failureCount'>): void {
    const serverInstance: ServerInstance = {
      ...server,
      isHealthy: true,
      lastHealthCheck: Date.now(),
      responseTime: 0,
      activeConnections: 0,
      failureCount: 0,
    };

    this.servers.set(server.id, serverInstance);
    this.logger.log(`Registered server: ${server.host}:${server.port} with ID ${server.id}`);

    // Start health checks if not already running
    if (!this.healthCheckTimer) {
      this.startHealthChecks();
    }
  }

  /**
   * Deregister a server instance
   */
  deregisterServer(serverId: string): boolean {
    const server = this.servers.get(serverId);
    if (!server) {
      return false;
    }

    this.servers.delete(serverId);
    this.logger.log(`Deregistered server: ${serverId}`);
    return true;
  }

  /**
   * Select the best server based on the configured algorithm
   */
  selectServer(clientIp?: string, sessionId?: string): LoadBalancingResult | null {
    if (this.servers.size === 0) {
      this.logger.error('No servers registered with the load balancer');
      return null;
    }

    // Filter healthy servers
    const healthyServers = Array.from(this.servers.values()).filter(server => server.isHealthy);
    if (healthyServers.length === 0) {
      this.logger.error('No healthy servers available');
      return null;
    }

    const startTime = Date.now();
    let selectedServer: ServerInstance;
    let reason: string;

    // Implement the selected algorithm
    switch (this.config.algorithm) {
      case 'round-robin':
        selectedServer = this.selectRoundRobin(healthyServers);
        reason = 'Round-robin selection';
        break;
      
      case 'least-connections':
        selectedServer = this.selectLeastConnections(healthyServers);
        reason = 'Least connections selection';
        break;
      
      case 'weighted-response-time':
        selectedServer = this.selectWeightedResponseTime(healthyServers);
        reason = 'Weighted response time selection';
        break;
      
      case 'ip-hash':
        if (clientIp) {
          selectedServer = this.selectIpHash(healthyServers, clientIp);
          reason = 'IP hash selection';
        } else {
          // Fallback to least connections if no client IP provided
          selectedServer = this.selectLeastConnections(healthyServers);
          reason = 'Least connections fallback (no client IP)';
        }
        break;
      
      default:
        selectedServer = this.selectLeastConnections(healthyServers);
        reason = 'Default least connections selection';
    }

    // Handle sticky sessions if enabled
    if (this.config.stickySessions && sessionId) {
      const stickyServerId = this.sessionMap.get(sessionId);
      if (stickyServerId && this.servers.has(stickyServerId)) {
        const stickyServer = this.servers.get(stickyServerId)!;
        if (stickyServer.isHealthy) {
          selectedServer = stickyServer;
          reason = 'Sticky session preservation';
        } else {
          // Sticky server is unhealthy, remove from session map and select normally
          this.sessionMap.delete(sessionId);
        }
      } else if (!stickyServerId) {
        // New session, assign to selected server
        this.sessionMap.set(sessionId, selectedServer.id);
      }
    }

    // Update active connection count
    selectedServer.activeConnections++;

    const result: LoadBalancingResult = {
      server: selectedServer,
      reason,
      routeTime: Date.now() - startTime,
    };

    this.logger.debug(`Selected server ${selectedServer.id} (${selectedServer.host}:${selectedServer.port}) for routing. Reason: ${reason}`);
    return result;
  }

  /**
   * Mark a request as completed on a server
   */
  markRequestCompleted(serverId: string, responseTime: number, success: boolean): void {
    const server = this.servers.get(serverId);
    if (!server) {
      return;
    }

    // Update response time (using exponential moving average)
    server.responseTime = server.responseTime > 0 
      ? 0.7 * server.responseTime + 0.3 * responseTime 
      : responseTime;

    // Update active connection count
    server.activeConnections = Math.max(0, server.activeConnections - 1);

    // Update failure count based on success/failure
    if (success) {
      server.failureCount = 0; // Reset failure count on success
    } else {
      server.failureCount++;
      
      // Mark server as unhealthy if failure threshold is reached
      if (server.failureCount >= this.config.failoverThreshold) {
        server.isHealthy = false;
        this.logger.warn(`Server ${serverId} marked as unhealthy due to ${server.failureCount} consecutive failures`);
      }
    }
  }

  /**
   * Perform health check on all registered servers
   */
  async performHealthChecks(): Promise<void> {
    this.logger.debug('Starting health checks for all servers');

    const healthCheckPromises = Array.from(this.servers.values()).map(async (server) => {
      try {
        // In a real implementation, this would perform an actual health check
        // For now, we'll simulate with a mock check
        const isHealthy = await this.checkServerHealth(server);
        
        // Update server health status
        if (isHealthy !== server.isHealthy) {
          if (isHealthy) {
            this.logger.log(`Server ${server.id} is now healthy`);
            server.failureCount = 0; // Reset failure count when server recovers
          } else {
            this.logger.warn(`Server ${server.id} is now unhealthy`);
          }
        }
        
        server.isHealthy = isHealthy;
        server.lastHealthCheck = Date.now();
      } catch (error) {
        this.logger.error(`Health check failed for server ${server.id}: ${error.message}`);
        server.isHealthy = false;
        server.lastHealthCheck = Date.now();
      }
    });

    await Promise.all(healthCheckPromises);
    this.logger.debug('Completed health checks for all servers');
  }

  /**
   * Simulate checking server health
   * In a real implementation, this would make an actual request to the server
   */
  private async checkServerHealth(server: ServerInstance): Promise<boolean> {
    // Simulate a health check request
    // In a real implementation, this would make an actual HTTP request to the server
    return new Promise<boolean>((resolve) => {
      // Simulate network delay
      setTimeout(() => {
        // Simulate 95% success rate for healthy servers
        resolve(Math.random() > 0.05);
      }, Math.min(this.config.healthCheckTimeout, 1000)); // Cap at 1 second or config timeout
    });
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.healthCheckInterval);

    this.logger.log(`Started health checks with interval ${this.config.healthCheckInterval}ms`);
  }

  /**
   * Stop health checks
   */
  stopHealthChecks(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
      this.logger.log('Stopped health checks');
    }
  }

  /**
   * Round-robin server selection
   */
  private selectRoundRobin(servers: ServerInstance[]): ServerInstance {
    // Find next healthy server
    for (let i = 0; i < servers.length; i++) {
      const currentIndex = (this.currentServerIndex + i) % servers.length;
      const server = servers[currentIndex];
      if (server.isHealthy) {
        this.currentServerIndex = (currentIndex + 1) % servers.length;
        return server;
      }
    }
    
    // If no healthy servers found, return the first one (will fail gracefully)
    this.currentServerIndex = 0;
    return servers[0];
  }

  /**
   * Least connections server selection
   */
  private selectLeastConnections(servers: ServerInstance[]): ServerInstance {
    // Filter to only healthy servers
    const healthyServers = servers.filter(s => s.isHealthy);
    
    if (healthyServers.length === 0) {
      return servers[0]; // Fallback if no healthy servers
    }
    
    // Find server with least active connections
    return healthyServers.reduce((prev, curr) => 
      prev.activeConnections <= curr.activeConnections ? prev : curr
    );
  }

  /**
   * Weighted response time server selection
   */
  private selectWeightedResponseTime(servers: ServerInstance[]): ServerInstance {
    // Filter to only healthy servers with good response times
    const healthyServers = servers.filter(s => s.isHealthy && s.responseTime > 0);
    
    if (healthyServers.length === 0) {
      // If no servers have response time data, fall back to least connections
      return this.selectLeastConnections(servers);
    }
    
    // Calculate weighted score for each server (lower is better)
    // Score = responseTime / weight
    const scoredServers = healthyServers.map(server => ({
      server,
      score: server.responseTime / server.weight
    }));
    
    // Find server with lowest score
    const bestServer = scoredServers.reduce((prev, curr) => 
      prev.score <= curr.score ? prev : curr
    );
    
    return bestServer.server;
  }

  /**
   * IP hash server selection
   */
  private selectIpHash(servers: ServerInstance[], clientIp: string): ServerInstance {
    // Simple hash function for the IP
    let hash = 0;
    for (let i = 0; i < clientIp.length; i++) {
      hash = ((hash << 5) - hash) + clientIp.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    
    // Use hash to select server
    const index = Math.abs(hash) % servers.length;
    return servers[index];
  }

  /**
   * Get current server instances
   */
  getServers(): ServerInstance[] {
    return Array.from(this.servers.values());
  }

  /**
   * Get server by ID
   */
  getServerById(serverId: string): ServerInstance | undefined {
    return this.servers.get(serverId);
  }

  /**
   * Get load balancing statistics
   */
  getStats(): {
    totalServers: number;
    healthyServers: number;
    unhealthyServers: number;
    algorithm: string;
    activeConnections: number;
    sessionAffinityEnabled: boolean;
  } {
    const servers = Array.from(this.servers.values());
    const healthy = servers.filter(s => s.isHealthy);
    
    return {
      totalServers: servers.length,
      healthyServers: healthy.length,
      unhealthyServers: servers.length - healthy.length,
      algorithm: this.config.algorithm,
      activeConnections: servers.reduce((sum, server) => sum + server.activeConnections, 0),
      sessionAffinityEnabled: this.config.stickySessions,
    };
  }

  /**
   * Update load balancer configuration
   */
  updateConfig(newConfig: Partial<AdaptiveLoadBalancerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.log('Updated load balancer configuration');
  }

  /**
   * Drain a server (stop sending new requests, but allow existing ones to complete)
   */
  drainServer(serverId: string): void {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }

    // Mark server as unhealthy to stop receiving new requests
    server.isHealthy = false;
    this.logger.log(`Draining server ${serverId}. Will not receive new requests but will complete existing ones.`);
  }

  /**
   * Force remove a server (terminate existing connections)
   */
  forceRemoveServer(serverId: string): boolean {
    const server = this.servers.get(serverId);
    if (!server) {
      return false;
    }

    // Note: In a real implementation, you would terminate existing connections here
    this.deregisterServer(serverId);
    this.logger.log(`Force removed server ${serverId} and terminated all connections`);
    return true;
  }

  /**
   * Add a new server with the specified weight
   */
  addWeightedServer(
    host: string, 
    port: number, 
    weight: number, 
    tags?: string[]
  ): string {
    const id = `server_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`;
    
    this.registerServer({
      id,
      host,
      port,
      weight,
      tags
    });
    
    return id;
  }
}