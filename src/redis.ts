import Redis from "ioredis";
import slugify from "slugify";

let client: Redis;

export function getRedisClient(): Redis {
  if (!client) {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error("REDIS_URL is not set");
    client = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      tls: { rejectUnauthorized: false },
    });
  }
  client.on("error", (err) => {
    console.error("Redis error:", err);
  });
  return client;
}

export async function ensureRedis(): Promise<void> {
  const r = getRedisClient();
  if (r.status !== "ready") {
    await r.connect();
  }
  // simple health check
  await r.ping();
}

export async function createProject(name: string) {
  const r = getRedisClient();
  const id = slugify(name, { lower: true, trim: true, strict: true });
  const createdAt = new Date().toISOString();
  await r.hset(`project:${id}`, { id, name, createdAt });
  await r.sadd("project:index", id);
  return { id, name, createdAt };
}

export async function getProject(id: string) {
  const r = getRedisClient();
  const project = await r.hgetall(`project:${id}`);
  if (!project || !project.id) throw new Error("Project not found");
  return project;
}

export async function listProjects() {
  const r = getRedisClient();
  const ids = await r.smembers("project:index");
  const pipe = r.pipeline();
  ids.forEach((id) => pipe.hgetall(`project:${id}`));
  const rows = await pipe.exec();
  return (rows ?? []).map(([, v]) => v).filter(Boolean);
}

export async function addTask(projectId: string, title: string) {
  const r = getRedisClient();
  const pid = `project:${projectId}`;
  const exists = await r.exists(pid);
  if (!exists) throw new Error("Project not found");

  const id = slugify(title, { lower: true, trim: true, strict: true });
  const createdAt = new Date().toISOString();
  await r.hset(`task:${id}`, {
    id,
    projectId,
    title,
    done: "false",
    createdAt,
    completedAt: "",
  });
  await r.rpush(`project:${projectId}:tasks`, id);
  return { id, projectId, title, done: false, createdAt };
}

export async function listTasks(projectId: string) {
  const r = getRedisClient();
  const ids = await r.lrange(`project:${projectId}:tasks`, 0, -1);
  if (ids.length === 0) return [];
  const pipe = r.pipeline();
  ids.forEach((id) => pipe.hgetall(`task:${id}`));
  const rows = await pipe.exec();
  return (rows ?? [])
    .map(([, v]) => v)
    .filter(Boolean)
    .map((t: any) => ({
      id: t.id,
      projectId: t.projectId,
      title: t.title,
      done: t.done === "true",
      createdAt: t.createdAt,
      completedAt: t.completedAt || null,
    }));
}

export async function completeTask(projectId: string, taskId: string) {
  const r = getRedisClient();
  const key = `task:${taskId}`;
  const task = await r.hgetall(key);
  if (!task || !task.id) throw new Error("Task not found");
  if (task.projectId !== projectId) throw new Error("Project mismatch");
  const completedAt = new Date().toISOString();
  await r.hset(key, { done: "true", completedAt });
  return {
    id: taskId,
    projectId,
    title: task.title,
    done: task.done === "true",
    completedAt,
  };
}
