import { useState } from "react";

type Props = {
  bridge: { loadSettings: () => Promise<unknown>; saveSettings: (s: unknown) => unknown };
  onClose: () => void;
  onThemeChange: (mode: "light" | "dark") => void;
  theme: "light" | "dark";
};

const NAV_ITEMS = [
  { key: "connection", icon: "🔗", label: "连接" },
  { key: "conversation", icon: "💬", label: "对话" },
  { key: "appearance", icon: "🎨", label: "外观" },
  { key: "security", icon: "🛡", label: "安全" },
  { key: "output", icon: "📋", label: "输出" },
  { key: "debug", icon: "🔧", label: "调试" },
] as const;

export function SettingsModal({ onClose }: Props) {
  return (
    <div className="settings-modal-overlay" role="presentation">
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-modal-header">
          <h2>设置</h2>
          <button className="settings-modal-close" title="关闭" onClick={onClose}>✕</button>
        </div>
        <div className="settings-modal-body">
          <nav className="settings-nav">
            {NAV_ITEMS.map((item) => (
              <button key={item.key} className="settings-nav-item">
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}
