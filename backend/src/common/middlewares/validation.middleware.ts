import { Injectable, mixin, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';

export function ValidationMiddleware(schema: ZodSchema) {
  return mixin(
    class implements NestMiddleware {
      use(req: Request, res: Response, next: NextFunction) {
        try {
          schema.parse({
            body: req.body,
            query: req.query,
            params: req.params,
          });
          next();
        } catch (error) {
          if (error instanceof z.ZodError) {
            return res.status(400).json({
              statusCode: 400,
              message: 'Validation failed',
              errors: error.errors.map(e => ({
                field: e.path.join('.'),
                message: e.message,
              })),
            });
          }
          next(error);
        }
      }
    }
  );
}

// Common validation schemas
export const PaginationSchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional().default(1),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default(10),
});

export const IdParamSchema = z.object({
  id: z.string().uuid(),
});

export const SearchSchema = z.object({
  query: z.string().min(1).max(100),
  filters: z.record(z.string()).optional(),
});