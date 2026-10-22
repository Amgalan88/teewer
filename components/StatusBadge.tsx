const colors: Record<string, string> = {
  OPEN: "blue",
  CLOSED: "amber",
  AWARDED: "green",
  COMPLETED: "gray",
  CANCELLED: "red",
  SUBMITTED: "blue",
  WITHDRAWN: "gray",
  NOT_SELECTED: "gray",
  SELECTED: "amber",
  CONFIRMED: "green",
  DECLINED: "red",
  EXPIRED: "red",
  RELEASED: "red",
  APPROVED: "green",
  REJECTED: "red",
  PENDING: "amber",
  ACTIVE: "green",
  SUSPENDED: "red",
};

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return <span className={`badge ${colors[status] ?? "gray"}`}>{label}</span>;
}
