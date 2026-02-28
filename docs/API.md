# ZCOP Platform API Documentation

## Overview
The ZCOP Platform provides a comprehensive API for zero-code enterprise application development through ontology-driven modeling.

## Base URL
`http://localhost:3000/api`

## Authentication
All API endpoints require a valid JWT token in the Authorization header:

```
Authorization: Bearer {access_token}
```

## API Endpoints

### Authentication

#### POST /auth/login
Authenticate user and retrieve JWT token.

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "access_token": "string",
  "user": {
    "id": "string",
    "username": "string",
    "email": "string",
    "firstName": "string",
    "lastName": "string",
    "roles": [
      {
        "id": "string",
        "name": "string",
        "displayName": "string"
      }
    ]
  }
}
```

#### POST /auth/register
Register a new user.

**Request Body:**
```json
{
  "username": "string",
  "email": "string",
  "password": "string",
  "firstName": "string",
  "lastName": "string"
}
```

**Response:**
```json
{
  "id": "string",
  "username": "string",
  "email": "string",
  "firstName": "string",
  "lastName": "string"
}
```

### Health Check

#### GET /health
Check the health status of the application.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2023-12-01T10:00:00.000Z",
  "details": {
    "database": "connected",
    "neo4j": "connected",
    "redis": "connected",
    "qdrant": "connected"
  }
}
```

### Metrics

#### GET /metrics/system-stats
Retrieve system performance statistics.

**Response:**
```json
{
  "cpuUsage": 15.2,
  "memoryUsage": 45.8,
  "activeConnections": 24,
  "requestRate": 12.5,
  "errorRate": 0.2,
  "uptime": 86400
}
```

#### GET /metrics/audit-logs
Retrieve audit logs with optional filtering.

**Query Parameters:**
- `userId`: Filter by user ID
- `action`: Filter by action type
- `startDate`: Filter by start date (ISO format)
- `endDate`: Filter by end date (ISO format)
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 50)

**Response:**
```json
{
  "data": [
    {
      "id": "string",
      "userId": "string",
      "action": "string",
      "resource": "string",
      "details": "string",
      "ipAddress": "string",
      "userAgent": "string",
      "timestamp": "2023-12-01T10:00:00.000Z",
      "severity": "INFO|WARN|ERROR"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100,
    "totalPages": 2
  }
}
```

### Data Governance

#### GET /governance/compliance-report
Generate data compliance report.

**Response:**
```json
{
  "reportId": "string",
  "generatedAt": "2023-12-01T10:00:00.000Z",
  "summary": {
    "totalRecords": 12500,
    "compliantRecords": 12350,
    "nonCompliantRecords": 150,
    "compliancePercentage": 98.8
  },
  "details": {
    "gdpr": {
      "status": "compliant",
      "issues": []
    },
    "ccpa": {
      "status": "compliant",
      "issues": []
    }
  }
}
```

#### GET /governance/data-classification
Get data classification statistics.

**Response:**
```json
{
  "public": 8500,
  "internal": 3200,
  "confidential": 750,
  "restricted": 50,
  "lastUpdated": "2023-12-01T10:00:00.000Z"
}
```

#### POST /governance/data-classification/classify
Classify a dataset.

**Request Body:**
```json
{
  "datasetId": "string",
  "classificationRules": [
    {
      "field": "string",
      "rule": "pattern|regex|value",
      "classification": "public|internal|confidential|restricted"
    }
  ]
}
```

**Response:**
```json
{
  "taskId": "string",
  "status": "processing|completed|failed",
  "estimatedCompletion": "2023-12-01T10:15:00.000Z"
}
```

### Monitoring

#### GET /monitoring/errors
Retrieve recent errors with optional filtering.

**Query Parameters:**
- `level`: Filter by level (error|warning|info)
- `context`: Filter by context
- `startDate`: Filter by start date (ISO format)
- `endDate`: Filter by end date (ISO format)
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 50)

**Response:**
```json
{
  "data": [
    {
      "id": "string",
      "timestamp": "2023-12-01T10:00:00.000Z",
      "level": "error",
      "message": "string",
      "stack": "string",
      "context": "string",
      "userId": "string",
      "metadata": {},
      "handled": false,
      "statusCode": 500,
      "ip": "string"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 25,
    "totalPages": 1
  }
}
```

#### GET /monitoring/error-summary
Get error summary statistics.

**Response:**
```json
{
  "totalErrors": 15,
  "totalWarnings": 8,
  "errorsByContext": {
    "auth": 3,
    "database": 7,
    "api": 5
  },
  "errorsByDay": {
    "2023-12-01": 12,
    "2023-11-30": 8
  },
  "errorsByStatusCode": {
    "500": 10,
    "400": 5
  },
  "errorRate": 0.3
}
```

### GraphQL API

#### Endpoint
`http://localhost:3000/graphql`

The platform uses GraphQL for flexible data querying. Available schemas include:

- Ontology schema for entity definitions
- Knowledge graph schema for relationship queries
- Business rules schema for workflow definitions
- User management schema

Example query:
```graphql
query GetCustomers($first: Int) {
  customers(first: $first) {
    id
    name
    email
    status
    orders {
      id
      orderNo
      amount
      status
    }
  }
}
```

## Error Handling

The API uses standard HTTP status codes:

- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `500`: Internal Server Error

Error responses follow this structure:
```json
{
  "statusCode": 400,
  "message": "Error message",
  "error": "Bad Request"
}
```

## Rate Limiting

All API endpoints are subject to rate limiting:
- Authenticated users: 1000 requests per hour
- Unauthenticated requests: 100 requests per hour

When rate limited, the API returns:
- Status Code: `429`
- Headers: `Retry-After` indicating seconds to wait

## Best Practices

1. Always include error handling in your API calls
2. Use pagination for large datasets
3. Cache responses when appropriate
4. Implement retry logic for transient failures
5. Monitor API usage and performance