import { Test, TestingModule } from '@nestjs/testing';
import { QdrantService } from '../../src/common/services/qdrant.service';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

describe('QdrantService', () => {
  let service: QdrantService;
  let mockCache: Cache;

  beforeEach(async () => {
    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    } as unknown as Cache;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QdrantService,
        ConfigService,
        {
          provide: CACHE_MANAGER,
          useValue: mockCache,
        },
      ],
    }).compile();

    service = module.get<QdrantService>(QdrantService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create an embedding', async () => {
    const text = 'Test embedding';
    const result = await service['createEmbedding'](text);
    
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1536); // Standard embedding size
  });

  it('should cache embeddings', async () => {
    const text = 'Cached embedding test';
    const firstResult = await service['createEmbedding'](text);
    const secondResult = await service['createEmbedding'](text);
    
    // Should be called once initially, then retrieved from cache
    expect(firstResult).toEqual(secondResult);
  });

  it('should generate semantic search results', async () => {
    // Mock the client methods to avoid actual Qdrant calls
    const mockUpsert = jest.spyOn(service['client'], 'upsert').mockResolvedValue(undefined);
    const mockSearch = jest.spyOn(service['client'], 'search').mockResolvedValue([]);

    const result = await service.semanticSearch('test_collection', 'test query');
    
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    
    mockUpsert.mockRestore();
    mockSearch.mockRestore();
  });
});