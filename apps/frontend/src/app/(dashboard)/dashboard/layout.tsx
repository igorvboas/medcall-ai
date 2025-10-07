export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Note: The parent group `(dashboard)/layout.tsx` already wraps with `Layout`.
  // To avoid duplicated headers, this route-level layout should only render children.
  return children;
}
