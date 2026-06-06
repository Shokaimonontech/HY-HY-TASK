let localTasks = [];
let localNotes = [];
let currentYear = 2026;
let selectedMonth = null;
let selectedDateStr = "";
let bsEditModal = null;
let bsDetailModal = null;
let filteredDashboardTasks = [];
let filteredDashboardNotes = [];
let currentSelectedDate = new Date();
let isPollingActive = false; 

const monthPastelColors = [
  { background: "#E8F0FE", text: "#1A567D" }, 
  { background: "#E6F4EA", text: "#137333" }, 
  { background: "#FCE8E6", text: "#C5221F" }, 
  { background: "#FEF7E0", text: "#B06000" }, 
  { background: "#F4EBFB", text: "#681DA8" }, 
  { background: "#E2F3F5", text: "#0E7A8A" }, 
  { background: "#FCE7F3", text: "#9D174D" }, 
  { background: "#E0F2FE", text: "#0369A1" }, 
  { background: "#F1F5F9", text: "#334155" }, 
  { background: "#FEF2F2", text: "#991B1B" }, 
  { background: "#ECFDF5", text: "#065F46" }, 
  { background: "#FFFBEB", text: "#92400E" }  
];

function getLunarDate2026(day, month, year) {
  if(year !== 2026) return "Mùng --";
  const solarMs = new Date(2026, month - 1, day).getTime();
  const lunarNewYearMs = new Date(2026, 1, 17).getTime();
  const diffDays = Math.floor((solarMs - lunarNewYearMs) / (24*60*60*1000));
  const lunarMonths2026 = [30, 30, 29, 30, 29, 30, 29, 29, 30, 29, 30, 29];
  if(diffDays < 0) return "Cuối năm cũ";
  let daysLeft = diffDays;
  let lunarMonth = 1;
  let lunarDay = 1;
  for(let i=0; i<lunarMonths2026.length; i++) {
    if(daysLeft < lunarMonths2026[i]) {
      lunarMonth = i + 1;
      lunarDay = daysLeft + 1;
      break;
    }
    daysLeft -= lunarMonths2026[i];
  }
  return `${String(lunarDay).padStart(2,'0')}/${String(lunarMonth).padStart(2,'0')}`;
}

function startLiveClock() {
  setInterval(() => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    document.getElementById('liveClockDisplay').innerHTML = `<i class="fa-regular fa-clock"></i> ${hours}:${minutes}:${seconds}`;
  }, 1000);
}

document.addEventListener("DOMContentLoaded", function() {
  bsEditModal = new bootstrap.Modal(document.getElementById('editModal'));
  bsDetailModal = new bootstrap.Modal(document.getElementById('detailDashboardModal'));
  
  const now = new Date();
  document.getElementById('dashRangeStart').value = getFormatDateString(now);
  let nextMonth = new Date(); nextMonth.setMonth(nextMonth.getMonth() + 1);
  document.getElementById('dashRangeEnd').value = getFormatDateString(nextMonth);

  resetToToday();
  loadDataFromServer(true); 
  renderMonthsList();
  startLiveClock();
  
  setInterval(function() {
    if (!isPollingActive) {
      syncDataFromSheetSilently();
    }
  }, 10000);
});

function getFormatDateString(dateObj) {
  return `${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,'0')}-${String(dateObj.getDate()).padStart(2,'0')}`;
}

function updateQuickCalendarDisplay(dateObj) {
  const d = dateObj.getDate();
  const m = dateObj.getMonth() + 1;
  const y = dateObj.getFullYear();
  document.getElementById('solarDateDisplay').innerText = `${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}/${y}`;
  document.getElementById('lunarDateDisplay').innerText = `Âm lịch: ${getLunarDate2026(d, m, y)}`;
  
  const todayStr = getFormatDateString(new Date());
  const targetStr = getFormatDateString(dateObj);
  if (targetStr === todayStr) {
    document.getElementById('taskFilterLabel').innerText = "Hôm nay";
  } else {
    document.getElementById('taskFilterLabel').innerText = `${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}`;
  }
}

