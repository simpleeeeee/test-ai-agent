import { Sparkles } from "lucide-react";

const suggestions = [
  "分析订单模块的关键测试风险",
  "帮我设计登录流程的用例",
  "解释接口回归测试怎么做",
];

type Props = {
  onSuggestionClick?: (suggestion: string) => void;
};

export function EmptyConversationState({ onSuggestionClick }: Props) {
  return (
    <div className="empty-state">
      <div className="empty-icon" aria-hidden="true">
        <Sparkles size={22} />
      </div>
      <h2>今天想测试什么？</h2>
      <p>可以直接提问，也可以描述一个业务流程，我会先帮你梳理风险和测试思路。</p>
      <div className="suggestions" aria-label="建议入口">
        {suggestions.map((suggestion) => (
          <button className="suggestion" key={suggestion} type="button"
            onClick={() => onSuggestionClick?.(suggestion)}>
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
