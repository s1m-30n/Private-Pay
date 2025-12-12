import {
  DynamicContextProvider,
  mergeNetworks,
} from "@dynamic-labs/sdk-react-core";
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { customEvmNetworks } from "../config";
import { useAtom } from "jotai";
import { isSignedInAtom } from "../store/auth-store";
import Cookies from "js-cookie";
import { useRef } from "react";

// Module-level flag to track authentication state
let isAuthenticating = false;

export default function DynamicProvider({ children }) {
  const [, setSignedIn] = useAtom(isSignedInAtom);
  const dynamicEnvId = import.meta.env.VITE_DYNAMIC_ENV_ID;

  // Log Dynamic configuration for debugging
  console.log("[DynamicProvider] Initializing with env ID:", dynamicEnvId ? `${dynamicEnvId.substring(0, 10)}...` : "NOT SET");
  console.log("[DynamicProvider] Full env check:", {
    hasEnvId: !!dynamicEnvId,
    envIdLength: dynamicEnvId?.length || 0,
    envIdType: typeof dynamicEnvId,
    isPlaceholder: dynamicEnvId === "your_dynamic_environment_id",
    isEmpty: dynamicEnvId === "",
  });

  // If Dynamic environment ID is not set or is placeholder, skip Dynamic provider
  if (!dynamicEnvId || dynamicEnvId === "your_dynamic_environment_id" || dynamicEnvId === "") {
    console.warn("[DynamicProvider] ⚠️ Dynamic.xyz environment ID not configured!");
    console.warn("[DynamicProvider] To enable authentication, set VITE_DYNAMIC_ENV_ID in your environment variables.");
    console.warn("[DynamicProvider] App will work without authentication, but login screen will be skipped.");
    return <>{children}</>;
  }

  try {
    console.log("[DynamicProvider] ✅ Initializing DynamicContextProvider...");
    return (
      <DynamicContextProvider
        settings={{
          environmentId: dynamicEnvId,
          walletConnectors: [EthereumWalletConnectors],
          // Disable automatic provider initialization to prevent chainId errors
          // The provider will be initialized when a wallet is connected
          appName: "PrivatePay",
          appLogoUrl: "/assets/squidl-logo.png",
          overrides: {
            evmNetworks: (networks) => {
              const merged = mergeNetworks(customEvmNetworks, networks);
              // Ensure all networks have valid chainIds
              return merged.map(network => {
                if (!network.chainId || network.chainId === undefined) {
                  console.warn(`[DynamicProvider] Network ${network.name} has invalid chainId, skipping`);
                  return null;
                }
                return network;
              }).filter(Boolean);
            },
          },
          events: {
            onLogout: (args) => {
              console.log("[DynamicProvider] onLogout called with args:", args);
              
              // Check if we're in the middle of authentication (multiple checks)
              const isAuthInProgress = isAuthenticating || 
                                      (typeof window !== "undefined" && window.__isAuthenticating);
              
              if (isAuthInProgress) {
                console.warn("[DynamicProvider] Logout called during authentication. Ignoring to prevent refresh loop.");
                console.warn("[DynamicProvider] isAuthenticating:", isAuthenticating, "window.__isAuthenticating:", typeof window !== "undefined" ? window.__isAuthenticating : "N/A");
                return;
              }
              
              // Check if this is a legitimate logout or an error during login
              const authSigner = localStorage.getItem("auth_signer");
              const accessToken = Cookies.get("access_token");
              
              // Only clear session if this is an intentional logout
              // Don't reload if we're in the middle of authentication or have active session
              if (args?.reason !== "user_initiated" && (authSigner || accessToken)) {
                console.warn("[DynamicProvider] Logout called but session exists. This might be an error during login.");
                console.warn("[DynamicProvider] Args:", JSON.stringify(args, null, 2));
                // Don't reload if we have an active session - might be a false logout
                return;
              }
              
              Cookies.remove("access_token");
              localStorage.removeItem("auth_signer");
              setSignedIn(false);
              
              // Small delay before reload to allow any pending operations to complete
              setTimeout(() => {
                console.log("[DynamicProvider] Reloading page after logout");
                window.location.reload();
              }, 100);
            },
            onConnect: () => {
              console.log("[DynamicProvider] Wallet connected, setting authentication flag");
              isAuthenticating = true;
              // Clear the flag after a delay to allow login to complete
              setTimeout(() => {
                isAuthenticating = false;
                console.log("[DynamicProvider] Authentication flag cleared");
              }, 15000); // 15 seconds should be enough for login to complete
            },
          },
        }}
      >
        {children}
      </DynamicContextProvider>
    );
  } catch (error) {
    console.error("[DynamicProvider] ❌ Error initializing Dynamic Labs:", error);
    console.error("[DynamicProvider] Error details:", {
      message: error.message,
      stack: error.stack,
    });
    console.warn("[DynamicProvider] Falling back to app without Dynamic authentication.");
    return <>{children}</>;
  }
}
