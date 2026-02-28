import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export enum ErrorCategory {
  SYSTEM = 'system',
  BUSINESS = 'business',
  NETWORK = 'network',
  DATABASE = 'database',
  SECURITY = 'security',
  VALIDATION = 'validation',
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface ErrorInfo {
  id: string;
  timestamp: Date;
  category: ErrorCategory;
  severity: ErrorSeverity;
  code: string;
  message: string;
  details?: any;
  context?: any;
  stack?: string;
  userId?: string;
  requestId?: string;
  handled: boolean;
  attempts: number;
  resolved: boolean;
  resolutionTime?: Date;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffMultiplier: number;
  jitter: boolean;
  exponential: boolean;
  delayMs: number;
}

export interface CircuitBreakerConfig {
  threshold: number;
  timeoutMs: number;
  halfOpenAfterMs: number;
}

export interface ErrorHandlingConfig {
  defaultRetryPolicy: RetryPolicy;
  logSensitiveData: boolean;
  errorReportingEnabled: boolean;
  circuitBreakerEnabled: boolean;
  metricsCollectionEnabled: boolean;
}

@Injectable()
export class ErrorHandlingOptimizationService {
  private readonly logger = new Logger(ErrorHandlingOptimizationService.name);
  private errors: Map<string, ErrorInfo> = new Map();
  private errorCounts: Map<string, number> = new Map();
  private retryCounters: Map<string, number> = new Map();
  private circuitBreakers: Map<string, {
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    failureCount: number;
    lastFailure: Date;
    nextTry: Date;
  }> = new Map();
  private config: ErrorHandlingConfig;
  private readonly maxErrorsToStore: number;

  constructor(private configService: ConfigService) {
    this.config = this.getDefaultConfig();
    this.maxErrorsToStore = this.configService.get<number>('ERROR_MAX_STORED') || 1000;
  }

  private getDefaultConfig(): ErrorHandlingConfig {
    return {
      defaultRetryPolicy: {
        maxAttempts: this.configService.get<number>('ERROR_RETRY_MAX_ATTEMPTS') || 3,
        backoffMultiplier: this.configService.get<number>('ERROR_RETRY_BACKOFF_MULTIPLIER') || 2,
        jitter: this.configService.get<boolean>('ERROR_RETRY_JITTER') ?? true,
        exponential: this.configService.get<boolean>('ERROR_RETRY_EXPONENTIAL') ?? true,
        delayMs: this.configService.get<number>('ERROR_RETRY_DELAY_MS') || 1000,
      },
      logSensitiveData: this.configService.get<boolean>('ERROR_LOG_SENSITIVE_DATA') ?? false,
      errorReportingEnabled: this.configService.get<boolean>('ERROR_REPORTING_ENABLED') ?? true,
      circuitBreakerEnabled: this.configService.get<boolean>('ERROR_CIRCUIT_BREAKER_ENABLED') ?? true,
      metricsCollectionEnabled: this.configService.get<boolean>('ERROR_METRICS_ENABLED') ?? true,
    };
  }

  /**
   * Log an error with full context
   */
  async logError(
    error: Error | string,
    category: ErrorCategory,
    severity: ErrorSeverity,
    context?: any,
    userId?: string,
    requestId?: string
  ): Promise<ErrorInfo> {
    const errorId = this.generateErrorId();
    const message = typeof error === 'string' ? error : error.message;
    const stack = typeof error !== 'string' ? error.stack : undefined;

    // Don't log sensitive data if disabled
    const safeContext = this.config.logSensitiveData ? context : this.sanitizeContext(context);

    const errorInfo: ErrorInfo = {
      id: errorId,
      timestamp: new Date(),
      category,
      severity,
      code: this.deriveErrorCode(category, severity),
      message,
      details: typeof error !== 'string' ? error : undefined,
      context: safeContext,
      stack,
      userId,
      requestId,
      handled: false,
      attempts: 0,
      resolved: false,
    };

    // Store error info
    this.errors.set(errorId, errorInfo);

    // Trim old errors if we exceed the limit
    if (this.errors.size > this.maxErrorsToStore) {
      const errorIds = Array.from(this.errors.keys()).sort(
        (a, b) => this.errors.get(a)!.timestamp.getTime() - this.errors.get(b)!.timestamp.getTime()
      );
      const toRemove = errorIds.slice(0, errorIds.length - this.maxErrorsToStore);
      toRemove.forEach(id => this.errors.delete(id));
    }

    // Increment error count for this category
    const categoryKey = `${category}_${severity}`;
    this.errorCounts.set(categoryKey, (this.errorCounts.get(categoryKey) || 0) + 1);

    // Log based on severity
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        this.logger.error(errorInfo);
        break;
      case ErrorSeverity.HIGH:
        this.logger.warn(errorInfo);
        break;
      default:
        this.logger.log(errorInfo);
    }

    // Check if we need to trigger circuit breaker
    await this.checkCircuitBreaker(categoryKey);

    return errorInfo;
  }

  /**
   * Handle an error with retry logic
   */
  async handleErrorWithRetry<T>(
    operation: () => Promise<T>,
    errorCategory: ErrorCategory,
    errorSeverity: ErrorSeverity,
    retryPolicy?: RetryPolicy,
    context?: any
  ): Promise<T> {
    const policy = retryPolicy || this.config.defaultRetryPolicy;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
      try {
        // Check circuit breaker before attempting
        if (this.config.circuitBreakerEnabled) {
          const categoryKey = `${errorCategory}_${errorSeverity}`;
          if (this.isCircuitOpen(categoryKey)) {
            throw new Error(`Circuit breaker open for ${categoryKey}`);
          }
        }

        const result = await operation();
        
        // If successful and we had previous attempts, log recovery
        if (attempt > 1) {
          this.logger.log(`Operation recovered on attempt ${attempt}`);
        }
        
        return result;
      } catch (error) {
        lastError = error;
        this.logger.warn(`Attempt ${attempt} failed: ${error.message}`);

        // Log the error
        await this.logError(
          error,
          errorCategory,
          errorSeverity,
          { ...context, attempt, maxAttempts: policy.maxAttempts },
          context?.userId,
          context?.requestId
        );

        // If this is the last attempt, stop retrying
        if (attempt === policy.maxAttempts) {
          break;
        }

        // Calculate delay with backoff and jitter
        let delay = policy.delayMs * Math.pow(policy.backoffMultiplier, attempt - 1);
        
        if (policy.jitter) {
          // Add random jitter to prevent thundering herd
          const jitter = Math.random() * 0.1 * delay; // ±5% jitter
          delay = policy.exponential 
            ? delay + jitter 
            : delay * (1 + (Math.random() - 0.5) * 0.2); // ±10% jitter
        }

        // Wait before next attempt
        await this.sleep(delay);
      }
    }

    // If we get here, all retries failed
    if (lastError) {
      throw lastError;
    } else {
      throw new Error('Operation failed after retries');
    }
  }

  /**
   * Execute operation with circuit breaker protection
   */
  async executeWithCircuitBreaker<T>(
    operation: () => Promise<T>,
    operationName: string,
    circuitConfig?: CircuitBreakerConfig
  ): Promise<T> {
    if (!this.config.circuitBreakerEnabled) {
      return operation();
    }

    const config = circuitConfig || {
      threshold: 5,
      timeoutMs: 60000,
      halfOpenAfterMs: 30000,
    };

    // Check if circuit is open
    if (this.isCircuitOpen(operationName)) {
      throw new Error(`Circuit breaker open for ${operationName}`);
    }

    try {
      const result = await operation();
      
      // On success, close the circuit if it was half-open
      this.closeCircuit(operationName);
      
      return result;
    } catch (error) {
      // On failure, trip the circuit
      await this.tripCircuit(operationName, config);
      throw error;
    }
  }

  /**
   * Check if circuit breaker should open
   */
  private async checkCircuitBreaker(categoryKey: string): Promise<void> {
    if (!this.config.circuitBreakerEnabled) return;

    const errorCount = this.errorCounts.get(categoryKey) || 0;
    const config = {
      threshold: 10, // Default threshold
      timeoutMs: 60000,
      halfOpenAfterMs: 30000,
    };

    if (errorCount >= config.threshold) {
      this.tripCircuit(categoryKey, config);
    }
  }

  /**
   * Trip circuit breaker
   */
  private async tripCircuit(operationName: string, config: CircuitBreakerConfig): Promise<void> {
    const now = new Date();
    this.circuitBreakers.set(operationName, {
      state: 'OPEN',
      failureCount: (this.circuitBreakers.get(operationName)?.failureCount || 0) + 1,
      lastFailure: now,
      nextTry: new Date(now.getTime() + config.halfOpenAfterMs),
    });

    this.logger.warn(`Circuit breaker tripped for ${operationName}`);
  }

  /**
   * Close circuit breaker
   */
  private closeCircuit(operationName: string): void {
    this.circuitBreakers.delete(operationName);
  }

  /**
   * Check if circuit is open
   */
  private isCircuitOpen(operationName: string): boolean {
    const cb = this.circuitBreakers.get(operationName);
    if (!cb) return false;

    if (cb.state === 'CLOSED') {
      return false;
    }

    if (cb.state === 'OPEN') {
      const now = new Date();
      if (now >= cb.nextTry) {
        // Move to half-open state
        this.circuitBreakers.set(operationName, {
          ...cb,
          state: 'HALF_OPEN',
        });
        return false; // Allow one trial request
      }
      return true; // Still open
    }

    // HALF_OPEN state - only one request allowed, others are blocked
    return false;
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    totalErrors: number;
    byCategory: Record<ErrorCategory, number>;
    bySeverity: Record<ErrorSeverity, number>;
    recentErrors: ErrorInfo[];
    circuitBreakerStatus: Record<string, any>;
  } {
    const byCategory: Record<ErrorCategory, number> = {
      [ErrorCategory.SYSTEM]: 0,
      [ErrorCategory.BUSINESS]: 0,
      [ErrorCategory.NETWORK]: 0,
      [ErrorCategory.DATABASE]: 0,
      [ErrorCategory.SECURITY]: 0,
      [ErrorCategory.VALIDATION]: 0,
    };

    const bySeverity: Record<ErrorSeverity, number> = {
      [ErrorSeverity.LOW]: 0,
      [ErrorSeverity.MEDIUM]: 0,
      [ErrorSeverity.HIGH]: 0,
      [ErrorSeverity.CRITICAL]: 0,
    };

    // Count errors by category and severity
    for (const [, error] of this.errors) {
      byCategory[error.category]++;
      bySeverity[error.severity]++;
    }

    return {
      totalErrors: this.errors.size,
      byCategory,
      bySeverity,
      recentErrors: Array.from(this.errors.values())
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 50),
      circuitBreakerStatus: Object.fromEntries(
        Array.from(this.circuitBreakers.entries()).map(([key, value]) => [
          key,
          { ...value, nextTry: value.nextTry.toISOString() }
        ])
      ),
    };
  }

  /**
   * Resolve an error
   */
  async resolveError(errorId: string, resolutionDetails?: any): Promise<boolean> {
    const errorInfo = this.errors.get(errorId);
    if (!errorInfo) {
      return false;
    }

    errorInfo.resolved = true;
    errorInfo.resolutionTime = new Date();
    
    if (resolutionDetails) {
      errorInfo.context = { ...errorInfo.context, resolutionDetails };
    }

    this.logger.log(`Error ${errorId} marked as resolved`);
    return true;
  }

  /**
   * Create a standardized error response
   */
  createErrorResponse(
    error: Error | string,
    status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    context?: any
  ): {
    statusCode: number;
    message: string;
    error: string;
    timestamp: string;
    path?: string;
    context?: any;
  } {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const errorName = typeof error === 'string' ? 'Error' : error.constructor.name;

    return {
      statusCode: status,
      message: errorMessage,
      error: errorName,
      timestamp: new Date().toISOString(),
      ...(context?.path && { path: context.path }),
      ...(context && { context }),
    };
  }

  /**
   * Sanitize context data to remove sensitive information
   */
  private sanitizeContext(context: any): any {
    if (!context || typeof context !== 'object') {
      return context;
    }

    const sanitized = { ...context };
    const sensitiveFields = [
      'password', 'token', 'secret', 'key', 'authorization', 'auth',
      'credentials', 'creditCard', 'ssn', 'socialSecurity'
    ];

    for (const field of sensitiveFields) {
      if (sanitized.hasOwnProperty(field)) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Generate error code based on category and severity
   */
  private deriveErrorCode(category: ErrorCategory, severity: ErrorSeverity): string {
    const categoryCode = {
      [ErrorCategory.SYSTEM]: 'SYS',
      [ErrorCategory.BUSINESS]: 'BUS',
      [ErrorCategory.NETWORK]: 'NET',
      [ErrorCategory.DATABASE]: 'DB',
      [ErrorCategory.SECURITY]: 'SEC',
      [ErrorCategory.VALIDATION]: 'VAL',
    }[category];

    const severityCode = {
      [ErrorSeverity.LOW]: 'L',
      [ErrorSeverity.MEDIUM]: 'M',
      [ErrorSeverity.HIGH]: 'H',
      [ErrorSeverity.CRITICAL]: 'C',
    }[severity];

    const errorCode = `${categoryCode}${severityCode}${Date.now() % 10000}`;

    return errorCode;
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `ERR_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`;
  }

  /**
   * Sleep utility function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}