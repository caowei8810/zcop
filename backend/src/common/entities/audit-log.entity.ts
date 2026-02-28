import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { Field, ObjectType } from '@nestjs/graphql';

@Entity('audit_logs')
@ObjectType()
@Index(['userId', 'timestamp']) // Composite index for common query pattern
@Index(['action', 'timestamp']) // Composite index for action-based queries
export class AuditLog {
  @Field(() => String)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', nullable: true, length: 100 })
  @Index() // Individual index for fast lookups
  userId?: string;

  @Field(() => String)
  @Column({ type: 'varchar', length: 100 })
  @Index() // Index for action field
  action: string;

  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', nullable: true, length: 255 })
  resource?: string;

  @Field(() => String, { nullable: true })
  @Column({ type: 'text', nullable: true })
  details?: string;

  @Field(() => String)
  @Column({ type: 'varchar', length: 45 }) // IP address
  ipAddress: string;

  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', nullable: true, length: 255 })
  userAgent?: string;

  @Field(() => Date)
  @Column({ type: 'timestamp' })
  @Index() // Index for timestamp queries
  timestamp: Date;

  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', nullable: true, length: 50 })
  severity?: string; // INFO, WARN, ERROR

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}