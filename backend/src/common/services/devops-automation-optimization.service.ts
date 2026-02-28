import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface DevOpsAutomationConfig {
  enabled: boolean;
  maxConcurrentTasks: number;
  taskTimeout: number;           // in seconds
  retryAttempts: number;
  retryDelay: number;            // in ms
  notificationEnabled: boolean;
  auditLogging: boolean;
  resourceQuota: {
    cpu: number;                // millicores
    memory: number;             // MB
    storage: number;            // GB
  };
  approvalRequired: boolean;
  autoRollback: boolean;
  driftDetection: boolean;
  complianceChecking: boolean;
  backupEnabled: boolean;
  backupRetention: number;      // in days
}

export interface InfrastructureAsCode {
  id: string;
  name: string;
  type: 'terraform' | 'cloudformation' | 'kubernetes' | 'ansible' | 'custom';
  provider: string;            // aws, azure, gcp, kubernetes, etc.
  path: string;
  variables: Record<string, any>;
  state: 'pending' | 'applied' | 'failed' | 'drifted' | 'compliant';
  lastApplied: number;
  lastModified: number;
  version: string;
  dependencies: string[];
}

export interface DeploymentTask {
  id: string;
  name: string;
  type: 'provision' | 'configure' | 'deploy' | 'update' | 'destroy' | 'backup' | 'restore';
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled' | 'approved' | 'rejected';
  startedAt: number;
  finishedAt?: number;
  duration?: number;
  resourcesUsed: {
    cpu: number;               // millicores
    memory: number;            // MB
    storage: number;           // MB
  };
  logs: string[];
  error?: string;
  approver?: string;
  approvedAt?: number;
  dependencies: string[];       // other task IDs this task depends on
  timeout: number;             // in seconds
  maxRetries: number;
  retryCount: number;
  targetEnvironment: string;
  rollbackPossible: boolean;
}

export interface ComplianceCheck {
  id: string;
  name: string;
  type: 'security' | 'compliance' | 'performance' | 'cost' | 'availability';
  status: 'pass' | 'fail' | 'warn' | 'skipped';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  remediation: string;
  checkedAt: number;
  resource: string;
  tags: string[];
}

@Injectable()
export class DevOpsAutomationOptimizationService {
  private readonly logger = new Logger(DevOpsAutomationOptimizationService.name);
  private config: DevOpsAutomationConfig;
  private deploymentTasks: Map<string, DeploymentTask> = new Map();
  private infrastructureConfigs: Map<string, InfrastructureAsCode> = new Map();
  private complianceChecks: ComplianceCheck[] = [];
  private activeTasks: Set<string> = new Map();
  private taskQueue: string[] = [];
  private approvalsQueue: string[] = [];
  private resourceUsage: {
    cpu: number;
    memory: number;
    storage: number;
  } = { cpu: 0, memory: 0, storage: 0 };
  private timer: NodeJS.Timeout | null = null;

  constructor(private configService: ConfigService) {
    this.config = {
      enabled: this.configService.get<boolean>('DEVOPS_AUTOMATION_ENABLED') ?? true,
      maxConcurrentTasks: this.configService.get<number>('DEVOPS_MAX_CONCURRENT_TASKS') || 5,
      taskTimeout: this.configService.get<number>('DEVOPS_TASK_TIMEOUT') || 1800, // 30 minutes
      retryAttempts: this.configService.get<number>('DEVOPS_RETRY_ATTEMPTS') || 3,
      retryDelay: this.configService.get<number>('DEVOPS_RETRY_DELAY') || 5000, // 5 seconds
      notificationEnabled: this.configService.get<boolean>('DEVOPS_NOTIFICATIONS_ENABLED') ?? true,
      auditLogging: this.configService.get<boolean>('DEVOPS_AUDIT_LOGGING') ?? true,
      resourceQuota: {
        cpu: this.configService.get<number>('DEVOPS_RESOURCE_QUOTA_CPU') || 4000, // 4 cores
        memory: this.configService.get<number>('DEVOPS_RESOURCE_QUOTA_MEMORY') || 8192, // 8GB
        storage: this.configService.get<number>('DEVOPS_RESOURCE_QUOTA_STORAGE') || 100, // 100GB
      },
      approvalRequired: this.configService.get<boolean>('DEVOPS_APPROVAL_REQUIRED') ?? false,
      autoRollback: this.configService.get<boolean>('DEVOPS_AUTO_ROLLBACK') ?? true,
      driftDetection: this.configService.get<boolean>('DEVOPS_DRIFT_DETECTION') ?? true,
      complianceChecking: this.configService.get<boolean>('DEVOPS_COMPLIANCE_CHECKING') ?? true,
      backupEnabled: this.configService.get<boolean>('DEVOPS_BACKUP_ENABLED') ?? true,
      backupRetention: this.configService.get<number>('DEVOPS_BACKUP_RETENTION') || 30, // 30 days
    };

    // Start the task processor
    this.startTaskProcessor();
  }

