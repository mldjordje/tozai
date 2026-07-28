import { Suspense } from "react";
import { AdminLoginForm } from "./AdminLoginForm";

export default function AdminLoginPage() {
  return (
    <div className="adm-login">
      <Suspense fallback={null}>
        <AdminLoginForm passwordEnabled={Boolean(process.env.ADMIN_PASSWORD)} />
      </Suspense>
    </div>
  );
}
