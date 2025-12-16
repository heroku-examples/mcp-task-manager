# MCP Task Manager

A Model Context Protocol (MCP) server for project and task management. This server provides tools for creating projects, managing tasks, and planning next steps.

## Features

- Create and list projects
- Add tasks to projects
- List tasks by project
- Complete tasks
- Plan next steps with AI assistance
- Support for both stdio and HTTP transport modes

## Prerequisites

- Node.js (v18 or higher)
- pnpm (v10.20.0 or higher)
- Redis server

## Installation

1. Clone the repository
2. Install dependencies:

```bash
pnpm install
```

3. Build the project:

```bash
pnpm build
```

## Configuration

Set up your environment variables. Create a `.env` file:

```bash
REDIS_URL=redis://localhost:6379
PORT=3000  # Optional, defaults to 3000
```

## Usage

### Stdio Mode

Run the server in stdio mode:

```bash
pnpm dev:stdio
```

Or use the built version:

```bash
node dist/index.js stdio
```

### HTTP Mode

Run the server in HTTP mode:

```bash
pnpm dev:http
```

Or use the built version:

```bash
pnpm start
```

The server will be available at `http://localhost:3000/mcp` for MCP requests.

### Additional Endpoints

- `GET /health` - Health check endpoint
- `GET /projects` - List all projects (manual route)

## Available Tools

- `create-project` - Creates a new project
- `list-projects` - Lists all projects
- `add-task` - Adds a new task to a project
- `list-tasks` - Lists all tasks for a project
- `complete-task` - Marks a task as completed

## Development

### Inspect MCP Server

Inspect the server using the MCP Inspector:

```bash
# Stdio mode
pnpm inspect:stdio

# HTTP mode
pnpm inspect:http
```

## Deployment

### Deploy to Heroku

1. Install the Heroku CLI if you haven't already: https://devcenter.heroku.com/articles/heroku-cli

2. Login to Heroku:

```bash
heroku login
```

3. Create a new Heroku app:

```bash
heroku create your-app-name
```

4. Add the Redis addon:

```bash
heroku addons:create heroku-redis:mini
```

This will automatically set the `REDIS_URL` environment variable.

5. Set the buildpack for pnpm (if needed):

```bash
heroku buildpacks:set heroku/nodejs
```

6. Deploy your code:

```bash
git push heroku main
```

Or if you're using a different branch:

```bash
git push heroku your-branch-name:main
```

7. Verify the deployment:

```bash
heroku open
```

The server will be available at `https://your-app-name.herokuapp.com/mcp` for MCP requests.

### Environment Variables

Heroku automatically sets `REDIS_URL` when you add the Redis addon. The `PORT` environment variable is also automatically set by Heroku.

To verify your environment variables:

```bash
heroku config
```

### Viewing Logs

```bash
heroku logs --tail
```

## License

MIT