  /**
   * Start the task processor
   */
  private startTaskProcessor(): void {
    this.timer = setInterval(async () => {
      await this.processTaskQueue();
      await this.processApprovalsQueue();
    }, 5000); // Process every 5 seconds

    this.logger.log(`Started DevOps automation task processor with ${this.config.maxConcurrentTasks} max concurrent tasks`);
  }

  /**
   * Submit a new deployment task
   */
  async submitTask(task: Omit<DeploymentTask, 'id' | 'status' | 'startedAt' | 'resourcesUsed' | 'logs' | 'retryCount'>): Promise<DeploymentTask> {
    if (!this.config.enabled) {
      throw new Error('DevOps automation is disabled');
    }

    const taskId = this.generateId();
    const newTask: DeploymentTask = {
      ...task,
      id: taskId,
      status: this.config.approvalRequired ? 'pending' : 'approved',
      startedAt: Date.now(),
      resourcesUsed: { cpu: 0, memory: 0, storage: 0 },
      logs: [`Task submitted: ${task.name}`],
      timeout: task.timeout || this.config.taskTimeout,
      maxRetries: task.maxRetries || this.config.retryAttempts,
      retryCount: 0,
    };

    this.deploymentTasks.set(taskId, newTask);

    if (this.config.approvalRequired) {
      this.approvalsQueue.push(taskId);
      this.logger.log(`Task ${taskId} submitted for approval: ${task.name}`);
    } else {
      this.taskQueue.push(taskId);
      this.logger.log(`Task ${taskId} queued for execution: ${task.name}`);
    }

    return newTask;
  }

  /**
   * Approve a task for execution
   */
  approveTask(taskId: string, approver: string): boolean {
    const task = this.deploymentTasks.get(taskId);
    if (!task || task.status !== 'pending') {
      return false;
    }

    task.status = 'approved';
    task.approver = approver;
    task.approvedAt = Date.now();
    
    // Remove from approvals queue and add to execution queue
    const approvalIndex = this.approvalsQueue.indexOf(taskId);
    if (approvalIndex !== -1) {
      this.approvalsQueue.splice(approvalIndex, 1);
    }
    
    this.taskQueue.push(taskId);
    this.logger.log(`Task ${taskId} approved by ${approver}`);
    
    return true;
  }

  /**
   * Reject a task
   */
  rejectTask(taskId: string, reason: string): boolean {
    const task = this.deploymentTasks.get(taskId);
    if (!task || task.status !== 'pending') {
      return false;
    }

    task.status = 'rejected';
    task.error = `Rejected: ${reason}`;
    task.finishedAt = Date.now();
    task.duration = task.finishedAt - task.startedAt;
    
    // Remove from approvals queue
    const approvalIndex = this.approvalsQueue.indexOf(taskId);
    if (approvalIndex !== -1) {
      this.approvalsQueue.splice(approvalIndex, 1);
    }
    
    this.logger.warn(`Task ${taskId} rejected: ${reason}`);
    
    return true;
  }

