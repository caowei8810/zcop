import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EntityField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'array' | 'object' | 'id';
  required?: boolean;
  unique?: boolean;
  indexed?: boolean;
  defaultValue?: any;
  description?: string;
  validations?: FieldValidation[];
}

export interface FieldValidation {
  type: 'min' | 'max' | 'minLength' | 'maxLength' | 'pattern' | 'email' | 'url';
  value: any;
}

export interface EntityDefinition {
  name: string;
  fields: EntityField[];
  description?: string;
  relationships?: EntityRelationship[];
  permissions?: EntityPermission[];
}

export interface EntityRelationship {
  type: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
  entity: string;
  fieldName: string;
  foreignKey?: string;
  onDelete?: 'cascade' | 'set-null' | 'restrict';
  onUpdate?: 'cascade' | 'restrict';
}

export interface EntityPermission {
  role: string;
  actions: ('create' | 'read' | 'update' | 'delete')[];
}

export interface CodeGenerationOptions {
  includeTests: boolean;
  includeDocumentation: boolean;
  includeMigration: boolean;
  includeSeed: boolean;
  includeGraphQL: boolean;
  includeRest: boolean;
  includeDto: boolean;
  includeService: boolean;
  includeController: boolean;
  includeEntity: boolean;
}

@Injectable()
export class CodeGenerationOptimizationService {
  private readonly logger = new Logger(CodeGenerationOptimizationService.name);

  /**
   * Generate entity class from definition
   */
  generateEntity(entity: EntityDefinition): string {
    const fields = entity.fields.map(field => this.generateField(field)).join('\n  ');
    
    // Add relationship fields
    const relationshipFields = entity.relationships 
      ? entity.relationships.map(rel => this.generateRelationshipField(rel)).join('\n  ')
      : '';
    
    const allFields = fields + (relationshipFields ? '\n  ' + relationshipFields : '');
    
    return `import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index, OneToMany, ManyToOne, ManyToMany, JoinTable } from 'typeorm';
import { Field, ObjectType } from '@nestjs/graphql';
import { IsString, IsNumber, IsBoolean, IsOptional, IsEmail, Length, Min, Max, IsEnum } from 'class-validator';

@Entity('${entity.name.toLowerCase()}s')
@ObjectType()
export class ${entity.name} {
  @Field(() => String)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  ${allFields}

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
`;
  }

  /**
   * Generate service class
   */
  generateService(entity: EntityDefinition): string {
    const entityName = entity.name;
    const entityNameLower = entityName.toLowerCase();
    const pluralizedName = this.pluralize(entityNameLower);

    return `import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial, FindManyOptions } from 'typeorm';
import { ${entityName} } from './entities/${entityNameLower}.entity';

@Injectable()
export class ${entityName}Service {
  constructor(
    @InjectRepository(${entityName})
    private ${entityNameLower}Repository: Repository<${entityName}>,
  ) {}

  async findAll(options?: FindManyOptions<${entityName}>): Promise<${entityName}[]> {
    return this.${entityNameLower}Repository.find(options);
  }

  async findOne(id: string): Promise<${entityName}> {
    const ${entityNameLower} = await this.${entityNameLower}Repository.findOne({
      where: { id },
    });
    if (!${entityNameLower}) {
      throw new NotFoundException('${entityName} with id ${entityNameLower} not found');
    }
    return ${entityNameLower};
  }

  async create(${entityNameLower}: DeepPartial<${entityName}>): Promise<${entityName}> {
    const new${entityName} = this.${entityNameLower}Repository.create(${entityNameLower});
    return this.${entityNameLower}Repository.save(new${entityName});
  }

  async update(id: string, ${entityNameLower}: DeepPartial<${entityName}>): Promise<${entityName}> {
    await this.${entityNameLower}Repository.update(id, ${entityNameLower});
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.${entityNameLower}Repository.delete(id);
  }

  async count(): Promise<number> {
    return this.${entityNameLower}Repository.count();
  }
}
`;
  }

