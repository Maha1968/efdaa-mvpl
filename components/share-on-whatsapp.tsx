"use client";

import { getTokenShareUrl } from "@/lib/utils/app-url";

type ShareOnWhatsAppProps = {
  code: string;
  productName: string;
};

export function ShareOnWhatsApp({ code, productName }: ShareOnWhatsAppProps) {
  const shareUrl = getTokenShareUrl(code);
  const message = `Check out ${productName} on EFDAA — open this link to claim the offer: ${shareUrl}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3.5 text-base font-medium text-white transition-colors hover:bg-[#1fb855]"
    >
      Share on WhatsApp
    </a>
  );
}
