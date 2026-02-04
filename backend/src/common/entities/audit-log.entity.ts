import { Entity, Column, PrimaryGeneratedColumn, Index, CreateDateColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  @Index()
  userId: string;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  action: string; // CREATE, UPDATE, DELETE, READ

  @Column({ type: 'varchar', length: 100 })
  @Index()
  entity: string; // Entity name (e.g., 'User', 'Order', 'Customer')

  @Column({ name: 'entity_id', type: 'varchar', length: 100 })
  @Index()
  entityId: string; // ID of the entity that was acted upon

  @Column({ type: 'text', nullable: true })
  oldValue: string; // Previous state of the entity (JSON string)

  @Column({ type: 'text', nullable: true })
  newValue: string; // New state of the entity (JSON string)

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>; // Additional information about the action

  @CreateDateColumn({ name: 'timestamp', type: 'timestamp' })
  @Index()
  timestamp: Date;
}