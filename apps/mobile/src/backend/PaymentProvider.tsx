import { useEffect, type PropsWithChildren } from "react";
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { NativeModules, Platform } from "react-native";
import { publicConfig } from "./client";
import { paymentAvailable } from "./contracts";
export const nativePaymentAvailable = paymentAvailable(
  Platform.OS,
  !!NativeModules.StripeSdk,
  publicConfig.stripeKey,
);
export const stripeSDK: typeof import("@stripe/stripe-react-native") | null =
  nativePaymentAvailable ? require("@stripe/stripe-react-native") : null;
export function PaymentProvider({ children }: PropsWithChildren) {
  useEffect(()=>{
    if(!stripeSDK)return;
    void Linking.getInitialURL().then(url=>{if(url)void stripeSDK!.handleURLCallback(url);}).catch(()=>{});
    const subscription=Linking.addEventListener('url',({url})=>{void stripeSDK!.handleURLCallback(url);});
    return()=>subscription.remove();
  },[]);
  if (!stripeSDK) return children;
  const Provider = stripeSDK.StripeProvider;
  return (
    <Provider publishableKey={publicConfig.stripeKey!} urlScheme={Constants.appOwnership==='expo'?Linking.createURL('/--/'):'kivo-cafe'}>
      <>{children}</>
    </Provider>
  );
}
