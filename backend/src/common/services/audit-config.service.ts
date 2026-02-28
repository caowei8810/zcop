import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuditConfigService {
  constructor(private configService: ConfigService) {}

  getAuditConfig() {
    return {
      enabled: this.configService.get<boolean>('AUDIT_ENABLED') ?? true,
      retentionDays: parseInt(this.configService.get<string>('AUDIT_RETENTION_DAYS')) || 90,
      excludePaths: this.configService.get<string>('AUDIT_EXCLUDE_PATHS')?.split(',') || ['/health', '/metrics'],
      includeRequestBody: this.configService.get<boolean>('AUDIT_INCLUDE_REQUEST_BODY') ?? true,
      includeResponseBody: this.configService.get<boolean>('AUDIT_INCLUDE_RESPONSE_BODY') ?? false,
      sensitiveFields: this.configService.get<string>('AUDIT_SENSITIVE_FIELDS')?.split(',') || ['password', 'token', 'secret'],
      logLevel: this.configService.get<string>('AUDIT_LOG_LEVEL') || 'info',
    };
  }

  getComplianceConfig() {
    return {
      gdprEnabled: this.configService.get<boolean>('COMPLIANCE_GDPR_ENABLED') ?? false,
      ccpaEnabled: this.configService.get<boolean>('COMPLIANCE_CCPA_ENABLED') ?? false,
      hipaaEnabled: this.configService.get<boolean>('COMPLIANCE_HIPAA_ENABLED') ?? false,
      dataResidencyRegion: this.configService.get<string>('DATA_RESIDENCY_REGION') || 'global',
      consentTracking: this.configService.get<boolean>('CONSENT_TRACKING_ENABLED') ?? true,
      rightToErasure: this.configService.get<boolean>('RIGHT_TO_ERASURE_ENABLED') ?? true,
      dataPortability: this.configService.get<boolean>('DATA_PORTABILITY_ENABLED') ?? true,
    };
  }
}