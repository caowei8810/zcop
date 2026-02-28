import { Injectable } from '@nestjs/common';
import { OpenAIClient } from 'openai';
import { ChatAnthropic } from 'langchain/chat_models/anthropic';
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { PromptTemplate } from 'langchain/prompts';
import { LLMChain } from 'langchain/chains';
import { CallbackManager } from 'langchain/callbacks';

@Injectable()
export class AIService {
  private openaiClient: OpenAIClient;
  private models: Map<string, any> = new Map();

  constructor() {
    // Initialize different AI models
    if (process.env.OPENAI_API_KEY) {
      this.models.set('openai', new ChatOpenAI({
        openAIApiKey: process.env.OPENAI_API_KEY,
        modelName: process.env.OPENAI_DEFAULT_MODEL || 'gpt-4o',
        temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
        maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '4096'),
      }));
    }

    if (process.env.ANTHROPIC_API_KEY) {
      this.models.set('anthropic', new ChatAnthropic({
        anthropicApiKey: process.env.ANTHROPIC_API_KEY,
        modelName: process.env.ANTHROPIC_DEFAULT_MODEL || 'claude-3-5-sonnet-20241022',
        temperature: parseFloat(process.env.ANTHROPIC_TEMPERATURE || '0.7'),
        maxTokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS || '4096'),
      }));
    }
  }

  async generateResponse(prompt: string, modelType: string = 'openai'): Promise<string> {
    const model = this.models.get(modelType);
    if (!model) {
      throw new Error(`Model ${modelType} not available`);
    }

    // Create a prompt template
    const promptTemplate = new PromptTemplate({
      template: "{input}",
      inputVariables: ["input"],
    });

    // Create a chain
    const chain = new LLMChain({
      llm: model,
      prompt: promptTemplate,
    });

    const result = await chain.call({ input: prompt });
    return result.text;
  }

  async generateStructuredOutput(
    prompt: string, 
    schema: any, 
    modelType: string = 'openai'
  ): Promise<any> {
    // Add schema instruction to the prompt
    const schemaInstruction = `Respond in JSON format matching this schema: ${JSON.stringify(schema)}`;
    const fullPrompt = `${prompt}\n\n${schemaInstruction}`;

    const response = await this.generateResponse(fullPrompt, modelType);
    
    try {
      return JSON.parse(response);
    } catch (error) {
      console.error('Failed to parse structured output:', error);
      throw new Error('AI response is not valid JSON');
    }
  }

  async generateOntologyFromDescription(description: string): Promise<any> {
    const schema = {
      entities: [
        {
          name: "string",
          description: "string",
          properties: [
            {
              name: "string",
              type: "string",
              required: "boolean",
              unique: "boolean",
            }
          ]
        }
      ],
      relationships: [
        {
          name: "string",
          fromEntity: "string",
          toEntity: "string",
          description: "string",
        }
      ]
    };

    return await this.generateStructuredOutput(
      `Based on this description: "${description}", generate an ontology structure with entities and relationships. ${description}`,
      schema,
      'openai'
    );
  }

  async analyzeBusinessProcess(text: string): Promise<any> {
    const schema = {
      entities: ["string"],
      actions: [
        {
          name: "string",
          description: "string",
          input: ["string"],
          output: ["string"],
          preconditions: ["string"],
          postconditions: ["string"],
        }
      ],
      rules: [
        {
          condition: "string",
          action: "string",
          priority: "number",
        }
      ]
    };

    return await this.generateStructuredOutput(
      `Analyze this business process: "${text}" and identify the key entities, actions, and business rules.`,
      schema,
      'openai'
    );
  }

  async generateNaturalLanguageQuery(ontology: any, userRequest: string): Promise<string> {
    const prompt = `
      Given this ontology: ${JSON.stringify(ontology, null, 2)}
      
      And this user request: "${userRequest}"
      
      Generate a precise Cypher query to retrieve the requested information.
      
      Respond with only the Cypher query, no additional text.
    `;

    return await this.generateResponse(prompt, 'openai');
  }

  async summarizeLargeText(text: string, maxLength: number = 500): Promise<string> {
    const prompt = `
      Summarize the following text in no more than ${maxLength} characters:
      
      ${text}
    `;

    return await this.generateResponse(prompt, 'openai');
  }

  async classifyContent(content: string, categories: string[]): Promise<string> {
    const prompt = `
      Classify the following content into one of these categories: ${categories.join(', ')}
      
      Content: ${content}
      
      Respond with only the category name.
    `;

    return await this.generateResponse(prompt, 'openai');
  }

  async extractInformation(text: string, entities: string[]): Promise<Record<string, string[]>> {
    const prompt = `
      Extract instances of the following entities from this text: ${entities.join(', ')}
      
      Text: ${text}
      
      Respond in JSON format with entity names as keys and arrays of extracted values as values.
    `;

    return await this.generateStructuredOutput(prompt, {}, 'openai');
  }

  async evaluateModelResponse(response: string, criteria: string[]): Promise<{ score: number; feedback: string }> {
    const prompt = `
      Evaluate the following response based on these criteria: ${criteria.join(', ')}
      
      Response: ${response}
      
      Provide a score from 0-100 and feedback on how well the response meets the criteria.
      
      Respond in JSON format with "score" and "feedback" fields.
    `;

    return await this.generateStructuredOutput(prompt, {}, 'openai');
  }
}