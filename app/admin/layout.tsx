import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "5-6月行情调研后台",
  description: "5-6月行情调研提交数据统计、筛选和导出后台",
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
