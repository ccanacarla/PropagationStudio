function inject(region, requested) {
  if (!region || region.susceptible <= 0) return 0;
  const count = Math.max(0, Math.min(Math.round(Number(requested) || 0), region.susceptible));
  region.susceptible -= count; region.infected += count;
  region.newInfections = (region.newInfections || 0) + count;
  region.importedInfections = (region.importedInfections || 0) + count;
  return count;
}

function dueDuring(t, event) {
  const start = Math.max(0, Math.floor(Number(event.startTime) || 0));
  const duration = Math.max(1, Math.floor(Number(event.duration) || 1));
  return t >= start && t < start + duration;
}

export function applyScheduledEvents(t, currentFrame, propagation, prng, eventLog) {
  const next = new Map();
  for (const [id, region] of currentFrame) {
    next.set(id, { ...region, activeOrigin:false, activeOriginId:null, activeFocus:false, activeFocusId:null, receivedJump:false, receivedJumpId:null, externalEventIds:[...(region.externalEventIds || [])] });
  }
  for (const origin of propagation.origins || []) {
    if (origin.enabled === false || !dueDuring(t, origin)) continue;
    const region = next.get(origin.regionId); const count = inject(region, origin.infectedCount);
    if (count > 0) { region.activeOrigin=true; region.activeOriginId=origin.id; region.externalEventIds.push(origin.id); eventLog.push({time:t,type:'origin_injected',originId:origin.id,regionId:origin.regionId,infectedCount:count}); }
  }
  for (const focus of propagation.focuses || []) {
    if (focus.enabled === false || !dueDuring(t, focus)) continue;
    const region = next.get(focus.regionId); const count = inject(region, focus.infectedCount);
    if (count > 0) { region.activeFocus=true; region.activeFocusId=focus.id; region.externalEventIds.push(focus.id); eventLog.push({time:t,type:'focus_injected',focusId:focus.id,regionId:focus.regionId,infectedCount:count}); }
  }
  for (const jump of propagation.jumps || []) {
    if (jump.enabled === false) continue;
    const start = Math.max(0, Math.floor(Number(jump.startTime) || 0));
    const interval = Math.max(1, Math.floor(Number(jump.interval) || 1));
    const due = jump.recurring ? t >= start && (t-start)%interval===0 : t===start;
    if (!due) continue;
    const source=next.get(jump.sourceRegionId), target=next.get(jump.targetRegionId);
    if (!source || !target || source.infected<=0) { eventLog.push({time:t,type:'jump_skipped',jumpId:jump.id,reason:'source_without_infected'}); continue; }
    const probability=Math.max(0,Math.min(1,Number(jump.probability) || 0));
    if (prng.next()>probability) { eventLog.push({time:t,type:'jump_skipped',jumpId:jump.id,reason:'probability'}); continue; }
    const count=inject(target, Math.min(Number(jump.infectedCount)||0, source.infected));
    if (count>0) { target.receivedJump=true;target.receivedJumpId=jump.id;target.externalEventIds.push(jump.id);eventLog.push({time:t,type:'jump_executed',jumpId:jump.id,sourceRegionId:jump.sourceRegionId,targetRegionId:jump.targetRegionId,infectedIntroduced:count}); }
  }
  return next;
}
