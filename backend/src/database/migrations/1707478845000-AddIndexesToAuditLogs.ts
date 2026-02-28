import { MigrationInterface, QueryRunner, TableIndex } from "typeorm";

export class AddIndexesToAuditLogs1707478845000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add indexes to audit_logs table
        await queryRunner.createIndex("audit_logs", new TableIndex({
            name: "IDX_AUDIT_LOGS_USER_ID",
            columnNames: ["userId"]
        }));

        await queryRunner.createIndex("audit_logs", new TableIndex({
            name: "IDX_AUDIT_LOGS_ACTION",
            columnNames: ["action"]
        }));

        await queryRunner.createIndex("audit_logs", new TableIndex({
            name: "IDX_AUDIT_LOGS_TIMESTAMP",
            columnNames: ["timestamp"]
        }));

        await queryRunner.createIndex("audit_logs", new TableIndex({
            name: "IDX_AUDIT_LOGS_SEVERITY",
            columnNames: ["severity"]
        }));

        // Add composite indexes
        await queryRunner.createIndex("audit_logs", new TableIndex({
            name: "IDX_AUDIT_LOGS_USER_ACTION",
            columnNames: ["userId", "action"]
        }));

        await queryRunner.createIndex("audit_logs", new TableIndex({
            name: "IDX_AUDIT_LOGS_ACTION_TIMESTAMP",
            columnNames: ["action", "timestamp"]
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes from audit_logs table
        await queryRunner.dropIndex("audit_logs", "IDX_AUDIT_LOGS_USER_ID");
        await queryRunner.dropIndex("audit_logs", "IDX_AUDIT_LOGS_ACTION");
        await queryRunner.dropIndex("audit_logs", "IDX_AUDIT_LOGS_TIMESTAMP");
        await queryRunner.dropIndex("audit_logs", "IDX_AUDIT_LOGS_SEVERITY");
        await queryRunner.dropIndex("audit_logs", "IDX_AUDIT_LOGS_USER_ACTION");
        await queryRunner.dropIndex("audit_logs", "IDX_AUDIT_LOGS_ACTION_TIMESTAMP");
    }
}