function adjustSelectedDate(daysOffset) {
  currentSelectedDate.setDate(currentSelectedDate.getDate() + daysOffset);
  updateQuickCalendarDisplay(currentSelectedDate);
  renderTasks(localTasks);
}

function resetToToday() {
  currentSelectedDate = new Date();
  updateQuickCalendarDisplay(currentSelectedDate);
  renderTasks(localTasks);
}

function loadDataFromServer(shouldShowSpinner) {
  if (shouldShowSpinner) showLoading(true);
  google.script.run
    .withSuccessHandler(function(data) {
      localTasks = data.tasks || [];
      localNotes = data.notes || [];
      refreshAllViews();
      if (shouldShowSpinner) showLoading(false);
    })
    .withFailureHandler(function(err) {
      if (shouldShowSpinner) showLoading(false);
      console.error("Lỗi kết nối hệ thống: " + err.message);
    })
    .getAppData();
}

function syncDataFromSheetSilently() {
  isPollingActive = true;
  google.script.run
    .withSuccessHandler(function(data) {
      localTasks = data.tasks || [];
      localNotes = data.notes || [];
      refreshAllViews();
      isPollingActive = false;
    })
    .withFailureHandler(function() {
      isPollingActive = false;
    })
    .getAppData();
}

function refreshAllViews() {
  renderTasks(localTasks);
  renderDashboard();
  if(selectedMonth !== null) renderDaysGrid(selectedMonth);
  if(selectedDateStr) renderDayNotes();
}

function showLoading(status) {
  document.getElementById('loading').style.display = status ? 'flex' : 'none';
}

function toggleFilterInputs() {
  const mode = document.getElementById('dashTimeFilter').value;
  document.getElementById('rangePickerBox').style.display = (mode === 'range') ? 'block' : 'none';
  renderDashboard();
}

function renderDashboard() {
  const filterMode = document.getElementById('dashTimeFilter').value;
  if (filterMode === 'range') {
    const startStr = document.getElementById('dashRangeStart').value;
    const endStr = document.getElementById('dashRangeEnd').value;
    if (startStr && endStr) {
      const dStart = new Date(startStr);
      const dEnd = new Date(endStr);
      const diffDays = Math.ceil(Math.abs(dEnd - dStart) / (1000 * 60 * 60 * 24));
      if (diffDays > 62) {
        alert("⚠️ Chỉ lọc được khoảng thời gian tối đa 2 tháng!");
        let maxEnd = new Date(dStart); maxEnd.setMonth(maxEnd.getMonth() + 2);
        document.getElementById('dashRangeEnd').value = getFormatDateString(maxEnd);
        renderDashboard();
        return;
      }
      filteredDashboardTasks = localTasks.filter(t => t.date >= startStr && t.date <= endStr);
      filteredDashboardNotes = localNotes.filter(n => n.date >= startStr && n.date <= endStr);
    } else {
      filteredDashboardTasks = []; filteredDashboardNotes = [];
    }
  } else {
    filteredDashboardTasks = localTasks;
    filteredDashboardNotes = localNotes;
  }

  const totalTasks = filteredDashboardTasks.length;
  const doneTasks = filteredDashboardTasks.filter(t => t.status === "Đã xong").length;
  const pendingTasks = totalTasks - doneTasks;
  const totalNotes = filteredDashboardNotes.length;

  document.getElementById('dashTotalTasks').innerText = totalTasks;
  document.getElementById('dashDoneTasks').innerText = doneTasks;
  document.getElementById('dashPendingTasks').innerText = pendingTasks;
  document.getElementById('dashTotalNotes').innerText = totalNotes;

  let percent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const progressBar = document.getElementById('dashProgressBar');
  progressBar.style.width = percent + '%';
  progressBar.innerText = percent + '%';

  const progressText = document.getElementById('dashProgressText');
  if (percent === 100 && totalTasks > 0) {
    progressText.innerHTML = "🎉 Xuất sắc! Bạn đã hoàn thành trọn vẹn mục tiêu đề ra!";
  } else if (percent >= 50) {
    progressText.innerHTML = "🔱 Vận trình rất tốt! Tiếp tục giữ vững phong độ nhé.";
  } else {
    progressText.innerHTML = "✨ Hãy bắt đầu những bước chân nhỏ đầu tiên nào!";
  }
}

