import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Defter — Görev Takibi',
  description: 'JWT korumalı mikroservis görev yönetimi',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body className="font-body min-h-screen">{children}</body>
    </html>
  );
}