  /**
   * Process the task queue
   */
  private async processTaskQueue(): Promise<void> {
    if (this.activeTasks.size >= this.config.maxConcurrentTasks) {
      return;
    }

    while (this.taskQueue.length > 0 && this.activeTasks.size < this.config.maxConcurrentTasks) {
      const taskId = this.taskQueue.shift();
      if (!taskId) continue;

      const task = this.deploymentTasks.get(taskId);
      if (!task) continue;

      // Check dependencies
      if (!(await this.checkDependencies(task))) {
        // Put back at the end of the queue to retry later
        this.taskQueue.push(taskId);
        continue;
      }

      // Check resource quotas
      if (!(await this.checkResourceAvailability(task))) {
        // Put back at the end of the queue to retry later
        this.taskQueue.push(taskId);
        continue;
      }

      // Mark as active and running
      this.activeTasks.set(taskId, Date.now());
      task.status = 'running';
      task.startedAt = Date.now();

      // Execute the task asynchronously
      this.executeTask(task)
        .catch(error => {
          this.logger.error(`Task execution failed for ${task.id}: ${error.message}`);
          task.status = 'failed';
          task.error = error.message;
          task.finishedAt = Date.now();
          task.duration = task.finishedAt - task.startedAt;
        })
        .finally(() => {
          // Mark as inactive
          this.activeTasks.delete(taskId);
          this.updateResourceUsage(task, true); // Release resources
          this.logger.log(`Task completed: ${task.name} (Status: ${task.status})`);
        });
    }
  }

  /**
   * Process the approvals queue
   */
  private async processApprovalsQueue(): Promise<void> {
    // In a real implementation, this might automatically approve certain types of tasks
    // based on policies, or send notifications to approvers
  }

  /**
   * Execute a deployment task
   */
  private async executeTask(task: DeploymentTask): Promise<void> {
    try {
      // Update resource usage
      this.updateResourceUsage(task, false); // Claim resources
      
      task.logs.push(`Starting task execution: ${task.type} for ${task.targetEnvironment}`);
      
      // Execute based on task type
      switch (task.type) {
        case 'provision':
          await this.executeProvisionTask(task);
          break;
        case 'deploy':
          await this.executeDeployTask(task);
          break;
        case 'update':
          await this.executeUpdateTask(task);
          break;
        case 'destroy':
          await this.executeDestroyTask(task);
          break;
        case 'backup':
          await this.executeBackupTask(task);
          break;
        case 'restore':
          await this.executeRestoreTask(task);
          break;
        default:
          await this.executeGenericTask(task);
      }
      
      // Run compliance checks after successful task execution
      if (task.status === 'running' && this.config.complianceChecking) {
        await this.runComplianceChecks(task);
      }
      
      // Update task status based on execution
      if (task.status === 'running') {
        task.status = 'success';
        task.logs.push(`Task completed successfully`);
      }
    } catch (error) {
      task.status = 'failed';
      task.error = error.message;
      task.logs.push(`Task failed: ${error.message}`);
      
      // Attempt rollback if enabled
      if (this.config.autoRollback && task.rollbackPossible) {
        task.logs.push(`Attempting automatic rollback...`);
        try {
          await this.executeRollbackTask(task);
          task.logs.push(`Rollback completed`);
        } catch (rollbackError) {
          task.logs.push(`Rollback failed: ${rollbackError.message}`);
        }
      }
    } finally {
      task.finishedAt = Date.now();
      task.duration = task.finishedAt - task.startedAt;
      
      // Send notification if enabled
      if (this.config.notificationEnabled) {
        await this.sendTaskNotification(task);
      }
    }
  }

  /**
   * Execute provision task
   */
  private async executeProvisionTask(task: DeploymentTask): Promise<void> {
    task.logs.push('Executing infrastructure provisioning...');
    
    // Simulate provisioning process
    await this.simulateWork(5000 + Math.random() * 10000);
    
    // Update resource usage estimates
    task.resourcesUsed = {
      cpu: 100 + Math.random() * 200,
      memory: 256 + Math.random() * 512,
      storage: 1 + Math.random() * 5,
    };
    
    task.logs.push('Infrastructure provisioning completed');
  }

  /**
   * Execute deployment task
   */
  private async executeDeployTask(task: DeploymentTask): Promise<void> {
    task.logs.push('Executing application deployment...');
    
    // Simulate deployment process
    await this.simulateWork(8000 + Math.random() * 12000);
    
    // Update resource usage estimates
    task.resourcesUsed = {
      cpu: 50 + Math.random() * 100,
      memory: 128 + Math.random() * 256,
      storage: 0.5 + Math.random(),
    };
    
    task.logs.push('Application deployment completed');
  }

