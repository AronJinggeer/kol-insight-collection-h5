import { Suspense } from "react";
import { HomePage } from "@/components/home-page";

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f4efe6]" />}>
      <HomePage />
    </Suspense>
  );
}
