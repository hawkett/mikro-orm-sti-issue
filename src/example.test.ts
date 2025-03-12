import { MikroORM, EntitySchema } from '@mikro-orm/core';
import { SqliteDriver } from '@mikro-orm/sqlite';
import { BaseEntity, BaseSchema, MidSchema, ParentSchema } from './schema';

let orm: MikroORM;

beforeAll(async () => {
  orm = await MikroORM.init({
    entities: [BaseSchema, MidSchema, ParentSchema],
    dbName: ':memory:',
    driver: SqliteDriver,
    debug: ['query', 'query-params'],
    allowGlobalContext: false
  });
  await orm.schema.refreshDatabase();
});

afterAll(async () => {
  await orm.close();
});

describe('STI Performance Test', () => {
  it('should initialize and use first ORM instance', async () => {
    const em1 = orm.em.fork();
    const baseEntity1 = new BaseEntity();
    baseEntity1.name = 'Base Entity 1';
    await em1.persistAndFlush(baseEntity1);

    const foundEntity = await em1.findOne(BaseEntity, { name: 'Base Entity 1' });
    expect(foundEntity).toBeDefined();
    expect(foundEntity?.name).toBe('Base Entity 1');
  }, 60000);

  it('should initialize and use second ORM instance', async () => {
    const em2 = orm.em.fork();
    const baseEntity2 = new BaseEntity();
    baseEntity2.name = 'Base Entity 2';
    await em2.persistAndFlush(baseEntity2);

    const foundEntity = await em2.findOne(BaseEntity, { name: 'Base Entity 2' });
    expect(foundEntity).toBeDefined();
    expect(foundEntity?.name).toBe('Base Entity 2');
  }, 60000);

  it('should initialize and use third ORM instance', async () => {
    const em3 = orm.em.fork();
    const baseEntity3 = new BaseEntity();
    baseEntity3.name = 'Base Entity 3';
    await em3.persistAndFlush(baseEntity3);

    const foundEntity = await em3.findOne(BaseEntity, { name: 'Base Entity 3' });
    expect(foundEntity).toBeDefined();
    expect(foundEntity?.name).toBe('Base Entity 3');
  }, 60000);
});
