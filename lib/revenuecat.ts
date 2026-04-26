import { Platform } from 'react-native';
import Purchases, { CustomerInfo, LOG_LEVEL, PurchasesOfferings, PurchasesPackage } from 'react-native-purchases';

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? '';
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? '';
const WEB_KEY = process.env.EXPO_PUBLIC_REVENUECAT_WEB_BILLING_API_KEY ?? '';

let configuredAppUserId: string | null = null;
let configuredApiKey: string | null = null;

export function getRevenueCatApiKey() {
  if (Platform.OS === 'ios') {
    return IOS_KEY;
  }

  if (Platform.OS === 'android') {
    return ANDROID_KEY;
  }

  if (Platform.OS === 'web') {
    return WEB_KEY;
  }

  return '';
}

export function isRevenueCatConfigured() {
  return getRevenueCatApiKey().length > 0;
}

export function isRevenueCatPurchasingSupported() {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

export function hasRevenueCatProAccess(customerInfo: CustomerInfo | null | undefined) {
  if (!customerInfo) {
    return false;
  }

  return Object.keys(customerInfo.entitlements.active).length > 0;
}

async function ensureRevenueCatConfigured(appUserId: string | null) {
  const apiKey = getRevenueCatApiKey();
  if (!apiKey) {
    return false;
  }

  await Purchases.setLogLevel(LOG_LEVEL.ERROR);

  if (configuredApiKey !== apiKey) {
    Purchases.configure({
      apiKey,
      appUserID: appUserId ?? undefined,
    });
    configuredApiKey = apiKey;
    configuredAppUserId = appUserId;
    return true;
  }

  if (appUserId && configuredAppUserId !== appUserId) {
    await Purchases.logIn(appUserId);
    configuredAppUserId = appUserId;
    return true;
  }

  if (!appUserId && configuredAppUserId) {
    await Purchases.logOut();
    configuredAppUserId = null;
  }

  return true;
}

export async function syncRevenueCatUser(appUserId: string | null) {
  if (!isRevenueCatConfigured()) {
    return false;
  }

  return ensureRevenueCatConfigured(appUserId);
}

export async function getRevenueCatCustomerInfo(appUserId: string | null) {
  if (!isRevenueCatConfigured()) {
    return null;
  }

  const configured = await ensureRevenueCatConfigured(appUserId);
  if (!configured) {
    return null;
  }

  return Purchases.getCustomerInfo();
}

export async function getRevenueCatOfferings(appUserId: string | null): Promise<PurchasesOfferings | null> {
  if (!isRevenueCatConfigured()) {
    return null;
  }

  const configured = await ensureRevenueCatConfigured(appUserId);
  if (!configured) {
    return null;
  }

  return Purchases.getOfferings();
}

export async function purchaseRevenueCatPackage(appUserId: string | null, selectedPackage: PurchasesPackage) {
  const configured = await ensureRevenueCatConfigured(appUserId);
  if (!configured) {
    throw new Error('RevenueCat is not configured for this platform.');
  }

  return Purchases.purchasePackage(selectedPackage);
}
