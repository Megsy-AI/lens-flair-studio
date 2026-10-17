import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/pay-done")({
  head: () => ({ meta: [{ title: "Lumen — Confirming" }, { name: "description", content: "Securely confirming Lumen Pro." }, { property: "og:title", content: "Lumen — Confirming" }, { property: "og:description", content: "Confirming Lumen Pro on your device." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: PayDone,
});

function PayDone() {
  useEffect(() => {
    window.parent?.postMessage({ type: "lumen-pay-return" }, location.origin);
  }, []);
  return (
    <div className="grid h-screen place-items-center text-center" dir="ltr">
      <p className="text-lg">Checking payment…</p>
    </div>
  );
}