  /**
   * Generate controller class
   */
  generateController(entity: EntityDefinition, options: CodeGenerationOptions): string {
    const entityName = entity.name;
    const entityNameLower = entityName.toLowerCase();
    const pluralizedName = this.pluralize(entityNameLower);

    let imports = `import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { ${entityName}Service } from './${entityNameLower}.service';
import { ${entityName} } from './entities/${entityNameLower}.entity';`;

    if (options.includeDto) {
      imports += `\nimport { Create${entityName}Dto, Update${entityName}Dto } from './dto/${entityNameLower}.dto';`;
    }

    let serviceCall = options.includeDto ? `create${entityName}Dto` : `${entityNameLower}`;
    let updateServiceCall = options.includeDto ? `update${entityName}Dto` : `${entityNameLower}`;

    return `${imports}

@Controller('${pluralizedName}')
export class ${entityName}Controller {
  constructor(private readonly ${entityNameLower}Service: ${entityName}Service) {}

  @Get()
  async findAll(@Query() query: any): Promise<${entityName}[]> {
    return this.${entityNameLower}Service.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<${entityName}> {
    return this.${entityNameLower}Service.findOne(id);
  }

  @Post()
  async create(@Body() ${serviceCall}: ${options.includeDto ? `Create${entityName}Dto` : `DeepPartial<${entityName}>`}): Promise<${entityName}> {
    return this.${entityNameLower}Service.create(${serviceCall});
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() ${updateServiceCall}: ${options.includeDto ? `Update${entityName}Dto` : `DeepPartial<${entityName}>`}
  ): Promise<${entityName}> {
    return this.${entityNameLower}Service.update(id, ${updateServiceCall});
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    return this.${entityNameLower}Service.remove(id);
  }
}
`;
  }

  /**
   * Generate GraphQL resolver
   */
  generateResolver(entity: EntityDefinition): string {
    const entityName = entity.name;
    const entityNameLower = entityName.toLowerCase();
    const pluralizedName = this.pluralize(entityName);

    return `import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { ${entityName} } from './entities/${entityName.toLowerCase()}.entity';
import { ${entityName}Service } from './${entityNameLower}.service';

@Resolver(() => ${entityName})
export class ${entityName}Resolver {
  constructor(private readonly ${entityNameLower}Service: ${entityName}Service) {}

  @Query(() => [${entityName}], { name: '${pluralizedName}' })
  async ${pluralizedName}(): Promise<${entityName}[]> {
    return this.${entityNameLower}Service.findAll();
  }

  @Query(() => ${entityName}, { name: '${entityNameLower}' })
  async ${entityNameLower}(@Args('id', { type: () => ID }) id: string): Promise<${entityName}> {
    return this.${entityNameLower}Service.findOne(id);
  }

  @Mutation(() => ${entityName})
  async create${entityName}(@Args('input') input: any): Promise<${entityName}> {
    return this.${entityNameLower}Service.create(input);
  }

  @Mutation(() => ${entityName})
  async update${entityName}(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: any
  ): Promise<${entityName}> {
    return this.${entityNameLower}Service.update(id, input);
  }

  @Mutation(() => Boolean)
  async remove${entityName}(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
    await this.${entityNameLower}Service.remove(id);
    return true;
  }
}
`;
  }

  /**
   * Generate DTO classes
   */
  generateDTOs(entity: EntityDefinition): { createDto: string; updateDto: string } {
    const entityName = entity.name;
    
    // Create DTO
    const createFields = entity.fields
      .filter(field => field.required !== false)
      .map(field => this.generateDtoField(field, true))
      .join('\n  ');

    // Update DTO
    const updateFields = entity.fields
      .map(field => this.generateDtoField(field, false))
      .join('\n  ');

    const createDto = `import { InputType, Field, ID } from '@nestjs/graphql';
import { IsString, IsNumber, IsBoolean, IsOptional, IsEmail, Length, Min, Max, IsEnum, IsArray } from 'class-validator';

@InputType()
export class Create${entityName}Dto {
  ${createFields}
}`;

    const updateDto = `import { InputType, Field, ID } from '@nestjs/graphql';
import { IsString, IsNumber, IsBoolean, IsOptional, IsEmail, Length, Min, Max, IsEnum, IsArray } from 'class-validator';

@InputType()
export class Update${entityName}Dto {
  ${updateFields}
}`;

    return { createDto, updateDto };
  }

