// Neo4j Index Configuration
// This would typically be executed via Neo4j's Cypher queries
// For integration into the application, these would be called during initialization

export class Neo4jIndexConfig {
  static getIndexes() {
    return [
      // Entity indexes
      "CREATE INDEX entity_id_index FOR (e:Entity) ON (e.id)",
      "CREATE INDEX entity_type_index FOR (e:Entity) ON (e.type)",
      
      // Property indexes
      "CREATE INDEX property_entity_id_index FOR (p:Property) ON (p.entityId)",
      "CREATE INDEX property_name_index FOR (p:Property) ON (p.name)",
      
      // Relationship indexes
      "CREATE INDEX relationship_source_index FOR (r:Relationship) ON (r.sourceId)",
      "CREATE INDEX relationship_target_index FOR (r:Relationship) ON (r.targetId)",
      "CREATE INDEX relationship_type_index FOR (r:Relationship) ON (r.type)",
      
      // User indexes
      "CREATE INDEX user_username_index FOR (u:User) ON (u.username)",
      "CREATE INDEX user_email_index FOR (u:User) ON (u.email)",
      
      // Timestamp indexes for temporal queries
      "CREATE INDEX entity_created_at_index FOR (e:Entity) ON (e.createdAt)",
      "CREATE INDEX entity_updated_at_index FOR (e:Entity) ON (e.updatedAt)",
    ];
  }

  static getCompositeIndexes() {
    return [
      // Common query patterns
      "CREATE TEXT INDEX entity_type_name_index FOR (e:Entity) ON (e.type, e.name)",  // Assuming Neo4j 5.x text indexes
      "CREATE INDEX relationship_source_target_type_index FOR (r:Relationship) ON (r.sourceId, r.targetId, r.type)",
    ];
  }

  static getFullTextIndexes() {
    return [
      // Full-text search indexes
      "CREATE FULLTEXT INDEX entity_name_description_index FOR (e:Entity) ON EACH [e.name, e.description]",
    ];
  }
}