"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  TRAINING_WORKFLOW_EVENT,
  TRAINING_WORKFLOW_KEYS,
  getCourseDisplayName,
  isWorkflowOwner,
  readWorkflowCollection,
  writeWorkflowCollection,
  type WorkflowCourse,
  type WorkflowOapPlan,
  type WorkflowOwner,
  type WorkflowStandard,
} from "../../../../lib/trainingWorkflow";
import { profileValue, useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import styles from "./TrainingRolling.module.css";

export const trainingRollingModule = {
  title: "Training Rolling",
  subtitle: "Monthly training plan",
  description: "Convert annual OAP items into monthly rolling training schedules.",
} as const;

export type RollingStatus = "Planning" | "Planned";

type CourseMasterDetail = {
  code: string;
  name: string;
  nameTh?: string;
  nameEn?: string;
  objective: string;
  learningContent: string;
  targetGroup: string;
  methodology: string;
  preTest: string;
  postTest: string;
  evaluation: string;
  evaluationAfter30Day: string;
  lifeCycleMonth: string;
  courseType: string;
  courseGroup: string;
};

type OapSource = {
  id: string;
  course: CourseMasterDetail;
  participants: string;
  hours: string;
  budget: string;
  trainer: string;
  provider: string;
  owner: string;
  ownerScope?: WorkflowOwner;
  ownerCompany?: string;
};

export type RollingPlan = OapSource & {
  rollingId: string;
  scheduleGroupId?: string;
  sequence: number;
  batch: string;
  location: string;
  trainingDate: string;
  startTime: string;
  endTime: string;
  company: string;
  relatedCompanies?: string[];
  status: RollingStatus;
  updatedAt: string;
};

type SearchableOption = {
  value: string;
  label: string;
  subLabel?: string;
  searchKey?: string;
};

function SearchableSelectField({
  value,
  placeholder,
  options,
  disabled,
  onChange,
}: {
  value: string;
  placeholder?: string;
  options: SearchableOption[];
  disabled?: boolean;
  onChange: (val: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);
  const displayValue = selectedOption?.label || value || "";

  const filteredOptions = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((opt) => {
      const matchLabel = opt.label.toLowerCase().includes(q);
      const matchSub = opt.subLabel ? opt.subLabel.toLowerCase().includes(q) : false;
      const matchKey = opt.searchKey ? opt.searchKey.toLowerCase().includes(q) : false;
      return matchLabel || matchSub || matchKey;
    });
  }, [options, query]);

  return (
    <div className={styles.searchableSelectContainer} ref={containerRef}>
      <div className={styles.searchableInputWrap}>
        <input
          className={styles.searchableInput}
          type="text"
          disabled={disabled}
          placeholder={placeholder || "พิมพ์ค้นหาหลักสูตร (ไทย / English / Code)..."}
          value={isOpen ? query : displayValue}
          onFocus={() => {
            if (!disabled) {
              setQuery("");
              setIsOpen(true);
            }
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && filteredOptions.length > 0) {
              e.preventDefault();
              const first = filteredOptions[0];
              onChange(first.value);
              setIsOpen(false);
              setQuery("");
            } else if (e.key === "Escape") {
              setIsOpen(false);
            }
          }}
        />
        {value && !disabled ? (
          <button
            type="button"
            className={styles.clearSelectBtn}
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
              setQuery("");
              setIsOpen(false);
            }}
            title="ล้างค่า"
          >
            ✕
          </button>
        ) : null}
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          className={styles.toggleDropdownBtn}
          onClick={() => {
            if (!disabled) {
              setIsOpen(!isOpen);
              if (!isOpen) setQuery("");
            }
          }}
        >
          <span className={styles.arrowIcon}>{isOpen ? "▲" : "▼"}</span>
        </button>
      </div>

      {isOpen && !disabled ? (
        <ul className={styles.dropdownMenu} role="listbox">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <li
                  key={opt.value}
                  className={`${styles.dropdownItem} ${isSelected ? styles.dropdownItemSelected : ""}`}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                    setQuery("");
                  }}
                >
                  <div className={styles.itemContent}>
                    <strong>{opt.label}</strong>
                    {opt.subLabel ? <span>{opt.subLabel}</span> : null}
                  </div>
                  {isSelected ? <span className={styles.itemCheck}>✓</span> : null}
                </li>
              );
            })
          ) : (
            <li className={styles.noResultsItem}>
              ไม่พบหลักสูตรที่ตรงกับ "{query}"
            </li>
          )}
        </ul>
      ) : null}
    </div>
  );
}

export const rollingCompanyOptions = ["ATA", "ATFB", "NIC", "SATI", "SNF", "TEP"] as const;

export const getRollingPlanCompanies = (plan: RollingPlan): string[] => {
  if (plan.relatedCompanies?.length) {
    return plan.relatedCompanies;
  }

  return plan.company === "All Companies"
    ? [...rollingCompanyOptions]
    : [plan.company];
};

export const formatRollingPlanCompanies = (plan: RollingPlan): string => {
  const selectedCompanies = getRollingPlanCompanies(plan);

  return selectedCompanies.length === rollingCompanyOptions.length
    ? "All Companies"
    : selectedCompanies.join(", ");
};

export const monthOptions = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
] as const;
export const yearOptions = ["2026", "2027"] as const;

const mockOapSources: OapSource[] = [
  {
    id: "oap-001",
    course: {
      code: "CRS-001",
      name: "Leadership Essentials",
      objective: "Develop leadership capability for supervisors and team leaders.",
      learningContent: "Leader role, delegation, coaching, feedback, team follow-up.",
      targetGroup: "Supervisor / Section Head / Leader",
      methodology: "Classroom + Workshop",
      preTest: "Leadership pre-test",
      postTest: "Leadership post-test",
      evaluation: "Course satisfaction survey",
      evaluationAfter30Day: "Manager follow-up after 30 days",
      lifeCycleMonth: "24",
      courseType: "IN-HOUSE",
      courseGroup: "Management",
    },
    participants: "24",
    hours: "6",
    budget: "45000",
    trainer: "Somchai P.",
    provider: "HRD Center",
    owner: "admin.hrd",
  },
  {
    id: "oap-002",
    course: {
      code: "CRS-022",
      name: "Safety Basics",
      objective: "Ensure employees understand workplace safety rules.",
      learningContent: "Safety rules, PPE, emergency response, incident reporting.",
      targetGroup: "All employees",
      methodology: "Classroom",
      preTest: "Safety awareness pre-test",
      postTest: "Safety awareness post-test",
      evaluation: "Safety course evaluation",
      evaluationAfter30Day: "Supervisor confirms behavior after 30 days",
      lifeCycleMonth: "12",
      courseType: "ATA-TC",
      courseGroup: "Safety",
    },
    participants: "42",
    hours: "3",
    budget: "28500",
    trainer: "Safety Team",
    provider: "Safety Department",
    owner: "factory.hrd",
  },
  {
    id: "oap-003",
    course: {
      code: "CRS-041",
      name: "Quality Control Basics",
      objective: "Build basic quality control understanding for production teams.",
      learningContent: "Defect prevention, inspection points, quality records, escalation.",
      targetGroup: "Production / Quality / Operator",
      methodology: "Classroom + Case study",
      preTest: "Quality pre-test",
      postTest: "Quality post-test",
      evaluation: "Quality course evaluation",
      evaluationAfter30Day: "Quality issue follow-up after 30 days",
      lifeCycleMonth: "18",
      courseType: "PUBLIC",
      courseGroup: "Quality",
    },
    participants: "18",
    hours: "4",
    budget: "32000",
    trainer: "Quality Team",
    provider: "QA Department",
    owner: "quality.hrd",
  },
];

