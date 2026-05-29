import { Plus, Wrench, Send } from "lucide-react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onAddContent: () => void;
  onOpenTools: () => void;
  onOpenModelSettings: () => void;
  placeholder: string;
  modelName?: string;
};

export function Composer({
  value,
  onChange,
  onSubmit,
  onAddContent,
  onOpenTools,
  onOpenModelSettings,
  placeholder,
  modelName = "Claude Sonnet 4",
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
          <button className="icon-button" type="button" aria-label="工具" title="工具" onClick={onOpenTools}>
            <Wrench aria-hidden="true" size={16} />
          </button>
          <button className="model-pill" type="button" onClick={onOpenModelSettings}>{modelName}</button>
        </div>
        <button className="composer-send" type="submit" aria-label="发送">
          <Send aria-hidden="true" size={16} />
        </button>
      </div>
    </form>
  );
}
