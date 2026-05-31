type Props = {
  bridge: { loadSettings: () => Promise<unknown>; saveSettings: (s: unknown) => unknown };
  onClose: () => void;
  onThemeChange: (mode: "light" | "dark") => void;
  theme: "light" | "dark";
};

export function SettingsModal({ onClose }: Props) {
  return (
    <div className="settings-modal-overlay" role="presentation">
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-modal-header">
          <h2>设置</h2>
          <button className="settings-modal-close" title="关闭" onClick={onClose}>✕</button>
        </div>
      </div>
    </div>
  );
}
