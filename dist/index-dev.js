// index-dev.js
import { Motia, initIII } from "motia";

// src/triage-ticket.step.ts
import { api, queue, cron, step } from "motia";
import { z } from "zod";
var ticketEventSchema = z.object({
  ticketId: z.string(),
  title: z.string(),
  priority: z.string(),
  customerEmail: z.string()
});
var manualTriageSchema = z.object({
  ticketId: z.string(),
  assignee: z.string(),
  priority: z.enum(["low", "medium", "high", "critical"])
});
async function triageTicket(ticketId, existing, stateUpdates, enqueueData, ctx) {
  if (existing) {
    await ctx.state.set("tickets", ticketId, {
      ...existing,
      triagedAt: (/* @__PURE__ */ new Date()).toISOString(),
      ...stateUpdates
    });
    await ctx.enqueue({ topic: "ticket::triaged", data: { ticketId, ...enqueueData } });
  }
}
var stepConfig = {
  name: "TriageTicket",
  description: "Multi-trigger: auto-triage from queue, manual triage via API, sweep via cron",
  flows: ["support-ticket-flow"],
  triggers: [
    queue("ticket::created", { input: ticketEventSchema }),
    api("POST", "/tickets/triage", {
      bodySchema: manualTriageSchema,
      responseSchema: {
        200: z.object({
          ticketId: z.string(),
          assignee: z.string(),
          status: z.string()
        }),
        404: z.object({ error: z.string() })
      }
    }),
    cron("0 */5 * * * * *")
    // every 5 minutes
  ],
  enqueues: ["ticket::triaged"]
};
var { config, handler } = step(stepConfig, async (input, ctx) => {
  return ctx.match({
    queue: async (queueInput) => {
      const { ticketId, title, priority } = queueInput;
      ctx.logger.info("Auto-triaging ticket from queue", { ticketId, priority });
      const assignee = priority === "critical" || priority === "high" ? "senior-support" : "support-pool";
      const existing = await ctx.state.get("tickets", ticketId);
      await triageTicket(ticketId, existing, { assignee, triageMethod: "auto" }, { assignee, priority, title }, ctx);
      ctx.logger.info("Ticket auto-triaged", { ticketId, assignee });
    },
    http: async (request) => {
      const { ticketId, assignee, priority } = request.body;
      const existing = await ctx.state.get("tickets", ticketId);
      if (!existing) {
        return { status: 404, body: { error: `Ticket ${ticketId} not found` } };
      }
      ctx.logger.info("Manual triage via API", { ticketId, assignee });
      await triageTicket(ticketId, existing, { assignee, priority, triageMethod: "manual" }, { assignee, priority, title: existing.title }, ctx);
      return { status: 200, body: { ticketId, assignee, status: "triaged" } };
    },
    cron: async () => {
      ctx.logger.info("Running untriaged ticket sweep.");
      const allTickets = await ctx.state.list("tickets");
      let swept = 0;
      for (const ticket of allTickets) {
        if (!ticket.assignee && ticket.status === "open") {
          ctx.logger.warn("Found untriaged ticket during sweep", { ticketId: ticket.id });
          await triageTicket(
            ticket.id,
            ticket,
            { assignee: "support-pool", triageMethod: "auto-sweep" },
            { assignee: "support-pool", priority: ticket.priority || "medium", title: ticket.title || "unknown" },
            ctx
          );
          swept++;
        }
      }
      ctx.logger.info("Sweep complete", { sweptCount: swept });
    }
  });
});

