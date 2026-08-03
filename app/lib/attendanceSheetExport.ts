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

const getThaiTitle = (title: string) => {
  const normalized = title.trim().toLocaleLowerCase();
  if (["mr", "mr."].includes(normalized)) return "นาย";
  if (["mrs", "mrs."].includes(normalized)) return "นาง";
  if (["ms", "ms.", "miss"].includes(normalized)) return "น.ส.";
  return title;
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
          position: displayPosition,
        };
      }

      const firstName = employee.nameTh.trim();
      const lastName = employee.surnameTh.trim();
      return {
        ...participant,
        name:
          [firstName, lastName].filter(Boolean).join(" ") || participant.name,
        company: employee.company || participant.company,
        department: employee.functionName || participant.department,
        position: displayPosition,
        prefix: getThaiTitle(employee.titleEn),
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
  if (participant.firstName || participant.lastName) {
    return {
      prefix: participant.prefix ?? "",
      firstName: participant.firstName || participant.name,
      lastName: participant.lastName ?? "",
    };
  }

  const nameParts = participant.name.trim().split(/\s+/);
  return {
    prefix: participant.prefix ?? "",
    firstName: nameParts[0] || participant.name,
    lastName: nameParts.slice(1).join(" "),
  };
};

export const getAttendanceSheetFileName = (
  course: Pick<AttendanceSheetCourse, "code" | "date" | "batch">,
) => {
  const fileIdentity = [course.code, course.date, course.batch || "session"]
    .join("_")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `attendance_${fileIdentity || "training-session"}.xlsx`;
};
