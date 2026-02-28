import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SecurityHardeningConfig {
  enabled: boolean;
  firewallEnabled: boolean;
  intrusionDetectionEnabled: boolean;
  rateLimitingEnabled: boolean;
  encryptionAtRest: boolean;
  encryptionInTransit: boolean;
  auditLogging: boolean;
  secureHeaders: boolean;
  csrfProtection: boolean;
  hstsEnabled: boolean;
  corsEnabled: boolean;
  inputValidation: boolean;
  outputEncoding: boolean;
  privilegeEscalationProtection: boolean;
  sessionManagement: boolean;
  threatIntelligenceIntegration: boolean;
  securityScanFrequency: number; // in minutes
}

export interface SecurityEvent {
  id: string;
  timestamp: number;
  eventType: 'authentication' | 'authorization' | 'access' | 'modification' | 'error' | 'threat';
  severity: 'low' | 'medium' | 'high' | 'critical';
  sourceIp: string;
  userId?: string;
  sessionId?: string;
  action: string;
  resource: string;
  outcome: 'success' | 'failure' | 'blocked';
  details: Record<string, any>;
  threatScore?: number;
}

export interface ThreatIntelligence {
  indicator: string; // IP, domain, hash, etc.
  type: 'ip' | 'domain' | 'url' | 'hash' | 'email';
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string; // Threat intelligence source
  firstSeen: number;
  lastSeen: number;
  confidence: number; // 0-1
  description: string;
}

export interface SecurityRule {
  id: string;
  name: string;
  description: string;
  condition: string; // Expression to evaluate
  action: 'allow' | 'block' | 'log' | 'alert';
  priority: number;
  enabled: boolean;
  createdAt: number;
  lastTriggered?: number;
  triggerCount: number;
}

@Injectable()
export class SecurityHardeningOptimizationService {
  private readonly logger = new Logger(SecurityHardeningOptimizationService.name);
  private config: SecurityHardeningConfig;
  private securityEvents: SecurityEvent[] = [];
  private threatIntelligence: Map<string, ThreatIntelligence> = new Map();
  private securityRules: Map<string, SecurityRule> = new Map();
  private activeSessions: Map<string, { userId: string; lastActivity: number; ip: string }> = new Map();
  private rateLimits: Map<string, { count: number; windowStart: number }> = new Map();
  private blockedEntities: Map<string, { until: number; reason: string }> = new Map();
  private timer: NodeJS.Timeout | null = null;

  constructor(private configService: ConfigService) {
    this.config = {
      enabled: this.configService.get<boolean>('SECURITY_ENABLED') ?? true,
      firewallEnabled: this.configService.get<boolean>('SECURITY_FIREWALL_ENABLED') ?? true,
      intrusionDetectionEnabled: this.configService.get<boolean>('SECURITY_INTRUSION_DETECTION') ?? true,
      rateLimitingEnabled: this.configService.get<boolean>('SECURITY_RATE_LIMITING') ?? true,
      encryptionAtRest: this.configService.get<boolean>('SECURITY_ENCRYPTION_AT_REST') ?? true,
      encryptionInTransit: this.configService.get<boolean>('SECURITY_ENCRYPTION_IN_TRANSIT') ?? true,
      auditLogging: this.configService.get<boolean>('SECURITY_AUDIT_LOGGING') ?? true,
      secureHeaders: this.configService.get<boolean>('SECURITY_SECURE_HEADERS') ?? true,
      csrfProtection: this.configService.get<boolean>('SECURITY_CSRF_PROTECTION') ?? true,
      hstsEnabled: this.configService.get<boolean>('SECURITY_HSTS_ENABLED') ?? true,
      corsEnabled: this.configService.get<boolean>('SECURITY_CORS_ENABLED') ?? true,
      inputValidation: this.configService.get<boolean>('SECURITY_INPUT_VALIDATION') ?? true,
      outputEncoding: this.configService.get<boolean>('SECURITY_OUTPUT_ENCODING') ?? true,
      privilegeEscalationProtection: this.configService.get<boolean>('SECURITY_PRIVILEGE_ESCALATION') ?? true,
      sessionManagement: this.configService.get<boolean>('SECURITY_SESSION_MANAGEMENT') ?? true,
      threatIntelligenceIntegration: this.configService.get<boolean>('SECURITY_THREAT_INTELLIGENCE') ?? true,
      securityScanFrequency: this.configService.get<number>('SECURITY_SCAN_FREQUENCY') || 60, // every hour
    };

    // Initialize default security rules
    this.initializeDefaultSecurityRules();
  }

