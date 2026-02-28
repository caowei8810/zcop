# ZCOP API Documentation

## Base URL
`http://localhost:3000` (development)
`https://api.zcop.systems` (production)

## Authentication
All protected endpoints require a valid JWT token in the Authorization header:
`Authorization: Bearer <token>`

## Endpoints

### GET /
**Description**: Returns a welcome message
**Authentication**: None required
**Response**:
```
"ZCOP System - Optimized for Commercial Use!"
```

### GET /health
**Description**: Performs system health checks
**Authentication**: None required
**Response**:
```
{
  "status": "healthy",
  "timestamp": "2026-02-11T08:00:00.000Z",
  "checks": {
    "database": true,
    "cache": true,
    "storage": true
  }
}
```

### GET /secure-data
**Description**: Returns protected data (requires authentication)
**Authentication**: JWT required
**Response**:
```
"This is protected data accessible only with valid JWT"
```

### POST /audit-log
**Description**: Creates an audit log entry (requires authentication)
**Authentication**: JWT required
**Request Body**:
```
{
  "userId": "string",
  "action": "string",
  "resource": "string",
  "success": true/false
}
```
**Response**: 201 Created

## Error Handling
All errors follow the format:
```
{
  "statusCode": 400,
  "message": "Error description",
  "error": "Error type"
}
```

## Rate Limiting
API endpoints are subject to rate limiting to prevent abuse.