"use client";

import { useMemo, useState } from "react";
import styles from "./CourseStandard.module.css";

export const courseStandardModule = {
  title: "Course Standard",
  subtitle: "Course standard matrix",
  description: "Define required training by course, function, position, and employee level.",
} as const;

type CourseMasterOption = {
  code: string;
  name: string;
};

type CourseStandardRecord = {
  id: string;
  courseCode: string;
  courseName: string;
  functionName: string;
  positions: string[];
  levels: string[];
};

const courseMasterOptions: CourseMasterOption[] = [
  { code: "CRS-001", name: "Leadership Essentials" },
  { code: "CRS-022", name: "Safety Basics" },
  { code: "CRS-030", name: "Data Privacy Awareness" },
  { code: "CRS-041", name: "Quality Control Basics" },
];

const positionColumns = ["Manager", "SH", "Engineer", "Office", "Staff", "Foreman", "Leader", "Operator"] as const;
const positionChecklist = ["Manager Up", "SH", "Engineer", "Office", "Staff", "Force man", "Leader", "Operator"] as const;
const levelColumns = ["M3", "M2", "M1", "S4", "S3", "S2", "S1", "O5", "O4", "O3", "O2", "O1"] as const;

const initialStandards: CourseStandardRecord[] = [
  {
    id: "standard-001",
    courseCode: "CRS-001",
    courseName: "Leadership Essentials",
    functionName: "Management",
    positions: ["Manager", "SH", "Foreman", "Leader"],
    levels: ["M3", "M2", "M1", "S4"],
  },
  {
    id: "standard-002",
    courseCode: "CRS-022",
    courseName: "Safety Basics",
    functionName: "Production",
    positions: ["Staff", "Foreman", "Leader", "Operator"],
    levels: ["S3", "S2", "S1", "O5", "O4", "O3", "O2", "O1"],
  },
  {
    id: "standard-003",
    courseCode: "CRS-041",
    courseName: "Quality Control Basics",
    functionName: "Quality",
    positions: ["Engineer", "Staff", "Operator"],
    levels: ["S4", "S3", "S2", "O4", "O3"],
  },
];

const normalizePosition = (position: string) => {
  if (position === "Manager Up") {
    return "Manager";
  }

  if (position === "Force man") {
    return "Foreman";
  }

  return position;
};

export default function CourseStandard() {
  const [standards, setStandards] = useState<CourseStandardRecord[]>(initialStandards);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [courseCode, setCourseCode] = useState(courseMasterOptions[0]?.code ?? "");
  const [functionName, setFunctionName] = useState("");
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const selectedCourse = courseMasterOptions.find((course) => course.code === courseCode) ?? courseMasterOptions[0];
  const visibleStandards = useMemo(
    () =>
      standards.filter((standard) =>
        [standard.courseCode, standard.courseName, standard.functionName]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [standards, search],
  );

  const toggleItem = (value: string, selectedValues: string[], setSelectedValues: (next: string[]) => void) => {
    setSelectedValues(
      selectedValues.includes(value)
        ? selectedValues.filter((item) => item !== value)
        : [...selectedValues, value],
    );
  };

  const handleNew = () => {
    setIsNewOpen(true);
    setCourseCode(courseMasterOptions[0]?.code ?? "");
    setFunctionName("");
    setSelectedPositions([]);
    setSelectedLevels([]);
  };

  const handleSave = () => {
    if (!selectedCourse || !functionName.trim()) {
      return;
    }

    const nextRecord: CourseStandardRecord = {
      id: `standard-${Date.now()}`,
      courseCode: selectedCourse.code,
      courseName: selectedCourse.name,
      functionName: functionName.trim(),
      positions: selectedPositions.map(normalizePosition),
      levels: selectedLevels,
    };

    setStandards((current) => [nextRecord, ...current]);
    setIsNewOpen(false);
  };

  const handleRefresh = () => {
    setStandards(initialStandards);
    setSearch("");
    setIsNewOpen(false);
  };

  return (
    <section className={styles.page} aria-label="Course Standard management">
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>{courseStandardModule.subtitle}</p>
          <h2>{courseStandardModule.title}</h2>
          <p>{courseStandardModule.description}</p>
        </div>
      </section>

      <section className={styles.workspace}>
        <div className={styles.toolbar}>
          <span className={styles.listMeta}>{visibleStandards.length} / {standards.length} standards</span>
          <input
            aria-label="Search course standard"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search course code, course name, function"
          />
          <button className={styles.primaryButton} type="button" onClick={handleNew}>
            New
          </button>
          <button className={styles.secondaryButton} type="button" onClick={handleRefresh}>
            Refresh
          </button>
        </div>

        {isNewOpen ? (
          <section className={styles.formPanel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.kicker}>New standard</p>
                <h3>Create course standard</h3>
              </div>
              <button className={styles.closeButton} type="button" onClick={() => setIsNewOpen(false)}>
                Close
              </button>
            </div>

            <div className={styles.formGrid}>
              <label>
                Course Name
                <select value={courseCode} onChange={(event) => setCourseCode(event.target.value)}>
                  {courseMasterOptions.map((course) => (
                    <option key={course.code} value={course.code}>
                      {course.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Function Name
                <input
                  value={functionName}
                  onChange={(event) => setFunctionName(event.target.value)}
                  placeholder="Enter function name"
                />
              </label>
            </div>

            <div className={styles.checkSection}>
              <div>
                <h4>Check List Position</h4>
                <div className={styles.checkGrid}>
                  {positionChecklist.map((position) => (
                    <label className={styles.checkItem} key={position}>
                      <input
                        checked={selectedPositions.includes(position)}
                        type="checkbox"
                        onChange={() => toggleItem(position, selectedPositions, setSelectedPositions)}
                      />
                      <span>{position}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h4>Check List Level</h4>
                <div className={styles.levelGrid}>
                  {levelColumns.map((level) => (
                    <label className={styles.checkItem} key={level}>
                      <input
                        checked={selectedLevels.includes(level)}
                        type="checkbox"
                        onChange={() => toggleItem(level, selectedLevels, setSelectedLevels)}
                      />
                      <span>{level}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className={styles.formActions}>
              <button className={styles.primaryButton} type="button" onClick={handleSave}>
                Save standard
              </button>
              <button className={styles.secondaryButton} type="button" onClick={() => setIsNewOpen(false)}>
                Cancel
              </button>
            </div>
          </section>
        ) : null}

        <div className={styles.tableWrap}>
          <table className={styles.standardTable}>
            <thead>
              <tr>
                <th>Course Code</th>
                <th>Course Name</th>
                <th>Funtion Name</th>
                {positionColumns.map((position) => (
                  <th key={position}>{position}</th>
                ))}
                {levelColumns.map((level) => (
                  <th key={level}>{level}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleStandards.map((standard) => (
                <tr key={standard.id}>
                  <td>{standard.courseCode}</td>
                  <td>{standard.courseName}</td>
                  <td>{standard.functionName}</td>
                  {positionColumns.map((position) => (
                    <td className={styles.centerCell} key={position}>
                      {standard.positions.includes(position) ? <span className={styles.checkMark}>Y</span> : ""}
                    </td>
                  ))}
                  {levelColumns.map((level) => (
                    <td className={styles.centerCell} key={level}>
                      {standard.levels.includes(level) ? <span className={styles.checkMark}>Y</span> : ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
