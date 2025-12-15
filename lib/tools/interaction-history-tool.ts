import { ToolboxTool } from "../../interfaces/ToolboxTool.js";
import { ArenaManager } from "../arena-manager.js";

export class InteractionHistoryTool implements ToolboxTool {
  private arenaManager: ArenaManager;
  private api: any;

  constructor(toolboxCollector: any, arenaManager: ArenaManager, api: any) {
    this.arenaManager = arenaManager;
    this.api = api;
    toolboxCollector.register('/widgets/interaction-history-widget.js');
  }

  getRoutes(): Record<string, any> {
    return {
      "/sessions/:sessionId/interaction-history": async (req: any) => {
        try {
          const sessionId = req.params.sessionId;
          const arena = await this.arenaManager.getArena(sessionId, this.api);

            // Build invocation tree
            const invocationTree = this.buildInvocationTree(arena.invocationLog, arena.taskStore);

          return new Response(JSON.stringify({
            invocationLog: arena.invocationLog,
            taskStore: arena.taskStore,
            taskQueue: arena.taskQueue.map(task => ({ id: task.id, agent: task.agent_name })),
            errorCount: arena.errorCount,
            invocationTree
          }), { headers: { 'Content-Type': 'application/json' } });
        } catch (error) {
          return new Response(JSON.stringify({ error: (error as Error).message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      },
      "/sessions/:sessionId/interaction-history/clear": async (req: any) => {
        try {
          const sessionId = req.params.sessionId;
          await this.arenaManager.clearArenaState(sessionId);
          this.arenaManager.clearArena(sessionId);
          return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
        } catch (error) {
          return new Response(JSON.stringify({ error: (error as Error).message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
    };
  }

  private buildInvocationTree(invocationLog: Array<{id: string, type: 'agent' | 'tool', name: string, parent_id: string | null, params?: any, result?: any}>, taskStore: Record<string, any>): any[] {
    const tree: any[] = [];
    const nodes = new Map<string, any>();

    // Create nodes
    for (const inv of invocationLog) {
      const task = taskStore[inv.id];
      nodes.set(inv.id, {
        id: inv.id,
        type: inv.type,
        name: inv.name,
        params: inv.params,
        result: inv.result,
        taskType: task?.taskType,
        children: []
      });
    }

    // Build hierarchy
    for (const inv of invocationLog) {
      const node = nodes.get(inv.id);
      if (inv.parent_id) {
        const parent = nodes.get(inv.parent_id);
        if (parent) {
          parent.children.push(node);
        }
      } else {
        tree.push(node);
      }
    }

    return tree;
  }
}