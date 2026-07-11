/**
 * Runtime configuration for the ScenarioLab MCP server (read-only, Phase 1a).
 * All values come from environment variables so no secrets live in the repo.
 */

export interface ServerConfig {
  projectId: string;
  ownerUid: string;
  serviceAccountPath: string;
}

/**
 * Read and validate configuration. Throws with an actionable message if a
 * required value is missing (surfaced at startup so the operator can fix it).
 */
export function loadConfig(): ServerConfig {
  const projectId = process.env.SCENARIOLAB_PROJECT_ID?.trim() || 'scenario-lab-studio';
  const ownerUid = process.env.SCENARIOLAB_OWNER_UID?.trim() || '';
  const serviceAccountPath =
    process.env.SCENARIOLAB_SERVICE_ACCOUNT?.trim() ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ||
    '';

  const missing: string[] = [];
  if (!ownerUid) missing.push('SCENARIOLAB_OWNER_UID（自分の Firebase Auth UID）');
  if (!serviceAccountPath) {
    missing.push(
      'SCENARIOLAB_SERVICE_ACCOUNT または GOOGLE_APPLICATION_CREDENTIALS（サービスアカウント鍵の絶対パス）',
    );
  }
  if (missing.length > 0) {
    throw new Error(
      `必須の環境変数が未設定です:\n- ${missing.join('\n- ')}\n` +
        `README.md の「セットアップ」を参照してください。`,
    );
  }

  return { projectId, ownerUid, serviceAccountPath };
}
