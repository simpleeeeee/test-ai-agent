import { FormEvent, useState } from "react";
import type { QuestionRequest } from "../sdkUiTypes";

type Question = {
  id?: string;
  label?: string;
  options?: string[];
};

type Props = {
  request: QuestionRequest;
  onAnswer: (runId: string, requestId: string, answers: Record<string, unknown>) => void;
};

export function AskUserQuestionCard({ request, onAnswer }: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  function submit(event: FormEvent) {
    event.preventDefault();
    onAnswer(request.runId, request.requestId, answers);
  }

  return (
    <form className="sdk-card question-card" aria-label="需要补充信息" onSubmit={submit}>
      <h3>需要补充信息</h3>
      {(request.questions as Question[]).map((question, index) => {
        const id = question.id ?? `question-${index}`;
        const label = question.label ?? `问题 ${index + 1}`;
        return question.options?.length ? (
          <label key={id}>
            {label}
            <select value={answers[id] ?? ""} onChange={(event) => setAnswers({ ...answers, [id]: event.currentTarget.value })}>
              <option value="">请选择</option>
              {question.options.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        ) : (
          <label key={id}>
            {label}
            <input value={answers[id] ?? ""} onChange={(event) => setAnswers({ ...answers, [id]: event.currentTarget.value })} />
          </label>
        );
      })}
      <button type="submit">提交回答</button>
    </form>
  );
}
