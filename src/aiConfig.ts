// ============================================================
// AI 配置（API Key / 接口地址 / 模型）
//
// 存储在 localStorage，而不是 data.json —— data.json 会被同步到
// WPS 云文档等共享文件夹，API Key 不应随之外泄。
// ============================================================

export interface AiConfig {
  apiKey: string;
  endpoint: string;
  model: string;
}

const STORAGE_KEY = 'wjl-ai-config';

export const DEFAULT_AI_CONFIG: AiConfig = {
  apiKey: '',
  endpoint: 'https://api.deepseek.com',
  model: 'deepseek-chat',
};

export function loadAiConfig(): AiConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_AI_CONFIG };
    const parsed = JSON.parse(raw) as Partial<AiConfig>;
    return {
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      endpoint:
        typeof parsed.endpoint === 'string' && parsed.endpoint
          ? parsed.endpoint
          : DEFAULT_AI_CONFIG.endpoint,
      model:
        typeof parsed.model === 'string' && parsed.model
          ? parsed.model
          : DEFAULT_AI_CONFIG.model,
    };
  } catch {
    return { ...DEFAULT_AI_CONFIG };
  }
}

export function saveAiConfig(config: AiConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

/** 后端请求体使用的字段名（snake_case），与 scripts/polish.py 保持一致。 */
export function aiConfigPayload(): {
  api_key: string;
  endpoint: string;
  model: string;
} {
  const c = loadAiConfig();
  return { api_key: c.apiKey, endpoint: c.endpoint, model: c.model };
}
