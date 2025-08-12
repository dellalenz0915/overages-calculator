import "./globals.css";
export const metadata = { title: "Overages Calculator", description: "Fixed monthly commit vs overage pricing calculator" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className="min-h-screen">{children}</body></html>;
}
