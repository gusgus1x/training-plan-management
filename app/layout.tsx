import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_Thai } from "next/font/google";
import AuthGate from "./components/AuthGate";
import ConfirmDialogHost from "./components/ConfirmDialog";
import NoticeDialogHost from "./components/NoticeDialog";
import ScrollToTop from "./components/ScrollToTop";
import ToastHost from "./components/ToastHost";
import ThaiUiLocalization from "./components/ThaiUiLocalization";
import { getServerSessionUser } from "./lib/auth/server-session";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-sans-thai",
  subsets: ["thai"],
  weight: "variable",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ATTG Training plan management",
  description: "ATTG Training plan management system.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.png", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/attg-logo.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getServerSessionUser();

  return (
    <html
      lang="th"
      className={`${geistSans.variable} ${geistMono.variable} ${notoSansThai.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThaiUiLocalization>
          <AuthGate user={user}>{children}</AuthGate>
          <ConfirmDialogHost />
          <NoticeDialogHost />
          <ToastHost />
          <ScrollToTop />
        </ThaiUiLocalization>
      </body>
    </html>
  );
}
