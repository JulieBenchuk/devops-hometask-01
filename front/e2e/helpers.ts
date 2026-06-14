import { request, type APIRequestContext } from '@playwright/test';

const API = (process.env.E2E_API_URL ?? 'http://localhost:3000').replace(
  /\/$/,
  '',
);

/**
 * Wipe all todos via the API so each test starts from a clean state.
 * Single-user app — no auth needed.
 */
export async function resetTodos(api?: APIRequestContext) {
  const ctx = api ?? (await request.newContext());
  const res = await ctx.get(`${API}/todos`);
  if (!res.ok()) {
    throw new Error(`Failed to list todos: ${res.status()}`);
  }
  const todos: Array<{ id: string }> = await res.json();
  for (const t of todos) {
    await ctx.delete(`${API}/todos/${t.id}`);
  }
  if (!api) await ctx.dispose();
}

export async function createTodoViaApi(
  title: string,
  description?: string,
): Promise<{ id: string; title: string; description: string | null }> {
  const ctx = await request.newContext();
  const res = await ctx.post(`${API}/todos`, {
    data: { title, ...(description ? { description } : {}) },
  });
  if (!res.ok()) {
    throw new Error(`Failed to create todo: ${res.status()}`);
  }
  const json = await res.json();
  await ctx.dispose();
  return json;
}