  /**
   * Initialize default security rules
   */
  private initializeDefaultSecurityRules(): void {
    // Block known malicious IPs
    this.addSecurityRule({
      id: 'rule-block-malicious-ip',
      name: 'Block Malicious IPs',
      description: 'Blocks traffic from IPs in threat intelligence feed',
      condition: 'isKnownThreat(sourceIp)',
      action: 'block',
      priority: 1,
      enabled: true,
      createdAt: Date.now(),
      triggerCount: 0,
    });

    // Rate limiting rule
    this.addSecurityRule({
      id: 'rule-rate-limit',
      name: 'Rate Limiting',
      description: 'Blocks excessive requests from same IP',
      condition: 'requestCount > 100 in 5 minutes',
      action: 'block',
      priority: 2,
      enabled: true,
      createdAt: Date.now(),
      triggerCount: 0,
    });

    // SQL injection detection
    this.addSecurityRule({
      id: 'rule-sql-injection',
      name: 'SQL Injection Detection',
      description: 'Detects potential SQL injection attempts',
      condition: 'containsSqlInjection(payload)',
      action: 'block',
      priority: 3,
      enabled: true,
      createdAt: Date.now(),
      triggerCount: 0,
    });
  }

  /**
   * Log a security event
   */
  async logSecurityEvent(event: Omit<SecurityEvent, 'id' | 'timestamp'>): Promise<void> {
    if (!this.config.auditLogging) {
      return;
    }

    const securityEvent: SecurityEvent = {
      ...event,
      id: this.generateId(),
      timestamp: Date.now(),
    };

    this.securityEvents.push(securityEvent);

    // Keep only recent events (last 30 days worth)
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    this.securityEvents = this.securityEvents.filter(e => e.timestamp >= thirtyDaysAgo);

    // Check against security rules
    await this.evaluateSecurityRules(securityEvent);

    // Check for threats in threat intelligence
    if (this.config.threatIntelligenceIntegration) {
      await this.checkAgainstThreatIntelligence(securityEvent);
    }

    // Log appropriately based on severity
    switch (event.severity) {
      case 'critical':
        this.logger.error(`[SECURITY-CRITICAL] ${event.action} on ${event.resource}`, securityEvent);
        break;
      case 'high':
        this.logger.warn(`[SECURITY-HIGH] ${event.action} on ${event.resource}`, securityEvent);
        break;
      case 'medium':
        this.logger.log(`[SECURITY-MEDIUM] ${event.action} on ${event.resource}`, securityEvent);
        break;
      case 'low':
        this.logger.debug(`[SECURITY-LOW] ${event.action} on ${event.resource}`, securityEvent);
        break;
    }
  }

  /**
   * Evaluate security rules against an event
   */
  private async evaluateSecurityRules(event: SecurityEvent): Promise<void> {
    // Sort rules by priority (lower number = higher priority)
    const rules = Array.from(this.securityRules.values())
      .filter(rule => rule.enabled)
      .sort((a, b) => a.priority - b.priority);

    for (const rule of rules) {
      // This is a simplified condition evaluation
      // In a real implementation, you would use a proper expression evaluator
      const shouldTrigger = await this.evaluateCondition(rule.condition, event);
      
      if (shouldTrigger) {
        rule.triggerCount++;
        rule.lastTriggered = Date.now();
        
        // Take action based on rule
        switch (rule.action) {
          case 'block':
            await this.blockEntity(event.sourceIp, `Triggered rule: ${rule.name}`, 3600); // Block for 1 hour
            break;
          case 'alert':
            this.logger.warn(`Security rule triggered: ${rule.name}`, event);
            break;
          case 'log':
            this.logger.log(`Security rule matched: ${rule.name}`, event);
            break;
        }
      }
    }
  }

