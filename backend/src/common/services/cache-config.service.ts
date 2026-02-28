import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CacheConfigService {
  constructor(private configService: ConfigService) {}

  getCacheConfig() {
    return {
      enabled: this.configService.get<boolean>('CACHE_ENABLED') ?? true,
      defaultTTL: parseInt(this.configService.get<string>('CACHE_DEFAULT_TTL')) || 3600, // 1 hour
      maxTTL: parseInt(this.configService.get<string>('CACHE_MAX_TTL')) || 86400, // 24 hours
      prefix: this.configService.get<string>('CACHE_PREFIX') || 'zcop:',
      compression: this.configService.get<boolean>('CACHE_COMPRESSION') ?? false,
      trackPerformance: this.configService.get<boolean>('CACHE_PERFORMANCE_TRACKING') ?? true,
    };
  }

  getCacheStrategyConfig() {
    return {
      ttlByEndpoint: {
        '/api/ontology/entities': parseInt(this.configService.get<string>('CACHE_ONTOLOGY_TTL')) || 300, // 5 minutes
        '/api/ontology/relations': parseInt(this.configService.get<string>('CACHE_RELATIONS_TTL')) || 300,
        '/api/users/profile': parseInt(this.configService.get<string>('CACHE_PROFILE_TTL')) || 900, // 15 minutes
        '/api/system/stats': parseInt(this.configService.get<string>('CACHE_STATS_TTL')) || 60, // 1 minute
      },
      cacheableMethods: this.configService.get<string>('CACHE_METHODS')?.split(',') || ['GET'],
      excludedPaths: this.configService.get<string>('CACHE_EXCLUDED_PATHS')?.split(',') || ['/api/auth', '/api/admin'],
    };
  }
}