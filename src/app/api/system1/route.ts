import { NextResponse } from 'next/server';
import { OpenRouterKeyRotator } from '@/engine/ai/OpenRouterKeyRotator';
import { System1Client } from '@/engine/ai/System1Client';
import type { ClusterTelemetrySnapshot } from '@/types/telemetry';
import type { PredictionResult } from '@/types/prediction';
import type { ServiceId } from '@/types/topology';
import { CLUSTER_NODE_MAP } from '@/engine/topology/clusterTopology';

export const runtime = 'nodejs';

const rotator = new OpenRouterKeyRotator();
const client = new System1Client(rotator);
let requestWindowStartedAt = Date.now();
let requestCount = 0;

export async function GET() {
  return NextResponse.json({ status: rotator.getPublicStatus() });
}

export async function POST(request: Request) {
  try {
    const now = Date.now();
    if (now - requestWindowStartedAt >= 60_000) {
      requestWindowStartedAt = now;
      requestCount = 0;
    }
    requestCount++;
    if (requestCount > 60) {
      return NextResponse.json({ error: 'System 1 request limit exceeded' }, { status: 429 });
    }
    const origin = request.headers.get('origin');
    if (origin) {
      const originUrl = new URL(origin);
      const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0].trim();
      const requestHost = (forwardedHost ?? request.headers.get('host'))?.toLowerCase();
      const forwardedProtocol = request.headers.get('x-forwarded-proto')?.split(',')[0].trim();
      const requestProtocol = forwardedProtocol
        ? `${forwardedProtocol}:`
        : new URL(request.url).protocol;
      if (
        (requestHost && originUrl.host.toLowerCase() !== requestHost) ||
        originUrl.protocol !== requestProtocol
      ) {
        return NextResponse.json({ error: 'Cross-origin requests are not allowed' }, { status: 403 });
      }
    }
    const contentLength = Number(request.headers.get('content-length') ?? 0);
    if (contentLength > 64 * 1024) {
      return NextResponse.json({ error: 'Telemetry payload is too large' }, { status: 413 });
    }
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const input = body as {
      snapshot?: ClusterTelemetrySnapshot;
      fallback?: PredictionResult;
      zScores?: Array<[string, number]>;
      apiKeys?: [string, string, string];
    };
    if (
      !input.snapshot ||
      !input.snapshot.nodes ||
      typeof input.snapshot.timestamp !== 'number' ||
      typeof input.snapshot.tick !== 'number'
    ) {
      return NextResponse.json({ error: 'Invalid telemetry snapshot' }, { status: 400 });
    }
    const validApiKeys =
      Array.isArray(input.apiKeys) &&
      input.apiKeys.length === 3 &&
      input.apiKeys.every((key) => typeof key === 'string') &&
      input.apiKeys.some(Boolean);
    if (input.apiKeys !== undefined && !validApiKeys) {
      return NextResponse.json({ error: 'apiKeys must contain three non-empty string slots' }, { status: 400 });
    }
    const requestRotator = validApiKeys
      ? new OpenRouterKeyRotator({ keys: input.apiKeys })
      : rotator;
    const requestClient = requestRotator === rotator ? client : new System1Client(requestRotator);
    const zScores = Array.isArray(input.zScores)
      ? new Map(input.zScores.filter((entry): entry is [ServiceId, number] =>
          Array.isArray(entry) &&
          typeof entry[0] === 'string' &&
          Number.isFinite(entry[1])
        ))
      : undefined;
    const fallback = isSafeFallback(input.fallback) ? input.fallback : undefined;
    const prediction = await requestClient.analyzeCluster(input.snapshot, fallback, zScores);
    return NextResponse.json({ prediction, status: requestRotator.getPublicStatus() });
  } catch (error) {
    console.error('[SYSTEM1_ROUTE_ERROR]', error);
    return NextResponse.json({ error: 'System 1 analysis failed' }, { status: 500 });
  }
}

function isSafeFallback(value: unknown): value is PredictionResult {
  if (!value || typeof value !== 'object') return false;
  const prediction = value as Record<string, unknown>;
  const root = prediction.rootCauseService;
  const rawAction = prediction.recommendedAction;
  if (!rawAction || typeof rawAction !== 'object') return false;
  const action = rawAction as Record<string, unknown>;
  const targetService = action.targetService;
  return (
    prediction.source === 'TIER_0_LOCAL_DETERMINISTIC' &&
    prediction.anomalyDetected === true &&
    typeof prediction.confidence === 'number' &&
    Number.isFinite(prediction.confidence) &&
    typeof root === 'string' &&
    root in CLUSTER_NODE_MAP &&
    typeof prediction.failureMode === 'string' &&
    typeof prediction.timeToCriticalSec === 'number' &&
    Number.isFinite(prediction.timeToCriticalSec) &&
    Array.isArray(prediction.blastRadiusServices) &&
    prediction.blastRadiusServices.every((id) => typeof id === 'string' && id in CLUSTER_NODE_MAP) &&
    typeof action.actionId === 'string' &&
    typeof action.title === 'string' &&
    typeof targetService === 'string' &&
    targetService in CLUSTER_NODE_MAP &&
    typeof action.estimatedRiskReductionPct === 'number'
  );
}