  /**
   * Execute update task
   */
  private async executeUpdateTask(task: DeploymentTask): Promise<void> {
    task.logs.push('Executing infrastructure update...');
    
    // Simulate update process
    await this.simulateWork(6000 + Math.random() * 8000);
    
    task.logs.push('Infrastructure update completed');
  }

  /**
   * Execute destroy task
   */
  private async executeDestroyTask(task: DeploymentTask): Promise<void> {
    task.logs.push('Executing resource destruction...');
    
    // Simulate destruction process
    await this.simulateWork(4000 + Math.random() * 6000);
    
    task.logs.push('Resource destruction completed');
  }

  /**
   * Execute backup task
   */
  private async executeBackupTask(task: DeploymentTask): Promise<void> {
    if (!this.config.backupEnabled) {
      task.logs.push('Backup is disabled, skipping task');
      return;
    }
    
    task.logs.push('Executing backup operation...');
    
    // Simulate backup process
    await this.simulateWork(10000 + Math.random() * 15000);
    
    task.logs.push('Backup operation completed');
  }

  /**
   * Execute restore task
   */
  private async executeRestoreTask(task: DeploymentTask): Promise<void> {
    task.logs.push('Executing restore operation...');
    
    // Simulate restore process
    await this.simulateWork(12000 + Math.random() * 18000);
    
    task.logs.push('Restore operation completed');
  }

  /**
   * Execute generic task
   */
  private async executeGenericTask(task: DeploymentTask): Promise<void> {
    task.logs.push('Executing generic task...');
    
    // Simulate generic work
    await this.simulateWork(3000 + Math.random() * 5000);
    
    task.logs.push('Generic task completed');
  }

  /**
   * Execute rollback task
   */
  private async executeRollbackTask(task: DeploymentTask): Promise<void> {
    task.logs.push('Executing rollback operation...');
    
    // Simulate rollback process
    await this.simulateWork(10000 + Math.random() * 10000);
    
    task.logs.push('Rollback operation completed');
  }

  /**
   * Check task dependencies
   */
  private async checkDependencies(task: DeploymentTask): Promise<boolean> {
    for (const depId of task.dependencies) {
      const depTask = this.deploymentTasks.get(depId);
      if (!depTask) {
        task.logs.push(`Dependency task ${depId} does not exist`);
        return false;
      }
      
      if (depTask.status !== 'success') {
        task.logs.push(`Dependency task ${depId} has not succeeded (${depTask.status})`);
        return false;
      }
    }
    
    return true;
  }

  /**
   * Check resource availability
   */
  private async checkResourceAvailability(task: DeploymentTask): Promise<boolean> {
    // This is a simplified check - in reality, you'd check actual resource availability
    // For this example, we'll just ensure we don't exceed quotas
    const projectedCpu = this.resourceUsage.cpu + (task.resourcesUsed?.cpu || 100);
    const projectedMemory = this.resourceUsage.memory + (task.resourcesUsed?.memory || 256);
    const projectedStorage = this.resourceUsage.storage + (task.resourcesUsed?.storage || 1);
    
    if (projectedCpu > this.config.resourceQuota.cpu ||
        projectedMemory > this.config.resourceQuota.memory ||
        projectedStorage > this.config.resourceQuota.storage) {
      task.logs.push('Insufficient resources available for task execution');
      return false;
    }
    
    return true;
  }

  /**
   * Update resource usage
   */
  private updateResourceUsage(task: DeploymentTask, releasing: boolean): void {
    const resources = task.resourcesUsed || { cpu: 0, memory: 0, storage: 0 };
    
    if (releasing) {
      this.resourceUsage.cpu = Math.max(0, this.resourceUsage.cpu - resources.cpu);
      this.resourceUsage.memory = Math.max(0, this.resourceUsage.memory - resources.memory);
      this.resourceUsage.storage = Math.max(0, this.resourceUsage.storage - resources.storage);
    } else {
      this.resourceUsage.cpu += resources.cpu;
      this.resourceUsage.memory += resources.memory;
      this.resourceUsage.storage += resources.storage;
    }
  }