  /**
   * Check event against threat intelligence
   */
  private async checkAgainstThreatIntelligence(event: SecurityEvent): Promise<void> {
    // Check source IP
    if (this.threatIntelligence.has(event.sourceIp)) {
      const threat = this.threatIntelligence.get(event.sourceIp)!;
      event.threatScore = threat.confidence * (threat.severity === 'critical' ? 1.0 : 
                                               threat.severity === 'high' ? 0.8 : 
                                               threat.severity === 'medium' ? 0.6 : 0.4);
      
      await this.logSecurityEvent({
        ...event,
        eventType: 'threat',
        severity: threat.severity,
        action: `THREAT_DETECTED: ${threat.description}`,
        outcome: 'blocked',
        details: { ...event.details, threatIndicator: threat.indicator, threatSource: threat.source }
      });
    }
  }

  /**
   * Evaluate a condition against an event
   * This is a simplified implementation - in reality, you'd use a proper expression evaluator
   */
  private async evaluateCondition(condition: string, event: SecurityEvent): Promise<boolean> {
    // Simplified condition evaluation
    // In a real implementation, you would parse and evaluate the condition safely
    try {
      // Example conditions:
      if (condition.includes('requestCount > 100 in 5 minutes')) {
        return await this.checkRateLimit(event.sourceIp, 100, 5 * 60 * 1000);
      } else if (condition.includes('isKnownThreat')) {
        return this.threatIntelligence.has(event.sourceIp);
      }
      // Add more condition evaluations as needed
      
      return false;
    } catch (error) {
      this.logger.error(`Error evaluating security condition: ${error.message}`);
      return false;
    }
  }

  /**
   * Add a security rule
   */
  addSecurityRule(rule: Omit<SecurityRule, 'triggerCount' | 'createdAt'>): SecurityRule {
    const newRule: SecurityRule = {
      ...rule,
      triggerCount: 0,
      createdAt: Date.now(),
    };

    this.securityRules.set(rule.id, newRule);
    this.logger.log(`Added security rule: ${rule.name} (${rule.id})`);
    return newRule;
  }

  /**
   * Remove a security rule
   */
  removeSecurityRule(ruleId: string): boolean {
    const deleted = this.securityRules.delete(ruleId);
    if (deleted) {
      this.logger.log(`Removed security rule: ${ruleId}`);
    }
    return deleted;
  }

  /**
   * Check if an entity is blocked
   */
  isBlocked(entity: string): boolean {
    const blockInfo = this.blockedEntities.get(entity);
    if (!blockInfo) {
      return false;
    }

    if (Date.now() > blockInfo.until) {
      // Block has expired, remove it
      this.blockedEntities.delete(entity);
      return false;
    }

    return true;
  }

  /**
   * Block an entity (IP, user, etc.)
   */
  async blockEntity(entity: string, reason: string, duration: number = 3600): Promise<void> {
    const until = Date.now() + (duration * 1000);
    this.blockedEntities.set(entity, { until, reason });
    
    this.logger.warn(`Blocked entity ${entity} for ${duration}s: ${reason}`);
    
    await this.logSecurityEvent({
      eventType: 'access',
      severity: 'high',
      sourceIp: entity.includes('.') ? entity : 'unknown', // Simple IP detection
      action: 'BLOCK_ENTITY',
      resource: entity,
      outcome: 'blocked',
      details: { reason, duration },
    });
  }

  /**
   * Unblock an entity
   */
  unblockEntity(entity: string): boolean {
    const deleted = this.blockedEntities.delete(entity);
    if (deleted) {
      this.logger.log(`Unblocked entity: ${entity}`);
    }
    return deleted;
  }

