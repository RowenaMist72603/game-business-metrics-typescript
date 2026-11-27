import { strict as assert } from "node:assert";
import { decideAssetPublication } from "./metrics_decision.ts";

const decision = decideAssetPublication({ assetCreations: 12, liveEventEntries: 4, moderationQueue: 8, moderationCapacity: 10 });
assert.equal(decision, "hold-for-moderation");
assert.equal(decideAssetPublication({ assetCreations: 3, liveEventEntries: 2, moderationQueue: 2, moderationCapacity: 10 }), "publish");
console.log("metrics decision test passed");
