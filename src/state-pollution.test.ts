import { MikroORM } from '@mikro-orm/core';
import { SqliteDriver } from '@mikro-orm/sqlite';
import { BaseEntity, BaseSchema, BossSchema, MidSchema, ParentSchema } from './schema';


describe('pollution test', () => {
  it('should not pollute second orm', async () => {

    /* Bigger schema */
    const ormLocal = await MikroORM.init({
      entities: [BaseSchema, MidSchema, ParentSchema, BossSchema],
      dbName: ':memory:',
      driver: SqliteDriver,
      debug: ['query', 'query-params'],
      allowGlobalContext: false
    });
    await ormLocal.schema.refreshDatabase();
    const em1 = ormLocal.em.fork();
    const baseEntity1 = new BaseEntity();
    baseEntity1.name = 'Base Entity 1';
    await em1.persistAndFlush(baseEntity1);

    const foundEntity = await em1.findOne(BaseEntity, { name: 'Base Entity 1' });
    expect(foundEntity).toBeDefined();
    expect(foundEntity?.name).toBe('Base Entity 1');

    await ormLocal.close();

    console.log('Closed first')

    /* Smaller schema */
    const ormLocal2 = await MikroORM.init({
      entities: [BaseSchema, MidSchema, ParentSchema],
      dbName: ':memory:',
      driver: SqliteDriver,
      debug: ['query', 'query-params'],
      allowGlobalContext: false
    });
    const em2 = ormLocal2.em.fork();
    const baseEntity2 = new BaseEntity();
    baseEntity2.name = 'Base Entity 2';
    await em2.persistAndFlush(baseEntity2);

    const foundEntity2 = await em2.findOne(BaseEntity, { name: 'Base Entity 2' });
    expect(foundEntity2).toBeDefined();
    expect(foundEntity2?.name).toBe('Base Entity 2');

    await ormLocal2.close();
  })
});