export const initialRollingPlans: RollingPlan[] = [
  {
    rollingId: "rolling-sample-001",
    scheduleGroupId: "rolling-group-sample-001",
    id: "oap-sample-001",
    sequence: 1,
    course: {
      code: "QT-001",
      name: "Quality Control & Standard Inspection (QT-001)",
      nameTh: "การควบคุมคุณภาพและตรวจสอบมาตรฐาน (QT-001)",
      nameEn: "Quality Control & Standard Inspection",
      objective: "Understand quality control principles and inspection standards.",
      learningContent: "QC tools, inspection procedure, non-conformance reporting.",
      targetGroup: "Quality / Production / All Factories",
      methodology: "Classroom & Workshop",
      preTest: "Pre-test QC",
      postTest: "Post-test QC",
      evaluation: "Satisfaction evaluation",
      evaluationAfter30Day: "30-day follow up",
      lifeCycleMonth: "12",
      courseType: "ALL-FACTORIES",
      courseGroup: "Quality",
    },
    participants: "30",
    hours: "6",
    budget: "25000",
    trainer: "Quality Center Master",
    provider: "HRD Center",
    owner: "Center HRD",
    ownerScope: "CENTER",
    ownerCompany: "HRD Center",
    batch: "1",
    location: "Main Auditorium / Hybrid",
    trainingDate: "2026-08-20",
    startTime: "09:00",
    endTime: "16:00",
    company: "All Companies",
    relatedCompanies: ["ATA", "ATFB", "NIC", "SATI", "SNF", "TEP"],
    status: "Planned",
    updatedAt: "2026-08-13",
  },
  {
    rollingId: "rolling-sample-002",
    scheduleGroupId: "rolling-group-sample-002",
    id: "oap-sample-002",
    sequence: 2,
    course: {
      code: "CRS-001",
      name: "Leadership Essentials",
      nameTh: "ทักษะภาวะผู้นำสำหรับหัวหน้างาน",
      nameEn: "Leadership Essentials",
      objective: "Develop leadership capability for supervisors and team leaders.",
      learningContent: "Leader role, delegation, coaching, feedback, team follow-up.",
      targetGroup: "Supervisor / Section Head / Leader",
      methodology: "Classroom + Workshop",
      preTest: "Leadership pre-test",
      postTest: "Leadership post-test",
      evaluation: "Course satisfaction survey",
      evaluationAfter30Day: "Manager follow-up after 30 days",
      lifeCycleMonth: "24",
      courseType: "IN-HOUSE",
      courseGroup: "Management",
    },
    participants: "24",
    hours: "6",
    budget: "45000",
    trainer: "Somchai P.",
    provider: "HRD Center",
    owner: "Center HRD",
    ownerScope: "CENTER",
    ownerCompany: "HRD Center",
    batch: "1",
    location: "Training Room A",
    trainingDate: "2026-08-25",
    startTime: "09:00",
    endTime: "16:00",
    company: "All Companies",
    relatedCompanies: ["ATA", "ATFB", "NIC", "SATI", "SNF", "TEP"],
    status: "Planned",
    updatedAt: "2026-08-13",
  },
  {
    rollingId: "rolling-sample-003",
    scheduleGroupId: "rolling-group-sample-003",
    id: "oap-sample-003",
    sequence: 3,
    course: {
      code: "CRS-022",
      name: "Safety Basics",
      nameTh: "ความปลอดภัยในการทำงานพื้นฐาน",
      nameEn: "Safety Basics",
      objective: "Ensure employees understand workplace safety rules.",
      learningContent: "Safety rules, PPE, emergency response, incident reporting.",
      targetGroup: "All employees",
      methodology: "Classroom",
      preTest: "Safety awareness pre-test",
      postTest: "Safety awareness post-test",
      evaluation: "Safety course evaluation",
      evaluationAfter30Day: "Supervisor confirms behavior after 30 days",
      lifeCycleMonth: "12",
      courseType: "ATA-TC",
      courseGroup: "Safety",
    },
    participants: "40",
    hours: "4",
    budget: "18000",
    trainer: "Safety Specialist",
    provider: "ATA Safety Dept",
    owner: "ATA HRD",
    ownerScope: "FACTORY",
    ownerCompany: "ATA",
    batch: "1",
    location: "ATA Factory Training Room",
    trainingDate: "2026-08-28",
    startTime: "08:30",
    endTime: "12:30",
    company: "ATA",
    relatedCompanies: ["ATA"],
    status: "Planned",
    updatedAt: "2026-08-13",
  },
];

type RollingSessionForm = {
  id: string;
  batch: string;
  location: string;
  trainingDate: string;
  startTime: string;
  endTime: string;
};

type RollingForm = {
  oapId: string;
  sessions: RollingSessionForm[];
  relatedCompanies: string[];
};

const createEmptySession = (index = 0): RollingSessionForm => ({
  id: `session-${Date.now()}-${index}`,
  batch: String(index + 1),
  location: "",
  trainingDate: "",
  startTime: "09:00",
  endTime: "16:00",
});

const createEmptyForm = (): RollingForm => ({
  oapId: "",
  sessions: [createEmptySession()],
  relatedCompanies: [...rollingCompanyOptions],
});

