"use client";

import { useState } from "react";
import Navbar from "../Navbar";
import styles from "./TrainingCourseManagement.module.css";

const courseItems = [
  {
    title: "Course Type",
    subtitle: "หมวดหมู่หลักสูตร",
    description: "จัดกลุ่มประเภทของหลักสูตรสำหรับการใช้งานภายในระบบ",
  },
  {
    title: "Course Group",
    subtitle: "กลุ่มของหลักสูตร",
    description: "จัดกลุ่มหลักสูตรตามสายงาน แผนก หรือระดับการเรียนรู้",
  },
  {
    title: "Course Master",
    subtitle: "ข้อมูลหลักสูตร",
    description: "จัดการข้อมูลหลักสูตรหลัก เช่น รหัส ชื่อ ระยะเวลา และผู้รับผิดชอบ",
  },
  {
    title: "Course Standard",
    subtitle: "หลักสูตรตามมาตรฐาน",
    description: "กำหนดหลักสูตรที่ต้องอบรมตามมาตรฐานและข้อบังคับ",
  },
] as const;

const extraCourseItems = [
  {
    title: "Assessment",
    subtitle: "Pre / Post Test",
    description: "สร้างและเก็บชุดแบบทดสอบ pre/post test ไว้ในระบบ เพื่อเรียกใช้ตอนสร้างแต่ละคอร์ส",
  },
  {
    title: "Evaluation Management",
    subtitle: "Evaluation Form",
    description: "สร้างและเก็บแบบประเมินพร้อม scope Central หรือ Company เพื่อเรียกใช้ในแต่ละคอร์ส",
  },
] as const;

const factoryCourseItems = [...courseItems, ...extraCourseItems] as const;

const assessmentTemplates = [
  { title: "Safety Basic Pre/Post Test", scope: "Central", questions: 12, status: "Published", version: "v1.0" },
  { title: "Service Mind Knowledge Check", scope: "Company", questions: 10, status: "Draft", version: "v0.3" },
] as const;

const evaluationTemplates = [
  { title: "Standard Course Evaluation", scope: "Central", questions: 8, status: "Published", version: "v2.0" },
  { title: "Workshop Feedback Form", scope: "Company", questions: 6, status: "Draft", version: "v0.5" },
] as const;

type TrainingCourseManagementProps = {
  username: string;
  onBack: () => void;
  onHome: () => void;
  onLogout: () => void;
};

