import { Router } from "expo-router";

export type AppRoute =
  // Owner routes
  | "owner/location"
  | "owner/notification"
  | "owner/sendreport"
  | "owner/reportlogs"

  // Police routes
  | "police/home"
  | "police/notification"
  | "police/report"
  | "police/archive";

export const safePush = (router: Router, path: AppRoute) => {
  router.push(path as unknown as never);
};
