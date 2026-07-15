import { appendTaskAudit, listTaskGraph, transitionTask } from "./maraTaskGraph.mjs";
import { listCalendar, persistCalendarEntry, resolveTaskSchedule } from "./maraDeterministicScheduler.mjs";

function invalidationReason(task,event) {
  if (event.eventType === "payment_received" && task.sourceCandidateTypes.includes("resolve_overdue_payment")) return "Payment was received.";
  if (event.eventType === "reply_received" && /monitor|await.*reply|follow.?up/i.test(`${task.title} ${task.reassessmentTrigger}`)) return "A reply changed the commercial state.";
  if (event.eventType === "deal_closed" && /assess|negotiate|opportunity/i.test(task.title)) return "The deal outcome superseded this work.";
  return null;
}

export async function reassessTaskGraph(store,{userId,workerId="mara",events=[],state={},planningTime=new Date().toISOString()}) {
  await store.execute("UPDATE agent_work_candidates SET status = 'expired' WHERE user_id = ? AND worker_id = ? AND expires_at IS NOT NULL AND expires_at <= ? AND status NOT IN ('expired','completed')",userId,workerId,planningTime);
  const tasks=await listTaskGraph(store,{userId,workerId}); const report={invalidated:[],expired:[],rescheduled:[],unchanged:[]};
  for (const task of tasks) {
    if (["completed","invalidated","expired","cancelled","superseded"].includes(task.status)) continue;
    const reason=events.map((event)=>invalidationReason(task,event)).find(Boolean);
    if (reason) { await transitionTask(store,{userId,workerId,taskId:task.id,toStatus:"invalidated",reason,metadata:{eventIds:events.map((e)=>e.id)}}); report.invalidated.push(task.id); continue; }
    if (task.expiresAt && new Date(task.expiresAt)<=new Date(planningTime)) { await transitionTask(store,{userId,workerId,taskId:task.id,toStatus:"expired",reason:"Task validity window ended."}); report.expired.push(task.id); continue; }
    if (events.some((event)=>event.eventType==="creator_availability_changed") && task.owner!=="mara") {
      await store.execute("UPDATE agent_task_calendar_entries SET status = 'cancelled', updated_at = ? WHERE task_id = ? AND status = 'scheduled'",planningTime,task.id);
      const existing=await listCalendar(store,{userId,workerId,calendarOwner:"creator"});
      const schedule=resolveTaskSchedule({...task,scheduledAt:null,scheduledWindow:"next available creator work block"},{planningTime,state,existingEntries:existing});
      await persistCalendarEntry(store,{userId,workerId,task,schedule});
      await appendTaskAudit(store,{userId,workerId,taskId:task.id,eventType:"rescheduled",reason:"Creator availability changed.",metadata:{schedule}}); report.rescheduled.push(task.id); continue;
    }
    report.unchanged.push(task.id);
  }
  return report;
}
