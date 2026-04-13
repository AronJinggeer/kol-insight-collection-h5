import { Suspense } from "react";
import { SuccessPage } from "@/components/success-page";

export default function SuccessRoutePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f4efe6]" />}>
      <SuccessPage />
    </Suspense>
  );
}
