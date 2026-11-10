import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl text-[#202124]">ENT-Care Admin</h1>
          <p className="mt-1 text-sm text-[#5f6368]">
            Sign in to manage facilities and specialties
          </p>
        </div>

        <div className="rounded-md border border-gray-200 bg-white p-8">
          <Suspense fallback={<div className="h-40" />}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
