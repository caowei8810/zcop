import { Message } from '@/types';

// API base URL
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

// Global authentication state
let authToken: string | null = localStorage.getItem('authToken');
let currentUser: any = JSON.parse(localStorage.getItem('currentUser') || 'null');

// Update auth header when token changes
const updateAuthHeader = () => {
  if (authToken) {
    localStorage.setItem('authToken', authToken);
  } else {
    localStorage.removeItem('authToken');
  }
  
  if (currentUser) {
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
  } else {
    localStorage.removeItem('currentUser');
  }
};

// Generic API call function
const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
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
    
    if (response.status === 401) {
      // Token might be expired, clear auth state
      logout();
      window.location.href = '/login';
      return null;
    }
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API call error:', error);
    throw error;
  }
};

// Authentication API functions
export const authApi = {
  login: async (username: string, password: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });
      
      if (!response.ok) {
        throw new Error('Login failed');
      }
      
      const data = await response.json();
      
      // Store token and user info
      authToken = data.access_token;
      currentUser = data.user;
      updateAuthHeader();
      
      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },

  register: async (userData: { username: string; email: string; password: string; firstName?: string; lastName?: string }) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });
      
      if (!response.ok) {
        throw new Error('Registration failed');
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  },

  logout: () => {
    logout();
  },

  getCurrentUser: () => {
    return currentUser;
  },

  isAuthenticated: () => {
    return !!authToken;
  },
};

// Logout function
export const logout = () => {
  authToken = null;
  currentUser = null;
  updateAuthHeader();
};

// Initialize auth from localStorage on module load
if (typeof window !== 'undefined') {
  const storedToken = localStorage.getItem('authToken');
  const storedUser = localStorage.getItem('currentUser');
  
  if (storedToken) {
    authToken = storedToken;
  }
  
  if (storedUser) {
    currentUser = JSON.parse(storedUser);
  }
}

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