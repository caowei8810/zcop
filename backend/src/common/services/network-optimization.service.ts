import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as http from 'http';
import * as https from 'https';
import * as net from 'net';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

export interface NetworkOptimizationConfig {
  connectionTimeout: number;
  requestTimeout: number;
  maxRedirects: number;
  keepAlive: boolean;
  keepAliveMsecs: number;
  maxSockets: number;
  maxFreeSockets: number;
  freeSocketTimeout: number;
  tcpNoDelay: boolean;
  http2Enabled: boolean;
}

export interface NetworkStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  avgTransferSpeed: number;
  totalTransferred: number;
  connectionReuses: number;
}

@Injectable()
export class NetworkOptimizationService {
  private readonly logger = new Logger(NetworkOptimizationService.name);
  private config: NetworkOptimizationConfig;
  private httpAgent: http.Agent;
  private httpsAgent: https.Agent;
  private stats: NetworkStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    avgResponseTime: 0,
    avgTransferSpeed: 0,
    totalTransferred: 0,
    connectionReuses: 0,
  };
  private responseTimes: number[] = [];
  private transferSizes: number[] = [];

  constructor(private configService: ConfigService) {
    this.config = this.getDefaultConfig();
    this.initializeAgents();
  }

  private getDefaultConfig(): NetworkOptimizationConfig {
    return {
      connectionTimeout: this.configService.get<number>('NETWORK_CONNECTION_TIMEOUT') || 10000,
      requestTimeout: this.configService.get<number>('NETWORK_REQUEST_TIMEOUT') || 30000,
      maxRedirects: this.configService.get<number>('NETWORK_MAX_REDIRECTS') || 5,
      keepAlive: this.configService.get<boolean>('NETWORK_KEEP_ALIVE') ?? true,
      keepAliveMsecs: this.configService.get<number>('NETWORK_KEEP_ALIVE_MSECS') || 1000,
      maxSockets: this.configService.get<number>('NETWORK_MAX_SOCKETS') || 50,
      maxFreeSockets: this.configService.get<number>('NETWORK_MAX_FREE_SOCKETS') || 10,
      freeSocketTimeout: this.configService.get<number>('NETWORK_FREE_SOCKET_TIMEOUT') || 30000,
      tcpNoDelay: this.configService.get<boolean>('NETWORK_TCP_NO_DELAY') ?? true,
      http2Enabled: this.configService.get<boolean>('NETWORK_HTTP2_ENABLED') ?? false,
    };
  }

  private initializeAgents(): void {
    this.httpAgent = new http.Agent({
      keepAlive: this.config.keepAlive,
      keepAliveMsecs: this.config.keepAliveMsecs,
      maxSockets: this.config.maxSockets,
      maxFreeSockets: this.config.maxFreeSockets,
      timeout: this.config.connectionTimeout,
    });

    this.httpsAgent = new https.Agent({
      keepAlive: this.config.keepAlive,
      keepAliveMsecs: this.config.keepAliveMsecs,
      maxSockets: this.config.maxSockets,
      maxFreeSockets: this.config.maxFreeSockets,
      timeout: this.config.connectionTimeout,
      rejectUnauthorized: true, // Verify SSL certificates
    });

    // Enable TCP no delay if configured
    if (this.config.tcpNoDelay) {
      this.httpAgent.options = { ...this.httpAgent.options, noDelay: true };
      this.httpsAgent.options = { ...this.httpsAgent.options, noDelay: true };
    }

    this.logger.log('Network optimization agents initialized');
  }

  /**
   * Make an optimized HTTP request
   */
  async makeRequest<T = any>(url: string, options?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    this.stats.totalRequests++;

    const startTime = Date.now();
    const startBytes = this.stats.totalTransferred;

    try {
      const config: AxiosRequestConfig = {
        url,
        timeout: this.config.requestTimeout,
        maxRedirects: this.config.maxRedirects,
        httpAgent: this.httpAgent,
        httpsAgent: this.httpsAgent,
        ...options,
      };

      // Use the appropriate agent based on the protocol
      if (url.startsWith('https://')) {
        config.httpsAgent = this.httpsAgent;
      } else {
        config.httpAgent = this.httpAgent;
      }

      const response = await axios.request<T>(config);
      
      // Update stats for successful request
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      const transferredBytes = response.data ? Buffer.byteLength(JSON.stringify(response.data)) : 0;
      
      this.responseTimes.push(responseTime);
      this.transferSizes.push(transferredBytes);
      this.stats.successfulRequests++;
      this.stats.totalTransferred += transferredBytes;
      
      // Update averages
      this.stats.avgResponseTime = this.calculateAverage(this.responseTimes);
      this.stats.avgTransferSpeed = this.calculateAvgTransferSpeed();
      
      // Log performance metrics
      this.logger.debug(`Request to ${url} completed in ${responseTime}ms, transferred ${transferredBytes} bytes`);
      
      return response;
    } catch (error) {
      this.stats.failedRequests++;
      this.logger.error(`Request to ${url} failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Make multiple concurrent requests with connection pooling
   */
  async makeConcurrentRequests<T = any>(
    requests: Array<{ url: string; options?: AxiosRequestConfig }>
  ): Promise<Array<AxiosResponse<T>>> {
    const promises = requests.map(req => this.makeRequest<T>(req.url, req.options));
    return Promise.all(promises);
  }

  /**
   * Download file with resume capability
   */
  async downloadFile(url: string, destination: string): Promise<void> {
    // Implementation would include resumable downloads, chunked transfers, etc.
    // For brevity, using axios with our optimized config
    const response = await this.makeRequest(url, {
      responseType: 'stream'
    });

    const fs = await import('fs');
    const writer = fs.createWriteStream(destination);
    
    return new Promise((resolve, reject) => {
      response.data.pipe(writer);
      let error: Error | null = null;
      
      writer.on('error', (err) => {
        error = err;
        writer.close();
        reject(err);
      });
      
      writer.on('close', () => {
        if (!error) {
          resolve();
        }
      });
    });
  }

  /**
   * Upload file with chunking and retry
   */
  async uploadFile(
    url: string, 
    filePath: string, 
    options?: { chunkSize?: number; maxRetries?: number }
  ): Promise<AxiosResponse> {
    const fs = await import('fs');
    const chunkSize = options?.chunkSize || 1024 * 1024; // 1MB chunks
    const maxRetries = options?.maxRetries || 3;
    
    const fileStat = await fs.promises.stat(filePath);
    const fileSize = fileStat.size;
    const fd = await fs.promises.open(filePath, 'r');
    
    try {
      let offset = 0;
      let retryCount = 0;
      
      while (offset < fileSize) {
        const chunkBuffer = Buffer.alloc(Math.min(chunkSize, fileSize - offset));
        const { bytesRead } = await fd.read(chunkBuffer, 0, chunkBuffer.length, offset);
        
        if (bytesRead === 0) break;
        
        const chunk = chunkBuffer.subarray(0, bytesRead);
        const chunkHeaders = {
          'Content-Type': 'application/octet-stream',
          'Content-Range': `bytes ${offset}-${offset + bytesRead - 1}/${fileSize}`,
          'Content-Length': bytesRead.toString(),
        };
        
        try {
          const response = await this.makeRequest(url, {
            method: 'PATCH',
            data: chunk,
            headers: chunkHeaders,
          });
          
          offset += bytesRead;
          retryCount = 0; // Reset retry count on success
        } catch (error) {
          retryCount++;
          if (retryCount >= maxRetries) {
            throw error;
          }
          // Wait before retry with exponential backoff
          await this.sleep(Math.pow(2, retryCount) * 1000);
        }
      }
      
      // Finalize upload
      return await this.makeRequest(url, { method: 'POST', headers: { 'Upload-Done': 'true' } });
    } finally {
      await fd.close();
    }
  }

  /**
   * Ping endpoint to measure latency
   */
  async ping(url: string, count: number = 4): Promise<{ avgLatency: number; packetLoss: number }> {
    const latencies: number[] = [];
    let successfulPings = 0;
    
    for (let i = 0; i < count; i++) {
      const startTime = Date.now();
      
      try {
        await this.makeRequest(url, { method: 'HEAD' });
        const latency = Date.now() - startTime;
        latencies.push(latency);
        successfulPings++;
      } catch (error) {
        // Failed ping, continue to next
      }
      
      // Wait 1 second between pings
      await this.sleep(1000);
    }
    
    const avgLatency = latencies.length > 0 
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length 
      : 0;
    
    const packetLoss = ((count - successfulPings) / count) * 100;
    
    return { avgLatency, packetLoss };
  }

  /**
   * Check network connectivity and speed
   */
  async checkNetworkSpeed(testUrl: string = 'https://httpbin.org/get'): Promise<{
    downloadSpeed: number; // bytes/sec
    uploadSpeed: number;   // bytes/sec
    latency: number;       // ms
  }> {
    // Measure latency
    const { avgLatency } = await this.ping(testUrl, 3);
    
    // Measure download speed
    const downloadStart = Date.now();
    const downloadResponse = await this.makeRequest(testUrl, { 
      timeout: 10000,
      responseType: 'arraybuffer'
    });
    const downloadEnd = Date.now();
    
    const downloadTimeSec = (downloadEnd - downloadStart) / 1000;
    const downloadBytes = downloadResponse.data?.byteLength || 0;
    const downloadSpeed = downloadTimeSec > 0 ? downloadBytes / downloadTimeSec : 0;
    
    // Measure upload speed (upload some dummy data)
    const testData = 'x'.repeat(1024 * 100); // 100KB test data
    const uploadStart = Date.now();
    await this.makeRequest(testUrl, {
      method: 'POST',
      data: testData,
      timeout: 10000
    });
    const uploadEnd = Date.now();
    
    const uploadTimeSec = (uploadEnd - uploadStart) / 1000;
    const uploadSpeed = uploadTimeSec > 0 ? testData.length / uploadTimeSec : 0;
    
    return {
      downloadSpeed,
      uploadSpeed,
      latency: avgLatency
    };
  }

  /**
   * Get network statistics
   */
  getNetworkStats(): NetworkStats {
    return { ...this.stats };
  }

  /**
   * Update network configuration
   */
  updateConfig(newConfig: Partial<NetworkOptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.initializeAgents(); // Reinitialize with new config
    this.logger.log('Network optimization configuration updated');
  }

  /**
   * Calculate average of array
   */
  private calculateAverage(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  }

  /**
   * Calculate average transfer speed
   */
  private calculateAvgTransferSpeed(): number {
    if (this.responseTimes.length === 0) return 0;
    
    let totalBytes = 0;
    let totalTime = 0;
    
    for (let i = 0; i < Math.min(this.transferSizes.length, this.responseTimes.length); i++) {
      totalBytes += this.transferSizes[i];
      totalTime += this.responseTimes[i];
    }
    
    return totalTime > 0 ? (totalBytes / totalTime) * 1000 : 0; // bytes per second
  }

  /**
   * Sleep utility function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Pre-warm connections to specific hosts
   */
  async prewarmConnections(hosts: string[], connectionsPerHost: number = 3): Promise<void> {
    const promises: Promise<any>[] = [];
    
    for (const host of hosts) {
      for (let i = 0; i < connectionsPerHost; i++) {
        // Make a HEAD request to establish connection
        promises.push(
          this.makeRequest(`${host}/`, { method: 'HEAD', timeout: 5000 })
            .catch(() => {
              // Ignore errors during prewarming
            })
        );
      }
    }
    
    await Promise.all(promises);
    this.logger.log(`Prewarmed ${hosts.length * connectionsPerHost} connections to ${hosts.length} hosts`);
  }

  /**
   * Close all network agents
   */
  shutdown(): void {
    this.httpAgent.destroy();
    this.httpsAgent.destroy();
    this.logger.log('Network optimization service shut down');
  }
}