  /**
   * Run compliance checks
   */
  private async runComplianceChecks(task: DeploymentTask): Promise<void> {
    task.logs.push('Running compliance checks...');
    
    // Simulate compliance checking
    await this.simulateWork(2000 + Math.random() * 3000);
    
    // Generate some compliance checks
    const complianceChecks: Omit<ComplianceCheck, 'id' | 'checkedAt'>[] = [
      {
        name: `Security scan for ${task.targetEnvironment}`,
        type: 'security',
        status: Math.random() > 0.1 ? 'pass' : 'fail', // 90% pass rate
        severity: 'high',
        description: 'Security scan of deployed resources',
        remediation: 'Address any identified vulnerabilities',
        resource: task.targetEnvironment,
        tags: ['security', 'post-deployment']
      },
      {
        name: `Cost optimization for ${task.targetEnvironment}`,
        type: 'cost',
        status: 'pass',
        severity: 'medium',
        description: 'Cost optimization review',
        remediation: 'Optimize resource usage to reduce costs',
        resource: task.targetEnvironment,
        tags: ['cost', 'optimization']
      }
    ];
    
    for (const check of complianceChecks) {
      const complianceCheck: ComplianceCheck = {
        ...check,
        id: this.generateId(),
        checkedAt: Date.now(),
      };
      
      this.complianceChecks.push(complianceCheck);
      
      if (check.status === 'fail') {
        task.logs.push(`COMPLIANCE FAILURE: ${check.name} - ${check.description}`);
      } else if (check.status === 'warn') {
        task.logs.push(`COMPLIANCE WARNING: ${check.name} - ${check.description}`);
      }
    }
    
    task.logs.push('Compliance checks completed');
  }

  /**
   * Send task notification
   */
  private async sendTaskNotification(task: DeploymentTask): Promise<void> {
    const message = `Task ${task.name} completed with status: ${task.status}`;
    this.logger.log(`[DEVOPS-NOTIFICATION] ${message}`);
    
    // In a real implementation, this would send notifications via email, Slack, etc.
  }

  /**
   * Create or update infrastructure as code configuration
   */
  async createOrUpdateInfrastructure(config: Omit<InfrastructureAsCode, 'id' | 'state' | 'lastApplied' | 'lastModified'>): Promise<InfrastructureAsCode> {
    const id = config.id || this.generateId();
    const infraConfig: InfrastructureAsCode = {
      ...config,
      id,
      state: 'pending',
      lastApplied: 0,
      lastModified: Date.now(),
      version: config.version || '1.0.0',
      dependencies: config.dependencies || [],
    };

    this.infrastructureConfigs.set(id, infraConfig);
    this.logger.log(`Infrastructure configuration ${id} created/updated: ${config.name}`);

    return infraConfig;
  }

  /**
   * Apply infrastructure as code configuration
   */
  async applyInfrastructure(id: string): Promise<InfrastructureAsCode> {
    const config = this.infrastructureConfigs.get(id);
    if (!config) {
      throw new Error(`Infrastructure configuration ${id} does not exist`);
    }

    config.state = 'applied';
    config.lastApplied = Date.now();
    config.lastModified = Date.now();

    this.logger.log(`Applied infrastructure configuration: ${config.name} (${id})`);

    // If drift detection is enabled, schedule a drift check
    if (this.config.driftDetection) {
      setTimeout(() => {
        this.checkForDrift(id);
      }, 30000); // Check for drift after 30 seconds
    }

    return config;
  }

  /**
   * Check for infrastructure drift
   */
  private async checkForDrift(id: string): Promise<void> {
    const config = this.infrastructureConfigs.get(id);
    if (!config) {
      return;
    }

    // Simulate drift detection
    const drifted = Math.random() > 0.8; // 20% chance of drift
    
    if (drifted) {
      config.state = 'drifted';
      this.logger.warn(`DRIFT DETECTED in infrastructure ${config.name} (${id})`);
      
      // Create a task to remediate drift
      await this.submitTask({
        name: `Remediate drift in ${config.name}`,
        type: 'update',
        status: 'pending',
        dependencies: [],
        targetEnvironment: config.provider,
        rollbackPossible: true,
      });
    } else {
      config.state = 'compliant';
    }
  }

