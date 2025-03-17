import { MikroORM } from '@mikro-orm/core';
import { SqliteDriver } from '@mikro-orm/sqlite';
import { BaseEntity, BaseSchema, BossSchema, MidSchema, ParentSchema } from './schema';

// Store metadata from previous ORM instances
type EntityMetadataSnapshot = {
  className: string;
  properties: string[];
  relationships: string[];
};
let previousMetadata: Record<string, EntityMetadataSnapshot> = {};

// Timestamp tracking
let lastLogTime = Date.now();
function debugLog(message: string) {
  const now = Date.now();
  const diff = now - lastLogTime;
  console.log(`[${new Date(now).toISOString()}] (+${diff}ms) ${message}`);
  lastLogTime = now;
}

// Helper function to log discovered entities and compare with previous instance
function logDiscoveredEntities(orm: MikroORM, contextName: string) {
  const metadata = orm.getMetadata();
  const discoveredEntities = metadata.getAll();
  
  const currentMetadata = Object.entries(discoveredEntities).map(([name, meta]) => ({
    className: name,
    properties: Object.keys(meta.properties),
    relationships: Object.keys(meta.relations)
  }));

  debugLog(`[${contextName}] Discovered entities:`);
  debugLog(JSON.stringify(currentMetadata, null, 2));

  // Compare with previous metadata if it exists
  if (Object.keys(previousMetadata).length > 0) {
    const differences: string[] = [];
    
    currentMetadata.forEach(current => {
      const previous = previousMetadata[current.className];
      if (previous) {
        // Check for new properties
        const newProps = current.properties.filter(p => !previous.properties.includes(p));
        if (newProps.length > 0) {
          differences.push(`${current.className}: +${newProps.length} properties (${newProps.join(', ')})`);
        }

        // Check for relationship count changes
        const relDiff = current.relationships.length - previous.relationships.length;
        if (relDiff !== 0) {
          differences.push(`${current.className}: ${relDiff > 0 ? '+' : ''}${relDiff} relationships`);
        }
      }
    });

    if (differences.length > 0) {
      debugLog(`[${contextName}] Changes from previous ORM instance:`);
      differences.forEach(diff => debugLog(`  - ${diff}`));
    }
  }

  // Store current metadata for next comparison
  previousMetadata = currentMetadata.reduce((acc, meta) => {
    acc[meta.className] = meta;
    return acc;
  }, {} as Record<string, EntityMetadataSnapshot>);
}


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
    logDiscoveredEntities(ormLocal, 'ormLocal');
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
    logDiscoveredEntities(ormLocal2, 'ormLocal2');
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
