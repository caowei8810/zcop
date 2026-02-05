import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>('permissions', [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (!requiredPermissions) {
      return true;
    }
    
    const { user } = context.switchToHttp().getRequest<Request>();
    
    // Check if user has required permissions
    const hasPermission = requiredPermissions.some(permission => 
      user.permissions?.includes(permission) || 
      user.roles?.some(role => role.permissions?.includes(permission))
    );
    
    return hasPermission;
  }
}