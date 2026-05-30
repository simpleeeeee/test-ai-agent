type Props = {
  status?: "idle" | "active" | "done" | "error";
};

export function ActivityIndicator({ status = "active" }: Props) {
  return <span className={`activity-indicator ${status}`} aria-hidden="true" />;
}
