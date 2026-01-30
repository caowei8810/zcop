import { create } from 'zustand';
import { Entity, Property, Relation, Action, Rule, WorkflowDefinition, AgentSession, ChatMessage, Conversation } from '../types';

interface AppState {
  // Ontology state
  entities: Entity[];
  selectedEntity: Entity | null;
  properties: Property[];
  relations: Relation[];
  actions: Action[];
  rules: Rule[];
  
  // Workflow state
  workflows: WorkflowDefinition[];
  activeWorkflow: WorkflowDefinition | null;
  sessions: AgentSession[];
  activeSession: AgentSession | null;
  
  // Chat state
  conversations: Conversation[];
  activeConversation: Conversation | null;
  messages: ChatMessage[];
  
  // UI state
  loading: boolean;
  error: string | null;
  
  // Ontology actions
  setEntities: (entities: Entity[]) => void;
  setSelectedEntity: (entity: Entity | null) => void;
  addEntity: (entity: Entity) => void;
  updateEntity: (entity: Entity) => void;
  deleteEntity: (id: string) => void;
  
  // Property actions
  setProperties: (properties: Property[]) => void;
  addProperty: (property: Property) => void;
  updateProperty: (property: Property) => void;
  deleteProperty: (id: string) => void;
  
  // Relation actions
  setRelations: (relations: Relation[]) => void;
  addRelation: (relation: Relation) => void;
  updateRelation: (relation: Relation) => void;
  deleteRelation: (id: string) => void;
  
  // Action actions
  setActions: (actions: Action[]) => void;
  addAction: (action: Action) => void;
  updateAction: (action: Action) => void;
  deleteAction: (id: string) => void;
  
  // Rule actions
  setRules: (rules: Rule[]) => void;
  addRule: (rule: Rule) => void;
  updateRule: (rule: Rule) => void;
  deleteRule: (id: string) => void;
  
  // Workflow actions
  setWorkflows: (workflows: WorkflowDefinition[]) => void;
  setActiveWorkflow: (workflow: WorkflowDefinition | null) => void;
  addWorkflow: (workflow: WorkflowDefinition) => void;
  updateWorkflow: (workflow: WorkflowDefinition) => void;
  deleteWorkflow: (id: string) => void;
  
  // Session actions
  setSessions: (sessions: AgentSession[]) => void;
  setActiveSession: (session: AgentSession | null) => void;
  addSession: (session: AgentSession) => void;
  updateSession: (session: AgentSession) => void;
  
  // Chat actions
  setConversations: (conversations: Conversation[]) => void;
  setActiveConversation: (conversation: Conversation | null) => void;
  addConversation: (conversation: Conversation) => void;
  updateConversation: (conversation: Conversation) => void;
  deleteConversation: (id: string) => void;
  addMessage: (message: ChatMessage) => void;
  
  // UI actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useStore = create<AppState>((set, get) => ({
  // Initial state
  entities: [],
  selectedEntity: null,
  properties: [],
  relations: [],
  actions: [],
  rules: [],
  workflows: [],
  activeWorkflow: null,
  sessions: [],
  activeSession: null,
  conversations: [],
  activeConversation: null,
  messages: [],
  loading: false,
  error: null,
  
  // Ontology actions
  setEntities: (entities) => set({ entities }),
  setSelectedEntity: (entity) => set({ selectedEntity: entity }),
  addEntity: (entity) => set((state) => ({ entities: [...state.entities, entity] })),
  updateEntity: (updatedEntity) => set((state) => ({
    entities: state.entities.map(e => e.id === updatedEntity.id ? updatedEntity : e),
    selectedEntity: state.selectedEntity?.id === updatedEntity.id ? updatedEntity : state.selectedEntity
  })),
  deleteEntity: (id) => set((state) => ({
    entities: state.entities.filter(e => e.id !== id),
    selectedEntity: state.selectedEntity?.id === id ? null : state.selectedEntity
  })),
  