  /**
   * Generate migration file
   */
  generateMigration(entity: EntityDefinition, version: string): string {
    const tableName = `${entity.name.toLowerCase()}s`;
    
    // Generate column definitions for migration
    const columns = entity.fields.map(field => {
      let type: string;
      switch (field.type) {
        case 'string':
          type = "type: 'varchar'";
          break;
        case 'number':
          type = "type: 'integer'";
          break;
        case 'boolean':
          type = "type: 'boolean'";
          break;
        case 'date':
          type = "type: 'timestamp'";
          break;
        case 'id':
          type = "type: 'uuid'";
          break;
        default:
          type = "type: 'text'";
      }
      
      const nullable = field.required !== true ? ', isNullable: true' : '';
      const unique = field.unique ? ', isUnique: true' : '';
      
      return `        {\n          name: '${field.name}',\n          ${type}${nullable}${unique}\n        }`;
    }).join(',\n');

    return `import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class Create${entity.name}${version} implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(new Table({
            name: "${tableName}",
            columns: [\n${columns}\n    ]
        }), true);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable("${tableName}");
    }

}
`;
  }

  /**
   * Generate seed file
   */
  generateSeed(entity: EntityDefinition): string {
    const entityName = entity.name;
    const entityNameLower = entityName.toLowerCase();
    
    // Generate sample data based on field types
    const sampleData = entity.fields.map(field => {
      let value: string;
      switch (field.type) {
        case 'string':
          value = `'Sample ${field.name}'`;
          break;
        case 'number':
          value = '123';
          break;
        case 'boolean':
          value = 'true';
          break;
        case 'date':
          value = 'new Date()';
          break;
        case 'id':
          value = `'${this.generateId()}'`;
          break;
        default:
          value = `''`;
      }
      return `      ${field.name}: ${value},`;
    }).join('\n');

    return `import { DataSource } from 'typeorm';
import { ${entityName} } from '../src/modules/${entityName.toLowerCase()}/entities/${entityName.toLowerCase()}.entity';

export default async (dataSource: DataSource) => {
  const ${entityNameLower}Repository = dataSource.getRepository(${entityName});

  // Check if data already exists
  const existingCount = await ${entityNameLower}Repository.count();
  if (existingCount > 0) {
    console.log('${entityName} seeds already exist, skipping...');
    return;
  }

  const sample${entityName}s: Partial<${entityName}>[] = [
    {
${sampleData}
    }
  ];

  for (const ${entityNameLower}Data of sample${entityName}s) {
    const ${entityNameLower} = ${entityNameLower}Repository.create(${entityNameLower}Data);
    await ${entityNameLower}Repository.save(${entityNameLower});
  }

  console.log(\`Created \${sample${entityName}s.length} ${entityName} records\`);
};
`;
  }

  /**
   * Generate complete module
   */
  async generateModule(entity: EntityDefinition, options: CodeGenerationOptions = {
    includeTests: true,
    includeDocumentation: true,
    includeMigration: true,
    includeSeed: true,
    includeGraphQL: true,
    includeRest: true,
    includeDto: true,
    includeService: true,
    includeController: true,
    includeEntity: true,
  }): Promise<Record<string, string>> {
    const files: Record<string, string> = {};
    const entityName = entity.name;
    const entityNameLower = entityName.toLowerCase();
    const moduleName = entityNameLower;

    // Generate entity
    if (options.includeEntity) {
      files[`entities/${entityNameLower}.entity.ts`] = this.generateEntity(entity);
    }

    // Generate service
    if (options.includeService) {
      files[`${entityNameLower}.service.ts`] = this.generateService(entity);
    }

    // Generate controller
    if (options.includeController) {
      files[`${entityNameLower}.controller.ts`] = this.generateController(entity, options);
    }

    // Generate resolver
    if (options.includeGraphQL) {
      files[`${entityNameLower}.resolver.ts`] = this.generateResolver(entity);
    }

    // Generate DTOs
    if (options.includeDto) {
      const dtos = this.generateDTOs(entity);
      files[`dto/${entityNameLower}.dto.ts`] = `${dtos.createDto}\n\n${dtos.updateDto}`;
    }

    // Generate module file
    const moduleImports = [
      options.includeEntity ? `import { TypeOrmModule } from '@nestjs/typeorm';` : '',
      options.includeService ? `import { ${entityName}Service } from './${entityNameLower}.service';` : '',
      options.includeController ? `import { ${entityName}Controller } from './${entityNameLower}.controller';` : '',
      options.includeGraphQL ? `import { ${entityName}Resolver } from './${entityNameLower}.resolver';` : '',
      options.includeEntity ? `import { ${entityName} } from './entities/${entityNameLower}.entity';` : '',
    ].filter(Boolean).join('\n');

    const moduleContent = `${moduleImports}

@Module({
  imports: [
    TypeOrmModule.forFeature([${entityName}]),
  ],
  providers: [
    ${entityName}Service,
    ${entityName}Resolver,
  ],
  controllers: [
    ${entityName}Controller,
  ],
  exports: [
    ${entityName}Service,
  ],
})
export class ${entityName}Module {}
`;

    files[`${moduleName}.module.ts`] = moduleContent;

    // Generate migration
    if (options.includeMigration) {
      const timestamp = Date.now().toString();
      files[`migrations/${timestamp}-create-${entityNameLower}.ts`] = this.generateMigration(entity, timestamp);
    }

    // Generate seed
    if (options.includeSeed) {
      files[`seeds/${entityNameLower}.seed.ts`] = this.generateSeed(entity);
    }

    // Generate tests
    if (options.includeTests) {
      files[`test/${entityNameLower}.e2e-spec.ts`] = this.generateTest(entity);
    }

    // Generate documentation
    if (options.includeDocumentation) {
      files[`docs/${entityNameLower}.md`] = this.generateDocumentation(entity);
    }

    return files;
  }

