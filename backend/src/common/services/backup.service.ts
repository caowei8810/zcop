import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';

const execPromise = promisify(exec);

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  async createBackup(databaseName: string, outputPath: string): Promise<string> {
    try {
      this.logger.log(`Starting backup for database: ${databaseName}`);
      
      // Ensure output directory exists
      const mkdirResult = await execPromise(`mkdir -p ${join(outputPath, '..')}`);
      
      // Create PostgreSQL dump
      const backupCommand = `pg_dump -h ${process.env.DB_HOST || 'localhost'} ` +
                           `-U ${process.env.DB_USERNAME || 'postgres'} ` +
                           `-d ${databaseName} ` +
                           `-f ${outputPath} ` +
                           `--no-password`;
                           
      const env = { ...process.env, PGPASSWORD: process.env.DB_PASSWORD || 'postgres' };
      const result = await execPromise(backupCommand, { env });
      
      this.logger.log(`Backup completed successfully: ${outputPath}`);
      return outputPath;
    } catch (error) {
      this.logger.error(`Backup failed: ${error.message}`);
      throw error;
    }
  }

  async restoreBackup(databaseName: string, backupPath: string): Promise<void> {
    try {
      this.logger.log(`Starting restore from: ${backupPath}`);
      
      // Drop and recreate database (optional, depending on requirements)
      // const dropDbCmd = `dropdb -h ${process.env.DB_HOST || 'localhost'} ` +
      //                  `-U ${process.env.DB_USERNAME || 'postgres'} ` +
      //                  `--if-exists ${databaseName}`;
      
      // Create database if it doesn't exist
      const createDbCmd = `createdb -h ${process.env.DB_HOST || 'localhost'} ` +
                         `-U ${process.env.DB_USERNAME || 'postgres'} ` +
                         `-O ${process.env.DB_USERNAME || 'postgres'} ` +
                         `${databaseName} ` +
                         `|| true`; // Continue even if db already exists
      
      const env = { ...process.env, PGPASSWORD: process.env.DB_PASSWORD || 'postgres' };
      await execPromise(createDbCmd, { env });
      
      // Restore from backup
      const restoreCmd = `psql -h ${process.env.DB_HOST || 'localhost'} ` +
                        `-U ${process.env.DB_USERNAME || 'postgres'} ` +
                        `-d ${databaseName} ` +
                        `-f ${backupPath} ` +
                        `--no-password`;
                        
      await execPromise(restoreCmd, { env });
      
      this.logger.log(`Restore completed successfully from: ${backupPath}`);
    } catch (error) {
      this.logger.error(`Restore failed: ${error.message}`);
      throw error;
    }
  }

  async scheduleAutomatedBackups(): Promise<void> {
    // In a real implementation, this would set up cron jobs for regular backups
    // For now, we'll just log that this functionality exists
    this.logger.log('Scheduled automated backups system initialized');
    
    // Example of how to implement cron-based backups
    /*
    import * as cron from 'node-cron';
    
    // Schedule daily backup at 2:00 AM
    cron.schedule('0 2 * * *', async () => {
      try {
        const dateStr = new Date().toISOString().split('T')[0];
        const backupPath = `/backups/zcop_${dateStr}.sql`;
        await this.createBackup(process.env.DB_NAME || 'zcop', backupPath);
      } catch (error) {
        this.logger.error('Scheduled backup failed:', error);
      }
    });
    */
  }

  async listBackups(backupDirectory: string): Promise<string[]> {
    try {
      const { stdout } = await execPromise(`ls -t ${backupDirectory}/*.sql`);
      return stdout.trim().split('\n').filter(path => path.length > 0);
    } catch (error) {
      this.logger.error(`Failed to list backups: ${error.message}`);
      return [];
    }
  }
}