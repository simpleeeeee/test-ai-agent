import { Minus, Square, X } from "lucide-react";

type Props = {
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onClose: () => void;
};

export function WindowControls({ onMinimize, onToggleMaximize, onClose }: Props) {
  return (
    <div className="window-controls" aria-label="窗口控制">
      <button className="window-control" type="button" aria-label="最小化窗口" title="最小化窗口" onClick={onMinimize}>
        <Minus aria-hidden="true" size={15} />
      </button>
      <button className="window-control" type="button" aria-label="最大化窗口" title="最大化窗口" onClick={onToggleMaximize}>
        <Square aria-hidden="true" size={15} />
      </button>
      <button className="window-control close" type="button" aria-label="关闭窗口" title="关闭窗口" onClick={onClose}>
        <X aria-hidden="true" size={15} />
      </button>
    </div>
  );
}
