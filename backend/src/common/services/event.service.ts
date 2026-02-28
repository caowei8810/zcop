import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface EventPayload {
  userId?: string;
  entityId?: string;
  entityType?: string;
  action: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

@Injectable()
export class EventService {
  constructor(private eventEmitter: EventEmitter2) {}

  emit(event: string, payload: EventPayload): void {
    this.eventEmitter.emit(event, payload);
  }

  emitAsync(event: string, payload: EventPayload): Promise<any[]> {
    return this.eventEmitter.emitAsync(event, payload);
  }

  subscribe(event: string, handler: (payload: EventPayload) => void): void {
    this.eventEmitter.on(event, handler);
  }

  subscribeOnce(event: string, handler: (payload: EventPayload) => void): void {
    this.eventEmitter.once(event, handler);
  }

  unsubscribe(event: string, handler?: (payload: EventPayload) => void): void {
    if (handler) {
      this.eventEmitter.off(event, handler);
    } else {
      this.eventEmitter.removeAllListeners(event);
    }
  }

  // Specific event methods
  entityCreated(entityType: string, entityId: string, userId: string, metadata?: Record<string, any>): void {
    this.emit(`${entityType}.created`, {
      userId,
      entityId,
      entityType,
      action: 'created',
      timestamp: new Date(),
      metadata,
    });
  }

  entityUpdated(entityType: string, entityId: string, userId: string, metadata?: Record<string, any>): void {
    this.emit(`${entityType}.updated`, {
      userId,
      entityId,
      entityType,
      action: 'updated',
      timestamp: new Date(),
      metadata,
    });
  }

  entityDeleted(entityType: string, entityId: string, userId: string, metadata?: Record<string, any>): void {
    this.emit(`${entityType}.deleted`, {
      userId,
      entityId,
      entityType,
      action: 'deleted',
      timestamp: new Date(),
      metadata,
    });
  }

  userLoggedIn(userId: string, metadata?: Record<string, any>): void {
    this.emit('user.logged.in', {
      userId,
      entityType: 'user',
      action: 'logged_in',
      timestamp: new Date(),
      metadata,
    });
  }

  userLoggedOut(userId: string, metadata?: Record<string, any>): void {
    this.emit('user.logged.out', {
      userId,
      entityType: 'user',
      action: 'logged_out',
      timestamp: new Date(),
      metadata,
    });
  }

  aiProcessingStarted(taskId: string, userId: string, metadata?: Record<string, any>): void {
    this.emit('ai.processing.started', {
      userId,
      entityId: taskId,
      entityType: 'ai_task',
      action: 'started',
      timestamp: new Date(),
      metadata,
    });
  }

  aiProcessingCompleted(taskId: string, userId: string, metadata?: Record<string, any>): void {
    this.emit('ai.processing.completed', {
      userId,
      entityId: taskId,
      entityType: 'ai_task',
      action: 'completed',
      timestamp: new Date(),
      metadata,
    });
  }
}