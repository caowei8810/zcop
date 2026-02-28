import { Injectable } from '@nestjs/common';
import { Neo4jService } from 'nest-neo4j';

@Injectable()
export class EventDrivenArchitectureService {
  constructor(private neo4jService: Neo4jService) {}

  async registerEvent(eventDefinition: any): Promise<any> {
    // Validate event definition
    const validation = this.validateEventDefinition(eventDefinition);
    if (!validation.isValid) {
      throw new Error(`Invalid event definition: ${validation.errors.join(', ')}`);
    }

    const cypher = `
      CREATE (event:EventDefinition {
        id: $id,
        name: $name,
        description: $description,
        version: $version,
        schema: $schema,
        producers: $producers,
        consumers: $consumers,
        createdAt: $createdAt,
        updatedAt: $updatedAt,
        status: $status
      })
      RETURN event
    `;

    const id = `evt-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const now = new Date().toISOString();

    const result = await this.neo4jService.write(cypher, {
      id,
      name: eventDefinition.name,
      description: eventDefinition.description,
      version: eventDefinition.version || '1.0.0',
      schema: JSON.stringify(eventDefinition.schema || {}),
      producers: JSON.stringify(eventDefinition.producers || []),
      consumers: JSON.stringify(eventDefinition.consumers || []),
      createdAt: now,
      updatedAt: now,
      status: 'active'
    });

    return result.records[0].get('event');
  }

  async publishEvent(eventName: string, eventData: any, metadata: any = {}): Promise<any> {
    // Get event definition
    const eventDef = await this.getEventDefinitionByName(eventName);
    if (!eventDef) {
      throw new Error(`Event definition for ${eventName} not found`);
    }

    // Validate event data against schema
    const validation = this.validateEventData(eventData, JSON.parse(eventDef.schema));
    if (!validation.isValid) {
      throw new Error(`Event data validation failed: ${validation.errors.join(', ')}`);
    }

    // Create event instance
    const cypher = `
      CREATE (e:EventInstance {
        id: $id,
        eventName: $eventName,
        eventId: $eventId,
        data: $data,
        metadata: $metadata,
        timestamp: $timestamp,
        publisher: $publisher,
        version: $version
      })
      RETURN e
    `;

    const id = `evinst-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const eventId = `eid-${Date.now()}`; // Globally unique event ID
    const now = new Date().toISOString();

    const result = await this.neo4jService.write(cypher, {
      id,
      eventName,
      eventId,
      data: JSON.stringify(eventData),
      metadata: JSON.stringify(metadata),
      timestamp: now,
      publisher: metadata.publisher || 'system',
      version: eventDef.version
    });

    // Trigger event processing
    await this.processEventSubscribers(eventName, eventData, metadata);

    return result.records[0].get('e');
  }

