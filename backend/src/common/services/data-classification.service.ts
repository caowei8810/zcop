import { Injectable } from '@nestjs/common';
import { Neo4jService } from 'nest-neo4j';
import { QdrantService } from '../services/qdrant.service';

export interface DataClassification {
  id: string;
  name: string;
  description: string;
  sensitivityLevel: 'public' | 'internal' | 'confidential' | 'restricted';
  dataCategories: string[];
  applicableEntities: string[];
  classificationRules: ClassificationRule[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface ClassificationRule {
  id: string;
  field: string;
  condition: string; // regex, keyword, pattern, etc.
  value: string;
  action: 'classify' | 'mask' | 'block';
}

@Injectable()
export class DataClassificationService {
  constructor(
    private neo4jService: Neo4jService,
    private qdrantService: QdrantService,
  ) {}

  async getAllClassifications(entityType?: string): Promise<DataClassification[]> {
    let cypher = 'MATCH (dc:DataClassification) RETURN dc ORDER BY dc.createdAt DESC';
    const params: any = {};

    if (entityType) {
      cypher = `MATCH (dc:DataClassification) 
                WHERE $entityType IN dc.applicableEntities 
                RETURN dc 
                ORDER BY dc.createdAt DESC`;
      params.entityType = entityType;
    }

    const result = await this.neo4jService.read(cypher, params);
    return result.records.map(record => {
      const props = record.get('dc').properties;
      return this.mapToClassification(props);
    });
  }

  async getClassificationById(id: string): Promise<DataClassification | null> {
    const cypher = 'MATCH (dc:DataClassification {id: $id}) RETURN dc';
    const result = await this.neo4jService.read(cypher, { id });

    if (result.records.length === 0) {
      return null;
    }

    const props = result.records[0].get('dc').properties;
    return this.mapToClassification(props);
  }

  async createClassification(classificationData: Partial<DataClassification>): Promise<DataClassification> {
    const id = `dc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();
    
    const cypher = `
      CREATE (dc:DataClassification {
        id: $id,
        name: $name,
        description: $description,
        sensitivityLevel: $sensitivityLevel,
        dataCategories: $dataCategories,
        applicableEntities: $applicableEntities,
        classificationRules: $classificationRules,
        createdAt: $createdAt,
        updatedAt: $updatedAt,
        createdBy: $createdBy
      })
      RETURN dc
    `;

    const result = await this.neo4jService.write(cypher, {
      id,
      name: classificationData.name,
      description: classificationData.description,
      sensitivityLevel: classificationData.sensitivityLevel || 'internal',
      dataCategories: classificationData.dataCategories || [],
      applicableEntities: classificationData.applicableEntities || [],
      classificationRules: classificationData.classificationRules ? 
        JSON.stringify(classificationData.classificationRules) : '[]',
      createdAt: now,
      updatedAt: now,
      createdBy: classificationData.createdBy || 'system'
    });

    const props = result.records[0].get('dc').properties;
    const classification = this.mapToClassification(props);

    // Store classification in vector database for similarity searches
    await this.qdrantService.storeEmbedding(
      'data_classification_embeddings',
      id,
      await this.qdrantService.createEmbedding(`${classification.name} ${classification.description}`),
      {
        id,
        name: classification.name,
        sensitivityLevel: classification.sensitivityLevel,
        applicableEntities: classification.applicableEntities,
        createdAt: classification.createdAt
      }
    );

    return classification;
  }

  async updateClassification(id: string, updateData: Partial<DataClassification>): Promise<DataClassification> {
    const cypher = `
      MATCH (dc:DataClassification {id: $id})
      SET dc += $updateData,
          dc.updatedAt = $updatedAt
      RETURN dc
    `;

    const updateDataWithTimestamp = {
      ...updateData,
      updatedAt: new Date().toISOString(),
      classificationRules: updateData.classificationRules ? 
        JSON.stringify(updateData.classificationRules) : undefined
    };

    const result = await this.neo4jService.write(cypher, {
      id,
      updateData: updateDataWithTimestamp,
      updatedAt: new Date().toISOString()
    });

    if (result.records.length === 0) {
      throw new Error(`Data classification with id ${id} not found`);
    }

    const props = result.records[0].get('dc').properties;
    const classification = this.mapToClassification(props);

    // Update the embedding in vector database
    await this.qdrantService.updateEmbedding(
      'data_classification_embeddings',
      id,
      await this.qdrantService.createEmbedding(`${classification.name} ${classification.description}`),
      {
        id,
        name: classification.name,
        sensitivityLevel: classification.sensitivityLevel,
        applicableEntities: classification.applicableEntities,
        createdAt: classification.createdAt
      }
    );

    return classification;
  }

  async deleteClassification(id: string): Promise<boolean> {
    const cypher = 'MATCH (dc:DataClassification {id: $id}) DELETE dc RETURN COUNT(dc) as deletedCount';
    const result = await this.neo4jService.write(cypher, { id });

    if (result.records[0].get('deletedCount') > 0) {
      // Delete the embedding from vector database
      await this.qdrantService.deleteEmbedding('data_classification_embeddings', id);
      return true;
    }

    return false;
  }

  async classifyData(data: any, entityType: string): Promise<DataClassification[]> {
    // Find all classifications that apply to this entity type
    const applicableClassifications = await this.getAllClassifications(entityType);

    const matchedClassifications = [];

    for (const classification of applicableClassifications) {
      const matches = this.checkClassificationRules(data, classification.classificationRules);
      if (matches) {
        matchedClassifications.push(classification);
      }
    }

    return matchedClassifications;
  }

  async autoClassifyData(data: any): Promise<{ data: any; classifications: DataClassification[] }> {
    // This method would analyze the data structure and content to automatically assign classifications
    const allClassifications = await this.getAllClassifications();
    const classifiedFields = {};

    // Analyze each field in the data
    for (const [field, value] of Object.entries(data)) {
      const fieldString = typeof value === 'object' ? JSON.stringify(value) : String(value);
      
      // Find classifications that match this field
      for (const classification of allClassifications) {
        if (this.checkClassificationRules({ [field]: value }, classification.classificationRules)) {
          if (!classifiedFields[field]) {
            classifiedFields[field] = [];
          }
          classifiedFields[field].push(classification);
        }
      }
    }

    // Apply privacy controls based on classifications
    const processedData = { ...data };
    for (const [field, classifications] of Object.entries(classifiedFields as DataClassification[][])) {
      const highestSensitivity = this.getHighestSensitivity(classifications);
      
      // Apply masking based on sensitivity level
      if (highestSensitivity === 'restricted') {
        processedData[field] = '[RESTRICTED]';
      } else if (highestSensitivity === 'confidential') {
        processedData[field] = this.maskConfidentialData(data[field]);
      }
    }

    return {
      data: processedData,
      classifications: Object.values(classifiedFields).flat()
    };
  }

  async findSimilarClassifications(searchTerm: string, limit: number = 5): Promise<DataClassification[]> {
    // Create embedding for search term
    const queryVector = await this.qdrantService.createEmbedding(searchTerm);
    
    // Search in vector database
    const results = await this.qdrantService.searchEmbeddings(
      'data_classification_embeddings',
      queryVector,
      limit
    );

    // Retrieve full classification details
    const classifications = [];
    for (const result of results) {
      const classification = await this.getClassificationById(result.payload.id);
      if (classification) {
        classifications.push({
          ...classification,
          similarityScore: result.score
        });
      }
    }

    return classifications;
  }

  private checkClassificationRules(data: any, rules: ClassificationRule[]): boolean {
    if (!rules || !Array.isArray(rules)) {
      return false;
    }

    for (const rule of rules) {
      const fieldValue = this.getFieldValue(data, rule.field);
      
      if (fieldValue !== undefined && fieldValue !== null) {
        switch (rule.condition) {
          case 'regex':
            if (new RegExp(rule.value).test(String(fieldValue))) {
              return true;
            }
            break;
          case 'keyword':
            if (String(fieldValue).toLowerCase().includes(rule.value.toLowerCase())) {
              return true;
            }
            break;
          case 'pattern':
            if (this.matchPattern(String(fieldValue), rule.value)) {
              return true;
            }
            break;
          case 'equals':
            if (String(fieldValue) === rule.value) {
              return true;
            }
            break;
          case 'contains':
            if (Array.isArray(fieldValue) && fieldValue.includes(rule.value)) {
              return true;
            }
            break;
        }
      }
    }

    return false;
  }

  private getFieldValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private matchPattern(value: string, pattern: string): boolean {
    // Implement pattern matching logic
    // This could include email patterns, phone patterns, etc.
    if (pattern === 'email') {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    } else if (pattern === 'phone') {
      return /^[\+]?[1-9][\d]{0,15}$/.test(value.replace(/\D/g, ''));
    } else if (pattern === 'ssn') {
      return /^\d{3}-\d{2}-\d{4}$/.test(value);
    } else if (pattern === 'credit_card') {
      return /^[\d\s\-]{13,23}$/.test(value.replace(/\D/g, ''));
    }
    return false;
  }

  private getHighestSensitivity(classifications: DataClassification[]): string {
    const sensitivityLevels = ['public', 'internal', 'confidential', 'restricted'];
    let highestLevelIndex = 0;

    for (const classification of classifications) {
      const levelIndex = sensitivityLevels.indexOf(classification.sensitivityLevel);
      if (levelIndex > highestLevelIndex) {
        highestLevelIndex = levelIndex;
      }
    }

    return sensitivityLevels[highestLevelIndex];
  }

  private maskConfidentialData(value: any): any {
    if (typeof value === 'string') {
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        // Email masking: show first and last character
        const [local, domain] = value.split('@');
        return `${local.charAt(0)}***${local.charAt(local.length - 1)}@${domain}`;
      } else if (/^[\+]?[1-9][\d]{0,15}$/.test(value.replace(/\D/g, ''))) {
        // Phone masking: show first 2 and last 2 digits
        const cleanPhone = value.replace(/\D/g, '');
        if (cleanPhone.length > 4) {
          return `${cleanPhone.substring(0, 2)}****${cleanPhone.substring(cleanPhone.length - 2)}`;
        }
      } else if (value.length > 4) {
        // General string masking: show first 2 and last 2 characters
        return `${value.substring(0, 2)}****${value.substring(value.length - 2)}`;
      }
    } else if (typeof value === 'number') {
      // Mask numeric values
      return Math.floor(value / 10) * 10; // Round down to nearest 10
    }
    
    return '[MASKED]';
  }

  private mapToClassification(props: any): DataClassification {
    return {
      id: props.id,
      name: props.name,
      description: props.description,
      sensitivityLevel: props.sensitivityLevel,
      dataCategories: Array.isArray(props.dataCategories) ? props.dataCategories : [],
      applicableEntities: Array.isArray(props.applicableEntities) ? props.applicableEntities : [],
      classificationRules: props.classificationRules ? JSON.parse(props.classificationRules) : [],
      createdAt: new Date(props.createdAt),
      updatedAt: new Date(props.updatedAt),
      createdBy: props.createdBy
    };
  }
}