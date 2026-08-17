export type AttendanceSheetCourse = {
  code: string;
  title: string;
  date: string;
  batch?: string;
  location?: string;
  startTime?: string;
  endTime?: string;
  trainer?: string;
  ownerCompany: string;
};

export type AttendanceSheetParticipant = {
  id: string;
  name: string;
  company: string;
  department: string;
  position: string;
  prefix?: string;
  firstName?: string;
  lastName?: string;
};

export type AttendanceEmployeeMaster = {
  empCode: string;
  company: string;
  nameTh: string;
  surnameTh: string;
  titleEn: string;
  functionName: string;
  positionName: string;
};

export type AttendancePositionMaster = {
  positionNameTh: string;
  positionNameEn: string;
};

const getThaiTitle = (title?: string | null) => {
  const normalized = (title || "").trim().toLocaleLowerCase();
  if (["mr", "mr.", "mr. ", "นาย"].includes(normalized)) return "นาย";
  if (["mrs", "mrs.", "mrs. ", "นาง"].includes(normalized)) return "นาง";
  if (["ms", "ms.", "ms. ", "miss", "น.ส.", "น.ส", "นางสาว"].includes(normalized)) return "น.ส.";
  if (!normalized || normalized === "-") return "นาย";
  return title || "นาย";
};

const companyAndEmployeeCollator = new Intl.Collator("th", {
  numeric: true,
  sensitivity: "base",
});

const englishPositionNames = new Set(["foreman", "leader"]);

export const localizeAndSortAttendanceParticipants = (
  participants: AttendanceSheetParticipant[],
  employees: AttendanceEmployeeMaster[],
  positions: AttendancePositionMaster[],
) => {
  const employeesByCode = new Map(
    employees.map((employee) => [employee.empCode, employee]),
  );
  const thaiPositionByEnglishName = new Map(
    positions.map((position) => [
      position.positionNameEn.trim().toLocaleLowerCase(),
      position.positionNameTh.trim(),
    ]),
  );

  return participants
    .map((participant) => {
      const employee = employeesByCode.get(participant.id);
      const positionKey = (employee?.positionName || participant.position)
        .trim()
        .toLocaleLowerCase();
      const positionTh = thaiPositionByEnglishName.get(positionKey);
      const displayPosition = englishPositionNames.has(positionKey)
        ? employee?.positionName || participant.position
        : positionTh || employee?.positionName || participant.position;

      if (!employee) {
        return {
          ...participant,
          prefix: getThaiTitle(participant.prefix),
          position: displayPosition,
        };
      }

      const firstName = (employee.nameTh || participant.firstName || "").trim();
      const lastName = (employee.surnameTh || participant.lastName || "").trim();
      const thaiName = [firstName, lastName].filter(Boolean).join(" ");

      return {
        ...participant,
        name: thaiName || participant.name,
        company: employee.company || participant.company,
        department: employee.functionName || participant.department,
        position: displayPosition,
        prefix: getThaiTitle(employee.titleEn || participant.prefix || ""),
        firstName: firstName || participant.firstName,
        lastName: lastName || participant.lastName,
      };
    })
    .sort(
      (left, right) =>
        companyAndEmployeeCollator.compare(left.company, right.company) ||
        companyAndEmployeeCollator.compare(left.id, right.id),
    );
};

export const getParticipantName = (
  participant: AttendanceSheetParticipant,
) => {
  const prefix = getThaiTitle(participant.prefix);
  if (participant.firstName || participant.lastName) {
    return {
      prefix,
      firstName: participant.firstName || participant.name,
      lastName: participant.lastName ?? "",
    };
  }

  const nameParts = participant.name.trim().split(/\s+/);
  return {
    prefix,
    firstName: nameParts[0] || participant.name,
    lastName: nameParts.slice(1).join(" "),
  };
};

export const getAttendanceSheetFileName = (
  course: Pick<AttendanceSheetCourse, "code" | "date" | "startTime" | "endTime" | "batch">,
) => {
  const safeCode = (course.code || "COURSE").trim().replace(/[/\\:*?"<>|]+/g, "-");
  const safeDate = (course.date || "").trim().replace(/[/\\:*?"<>|]+/g, "-");

  let timeStr = "";
  if (course.startTime && course.endTime) {
    const start = course.startTime.trim().replace(/:/g, ".");
    const end = course.endTime.trim().replace(/:/g, ".");
    timeStr = `${start}-${end}`;
  } else if (course.startTime) {
    timeStr = course.startTime.trim().replace(/:/g, ".");
  } else if (course.endTime) {
    timeStr = course.endTime.trim().replace(/:/g, ".");
  }

  const parts = ["ใบลงทะเบียน", safeCode, safeDate, timeStr].filter(Boolean);
  return `${parts.join(" ")}.xlsx`;
};
