import { Navigate, Outlet, useLoaderData } from "react-router-dom";
import { DynamicEmbeddedWidget } from "@dynamic-labs/sdk-react-core";
import AuthProvider from "../providers/AuthProvider";
import { Toaster } from "react-hot-toast";
import Header from "../components/shared/Header";
import Navbar from "../components/shared/Navbar";
import CreateLinkDialog from "../components/dialogs/CreateLinkDialog.jsx";
import GetStartedDialog from "../components/dialogs/GetStartedDialog.jsx";
import { useSession } from "../hooks/use-session.js";
import Payment from "../components/payment/Payment.jsx";
import PaymentLayout from "./PaymentLayout.jsx";
import AsciiFlame from "../components/shared/AsciiFlame.jsx";
import EngowlWatermark from "../components/shared/EngowlWatermark.jsx";
import EnvDebug from "../components/debug/EnvDebug.jsx";

export default function AuthLayout() {
  const { isSignedIn } = useSession();
  const loaderData = useLoaderData();
  const subdomain = loaderData?.subdomain;
  const dynamicEnvId = import.meta.env.VITE_DYNAMIC_ENV_ID;
  const hasDynamic = dynamicEnvId && dynamicEnvId !== "your_dynamic_environment_id" && dynamicEnvId !== "";

  // Log Dynamic configuration status for debugging
  console.log("[AuthLayout] Dynamic configuration:", {
    hasDynamic,
    dynamicEnvId: dynamicEnvId ? `${dynamicEnvId.substring(0, 10)}...` : "Not set",
    dynamicEnvIdLength: dynamicEnvId?.length || 0,
    isSignedIn,
    allEnvVars: Object.keys(import.meta.env).filter(k => k.startsWith('VITE_')),
  });

  if (subdomain) {
    return (
      <PaymentLayout>
        <div className="flex min-h-screen w-full items-center justify-center py-5 md:py-20 px-4 md:px-10">
          <Payment />
        </div>
      </PaymentLayout>
    );
  }

  // If Dynamic is not configured, skip authentication and go directly to dashboard
  if (!hasDynamic) {
    console.warn("[AuthLayout] Dynamic.xyz not configured. Skipping authentication screen.");
    return (
      <AuthProvider>
        {/* <EngowlWatermark /> */}
        <CreateLinkDialog />
        <GetStartedDialog />
        <Toaster />
        <Header />
        <Outlet />
        <Navbar />
      </AuthProvider>
    );
  }

  if (!isSignedIn) {
    console.log("[AuthLayout] User not signed in. Showing login screen with Dynamic widget.");
    return (
      <div className="flex min-h-screen w-full items-center justify-center px-5 md:px-10 bg-primary-50">
        <EnvDebug />
        <AsciiFlame />
        {/* <EngowlWatermark /> */}

        <div className="w-full max-w-md">
          <div className="flex flex-col items-center text-center mb-4">
            <img src="/assets/squidl-only.svg" className="w-36" alt="PrivatePay Logo" />
            <div className="text-md font-medium opacity-50 mt-2">
              Stealth Addresses for Untraceable Payments.
            </div>
          </div>

          {/* Wrap DynamicEmbeddedWidget in error boundary */}
          <div id="dynamic-widget-container" style={{ minHeight: '400px', position: 'relative' }}>
            {(() => {
              try {
                return <DynamicEmbeddedWidget background="with-border" />;
              } catch (error) {
                console.error("[AuthLayout] Error rendering DynamicEmbeddedWidget:", error);
                return (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-center">
                    <p className="text-red-600 font-semibold">Failed to load authentication widget</p>
                    <p className="text-red-500 text-sm mt-2">Error: {error.message}</p>
                    <p className="text-gray-500 text-xs mt-2">Check console for details</p>
                  </div>
                );
              }
            })()}
          </div>

          <div className="flex flex-col items-center mt-2">
            <div className="mt-8 opacity-60">Powered by</div>
            <div className="mt-1">
              <img src="/assets/oasis-long-logo.svg" className="w-32" alt="Oasis Logo" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthProvider>
      {/* <EngowlWatermark /> */}
      <CreateLinkDialog />
      <GetStartedDialog />
      <Toaster />
      <Header />
      <Outlet />
      <Navbar />
    </AuthProvider>
  );
}
