import { Suspense } from "react";
import { FormPage } from "@/components/form-page";

export default function FormRoutePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f4efe6]" />}>
      <FormPage />
    </Suspense>
  );
}
