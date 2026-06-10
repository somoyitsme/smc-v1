import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KrishiDam কৃষিদাম — Fair Price for Every Grain",
  description: "KrishiDam is a reverse auction platform connecting Bangladeshi rice farmers directly with rice mills. Mills compete for farmer crops with AI-enforced fair price floors.",
  keywords: ["Bangladesh", "rice", "agriculture", "auction", "farmer", "mill", "fair price"],
  openGraph: {
    title: "KrishiDam কৃষিদাম",
    description: "Reverse auction platform for Bangladesh rice farmers. Mills compete. Farmers win.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Noto+Sans+Bengali:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
