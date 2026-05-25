import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "5-6月行情调研",
  description: "面向达人和大V的产品意向调研问卷",
};

export default function SurveyLayout({ children }: { children: ReactNode }) {
  return children;
}
