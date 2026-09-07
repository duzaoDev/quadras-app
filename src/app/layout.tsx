import type { Metadata } from "next";
import { Nunito_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from '@/components/ui/sonner';
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { NextAuthProvider } from "@/components/providers/NextAuthProvider";

const nunitoSans = Nunito_Sans({
  variable: "--font-fallback",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FUTEL - Portal de Quadras",
  description: "Aplicativo de agendamento de quadras da FUTEL",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${nunitoSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans overflow-x-hidden">
        <NextAuthProvider>
          <Header />
          <main className="flex-1 flex flex-col">
            {children}
          </main>
          <Footer />
          <Toaster richColors position="top-center" />
        </NextAuthProvider>
      </body>
    </html>
  );
}
