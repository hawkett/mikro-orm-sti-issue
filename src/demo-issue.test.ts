import { MikroORM, EntitySchema } from '@mikro-orm/core';
import { SqliteDriver } from '@mikro-orm/sqlite';
import { BaseEntity, BaseSchema, MidSchema, ParentSchema } from './schema';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

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

// Timing helper function
function formatDuration(startTime: number): string {
  const duration = (Date.now() - startTime) / 1000; // Convert to seconds
  return duration.toFixed(2);
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

async function initializeSqliteOrm(
  contextName: string,
  entities: EntitySchema[]
): Promise<MikroORM<SqliteDriver>> {
  debugLog(`[${contextName}] Initializing ORM with ${entities.length} entities`);

  try {
    const orm = await MikroORM.init<SqliteDriver>({
      entities,
      dbName: ':memory:', // Use in-memory SQLite database
      driver: SqliteDriver,
      debug: true,
      logger: (msg) => debugLog(`[${contextName}] ${msg}`),
      allowGlobalContext: false,
      contextName,
      discovery: {
        warnWhenNoEntities: true,
        requireEntitiesArray: true,
        alwaysAnalyseProperties: false
      },
      metadataCache: {
        enabled: false
      }
    });

    // Refresh database schema
    debugLog(`[${contextName}] Refreshing database schema`);
    await orm.schema.refreshDatabase();

    return orm;
  } catch (error) {
    console.error(`[${contextName}] Error initializing ORM:`, error);
    throw error;
  }
}

describe('STI Performance Test', () => {
  beforeEach(() => {
    // Reset metadata tracking between tests
    previousMetadata = {};
  });

  it('should handle concurrent ORM instances with SQLite', async () => {
    debugLog('=== STARTING CONCURRENT ORM TEST (SQLite) ===');

    // Define schemas to use for both ORMs
    const schemas = [BaseSchema, MidSchema, ParentSchema];

    // First ORM - now using both schemas
    let orm1StartTime = Date.now();
    debugLog('--- Initializing first ORM ---');
    let orm1: MikroORM<SqliteDriver>;
    try {
      orm1 = await initializeSqliteOrm('orm1', schemas);
      debugLog('[DEBUG] First ORM initialized successfully');
      logDiscoveredEntities(orm1, 'orm1');

      // Create and persist a base entity
      const em1 = orm1.em.fork();
      const baseEntity1 = new BaseEntity();
      baseEntity1.name = 'Base Entity 1';
      await em1.persistAndFlush(baseEntity1);
      debugLog('[DEBUG] First base entity created and persisted');

      // Close first ORM
      await orm1.close();
      debugLog(`[DEBUG] First ORM closed - Total time: ${formatDuration(orm1StartTime)}s`);
    } catch (error) {
      console.error('[DEBUG] Error in first ORM:', error);
      throw error;
    }

    // Second ORM - using same schemas
    let orm2StartTime = Date.now();
    debugLog('--- Initializing second ORM ---');
    let orm2: MikroORM<SqliteDriver>;
    try {
      orm2 = await initializeSqliteOrm('orm2', schemas);
      debugLog('[DEBUG] Second ORM initialized successfully');
      logDiscoveredEntities(orm2, 'orm2');

      // Create and persist another base entity
      const em2 = orm2.em.fork();
      const baseEntity2 = new BaseEntity();
      baseEntity2.name = 'Base Entity 2';
      await em2.persistAndFlush(baseEntity2);
      debugLog('[DEBUG] Second base entity created and persisted');

      // Close second ORM
      await orm2.close();
      debugLog(`[DEBUG] Second ORM closed - Total time: ${formatDuration(orm2StartTime)}s`);
    } catch (error) {
      console.error('[DEBUG] Error in second ORM:', error);
      throw error;
    }

    // Third ORM - using same schemas
    let orm3StartTime = Date.now();
    debugLog('--- Initializing third ORM ---');
    let orm3: MikroORM<SqliteDriver>;
    try {
      orm3 = await initializeSqliteOrm('orm3', schemas);
      debugLog('[DEBUG] Third ORM initialized successfully');
      logDiscoveredEntities(orm3, 'orm3');

      // Create and persist another base entity
      const em3 = orm3.em.fork();
      const baseEntity3 = new BaseEntity();
      baseEntity3.name = 'Base Entity 3';
      await em3.persistAndFlush(baseEntity3);
      debugLog('[DEBUG] Third base entity created and persisted');

      // Close third ORM
      await orm3.close();
      debugLog(`[DEBUG] Third ORM closed - Total time: ${formatDuration(orm3StartTime)}s`);
    } catch (error) {
      console.error('[DEBUG] Error in third ORM:', error);
      throw error;
    }

    debugLog('=== CONCURRENT ORM TEST COMPLETED ===');
  }, 60000); // Increased timeout to 60 seconds
});
