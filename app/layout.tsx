import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import NavBar from "@/components/NavBar";
import FooterAccount from "@/components/dashboard/FooterAccount";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClientTempo",
  description: "Unified SaaS platform for real estate professionals",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <ClerkProvider>
          <NavBar />
          <main className="flex-grow">{children}</main>
          <FooterAccount />
        </ClerkProvider>
      </body>
    </html>
  );
}