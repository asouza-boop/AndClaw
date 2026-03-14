export interface LLMResponse {
  text: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  name: string;
  arguments: any;
}

export interface ILLMProvider {
  /**
   * Initializes or verifies connection to the LLM.
   */
  initialize(): Promise<void>;

  /**
   * Generates a response from the LLM based on prompts and registered tools.
   */
  generateResponse(
    systemPrompt: string,
    messages: Array<{ role: string; content: string }>,
    tools: any[]
  ): Promise<LLMResponse>;
}
