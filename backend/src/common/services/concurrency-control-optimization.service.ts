import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SemaphoreOptions {
  maxConcurrency: number;
  timeout?: number; // Timeout in ms
  retryDelay?: number; // Delay between retries in ms
}

export interface TaskQueueOptions {
  maxQueueSize: number;
  maxConcurrency: number;
  timeout?: number;
}

export interface ConcurrencyStats {
  activeTasks: number;
  queuedTasks: number;
  maxConcurrency: number;
  maxQueueSize: number;
  completedTasks: number;
  failedTasks: number;
}

export class Semaphore {
  private permits: number;
  private queue: Array<(value: void) => void> = [];
  private readonly maxPermits: number;
  private readonly timeout: number;

  constructor(options: SemaphoreOptions) {
    this.permits = options.maxConcurrency;
    this.maxPermits = options.maxConcurrency;
    this.timeout = options.timeout || 30000; // Default 30s
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const index = this.queue.indexOf(resolve);
        if (index > -1) {
          this.queue.splice(index, 1);
          reject(new Error('Semaphore acquire timeout'));
        }
      }, this.timeout);

      this.queue.push(() => {
        clearTimeout(timeoutId);
        this.permits--;
        resolve();
      });
    });
  }

  release(): void {
    if (this.permits < this.maxPermits) {
      this.permits++;

      if (this.queue.length > 0) {
        const next = this.queue.shift();
        if (next) {
          setImmediate(next);
        }
      }
    }
  }

  availablePermits(): number {
    return this.permits;
  }
}

@Injectable()
export class ConcurrencyControlOptimizationService {
  private readonly logger = new Logger(ConcurrencyControlOptimizationService.name);
  private semaphores: Map<string, Semaphore> = new Map();
  private taskQueues: Map<string, {
    queue: Array<() => Promise<any>>;
    semaphore: Semaphore;
    stats: {
      activeTasks: number;
      completedTasks: number;
      failedTasks: number;
    };
  }> = new Map();

  constructor(private configService: ConfigService) {}

  /**
   * Create a semaphore with specified concurrency limits
   */
  createSemaphore(name: string, options: SemaphoreOptions): Semaphore {
    const semaphore = new Semaphore(options);
    this.semaphores.set(name, semaphore);
    this.logger.log(`Created semaphore '${name}' with max concurrency: ${options.maxConcurrency}`);
    return semaphore;
  }

  /**
   * Get an existing semaphore
   */
  getSemaphore(name: string): Semaphore | null {
    return this.semaphores.get(name) || null;
  }

  /**
   * Execute a task with concurrency control
   */
  async executeWithConcurrency<T>(
    semaphoreName: string, 
    task: () => Promise<T>
  ): Promise<T> {
    const semaphore = this.getSemaphore(semaphoreName);
    if (!semaphore) {
      throw new Error(`Semaphore '${semaphoreName}' does not exist`);
    }

    await semaphore.acquire();
    try {
      return await task();
    } finally {
      semaphore.release();
    }
  }

  /**
   * Create a task queue with concurrency control
   */
  createTaskQueue(name: string, options: TaskQueueOptions): void {
    if (this.taskQueues.has(name)) {
      throw new Error(`Task queue '${name}' already exists`);
    }

    const semaphore = new Semaphore({
      maxConcurrency: options.maxConcurrency,
      timeout: options.timeout,
    });

    this.taskQueues.set(name, {
      queue: [],
      semaphore,
      stats: {
        activeTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
      }
    });

    // Start processing tasks
    this.processQueue(name);

    this.logger.log(`Created task queue '${name}' with max concurrency: ${options.maxConcurrency}, max queue size: ${options.maxQueueSize}`);
  }

  /**
   * Add a task to the queue
   */
  async addTask<T>(queueName: string, task: () => Promise<T>): Promise<T> {
    const queueInfo = this.taskQueues.get(queueName);
    if (!queueInfo) {
      throw new Error(`Task queue '${queueName}' does not exist`);
    }

    if (queueInfo.queue.length >= queueInfo.stats.activeTasks + (queueInfo.semaphore['maxPermits'] - queueInfo.semaphore.availablePermits())) {
      // Check if queue is at max capacity
      if (queueInfo.queue.length >= this.configService.get<number>('TASK_QUEUE_MAX_SIZE') || 
          (this.taskQueues.get(queueName) && queueInfo.queue.length >= this.taskQueues.get(queueName).queue.length + 1)) {
        throw new Error(`Task queue '${queueName}' is at maximum capacity`);
      }
    }

    return new Promise<T>((resolve, reject) => {
      queueInfo.queue.push(async () => {
        try {
          const result = await task();
          queueInfo.stats.completedTasks++;
          resolve(result);
        } catch (error) {
          queueInfo.stats.failedTasks++;
          reject(error);
        } finally {
          queueInfo.stats.activeTasks--;
        }
      });

      // Increment active tasks count
      queueInfo.stats.activeTasks++;
    });
  }

