function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('👑 HY HY TASK 👑')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Tự động tạo cấu trúc bảng nếu Sheets trống tinh
function initSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName("Checklist_ChiTiet")) {
    var sheet1 = ss.insertSheet("Checklist_ChiTiet");
    sheet1.appendRow(["Ngay", "STT", "NhiemVu", "GioHen", "Tag", "TrangThai", "ID_Task"]);
    sheet1.getRange("A1:G1").setFontWeight("bold").setBackground("#F5F0E1"); 
  }
  if (!ss.getSheetByName("DuDinh_GhiChu")) {
    var sheet2 = ss.insertSheet("DuDinh_GhiChu");
    sheet2.appendRow(["Ngay", "NoiDung_DuDinh", "GioHen", "Tag", "ID_DuDinh"]);
    sheet2.getRange("A1:E1").setFontWeight("bold").setBackground("#F9F6EE");
  } else {
    var sheet2 = ss.getSheetByName("DuDinh_GhiChu");
    if (sheet2.getLastColumn() === 3) {
      var oldData = sheet2.getDataRange().getValues();
      sheet2.clearContents();
      sheet2.getRange(1, 1, 1, 5).setValues([["Ngay", "NoiDung_DuDinh", "GioHen", "Tag", "ID_DuDinh"]]);
      sheet2.getRange("A1:E1").setFontWeight("bold").setBackground("#F9F6EE");
      if (oldData.length > 1) {
        var newData = [];
        for (var i = 1; i < oldData.length; i++) {
          newData.push([oldData[i][0], oldData[i][1], "00:00", "🔱 Quan trọng", oldData[i][2]]);
        }
        sheet2.getRange(2, 1, newData.length, 5).setValues(newData);
      }
    }
  }
}

// Chuẩn hóa định dạng ngày (YYYY-MM-DD)
function cleanDateKey(rawDate) {
  if (!rawDate) return "";
  if (rawDate instanceof Date) {
    var year = rawDate.getFullYear();
    var month = String(rawDate.getMonth() + 1).padStart(2, '0');
    var day = String(rawDate.getDate()).padStart(2, '0');
    return year + "-" + month + "-" + day;
  }
  var str = String(rawDate).trim();
  if (str.includes("T")) return str.split("T")[0];
  return str;
}

// Lấy ngày hôm nay theo định dạng YYYY-MM-DD
function getTodayString() {
  var now = new Date();
  var year = now.getFullYear();
  var month = String(now.getMonth() + 1).padStart(2, '0');
  var day = String(now.getDate()).padStart(2, '0');
  return year + "-" + month + "-" + day;
}

// Đọc dữ liệu tổng hợp
function getAppData() {
  initSheets();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetTask = ss.getSheetByName("Checklist_ChiTiet");
  var sheetNote = ss.getSheetByName("DuDinh_GhiChu");
  var todayStr = getTodayString();
  
  // XỬ LÝ TỰ ĐỘNG: Chuyển Dự định -> Task khi đến ngày
  var rowsNote = sheetNote.getDataRange().getValues();
  var notesKeep = [rowsNote[0]];
  var migratedTasks = [];
  for (var i = 1; i < rowsNote.length; i++) {
    var noteDate = cleanDateKey(rowsNote[i][0]);
    var noteContent = String(rowsNote[i][1] || "").trim();
    var noteTime = String(rowsNote[i][2] || "00:00").trim();
    var noteTag = String(rowsNote[i][3] || "🔱 Quan trọng").trim();
    var noteId = String(rowsNote[i][4] || "");
    if (noteDate && noteContent) {
      if (noteDate <= todayStr) {
        migratedTasks.push({
          date: noteDate,
          stt: 0,
          content: "[Dự định] " + noteContent,
          time: noteTime,
          tag: noteTag,
          status: "Chưa xong",
          id: "ID_MIGRATE_" + new Date().getTime() + "_" + i
        });
      } else {
        notesKeep.push(rowsNote[i]);
      }
    }
  }
  
  if (rowsNote.length !== notesKeep.length) {
    sheetNote.clearContents();
    sheetNote.getRange(1, 1, notesKeep.length, 5).setValues(notesKeep);
  }
  
  // LẤY DANH SÁCH TASK
  var rowsTask = sheetTask.getDataRange().getValues();
  var tasks = [];
  for (var i = 1; i < rowsTask.length; i++) {
    if (rowsTask[i][6]) {
      tasks.push({
        date: cleanDateKey(rowsTask[i][0]),
        stt: rowsTask[i][1],
        content: String(rowsTask[i][2] || ""),
        time: String(rowsTask[i][3] || ""),
        tag: String(rowsTask[i][4] || ""),
        status: String(rowsTask[i][5] || "Chưa xong").trim(),
        id: String(rowsTask[i][6])
      });
    }
  }
  
  if (migratedTasks.length > 0) {
    var fullList = tasks.concat(migratedTasks);
    return updateTasksInSheet(fullList);
  }
  
  tasks.sort(function(a, b) {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.time.localeCompare(b.time);
  });
  
  // LẤY DANH SÁCH DỰ ĐỊNH CÒN LẠI
  var activeNotes = [];
  var currentNotesData = sheetNote.getDataRange().getValues();
  for (var i = 1; i < currentNotesData.length; i++) {
    if (currentNotesData[i][4]) {
      activeNotes.push({
        date: cleanDateKey(currentNotesData[i][0]),
        content: String(currentNotesData[i][1] || ""),
        time: String(currentNotesData[i][2] || "00:00"),
        tag: String(currentNotesData[i][3] || "🔱 Quan trọng"),
        id: String(currentNotesData[i][4])
      });
    }
  }
  
  return {
    tasks: tasks,
    notes: activeNotes
  };
}

// Ghi đè dữ liệu Task và trả về dữ liệu mới ngay lập tức
function updateTasksInSheet(updatedList) {
  initSheets();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Checklist_ChiTiet");
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
  }
  if (updatedList && updatedList.length > 0) {
    updatedList.sort(function(a, b) {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.time.localeCompare(b.time);
    });
    var rowsToAppend = [];
    var sttCounter = {};
    for (var i = 0; i < updatedList.length; i++) {
      var t = updatedList[i];
      if (!sttCounter[t.date]) sttCounter[t.date] = 1;
      rowsToAppend.push([
        t.date,
        sttCounter[t.date]++,
        t.content,
        t.time,
        t.tag,
        t.status,
        String(t.id)
      ]);
    }
    sheet.getRange(2, 1, rowsToAppend.length, 7).setValues(rowsToAppend);
  }
  SpreadsheetApp.flush(); // Đẩy dữ liệu xuống bộ lưu trữ ngay tức khắc
  return getAppData();
}

// Ghi đè dữ liệu Dự định và trả về dữ liệu mới ngay lập tức
function updateNotesInSheet(updatedNotesList) {
  initSheets();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("DuDinh_GhiChu");
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
  }
  if (updatedNotesList && updatedNotesList.length > 0) {
    var rowsToAppend = [];
    for (var i = 0; i < updatedNotesList.length; i++) {
      var n = updatedNotesList[i];
      rowsToAppend.push([
        n.date,
        n.content,
        n.time || "00:00",
        n.tag || "🔱 Quan trọng",
        String(n.id)
      ]);
    }
    sheet.getRange(2, 1, rowsToAppend.length, 5).setValues(rowsToAppend);
  }
  SpreadsheetApp.flush(); // Đẩy dữ liệu xuống bộ lưu trữ ngay tức khắc
  return getAppData();
}