export default function TrainingCourseManagement({
  username,
  onBack,
  onHome,
  onLogout,
}: TrainingCourseManagementProps) {
  const [selectedCourseItem, setSelectedCourseItem] = useState<(typeof factoryCourseItems)[number] | null>(
    null,
  );
  const [assessmentQuestion, setAssessmentQuestion] = useState("");
  const [assessmentQuestionType, setAssessmentQuestionType] = useState("choice");
  const [assessmentOptions, setAssessmentOptions] = useState(["", "", "", ""]);
  const [assessmentCorrect, setAssessmentCorrect] = useState("A");
  const [assessmentSavedQuestions, setAssessmentSavedQuestions] = useState<
    { question: string; type: string; options: string[]; correct: string }[]
  >([]);
  const [evaluationScope, setEvaluationScope] = useState("Central");
  const [evaluationQuestion, setEvaluationQuestion] = useState("");
  const [evaluationQuestionType, setEvaluationQuestionType] = useState("choice");
  const [evaluationOptions, setEvaluationOptions] = useState([
    "Very good",
    "Good",
    "Fair",
    "Need improvement",
  ]);
  const [evaluationSavedQuestions, setEvaluationSavedQuestions] = useState<
    { question: string; type: string; options: string[] }[]
  >([]);

  const handleBack = () => {
    if (selectedCourseItem) {
      setSelectedCourseItem(null);
      return;
    }

    onBack();
  };

  const handleAssessmentOptionChange = (index: number, value: string) => {
    setAssessmentOptions((current) =>
      current.map((option, optionIndex) => (optionIndex === index ? value : option)),
    );
  };

  const handleSaveAssessmentQuestion = () => {
    if (!assessmentQuestion.trim()) {
      return;
    }

    setAssessmentSavedQuestions((current) => [
      ...current,
      {
        question: assessmentQuestion.trim(),
        type: assessmentQuestionType,
        options:
          assessmentQuestionType === "choice"
            ? assessmentOptions.map((option, index) => option.trim() || `Option ${index + 1}`)
            : [],
        correct: assessmentQuestionType === "choice" ? assessmentCorrect : "Text answer",
      },
    ]);
    setAssessmentQuestion("");
    setAssessmentQuestionType("choice");
    setAssessmentOptions(["", "", "", ""]);
    setAssessmentCorrect("A");
  };

  const handleEvaluationOptionChange = (index: number, value: string) => {
    setEvaluationOptions((current) =>
      current.map((option, optionIndex) => (optionIndex === index ? value : option)),
    );
  };

  const handleSaveEvaluationQuestion = () => {
    if (!evaluationQuestion.trim()) {
      return;
    }

    setEvaluationSavedQuestions((current) => [
      ...current,
      {
        question: evaluationQuestion.trim(),
        type: evaluationQuestionType,
        options:
          evaluationQuestionType === "choice"
            ? evaluationOptions.map((option, index) => option.trim() || `Option ${index + 1}`)
            : [],
      },
    ]);
    setEvaluationQuestion("");
    setEvaluationQuestionType("choice");
  };

  const renderAssessmentWorkspace = () => (
    <section className={styles.moduleWorkspace} aria-label="Assessment management">
      <section className={styles.moduleHero}>
        <div>
          <p className={styles.panelKicker}>Assessment</p>
          <h2>สร้าง assessment</h2>
          <h2>สร้าง Assessment สำหรับ Pre-test / Post-test</h2>
          <span>เก็บแบบทดสอบไว้เรียกใช้ในแต่ละ course</span>
        </div>
      </section>

      <div className={styles.moduleGrid}>
        <section className={styles.builderPanel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelKicker}>Create</p>
              <h3>เพิ่มข้อมูลทั่วไป และคำถาม</h3>
            </div>
            <span className={styles.statusPill}>Draft</span>
          </div>

          <div className={styles.formGrid}>
            <label>
              <span>Assessment name</span>
              <input defaultValue="New Assessment" />
            </label>
            <label>
              <span>Pass score</span>
              <input defaultValue="80" inputMode="numeric" />
            </label>
            <label>
              <span>Question type</span>
              <select
                value={assessmentQuestionType}
                onChange={(event) => setAssessmentQuestionType(event.target.value)}
              >
                <option value="choice">ข้อช้อย</option>
                <option value="text">ใส่ข้อความ</option>
              </select>
            </label>
            <label className={styles.formWide}>
              <span>Question</span>
              <textarea
                value={assessmentQuestion}
                onChange={(event) => setAssessmentQuestion(event.target.value)}
                placeholder="เพิ่มคำถาม"
              />
            </label>
            {assessmentQuestionType === "choice" ? (
              <>
                {assessmentOptions.map((option, index) => (
                  <label key={`assessment-option-${index}`}>
                    <span>Option {String.fromCharCode(65 + index)}</span>
                    <input
                      value={option}
                      onChange={(event) => handleAssessmentOptionChange(index, event.target.value)}
                      placeholder={`ตัวเลือก ${index + 1}`}
                    />
                  </label>
                ))}
                <label>
                  <span>Correct answer</span>
                  <select value={assessmentCorrect} onChange={(event) => setAssessmentCorrect(event.target.value)}>
                    <option>A</option>
                    <option>B</option>
                    <option>C</option>
                    <option>D</option>
                  </select>
                </label>
              </>
            ) : (
              <div className={styles.textAnswerHint}>
                ผู้ทำแบบทดสอบจะตอบเป็นข้อความ และผู้ตรวจสามารถให้คะแนนภายหลังได้
              </div>
            )}
          </div>

          <div className={styles.actionRow}>
            <button className={styles.secondaryButton} type="button">Save assessment</button>
            <button className={styles.primaryButton} type="button" onClick={handleSaveAssessmentQuestion}>
              เพิ่มคำถาม
            </button>
          </div>
        </section>

        <section className={styles.previewPanel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelKicker}>Preview</p>
              <h3>แสดง Preview</h3>
            </div>
            <span className={styles.statusPill}>{assessmentSavedQuestions.length} questions</span>
          </div>
          <div className={styles.previewList}>
            {assessmentSavedQuestions.length > 0 ? (
              assessmentSavedQuestions.map((item, index) => (
                <article key={`${item.question}-${index}`}>
                  <strong>{index + 1}. {item.question}</strong>
                  <small>{item.type === "choice" ? "ข้อช้อย" : "ใส่ข้อความ"}</small>
                  {item.type === "choice" ? (
                    item.options.map((option, optionIndex) => (
                      <span key={`${item.question}-${optionIndex}`}>
                        {String.fromCharCode(65 + optionIndex)}. {option}
                      </span>
                    ))
                  ) : (
                    <span>คำตอบเป็นข้อความ</span>
                  )}
                  <b>{item.type === "choice" ? `Correct: ${item.correct}` : "Manual scoring"}</b>
                </article>
              ))
            ) : (
              <div className={styles.emptyPreview}>ยังไม่มีคำถามที่บันทึก</div>
            )}
          </div>
        </section>
      </div>

      <section className={styles.templatePanel}>
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.panelKicker}>Saved assessments</p>
            <h3>ฐานข้อมูลแบบทดสอบ</h3>
          </div>
        </div>
        <div className={styles.templateList}>
          {assessmentTemplates.map((template) => (
            <article key={template.title}>
              <strong>{template.title}</strong>
              <span>{template.scope} / {template.questions} questions / {template.version}</span>
              <b>{template.status}</b>
              <button className={styles.secondaryButton} type="button">Duplicate version</button>
            </article>
          ))}
        </div>
      </section>
    </section>
  );

  const renderEvaluationWorkspace = () => (
    <section className={styles.moduleWorkspace} aria-label="Evaluation management">
      <section className={styles.moduleHero}>
        <div>
          <p className={styles.panelKicker}>Evaluation Management</p>
          <h2>สร้างแบบประเมินสำหรับเรียกใช้ใน Course</h2>
          <span>กำหนด scope เป็น Central หรือ Company แล้ว publish เพื่อใช้งาน</span>
        </div>
      </section>

      <div className={styles.moduleGrid}>
        <section className={styles.builderPanel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelKicker}>Scope</p>
              <h3>กำหนด Scope และสร้าง Form</h3>
            </div>
            <span className={styles.statusPill}>{evaluationScope}</span>
          </div>

          <div className={styles.formGrid}>
            <label>
              <span>Evaluation name</span>
              <input defaultValue="New Evaluation Form" />
            </label>
            <label>
              <span>Scope</span>
              <select value={evaluationScope} onChange={(event) => setEvaluationScope(event.target.value)}>
                <option>Central</option>
                <option>Company</option>
              </select>
            </label>
            <label>
              <span>Company</span>
              <select disabled={evaluationScope === "Central"}>
                <option>ATA</option>
                <option>ATFB</option>
                <option>NIC</option>
                <option>SATI</option>
                <option>SNF</option>
                <option>TEP</option>
              </select>
            </label>
            <label>
              <span>Question type</span>
              <select
                value={evaluationQuestionType}
                onChange={(event) => setEvaluationQuestionType(event.target.value)}
              >
                <option value="choice">ข้อช้อย</option>
                <option value="text">ใส่ข้อความ</option>
              </select>
            </label>
            <label className={styles.formWide}>
              <span>Question</span>
              <textarea
                value={evaluationQuestion}
                onChange={(event) => setEvaluationQuestion(event.target.value)}
                placeholder="สร้าง question สำหรับแบบประเมิน"
              />
            </label>
            {evaluationQuestionType === "choice" ? (
              evaluationOptions.map((option, index) => (
                <label key={`evaluation-option-${index}`}>
                  <span>Option {index + 1}</span>
                  <input value={option} onChange={(event) => handleEvaluationOptionChange(index, event.target.value)} />
                </label>
              ))
            ) : (
              <div className={styles.textAnswerHint}>
                ผู้ตอบแบบประเมินจะตอบเป็นข้อความ เช่น ความเห็นเพิ่มเติม หรือข้อเสนอแนะ
              </div>
            )}
          </div>

          <div className={styles.actionRow}>
            <button className={styles.secondaryButton} type="button">Preview</button>
            <button className={styles.secondaryButton} type="button">Save question</button>
            <button className={styles.primaryButton} type="button" onClick={handleSaveEvaluationQuestion}>
              เพิ่มคำถาม
            </button>
          </div>
        </section>

        <section className={styles.previewPanel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelKicker}>Preview</p>
              <h3>Form / Question / Option</h3>
            </div>
            <span className={styles.statusPill}>{evaluationSavedQuestions.length} questions</span>
          </div>
          <div className={styles.previewList}>
            {evaluationSavedQuestions.length > 0 ? (
              evaluationSavedQuestions.map((item, index) => (
                <article key={`${item.question}-${index}`}>
                  <strong>{index + 1}. {item.question}</strong>
                  <small>{item.type === "choice" ? "ข้อช้อย" : "ใส่ข้อความ"}</small>
                  {item.type === "choice" ? (
                    item.options.map((option, optionIndex) => (
                      <span key={`${item.question}-${optionIndex}`}>{option}</span>
                    ))
                  ) : (
                    <span>คำตอบเป็นข้อความ</span>
                  )}
                </article>
              ))
            ) : (
              <div className={styles.emptyPreview}>ยังไม่มีคำถามในแบบประเมิน</div>
            )}
          </div>
        </section>
      </div>

      <section className={styles.templatePanel}>
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.panelKicker}>Published forms</p>
            <h3>คลังแบบประเมิน</h3>
          </div>
        </div>
        <div className={styles.templateList}>
          {evaluationTemplates.map((template) => (
            <article key={template.title}>
              <strong>{template.title}</strong>
              <span>{template.scope} / {template.questions} questions / {template.version}</span>
              <b>{template.status}</b>
            </article>
          ))}
        </div>
      </section>
    </section>
  );

  return (
    <main className={styles.page}>
      <Navbar username={username} onHome={onHome} onLogout={onLogout} />

      <section className={styles.header}>
        <button className={styles.backButton} type="button" onClick={handleBack}>
          Back
        </button>
        <p className={styles.kicker}>Training Course Management</p>
        <h1>{selectedCourseItem ? selectedCourseItem.title : "Training Course Management"}</h1>
      </section>

      {selectedCourseItem?.title === "Assessment" ? (
        renderAssessmentWorkspace()
      ) : selectedCourseItem?.title === "Evaluation Management" ? (
        renderEvaluationWorkspace()
      ) : selectedCourseItem ? (
        <section className={styles.blankWorkspace} aria-label={`${selectedCourseItem.title} page`}>
          <div className={styles.blankCanvas} />
        </section>
      ) : (
        <section className={styles.courseGrid} aria-label="Training course management menu">
          {factoryCourseItems.map((item) => (
            <button
              key={item.title}
              className={`${styles.courseCard} ${styles.clickableCard}`}
              type="button"
              onClick={() => setSelectedCourseItem(item)}
            >
              <span className={styles.badge}>{item.subtitle}</span>
              <h2>{item.title}</h2>
              <p>{item.description}</p>
            </button>
          ))}
        </section>
      )}
    </main>
  );
}
