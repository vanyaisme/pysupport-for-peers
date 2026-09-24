const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const args = {
  8: ["Alice"],
  9: ["Alice", "Bob", "Carol"],
  10: ["7"],
  11: [],
  53: ["42"],
  208: ["Alice"],
  209: ["Alice", "Bob", "Carol"],
  210: ["Alice", "Bob"],
  211: ["2", "3"],
  212: ["2.5", "3.5"],
  213: ["2024"],
  215: ["4"],
  216: ["1"],
  217: ["60", "80"],
  218: ["9"],
  219: ["2024"],
  220: ["psych", "neuroscience"],
  225: ["5"],
  234: ["1", "2", "3"],
  240: ["psychology"],
  241: ["level"],
  242: ["mammal"],
  249: ["3", "5"],
  250: ["70", "1.8"],
  251: ["Psychology", "5"],
  252: ["2", "4"],
  257: ["60", "80"],
  260: ["open.txt", "1", "2"],
};
const inputs = {
  6: ["Zoë", "21"],
  21: ["5"],
  37: ["10", "done"],
  38: ["P01", "quit"],
  45: ["7"],
  46: ["invalid"],
  48: ["invalid", "21"],
  159: Array.from({ length: 100 }, (_, i) => String(i + 1)),
  166: ["rock", "quit"],
  180: ["quit"],
  183: [..."abcdefghijklmnopqrstuvwxyz"],
  223: ["1", "666"],
  243: ["l"],
  258: ["apple", "banana", "cherry", "dog", "cat"],
  259: ["60", "80", "100", "towards"],
};
function examples() {
  const dom = new JSDOM(fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8"));
  const rows = [...dom.window.document.querySelectorAll("code[data-example-id]")].map(
    (el, index) => ({
      id: el.dataset.exampleId,
      index,
      code: el.textContent.trim(),
      mode: el.dataset.runMode || "browser",
      expectedError: el.dataset.expectedError || "",
      args: args[index] || [],
      inputs: inputs[index] || [],
    })
  );
  dom.window.close();
  return rows;
}
module.exports = { examples };
