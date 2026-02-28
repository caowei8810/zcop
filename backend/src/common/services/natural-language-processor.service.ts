import { Injectable } from '@nestjs/common';
import { AIService } from './ai.service';

@Injectable()
export class NaturalLanguageProcessor {
  constructor(private aiService: AIService) {}

  async parseUserIntent(userInput: string): Promise<any> {
    const schema = {
      intent: "string",
      entities: [
        {
          type: "string",
          value: "string",
          position: "number"
        }
      ],
      actions: ["string"],
      parameters: {
        [key: string]: "any"
      }
    };

    const prompt = `
      Analyze this user input: "${userInput}"
      
      Identify the user's intent, extract named entities, possible actions, and parameters.
      Consider this is for a business system with entities like Customer, Order, Product, etc.
      
      Respond in JSON format with intent, entities, actions, and parameters.
    `;

    return await this.aiService.generateStructuredOutput(prompt, schema, 'openai');
  }

  async generateCypherQuery(userRequest: string, ontology: any): Promise<string> {
    const prompt = `
      Given this ontology: ${JSON.stringify(ontology, null, 2)}
      
      And this user request: "${userRequest}"
      
      Generate a precise Cypher query to retrieve the requested information.
      Make sure to use the correct node labels and relationship types from the ontology.
      
      Respond with only the Cypher query, no additional text.
    `;

    return await this.aiService.generateResponse(prompt, 'openai');
  }

  async translateNaturalLanguageToAction(userRequest: string, availableActions: any[]): Promise<any> {
    const prompt = `
      Given these available actions: ${JSON.stringify(availableActions, null, 2)}
      
      And this user request: "${userRequest}"
      
      Determine which action best matches the user's intent and extract any necessary parameters.
      
      Respond in JSON format with the action ID and parameters.
    `;

    const schema = {
      actionId: "string",
      parameters: {
        [key: string]: "any"
      },
      confidence: "number"
    };

    return await this.aiService.generateStructuredOutput(prompt, schema, 'openai');
  }

  async generateBusinessLogic(userRequirement: string, entities: any[]): Promise<any> {
    const prompt = `
      Based on this business requirement: "${userRequirement}"
      
      And these entities: ${JSON.stringify(entities, null, 2)}
      
      Generate business logic in the form of rules, validations, or process steps.
      
      Respond in JSON format with rules, validations, and process steps.
    `;

    const schema = {
      rules: [
        {
          condition: "string",
          action: "string",
          priority: "number"
        }
      ],
      validations: [
        {
          entity: "string",
          field: "string",
          rule: "string",
          errorMessage: "string"
        }
      ],
      processSteps: [
        {
          step: "string",
          description: "string",
          inputs: ["string"],
          outputs: ["string"]
        }
      ]
    };

    return await this.aiService.generateStructuredOutput(prompt, schema, 'openai');
  }

  async summarizeConversation(history: string[]): Promise<string> {
    const fullHistory = history.join('\n');
    
    const prompt = `
      Summarize this conversation history in 2-3 sentences, focusing on the main topics discussed
      and any decisions made:
      
      ${fullHistory}
    `;

    return await this.aiService.summarizeLargeText(prompt, 500);
  }

  async classifyRequestType(userInput: string): Promise<string> {
    const categories = [
      'query_data', 
      'create_entity', 
      'update_entity', 
      'delete_entity', 
      'generate_report', 
      'configure_system', 
      'request_help',
      'other'
    ];

    const prompt = `
      Classify this user request into one of these categories: ${categories.join(', ')}
      
      Request: ${userInput}
      
      Respond with only the category name.
    `;

    return await this.aiService.classifyContent(prompt, categories);
  }

  async extractEntitiesAndRelationships(text: string, ontology: any): Promise<any> {
    const entityTypes = ontology.entities?.map((e: any) => e.name) || [];
    const relationshipTypes = ontology.relationships?.map((r: any) => r.name) || [];
    
    const allTypes = [...entityTypes, ...relationshipTypes];

    const prompt = `
      Extract instances of these entity and relationship types from the text: ${allTypes.join(', ')}
      
      Text: ${text}
      
      Respond in JSON format with entity and relationship arrays.
    `;

    const schema = {
      entities: [
        {
          type: "string",
          value: "string",
          confidence: "number"
        }
      ],
      relationships: [
        {
          type: "string",
          from: "string",
          to: "string",
          confidence: "number"
        }
      ]
    };

    return await this.aiService.generateStructuredOutput(prompt, schema, 'openai');
  }

  async generateNaturalLanguageResponse(aiResult: any, userRequest: string): Promise<string> {
    const prompt = `
      Given this AI analysis result: ${JSON.stringify(aiResult, null, 2)}
      
      And the original user request: "${userRequest}"
      
      Generate a natural language response that explains the result in business terms.
    `;

    return await this.aiService.generateResponse(prompt, 'openai');
  }

  async validateUserInput(userInput: string, context: any): Promise<{ isValid: boolean; feedback: string }> {
    const prompt = `
      Validate this user input: "${userInput}"
      
      In the context of: ${JSON.stringify(context, null, 2)}
      
      Is the input clear, actionable, and appropriate for the system? Provide feedback if not.
      
      Respond in JSON format with isValid and feedback fields.
    `;

    const schema = {
      isValid: "boolean",
      feedback: "string"
    };

    return await this.aiService.generateStructuredOutput(prompt, schema, 'openai');
  }

  async generateSuggestions(userInput: string, availableFeatures: any[]): Promise<string[]> {
    const prompt = `
      Based on this user input: "${userInput}"
      
      And these available features: ${JSON.stringify(availableFeatures, null, 2)}
      
      Generate 3-5 suggestions for what the user might want to do next.
      
      Respond with an array of suggestion strings.
    `;

    return await this.aiService.generateResponse(prompt, 'openai').then(res => JSON.parse(res));
  }
}