  // Property actions
  setProperties: (properties) => set({ properties }),
  addProperty: (property) => set((state) => ({ properties: [...state.properties, property] })),
  updateProperty: (updatedProperty) => set((state) => ({
    properties: state.properties.map(p => p.id === updatedProperty.id ? updatedProperty : p)
  })),
  deleteProperty: (id) => set((state) => ({
    properties: state.properties.filter(p => p.id !== id)
  })),
  
  // Relation actions
  setRelations: (relations) => set({ relations }),
  addRelation: (relation) => set((state) => ({ relations: [...state.relations, relation] })),
  updateRelation: (updatedRelation) => set((state) => ({
    relations: state.relations.map(r => r.id === updatedRelation.id ? updatedRelation : r)
  })),
  deleteRelation: (id) => set((state) => ({
    relations: state.relations.filter(r => r.id !== id)
  })),
  
  // Action actions
  setActions: (actions) => set({ actions }),
  addAction: (action) => set((state) => ({ actions: [...state.actions, action] })),
  updateAction: (updatedAction) => set((state) => ({
    actions: state.actions.map(a => a.id === updatedAction.id ? updatedAction : a)
  })),
  deleteAction: (id) => set((state) => ({
    actions: state.actions.filter(a => a.id !== id)
  })),
  
  // Rule actions
  setRules: (rules) => set({ rules }),
  addRule: (rule) => set((state) => ({ rules: [...state.rules, rule] })),
  updateRule: (updatedRule) => set((state) => ({
    rules: state.rules.map(r => r.id === updatedRule.id ? updatedRule : r)
  })),
  deleteRule: (id) => set((state) => ({
    rules: state.rules.filter(r => r.id !== id)
  })),
  
  // Workflow actions
  setWorkflows: (workflows) => set({ workflows }),
  setActiveWorkflow: (workflow) => set({ activeWorkflow: workflow }),
  addWorkflow: (workflow) => set((state) => ({ workflows: [...state.workflows, workflow] })),
  updateWorkflow: (updatedWorkflow) => set((state) => ({
    workflows: state.workflows.map(w => w.id === updatedWorkflow.id ? updatedWorkflow : w),
    activeWorkflow: state.activeWorkflow?.id === updatedWorkflow.id ? updatedWorkflow : state.activeWorkflow
  })),
  deleteWorkflow: (id) => set((state) => ({
    workflows: state.workflows.filter(w => w.id !== id),
    activeWorkflow: state.activeWorkflow?.id === id ? null : state.activeWorkflow
  })),
  
  // Session actions
  setSessions: (sessions) => set({ sessions }),
  setActiveSession: (session) => set({ activeSession: session }),
  addSession: (session) => set((state) => ({ sessions: [...state.sessions, session] })),
  updateSession: (updatedSession) => set((state) => ({
    sessions: state.sessions.map(s => s.id === updatedSession.id ? updatedSession : s),
    activeSession: state.activeSession?.id === updatedSession.id ? updatedSession : state.activeSession
  })),
  
  // Chat actions
  setConversations: (conversations) => set({ conversations }),
  setActiveConversation: (conversation) => set({ activeConversation: conversation }),
  addConversation: (conversation) => set((state) => ({ 
    conversations: [...state.conversations, conversation],
    activeConversation: conversation
  })),
  updateConversation: (updatedConversation) => set((state) => ({
    conversations: state.conversations.map(c => c.id === updatedConversation.id ? updatedConversation : c),
    activeConversation: state.activeConversation?.id === updatedConversation.id ? updatedConversation : state.activeConversation
  })),
  deleteConversation: (id) => set((state) => ({
    conversations: state.conversations.filter(c => c.id !== id),
    activeConversation: state.activeConversation?.id === id ? null : state.activeConversation
  })),
  addMessage: (message) => set((state) => {
    if (state.activeConversation) {
      const updatedConversations = state.conversations.map(conv => 
        conv.id === state.activeConversation?.id 
          ? { ...conv, messages: [...conv.messages, message] } 
          : conv
      );
      
      return {
        conversations: updatedConversations,
        activeConversation: {
          ...state.activeConversation,
          messages: [...state.activeConversation.messages, message]
        }
      };
    }
    return state;
  }),
  
  // UI actions
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));