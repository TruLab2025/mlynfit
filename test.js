const fs = require('fs');

function parseCSVLine(line) {
  var result = [];
  var current = '';
  var inQuotes = false;
  for (var i = 0; i < line.length; i++) {
    var ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

fetch("https://docs.google.com/spreadsheets/d/e/2PACX-1vQFbVVnAYRg9MTKG2kH8SxlyykZLnvW9DrN-Jrry9HXYKW2hR4Loc_1OVYGhKV7HCF7ycJTadL_DCeP/pub?gid=0&single=true&output=csv")
.then(r => r.text())
.then(text => {
  var lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(function (l) { return l.trim(); });
  var headers = parseCSVLine(lines[0]);
  console.log("HEADERS:", headers);
  var items = [];
  for (var i = 1; i < lines.length; i++) {
    var values = parseCSVLine(lines[i]);
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = values[j];
    }
    items.push(obj);
  }
  console.log("FIRST ITEM:", items[0]);
});