// src/sla-monitor.step.ts
var SLA_THRESHOLDS_MS = {
  critical: 15 * 60 * 1e3,
  // 15 minutes
  high: 60 * 60 * 1e3,
  // 1 hour
  medium: 4 * 60 * 60 * 1e3,
  // 4 hours
  low: 24 * 60 * 60 * 1e3
  // 24 hours
};
var config2 = {
  name: "SlaMonitor",
  description: "Cron job that checks for SLA breaches on open tickets",
  flows: ["support-ticket-flow"],
  triggers: [
    {
      type: "cron",
      expression: "0/30 * * * * *"
      // every 30 seconds, iii has granularity down to the seconds position
    }
  ],
  enqueues: ["ticket::sla-breached"]
};
var handler2 = async (_, { state, logger, enqueue }) => {
  logger.info("Running SLA compliance check");
  const tickets = await state.list("tickets");
  const now = Date.now();
  let breaches = 0;
  for (const ticket of tickets) {
    if (ticket.status !== "open" || !ticket.createdAt) continue;
    const age = now - new Date(ticket.createdAt).getTime();
    const threshold = SLA_THRESHOLDS_MS[ticket.priority] ?? SLA_THRESHOLDS_MS.medium;
    if (age > threshold) {
      breaches++;
      logger.warn("SLA breach detected!", {
        ticketId: ticket.id,
        priority: ticket.priority,
        ageMinutes: Math.round(age / 6e4)
      });
      await enqueue({
        topic: "ticket::sla-breached",
        data: {
          ticketId: ticket.id,
          priority: ticket.priority,
          title: ticket.title,
          ageMinutes: Math.round(age / 6e4)
        }
      });
    }
  }
  logger.info("SLA check complete", { totalTickets: tickets.length, breaches });
  return {
    status: 200,
    body: {
      totalTickets: tickets.length,
      breaches
    }
  };
};

// src/notify-customer.step.ts
import { z as z2 } from "zod";
var triagedSchema = z2.object({
  ticketId: z2.string(),
  assignee: z2.string(),
  priority: z2.string(),
  title: z2.string()
});
var config3 = {
  name: "NotifyCustomer",
  description: "Sends a notification when a ticket has been triaged",
  flows: ["support-ticket-flow"],
  triggers: [
    {
      type: "queue",
      topic: "ticket::triaged",
      input: triagedSchema
    }
  ],
  enqueues: []
};
var handler3 = async (input, { logger, state }) => {
  const { ticketId, assignee, priority, title } = input;
  logger.info("Sending customer notification", { ticketId, assignee });
  const ticket = await state.get("tickets", ticketId);
  const redactedEmail = ticket?.customerEmail?.replace(/(?<=.{2}).(?=.*@)/g, "*") ?? "unknown";
  logger.info("Notification sent", {
    ticketId,
    assignee,
    priority,
    title,
    email: redactedEmail
  });
  return {
    status: 200,
    body: {
      ticketId,
      assignee,
      priority,
      title,
      email: redactedEmail
    }
  };
};

// src/list-tickets.step.ts
import { z as z3 } from "zod";
var config4 = {
  name: "ListTickets",
  description: "Returns all tickets from state",
  flows: ["support-ticket-flow"],
  triggers: [
    {
      type: "http",
      method: "GET",
      path: "/tickets",
      responseSchema: {
        200: z3.object({
          tickets: z3.array(z3.record(z3.string(), z3.any())),
          count: z3.number()
        })
      }
    }
  ],
  enqueues: []
};
var handler4 = async (_, { state, logger }) => {
  const tickets = await state.list("tickets");
  logger.info("Listing tickets", { count: tickets.length });
  return {
    status: 200,
    body: { tickets, count: tickets.length }
  };
};

