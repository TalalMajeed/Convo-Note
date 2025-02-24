import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Convo Note | AI Assistant",
  description:
    "A Web Powered AI Application which takes information from patients",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`antialiased`}>{children}</body>
    </html>
  );
}
