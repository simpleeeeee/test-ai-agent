import type { RunEvent } from "../../src/domain/testRun.js";
import { mapPermissionRequestToRunEvent } from "./runEventMapper.js";

function isAskUserQuestionTool(toolName: string): boolean {
  return ["AskUserQuestion", "ask_user_question", "askUserQuestion"].includes(toolName);
}

type PermissionContext = {
  signal: AbortSignal;
  suggestions?: unknown[];
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  input: Record<string, unknown>;
  suggestions: unknown[];
};

export class ApprovalBridge {
  private nextId = 1;
  private readonly pending = new Map<string, PendingRequest>();

  constructor(
    private readonly runId: string,
    private readonly emit: (event: RunEvent) => void,
  ) {}

  canUseTool = async (
    toolName: string,
    input: Record<string, unknown>,
    context: PermissionContext,
  ): Promise<unknown> => {
    const requestId = `approval-${this.nextId++}`;
    const suggestions = context.suggestions ?? [];

    const promise = new Promise<unknown>((resolve) => {
      this.pending.set(requestId, { resolve, input, suggestions });
    });

    context.signal.addEventListener("abort", () => {
      this.deny(requestId, "请求已取消");
    }, { once: true });

    if (isAskUserQuestionTool(toolName)) {
      this.emit({
        type: "question:required",
        requestId,
        questions: Array.isArray(input.questions) ? input.questions : [],
      });
      return promise;
    }

    this.emit(mapPermissionRequestToRunEvent(
      requestId,
      toolName,
      input,
      `AI 请求调用 ${toolName}`,
    ));

    return promise;
  };

  approve(requestId: string, options: {
    updatedInput?: Record<string, unknown>;
    applyPermissionSuggestions?: boolean;
  } = {}) {
    const pending = this.take(requestId);
    const response: Record<string, unknown> = {
      behavior: "allow",
      updatedInput: options.updatedInput ?? pending.input,
    };
    if (options.applyPermissionSuggestions) {
      response.updatedPermissions = pending.suggestions;
    }
    pending.resolve(response);
  }

  deny(requestId: string, message = "用户拒绝了本次工具调用") {
    const pending = this.take(requestId);
    pending.resolve({ behavior: "deny", message });
  }

  answerQuestion(requestId: string, answers: Record<string, unknown>) {
    const pending = this.take(requestId);
    pending.resolve({
      behavior: "allow",
      updatedInput: {
        ...pending.input,
        answers,
      },
    });
  }

  private take(requestId: string): PendingRequest {
    const pending = this.pending.get(requestId);
    if (!pending) {
      throw new Error(`Unknown approval request: ${requestId}`);
    }
    this.pending.delete(requestId);
    return pending;
  }
}
