import "dotenv/config";
import express, { type Request, type Response } from "express";
import {
  listProjects,
  addTask,
  listTasks,
  completeTask,
  ensureRedis,
  createProject,
  getRedisClient,
  getProject,
} from "./redis.js";
import {
  AddTaskInput,
  AddTaskOutput,
  CompleteTaskInput,
  CompleteTaskOutput,
  CreateProjectInput,
  CreateProjectOutput,
  ListProjectsOutput,
  ListTasksInput,
  ListTasksOutput,
  NextStepsInput,
} from "./schema.js";

// MCP SDK
import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

// ---------- MCP server ----------
async function buildMcpServer() {
  const server = new McpServer({
    name: "task-manager",
    description: "Project and task management MCP server, use it to create projects, add tasks, list tasks, complete tasks, and plan next steps.",
    version: "1.0.0",
  });

  // Tools
  server.registerTool(
    "create-project",
    {
      title: "Create Project",
      description: "Creates a new project",
      inputSchema: CreateProjectInput,
      outputSchema: CreateProjectOutput,
    },
    async ({ name }) => {
      const project = await createProject(name);
      return {
        content: [
          {
            type: "text",
            text: `Project created: ${JSON.stringify(project)}`,
          },
        ],
        structuredContent: {
          project,
        },
      };
    }
  );

  server.registerTool(
    "list-projects",
    {
      title: "List Projects",
      description: "Lists all projects",
      outputSchema: ListProjectsOutput,
    },
    async () => {
      const projects = await listProjects();
      return {
        content: [{ type: "text", text: `Projects: ${JSON.stringify(projects)}` }],
        structuredContent: {
          projects,
        },
      };
    }
  );

  server.registerTool(
    "add-task",
    {
      title: "Add Task",
      description: "Adds a new task to a project",
      inputSchema: AddTaskInput,
      outputSchema: AddTaskOutput,
    },
    async ({ projectId, title }) => {
      const task = await addTask(projectId, title);
      return {
        content: [{ type: "text", text: `Task added: ${JSON.stringify(task)}` }],
        structuredContent: {
          task,
        },
      };
    }
  );

  server.registerTool(
    "list-tasks",
    {
      title: "List Tasks",
      description: "Lists all tasks for a project",
      inputSchema: ListTasksInput,
      outputSchema: ListTasksOutput,
    },
    async ({ projectId }) => {
      const tasks = await listTasks(projectId);
      return {
        content: [{ type: "text", text: `Tasks: ${JSON.stringify(tasks)}` }],
        structuredContent: {
          tasks,
        },
      };
    }
  );

  server.registerTool(
    "complete-task",
    {
      title: "Complete Task",
      description: "Completes a task",
      inputSchema: CompleteTaskInput,
      outputSchema: CompleteTaskOutput,
    },
    async ({ projectId, taskId }) => {
      const task = await completeTask(projectId, taskId);
      return {
        content: [{ type: "text", text: `Task completed: ${JSON.stringify(task)}` }],
        structuredContent: {
          task,
        },
      };
    }
  );

  // Resources
  server.registerResource(
    "project-tasks",
    new ResourceTemplate("tasks://{projectId}", { list: undefined }),
    { title: "Tasks", description: "Tasks" },
    async (uri, { projectId }) => {
      console.error("projectId", projectId);
      console.error("uri", uri);
      const tasks = await listTasks(projectId as string);
      return {
        contents: tasks.map((task) => ({
          text: `Task: ${task.title} - ${task.done ? "Done" : "Not Done"}`,
          uri: uri.href,
        })),
      };
    }
  );

  // Prompts
  server.registerPrompt(
    "next-steps",
    {
      title: "Plan Next Steps",
      description: "Helps the model plan next steps for a project",
      argsSchema: NextStepsInput,
    },
    async ({ projectId }) => {
      const project = await getProject(projectId);
      const tasks = await listTasks(projectId);
      const pending = tasks.filter((task) => !task.done);
      const done = tasks.filter((task) => task.done);

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Help plan next steps for the following project: ${
                project.name
              }\n\nPending tasks:\n${pending
                .map((t) => `- ${t.title} (${t.id})`)
                .join("\n")}\n\nDone tasks:\n${done
                .map((t) => `- ${t.title}`)
                .join("\n")}\n\nSuggest next 3 steps.`,
            },
          },
        ],
      };
    }
  );

  return server;
}

// HTTP Server
async function startHttp() {
  const app = express();
  app.use(express.json());

  // Streamable HTTP Server MCP Endpoint
  app.post("/mcp", async (req: Request, res: Response) => {
    try {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });

      res.on("close", () => {
        transport.close();
      });

      const server = await buildMcpServer();
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error: any) {
      console.error("Error handling MCP request:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error",
          },
          id: null,
        });
      }
    }
  });

  // Simple manual route to list all projects
  app.get("/projects", async (_req: Request, res: Response) => {
    const projects = await listProjects();
    res.json({ projects });
  });

  // Health check endpoint
  app.get("/health", async (_req: Request, res: Response) => {
    try {
      await getRedisClient().ping();
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
  });

  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => {
    console.error(`HTTP listening on :${port}`);
    console.error(`MCP listening on http://localhost:${port}/mcp`);
  });
}

// Main entrypoint
(async () => {
  // Make sure Redis is connected and available
  await ensureRedis();

  // Determine the mode to run in (stdio or http) - Default to http
  const mode = process.argv[2]; // "stdio" or "http"
  if (mode === "stdio") {
    const server = await buildMcpServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("MCP server (stdio) ready.");
  } else {
    await startHttp();
  }
})();