// src/escalate-ticket.step.ts
import { queue as queue2, api as api2, step as step2 } from "motia";
import { z as z4 } from "zod";
var breachSchema = z4.object({
  ticketId: z4.string(),
  priority: z4.string(),
  title: z4.string(),
  ageMinutes: z4.number()
});
var manualEscalateSchema = z4.object({
  ticketId: z4.string(),
  reason: z4.string()
});
async function escalateTicket(ticketId, updates, ctx) {
  const existing = await ctx.state.get("tickets", ticketId);
  if (!existing) return null;
  await ctx.state.set("tickets", ticketId, {
    ...existing,
    escalatedTo: "engineering-lead",
    escalatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    ...updates
  });
  return existing;
}
var stepConfig2 = {
  name: "EscalateTicket",
  description: "Multi-trigger: escalates tickets from SLA breach or manual request",
  flows: ["support-ticket-flow"],
  triggers: [
    queue2("ticket::sla-breached", { input: breachSchema }),
    api2("POST", "/tickets/escalate", {
      bodySchema: manualEscalateSchema,
      responseSchema: {
        200: z4.object({ ticketId: z4.string(), escalatedTo: z4.string(), message: z4.string() })
      }
    })
  ],
  enqueues: []
};
var { config: config5, handler: handler5 } = step2(stepConfig2, async (input, ctx) => {
  const ticketId = ctx.getData().ticketId;
  ctx.logger.info("Escalating ticket", { ticketId, triggerType: ctx.trigger.type });
  return ctx.match({
    queue: async (breach) => {
      ctx.logger.warn("Auto-escalation from SLA breach", {
        ticketId: breach.ticketId,
        ageMinutes: breach.ageMinutes,
        priority: breach.priority
      });
      const escalated = await escalateTicket(
        breach.ticketId,
        { escalationReason: `SLA breach: ${breach.ageMinutes} minutes without resolution`, escalationMethod: "auto" },
        ctx
      );
      if (!escalated) {
        ctx.logger.error("Ticket not found during SLA escalation", { ticketId: breach.ticketId, ageMinutes: breach.ageMinutes });
        return;
      }
    },
    http: async (request) => {
      const { ticketId: ticketId2, reason } = request.body;
      const existing = await escalateTicket(
        ticketId2,
        { escalationReason: reason, escalationMethod: "manual" },
        ctx
      );
      if (!existing) {
        return { status: 404, body: { error: `Ticket ${ticketId2} not found` } };
      }
      ctx.logger.info("Manual escalation via API", { ticketId: ticketId2, reason });
      return {
        status: 200,
        body: { ticketId: ticketId2, escalatedTo: "engineering-lead", message: "Ticket escalated successfully" }
      };
    }
  });
});

// src/create-ticket.step.ts
import { z as z5 } from "zod";
var ticketSchema = z5.object({
  title: z5.string(),
  description: z5.string(),
  priority: z5.enum(["low", "medium", "high", "critical"]),
  customerEmail: z5.string()
});
var config6 = {
  name: "CreateTicket",
  description: "Accepts a new support ticket via API and enqueues it for triage",
  flows: ["support-ticket-flow"],
  triggers: [
    {
      type: "http",
      method: "POST",
      path: "/tickets",
      bodySchema: ticketSchema,
      responseSchema: {
        200: z5.object({
          ticketId: z5.string(),
          status: z5.string(),
          message: z5.string()
        }),
        400: z5.object({ error: z5.string() })
      }
    }
  ],
  enqueues: ["ticket::created"]
};
var handler6 = async (request, { enqueue, logger, state }) => {
  const { title, description, priority, customerEmail } = request.body;
  if (!title || !description) {
    return {
      status: 400,
      body: { error: "Title and description are required" }
    };
  }
  const ticketId = `TKT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const ticket = {
    id: ticketId,
    title,
    description,
    priority,
    customerEmail,
    status: "open",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  await state.set("tickets", ticketId, ticket);
  logger.info("Ticket created", { ticketId, priority });
  await enqueue({
    topic: "ticket::created",
    data: { ticketId, title, priority, customerEmail }
  });
  return {
    status: 200,
    body: {
      ticketId,
      status: "open",
      message: "Ticket created and queued for triage"
    }
  };
};

// index-dev.js
initIII();
var motia = new Motia();
motia.addStep(config, "./src/triage-ticket.step.ts", handler, "./src/triage-ticket.step.ts");
motia.addStep(config2, "./src/sla-monitor.step.ts", handler2, "./src/sla-monitor.step.ts");
motia.addStep(config3, "./src/notify-customer.step.ts", handler3, "./src/notify-customer.step.ts");
motia.addStep(config4, "./src/list-tickets.step.ts", handler4, "./src/list-tickets.step.ts");
motia.addStep(config5, "./src/escalate-ticket.step.ts", handler5, "./src/escalate-ticket.step.ts");
motia.addStep(config6, "./src/create-ticket.step.ts", handler6, "./src/create-ticket.step.ts");
motia.initialize();
//# sourceMappingURL=index-dev.js.map
