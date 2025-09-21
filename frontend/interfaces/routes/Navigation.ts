export const ROUTES = {
  LOCATION: "owner/location",
  NOTIFICATION: "owner/notification",
  SENDREPORT: "owner/sendreport",
  REPORTLOGS: "owner/reportlogs",

  POLICE_HOME: "police/home",
  POLICE_NOTIFICATION: "police/notification",
  POLICE_REPORT: "police/report",
  POLICE_ARCHIVE: "police/archive",
} as const;

export type Route = (typeof ROUTES)[keyof typeof ROUTES];

export interface NavItemProps {
  icon: any;
  label: string;
  route: Route;
}