  /**
   * Generate test file
   */
  private generateTest(entity: EntityDefinition): string {
    const entityName = entity.name;
    const entityNameLower = entityName.toLowerCase();

    return `import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('${entityName}Controller', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/${entityNameLower} (GET)', () => {
    return request(app.getHttpServer())
      .get('/${entityNameLower}')
      .expect(200);
  });

  afterEach(async () => {
    await app.close();
  });
});
`;
  }

  /**
   * Generate documentation
   */
  private generateDocumentation(entity: EntityDefinition): string {
    const fieldsDoc = entity.fields.map(field => `- ${field.name}: ${field.type} (${field.required ? 'required' : 'optional'})`).join('\n');
    
    return `# ${entity.name} Entity

## Description
${entity.description || 'Entity for managing ' + entity.name}

## Fields
${fieldsDoc}

## Relationships
${entity.relationships?.map(rel => `- ${rel.fieldName}: ${rel.type} -> ${rel.entity}`).join('\n') || 'None'}

## Permissions
${entity.permissions?.map(perm => `- ${perm.role}: ${perm.actions.join(', ')}`).join('\n') || 'None'}
`;
  }

  /**
   * Generate field definition for entity
   */
  private generateField(field: EntityField): string {
    let decorators = [];
    
    // Add validation decorators
    if (field.validations) {
      for (const validation of field.validations) {
        switch (validation.type) {
          case 'min':
            decorators.push(`@Min(${validation.value})`);
            break;
          case 'max':
            decorators.push(`@Max(${validation.value})`);
            break;
          case 'minLength':
            decorators.push(`@Length(${validation.value}, undefined)`);
            break;
          case 'maxLength':
            decorators.push(`@Length(undefined, ${validation.value})`);
            break;
          case 'email':
            decorators.push(`@IsEmail()`);
            break;
          case 'url':
            decorators.push(`@Validate(IsValidUrl)`);
            break;
        }
      }
    }
    
    // Add required/optional decorator
    if (field.required) {
      decorators.push('@IsString()'); // Default to string, adjust based on type
    } else {
      decorators.push('@IsOptional()');
    }
    
    // Add TypeORM decorators
    let columnOptions = [];
    if (field.unique) columnOptions.push('unique: true');
    if (field.type === 'id') columnOptions.push("primary: true, type: 'uuid'");
    if (!field.required) columnOptions.push('nullable: true');
    
    let columnDecorator = '@Column({ ' + columnOptions.join(', ') + ' })';
    if (columnOptions.length === 0) {
      columnDecorator = '@Column()';
    }
    
    // Add GraphQL field decorator
    let graphQLType = 'String';
    switch (field.type) {
      case 'number':
        graphQLType = 'Number';
        break;
      case 'boolean':
        graphQLType = 'Boolean';
        break;
      case 'date':
        graphQLType = 'Date';
        break;
    }
    
    const fieldDef = `@Field(() => ${graphQLType}${field.required !== false ? '' : ', { nullable: true }'})
  ${columnDecorator}
  ${decorators.join('\n  ')}
  ${field.name}${field.required !== false ? '' : '?'}: ${this.getTypeScriptType(field.type)};
`;

    return fieldDef;
  }