  /**
   * Get a deployment task by ID
   */
  getTask(taskId: string): DeploymentTask | undefined {
    return this.deploymentTasks.get(taskId);
  }

  /**
   * Get infrastructure configuration by ID
   */
  getInfrastructure(id: string): InfrastructureAsCode | undefined {
    return this.infrastructureConfigs.get(id);
  }

  /**
   * Get compliance checks
   */
  getComplianceChecks(type?: string, status?: string): ComplianceCheck[] {
    let checks = this.complianceChecks;
    
    if (type) {
      checks = checks.filter(c => c.type === type);
    }
    
    if (status) {
      checks = checks.filter(c => c.status === status);
    }
    
    return checks.sort((a, b) => b.checkedAt - a.checkedAt);
  }

  /**
   * Cancel a running task
   */
  cancelTask(taskId: string): boolean {
    const task = this.deploymentTasks.get(taskId);
    if (!task || !['pending', 'running'].includes(task.status)) {
      return false;
    }

    task.status = 'cancelled';
    task.finishedAt = Date.now();
    task.duration = task.finishedAt - task.startedAt;
    task.logs.push('Task was cancelled');
    
    // Remove from queues if it's still there
    const queueIndex = this.taskQueue.indexOf(taskId);
    if (queueIndex !== -1) {
      this.taskQueue.splice(queueIndex, 1);
    }
    
    const approvalIndex = this.approvalsQueue.indexOf(taskId);
    if (approvalIndex !== -1) {
      this.approvalsQueue.splice(approvalIndex, 1);
    }
    
    // Mark as inactive if it was running
    if (this.activeTasks.has(taskId)) {
      this.activeTasks.delete(taskId);
      this.updateResourceUsage(task, true); // Release resources
    }

    this.logger.log(`Cancelled task: ${taskId}`);
    return true;
  }

  /**
   * Retry a failed task
   */
  async retryTask(taskId: string): Promise<DeploymentTask | null> {
    const originalTask = this.deploymentTasks.get(taskId);
    if (!originalTask || originalTask.status !== 'failed') {
      return null;
    }

    if (originalTask.retryCount >= originalTask.maxRetries) {
      return null; // Already retried maximum times
    }

    // Reset task state for retry
    originalTask.status = this.config.approvalRequired ? 'pending' : 'approved';
    originalTask.startedAt = Date.now();
    originalTask.finishedAt = undefined;
    originalTask.duration = undefined;
    originalTask.error = undefined;
    originalTask.retryCount += 1;
    originalTask.logs.push(`Retry #${originalTask.retryCount} initiated`);

    if (this.config.approvalRequired) {
      this.approvalsQueue.push(taskId);
    } else {
      this.taskQueue.push(taskId);
    }

    this.logger.log(`Retrying task ${taskId} (attempt ${originalTask.retryCount + 1}/${originalTask.maxRetries + 1})`);
    return originalTask;
  }

  /**
   * Get DevOps automation statistics
   */
  getDevOpsStats(): {
    totalTasks: number;
    runningTasks: number;
    queuedTasks: number;
    pendingApproval: number;
    successfulTasks: number;
    failedTasks: number;
    resourceUsage: typeof this.resourceUsage;
    resourceQuota: typeof this.config.resourceQuota;
    totalInfrastructureConfigs: number;
    complianceChecksCount: number;
    config: DevOpsAutomationConfig;
  } {
    let successfulTasks = 0;
    let failedTasks = 0;

    for (const task of this.deploymentTasks.values()) {
      if (task.status === 'success') {
        successfulTasks++;
      } else if (task.status === 'failed') {
        failedTasks++;
      }
    }

    return {
      totalTasks: this.deploymentTasks.size,
      runningTasks: this.activeTasks.size,
      queuedTasks: this.taskQueue.length,
      pendingApproval: this.approvalsQueue.length,
      successfulTasks,
      failedTasks,
      resourceUsage: { ...this.resourceUsage },
      resourceQuota: { ...this.config.resourceQuota },
      totalInfrastructureConfigs: this.infrastructureConfigs.size,
      complianceChecksCount: this.complianceChecks.length,
      config: this.config,
    };
  }

