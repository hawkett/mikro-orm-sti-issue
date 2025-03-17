import { EntitySchema, Collection } from '@mikro-orm/core';

// Base class for all entities
export class BaseEntity {
  id!: number;
  name!: string;
  type!: string;
  
  // Reference to containing ParentEntity
  parent?: ParentEntity;

  // Many-to-many relationship with MidEntities
  mids = new Collection<MidEntity>(this);
}

// MidEntity extends BaseEntity and can have many BaseEntities
export class MidEntity extends BaseEntity {
  // Collection of BaseEntities that belong to this mid
  items = new Collection<BaseEntity>(this);

  // Optional parent mid
  parentMid?: MidEntity;
  
  // Child mids
  childMids = new Collection<MidEntity>(this);
}

// ParentEntity extends MidEntity
export class ParentEntity extends MidEntity {
  elements = new Collection<BaseEntity>(this);
}

export class BossEntity extends ParentEntity {
  description?: string;
}

// Base schema with STI support
export const BaseSchema = new EntitySchema<BaseEntity>({
  class: BaseEntity,
  discriminatorColumn: 'type',
  discriminatorValue: 'base',
  properties: {
    id: { type: 'number', primary: true },
    name: { type: 'string' },
    type: { type: 'string' },
    parent: { kind: 'm:1', entity: () => 'ParentEntity', nullable: true },
    mids: {
      kind: 'm:n',
      entity: () => 'MidEntity',
      mappedBy: 'items',
      owner: false
    }
  }
}); 

// MidEntity schema extending BaseSchema
export const MidSchema = new EntitySchema<MidEntity, BaseEntity>({
  class: MidEntity,
  extends: BaseSchema,
  discriminatorValue: 'mid',
  properties: {
    items: {
      kind: 'm:n',
      entity: () => 'BaseEntity',
      owner: true,
      pivotTable: 'base_entity_mid',
      joinColumn: 'mid_id',
      inverseJoinColumn: 'base_entity_id'
    },
    parentMid: { 
      kind: 'm:1', 
      entity: () => 'MidEntity', 
      nullable: true 
    },
    childMids: {
      kind: '1:m',
      entity: () => 'MidEntity',
      mappedBy: 'parentMid'
    }
  }
});

// ParentEntity schema extending MidSchema
export const ParentSchema = new EntitySchema<ParentEntity, MidEntity>({
  class: ParentEntity,
  extends: MidSchema,
  discriminatorValue: 'parent',
  properties: {
    elements: {
      kind: '1:m',
      entity: () => 'BaseEntity',
      mappedBy: 'parent'
    }
  }
});

export const BossSchema = new EntitySchema<BossEntity, ParentEntity>({
  class: BossEntity,
  extends: ParentSchema,
  discriminatorValue: 'boss',
  properties: {
    description: { type: 'string' },
  }
});