  /**
   * Process tasks in the queue
   */
  private async processQueue(queueName: string): Promise<void> {
    const queueInfo = this.taskQueues.get(queueName);
    if (!queueInfo) return;

    // Continue processing as long as there are tasks and available permits
    while (queueInfo.queue.length > 0) {
      try {
        // Acquire a permit from the semaphore
        await queueInfo.semaphore.acquire();

        // Get the next task
        const task = queueInfo.queue.shift();
        if (!task) {
          queueInfo.semaphore.release();
          break;
        }

        // Execute the task
        setImmediate(async () => {
          try {
            await task();
          } catch (error) {
            this.logger.error(`Task in queue '${queueName}' failed: ${error.message}`);
          } finally {
            // Release the permit after task completion
            queueInfo.semaphore.release();
          }
        });
      } catch (error) {
        this.logger.error(`Failed to acquire semaphore permit for queue '${queueName}': ${error.message}`);
        break;
      }
    }

    // Restart processing after a delay
    setTimeout(() => this.processQueue(queueName), 100);
  }

  /**
   * Get concurrency statistics
   */
  getStats(): Record<string, ConcurrencyStats> {
    const stats: Record<string, ConcurrencyStats> = {};

    // Semaphore stats
    for (const [name, semaphore] of this.semaphores.entries()) {
      // Need to access private properties carefully
      stats[`semaphore_${name}`] = {
        activeTasks: semaphore['maxPermits'] - semaphore.availablePermits(),
        queuedTasks: semaphore['queue']?.length || 0,
        maxConcurrency: semaphore['maxPermits'],
        maxQueueSize: -1, // Semaphores don't have a queue size limit
        completedTasks: 0, // Semaphores don't track completions
        failedTasks: 0, // Semaphores don't track failures
      };
    }

    // Task queue stats
    for (const [name, queueInfo] of this.taskQueues.entries()) {
      stats[`queue_${name}`] = {
        activeTasks: queueInfo.stats.activeTasks,
        queuedTasks: queueInfo.queue.length,
        maxConcurrency: queueInfo.semaphore['maxPermits'],
        maxQueueSize: -1, // Would need to track this separately
        completedTasks: queueInfo.stats.completedTasks,
        failedTasks: queueInfo.stats.failedTasks,
      };
    }

    return stats;
  }

  /**
   * Throttle function execution to max N calls per time window
   */
  throttle<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    maxCalls: number,
    timeWindowMs: number
  ): T {
    const queue: Array<{
      args: any[];
      resolve: (value: any) => void;
      reject: (reason: any) => void;
    }> = [];
    let callCount = 0;
    let resetTime = Date.now() + timeWindowMs;

    
    const processQueue = () => {
      if (Date.now() > resetTime) {
        // Reset the window
        callCount = 0;
        resetTime = Date.now() + timeWindowMs;
      }
      
      // Process as many queued calls as allowed
      while (queue.length > 0 && callCount < maxCalls) {
        const { args, resolve, reject } = queue.shift()!;
        callCount++;
        
        fn(...args)
          .then(resolve)
          .catch(reject);
      }
      
      // Schedule next check
      if (queue.length > 0) {
        setTimeout(processQueue, Math.max(1, resetTime - Date.now()));
      }
    };

    const throttledFunction = async (...args: any[]) => {
      return new Promise<any>((resolve, reject) => {
        queue.push({ args, resolve, reject });
        processQueue();
      });
    };

    return throttledFunction as T;
  }

  /**
   * Debounce function execution
   */
  debounce<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    delayMs: number
  ): T {
    let timeoutId: NodeJS.Timeout | null = null;

    return (async (...args: any[]) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      return new Promise<any>((resolve, reject) => {
        timeoutId = setTimeout(() => {
          timeoutId = null;
          fn(...args)
            .then(resolve)
            .catch(reject);
        }, delayMs);
      });
    }) as T;
  }

  /**
   * Execute multiple promises with controlled concurrency
   */
  async promisePool<T>(
    tasks: Array<() => Promise<T>>,
    concurrency: number
  ): Promise<T[]> {
    const results: T[] = [];
    const semaphore = new Semaphore({ maxConcurrency: concurrency });

    const executing: Promise<void>[] = [];

    for (const task of tasks) {
      const executor = (async () => {
        await semaphore.acquire();
        try {
          const result = await task();
          results.push(result);
        } finally {
          semaphore.release();
        }
      })();

      executing.push(executor);

      if (executing.length >= concurrency) {
        await Promise.race(executing);
      }
    }

    await Promise.all(executing);
    return results;
  }
}