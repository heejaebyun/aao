"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Dashboard from "@/components/Dashboard";
import { ErrorBoundary } from "@/components/ErrorBoundary";

function DiagnoseContent() {
  const searchParams = useSearchParams();
  const url = searchParams.get("url") || "";
  return <Dashboard initialUrl={url} />;
}

export default function DiagnosePage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<div style={{ minHeight: "100vh", background: "#07070d" }} />}>
        <DiagnoseContent />
      </Suspense>
    </ErrorBoundary>
  );
}