function renderTasks(tasks) {
  const listContainer = document.getElementById('taskList');
  listContainer.innerHTML = '';
  const targetDateStr = getFormatDateString(currentSelectedDate);
  let filtered = tasks.filter(t => t.date === targetDateStr);

  if (!filtered || filtered.length === 0) {
    listContainer.innerHTML = '<div class="text-center text-muted my-4 small fw-medium">Hôm nay thảnh thơi an nhàn, tâm trí minh mẫn!</div>';
    return;
  }

  filtered.forEach(task => {
    const isDone = task.status === "Đã xong";
    const formattedTime = task.time ? ' | ⏰ Giờ: ' + task.time : '';
    const taskHtml = `
    <div class="task-item" id="task-dom-${task.id}">
      <input type="checkbox" class="form-check-input me-3 flex-shrink-0" ${isDone ? 'checked' : ''} onchange="toggleStatus('${task.id}')">
      <div class="task-clickable ${isDone ? 'task-done' : ''}" onclick="openEditModal('task', '${task.id}')">
        <div style="font-size: 14px; word-break: break-all; padding-right:8px;">
          <span class="stt-badge">${task.stt}</span>
          <strong>${task.content}</strong>
          <div class="text-muted" style="font-size: 11px; margin-top: 4px;">
            <span class="badge text-dark border-secondary-subtle" style="background-color:#E3C16F;">${task.tag}</span> | 📅 ${task.date}${formattedTime}
          </div>
        </div>
      </div>
      <button class="btn btn-sm text-danger p-2 flex-shrink-0" onclick="deleteTask('${task.id}')"><i class="fa-solid fa-trash-can"></i></button>
    </div>
    `;
    listContainer.insertAdjacentHTML('beforeend', taskHtml);
  });
}

function addNewTask() {
  const content = document.getElementById('taskContent').value.trim();
  let rawTime = document.getElementById('taskTime').value;
  const tag = document.getElementById('taskTag').value;

  if (!content) { alert("Vui lòng điền nội dung công việc!"); return; }
  if (!rawTime) { rawTime = `${getFormatDateString(currentSelectedDate)}T00:00`; }

  const dateParts = rawTime.split("T");
  const newTask = {
    date: dateParts[0],
    stt: localTasks.filter(t => t.date === dateParts[0]).length + 1,
    content: content,
    time: dateParts[1] ? dateParts[1].substring(0, 5) : "00:00",
    tag: tag,
    status: "Chưa xong",
    id: "ID_" + new Date().getTime()
  };

  localTasks.push(newTask);
  refreshAllViews();

  document.getElementById('taskContent').value = '';
  document.getElementById('taskTime').value = '';

  google.script.run
    .withSuccessHandler(function(data) {
      localTasks = data.tasks || [];
      localNotes = data.notes || [];
      refreshAllViews();
    })
    .updateTasksInSheet(localTasks);
}

function deleteTask(id) {
  const deletedTask = localTasks.find(t => t.id === id);
  if (!deletedTask) return;

  localTasks = localTasks.filter(t => t.id !== id);
  refreshAllViews();

  showUndoToast(`Đã xóa: "${deletedTask.content}"`, function() {
    localTasks.push(deletedTask);
    refreshAllViews();
    google.script.run.withSuccessHandler(function(data) {
      localTasks = data.tasks || [];
      localNotes = data.notes || [];
      refreshAllViews();
    }).updateTasksInSheet(localTasks);
  });

  google.script.run.withSuccessHandler(function(data) {
    localTasks = data.tasks || [];
    localNotes = data.notes || [];
    refreshAllViews();
  }).updateTasksInSheet(localTasks);
}

function toggleStatus(id) {
  localTasks = localTasks.map(t => {
    if (t.id === id) t.status = (t.status === "Đã xong") ? "Chưa xong" : "Đã xong";
    return t;
  });
  refreshAllViews();

  google.script.run.withSuccessHandler(function(data) {
    localTasks = data.tasks || [];
    localNotes = data.notes || [];
    refreshAllViews();
  }).updateTasksInSheet(localTasks);
}

