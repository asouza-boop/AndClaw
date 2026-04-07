import type { ZodTypeAny } from 'zod';

export type ToolCategory = 'system' | 'integration' | 'cognitive';

export interface Tool {
  name: string;
  description: string;
  category: ToolCategory;
  parameters: any;
  inputSchema?: ZodTypeAny;
  outputSchema?: ZodTypeAny;
  execute(args: any): Promise<string>;
}
