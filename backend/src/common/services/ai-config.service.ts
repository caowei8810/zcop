import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AiConfigService {
  constructor(private configService: ConfigService) {}

  getOpenAIConfig() {
    return {
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
      organization: this.configService.get<string>('OPENAI_ORGANIZATION'),
      project: this.configService.get<string>('OPENAI_PROJECT'),
      baseURL: this.configService.get<string>('OPENAI_BASE_URL'),
      defaultModel: this.configService.get<string>('OPENAI_DEFAULT_MODEL') || 'gpt-4o',
      temperature: parseFloat(this.configService.get<string>('OPENAI_TEMPERATURE')) || 0.7,
      maxTokens: parseInt(this.configService.get<string>('OPENAI_MAX_TOKENS')) || 4096,
      timeout: parseInt(this.configService.get<string>('OPENAI_TIMEOUT')) || 30000,
    };
  }

  getAnthropicConfig() {
    return {
      apiKey: this.configService.get<string>('ANTHROPIC_API_KEY'),
      defaultModel: this.configService.get<string>('ANTHROPIC_DEFAULT_MODEL') || 'claude-3-5-sonnet-20241022',
      temperature: parseFloat(this.configService.get<string>('ANTHROPIC_TEMPERATURE')) || 0.7,
      maxTokens: parseInt(this.configService.get<string>('ANTHROPIC_MAX_TOKENS')) || 4096,
      timeout: parseInt(this.configService.get<string>('ANTHROPIC_TIMEOUT')) || 30000,
    };
  }

  getQwenConfig() {
    return {
      apiKey: this.configService.get<string>('QWEN_API_KEY'),
      defaultModel: this.configService.get<string>('QWEN_DEFAULT_MODEL') || 'qwen-max',
      temperature: parseFloat(this.configService.get<string>('QWEN_TEMPERATURE')) || 0.7,
      maxTokens: parseInt(this.configService.get<string>('QWEN_MAX_TOKENS')) || 4096,
      timeout: parseInt(this.configService.get<string>('QWEN_TIMEOUT')) || 30000,
    };
  }

  getMultiModelConfig() {
    return {
      primaryModel: this.configService.get<string>('PRIMARY_AI_MODEL') || 'openai',
      fallbackModels: this.configService.get<string>('FALLBACK_AI_MODELS')?.split(',') || ['anthropic', 'qwen'],
      timeout: parseInt(this.configService.get<string>('AI_TOTAL_TIMEOUT')) || 60000,
      maxRetries: parseInt(this.configService.get<string>('AI_MAX_RETRIES')) || 3,
      concurrency: parseInt(this.configService.get<string>('AI_CONCURRENCY')) || 5,
    };
  }
}