function renderMonthsList() {
  const monthGrid = document.getElementById('monthGrid');
  monthGrid.innerHTML = '';
  for (let m = 0; m < 12; m++) {
    const div = document.createElement('div');
    div.className = 'month-card';
    div.innerText = `Tháng ${m + 1}`;
    div.style.backgroundColor = monthPastelColors[m].background;
    div.style.color = monthPastelColors[m].text;
    
    div.onclick = function() {
      document.querySelectorAll('.month-card').forEach(c => c.classList.remove('active'));
      div.classList.add('active');
      selectMonth(m);
    };
    monthGrid.appendChild(div);
  }
}

function selectMonth(monthIndex) {
  selectedMonth = monthIndex;
  document.getElementById('daysContainer').style.display = 'block';
  const daysCollapse = document.getElementById('collapseDaysGrid');
  if(daysCollapse && !daysCollapse.classList.contains('show')) {
    new bootstrap.Collapse(daysCollapse, { show: true });
  }
  document.getElementById('selectedMonthTitle').innerHTML = `<i class="fa-solid fa-calendar-days me-2"></i> CHI TIẾT LỊCH TRÌNH THÁNG ${monthIndex + 1}`;
  document.getElementById('noteContainer').style.display = 'none';
  selectedDateStr = "";
  renderDaysGrid(monthIndex);
}