  async subscribeToEvent(eventName: string, subscriberInfo: any): Promise<any> {
    // Validate subscriber info
    const validation = this.validateSubscriberInfo(subscriberInfo);
    if (!validation.isValid) {
      throw new Error(`Invalid subscriber info: ${validation.errors.join(', ')}`);
    }

    // Link subscriber to event
    const cypher = `
      MATCH (event:EventDefinition {name: $eventName})
      MERGE (sub:Subscriber {
        id: $subscriberId
      })
      ON CREATE SET 
        sub.name = $subscriberName,
        sub.endpoint = $endpoint,
        sub.type = $type,
        sub.createdAt = $createdAt,
        sub.status = $status
      ON MATCH SET
        sub.updatedAt = $updatedAt
      MERGE (event)<-[:SUBSCRIBES_TO]-(sub)
      RETURN sub
    `;

    const now = new Date().toISOString();

    const result = await this.neo4jService.write(cypher, {
      eventName,
      subscriberId: subscriberInfo.id || `sub-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      subscriberName: subscriberInfo.name,
      endpoint: subscriberInfo.endpoint,
      type: subscriberInfo.type || 'http',
      createdAt: now,
      updatedAt: now,
      status: subscriberInfo.status || 'active'
    });

    return result.records[0].get('sub');
  }

  async getEventDefinition(eventId: string): Promise<any> {
    const cypher = `
      MATCH (event:EventDefinition {id: $eventId})
      OPTIONAL MATCH (event)<-[:SUBSCRIBES_TO]-(sub:Subscriber)
      RETURN event, collect(sub) AS subscribers
    `;

    const result = await this.neo4jService.read(cypher, { eventId });
    if (result.records.length === 0) return null;

    const record = result.records[0];
    const event = record.get('event');
    const subscribers = record.get('subscribers');

    return {
      ...event,
      subscribers: subscribers.map((s: any) => s.properties)
    };
  }

  async getEventDefinitionByName(name: string): Promise<any> {
    const cypher = `
      MATCH (event:EventDefinition {name: $name})
      RETURN event
    `;

    const result = await this.neo4jService.read(cypher, { name });
    return result.records.length > 0 ? result.records[0].get('event') : null;
  }

  async getEventInstances(eventName?: string, filter: any = {}): Promise<any[]> {
    let whereClause = eventName ? 'WHERE e.eventName = $eventName ' : '';
    const params: any = eventName ? { eventName } : {};

    if (filter.since) {
      whereClause += whereClause ? 'AND ' : 'WHERE ';
      whereClause += 'e.timestamp >= $since ';
      params.since = filter.since;
    }

    if (filter.until) {
      whereClause += whereClause ? 'AND ' : 'WHERE ';
      whereClause += 'e.timestamp <= $until ';
      params.until = filter.until;
    }

    if (filter.publisher) {
      whereClause += whereClause ? 'AND ' : 'WHERE ';
      whereClause += 'e.publisher = $publisher ';
      params.publisher = filter.publisher;
    }

    const cypher = `
      MATCH (e:EventInstance)
      ${whereClause}
      RETURN e
      ORDER BY e.timestamp DESC
    `;

    const result = await this.neo4jService.read(cypher, params);
    return result.records.map(record => record.get('e'));
  }

  async processEventSubscribers(eventName: string, eventData: any, metadata: any): Promise<void> {
    // Get all subscribers for this event
    const cypher = `
      MATCH (event:EventDefinition {name: $eventName})<-[:SUBSCRIBES_TO]-(sub:Subscriber)
      WHERE sub.status = 'active'
      RETURN sub
    `;

    const result = await this.neo4jService.read(cypher, { eventName });
    const subscribers = result.records.map(record => record.get('sub'));

    // Process each subscriber asynchronously
    for (const subscriber of subscribers) {
      try {
        await this.deliverEventToSubscriber(subscriber, eventName, eventData, metadata);
      } catch (error) {
        console.error(`Failed to deliver event to subscriber ${subscriber.id}:`, error);
        // Log delivery failure
        await this.logDeliveryFailure(subscriber.id, eventName, error.message);
      }
    }
  }

  async getEventStream(streamName: string, options: any = {}): Promise<any[]> {
    // Get events from a specific stream
    // In our model, streams can be represented by tags or categories
    const cypher = `
      MATCH (e:EventInstance)
      WHERE e.metadata CONTAINS $streamName
      RETURN e
      ORDER BY e.timestamp DESC
      LIMIT $limit
    `;

    const result = await this.neo4jService.read(cypher, {
      streamName: `"${streamName}"`,
      limit: options.limit || 100
    });

    return result.records.map(record => record.get('e'));
  }

  async createEventPipeline(pipelineDefinition: any): Promise<any> {
    // Create an event pipeline that processes events through multiple stages
    const validation = this.validatePipelineDefinition(pipelineDefinition);
    if (!validation.isValid) {
      throw new Error(`Invalid pipeline definition: ${validation.errors.join(', ')}`);
    }

    const cypher = `
      CREATE (pipeline:EventPipeline {
        id: $id,
        name: $name,
        description: $description,
        status: $status,
        stages: $stages,
        filters: $filters,
        createdAt: $createdAt,
        updatedAt: $updatedAt
      })
      RETURN pipeline
    `;

    const id = `pipe-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const now = new Date().toISOString();

    const result = await this.neo4jService.write(cypher, {
      id,
      name: pipelineDefinition.name,
      description: pipelineDefinition.description,
      status: 'inactive', // Pipelines are inactive until published
      stages: JSON.stringify(pipelineDefinition.stages || []),
      filters: JSON.stringify(pipelineDefinition.filters || []),
      createdAt: now,
      updatedAt: now
    });

    return result.records[0].get('pipeline');
  }

  async publishEventPipeline(pipelineId: string): Promise<any> {
    const cypher = `
      MATCH (pipeline:EventPipeline {id: $pipelineId})
      SET pipeline.status = 'active',
          pipeline.publishedAt = $publishedAt,
          pipeline.updatedAt = $updatedAt
      RETURN pipeline
    `;

    const result = await this.neo4jService.write(cypher, {
      pipelineId,
      publishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    return result.records[0].get('pipeline');
  }

  async monitorEventFlow(eventName: string, timeRange: any): Promise<any> {
    // Monitor event flow metrics
    const cypher = `
      MATCH (e:EventInstance {eventName: $eventName})
      WHERE e.timestamp >= $startTime AND e.timestamp <= $endTime
      RETURN 
        count(e) AS totalEvents,
        avg(size(e.data)) AS avgPayloadSize,
        min(e.timestamp) AS earliest,
        max(e.timestamp) AS latest
    `;

    const result = await this.neo4jService.read(cypher, {
      eventName,
      startTime: timeRange.start,
      endTime: timeRange.end
    });

    if (result.records.length === 0) {
      return {
        eventName,
        totalEvents: 0,
        avgPayloadSize: 0,
        earliest: null,
        latest: null
      };
    }

    const record = result.records[0];
    return {
      eventName,
      totalEvents: record.get('totalEvents'),
      avgPayloadSize: record.get('avgPayloadSize'),
      earliest: record.get('earliest'),
      latest: record.get('latest')
    };
  }

  async replayEvent(eventId: string): Promise<any> {
    // Replay a specific event
    const cypher = `
      MATCH (e:EventInstance {id: $eventId})
      RETURN e
    `;

    const result = await this.neo4jService.read(cypher, { eventId });
    if (result.records.length === 0) {
      throw new Error(`Event instance ${eventId} not found`);
    }

    const event = result.records[0].get('e');
    const eventData = JSON.parse(event.data);
    const metadata = JSON.parse(event.metadata);

    // Add replay flag to metadata
    metadata.isReplay = true;
    metadata.originalTimestamp = event.timestamp;

    // Publish the event again
    return await this.publishEvent(event.eventName, eventData, metadata);
  }

  private async deliverEventToSubscriber(subscriber: any, eventName: string, eventData: any, metadata: any): Promise<void> {
    // In a real implementation, this would deliver the event to the subscriber's endpoint
    // For now, we'll just log the delivery attempt
    
    // Different delivery mechanisms based on subscriber type
    switch (subscriber.type) {
      case 'http':
        await this.deliverHttpEvent(subscriber, eventName, eventData, metadata);
        break;
      case 'websocket':
        await this.deliverWebSocketEvent(subscriber, eventName, eventData, metadata);
        break;
      case 'queue':
        await this.deliverQueueEvent(subscriber, eventName, eventData, metadata);
        break;
      default:
        console.warn(`Unknown subscriber type: ${subscriber.type}`);
    }

    // Log successful delivery
    await this.logDeliverySuccess(subscriber.id, eventName);
  }

  private async deliverHttpEvent(subscriber: any, eventName: string, eventData: any, metadata: any): Promise<void> {
    // Simulate HTTP delivery
    // In a real implementation, this would make an HTTP request to the subscriber's endpoint
    console.log(`Delivering event ${eventName} to HTTP subscriber at ${subscriber.endpoint}`, {
      data: eventData,
      metadata
    });
  }

  private async deliverWebSocketEvent(subscriber: any, eventName: string, eventData: any, metadata: any): Promise<void> {
    // Simulate WebSocket delivery
    // In a real implementation, this would push the event through a WebSocket connection
    console.log(`Delivering event ${eventName} to WebSocket subscriber`, {
      data: eventData,
      metadata
    });
  }

  private async deliverQueueEvent(subscriber: any, eventName: string, eventData: any, metadata: any): Promise<void> {
    // Simulate queue delivery
    // In a real implementation, this would push the event to a message queue
    console.log(`Delivering event ${eventName} to queue subscriber`, {
      data: eventData,
      metadata
    });
  }

  private async logDeliverySuccess(subscriberId: string, eventName: string): Promise<void> {
    const cypher = `
      MATCH (sub:Subscriber {id: $subscriberId})
      CREATE (log:DeliveryLog {
        id: $logId,
        subscriberId: $subscriberId,
        eventName: $eventName,
        status: $status,
        timestamp: $timestamp
      })
      CREATE (sub)-[:HAS_LOG]->(log)
    `;

    await this.neo4jService.write(cypher, {
      logId: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      subscriberId,
      eventName,
      status: 'success',
      timestamp: new Date().toISOString()
    });
  }

  private async logDeliveryFailure(subscriberId: string, eventName: string, error: string): Promise<void> {
    const cypher = `
      MATCH (sub:Subscriber {id: $subscriberId})
      CREATE (log:DeliveryLog {
        id: $logId,
        subscriberId: $subscriberId,
        eventName: $eventName,
        status: $status,
        error: $error,
        timestamp: $timestamp
      })
      CREATE (sub)-[:HAS_LOG]->(log)
    `;

    await this.neo4jService.write(cypher, {
      logId: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      subscriberId,
      eventName,
      status: 'failure',
      error,
      timestamp: new Date().toISOString()
    });
  }

  private validateEventDefinition(definition: any): { isValid: boolean; errors: string[] } {
    const errors = [];

    if (!definition.name) {
      errors.push('Event name is required');
    }

    if (definition.name && !this.isValidEventName(definition.name)) {
      errors.push('Event name must be alphanumeric with underscores and periods only');
    }

    if (!definition.schema) {
      errors.push('Event schema is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private validateEventData(data: any, schema: any): { isValid: boolean; errors: string[] } {
    // Simple schema validation
    const errors = [];
    
    // For now, just check if required fields exist
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in data)) {
          errors.push(`Required field '${field}' is missing`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private validateSubscriberInfo(info: any): { isValid: boolean; errors: string[] } {
    const errors = [];

    if (!info.name) {
      errors.push('Subscriber name is required');
    }

    if (!info.endpoint) {
      errors.push('Subscriber endpoint is required');
    }

    if (!info.type) {
      errors.push('Subscriber type is required');
    } else if (!['http', 'websocket', 'queue'].includes(info.type)) {
      errors.push('Subscriber type must be http, websocket, or queue');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private validatePipelineDefinition(definition: any): { isValid: boolean; errors: string[] } {
    const errors = [];

    if (!definition.name) {
      errors.push('Pipeline name is required');
    }

    if (!definition.stages || !Array.isArray(definition.stages) || definition.stages.length === 0) {
      errors.push('At least one stage is required');
    }

    if (definition.stages) {
      for (let i = 0; i < definition.stages.length; i++) {
        const stage = definition.stages[i];
        if (!stage.name) {
          errors.push(`Stage ${i} must have a name`);
        }
        if (!stage.type) {
          errors.push(`Stage ${i} must have a type`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private isValidEventName(name: string): boolean {
    // Event names should be alphanumeric with underscores and periods
    const regex = /^[a-zA-Z0-9_.]+$/;
    return regex.test(name);
  }
}