import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/pay-done")({
  head: () => ({ meta: [{ title: "Lumen — تأكيد اشتراكك" }, { name: "description", content: "تأكيد اشتراك Lumen Pro بأمان من شركة الدفع." }, { property: "og:title", content: "Lumen — تأكيد اشتراكك" }, { property: "og:description", content: "تأكيد اشتراك Lumen Pro على جهازك." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: PayDone,
});

function PayDone() {
  useEffect(() => {
    window.parent?.postMessage({ type: "lumen-pay-return" }, location.origin);
  }, []);
  return (
    <div className="grid h-screen place-items-center text-center" dir="rtl">
      <p className="text-lg">جاري مراجعة حالة الدفع…</p>
    </div>
  );
}
