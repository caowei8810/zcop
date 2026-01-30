import { Message } from '@/types';

// API base URL
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

// Generic API call function
const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  const mergedOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  };
  
  try {
    const response = await fetch(url, mergedOptions);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API call error:', error);
    throw error;
  }
};

// Ontology API functions
export const ontologyApi = {
  // Entity operations
  getEntities: () => apiCall('/graphql', {
    method: 'POST',
    body: JSON.stringify({
      query: `
        query GetEntities {
          entities {
            id
            name
            displayName
            description
            icon
            color
            isActive
            createdAt
            updatedAt
          }
        }
      `,
    }),
  }).then(data => data.data.entities),

  createEntity: (input: any) => apiCall('/graphql', {
    method: 'POST',
    body: JSON.stringify({
      query: `
        mutation CreateEntity($input: EntityDefinitionInput!) {
          createEntity(input: $input) {
            id
            name
            displayName
            description
            icon
            color
            isActive
            createdAt
            updatedAt
          }
        }
      `,
      variables: { input },
    }),
  }).then(data => data.data.createEntity),

  updateEntity: (id: string, input: any) => apiCall('/graphql', {
    method: 'POST',
    body: JSON.stringify({
      query: `
        mutation UpdateEntity($id: ID!, $input: EntityDefinitionInput!) {
          updateEntity(id: $id, input: $input) {
            id
            name
            displayName
            description
            icon
            color
            isActive
            createdAt
            updatedAt
          }
        }
      `,
      variables: { id, input },
    }),
  }).then(data => data.data.updateEntity),

  deleteEntity: (id: string) => apiCall('/graphql', {
    method: 'POST',
    body: JSON.stringify({
      query: `
        mutation DeleteEntity($id: ID!) {
          deleteEntity(id: $id)
        }
      `,
      variables: { id },
    }),
  }).then(data => data.data.deleteEntity),

  // Property operations
  createProperty: (input: any) => apiCall('/graphql', {
    method: 'POST',
    body: JSON.stringify({
      query: `
        mutation CreateProperty($input: PropertyDefinitionInput!) {
          createProperty(input: $input) {
            id
            name
            displayName
            description
            type
            required
            unique
            indexed
            defaultValue
            enumValues
            entityId
            isActive
            createdAt
            updatedAt
          }
        }
      `,
      variables: { input },
    }),
  }).then(data => data.data.createProperty),

  // Relation operations
  createRelation: (input: any) => apiCall('/graphql', {
    method: 'POST',
    body: JSON.stringify({
      query: `
        mutation CreateRelation($input: RelationDefinitionInput!) {
          createRelation(input: $input) {
            id
            name
            displayName
            description
            relationType
            fromCardinality
            toCardinality
            fromEntityId
            toEntityId
            isActive
            createdAt
            updatedAt
          }
        }
      `,
      variables: { input },
    }),
  }).then(data => data.data.createRelation),

  // Action operations
  createAction: (input: any) => apiCall('/graphql', {
    method: 'POST',
    body: JSON.stringify({
      query: `
        mutation CreateAction($input: ActionDefinitionInput!) {
          createAction(input: $input) {
            id
            name
            displayName
            description
            type
            entityId
            isActive
            isSystemAction
            createdAt
            updatedAt
          }
        }
      `,
      variables: { input },
    }),
  }).then(data => data.data.createAction),

  // Rule operations
  createRule: (input: any) => apiCall('/graphql', {
    method: 'POST',
    body: JSON.stringify({
      query: `
        mutation CreateRule($input: RuleDefinitionInput!) {
          createRule(input: $input) {
            id
            name
            displayName
            description
            type
            scope
            entityId
            isActive
            isSystemRule
            createdAt
            updatedAt
          }
        }
      `,
      variables: { input },
    }),
  }).then(data => data.data.createRule),
};

// Chat API functions
export const chatApi = {
  sendMessage: (message: string, sessionId: string) => apiCall('/graphql', {
    method: 'POST',
    body: JSON.stringify({
      query: `
        mutation SendMessage($message: String!, $sessionId: String!) {
          sendMessage(message: $message, sessionId: $sessionId) {
            id
            content
            sender
            timestamp
            status
            type
            data
          }
        }
      `,
      variables: { message, sessionId },
    }),
  }).then(data => data.data.sendMessage),

  createSession: (userId: string) => apiCall('/graphql', {
    method: 'POST',
    body: JSON.stringify({
      query: `
        mutation CreateSession($userId: String!) {
          createSession(userId: $userId) {
            id
            sessionId
            userId
            context
            history
            isActive
            createdAt
            updatedAt
          }
        }
      `,
      variables: { userId },
    }),
  }).then(data => data.data.createSession),
};

// Autonomous Planning API functions
export const planningApi = {
  startAutonomousPlanning: () => apiCall('/graphql', {
    method: 'POST',
    body: JSON.stringify({
      query: `
        mutation StartAutonomousPlanning {
          startAutonomousPlanning {
            id
            name
            displayName
            description
            entities
            actions
            isActive
            isAutoGenerated
            createdAt
            updatedAt
          }
        }
      `,
    }),
  }).then(data => data.data.startAutonomousPlanning),

  getGeneratedWorkflows: () => apiCall('/graphql', {
    method: 'POST',
    body: JSON.stringify({
      query: `
        query GetGeneratedWorkflows {
          workflows {
            id
            name
            displayName
            description
            entities
            actions
            isActive
            isAutoGenerated
            createdAt
            updatedAt
          }
        }
      `,
    }),
  }).then(data => data.data.workflows),
};

// Knowledge Graph API functions
export const knowledgeGraphApi = {
  getKnowledgeGraph: () => apiCall('/graphql', {
    method: 'POST',
    body: JSON.stringify({
      query: `
        query GetKnowledgeGraph {
          knowledgeGraph {
            entities {
              id
              name
              displayName
              description
            }
            graph {
              from
              relationship
              to
            }
          }
        }
      `,
    }),
  }).then(data => data.data.knowledgeGraph),
};