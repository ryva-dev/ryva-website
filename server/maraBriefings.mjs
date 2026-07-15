import { randomUUID } from "node:crypto";
import { ensureMaraRuntimeTables, json } from "./maraRuntimeStorage.mjs";

export async function createMaraBriefing(store,{userId,workerId="mara",periodStart,periodEnd}) {
  await ensureMaraRuntimeTables(store);
  const tasks=await store.query("SELECT id,title,task_kind,status,commercial_objective,output_json,completed_at FROM agent_tasks_v2 WHERE user_id = ? AND worker_id = ? AND updated_at >= ? AND updated_at <= ? ORDER BY updated_at DESC",userId,workerId,periodStart,periodEnd);
  const events=await store.query("SELECT id,event_type,occurred_at FROM agent_events WHERE user_id = ? AND worker_id = ? AND occurred_at >= ? AND occurred_at <= ? ORDER BY occurred_at DESC",userId,workerId,periodStart,periodEnd);
  const briefing={
    completed:tasks.filter((t)=>t.status==="completed"&&json(t.output_json,null)&&!["monitoring","waiting"].includes(t.task_kind)).map((t)=>({title:t.title,objective:t.commercial_objective,result:json(t.output_json,null)})),
    needsCreator:tasks.filter((t)=>["awaiting_creator_action","awaiting_approval","awaiting_information"].includes(t.status)).map((t)=>({title:t.title,status:t.status})),
    plannedNext:tasks.filter((t)=>["scheduled","ready","rescheduled"].includes(t.status)).map((t)=>({title:t.title,objective:t.commercial_objective})),
    blocked:tasks.filter((t)=>["blocked","failed","awaiting_external_event"].includes(t.status)).map((t)=>({title:t.title,status:t.status})),
    changed:events.map((e)=>({type:e.event_type,occurredAt:e.occurred_at})),
    commercialMovement:events.filter((e)=>/deal|payment|revenue|reply|deadline/.test(e.event_type)).map((e)=>({type:e.event_type,occurredAt:e.occurred_at})),
    corrections:tasks.filter((t)=>t.status==="failed").map((t)=>({title:t.title,status:t.status}))
  };
  const id=randomUUID(); await store.execute("INSERT INTO agent_briefings_v2 (id,user_id,worker_id,period_start,period_end,briefing_json,source_task_ids_json,source_event_ids_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)",id,userId,workerId,periodStart,periodEnd,JSON.stringify(briefing),JSON.stringify(tasks.map((t)=>t.id)),JSON.stringify(events.map((e)=>e.id)),new Date().toISOString());
  return {id,...briefing};
}