function renderDaysGrid(monthIndex) {
  const daysGrid = document.getElementById('daysGrid');
  daysGrid.innerHTML = '';

  const weekdayLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  weekdayLabels.forEach(lbl => {
    const div = document.createElement('div');
    div.className = 'day-header';
    div.innerText = lbl;
    daysGrid.appendChild(div);
  });

  const firstDay = new Date(currentYear, monthIndex, 1);
  let startDayOfWeek = firstDay.getDay();
  startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
  const totalDays = new Date(currentYear, monthIndex + 1, 0).getDate();

  for (let i = 0; i < startDayOfWeek; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.className = 'day-cell empty';
    daysGrid.appendChild(emptyCell);
  }

  const currentMonthColor = monthPastelColors[monthIndex];

  for (let d = 1; d <= totalDays; d++) {
    const cell = document.createElement('div');
    cell.className = 'day-cell';
    cell.innerText = d;
    cell.style.backgroundColor = currentMonthColor.background;
    cell.style.color = currentMonthColor.text;

    const dateStr = `${currentYear}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const hasNote = localNotes.some(n => n.date === dateStr);
    if (hasNote) cell.classList.add('has-note');
    if (selectedDateStr === dateStr) cell.classList.add('active');

    cell.onclick = function() {
      if (selectedDateStr === dateStr) {
        cell.classList.remove('active');
        selectedDateStr = "";
        document.getElementById('noteContainer').style.display = 'none';
      } else {
        document.querySelectorAll('.day-cell').forEach(c => c.classList.remove('active'));
        cell.classList.add('active');
        selectDay(dateStr);
      }
    };
    daysGrid.appendChild(cell);
  }
}

function selectDay(dateStr) {
  selectedDateStr = dateStr;
  document.getElementById('noteContainer').style.display = 'block';
  const notesCollapse = document.getElementById('collapseNotesForm');
  if(notesCollapse && !notesCollapse.classList.contains('show')) {
    new bootstrap.Collapse(notesCollapse, { show: true });
  }
  const parts = dateStr.split("-");
  document.getElementById('selectedDayTitle').innerHTML = `<i class="fa-solid fa-thumbtack me-2"></i> Kế hoạch tương lai: <span class="text-danger fw-bold">${parts[2]}/${parts[1]}/${parts[0]}</span>`;
  renderDayNotes();
}

function renderDayNotes() {
  const container = document.getElementById('dayNotesList');
  container.innerHTML = '';
  const filtered = localNotes.filter(n => n.date === selectedDateStr);
  if (filtered.length === 0) {
    container.innerHTML = '<div class="text-muted small text-center my-3 fw-medium">Chưa có dự định nào cho ngày này.</div>';
    return;
  }
  filtered.forEach(n => {
    const div = document.createElement('div');
    div.className = 'note-item d-flex align-items-center justify-content-between bg-white p-2.5 mb-2 border rounded shadow-sm';
    div.style.fontSize = '13.5px';
    div.innerHTML = `
    <div class="flex-grow-1 me-2" onclick="openEditModal('note', '${n.id}')">
      <strong>📌 ${n.content}</strong>
      <div class="text-muted" style="font-size: 11px; margin-top:3px;">
        <span class="badge text-dark border-secondary-subtle" style="background-color:#E3C16F;">${n.tag}</span> | ⏰ Giờ: ${n.time}
      </div>
    </div>
    <button class="btn btn-sm btn-link text-danger p-2 m-0 flex-shrink-0" onclick="deleteNote('${n.id}'); event.stopPropagation();"><i class="fa-solid fa-trash-can"></i></button>
    `;
    container.appendChild(div);
  });
}

function addNote() {
  const content = document.getElementById('noteInput').value.trim();
  const time = document.getElementById('noteTimeInput').value || "00:00";
  const tag = document.getElementById('noteTagInput').value;

  if (!content) { alert("Vui lòng nhập nội dung kế hoạch!"); return; }
  if (!selectedDateStr) { alert("Vui lòng chọn ngày trên bảng lịch!"); return; }

  const newNote = {
    date: selectedDateStr,
    content: content,
    time: time,
    tag: tag,
    id: "NOTE_" + new Date().getTime()
  };

  localNotes.push(newNote);
  refreshAllViews();

  document.getElementById('noteInput').value = '';
  document.getElementById('noteTimeInput').value = '00:00';

  google.script.run
    .withSuccessHandler(function(data) {
      localTasks = data.tasks || [];
      localNotes = data.notes || [];
      refreshAllViews();
    })
    .updateNotesInSheet(localNotes);
}

function deleteNote(id) {
  const deletedNote = localNotes.find(n => n.id === id);
  if (!deletedNote) return;

  localNotes = localNotes.filter(n => n.id !== id);
  refreshAllViews();

  showUndoToast(`Đã xóa ý tưởng: "${deletedNote.content}"`, function() {
    localNotes.push(deletedNote);
    refreshAllViews();
    google.script.run.withSuccessHandler(function(data) {
      localTasks = data.tasks || [];
      localNotes = data.notes || [];
      refreshAllViews();
    }).updateNotesInSheet(localNotes);
  });

  google.script.run.withSuccessHandler(function(data) {
    localTasks = data.tasks || [];
    localNotes = data.notes || [];
    refreshAllViews();
  }).updateNotesInSheet(localNotes);
}

function openEditModal(type, id) {
  document.getElementById('editId').value = id;
  document.getElementById('editType').value = type;
  if (type === 'task') {
    document.getElementById('editModalTitle').innerText = "CHỈNH SỬA NHIỆM VỤ";
    const taskObj = localTasks.find(t => t.id === id);
    if (!taskObj) return;
    document.getElementById('editContent').value = taskObj.content;
    document.getElementById('editDate').value = taskObj.date;
    document.getElementById('editTime').value = taskObj.time || "00:00";
    document.getElementById('editTag').value = taskObj.tag || "🔱 Quan trọng";
  } else if (type === 'note') {
    document.getElementById('editModalTitle').innerText = "CHỈNH SỬA Ý TƯỞNG LỊCH NĂM";
    const noteObj = localNotes.find(n => n.id === id);
    if (!noteObj) return;
    document.getElementById('editContent').value = noteObj.content;
    document.getElementById('editDate').value = noteObj.date;
    document.getElementById('editTime').value = noteObj.time || "00:00";
    document.getElementById('editTag').value = noteObj.tag || "🔱 Quan trọng";
  }
  bsEditModal.show();
}

function saveEditData() {
  const id = document.getElementById('editId').value;
  const type = document.getElementById('editType').value;
  const content = document.getElementById('editContent').value.trim();
  const date = document.getElementById('editDate').value;
  const time = document.getElementById('editTime').value || "00:00";
  const tag = document.getElementById('editTag').value;

  if (!content) { alert("Nội dung trống không thể cập nhật!"); return; }
  if (!date) { alert("Vui lòng cấu hình ngày hợp lệ!"); return; }

  bsEditModal.hide();
  showLoading(true);

  if (type === 'task') {
    localTasks = localTasks.map(t => {
      if (t.id === id) {
        t.content = content; t.date = date; t.time = time; t.tag = tag;
      }
      return t;
    });
    google.script.run.withSuccessHandler(function(data) {
      localTasks = data.tasks || [];
      localNotes = data.notes || [];
      refreshAllViews();
      showLoading(false);
    }).updateTasksInSheet(localTasks);

  } else if (type === 'note') {
    localNotes = localNotes.map(n => {
      if (n.id === id) {
        n.content = content; n.date = date; n.time = time; n.tag = tag;
      }
      return n;
    });
    google.script.run.withSuccessHandler(function(data) {
      localTasks = data.tasks || [];
      localNotes = data.notes || [];
      refreshAllViews();
      showLoading(false);
    }).updateNotesInSheet(localNotes);
  }
}

function showUndoToast(message, undoCallback) {
  const container = document.getElementById('undoToastContainer');
  const toastId = 'toast-' + new Date().getTime();
  
  const toastHtml = `
    <div class="undo-toast" id="${toastId}">
      <span style="font-size:13px; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:240px;">${message}</span>
      <button class="btn-undo-action" id="btn-undo-${toastId}"><i class="fa-solid fa-rotate-left"></i> HOÀN TÁC</button>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', toastHtml);
  
  const toastElement = document.getElementById(toastId);
  const undoButton = document.getElementById(`btn-undo-${toastId}`);
  
  undoButton.onclick = function() {
    undoCallback();
    toastElement.remove();
  };
  
  setTimeout(() => {
    if (document.getElementById(toastId)) {
      toastElement.style.animation = "fadeIn 0.3s ease reverse";
      setTimeout(() => { if (document.getElementById(toastId)) toastElement.remove(); }, 300);
    }
  }, 6000);
}

function navigateToTaskFromDashboard(dateStr, taskId) {
  bsDetailModal.hide();
  const parts = dateStr.split("-");
  currentSelectedDate = new Date(parts[0], parts[1] - 1, parts[2]);
  updateQuickCalendarDisplay(currentSelectedDate);
  const menuLinkTask = document.getElementById('menu-link-task');
  switchView('task', menuLinkTask);
  
  setTimeout(() => {
    const element = document.getElementById(`task-dom-${taskId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('highlight-flash');
      setTimeout(() => { element.classList.remove('highlight-flash'); }, 3000);
    }
  }, 350);
}

function navigateToCalendarFromDashboard(dateStr) {
  bsDetailModal.hide();
  const parts = dateStr.split("-");
  const monthIdx = parseInt(parts[1], 10) - 1;
  const monthCards = document.querySelectorAll('.month-card');
  if(monthCards[monthIdx]) {
    monthCards.forEach(c => c.classList.remove('active'));
    monthCards[monthIdx].classList.add('active');
  }
  
  selectMonth(monthIdx);
  selectDay(dateStr);
  
  const menuLinkCalendar = document.getElementById('menu-link-calendar');
  switchView('calendar', menuLinkCalendar);
}

function showDashboardDetails(type) {
  const titleEl = document.getElementById('detailModalTitle');
  const bodyEl = document.getElementById('detailModalBody');
  bodyEl.innerHTML = '';
  let htmlString = '';
  
  if (type === 'all') {
    titleEl.innerText = "SỚ THẢO TOÀN BỘ TASK ĐANG LỌC";
    if(filteredDashboardTasks.length === 0) { bodyEl.innerHTML = '<div class="text-center text-muted py-4">Chưa ghi chép công vụ nào.</div>'; bsDetailModal.show(); return;}
    filteredDashboardTasks.forEach(t => {
      const isDone = t.status === "Đã xong";
      htmlString += `
      <div class="pop-list-item" style="border-left-color: ${isDone ? '#10b981' : '#E3C16F'}" onclick="navigateToTaskFromDashboard('${t.date}', '${t.id}')">
        <span class="badge ${isDone ? 'bg-success' : 'text-dark'} float-end" style="${!isDone ? 'background-color:#E3C16F;' : ''}">${t.status}</span>
        <span class="stt-badge">${t.stt}</span> <strong>${t.content}</strong>
        <div class="text-muted mt-1" style="font-size: 11px;">📅 Ngày: ${t.date} ${t.time ? '| ⏰ Giờ: ' + t.time : ''} | 📌 Phân loại: ${t.tag}</div>
      </div>`;
    });
  }
  else if (type === 'done') {
    titleEl.innerText = "CÔNG VIỆC ĐÃ VIÊN MÃN";
    const doneList = filteredDashboardTasks.filter(t => t.status === "Đã xong");
    if(doneList.length === 0) { bodyEl.innerHTML = '<div class="text-center text-muted py-4">Chưa có nhiệm vụ nào hoàn tất.</div>'; bsDetailModal.show(); return;}
    doneList.forEach(t => {
      htmlString += `
      <div class="pop-list-item" style="border-left-color: #10b981" onclick="navigateToTaskFromDashboard('${t.date}', '${t.id}')">
        <span class="badge bg-success float-end">Đã xong</span>
        <span class="stt-badge">${t.stt}</span> <strong>${t.content}</strong>
        <div class="text-muted mt-1" style="font-size: 11px;">📅 Ngày: ${t.date} ${t.time ? '| ⏰ Giờ: ' + t.time : ''} | 📌 Phân loại: ${t.tag}</div>
      </div>`;
    });
  }
  else if (type === 'pending') {
    titleEl.innerText = "NHIỆM VỤ CẦN TRIỂN KHAI GẤP";
    const pendingList = filteredDashboardTasks.filter(t => t.status !== "Đã xong");
    if(pendingList.length === 0) { bodyEl.innerHTML = '<div class="text-center text-muted py-4">Tuyệt vời! Không có việc tồn đọng.</div>'; bsDetailModal.show(); return;}
    pendingList.forEach(t => {
      htmlString += `
      <div class="pop-list-item" style="border-left-color: #EF4444" onclick="navigateToTaskFromDashboard('${t.date}', '${t.id}')">
        <span class="badge bg-danger text-white float-end">Chưa xong</span>
        <span class="stt-badge">${t.stt}</span> <strong>${t.content}</strong>
        <div class="text-muted mt-1" style="font-size: 11px;">📅 Ngày: ${t.date} ${t.time ? '| ⏰ Giờ: ' + t.time : ''} | 📌 Phân loại: ${t.tag}</div>
      </div>`;
    });
  }
  else if (type === 'note') {
    titleEl.innerText = "Ý TƯỞNG ẤP Ủ TRONG TƯƠNG LAI";
    if(filteredDashboardNotes.length === 0) { bodyEl.innerHTML = '<div class="text-center text-muted py-4">Chưa lập kế hoạch lịch năm nào.</div>'; bsDetailModal.show(); return;}
    filteredDashboardNotes.forEach(n => {
      htmlString += `
      <div class="pop-list-item" style="border-left-color: #06B6D4" onclick="navigateToCalendarFromDashboard('${n.date}')">
        <span class="badge bg-info text-white float-end">Dự định</span>
        <strong>📌 ${n.content}</strong>
        <div class="text-muted mt-1" style="font-size: 11px;">📅 Dự kiến: ${n.date} | ⏰ Giờ: ${n.time} | 📌 Cấp bậc: ${n.tag}</div>
      </div>`;
    });
  }
  bodyEl.innerHTML = htmlString;
  bsDetailModal.show();
}

function switchView(viewName, element) {
  document.querySelectorAll('.view-content').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + viewName).classList.add('active');
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  element.classList.add('active');
  
  const offcanvas = bootstrap.Offcanvas.getInstance(document.getElementById('sidebarMenu'));
  if(offcanvas) offcanvas.hide();
  
  if (viewName === 'dashboard') {
    renderDashboard();
  } else if (viewName === 'task') {
    renderTasks(localTasks);
  }
}
