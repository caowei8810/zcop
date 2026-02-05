import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { DataSource } from 'typeorm';

@Injectable()
export class TransactionInterceptor implements NestInterceptor {
  constructor(private dataSource: DataSource) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    // Only use transaction if method is marked with @Transactional
    const isTransactional = Reflect.getMetadata('transactional', context.getHandler());
    if (!isTransactional) {
      return next.handle();
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    return next.handle().pipe(
      catchError(async (error) => {
        await queryRunner.rollbackTransaction();
        throw error;
      }),
      finalize(async () => {
        await queryRunner.release();
      }),
      map(result => {
        // Attach query runner to result so it can be used in the handler
        if (result && typeof result === 'object') {
          result.queryRunner = queryRunner;
        }
        return result;
      })
    );
  }
}

// Decorator to mark methods as transactional
export const Transactional = () => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata('transactional', true, descriptor.value);
  };
};