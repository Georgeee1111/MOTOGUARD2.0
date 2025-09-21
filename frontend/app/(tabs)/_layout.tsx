import { Slot, usePathname } from "expo-router";
import OwnerTabs from "./owner/_layout";
import PoliceTabs from "./police/_layout";

export default function TabsLayout() {
  const pathname = usePathname();

  if (pathname.startsWith("/tabs/owner")) {
    return <OwnerTabs />;
  } else if (pathname.startsWith("/tabs/police")) {
    return <PoliceTabs />;
  }

  return <Slot />;
}
