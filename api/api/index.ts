/**
 * Vercel Serverless Function handler.
 *
 * Imports from the compiled dist/ output (built by nest build + tsc-alias)
 * where all TypeScript path aliases are already resolved.
 * Vercel's @vercel/node runtime compiles this file independently,
 * so we must not rely on tsconfig path aliases here.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getApp } from '../dist/src/serverless';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const app = await getApp();
  app(req as any, res as any);
}
