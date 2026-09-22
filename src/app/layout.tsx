import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getUsuarioAtual } from "@/lib/auth/sessao";
import { LogoutButton } from "./LogoutButton";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cadastros — Terceirização",
  description: "Cadastro editável de Colaboradores, Encargos, Informativas e Tomadores.",
};

/** Força claro sempre, em qualquer navegador/SO — mesmo com modo escuro ligado no sistema (ver também globals.css). */
export const viewport: Viewport = {
  colorScheme: "light",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const usuario = await getUsuarioAtual();

  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-neutral-50 text-neutral-900">
        {usuario && (
          <div className="flex items-center justify-end gap-3 border-b border-neutral-200 bg-white px-6 py-2 text-sm text-neutral-600">
            <span>{usuario.nome}</span>
            <LogoutButton />
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
