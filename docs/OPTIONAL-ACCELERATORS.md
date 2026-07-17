# Optional accelerators

ArtifactGraph may accelerate Testkit coverage and search, but its absence must
never stop a tests or FE workflow. Each run:

1. assigns one stable `runId`;
2. completes deterministic local coverage/search when ArtifactGraph is missing;
3. counts successful file reads and exact raw bytes returned as context;
4. emits one `testkit.missing-optional` event for the `runId` + optional pair
   after fallback; and
5. deduplicates retries for that pair.

The event schema is
[`schemas/missing-optional-event.schema.json`](../schemas/missing-optional-event.schema.json)
and installs at
`.cursor/schemas/testkit/missing-optional-event.schema.json`.
`fileReads` includes each successful read, including repeated reads.
`contextBytes` sums the byte length of the contents actually read. A fallback
that reads no files reports zero for both metrics. Never estimate token counts,
file reads, bytes, or savings.

```json
{
  "schemaVersion": "1.0.0",
  "event": "testkit.missing-optional",
  "package": "@platform/testkit",
  "runId": "testkit-2026-07-17T14:00:00Z",
  "optional": "artifactgraph",
  "reason": "unavailable",
  "fallback": "local-deterministic-coverage",
  "metrics": {
    "fileReads": 4,
    "contextBytes": 1832
  }
}
```
