import { CLUSTER_NODE_MAP } from '@/engine/topology/clusterTopology';
import type { ClusterTelemetrySnapshot } from '@/types/telemetry';
import type { ServiceId } from '@/types/topology';
import type { PredictionResult } from '@/types/prediction';
import { analyzeClusterLocally } from '@/engine/analysis/AnomalyDetector';
import { OpenRouterKeyRotator } from './OpenRouterKeyRotator';
import { buildSystem1UserPrompt, SYSTEM1_SYSTEM_PROMPT } from './system1Prompts';

const MODELS = [
  'inception/mercury-decide:free',
  'liquid/lfm-2.5-2.6b:free',
] as const;

export class System1Client {
  constructor(private readonly rotator: OpenRouterKeyRotator) {}

  async analyzeCluster(
    snapshot: ClusterTelemetrySnapshot,
    localFallback?: PredictionResult,
    suppliedZScores?: Map<ServiceId, number>
  ): Promise<PredictionResult> {
    const localAnalysis = analyzeClusterLocally(snapshot);
    const local = localFallback ?? localAnalysis.prediction;
    if (!local.anomalyDetected) return local;

    const zScores = suppliedZScores ?? localAnalysis.zScores;

    const prompt = buildSystem1UserPrompt(snapshot, zScores);
    let selectedModel: string | undefined;
    const result = await this.rotator.executeWithRetry(async (apiKey) => {
      let lastError: Error | null = null;
      for (const model of MODELS) {
        try {
          const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://orcathon.crashlens.dev',
              'X-Title': 'CrashLens SRE Radar',
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: 'system', content: SYSTEM1_SYSTEM_PROMPT },
                { role: 'user', content: prompt },
              ],
              temperature: 0.1,
              max_tokens: 300,
              response_format: { type: 'json_object' },
            }),
            signal: AbortSignal.timeout(3000),
          });
          if (!response.ok) {
            const error = new Error(`OpenRouter request failed (${response.status})`);
            Object.assign(error, { status: response.status });
            lastError = error;
            continue;
          }
          const payload: unknown = await response.json();
          const content = readModelContent(payload);
          const prediction = content ? validatePrediction(content) : null;
          if (prediction) {
            selectedModel = model;
            return prediction;
          }
          lastError = new Error('OpenRouter returned invalid prediction JSON');
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
        }
      }
      throw lastError ?? new Error('OpenRouter models unavailable');
    });

    return result.data
      ? { ...result.data, model: selectedModel }
      : { ...local, source: 'TIER_0_LOCAL_DETERMINISTIC' };
  }
}

function readModelContent(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const choices = (payload as { choices?: Array<{ message?: { content?: unknown } }> }).choices;
  const content = choices?.[0]?.message?.content;
  return typeof content === 'string' ? content : null;
}

function validatePrediction(content: string): PredictionResult | null {
  try {
    const jsonText = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const value: unknown = JSON.parse(jsonText);
    if (!value || typeof value !== 'object') return null;
    const raw = value as Record<string, unknown>;
    const root = raw.rootCauseService;
    if (typeof root !== 'string' || !(root in CLUSTER_NODE_MAP)) return null;
    const target = raw.recommendedAction;
    if (!target || typeof target !== 'object') return null;
    const action = target as Record<string, unknown>;
    if (
      typeof raw.anomalyDetected !== 'boolean' ||
      typeof raw.confidence !== 'number' ||
      !Number.isFinite(raw.confidence) ||
      typeof raw.failureMode !== 'string' ||
      typeof raw.timeToCriticalSec !== 'number' ||
      !Array.isArray(raw.blastRadiusServices) ||
      typeof action.actionId !== 'string' ||
      typeof action.title !== 'string' ||
      typeof action.targetService !== 'string' ||
      !(action.targetService in CLUSTER_NODE_MAP) ||
      typeof action.estimatedRiskReductionPct !== 'number'
    ) return null;

    const parameters = action.parameters && typeof action.parameters === 'object'
      ? Object.fromEntries(Object.entries(action.parameters).filter(([, item]) =>
          typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean'))
      : {};
    const blastRadiusServices = raw.blastRadiusServices.filter(
      (id): id is ServiceId => typeof id === 'string' && id in CLUSTER_NODE_MAP
    );
    return {
      source: 'SYSTEM_1_AI',
      anomalyDetected: raw.anomalyDetected,
      confidence: Math.max(0, Math.min(1, raw.confidence)),
      rootCauseService: root as ServiceId,
      failureMode: raw.failureMode.slice(0, 80),
      timeToCriticalSec: Math.max(0, Math.min(300, raw.timeToCriticalSec)),
      blastRadiusServices,
      recommendedAction: {
        actionId: action.actionId.slice(0, 80),
        title: action.title.slice(0, 160),
        targetService: action.targetService as ServiceId,
        parameters,
        estimatedRiskReductionPct: Math.max(0, Math.min(100, action.estimatedRiskReductionPct)),
      },
    };
  } catch {
    return null;
  }
}
