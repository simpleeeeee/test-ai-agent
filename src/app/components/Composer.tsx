import { Plus, Send } from "lucide-react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onAddContent: () => void;
  placeholder: string;
};

export function Composer({
  value,
  onChange,
  onSubmit,
  onAddContent,
  placeholder,
}: Props) {
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
      className="composer-shell"
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
      <div className="composer-toolbar">
        <div className="composer-tools">
          <button className="icon-button" type="button" aria-label="添加内容" title="添加内容" onClick={onAddContent}>
            <Plus aria-hidden="true" size={16} />
          </button>
        </div>
        <button className="composer-send" type="submit" aria-label="发送">
          <Send aria-hidden="true" size={16} />
        </button>
      </div>
    </form>
  );
}
