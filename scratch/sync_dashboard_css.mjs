import fs from "fs";
import path from "path";

const sourcePath = path.resolve("app/components/center_factory/CenterFactory_Dashboard.module.css");
const targetPath = path.resolve("app/components/employee/UserDashboard.module.css");

const content = fs.readFileSync(sourcePath, "utf-8");
fs.writeFileSync(targetPath, content, "utf-8");
console.log("Successfully copied CenterFactory_Dashboard.module.css to UserDashboard.module.css");
