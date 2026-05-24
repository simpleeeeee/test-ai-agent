import { ArrowUp, Plus, Wrench } from "lucide-react";
import { FormEvent } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
};

export function Composer({ value, onChange, onSubmit }: Props) {
  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  }

  return (
    <form className="composer-shell" aria-label="消息输入区" onSubmit={submit}>
      <textarea
        aria-label="消息输入"
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder="回复 Claude..."
        value={value}
      />
      <div className="composer-toolbar">
        <div className="composer-tools">
          <button aria-label="添加内容" className="icon-button" type="button">
            <Plus aria-hidden="true" size={17} />
          </button>
          <button aria-label="工具" className="icon-button" type="button">
            <Wrench aria-hidden="true" size={17} />
          </button>
          <span className="model-pill">Claude Sonnet 4</span>
        </div>
        <button aria-label="发送" className="composer-send" type="submit">
          <ArrowUp aria-hidden="true" size={17} />
        </button>
      </div>
    </form>
  );
}
