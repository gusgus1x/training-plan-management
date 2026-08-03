import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const baseUrl = process.argv[2] || "http://localhost:3000";
const chromeCandidates = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
];
const chromePath = chromeCandidates.find(existsSync);

if (!chromePath) {
  throw new Error("Chrome or Edge was not found.");
}

const port = 9337;
const profilePath = join(tmpdir(), `attg-ui-audit-${process.pid}`);
const outputPath = join(process.cwd(), "artifacts", "ui-layout-audit");
mkdirSync(outputPath, { recursive: true });

const browser = spawn(
  chromePath,
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profilePath}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const waitForJson = async (url, attempts = 60) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response.json();
      }
    } catch {
      // Browser startup is still in progress.
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${url}`);
};

const createClient = async () => {
  const targets = await waitForJson(`http://127.0.0.1:${port}/json/list`);
  const target = targets.find((item) => item.type === "page");
  if (!target?.webSocketDebuggerUrl) {
    throw new Error("No browser page target was available.");
  }

  const socket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  let requestId = 0;

  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (!message.id) {
      return;
    }
    const request = pending.get(message.id);
    if (!request) {
      return;
    }
    pending.delete(message.id);
    if (message.error) {
      request.reject(new Error(message.error.message));
      return;
    }
    request.resolve(message.result);
  });

  const call = (method, params = {}) =>
    new Promise((resolve, reject) => {
      requestId += 1;
      pending.set(requestId, { resolve, reject });
      socket.send(JSON.stringify({ id: requestId, method, params }));
    });

  return { call, close: () => socket.close() };
};

const centerAreas = [
  {
    title: "Training Plan",
    modules: [
      "Training OAP",
      "Training Rolling",
      "Request Training Need",
      "Training Accept Survey",
    ],
  },
  {
    title: "Training Record",
    modules: ["Training Actual", "Training Record"],
  },
  {
    title: "Training Course",
    modules: [
      "Course Master & Standard",
      "Assessment",
      "Evaluation Management",
    ],
  },
  {
    title: "Master Data",
    modules: [
      "Course Type",
      "Course Group",
      "Company Data",
      "Function Data",
      "Position Data",
      "Level Data",
      "Employee Data",
      "Instructor Data",
    ],
  },
  {
    title: "Reports",
    modules: ["Summary Dashboard", "Schedule calendar"],
  },
];

const employeeModules = [
  "Register Train",
  "Training Roadmap",
  "Request Training Need",
  "Training Record",
  "Training Report",
];

const viewports = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "tablet", width: 1024, height: 768 },
  { name: "mobile", width: 390, height: 844 },
];

