import { z } from "zod";

export const CreateProjectInput = {
  name: z.string().min(1),
};

export const CreateProjectOutput = {
  project: z.object({
    id: z.string(),
    name: z.string(),
    createdAt: z.string(),
  }),
};

export const ListProjectsOutput = {
  projects: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      createdAt: z.string(),
    })
  ),
};

export const AddTaskInput = {
  projectId: z.string().min(1),
  title: z.string().min(1),
};

export const AddTaskOutput = {
  task: z.object({
    id: z.string(),
    projectId: z.string(),
    title: z.string(),
    done: z.boolean(),
    createdAt: z.string(),
  }),
};

export const ListTasksInput = {
  projectId: z.string().min(1),
};

export const ListTasksOutput = {
  tasks: z.array(
    z.object({
      id: z.string(),
      projectId: z.string(),
      title: z.string(),
      done: z.boolean(),
      createdAt: z.string(),
      completedAt: z.string().nullable().optional(),
    })
  ),
};

export const CompleteTaskInput = {
  projectId: z.string().min(1),
  taskId: z.string().min(1),
};

export const CompleteTaskOutput = {
  task: z.object({
    id: z.string(),
    projectId: z.string(),
    title: z.string(),
    done: z.boolean(),
    createdAt: z.string(),
    completedAt: z.string().nullable().optional(),
  }),
};


export const NextStepsInput = {
  projectId: z.string().min(1),
};