  /**
   * Check rate limit for an entity
   */
  async checkRateLimit(entity: string, maxRequests: number, windowMs: number): Promise<boolean> {
    if (!this.config.rateLimitingEnabled) {
      return false;
    }

    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Get or create rate limit record
    let rateLimit = this.rateLimits.get(entity);
    if (!rateLimit || rateLimit.windowStart < windowStart) {
      // Reset the window
      rateLimit = { count: 1, windowStart: now };
      this.rateLimits.set(entity, rateLimit);
      return false; // Not over limit
    }

    // Increment count
    rateLimit.count++;
    
    // Check if over limit
    const overLimit = rateLimit.count > maxRequests;
    
    if (overLimit) {
      // Log the rate limit event
      await this.logSecurityEvent({
        eventType: 'access',
        severity: 'medium',
        sourceIp: entity,
        action: 'RATE_LIMIT_EXCEEDED',
        resource: 'API',
        outcome: 'blocked',
        details: { maxRequests, windowMs, currentCount: rateLimit.count },
      });
    }
    
    // Clean up old entries periodically
    if (Math.random() < 0.1) { // 10% chance to clean up
      this.cleanupRateLimits();
    }
    
    return overLimit;
  }

  /**
   * Clean up old rate limit entries
   */
  private cleanupRateLimits(): void {
    const now = Date.now();
    for (const [entity, rateLimit] of this.rateLimits.entries()) {
      if (now - rateLimit.windowStart > 10 * 60 * 1000) { // 10 minutes
        this.rateLimits.delete(entity);
      }
    }
  }

