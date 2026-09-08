import type { Metadata } from "next";
import { Geist, Geist_Mono, Sarabun } from "next/font/google";
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

const sarabun = Sarabun({
  variable: "--font-sarabun",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
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
      className={`${geistSans.variable} ${geistMono.variable} ${sarabun.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(t==="light"){document.documentElement.setAttribute("data-theme","light");document.documentElement.classList.remove("dark");}else{document.documentElement.setAttribute("data-theme","dark");document.documentElement.classList.add("dark");}}catch(e){}})();`,
          }}
        />
      </head>
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
