import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OntologyResolver } from './resolvers/ontology.resolver';
import { OntologyService } from './services/ontology.service';
import { EntityDefinition } from './entities/entity-definition.entity';
import { PropertyDefinition } from './entities/property-definition.entity';
import { RelationDefinition } from './entities/relation-definition.entity';
import { ActionDefinition } from './entities/action-definition.entity';
import { RuleDefinition } from './entities/rule-definition.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EntityDefinition,
      PropertyDefinition,
      RelationDefinition,
      ActionDefinition,
      RuleDefinition,
    ]),
  ],
  providers: [
    OntologyResolver,
    OntologyService,
  ],
  exports: [OntologyService],
})
export class OntologyModule {}