const financeSeed = {
  rollingPlans: [
    {
      id: "audit-oap-center",
      rollingId: "audit-center-1",
      scheduleGroupId: "audit-center-group",
      sequence: 1,
      batch: "1",
      location: "Training Room A",
      trainingDate: "2026-07-10",
      startTime: "09:00",
      endTime: "16:00",
      company: "All Companies",
      relatedCompanies: ["SATI", "SNF"],
      status: "Planned",
      updatedAt: "2026-07-01T08:00:00.000Z",
      course: {
        code: "CTR-101",
        name: "Center Leadership Essentials",
        objective: "",
        learningContent: "",
        targetGroup: "",
        methodology: "",
        preTest: "",
        postTest: "",
        evaluation: "",
        evaluationAfter30Day: "",
        lifeCycleMonth: "",
        courseType: "Leadership",
        courseGroup: "Core",
      },
      participants: "3",
      hours: "7",
      budget: "60000",
      trainer: "Center Instructor",
      provider: "Internal",
      owner: "admin.hrd",
      ownerScope: "CENTER",
    },
    {
      id: "audit-oap-center",
      rollingId: "audit-center-2",
      scheduleGroupId: "audit-center-group",
      sequence: 2,
      batch: "2",
      location: "Training Room A",
      trainingDate: "2026-07-11",
      startTime: "09:00",
      endTime: "16:00",
      company: "All Companies",
      relatedCompanies: ["SATI", "SNF"],
      status: "Planned",
      updatedAt: "2026-07-01T08:00:00.000Z",
      course: {
        code: "CTR-101",
        name: "Center Leadership Essentials",
        objective: "",
        learningContent: "",
        targetGroup: "",
        methodology: "",
        preTest: "",
        postTest: "",
        evaluation: "",
        evaluationAfter30Day: "",
        lifeCycleMonth: "",
        courseType: "Leadership",
        courseGroup: "Core",
      },
      participants: "3",
      hours: "7",
      budget: "60000",
      trainer: "Center Instructor",
      provider: "Internal",
      owner: "admin.hrd",
      ownerScope: "CENTER",
    },
    {
      id: "audit-oap-factory",
      rollingId: "audit-factory-1",
      scheduleGroupId: "audit-factory-group",
      sequence: 1,
      batch: "1",
      location: "Factory Training Room",
      trainingDate: "2026-07-15",
      startTime: "09:00",
      endTime: "16:00",
      company: "SATI",
      relatedCompanies: ["SATI"],
      status: "Planned",
      updatedAt: "2026-07-01T08:00:00.000Z",
      course: {
        code: "FAC-201",
        name: "Factory Safety Refresh",
        objective: "",
        learningContent: "",
        targetGroup: "",
        methodology: "",
        preTest: "",
        postTest: "",
        evaluation: "",
        evaluationAfter30Day: "",
        lifeCycleMonth: "",
        courseType: "Safety",
        courseGroup: "Compliance",
      },
      participants: "2",
      hours: "7",
      budget: "40000",
      trainer: "Factory Instructor",
      provider: "Internal",
      owner: "factory.sati",
      ownerScope: "FACTORY",
      ownerCompany: "SATI",
    },
  ],
  completedCourses: [
    {
      id: "audit-completed-center",
      rollingId: "audit-center-1",
      scheduleGroupId: "audit-center-group",
      code: "CTR-101",
      title: "Center Leadership Essentials",
      date: "2026-07-10",
      batch: "1",
      company: "All Companies",
      relatedCompanies: ["SATI", "SNF"],
      owner: "CENTER",
      room: "Training Room A",
      instructor: "Center Instructor",
      hours: 7,
      attendees: [
        {
          id: "audit-sati-1",
          company: "SATI",
          employeeCode: "SATI-001",
          name: "Somsak Dee",
          department: "Production",
          registered: true,
          attended: true,
        },
        {
          id: "audit-sati-2",
          company: "SATI",
          employeeCode: "SATI-002",
          name: "Malee Jai",
          department: "Quality",
          registered: true,
          attended: true,
        },
        {
          id: "audit-snf-1",
          company: "SNF",
          employeeCode: "SNF-001",
          name: "Anan Rak",
          department: "Production",
          registered: true,
          attended: true,
        },
      ],
      expenses: {
        accommodation: 0,
        foodBeverage: 3000,
        instructor: 8000,
        material: 2500,
        seminarRoom: 1500,
        traveling: 0,
      },
      savedAt: "2026-07-10T10:00:00.000Z",
    },
    {
      id: "audit-completed-factory",
      rollingId: "audit-factory-1",
      scheduleGroupId: "audit-factory-group",
      code: "FAC-201",
      title: "Factory Safety Refresh",
      date: "2026-07-15",
      batch: "1",
      company: "SATI",
      relatedCompanies: ["SATI"],
      owner: "FACTORY",
      ownerCompany: "SATI",
      room: "Factory Training Room",
      instructor: "Factory Instructor",
      hours: 7,
      attendees: [
        {
          id: "audit-factory-attendee-1",
          company: "SATI",
          employeeCode: "SATI-003",
          name: "Wipa Kaew",
          department: "Production",
          registered: true,
          attended: true,
        },
        {
          id: "audit-factory-attendee-2",
          company: "SATI",
          employeeCode: "SATI-004",
          name: "Krit Mee",
          department: "Safety",
          registered: true,
          attended: false,
        },
      ],
      expenses: {
        accommodation: 0,
        foodBeverage: 4000,
        instructor: 12000,
        material: 5000,
        seminarRoom: 3000,
        traveling: 0,
      },
      savedAt: "2026-07-15T10:00:00.000Z",
    },
  ],
  acceptances: [
    {
      id: "audit-sati-1",
      name: "Somsak Dee",
      company: "SATI",
      department: "Production",
      position: "Supervisor",
      level: "L3",
      legacyLabel: "Approved",
      courseId: "audit-center-1",
      source: "Submitted by Factory",
      status: "Center Approved",
      remark: "",
    },
    {
      id: "audit-sati-2",
      name: "Malee Jai",
      company: "SATI",
      department: "Quality",
      position: "Supervisor",
      level: "L3",
      legacyLabel: "Approved",
      courseId: "audit-center-1",
      source: "Submitted by Factory",
      status: "Center Approved",
      remark: "",
    },
    {
      id: "audit-snf-1",
      name: "Anan Rak",
      company: "SNF",
      department: "Production",
      position: "Supervisor",
      level: "L3",
      legacyLabel: "Approved",
      courseId: "audit-center-1",
      source: "Submitted by Factory",
      status: "Center Approved",
      remark: "",
    },
  ],
};