  /**
   * Get DevOps dashboard report
   */
  getDashboardReport(daysBack: number = 7): {
    summary: {
      totalTasks: number;
      successRate: number;
      avgDuration: number;
      resourceUtilization: number;
      compliancePassRate: number;
    };
    byType: Array<{ type: string; count: number; successRate: number }>;
    byEnvironment: Array<{ environment: string; count: number; successRate: number }>;
    complianceSummary: {
      total: number;
      passed: number;
      failed: number;
      warn: number;
    };
    resourceUsageTrend: Array<{ date: string; cpu: number; memory: number; storage: number }>;
  } {
    const since = Date.now() - (daysBack * 24 * 60 * 60 * 1000);
    const tasks = Array.from(this.deploymentTasks.values())
      .filter(t => t.startedAt >= since && t.finishedAt !== undefined);

    // Summary calculations
    const successfulTasks = tasks.filter(t => t.status === 'success');
    const successRate = tasks.length > 0 ? (successfulTasks.length / tasks.length) * 100 : 0;
    const avgDuration = tasks.length > 0 
      ? tasks.reduce((sum, t) => sum + (t.duration || 0), 0) / tasks.length 
      : 0;
    
    const resourceUtilization = (this.resourceUsage.cpu / this.config.resourceQuota.cpu) * 100;

    // Compliance summary
    const complianceChecks = this.complianceChecks.filter(c => c.checkedAt >= since);
    const complianceSummary = {
      total: complianceChecks.length,
      passed: complianceChecks.filter(c => c.status === 'pass').length,
      failed: complianceChecks.filter(c => c.status === 'fail').length,
      warn: complianceChecks.filter(c => c.status === 'warn').length,
    };
    const compliancePassRate = complianceSummary.total > 0 
      ? (complianceSummary.passed / complianceSummary.total) * 100 
      : 0;

    // By type
    const typeStats = new Map<string, { count: number; successes: number }>();
    for (const task of tasks) {
      if (!typeStats.has(task.type)) {
        typeStats.set(task.type, { count: 0, successes: 0 });
      }
      
      const stat = typeStats.get(task.type)!;
      stat.count++;
      if (task.status === 'success') {
        stat.successes++;
      }
    }
    
    const byType = Array.from(typeStats.entries())
      .map(([type, stats]) => ({
        type,
        count: stats.count,
        successRate: stats.count > 0 ? (stats.successes / stats.count) * 100 : 0
      }));

    // By environment
    const envStats = new Map<string, { count: number; successes: number }>();
    for (const task of tasks) {
      if (!envStats.has(task.targetEnvironment)) {
        envStats.set(task.targetEnvironment, { count: 0, successes: 0 });
      }
      
      const stat = envStats.get(task.targetEnvironment)!;
      stat.count++;
      if (task.status === 'success') {
        stat.successes++;
      }
    }
    
    const byEnvironment = Array.from(envStats.entries())
      .map(([env, stats]) => ({
        environment: env,
        count: stats.count,
        successRate: stats.count > 0 ? (stats.successes / stats.count) * 100 : 0
      }));

    // Resource usage trend (simulated)
    const resourceUsageTrend = [];
    for (let i = daysBack; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      resourceUsageTrend.push({
        date,
        cpu: Math.random() * this.config.resourceQuota.cpu * 0.8, // 0-80% of quota
        memory: Math.random() * this.config.resourceQuota.memory * 0.8,
        storage: Math.random() * this.config.resourceQuota.storage * 0.8,
      });
    }

    return {
      summary: {
        totalTasks: tasks.length,
        successRate,
        avgDuration,
        resourceUtilization,
        compliancePassRate,
      },
      byType,
      byEnvironment,
      complianceSummary,
      resourceUsageTrend,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<DevOpsAutomationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.log('Updated DevOps automation configuration');
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  /**
   * Simulate work with delay
   */
  private async simulateWork(duration: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, duration));
  }

  /**
   * Close the DevOps automation service
   */
  close(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.logger.log('DevOps automation optimization service closed');
  }
}