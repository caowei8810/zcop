import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as zlib from 'zlib';
import { promisify } from 'util';

const deflateAsync = promisify(zlib.deflate);
const inflateAsync = promisify(zlib.inflate);
const gzipAsync = promisify(zlib.gzip);
const gunzipAsync = promisify(zlib.gunzip);

export interface CompressionOptions {
  algorithm: 'gzip' | 'deflate' | 'brotli';
  level?: number; // Compression level (1-9 for gzip/deflate)
  threshold?: number; // Minimum size to compress (bytes)
  strategy?: number; // Compression strategy
}

export interface CompressionStats {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  compressionTime: number;
  algorithm: string;
}

@Injectable()
export class DataCompressionOptimizationService {
  private readonly logger = new Logger(DataCompressionOptimizationService.name);
  private defaultOptions: CompressionOptions;

  constructor(private configService: ConfigService) {
    this.defaultOptions = {
      algorithm: this.configService.get<'gzip' | 'deflate' | 'brotli'>('COMPRESSION_ALGORITHM') || 'gzip',
      level: this.configService.get<number>('COMPRESSION_LEVEL') || 6,
      threshold: this.configService.get<number>('COMPRESSION_THRESHOLD') || 1024, // 1KB
    };
  }

  /**
   * Compress data using the specified algorithm
   */
  async compress(data: string | Buffer, options?: Partial<CompressionOptions>): Promise<Buffer> {
    const opts = { ...this.defaultOptions, ...options };
    const startTime = Date.now();

    // Don't compress if data is smaller than threshold
    const dataSize = Buffer.byteLength(Buffer.isBuffer(data) ? data : Buffer.from(data as string));
    if (dataSize < opts.threshold) {
      this.logger.debug(`Skipping compression for small data (${dataSize} bytes < ${opts.threshold} threshold)`);
      return Buffer.isBuffer(data) ? data : Buffer.from(data as string);
    }

    let compressedData: Buffer;
    
    try {
      switch (opts.algorithm) {
        case 'gzip':
          compressedData = await gzipAsync(data, { level: opts.level });
          break;
          
        case 'deflate':
          compressedData = await deflateAsync(data, { level: opts.level, strategy: opts.strategy });
          break;
          
        case 'brotli':
          // Note: Node.js brotli support varies by version
          // Using a fallback if brotli is not available
          if (typeof zlib.brotliCompress === 'function') {
            compressedData = await promisify(zlib.brotliCompress)(data, {
              params: {
                [zlib.constants.BROTLI_PARAM_QUALITY]: opts.level,
              }
            });
          } else {
            // Fallback to gzip if brotli not available
            this.logger.warn('Brotli not available, falling back to gzip');
            compressedData = await gzipAsync(data, { level: opts.level });
          }
          break;
          
        default:
          compressedData = await gzipAsync(data, { level: opts.level });
      }
      
      const compressionTime = Date.now() - startTime;
      const ratio = compressedData.length / dataSize;
      
      this.logger.debug(`Compressed data: ${dataSize} -> ${compressedData.length} bytes (${(ratio * 100).toFixed(2)}%), took ${compressionTime}ms`);
      
      return compressedData;
    } catch (error) {
      this.logger.error(`Compression failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Decompress data
   */
  async decompress(compressedData: Buffer, algorithm?: 'gzip' | 'deflate' | 'brotli'): Promise<Buffer> {
    const startTime = Date.now();
    const alg = algorithm || this.defaultOptions.algorithm;
    
    try {
      let decompressedData: Buffer;
      
      switch (alg) {
        case 'gzip':
          decompressedData = await gunzipAsync(compressedData);
          break;
          
        case 'deflate':
          decompressedData = await inflateAsync(compressedData);
          break;
          
        case 'brotli':
          if (typeof zlib.brotliDecompress === 'function') {
            decompressedData = await promisify(zlib.brotliDecompress)(compressedData);
          } else {
            // Fallback to gunzip if brotli not available
            this.logger.warn('Brotli not available, falling back to gunzip');
            decompressedData = await gunzipAsync(compressedData);
          }
          break;
          
        default:
          decompressedData = await gunzipAsync(compressedData);
      }
      
      const decompressionTime = Date.now() - startTime;
      this.logger.debug(`Decompressed data in ${decompressionTime}ms`);
      
      return decompressedData;
    } catch (error) {
      this.logger.error(`Decompression failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Compress a string and return as base64 encoded string
   */
  async compressString(data: string, options?: Partial<CompressionOptions>): Promise<string> {
    const compressed = await this.compress(data, options);
    return compressed.toString('base64');
  }

  /**
   * Decompress a base64 encoded string
   */
  async decompressString(compressedData: string, algorithm?: 'gzip' | 'deflate' | 'brotli'): Promise<string> {
    const buffer = Buffer.from(compressedData, 'base64');
    const decompressed = await this.decompress(buffer, algorithm);
    return decompressed.toString('utf8');
  }

  /**
   * Compress JSON data
   */
  async compressJson(data: any, options?: Partial<CompressionOptions>): Promise<Buffer> {
    const jsonString = JSON.stringify(data);
    return this.compress(jsonString, options);
  }

  /**
   * Decompress JSON data
   */
  async decompressJson(compressedData: Buffer, algorithm?: 'gzip' | 'deflate' | 'brotli'): Promise<any> {
    const decompressed = await this.decompress(compressedData, algorithm);
    const jsonString = decompressed.toString('utf8');
    return JSON.parse(jsonString);
  }

  /**
   * Get compression statistics
   */
  async getCompressionStats(data: string | Buffer, options?: Partial<CompressionOptions>): Promise<CompressionStats> {
    const originalSize = Buffer.byteLength(Buffer.isBuffer(data) ? data : Buffer.from(data as string));
    
    if (originalSize < (options?.threshold ?? this.defaultOptions.threshold)) {
      // Return stats for uncompressed data
      return {
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 1,
        compressionTime: 0,
        algorithm: 'none',
      };
    }

    const startTime = Date.now();
    const compressed = await this.compress(data, options);
    const compressionTime = Date.now() - startTime;

    return {
      originalSize,
      compressedSize: compressed.length,
      compressionRatio: compressed.length / originalSize,
      compressionTime,
      algorithm: options?.algorithm || this.defaultOptions.algorithm,
    };
  }

  /**
   * Batch compress multiple data items
   */
  async batchCompress(
    dataArray: Array<string | Buffer>, 
    options?: Partial<CompressionOptions>
  ): Promise<{ compressedData: Buffer[], stats: CompressionStats[] }> {
    const compressedData: Buffer[] = [];
    const stats: CompressionStats[] = [];

    for (const data of dataArray) {
      const compressed = await this.compress(data, options);
      compressedData.push(compressed);
      
      const stat = await this.getCompressionStats(data, options);
      stats.push(stat);
    }

    return { compressedData, stats };
  }

  /**
   * Adaptive compression - chooses the best algorithm based on data characteristics
   */
  async adaptiveCompress(data: string | Buffer): Promise<{ compressedData: Buffer, algorithmUsed: string }> {
    const originalSize = Buffer.byteLength(Buffer.isBuffer(data) ? data : Buffer.from(data as string));
    
    // Don't compress if under threshold
    if (originalSize < this.defaultOptions.threshold) {
      return {
        compressedData: Buffer.isBuffer(data) ? data : Buffer.from(data as string),
        algorithmUsed: 'none'
      };
    }

    // Try different algorithms and pick the best one
    const algorithms: Array<'gzip' | 'deflate'> = ['gzip', 'deflate']; // Exclude brotli for compatibility
    let bestCompressed: Buffer | null = null;
    let bestSize = Infinity;
    let bestAlgorithm: string = 'none';

    for (const algorithm of algorithms) {
      try {
        const compressed = await this.compress(data, { algorithm });
        const size = compressed.length;

        if (size < bestSize) {
          bestSize = size;
          bestCompressed = compressed;
          bestAlgorithm = algorithm;
        }
      } catch (error) {
        this.logger.warn(`Adaptive compression failed for ${algorithm}: ${error.message}`);
      }
    }

    // If no algorithm worked, return original data
    if (!bestCompressed) {
      return {
        compressedData: Buffer.isBuffer(data) ? data : Buffer.from(data as string),
        algorithmUsed: 'none'
      };
    }

    return {
      compressedData: bestCompressed,
      algorithmUsed: bestAlgorithm
    };
  }

  /**
   * Stream compression helper methods
   */
  createCompressionStream(algorithm: 'gzip' | 'deflate' | 'brotli' = 'gzip', options?: any) {
    switch (algorithm) {
      case 'gzip':
        return zlib.createGzip(options);
      case 'deflate':
        return zlib.createDeflate(options);
      case 'brotli':
        if (typeof zlib.createBrotliCompress === 'function') {
          return zlib.createBrotliCompress(options);
        } else {
          this.logger.warn('Brotli stream not available, falling back to gzip');
          return zlib.createGzip(options);
        }
      default:
        return zlib.createGzip(options);
    }
  }

  createDecompressionStream(algorithm: 'gzip' | 'deflate' | 'brotli' = 'gzip', options?: any) {
    switch (algorithm) {
      case 'gzip':
        return zlib.createGunzip(options);
      case 'deflate':
        return zlib.createInflate(options);
      case 'brotli':
        if (typeof zlib.createBrotliDecompress === 'function') {
          return zlib.createBrotliDecompress(options);
        } else {
          this.logger.warn('Brotli stream not available, falling back to gunzip');
          return zlib.createGunzip(options);
        }
      default:
        return zlib.createGunzip(options);
    }
  }
}