const results = [];
const contrastResults = [];
let client;

try {
  client = await createClient();
  await client.call("Page.enable");
  await client.call("Runtime.enable");

  const evaluate = async (expression) => {
    const response = await client.call("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (response.exceptionDetails) {
      throw new Error(response.exceptionDetails.text);
    }
    return response.result.value;
  };

  const waitFor = async (expression, attempts = 50) => {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (await evaluate(expression)) {
        return;
      }
      await delay(100);
    }
    throw new Error(`Timed out waiting for: ${expression}`);
  };

  const navigate = async () => {
    await client.call("Page.navigate", { url: baseUrl });
    await waitFor("document.readyState === 'complete'");
    await waitFor("document.querySelector('main') !== null");
    await delay(300);
  };

  const clickButtonText = async (text) => {
    const clicked = await evaluate(`(() => {
      const button = [...document.querySelectorAll("button")]
        .find((item) => item.textContent.trim() === ${JSON.stringify(text)});
      if (!button) return false;
      button.click();
      return true;
    })()`);
    if (!clicked) {
      const availableButtons = await evaluate(
        "[...document.querySelectorAll('button')].map((button) => button.textContent.trim()).filter(Boolean)",
      );
      throw new Error(
        `Button not found: ${text}. Available: ${availableButtons.join(" | ")}`,
      );
    }
    await delay(250);
  };

  const clickHeadingButton = async (text) => {
    const clicked = await evaluate(`(() => {
      const button = [...document.querySelectorAll("button")]
        .find((item) => item.querySelector("h3")?.textContent.trim() === ${JSON.stringify(text)}
          || item.querySelector("strong")?.textContent.trim() === ${JSON.stringify(text)});
      if (!button) return false;
      button.click();
      return true;
    })()`);
    if (!clicked) {
      throw new Error(`Workspace card not found: ${text}`);
    }
    await delay(250);
  };

  const clickAriaLabel = async (label) => {
    const clicked = await evaluate(`(() => {
      const button = [...document.querySelectorAll("button[aria-label]")]
        .find((item) => item.getAttribute("aria-label") === ${JSON.stringify(label)});
      if (!button) return false;
      button.click();
      return true;
    })()`);
    if (!clicked) {
      throw new Error(`Navigation item not found: ${label}`);
    }
    await delay(250);
  };

  const openRole = async (role) => {
    await navigate();
    await clickButtonText("EN");
    await waitFor("document.documentElement.lang === 'en'");
    const hasPreviewButtons = await evaluate(
      "[...document.querySelectorAll('button')].some((button) => button.textContent.trim() === 'HRD_CENTER')",
    );
    if (!hasPreviewButtons) {
      await clickButtonText("Return to sign in");
      await waitFor(
        "[...document.querySelectorAll('button')].some((button) => button.textContent.trim() === 'HRD_CENTER')",
      );
    }
    await clickButtonText(role);
    await waitFor("document.querySelector('main') !== null");
    await evaluate(`(() => {
      localStorage.setItem(
        "tpm_workflow_rolling_plans",
        ${JSON.stringify(JSON.stringify(financeSeed.rollingPlans))}
      );
      localStorage.setItem(
        "tpm_workflow_completed_courses",
        ${JSON.stringify(JSON.stringify(financeSeed.completedCourses))}
      );
      localStorage.setItem(
        "tpm_workflow_acceptances",
        ${JSON.stringify(JSON.stringify(financeSeed.acceptances))}
      );
      window.dispatchEvent(new CustomEvent("training-workflow-changed"));
    })()`);
    await delay(250);
  };

  const auditCurrentPage = async (role, pageName) => {
    for (const viewport of viewports) {
      await client.call("Emulation.setDeviceMetricsOverride", {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: 1,
        mobile: viewport.name === "mobile",
      });
      await delay(180);

      const metrics = await evaluate(`(() => {
        const viewportWidth = document.documentElement.clientWidth;
        const describe = (element) => {
          const tag = element.tagName.toLowerCase();
          const id = element.id ? "#" + element.id : "";
          const className = typeof element.className === "string"
            ? "." + element.className.trim().split(/\\s+/).slice(0, 2).join(".")
            : "";
          return (tag + id + className).slice(0, 180);
        };
        const hasScrollableAncestor = (element) => {
          let parent = element.parentElement;
          while (parent && parent !== document.body) {
            const style = getComputedStyle(parent);
            if (
              ["auto", "scroll"].includes(style.overflowX) &&
              parent.scrollWidth > parent.clientWidth + 1
            ) {
              return true;
            }
            parent = parent.parentElement;
          }
          return false;
        };
        const offenders = [...document.body.querySelectorAll("*")]
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            if (rect.width < 1 || rect.height < 1) return false;
            if (rect.right <= viewportWidth + 1 && rect.left >= -1) return false;
            return !hasScrollableAncestor(element);
          })
          .slice(0, 12)
          .map((element) => ({
            selector: describe(element),
            text: (element.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 90),
            left: Math.round(element.getBoundingClientRect().left),
            right: Math.round(element.getBoundingClientRect().right),
          }));
        const clipped = [...document.querySelectorAll("input:disabled, input[readonly], button")]
          .filter((element) => element.scrollWidth > element.clientWidth + 2)
          .slice(0, 12)
          .map((element) => ({
            selector: describe(element),
            text: (element.value || element.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 90),
          }));
        return {
          viewportWidth,
          documentWidth: document.documentElement.scrollWidth,
          offenders,
          clipped,
        };
      })()`);

      const result = {
        role,
        page: pageName,
        viewport: viewport.name,
        ...metrics,
      };
      results.push(result);

      if (
        metrics.documentWidth > metrics.viewportWidth + 1 ||
        metrics.offenders.length > 0 ||
        pageName === "Summary Dashboard"
      ) {
        const screenshot = await client.call("Page.captureScreenshot", {
          format: "png",
          captureBeyondViewport: false,
        });
        const fileName = `${role}-${pageName}-${viewport.name}`
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        writeFileSync(
          join(outputPath, `${fileName}.png`),
          Buffer.from(screenshot.data, "base64"),
        );
      }
    }
  };

  const auditScrolledNavbar = async (role) => {
    await client.call("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 500,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await evaluate("window.scrollTo(0, 260)");
    await waitFor(
      "document.querySelector('header')?.className.includes('scrolledNavbar') === true",
    );
    await delay(180);

    const samples = await evaluate(`(() => {
      const parseColor = (value) => {
        const parts = value.match(/[\\d.]+/g)?.map(Number) || [];
        return {
          red: parts[0] || 0,
          green: parts[1] || 0,
          blue: parts[2] || 0,
          alpha: parts.length > 3 ? parts[3] : 1,
        };
      };
      const composite = (foreground, background) => ({
        red: foreground.red * foreground.alpha + background.red * (1 - foreground.alpha),
        green: foreground.green * foreground.alpha + background.green * (1 - foreground.alpha),
        blue: foreground.blue * foreground.alpha + background.blue * (1 - foreground.alpha),
        alpha: 1,
      });
      const effectiveBackground = (element) => {
        const lineage = [];
        let current = element;
        while (current) {
          lineage.unshift(current);
          current = current.parentElement;
        }
        return lineage.reduce(
          (background, item) =>
            composite(parseColor(getComputedStyle(item).backgroundColor), background),
          { red: 255, green: 255, blue: 255, alpha: 1 },
        );
      };
      const luminance = (color) => {
        const channel = (value) => {
          const normalized = value / 255;
          return normalized <= 0.04045
            ? normalized / 12.92
            : ((normalized + 0.055) / 1.055) ** 2.4;
        };
        return (
          0.2126 * channel(color.red) +
          0.7152 * channel(color.green) +
          0.0722 * channel(color.blue)
        );
      };
      const contrast = (foreground, background) => {
        const foregroundLuminance = luminance(foreground);
        const backgroundLuminance = luminance(background);
        return (
          (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
          (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
        );
      };
      const selectors = [
        ["User label", "header [class*='userLabel']"],
        ["User value", "header [class*='userValue']"],
        ["Inactive language", "header [class*='languageButton']"],
        ["Language divider", "header [class*='languageDivider']"],
        ["Workspace label", "header [class*='contextTitle'] span"],
      ];
      return selectors.flatMap(([name, selector]) => {
        const element = document.querySelector(selector);
        if (!element) return [];
        const background = effectiveBackground(element);
        const foreground = composite(
          parseColor(getComputedStyle(element).color),
          background,
        );
        return [{
          name,
          color: getComputedStyle(element).color,
          ratio: Number(contrast(foreground, background).toFixed(2)),
        }];
      });
    })()`);

    contrastResults.push({ role, samples });
    const screenshot = await client.call("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    writeFileSync(
      join(outputPath, `${role.toLowerCase().replace("_", "-")}-navbar-scrolled.png`),
      Buffer.from(screenshot.data, "base64"),
    );
    await evaluate("window.scrollTo(0, 0)");
  };

  for (const role of ["HRD_CENTER", "HRD_FACTORY"]) {
    await openRole(role);
    await auditCurrentPage(role, "Dashboard");

    for (const area of centerAreas) {
      await clickHeadingButton(area.title);
      if (area.title === "Training Plan") {
        await auditScrolledNavbar(role);
      }
      await auditCurrentPage(role, `${area.title} Hub`);
      for (const moduleTitle of area.modules) {
        await clickAriaLabel(moduleTitle);
        await auditCurrentPage(role, moduleTitle);
      }
      await clickAriaLabel("Back to main dashboard");
    }
  }

  await openRole("EMPLOYEE");
  await auditCurrentPage("EMPLOYEE", "Dashboard");
  for (const moduleTitle of employeeModules) {
    if (moduleTitle === employeeModules[0]) {
      await clickHeadingButton(moduleTitle);
    } else {
      await clickAriaLabel(moduleTitle);
    }
    if (moduleTitle === employeeModules[0]) {
      await auditScrolledNavbar("EMPLOYEE");
    }
    await auditCurrentPage("EMPLOYEE", moduleTitle);
  }

  const issues = results.filter(
    (result) =>
      result.documentWidth > result.viewportWidth + 1 ||
      result.offenders.length > 0 ||
      result.clipped.length > 0,
  );
  const contrastIssues = contrastResults.flatMap(({ role, samples }) =>
    samples
      .filter((sample) => sample.ratio < 4.5)
      .map((sample) => ({ role, ...sample })),
  );
  writeFileSync(
    join(outputPath, "results.json"),
    JSON.stringify(
      { audited: results.length, issues, contrastResults, contrastIssues },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify(
      {
        audited: results.length,
        layoutIssues: issues.filter(
          (result) =>
            result.documentWidth > result.viewportWidth + 1 ||
            result.offenders.length > 0,
        ).length,
        clippedControlIssues: issues.filter(
          (result) => result.clipped.length > 0,
        ).length,
        contrastIssues,
        contrastResults,
        issues,
      },
      null,
      2,
    ),
  );
} finally {
  client?.close();
  browser.kill();
}
