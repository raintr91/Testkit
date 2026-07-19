export { createServer } from './mcp/server.js'
export {
  AGENT_IDS,
  agentConfigPath,
  chooseAgentTargets,
  detectAgents,
  installAgents,
  parseAgentTargets,
  uninstallAgents,
  type AgentId,
} from './install/agents.js'
export {
  INSTALL_MANIFEST_PATH,
  installHarness,
  pruneHarness,
  SKILLS_BY_TYPE,
  statusHarness,
  uninstallHarness,
  type HarnessCompatibility,
  type HarnessStatus,
  type InstallManifest,
  type InstallManifestFile,
  type PruneHarnessResult,
  type UninstallHarnessResult,
} from './install/harness.js'
export {
  discoverInstalls,
  forgetInstall,
  ledgerPath,
  readLedger,
  recordInstall,
  removeLedger,
  stateDir,
} from './install/ledger.js'
export {
  TESTKIT_PACKAGE_SCRIPTS,
  canonicalGitignorePattern,
  ensureGitignoreEntries,
  generatedTargets,
  managedRepoStatus,
  removeManagedRepoFiles,
  syncManagedRepoFiles,
  type ManagedRepoFiles,
} from './install/managed-files.js'
export {
  wirePlatformDnaCodegraph,
  type PlatformDnaWireResult,
} from './install/platform-dna.js'
export { runEngine } from './engines/run.js'
export {
  MissingOptionalEventEmitter,
  OPTIONAL_FALLBACK_EVENT,
  OPTIONAL_FALLBACK_SCHEMA_VERSION,
  ReadMeasurement,
  TESTKIT_PACKAGE,
  validateMissingOptionalEvent,
  type MissingOptionalEvent,
  type MissingOptionalInput,
  type OptionalFallbackMode,
  type OptionalFallbackReason,
  type ReadMetrics,
} from './optional/fallback-evidence.js'
