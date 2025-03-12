# Overview

`demo-issue.test.ts` contains a single test that attempts to open and close 3 orm instances, but eventualy hangs on the third instance, seemingly due to an exponential slowdown in STI initialization over sucessive orm instances, potentially caused by global state pollution of some sort.

Note that `demo-issue.test.ts` demonstrates the issue by *sequentially creating and closing* three orm instances connecting to the *same* database. The original issue was encountered while attempting to create multiple *concurrent* orm instances connecting to *different* databases using the same schema. Example of concurrent usage would be reading from one database and then writing to another where the databases have the *same schema*.

`example.test.ts` shows that the same tests work fine when using the same orm instance to execute the three tests.

Schema consists of three entities in an inheritance chain with somewhat complex releationships. This appears to be the minimal structure to demonstrate the issue.

`BaseEntity <- MidEntity <- ParentEntity`

A similar (simpler) exmaple of this type of data structure is a filesystem where directories are files (inheritance) that contain files (and therefore also directories). The addition of the MidEntity adds complexity with a M-M relationship.

## Notes

```
npm install
npm run test
```

This will run `demo-issue.test.ts`, which is a single test that hangs due to an exponential slowdown in STI initialization over sucessive orm instances, potentially caused by global state pollution of some sort.

Key log lines:

*orm1*

```
[DEBUG] First ORM closed - Total time: 0.05s
```

*orm2*
- property and relationship comparison is versus orm1, and demonstrates potential pollution.
- total execution time is *much* longer (> 200x) for the same test as orm1
```
MidEntity: +2 properties (BaseEntity_items__inverse, ParentEntity_items__inverse)
MidEntity: +2 relationships
ParentEntity: +2 properties (BaseEntity_items__inverse, ParentEntity_items__inverse)
ParentEntity: +2 relationships
[DEBUG] Second ORM closed - Total time: 11.60s
```

*orm3*
```
<Does not complete discovery in reasonable time>
```
