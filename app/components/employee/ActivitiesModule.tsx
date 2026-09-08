"use client";

import NewActivitiesReport from "../center_factory/ReportManagement/modules/NewActivitiesReport";
import ModuleHeader from "./ModuleHeader";
import { useUiLanguage } from "../ThaiUiLocalization";

type ActivitiesModuleProps = {
  initialYear?: string;
};

export default function ActivitiesModule({ initialYear }: ActivitiesModuleProps = {}) {
  const { language } = useUiLanguage();
  const isThai = language === "th";

  return (
    <div>
      <ModuleHeader
        eyebrow={isThai ? "พื้นที่ทำงานพนักงาน" : "Employee Workspace"}
        title={isThai ? "กิจกรรมและข่าวสาร (New Activities)" : "New Activities"}
        detail={
          isThai
            ? "ติดตามข่าวสาร ภาพกิจกรรมการฝึกอบรม และกิจกรรมเพื่อสังคม (CSR) ของทุกบริษัทในเครือ"
            : "Browse corporate training news, CSR highlights, and event photo updates across all entities."
        }
      />
      <NewActivitiesReport initialYear={initialYear} />
    </div>
  );
}