  /**
   * Validate input against common attack patterns
   */
  validateInput(input: string, inputType: 'sql' | 'xss' | 'path' | 'command' | 'generic' = 'generic'): boolean {
    if (!this.config.inputValidation) {
      return true;
    }

    // Common attack patterns
    const patterns: Record<string, RegExp> = {
      sql: /('|--|;|\b(OR|AND)\b\s+\d+=\d+)/gi,
      xss: /(<script|javascript:|on\w+\s*=)/gi,
      path: /\.\.\//g,
      command: /(;|&&|\||`|\$\(.*\))/g,
    };

    const regex = patterns[inputType] || patterns.generic;
    return !regex.test(input);
  }

  /**
   * Encode output to prevent XSS
   */
  encodeOutput(output: string): string {
    if (!this.config.outputEncoding) {
      return output;
    }

    // Simple HTML encoding
    return output
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  /**
   * Create a new session
   */
  createSession(userId: string, ip: string): string {
    if (!this.config.sessionManagement) {
      return 'session-placeholder';
    }

    const sessionId = this.generateId();
    this.activeSessions.set(sessionId, { userId, lastActivity: Date.now(), ip });
    
    this.logger.debug(`Created session for user ${userId} from IP ${ip}`);
    return sessionId;
  }

  /**
   * Validate a session
   */
  validateSession(sessionId: string, userId?: string): boolean {
    if (!this.config.sessionManagement) {
      return true;
    }

    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return false;
    }

    // Check if session is still active (not timed out)
    const sessionTimeout = 30 * 60 * 1000; // 30 minutes
    if (Date.now() - session.lastActivity > sessionTimeout) {
      this.activeSessions.delete(sessionId);
      return false;
    }

    // Optionally verify user ID matches
    if (userId && session.userId !== userId) {
      return false;
    }

    // Update last activity
    session.lastActivity = Date.now();
    return true;
  }

  /**
   * Destroy a session
   */
  destroySession(sessionId: string): boolean {
    return this.activeSessions.delete(sessionId);
  }

  /**
   * Add threat intelligence indicator
   */
  addThreatIndicator(indicator: Omit<ThreatIntelligence, 'firstSeen' | 'lastSeen'>): ThreatIntelligence {
    const threat: ThreatIntelligence = {
      ...indicator,
      firstSeen: Date.now(),
      lastSeen: Date.now(),
    };

    this.threatIntelligence.set(indicator.indicator, threat);
    this.logger.warn(`Added threat indicator: ${indicator.indicator} from ${indicator.source}`);
    return threat;
  }

  /**
   * Remove threat intelligence indicator
   */
  removeThreatIndicator(indicator: string): boolean {
    return this.threatIntelligence.delete(indicator);
  }

  /**
   * Get security events
   */
  getSecurityEvents(
    eventType?: string,
    severity?: string,
    startTime?: number,
    endTime?: number,
    limit: number = 100
  ): SecurityEvent[] {
    let events = this.securityEvents;

    if (eventType) {
      events = events.filter(e => e.eventType === eventType);
    }

    if (severity) {
      events = events.filter(e => e.severity === severity as any);
    }

    if (startTime) {
      events = events.filter(e => e.timestamp >= startTime);
    }

    if (endTime) {
      events = events.filter(e => e.timestamp <= endTime);
    }

    // Sort by timestamp (newest first) and limit
    return events
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get security statistics
   */
  getSecurityStats(): {
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsBySeverity: Record<string, number>;
    blockedEntities: number;
    activeSessions: number;
    threatIndicators: number;
    rulesCount: number;
  } {
    const eventsByType: Record<string, number> = {};
    const eventsBySeverity: Record<string, number> = {};

    for (const event of this.securityEvents) {
      eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;
      eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;
    }

    return {
      totalEvents: this.securityEvents.length,
      eventsByType,
      eventsBySeverity,
      blockedEntities: this.blockedEntities.size,
      activeSessions: this.activeSessions.size,
      threatIndicators: this.threatIntelligence.size,
      rulesCount: this.securityRules.size,
    };
  }

  /**
   * Generate security report
   */
  generateSecurityReport(daysBack: number = 7): {
    summary: {
      totalEvents: number;
      criticalEvents: number;
      highEvents: number;
      mediumEvents: number;
      blockedAttempts: number;
      detectedThreats: number;
    };
    topSources: Array<{ ip: string; count: number }>;
    topTargets: Array<{ resource: string; count: number }>;
    timeline: Array<{ date: string; events: number }>;
    securityRulesStatus: Array<{ ruleName: string; triggerCount: number; lastTriggered: string }>;
  } {
    const since = Date.now() - (daysBack * 24 * 60 * 60 * 1000);
    const events = this.securityEvents.filter(e => e.timestamp >= since);

    // Summary
    const criticalEvents = events.filter(e => e.severity === 'critical').length;
    const highEvents = events.filter(e => e.severity === 'high').length;
    const mediumEvents = events.filter(e => e.severity === 'medium').length;

    // Top sources
    const sourceCounts = new Map<string, number>();
    for (const event of events) {
      sourceCounts.set(event.sourceIp, (sourceCounts.get(event.sourceIp) || 0) + 1);
    }
    const topSources = Array.from(sourceCounts.entries())
      .map(([ip, count]) => ({ ip, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Top targets
    const targetCounts = new Map<string, number>();
    for (const event of events) {
      targetCounts.set(event.resource, (targetCounts.get(event.resource) || 0) + 1);
    }
    const topTargets = Array.from(targetCounts.entries())
      .map(([resource, count]) => ({ resource, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Timeline (by day)
    const timelineMap = new Map<string, number>();
    for (const event of events) {
      const date = new Date(event.timestamp).toISOString().split('T')[0];
      timelineMap.set(date, (timelineMap.get(date) || 0) + 1);
    }
    const timeline = Array.from(timelineMap.entries())
      .map(([date, events]) => ({ date, events }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Security rules status
    const rulesStatus = Array.from(this.securityRules.values())
      .map(rule => ({
        ruleName: rule.name,
        triggerCount: rule.triggerCount,
        lastTriggered: rule.lastTriggered ? new Date(rule.lastTriggered).toISOString() : 'Never',
      }));

    return {
      summary: {
        totalEvents: events.length,
        criticalEvents,
        highEvents,
        mediumEvents,
        blockedAttempts: this.blockedEntities.size,
        detectedThreats: this.threatIntelligence.size,
      },
      topSources,
      topTargets,
      timeline,
      securityRulesStatus,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<SecurityHardeningConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.log('Updated security hardening configuration');
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  /**
   * Close the security service
   */
  close(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.logger.log('Security hardening service closed');
  }
}