export const getJobStatus = (trainingDate: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${trainingDate}T00:00:00`);
  return target < today ? "Completed" : "Rolling";
};

export default function TrainingRolling() {
  const user = useAuthenticatedUser();
  const userCompanyCode = profileValue(user?.companyCode);
  const isFactoryUser = user?.roleCode === "HRD_FACTORY";

  const [courses, setCourses] = useState<WorkflowCourse[]>(() =>
    readWorkflowCollection<WorkflowCourse>(TRAINING_WORKFLOW_KEYS.courses),
  );
  const [standards, setStandards] = useState<WorkflowStandard[]>(() =>
    readWorkflowCollection<WorkflowStandard>(TRAINING_WORKFLOW_KEYS.standards),
  );
  const [oapPlans, setOapPlans] = useState<WorkflowOapPlan[]>(() =>
    readWorkflowCollection<WorkflowOapPlan>(TRAINING_WORKFLOW_KEYS.oapPlans),
  );
  const [rollingPlans, setRollingPlans] = useState<RollingPlan[]>(() => {
    const loaded = readWorkflowCollection<RollingPlan>(TRAINING_WORKFLOW_KEYS.rollingPlans);
    if (loaded && loaded.length > 0) {
      return loaded;
    }
    writeWorkflowCollection(TRAINING_WORKFLOW_KEYS.rollingPlans, initialRollingPlans);
    return initialRollingPlans;
  });

  useEffect(() => {
    const syncData = () => {
      setCourses(readWorkflowCollection<WorkflowCourse>(TRAINING_WORKFLOW_KEYS.courses));
      setStandards(readWorkflowCollection<WorkflowStandard>(TRAINING_WORKFLOW_KEYS.standards));
      setOapPlans(readWorkflowCollection<WorkflowOapPlan>(TRAINING_WORKFLOW_KEYS.oapPlans));
      const loaded = readWorkflowCollection<RollingPlan>(TRAINING_WORKFLOW_KEYS.rollingPlans);
      if (loaded && loaded.length > 0) {
        setRollingPlans(loaded);
      }
    };
    window.addEventListener(TRAINING_WORKFLOW_EVENT, syncData);
    return () => window.removeEventListener(TRAINING_WORKFLOW_EVENT, syncData);
  }, []);

  const oapSources = useMemo<OapSource[]>(() => {
    const sourcesMap = new Map<string, OapSource>();

    // 1. OAP plans
    oapPlans.forEach((plan) => {
      const isOwner = isWorkflowOwner(plan.owner, plan.ownerCompany, user?.roleCode, userCompanyCode);
      if (!isOwner) return;
      if (isFactoryUser && userCompanyCode) {
        if (plan.ownerCompany !== userCompanyCode && plan.course.ownerCompany !== userCompanyCode) {
          return;
        }
      }
      const source: OapSource = {
        id: plan.id,
        course: {
          code: plan.course.courseCode,
          name: getCourseDisplayName(plan.course),
          nameTh: plan.course.courseNameTh,
          nameEn: plan.course.courseNameEn,
          objective: plan.course.objective,
          learningContent: plan.course.learningContent,
          targetGroup: plan.course.targetGroup,
          methodology: plan.course.methodology,
          preTest: plan.course.preTest,
          postTest: plan.course.postTest,
          evaluation: plan.course.evaluation,
          evaluationAfter30Day: plan.course.evaluationAfter30Day,
          lifeCycleMonth: plan.course.lifeCycleMonth,
          courseType: plan.course.courseType,
          courseGroup: plan.course.courseGroup,
        },
        participants: plan.participants || "20",
        hours: plan.hours || "6",
        budget: plan.budget || "15000",
        trainer: plan.trainer || "Pending trainer",
        provider: plan.provider || "HRD Center",
        owner: plan.createdBy,
        ownerScope: plan.owner,
        ownerCompany: plan.ownerCompany,
      };
      sourcesMap.set(plan.course.courseCode, source);
    });

    // 2. Course Master courses (including QT-001)
    courses.forEach((course) => {
      if (sourcesMap.has(course.courseCode)) return;
      const isOwner = isWorkflowOwner(course.owner, course.ownerCompany, user?.roleCode, userCompanyCode);
      if (!isOwner) return;
      if (isFactoryUser && userCompanyCode) {
        if (course.ownerCompany !== userCompanyCode) return;
      }
      const source: OapSource = {
        id: `course-src-${course.id}`,
        course: {
          code: course.courseCode,
          name: getCourseDisplayName(course),
          nameTh: course.courseNameTh,
          nameEn: course.courseNameEn,
          objective: course.objective,
          learningContent: course.learningContent,
          targetGroup: course.targetGroup,
          methodology: course.methodology,
          preTest: course.preTest,
          postTest: course.postTest,
          evaluation: course.evaluation,
          evaluationAfter30Day: course.evaluationAfter30Day,
          lifeCycleMonth: course.lifeCycleMonth,
          courseType: course.courseType,
          courseGroup: course.courseGroup,
        },
        participants: "20",
        hours: "6",
        budget: "15000",
        trainer: "HRD Trainer",
        provider: course.ownerCompany || "HRD Center",
        owner: course.createdBy || "System",
        ownerScope: course.owner,
        ownerCompany: course.ownerCompany || "HRD Center",
      };
      sourcesMap.set(course.courseCode, source);
    });

    // 3. Fallback mock sources
    if (sourcesMap.size === 0) {
      mockOapSources.forEach((source) => sourcesMap.set(source.course.code, source));
    }

    return Array.from(sourcesMap.values());
  }, [oapPlans, courses, user?.roleCode, userCompanyCode, isFactoryUser]);

  const [form, setForm] = useState<RollingForm>(createEmptyForm);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [editingPlanIds, setEditingPlanIds] = useState<string[]>([]);
  const [openDetailId, setOpenDetailId] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState("2026");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | RollingStatus>("all");
  const selectedOap =
    oapSources.find((source) => source.id === form.oapId) ?? null;

  const selectedCourseStandard = useMemo(() => {
    if (!selectedOap) return null;
    return (
      standards.find(
        (s) =>
          s.courseId === selectedOap.id ||
          s.courseCode === selectedOap.course.code ||
          s.courseName === selectedOap.course.name,
      ) ?? null
    );
  }, [selectedOap, standards]);

  const courseOptions: SearchableOption[] = useMemo(() => {
    return oapSources.map((source) => {
      const code = source.course.code;
      const name = source.course.name;
      const nameTh = source.course.nameTh || "";
      const nameEn = source.course.nameEn || "";
      const group = source.course.courseGroup;
      const type = source.course.courseType;
      const target = source.course.targetGroup;

      let subLabel = "";
      if (nameEn && nameEn !== name) {
        subLabel = nameEn;
      } else if (nameTh && nameTh !== name) {
        subLabel = nameTh;
      }
      if (group || type) {
        subLabel = subLabel ? `${subLabel} • ${group || type}` : `${group || type}`;
      }

      return {
        value: source.id,
        label: `[${code}] ${name}`,
        subLabel: subLabel || undefined,
        searchKey: `${code} ${name} ${nameTh} ${nameEn} ${group} ${type} ${target}`.toLowerCase(),
      };
    });
  }, [oapSources]);

  const scopedRollingPlans = useMemo(
    () =>
      rollingPlans.filter((plan) => {
        const isOwner = isWorkflowOwner(
          plan.ownerScope ?? (plan.owner === "admin.hrd" ? "CENTER" : "FACTORY"),
          plan.ownerCompany ?? plan.company,
          user?.roleCode,
          userCompanyCode,
        );
        if (!isOwner) return false;
        if (isFactoryUser && userCompanyCode) {
          const targetCompanies = getRollingPlanCompanies(plan);
          return (
            plan.company === userCompanyCode ||
            plan.ownerCompany === userCompanyCode ||
            targetCompanies.includes(userCompanyCode)
          );
        }
        return true;
      }),
    [rollingPlans, user?.roleCode, userCompanyCode, isFactoryUser],
  );

  const availableCompanies = useMemo(() => {
    const baseList = ["ATA", "TEP", "ATFB", "NIC", "SATI", "SNF"];
    const planCompanies = scopedRollingPlans
      .flatMap((p) => [p.company, p.ownerCompany, ...getRollingPlanCompanies(p)])
      .filter((c): c is string => Boolean(c) && c !== "HRD Center" && c !== "All Companies");
    const unique = Array.from(new Set([...baseList, ...planCompanies])).sort();
    return unique;
  }, [scopedRollingPlans]);

  const centerPlanCount = useMemo(
    () =>
      scopedRollingPlans.filter((plan) => {
        const targetCompanies = getRollingPlanCompanies(plan);
        return (
          plan.company === "HRD Center" ||
          plan.ownerCompany === "HRD Center" ||
          targetCompanies.includes("HRD Center") ||
          (plan.ownerScope === "CENTER" &&
            !targetCompanies.some((c) => rollingCompanyOptions.includes(c as any)))
        );
      }).length,
    [scopedRollingPlans],
  );

  const getCompanyPlanCount = (comp: string) => {
    return scopedRollingPlans.filter((plan) => {
      const targetCompanies = getRollingPlanCompanies(plan);
      return (
        plan.company === comp ||
        plan.ownerCompany === comp ||
        targetCompanies.includes(comp)
      );
    }).length;
  };

  const selectedMonthLabel =
    selectedMonth === "all"
      ? "All Year"
      : monthOptions.find((month) => month.value === selectedMonth)?.label ??
        "Selected month";

  const visiblePlans = useMemo(
    () =>
      [...scopedRollingPlans]
        .sort((a, b) => a.trainingDate.localeCompare(b.trainingDate))
        .map((plan, index) => ({ ...plan, sequence: index + 1 }))
        .filter((plan) =>
          plan.trainingDate.startsWith(`${selectedYear}-`) &&
          (selectedMonth === "all" ||
            plan.trainingDate.startsWith(`${selectedYear}-${selectedMonth}`)) &&
          (statusFilter === "all" || plan.status === statusFilter) &&
          [
            plan.course.name,
            plan.course.code,
            plan.batch,
            plan.location,
            formatRollingPlanCompanies(plan),
            plan.status,
            getJobStatus(plan.trainingDate),
          ]
            .join(" ")
            .toLowerCase()
            .includes(search.toLowerCase()),
        )
        .filter((plan) => {
          if (companyFilter === "all") {
            return true;
          }
          const targetCompanies = getRollingPlanCompanies(plan);
          if (companyFilter === "center" || companyFilter === "HRD Center") {
            return (
              plan.company === "HRD Center" ||
              plan.ownerCompany === "HRD Center" ||
              targetCompanies.includes("HRD Center") ||
              (plan.ownerScope === "CENTER" &&
                !targetCompanies.some((c) => rollingCompanyOptions.includes(c as any)))
            );
          }
          return (
            plan.company === companyFilter ||
            plan.ownerCompany === companyFilter ||
            targetCompanies.includes(companyFilter)
          );
        }),
    [scopedRollingPlans, search, selectedMonth, selectedYear, statusFilter, companyFilter],
  );

  const visiblePlanGroups = useMemo(() => {
    const groups = new Map<string, RollingPlan[]>();

    visiblePlans.forEach((plan) => {
      const groupId =
        plan.scheduleGroupId ??
        `legacy-${plan.id}-${plan.course.code}-${formatRollingPlanCompanies(plan)}`;
      groups.set(groupId, [...(groups.get(groupId) ?? []), plan]);
    });

    return [...groups.entries()].map(([id, plans], index) => ({
      id,
      sequence: index + 1,
      plans: [...plans].sort(
        (a, b) =>
          a.trainingDate.localeCompare(b.trainingDate) ||
          a.startTime.localeCompare(b.startTime),
      ),
    }));
  }, [visiblePlans]);

  const selectedGroup =
    visiblePlanGroups.find((group) => group.id === selectedGroupId) ?? null;

  const saveRollingPlans = (nextPlans: RollingPlan[]) => {
    setRollingPlans(nextPlans);
    writeWorkflowCollection(TRAINING_WORKFLOW_KEYS.rollingPlans, nextPlans);
  };

  const updateOap = (value: string) => {
    const matchedSource = oapSources.find((s) => s.id === value);
    const standard = standards.find(
      (s) =>
        s.courseId === value ||
        s.courseCode === matchedSource?.course.code ||
        s.courseName === matchedSource?.course.name,
    );

    let nextCompanies: string[] = form.relatedCompanies;
    if (user?.roleCode !== "HRD_FACTORY") {
      if (standard?.companies?.length) {
        nextCompanies = standard.companies;
      } else if (!form.relatedCompanies.length) {
        nextCompanies = [...rollingCompanyOptions];
      }
    }

    setForm((current) => ({
      ...current,
      oapId: value,
      relatedCompanies: nextCompanies,
    }));
  };

  const updateSession = (
    sessionId: string,
    field: Exclude<keyof RollingSessionForm, "id">,
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      sessions: current.sessions.map((session) =>
        session.id === sessionId ? { ...session, [field]: value } : session,
      ),
    }));
  };

  const addSession = () => {
    setForm((current) => {
      const lastSession = current.sessions[current.sessions.length - 1];
      const nextSession: RollingSessionForm = {
        id: `session-${Date.now()}-${current.sessions.length}`,
        batch: lastSession?.batch || "1",
        location: lastSession?.location || "",
        trainingDate: "",
        startTime: lastSession?.startTime || "09:00",
        endTime: lastSession?.endTime || "16:00",
      };
      return {
        ...current,
        sessions: [...current.sessions, nextSession],
      };
    });
  };

  const removeSession = (sessionId: string) => {
    setForm((current) => ({
      ...current,
      sessions:
        current.sessions.length === 1
          ? current.sessions
          : current.sessions.filter((session) => session.id !== sessionId),
    }));
  };

  const toggleCompany = (company: string) => {
    setForm((current) => {
      const isSelected = current.relatedCompanies.includes(company);
      const relatedCompanies = isSelected
        ? current.relatedCompanies.filter((item) => item !== company)
        : [...current.relatedCompanies, company];

      return { ...current, relatedCompanies };
    });
  };

  const toggleAllCompanies = () => {
    setForm((current) => ({
      ...current,
      relatedCompanies:
        current.relatedCompanies.length === rollingCompanyOptions.length
          ? []
          : [...rollingCompanyOptions],
    }));
  };

  const handleSave = () => {
    const selectedCompanies =
      user?.roleCode === "HRD_FACTORY"
        ? [userCompanyCode]
        : form.relatedCompanies;

    if (!selectedOap || selectedCompanies.length === 0) {
      return;
    }

    const now = Date.now();
    const today = new Date().toISOString().slice(0, 10);
    const company =
      selectedCompanies.length === rollingCompanyOptions.length
        ? "All Companies"
        : selectedCompanies[0];
    const existingPlan =
      rollingPlans.find((plan) => plan.rollingId === editingId) ?? null;
    const scheduleGroupId =
      existingPlan?.scheduleGroupId ?? `rolling-group-${now}`;
    const nextSessionPlans = form.sessions.map<RollingPlan>(
      (session, index) => {
        const matchedExistingPlan = rollingPlans.find(
          (plan) => plan.rollingId === session.id,
        );

        return {
          ...selectedOap,
          rollingId: matchedExistingPlan
            ? matchedExistingPlan.rollingId
            : index === 0 && existingPlan
              ? existingPlan.rollingId
              : `rolling-${now}-${index}`,
          scheduleGroupId,
          sequence: matchedExistingPlan
            ? matchedExistingPlan.sequence
            : index === 0 && existingPlan
              ? existingPlan.sequence
              : scopedRollingPlans.length + index + 1,
          batch: session.batch.trim() || `Batch ${index + 1}`,
          location: session.location.trim() || "Pending location",
          trainingDate: session.trainingDate || today,
          startTime: session.startTime || "09:00",
          endTime: session.endTime || "16:00",
          company,
          relatedCompanies: selectedCompanies,
          status:
            matchedExistingPlan?.status ??
            (index === 0 && existingPlan ? existingPlan.status : "Planning"),
          updatedAt: today,
        };
      },
    );

    if (existingPlan) {
      const replacedPlanIds = new Set(
        editingPlanIds.length > 0 ? editingPlanIds : [existingPlan.rollingId],
      );
      saveRollingPlans([
        ...nextSessionPlans,
        ...rollingPlans.filter((plan) => !replacedPlanIds.has(plan.rollingId)),
      ]);
    } else {
      saveRollingPlans([...nextSessionPlans, ...rollingPlans]);
    }

    setEditingId("");
    setEditingPlanIds([]);
    setForm(createEmptyForm());
    setIsNewOpen(false);
  };

  const handleEdit = (plan: RollingPlan) => {
    if (!canModifyPlan(plan)) return;
    const matchedOap = oapSources.find((source) => source.course.code === plan.course.code);
    setEditingId(plan.rollingId);
    setEditingPlanIds([plan.rollingId]);
    setForm({
      oapId: matchedOap?.id ?? "",
      sessions: [
        {
          id: plan.rollingId,
          batch: plan.batch,
          location: plan.location,
          trainingDate: plan.trainingDate,
          startTime: plan.startTime,
          endTime: plan.endTime,
        },
      ],
      relatedCompanies: getRollingPlanCompanies(plan),
    });
    setIsNewOpen(true);
    setOpenDetailId("");
  };

  const handleEditGroup = (groupPlans: RollingPlan[]) => {
    const [firstPlan] = groupPlans;
    if (!firstPlan) {
      return;
    }
    if (!canModifyGroup(groupPlans)) return;

    const matchedOap = oapSources.find(
      (source) => source.course.code === firstPlan.course.code,
    );
    setEditingId(firstPlan.rollingId);
    setEditingPlanIds(groupPlans.map((plan) => plan.rollingId));
    setForm({
      oapId: matchedOap?.id ?? "",
      sessions: groupPlans.map((plan) => ({
        id: plan.rollingId,
        batch: plan.batch,
        location: plan.location,
        trainingDate: plan.trainingDate,
        startTime: plan.startTime,
        endTime: plan.endTime,
      })),
      relatedCompanies: getRollingPlanCompanies(firstPlan),
    });
    setIsNewOpen(true);
    setOpenDetailId("");
  };

  const handleDelete = (rollingId: string) => {
    const target = rollingPlans.find((p) => p.rollingId === rollingId);
    if (target && !canModifyPlan(target)) return;
    saveRollingPlans(rollingPlans.filter((plan) => plan.rollingId !== rollingId));
    if (openDetailId === rollingId) {
      setOpenDetailId("");
    }
    if (editingId === rollingId) {
      setEditingId("");
      setEditingPlanIds([]);
      setForm(createEmptyForm());
      setIsNewOpen(false);
    }
  };

  const handleRefresh = () => {
    setRollingPlans(
      readWorkflowCollection<RollingPlan>(TRAINING_WORKFLOW_KEYS.rollingPlans),
    );
    setStandards(
      readWorkflowCollection<WorkflowStandard>(TRAINING_WORKFLOW_KEYS.standards),
    );
    setForm(createEmptyForm());
    setIsNewOpen(false);
    setEditingId("");
    setEditingPlanIds([]);
    setOpenDetailId("");
    setSelectedGroupId("");
    setSearch("");
    setCompanyFilter("all");
    setSelectedYear("2026");
    setSelectedMonth("all");
    setStatusFilter("all");
  };

  const handleNew = () => {
    setEditingId("");
    setEditingPlanIds([]);
    setForm({
      ...createEmptyForm(),
      relatedCompanies:
        user?.roleCode === "HRD_FACTORY"
          ? [userCompanyCode]
          : [...rollingCompanyOptions],
    });
    setOpenDetailId("");
    setSelectedGroupId("");
    setIsNewOpen(true);
  };

  /** Returns false when a Center user tries to act on a factory-owned plan */
  const canModifyPlan = (plan: RollingPlan): boolean => {
    if (user?.roleCode !== "HRD_CENTER") return true;
    const isFactoryPlan =
      plan.ownerScope === "FACTORY" ||
      (plan.ownerCompany !== undefined &&
        plan.ownerCompany !== "HRD Center" &&
        plan.ownerCompany !== "All Companies" &&
        plan.ownerScope !== "CENTER");
    return !isFactoryPlan;
  };

  const canModifyGroup = (groupPlans: RollingPlan[]): boolean =>
    groupPlans.every((plan) => canModifyPlan(plan));

  const handleConfirm = (rollingId: string) => {
    const target = rollingPlans.find((p) => p.rollingId === rollingId);
    if (target && !canModifyPlan(target)) return;
    saveRollingPlans(
      rollingPlans.map((plan) =>
        plan.rollingId === rollingId ? { ...plan, status: "Planned" } : plan,
      ),
    );
  };

  const handleConfirmGroup = (groupPlans: RollingPlan[]) => {
    if (!canModifyGroup(groupPlans)) return;
    const planIds = new Set(groupPlans.map((plan) => plan.rollingId));
    saveRollingPlans(
      rollingPlans.map((plan) =>
        planIds.has(plan.rollingId) ? { ...plan, status: "Planned" } : plan,
      ),
    );
  };

  const handleDeleteGroup = (groupId: string, groupPlans: RollingPlan[]) => {
    const planIds = new Set(groupPlans.map((plan) => plan.rollingId));
    saveRollingPlans(
      rollingPlans.filter((plan) => !planIds.has(plan.rollingId)),
    );
    setOpenDetailId((current) => (current === groupId ? "" : current));
    setSelectedGroupId((current) => (current === groupId ? "" : current));

    if (editingId && planIds.has(editingId)) {
      setEditingId("");
      setEditingPlanIds([]);
      setForm(createEmptyForm());
      setIsNewOpen(false);
    }
  };

  return (
    <section className={styles.page} aria-label="Training Rolling monthly plan">
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>{trainingRollingModule.subtitle}</p>
          <h2>{trainingRollingModule.title}</h2>
          <p>{trainingRollingModule.description}</p>
        </div>
      </section>

      <section className={styles.workspace}>
        <div className={styles.workspaceHeader}>
          <div>
            <p className={styles.kicker}>Monthly view</p>
            <h3>{selectedMonthLabel} {selectedYear} rolling schedule</h3>
          </div>
          <span>{visiblePlans.length} shown</span>
        </div>

        {isFactoryUser ? (
          <div className={styles.companyFilterBar}>
            <div className={styles.companyFilterHeader}>
              <span>🏢 ขอบเขตสิทธิ์โรงงาน (Factory Scope)</span>
            </div>
            <div className={styles.companyFilterBtnGroup}>
              <span className={`${styles.companyFilterBtn} ${styles.companyFilterBtnActive}`}>
                🏢 โรงงานของคุณ ({userCompanyCode || "Factory Scope"})
                <span className={styles.companyCountBadge}>{scopedRollingPlans.length}</span>
              </span>
            </div>
          </div>
        ) : (
          <div className={styles.companyFilterBar}>
            <div className={styles.companyFilterHeader}>
              <span>🏢 เลือกดูตามบริษัท (Company Filter)</span>
            </div>
            <div className={styles.companyFilterBtnGroup}>
              <button
                type="button"
                className={`${styles.companyFilterBtn} ${
                  companyFilter === "all" ? styles.companyFilterBtnActive : ""
                }`}
                onClick={() => setCompanyFilter("all")}
              >
                🌐 ทุกบริษัท (All)
                <span className={styles.companyCountBadge}>{scopedRollingPlans.length}</span>
              </button>

              <button
                type="button"
                className={`${styles.companyFilterBtn} ${
                  companyFilter === "center" ? styles.companyFilterBtnActive : ""
                }`}
                onClick={() => setCompanyFilter("center")}
              >
                🏢 ของตัวเอง ({userCompanyCode && userCompanyCode !== "HRD Center" ? userCompanyCode : "Center"})
                <span className={styles.companyCountBadge}>{centerPlanCount}</span>
              </button>

              {availableCompanies.map((comp) => {
                const count = getCompanyPlanCount(comp);
                return (
                  <button
                    key={comp}
                    type="button"
                    className={`${styles.companyFilterBtn} ${
                      companyFilter === comp ? styles.companyFilterBtnActive : ""
                    }`}
                    onClick={() => setCompanyFilter(comp)}
                  >
                    {comp}
                    <span className={styles.companyCountBadge}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className={styles.toolbar}>
          <label className={styles.filterBox}>
            <span>Company</span>
            <select
              disabled={isFactoryUser}
              value={isFactoryUser ? (userCompanyCode || "factory") : companyFilter}
              onChange={(event) => setCompanyFilter(event.target.value)}
            >
              {isFactoryUser ? (
                <option value={userCompanyCode || "factory"}>
                  {userCompanyCode || "Factory Scope"} (โรงงานของคุณ)
                </option>
              ) : (
                <>
                  <option value="all">ทุกบริษัท (All Companies)</option>
                  <option value="center">
                    ของตัวเอง ({userCompanyCode && userCompanyCode !== "HRD Center" ? userCompanyCode : "Center"})
                  </option>
                  {availableCompanies.map((comp) => (
                    <option key={comp} value={comp}>
                      {comp}
                    </option>
                  ))}
                </>
              )}
            </select>
          </label>
          <label className={styles.filterBox}>
            <span>Year</span>
            <select value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)}>
              {yearOptions.map((year) => <option key={year}>{year}</option>)}
            </select>
          </label>
          <label className={styles.filterBox}>
            <span>Month</span>
            <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
              <option value="all">All Year</option>
              {monthOptions.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
            </select>
          </label>
          <label className={styles.filterBox}>
            <span>Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | RollingStatus)}>
              <option value="all">All status</option>
              <option value="Planning">Planning</option>
              <option value="Planned">Planned</option>
            </select>
          </label>
          <label className={styles.searchBox}>
            <span>Search</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Course, company, location, status" />
          </label>
          <div className={styles.toolbarActions}>
            <button
              className={styles.primaryButton}
              disabled={oapSources.length === 0}
              title={oapSources.length === 0 ? "Confirm a Training OAP before creating a rolling plan." : "Create monthly rolling plan"}
              type="button"
              onClick={handleNew}
            >
              New
            </button>
            <button
              className={styles.secondaryButton}
              disabled={!selectedGroup}
              type="button"
              onClick={() => selectedGroup && handleEditGroup(selectedGroup.plans)}
            >
              Edit
            </button>
            <button
              className={styles.dangerButton}
              disabled={!selectedGroup}
              type="button"
              onClick={() =>
                selectedGroup &&
                handleDeleteGroup(selectedGroup.id, selectedGroup.plans)
              }
            >
              Delete
            </button>
            <button className={styles.secondaryButton} type="button" onClick={handleRefresh}>Refresh</button>
          </div>
        </div>

        {isNewOpen ? (
          <section className={styles.formPanel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.kicker}>New monthly plan</p>
                <h3>{editingId ? "Edit Training Rolling" : "Create Training Rolling"}</h3>
              </div>
              <button className={styles.closeButton} type="button" onClick={() => { setEditingPlanIds([]); setIsNewOpen(false); }}>Close</button>
            </div>
            <div className={styles.formGrid}>
              <div className={styles.fullField}>
                <span className={styles.fieldLabel}>
                  Course Name (หลักสูตร) <span className={styles.required}>*</span>
                </span>
                <SearchableSelectField
                  value={form.oapId}
                  placeholder="พิมพ์ค้นหาหลักสูตร (ไทย / English / Code)..."
                  options={courseOptions}
                  onChange={updateOap}
                />
              </div>
              <label>Participants<input disabled value={selectedOap?.participants ?? ""} /></label>
              <label>Training Hours<input disabled value={selectedOap?.hours ?? ""} /></label>
              <label>Budget<input disabled value={selectedOap ? Number(selectedOap.budget).toLocaleString("en-US") : ""} /></label>
              <label>Trainer<input disabled value={selectedOap?.trainer ?? ""} /></label>
              <label>Institute / Provider<input disabled value={selectedOap?.provider ?? ""} /></label>

              <div className={`${styles.fullField} ${styles.sessionSection}`}>
                <div className={styles.sectionHeader}>
                  <div>
                    <strong>Training sessions</strong>
                    <span>Add another session when the course has a different batch, date, time, or location.</span>
                  </div>
                  <button className={styles.addSessionButton} disabled={!selectedOap} type="button" onClick={addSession}>
                    Add session
                  </button>
                </div>

                <div className={styles.sessionList}>
                  {form.sessions.map((session, index) => (
                    <article className={styles.sessionCard} key={session.id}>
                      <div className={styles.sessionHeader}>
                        <strong>Session {index + 1}</strong>
                        <button
                          className={styles.removeSessionButton}
                          disabled={!selectedOap || form.sessions.length === 1}
                          type="button"
                          onClick={() => removeSession(session.id)}
                        >
                          Remove
                        </button>
                      </div>
                      <div className={styles.sessionGrid}>
                        <label>
                          <span>Batch <span className={styles.required}>*</span></span>
                          <input
                            disabled={!selectedOap}
                            value={session.batch}
                            onChange={(event) =>
                              updateSession(session.id, "batch", event.target.value)
                            }
                          />
                        </label>
                        <label>
                          <span>Location <span className={styles.required}>*</span></span>
                          <input
                            disabled={!selectedOap}
                            value={session.location}
                            onChange={(event) =>
                              updateSession(session.id, "location", event.target.value)
                            }
                          />
                        </label>

                        <label>
                          <span>Training Date <span className={styles.required}>*</span></span>
                          <input
                            disabled={!selectedOap}
                            type="date"
                            value={session.trainingDate}
                            onChange={(event) =>
                              updateSession(session.id, "trainingDate", event.target.value)
                            }
                          />
                        </label>
                        <label>
                          <span>Start Time <span className={styles.required}>*</span></span>
                          <input
                            disabled={!selectedOap}
                            type="time"
                            value={session.startTime}
                            onChange={(event) =>
                              updateSession(session.id, "startTime", event.target.value)
                            }
                          />
                        </label>
                        <label>
                          <span>End Time <span className={styles.required}>*</span></span>
                          <input
                            disabled={!selectedOap}
                            type="time"
                            value={session.endTime}
                            onChange={(event) =>
                              updateSession(session.id, "endTime", event.target.value)
                            }
                          />
                        </label>
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              <fieldset className={`${styles.fullField} ${styles.companyField}`}>
                <legend>Related Companies <span className={styles.required}>*</span></legend>
                <p>Select every company whose employees can join these sessions.</p>
                <div className={styles.companyChecklist}>
                  <label>
                    <input
                      checked={
                        form.relatedCompanies.length ===
                        rollingCompanyOptions.length
                      }
                      disabled={!selectedOap || user?.roleCode === "HRD_FACTORY"}
                      type="checkbox"
                      onChange={toggleAllCompanies}
                    />
                    <span>All Companies</span>
                  </label>
                  {rollingCompanyOptions.map((company) => (
                    <label key={company}>
                      <input
                        checked={form.relatedCompanies.includes(company)}
                        disabled={!selectedOap || user?.roleCode === "HRD_FACTORY"}
                        type="checkbox"
                        onChange={() => toggleCompany(company)}
                      />
                      <span>{company}</span>
                    </label>
                  ))}
                </div>
                {form.relatedCompanies.length === 0 ? (
                  <small>Please select at least one related company.</small>
                ) : (
                  <small>{form.relatedCompanies.length} companies selected</small>
                )}
              </fieldset>
            </div>
            {selectedOap ? (
              <div className={styles.coursePreview}>
                <div className={styles.previewHeader}>
                  <div className={styles.previewTitleWrap}>
                    <div className={styles.previewTitleMain}>
                      <span className={styles.previewCodeBadge}>{selectedOap.course.code}</span>
                      <strong>{selectedOap.course.name}</strong>
                    </div>
                  </div>
                  <div className={styles.previewBadges}>
                    {selectedOap.course.courseType ? (
                      <span className={`${styles.previewBadge} ${styles.previewBadgeHighlight}`}>
                        🏷️ {selectedOap.course.courseType}
                      </span>
                    ) : null}
                    {selectedOap.course.courseGroup ? (
                      <span className={styles.previewBadge}>
                        📂 {selectedOap.course.courseGroup}
                      </span>
                    ) : null}
                    <span className={styles.previewBadge}>
                      ⏱️ {selectedOap.course.lifeCycleMonth || "12"} Months
                    </span>
                    <span className={styles.previewBadge}>
                      🏢 {selectedOap.ownerCompany || selectedOap.ownerScope}
                    </span>
                  </div>
                </div>

                <div className={styles.previewSections}>
                  <div className={styles.previewCard}>
                    <div className={styles.previewCardHeader}>
                      <span>🎯 Objectives & Content</span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>Objective</span>
                      <span className={styles.previewFieldValue}>{selectedOap.course.objective || "-"}</span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>Learning Content</span>
                      <span className={styles.previewFieldValue} style={{ whiteSpace: "pre-line" }}>
                        {selectedOap.course.learningContent || "-"}
                      </span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>Methodology</span>
                      <span className={styles.previewFieldValue}>{selectedOap.course.methodology || "-"}</span>
                    </div>
                  </div>

                  <div className={styles.previewCard}>
                    <div className={styles.previewCardHeader}>
                      <span>👥 Target & Course Standard</span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>Target Group (Course)</span>
                      <span className={styles.previewFieldValue}>{selectedOap.course.targetGroup || "-"}</span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>Target Companies</span>
                      <span className={styles.previewFieldValue}>
                        {selectedCourseStandard?.companies?.length
                          ? selectedCourseStandard.companies.join(", ")
                          : "All Companies (ทุกบริษัท)"}
                      </span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>Target Function (หน่วยงาน)</span>
                      <span className={styles.previewFieldValue}>
                        {selectedCourseStandard?.functionName || "All Function (ทุกหน่วยงาน)"}
                      </span>
                    </div>
                    {selectedCourseStandard?.section ? (
                      <div className={styles.previewFieldRow}>
                        <span className={styles.previewFieldLabel}>Target Section (แผนก)</span>
                        <span className={styles.previewFieldValue}>{selectedCourseStandard.section}</span>
                      </div>
                    ) : null}
                    {selectedCourseStandard?.department ? (
                      <div className={styles.previewFieldRow}>
                        <span className={styles.previewFieldLabel}>Target Department (ส่วน)</span>
                        <span className={styles.previewFieldValue}>{selectedCourseStandard.department}</span>
                      </div>
                    ) : null}
                    {selectedCourseStandard?.division ? (
                      <div className={styles.previewFieldRow}>
                        <span className={styles.previewFieldLabel}>Target Division (ฝ่าย)</span>
                        <span className={styles.previewFieldValue}>{selectedCourseStandard.division}</span>
                      </div>
                    ) : null}
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>Target Positions</span>
                      <span className={styles.previewFieldValue}>
                        {selectedCourseStandard?.positions?.length
                          ? selectedCourseStandard.positions.join(", ")
                          : "All positions in function"}
                      </span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>Target Levels</span>
                      <span className={styles.previewFieldValue}>
                        {selectedCourseStandard?.levels?.length
                          ? selectedCourseStandard.levels.join(", ")
                          : "All levels"}
                      </span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>OAP Target & Budget</span>
                      <span className={styles.previewFieldValue}>
                        {selectedOap.participants} pax / {selectedOap.hours} hrs · ฿{Number(selectedOap.budget).toLocaleString("en-US")}
                      </span>
                    </div>
                  </div>

                  <div className={`${styles.previewCard} ${styles.previewCardFull}`}>
                    <div className={styles.previewCardHeader}>
                      <span>📋 Assessments & Evaluation</span>
                    </div>
                    <div className={styles.assessmentGrid}>
                      <div className={styles.assessmentItem}>
                        <span className={styles.previewFieldLabel}>Pre-Test</span>
                        <strong className={styles.previewFieldValue}>{selectedOap.course.preTest || "None"}</strong>
                      </div>
                      <div className={styles.assessmentItem}>
                        <span className={styles.previewFieldLabel}>Post-Test</span>
                        <strong className={styles.previewFieldValue}>{selectedOap.course.postTest || "None"}</strong>
                      </div>
                      <div className={styles.assessmentItem}>
                        <span className={styles.previewFieldLabel}>Course Evaluation</span>
                        <strong className={styles.previewFieldValue}>{selectedOap.course.evaluation || "Standard"}</strong>
                      </div>
                      <div className={styles.assessmentItem}>
                        <span className={styles.previewFieldLabel}>30-Day Follow-Up</span>
                        <strong className={styles.previewFieldValue}>{selectedOap.course.evaluationAfter30Day || "Standard"}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            <div className={styles.formActions}>
              <button
                className={styles.primaryButton}
                disabled={!selectedOap || form.relatedCompanies.length === 0}
                type="button"
                onClick={handleSave}
              >
                {editingId ? "Save changes" : "Save Draft"}
              </button>
              <button className={styles.secondaryButton} type="button" onClick={() => { setEditingId(""); setEditingPlanIds([]); setForm(createEmptyForm()); setIsNewOpen(false); }}>Cancel</button>
            </div>
          </section>
        ) : null}

        <div className={styles.tableWrap}>
          <table className={styles.rollingTable}>
            <thead>
              <tr>
                <th>Seq.</th>
                <th>Course Name</th>
                <th>Status</th>
                <th>Job Status</th>
                <th>Actions</th>
                <th>Batch / Training Dates</th>
                <th>Company</th>
              </tr>
            </thead>
            <tbody>
              {visiblePlanGroups.map((group) => {
                const plan = group.plans[0];
                const isOpen = openDetailId === group.id;
                const dates = [
                  ...new Set(group.plans.map((item) => item.trainingDate)),
                ];
                const allPublished = group.plans.every(
                  (item) => item.status === "Planned",
                );
                const groupStatus: RollingStatus = allPublished
                  ? "Planned"
                  : "Planning";
                const groupJobStatus = group.plans.some(
                  (item) => getJobStatus(item.trainingDate) === "Rolling",
                )
                  ? "Rolling"
                  : "Completed";

                return (
                  <Fragment key={group.id}>
                    <tr className={group.id === selectedGroupId ? styles.selectedRow : undefined}>
                      <td>
                        <label className={styles.selectionControl}>
                          <input
                            aria-label={`Select ${plan.course.code}`}
                            checked={group.id === selectedGroupId}
                            name="selected-rolling-group"
                            type="radio"
                            onChange={() => setSelectedGroupId(group.id)}
                          />
                          <span>{group.sequence}</span>
                        </label>
                      </td>
                      <td>
                        <strong>{plan.course.name}</strong>
                        <span>{plan.course.code}</span>
                        {plan.ownerScope === "CENTER" || plan.ownerCompany === "HRD Center" || plan.owner === "Center HRD" || plan.provider === "HRD Center" ? (
                          <div>
                            <span className={styles.creatorBadgeCenter}>
                              🏢 จัดหลักสูตรโดย HRD Center
                            </span>
                          </div>
                        ) : (
                          <div>
                            <span className={styles.creatorBadgeFactory}>
                              🏬 จัดหลักสูตรโดย {plan.ownerCompany || plan.company}
                            </span>
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`${styles.statusPill} ${styles[`status${groupStatus}`]}`}>
                          <span className={styles.statusDot} />
                          {groupStatus === "Planned" ? "วางแผนแล้ว" : groupStatus === "Planning" ? "รอวางแผน" : groupStatus === "Cancel" ? "ยกเลิก" : groupStatus}
                        </span>
                      </td>
                      <td><span className={`${styles.jobPill} ${styles[`job${groupJobStatus}`]}`}>{groupJobStatus}</span></td>
                      <td className={styles.actionCell}>
                        <div className={styles.actionButtons}>
                          <button className={styles.detailButton} type="button" onClick={() => setOpenDetailId(isOpen ? "" : group.id)}>
                            {isOpen ? "Hide" : "Details"}
                          </button>
                          <button
                            className={styles.primaryButton}
                            disabled={allPublished || !canModifyGroup(group.plans)}
                            title={!canModifyGroup(group.plans) ? "ไม่สามารถ Publish แผนของโรงงานได้" : undefined}
                            type="button"
                            onClick={() => handleConfirmGroup(group.plans)}
                          >
                            {allPublished ? "All published" : !canModifyGroup(group.plans) ? "Factory plan" : "Publish all"}
                          </button>
                        </div>
                      </td>
                      <td>
                        <strong>{group.plans.length} sessions</strong>
                        <span>
                          {dates.length === 1
                            ? dates[0]
                            : `${dates.length} dates`}{" "}
                          / Batches: {group.plans.map((item) => item.batch).join(", ")}
                        </span>
                      </td>
                      <td>{formatRollingPlanCompanies(plan)}</td>
                    </tr>
                    {isOpen ? (
                      <tr className={styles.detailRow}>
                        <td colSpan={7}>
                          <section className={styles.detailPanel}>
                            <div className={styles.panelHeader}>
                              <div>
                                <p className={styles.kicker}>Rolling detail</p>
                                <h3>{plan.course.name}</h3>
                              </div>
                              <button className={styles.closeButton} type="button" onClick={() => setOpenDetailId("")}>Close</button>
                            </div>
                            <div className={styles.detailGrid}>
                              <div><span>Course Sequence</span><strong>{group.sequence}</strong></div>
                              <div><span>Sessions</span><strong>{group.plans.length}</strong></div>
                              <div><span>Status</span><strong>{groupStatus}</strong></div>
                              <div><span>Job Status</span><strong>{groupJobStatus}</strong></div>
                              <div><span>Course Code</span><strong>{plan.course.code}</strong></div>
                              <div><span>Course Type</span><strong>{plan.course.courseType}</strong></div>
                              <div><span>Course Group</span><strong>{plan.course.courseGroup}</strong></div>
                              <div><span>Objective</span><p>{plan.course.objective}</p></div>
                              <div><span>Learning Content</span><p>{plan.course.learningContent}</p></div>
                              <div><span>Target Group</span><p>{plan.course.targetGroup}</p></div>
                              <div><span>Methodology</span><p>{plan.course.methodology}</p></div>
                              <div><span>Pre test</span><strong>{plan.course.preTest}</strong></div>
                              <div><span>Post test</span><strong>{plan.course.postTest}</strong></div>
                              <div><span>Evaluation</span><strong>{plan.course.evaluation}</strong></div>
                              <div><span>Evaluation After 30 Day</span><strong>{plan.course.evaluationAfter30Day}</strong></div>
                              <div><span>Life Cycle (Month)</span><strong>{plan.course.lifeCycleMonth}</strong></div>
                              <div><span>Budget</span><strong>{Number(plan.budget).toLocaleString("en-US")}</strong></div>
                              <div><span>Target Companies</span><strong>{formatRollingPlanCompanies(plan)}</strong></div>
                              <div><span>Participants</span><strong>{plan.participants}</strong></div>
                              <div><span>Training Hours</span><strong>{plan.hours}</strong></div>
                              <div><span>Trainer</span><strong>{plan.trainer}</strong></div>
                              <div><span>Provider</span><strong>{plan.provider}</strong></div>
                              <div>
                                <span>Created By (ผู้จัดอบรม)</span>
                                <strong>
                                  {plan.ownerScope === "CENTER" || plan.ownerCompany === "HRD Center" || plan.owner === "Center HRD"
                                    ? `🏢 HRD Center (ส่วนกลางจัดอบรมให้บริษัท ${formatRollingPlanCompanies(plan)})`
                                    : `🏬 ${plan.ownerCompany || plan.company} (โรงงานจัดอบรมเอง)`}
                                </strong>
                              </div>
                              <div><span>Last Updated</span><strong>{plan.updatedAt}</strong></div>
                            </div>

                            <div className={styles.sessionDetailHeader}>
                              <div>
                                <strong>Session schedule</strong>
                                <span>Edit, publish, or remove each session independently.</span>
                              </div>
                              <span>{group.plans.length} sessions</span>
                            </div>
                            <div className={styles.sessionSummaryList}>
                              {group.plans.map((session, index) => (
                                <article key={session.rollingId}>
                                  <div>
                                    <span>Session {index + 1}</span>
                                    <strong>{session.batch}</strong>
                                  </div>
                                  <div>
                                    <span>Training Date</span>
                                    <strong>{session.trainingDate}</strong>
                                  </div>
                                  <div>
                                    <span>Time</span>
                                    <strong>{session.startTime} - {session.endTime}</strong>
                                  </div>
                                  <div>
                                    <span>Location</span>
                                    <strong>{session.location}</strong>
                                  </div>
                                  <div>
                                    <span>Status</span>
                                    <strong>
                                      <span className={`${styles.statusPill} ${styles[`status${session.status}`]}`}>
                                        <span className={styles.statusDot} />
                                        {session.status === "Planned" ? "วางแผนแล้ว" : session.status === "Planning" ? "รอวางแผน" : session.status === "Cancel" ? "ยกเลิก" : session.status}
                                      </span>
                                    </strong>
                                  </div>
                                  <div className={styles.sessionActions}>
                                    <button
                                      className={styles.detailButton}
                                      disabled={!canModifyPlan(session)}
                                      title={!canModifyPlan(session) ? "ไม่สามารถแก้ไขแผนของโรงงานได้" : undefined}
                                      type="button"
                                      onClick={() => handleEdit(session)}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      className={styles.primaryButton}
                                      disabled={session.status === "Planned" || !canModifyPlan(session)}
                                      title={!canModifyPlan(session) ? "ไม่สามารถ Publish แผนของโรงงานได้" : undefined}
                                      type="button"
                                      onClick={() => handleConfirm(session.rollingId)}
                                    >
                                      {session.status === "Planned" ? "Published" : !canModifyPlan(session) ? "Factory plan" : "Publish"}
                                    </button>
                                    <button
                                      className={styles.dangerButton}
                                      disabled={!canModifyPlan(session)}
                                      title={!canModifyPlan(session) ? "ไม่สามารถลบแผนของโรงงานได้" : undefined}
                                      type="button"
                                      onClick={() => handleDelete(session.rollingId)}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </article>
                              ))}
                            </div>
                          </section>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {visiblePlanGroups.length === 0 ? (
            <div className={styles.emptyState}>
              <strong>{oapSources.length === 0 ? "No confirmed Training OAP" : "No rolling plans found"}</strong>
              <span>
                {oapSources.length === 0
                  ? "Open Training OAP and click Confirm on an annual plan before creating a monthly rolling plan."
                  : "Try changing the month, year, status, or search text."}
              </span>
            </div>
          ) : null}
        </div>
      </section>
    </section>
  );
}
