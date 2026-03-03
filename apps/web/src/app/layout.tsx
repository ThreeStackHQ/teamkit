import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TeamKit",
  description: "Multi-tenant team management platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
