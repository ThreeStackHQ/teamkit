export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <nav>
        <span>TeamKit</span>
      </nav>
      <main>{children}</main>
    </div>
  );
}
