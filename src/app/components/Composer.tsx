import { Plus, Wrench, Send } from "lucide-react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  placeholder: string;
};

export function Composer({ value, onChange, onSubmit, placeholder }: Props) {
  function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  }

  return (
    <form
      className="composer"
      onSubmit={(event) => {
        event.preventDefault();
        handleSubmit();
      }}
    >
      <textarea
        aria-label="消息输入"
        onChange={(event) => onChange(event.currentTarget.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        value={value}
      />
      <div className="composer-actions">
        <button className="composer-tool-button" type="button" aria-label="添加内容">
          <Plus aria-hidden="true" size={16} />
        </button>
        <button className="composer-tool-button" type="button" aria-label="工具">
          <Wrench aria-hidden="true" size={16} />
        </button>
        <span className="composer-model-label">Claude Sonnet 4</span>
        <button className="send-button" type="submit" aria-label="发送">
          <Send aria-hidden="true" size={16} />
        </button>
      </div>
    </form>
  );
}
