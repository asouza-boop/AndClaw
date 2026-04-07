import type { ZodTypeAny } from 'zod';

export interface Tool {
  name: string;
  description: string;
  parameters: any;
  inputSchema?: ZodTypeAny;
  outputSchema?: ZodTypeAny;
  execute(args: any): Promise<string>;
}
