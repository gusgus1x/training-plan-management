"use client";

import ScheduleCalendar from "../center_factory/ReportManagement/modules/ScheduleCalendar";
import ModuleHeader from "./ModuleHeader";
import { useUiLanguage } from "../ThaiUiLocalization";

type CalendarModuleProps = {
  initialYear?: string;
  initialMonth?: string;
};

export default function CalendarModule({ initialYear, initialMonth }: CalendarModuleProps = {}) {
  const { language } = useUiLanguage();
  const isThai = language === "th";

  return (
    <div>
      <ModuleHeader
        eyebrow={isThai ? "พื้นที่ทำงานพนักงาน" : "Employee Workspace"}
        title={isThai ? "ปฏิทินการฝึกอบรม (Calendar Training)" : "Calendar Training"}
        detail={
          isThai
            ? "ตรวจสอบตารางการอบรมรายเดือนและรายปี (Schedule Calendar) ที่เชื่อมโยงกับระบบ Training Rolling"
            : "Review monthly & annual training schedule calendar synced directly from Training Rolling data."
        }
      />
      <ScheduleCalendar initialYear={initialYear} initialMonth={initialMonth} />
    </div>
  );
}
