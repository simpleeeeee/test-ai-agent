import fs from "node:fs";
import path from "node:path";

export type ModelCapabilities = {
  model: string;
  supportsThinking: boolean;
  supportsJsonSchema: boolean;
  supportsPromptCaching: boolean;
  maxContextWindow: number;
  supportsToolUse: boolean;
  detectedAt: number;
  detectionMethod: "probe" | "heuristic" | "manual";
};

type CacheEntry = {
  caps: ModelCapabilities;
  storedAt: number;
};

const TTL_MS = 24 * 60 * 60 * 1000; // 24 小时

let capabilitiesCache: Map<string, CacheEntry> | null = null;

function getCache(): Map<string, CacheEntry> {
  if (!capabilitiesCache) {
    capabilitiesCache = new Map();
  }
  return capabilitiesCache;
}

function cacheFilePath(cwd: string) {
  return path.join(cwd, ".claude", "model-capabilities.json");
}

export function loadCapabilitiesCache(cwd: string): void {
  try {
    const raw = fs.readFileSync(cacheFilePath(cwd), "utf8");
    const data = JSON.parse(raw);
    if (data?.entries) {
      const cache = getCache();
      for (const [model, caps] of Object.entries(data.entries)) {
        cache.set(model, { caps: caps as ModelCapabilities, storedAt: Date.now() });
      }
    }
  } catch { /* file missing or corrupt, ignore */ }
}

export function saveCapabilitiesCache(cwd: string): void {
  const cache = getCache();
  if (cache.size === 0) return;
  const entries: Record<string, ModelCapabilities> = {};
  for (const [model, entry] of cache) {
    entries[model] = entry.caps;
  }
  const dir = path.dirname(cacheFilePath(cwd));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(cacheFilePath(cwd), JSON.stringify({ version: 1, entries }, null, 2), "utf8");
}

export function clearCapabilitiesCache(): void {
  capabilitiesCache = null;
}

function makeConservativeDefaults(model: string): ModelCapabilities {
  return {
    model,
    supportsThinking: false,
    supportsJsonSchema: false,
    supportsPromptCaching: false,
    maxContextWindow: 128000,
    supportsToolUse: false,
    detectedAt: Date.now(),
    detectionMethod: "heuristic",
  };
}

export async function detectModelCapabilities(
  sdk: { query: (...args: any[]) => any },
  model: string,
): Promise<ModelCapabilities> {
  const cache = getCache();

  // 检查缓存
  const cached = cache.get(model);
  if (cached && Date.now() - cached.storedAt < TTL_MS) {
    return cached.caps;
  }

  try {
    // 并行探测 tool use 和 thinking
    const [toolUseOk, thinkingOk] = await Promise.all([
      // 探测 tool use：发送最小查询（max_turns: 1）
      (async (): Promise<boolean> => {
        try {
          await sdk.query({
            prompt: "ping",
            options: { max_turns: 1 },
          });
          return true;
        } catch {
          return false;
        }
      })(),
      // 探测 thinking：发送带 thinking 配置的查询
      (async (): Promise<boolean> => {
        try {
          await sdk.query({
            prompt: "ping",
            options: {
              max_turns: 1,
              thinking: { type: "enabled", budgetTokens: 1024 },
            },
          });
          return true;
        } catch {
          return false;
        }
      })(),
    ]);

    // 如果所有探测都失败，回退到保守默认值
    if (!toolUseOk && !thinkingOk) {
      const caps = makeConservativeDefaults(model);
      cache.set(model, { caps, storedAt: Date.now() });
      return caps;
    }

    const caps: ModelCapabilities = {
      model,
      supportsToolUse: toolUseOk,
      supportsThinking: thinkingOk,
      supportsJsonSchema: false,
      supportsPromptCaching: false,
      maxContextWindow: 200000,
      detectedAt: Date.now(),
      detectionMethod: "probe",
    };

    cache.set(model, { caps, storedAt: Date.now() });
    return caps;
  } catch {
    // 如果 Promise.all 本身抛错（不太可能，因为内部已 catch），回退到保守默认值
    const caps = makeConservativeDefaults(model);
    cache.set(model, { caps, storedAt: Date.now() });
    return caps;
  }
}
