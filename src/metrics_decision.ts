export type GameSnapshot = {
  assetCreations: number;
  liveEventEntries: number;
  moderationQueue: number;
  moderationCapacity: number;
};

export type BusinessDecision = "publish" | "hold-for-moderation";

export function decideAssetPublication(snapshot: GameSnapshot): BusinessDecision {
  const queuePressure = snapshot.moderationQueue / snapshot.moderationCapacity;
  const demand = snapshot.assetCreations + snapshot.liveEventEntries;
  return queuePressure >= 0.8 || demand === 0 ? "hold-for-moderation" : "publish";
}

export function metricReport(snapshot: GameSnapshot, idempotencyKey: string) {
  return [
      { name: "game.asset_creations", type: "counter", value: snapshot.assetCreations },
      { name: "game.live_event_entries", type: "counter", value: snapshot.liveEventEntries },
      { name: "game.moderation_queue", type: "gauge", value: snapshot.moderationQueue }
    ].map((metric, index) => ({ ...metric, idempotency_key: `${idempotencyKey}-${index}` }));
}