  /**
   * Generate relationship field
   */
  private generateRelationshipField(relationship: EntityRelationship): string {
    let decorator: string;
    let graphQLDecorator: string;
    
    switch (relationship.type) {
      case 'one-to-one':
        decorator = `@OneToOne(() => ${relationship.entity}, { eager: true })\n  @JoinColumn()`;
        graphQLDecorator = `@Field(() => ${relationship.entity}, { nullable: true })`;
        break;
      case 'one-to-many':
        decorator = `@OneToMany(() => ${relationship.entity}, ${relationship.entity.toLowerCase()}, { eager: true })`;
        graphQLDecorator = `@Field(() => [${relationship.entity}], { nullable: 'items' })`;
        break;
      case 'many-to-one':
        decorator = `@ManyToOne(() => ${relationship.entity}, ${relationship.entity.toLowerCase()}, { eager: true })`;
        graphQLDecorator = `@Field(() => ${relationship.entity}, { nullable: true })`;
        break;
      case 'many-to-many':
        decorator = `@ManyToMany(() => ${relationship.entity}, { eager: true })\n  @JoinTable()`;
        graphQLDecorator = `@Field(() => [${relationship.entity}], { nullable: 'items' })`;
        break;
    }
    
    return `${graphQLDecorator}
  ${decorator}
  ${relationship.fieldName}: ${relationship.type.includes('-to-many') ? `${relationship.entity}[]` : relationship.entity};`;
  }

  /**
   * Generate field for DTO
   */
  private generateDtoField(field: EntityField, forCreate: boolean): string {
    const isOptional = !forCreate && (field.required === false);
    const decorators = [];
    
    // Add validation decorators based on type and requirements
    if (field.type === 'string') {
      decorators.push('@IsString()');
      if (field.validations) {
        for (const validation of field.validations) {
          if (validation.type === 'minLength') {
            decorators.push(`@Length(${validation.value})`);
          } else if (validation.type === 'maxLength') {
            decorators.push(`@Length(0, ${validation.value})`);
          } else if (validation.type === 'email') {
            decorators.push('@IsEmail()');
          } else if (validation.type === 'pattern') {
            decorators.push(`@Matches(${validation.value})`);
          }
        }
      }
    } else if (field.type === 'number') {
      decorators.push('@IsNumber()');
      if (field.validations) {
        for (const validation of field.validations) {
          if (validation.type === 'min') {
            decorators.push(`@Min(${validation.value})`);
          } else if (validation.type === 'max') {
            decorators.push(`@Max(${validation.value})`);
          }
        }
      }
    } else if (field.type === 'boolean') {
      decorators.push('@IsBoolean()');
    }
    
    if (isOptional) {
      decorators.push('@IsOptional()');
    }
    
    const graphQLType = this.getGraphQLType(field.type);
    const fieldDef = `@Field(() => ${graphQLType}${isOptional ? ', { nullable: true }' : ''})
  ${decorators.join('\n  ')}
  ${field.name}${isOptional ? '?' : ''}: ${this.getTypeScriptType(field.type)};
`;

    return fieldDef;
  }

  /**
   * Get TypeScript type for field
   */
  private getTypeScriptType(type: EntityField['type']): string {
    switch (type) {
      case 'string': return 'string';
      case 'number': return 'number';
      case 'boolean': return 'boolean';
      case 'date': return 'Date';
      case 'enum': return 'string'; // enums are represented as strings
      case 'array': return 'any[]';
      case 'object': return 'any';
      case 'id': return 'string';
      default: return 'any';
    }
  }

  /**
   * Get GraphQL type for field
   */
  private getGraphQLType(type: EntityField['type']): string {
    switch (type) {
      case 'string': return 'String';
      case 'number': return 'Number';
      case 'boolean': return 'Boolean';
      case 'date': return 'Date';
      case 'enum': return 'String';
      case 'array': return '[String]';
      case 'object': return 'JSONObject'; // requires scalar definition
      case 'id': return 'ID';
      default: return 'String';
    }
  }

  /**
   * Pluralize word (simple implementation)
   */
  private pluralize(word: string): string {
    if (word.endsWith('y')) {
      return word.slice(0, -1) + 'ies';
    } else if (word.endsWith('s')) {
      return word;
    } else {
      return word + 's';
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }
}