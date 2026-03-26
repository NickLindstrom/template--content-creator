const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const templatePath = path.join(projectRoot, "src", "template.html");
const outputPath = path.join(projectRoot, "index.html");

(function build() {
  const template = fs.readFileSync(templatePath, "utf8");
  fs.writeFileSync(outputPath, template);
  console.log("Built index.html from src/template.html");
})();
