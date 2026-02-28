import { Injectable, HttpService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { catchError, map } from 'rxjs/operators';
import { Observable, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';

export interface CasdoorUser {
  id: string;
  name: string;
  displayName: string;
  avatar: string;
  email: string;
  phone: string;
  organization: string;
  roles: any[];
  permissions: any[];
  createdTime: string;
  updatedTime: string;
}

export interface CasdoorToken {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  token_type: string;
}

@Injectable()
export class CasdoorService {
  private endpoint: string;
  private clientId: string;
  private clientSecret: string;
  private jwtPublicKey: string;
  private organizationName: string;
  private applicationName: string;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    this.endpoint = this.configService.get<string>('CASDOOR_ENDPOINT') || '';
    this.clientId = this.configService.get<string>('CASDOOR_CLIENT_ID') || '';
    this.clientSecret = this.configService.get<string>('CASDOOR_CLIENT_SECRET') || '';
    this.jwtPublicKey = this.configService.get<string>('CASDOOR_JWT_PUBLIC_KEY') || '';
    this.organizationName = this.configService.get<string>('CASDOOR_ORGANIZATION_NAME') || '';
    this.applicationName = this.configService.get<string>('CASDOOR_APPLICATION_NAME') || '';
  }

  /**
   * Get authorization URL for redirecting user to Casdoor login page
   */
  getAuthorizationUrl(redirectUri: string, state?: string): string {
    const baseUrl = `${this.endpoint}/login/oauth/authorize`;
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: 'openid profile email',
      state: state || 'state',
    });

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async getOAuthToken(code: string, redirectUri: string): Promise<CasdoorToken> {
    const tokenUrl = `${this.endpoint}/api/login/oauth/access_token`;
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      redirect_uri: redirectUri,
    });

    try {
      const response = await this.httpService
        .post(tokenUrl, params, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        })
        .toPromise();

      return response.data;
    } catch (error) {
      throw new Error(`Failed to get OAuth token: ${error.message}`);
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<CasdoorToken> {
    const tokenUrl = `${this.endpoint}/api/login/oauth/refresh_token`;
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
    });

    try {
      const response = await this.httpService
        .post(tokenUrl, params, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        })
        .toPromise();

      return response.data;
    } catch (error) {
      throw new Error(`Failed to refresh token: ${error.message}`);
    }
  }

  /**
   * Get user information using access token
   */
  async getUserInfo(accessToken: string): Promise<CasdoorUser> {
    const userInfoUrl = `${this.endpoint}/api/userinfo`;
    
    try {
      const response = await this.httpService
        .get(userInfoUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
        .toPromise();

      return response.data;
    } catch (error) {
      throw new Error(`Failed to get user info: ${error.message}`);
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string, accessToken: string): Promise<CasdoorUser> {
    const userUrl = `${this.endpoint}/api/get-user?id=${userId}`;
    
    try {
      const response = await this.httpService
        .get(userUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
        .toPromise();

      return response.data;
    } catch (error) {
      throw new Error(`Failed to get user by ID: ${error.message}`);
    }
  }

  /**
   * Get users list
   */
  async getUsers(accessToken: string, limit?: number, offset?: number): Promise<CasdoorUser[]> {
    let usersUrl = `${this.endpoint}/api/get-users?owner=${this.organizationName}`;
    if (limit) usersUrl += `&limit=${limit}`;
    if (offset) usersUrl += `&offset=${offset}`;

    try {
      const response = await this.httpService
        .get(usersUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
        .toPromise();

      return response.data;
    } catch (error) {
      throw new Error(`Failed to get users: ${error.message}`);
    }
  }

  /**
   * Verify JWT token
   */
  async verifyJwtToken(token: string): Promise<any> {
    // In a real implementation, we would verify the JWT token using the public key
    // For now, we'll make a request to Casdoor to verify the token
    try {
      const response = await this.httpService
        .post(`${this.endpoint}/api/user/token`, {
          token,
        })
        .toPromise();

      return response.data;
    } catch (error) {
      throw new Error(`Failed to verify JWT token: ${error.message}`);
    }
  }

  /**
   * Logout user
   */
  async logout(userId: string, accessToken: string): Promise<boolean> {
    const logoutUrl = `${this.endpoint}/api/logout`;
    
    try {
      await this.httpService
        .post(
          logoutUrl,
          {
            id: userId,
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        )
        .toPromise();

      return true;
    } catch (error) {
      throw new Error(`Failed to logout: ${error.message}`);
    }
  }

  /**
   * Create a new user
   */
  async createUser(userData: Partial<CasdoorUser>, accessToken: string): Promise<CasdoorUser> {
    const createUserUrl = `${this.endpoint}/api/add-user`;
    
    try {
      const response = await this.httpService
        .post(
          createUserUrl,
          {
            user: JSON.stringify({
              owner: this.organizationName,
              ...userData,
            }),
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        )
        .toPromise();

      return response.data;
    } catch (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  /**
   * Update user information
   */
  async updateUser(userId: string, userData: Partial<CasdoorUser>, accessToken: string): Promise<boolean> {
    const updateUserUrl = `${this.endpoint}/api/update-user`;
    
    try {
      const response = await this.httpService
        .post(
          updateUserUrl,
          {
            id: userId,
            user: JSON.stringify(userData),
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        )
        .toPromise();

      return response.data;
    } catch (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }
  }

  /**
   * Delete user
   */
  async deleteUser(userId: string, accessToken: string): Promise<boolean> {
    const deleteUserUrl = `${this.endpoint}/api/delete-user`;
    
    try {
      const response = await this.httpService
        .post(
          deleteUserUrl,
          {
            id: userId,
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        )
        .toPromise();

      return response.data;
    } catch (error) {
      throw new Error(`Failed to delete user: ${error.message}`);
    }
  }

  /**
   * Check if Casdoor integration is properly configured
   */
  isConfigured(): boolean {
    return !!(
      this.endpoint &&
      this.clientId &&
      this.clientSecret &&
      this.organizationName &&
      this.applicationName
    );
  }

  /**
   * Get application configuration
   */
  async getApplication(accessToken: string): Promise<any> {
    const appUrl = `${this.endpoint}/api/get-application?id=${this.applicationName}&owner=${this.organizationName}`;
    
    try {
      const response = await this.httpService
        .get(appUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
        .toPromise();

      return response.data;
    } catch (error) {
      throw new Error(`Failed to get application: ${error.message}`);
    }
  }
}