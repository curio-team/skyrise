let ws = null;
let roomCode = null;
let studentId = null;
let studentData = null;
let allStudents = [];
let levels = [];
let totalLevels = 10;
let reconnectAttempts = 0;
let reconnectTimeout = null;

async function joinRoom() {
  const roomCodeInput = document.getElementById('room-code').value.trim().toUpperCase();
  const studentName = document.getElementById('student-name').value.trim();

  if (!roomCodeInput) {
    showError('Please enter a room code');
    return;
  }

  if (!studentName) {
    showError('Please enter your name');
    return;
  }

  try {
    const response = await fetch(`/api/rooms/${roomCodeInput}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: studentName })
    });

    const data = await response.json();

    if (data.success) {
      roomCode = roomCodeInput;
      studentId = data.studentId;
      studentData = data.student;

      document.getElementById('login-container').style.display = 'none';
      document.getElementById('student-container').style.display = 'block';
      document.getElementById('room-code-display').textContent = roomCode;
      document.getElementById('student-name-display').textContent = studentName;

      // Cache session so a page refresh reconnects automatically
      saveSession(studentName);

      // Load levels configuration
      await loadLevels();

      // Connect WebSocket
      connectWebSocket();

      // Update UI with initial data
      updateStudentView();
    } else {
      showError(data.error || 'Failed to join room');
    }
  } catch (error) {
    console.error('Error joining room:', error);
    showError('Failed to join room');
  }
}

async function loadLevels() {
  try {
    const response = await fetch(`/api/rooms/${roomCode}/config`);
    const data = await response.json();

    if (data.success) {
      levels = data.levels;
      totalLevels = data.totalLevels;
      document.getElementById('total-levels').textContent = totalLevels;
    }
  } catch (error) {
    console.error('Error loading levels:', error);
  }
}

function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws?room=${roomCode}&role=student&studentId=${studentId}`;

  updateConnectionStatus('connecting');
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('WebSocket connected');
    updateConnectionStatus('connected');
    reconnectAttempts = 0;
  };

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      handleMessage(message);
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  ws.onclose = () => {
    console.log('WebSocket closed');
    updateConnectionStatus('disconnected');
    attemptReconnect();
  };
}

function attemptReconnect() {
  reconnectAttempts++;
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);

  console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);

  reconnectTimeout = setTimeout(() => {
    connectWebSocket();
  }, delay);
}

function sendMessage(message) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function handleMessage(message) {
  switch (message.type) {
    case 'room_state':
      handleRoomState(message.data);
      break;
    case 'level_completed':
      handleLevelCompleted(message.data);
      break;
    case 'answer_rejected':
      showInteractionFeedback(message.data.message, false);
      break;
    case 'student_joined':
      handleStudentJoined(message.data);
      break;
    case 'student_disconnected':
      handleStudentDisconnected(message.data);
      break;
    case 'kicked':
      handleKicked(message.data);
      break;
    case 'error':
      showError(message.data.message);
      break;
    case 'pong':
      // Heartbeat response
      break;
    default:
      console.warn('Unknown message type:', message.type);
  }
}

function handleRoomState(data) {
  if (data.students) {
    allStudents = data.students;
    const myStudent = data.students.find(s => s.id === studentId);
    if (myStudent) {
      studentData = myStudent;
      updateStudentView();
    }
  }
}

function handleStudentJoined(data) {
  if (data.student) {
    const idx = allStudents.findIndex(s => s.id === data.student.id);
    if (idx >= 0) {
      allStudents[idx] = data.student;
    } else {
      allStudents.push(data.student);
    }
    updatePeerCount();
  }
}

function handleStudentDisconnected(data) {
  allStudents = allStudents.filter(s => s.id !== data.studentId);
  updatePeerCount();
}

function handleKicked(data) {
  // Stop reconnection attempts
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  if (ws) {
    ws.onclose = null;
    ws.onerror = null;
    ws.close();
    ws = null;
  }
  clearSession();

  // Return to login
  document.getElementById('student-container').style.display = 'none';
  document.getElementById('login-container').style.display = 'block';
  showError(data?.message || 'You have been removed from the room.');
}

function handleLevelCompleted(data) {
  if (data.student) {
    const idx = allStudents.findIndex(s => s.id === data.student.id);
    if (idx >= 0) {
      allStudents[idx] = data.student;
    }
  }
  if (data.studentId === studentId) {
    studentData = data.student;
    updateStudentView();
    animateLevelComplete(data.rewards);
  } else {
    updatePeerCount();
  }
}

function updateStudentView() {
  if (!studentData) return;

  const currentLevel = studentData.current_level - 1;
  document.getElementById('current-level').textContent = currentLevel;

  // Building visualization removed from student view

  // Update level info
  const level = levels.find(l => l.id === studentData.current_level);

  if (level) {
    document.getElementById('level-title').textContent = `Level ${level.id}: ${level.title}`;
    document.getElementById('level-description').textContent = level.description;
    document.getElementById('assignment-text').textContent = level.assignmentText;
  } else if (currentLevel >= totalLevels) {
    document.getElementById('level-title').textContent = '🎉 Congratulations!';
    document.getElementById('level-description').textContent = 'You have completed all levels!';
    document.getElementById('assignment-text').textContent =
      'Amazing work! You\'ve built the tallest building in our city. Your dedication and effort have paid off!';
  }

  // Update inventory
  if (studentData.inventory && studentData.inventory.length > 0) {
    document.getElementById('inventory-container').style.display = 'block';
    document.getElementById('inventory-items').innerHTML =
      studentData.inventory.map(item =>
        `<div class="inventory-item">${escapeHtml(item)}</div>`
      ).join('');
  } else {
    document.getElementById('inventory-container').style.display = 'none';
  }

  // Render type-specific interaction UI
  renderLevelInteraction(level);

  // Update peer count
  updatePeerCount();
}

function updatePeerCount() {
  const el = document.getElementById('peers-at-level');
  if (!el || !studentData) return;
  const myLevel = studentData.current_level;
  const count = allStudents.filter(s => s.id !== studentId && s.current_level === myLevel).length;
  if (count === 0) {
    el.textContent = '';
    el.style.display = 'none';
  } else {
    el.textContent = `👥 ${count} ${count === 1 ? 'other' : 'others'} at this level`;
    el.style.display = 'inline-block';
  }
}

// ---------------------------------------------------------------------------
// Level interaction rendering
// ---------------------------------------------------------------------------

function renderLevelInteraction(level) {
  const container = document.getElementById('level-interaction');
  const staticHint = document.getElementById('static-hint');

  if (!level || level.type === 'static' || !level.type) {
    container.style.display = 'none';
    container.innerHTML = '';
    staticHint.style.display = 'block';
    return;
  }

  staticHint.style.display = 'none';
  container.style.display = 'block';

  switch (level.type) {
    case 'multiple_choice':
      container.innerHTML = renderMultipleChoice(level);
      break;
    case 'open_input':
      container.innerHTML = renderOpenInput(level);
      break;
    case 'click_button':
      container.innerHTML = renderClickButton(level);
      // Inject the trick script after the element is in the DOM
      if (level.handlerConfig && level.handlerConfig.injectScript) {
        try {
          const fn = new Function(level.handlerConfig.injectScript);
          fn();
        } catch (e) {
          console.warn('injectScript error:', e);
        }
      }
      break;
    default:
      container.innerHTML = '';
      staticHint.style.display = 'block';
  }
}

function renderMultipleChoice(level) {
  const cfg = level.handlerConfig || {};
  const choices = Array.isArray(cfg.choices) ? cfg.choices : [];
  const question = escapeHtml(cfg.question || 'Choose the correct answer:');

  const choicesHtml = choices.map((choice, i) => `
    <label class="mc-choice">
      <input type="radio" name="mc-choice-${level.id}" value="${i}">
      ${escapeHtml(choice)}
    </label>
  `).join('');

  return `
    <div class="level-interaction-panel">
      <div class="mc-question">${question}</div>
      <div class="mc-choices">${choicesHtml}</div>
      <div id="interaction-feedback" class="answer-feedback"></div>
      <button class="btn" style="margin-top:16px;" onclick="submitMultipleChoice(${level.id})">Submit Answer</button>
    </div>
  `;
}

function renderOpenInput(level) {
  const cfg = level.handlerConfig || {};
  const prompt = escapeHtml(cfg.prompt || 'Enter your answer:');
  const placeholder = escapeHtml(cfg.placeholder || '');

  return `
    <div class="level-interaction-panel">
      <div class="open-input-prompt">${prompt}</div>
      <textarea id="open-input-answer" class="open-input-field" placeholder="${placeholder}"></textarea>
      <div id="interaction-feedback" class="answer-feedback"></div>
      <button class="btn" onclick="submitOpenInput(${level.id})">Submit Answer</button>
    </div>
  `;
}

function renderClickButton(level) {
  const cfg = level.handlerConfig || {};
  const label = escapeHtml(cfg.buttonLabel || 'Click Me!');

  return `
    <div class="level-interaction-panel">
      <div class="click-button-wrapper">
        <button id="level-action-btn" class="btn btn-secondary" style="width:auto; padding: 14px 32px; font-size:1.1em;"
          onclick="submitButtonClick(${level.id})">
          ${label}
        </button>
      </div>
      <div id="interaction-feedback" class="answer-feedback"></div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Submission helpers
// ---------------------------------------------------------------------------

function submitMultipleChoice(levelId) {
  const selected = document.querySelector(`input[name="mc-choice-${levelId}"]:checked`);
  if (!selected) {
    showInteractionFeedback('Please select an answer first.', false);
    return;
  }
  sendMessage({ type: 'submit_answer', data: { levelId, submission: { selectedIndex: parseInt(selected.value) } } });
}

function submitOpenInput(levelId) {
  const textarea = document.getElementById('open-input-answer');
  const answer = textarea ? textarea.value.trim() : '';
  if (!answer) {
    showInteractionFeedback('Please write your answer first.', false);
    return;
  }
  sendMessage({ type: 'submit_answer', data: { levelId, submission: { answer } } });
}

function submitButtonClick(levelId) {
  sendMessage({ type: 'button_clicked', data: { levelId } });
}

function showInteractionFeedback(message, success) {
  const el = document.getElementById('interaction-feedback');
  if (!el) return;
  el.textContent = message;
  el.className = 'answer-feedback ' + (success ? 'success' : 'error');
}

function animateLevelComplete(rewards) {
  // Simple celebration animation
  const levelInfo = document.getElementById('level-info');
  levelInfo.style.transition = 'transform 0.5s ease';
  levelInfo.style.transform = 'scale(1.05)';

  setTimeout(() => {
    levelInfo.style.transform = 'scale(1)';
  }, 500);

  // Show rewards notification
  if (rewards && rewards.length > 0) {
    const rewardText = rewards.join(', ');
    const notification = document.createElement('div');
    notification.className = 'reward-notification';
    notification.innerHTML = `
      <h2>🎉 Level Complete!</h2>
      <p>You earned:</p>
      <p class="reward-items">${escapeHtml(rewardText)}</p>
    `;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
}

function updateConnectionStatus(status) {
  const indicator = document.getElementById('connection-indicator');
  indicator.className = `connection-status ${status}`;
}

function showError(message) {
  const errorDiv = document.getElementById('error-message');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  setTimeout(() => {
    errorDiv.style.display = 'none';
  }, 5000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function saveSession(studentName) {
  try {
    sessionStorage.setItem('skyrise_session', JSON.stringify({ roomCode, studentId, studentName }));
  } catch (e) { /* storage unavailable */ }
}

function clearSession() {
  try { sessionStorage.removeItem('skyrise_session'); } catch (e) { /* ignore */ }
}

async function tryRestoreSession() {
  let saved;
  try {
    const raw = sessionStorage.getItem('skyrise_session');
    if (!raw) return false;
    saved = JSON.parse(raw);
  } catch (e) {
    return false;
  }

  const { roomCode: savedRoom, studentName: savedName } = saved;
  if (!savedRoom || !savedName) return false;

  try {
    const response = await fetch(`/api/rooms/${savedRoom}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: savedName })
    });
    const data = await response.json();

    if (data.success) {
      roomCode = savedRoom;
      studentId = data.studentId;
      studentData = data.student;

      document.getElementById('login-container').style.display = 'none';
      document.getElementById('student-container').style.display = 'block';
      document.getElementById('room-code-display').textContent = roomCode;
      document.getElementById('student-name-display').textContent = savedName;

      saveSession(savedName);
      await loadLevels();
      connectWebSocket();
      updateStudentView();
      return true;
    }
  } catch (e) { /* fall through */ }

  clearSession();
  return false;
}

// Handle Enter key in input fields
document.addEventListener('DOMContentLoaded', async () => {
  const restored = await tryRestoreSession();
  if (restored) return;

  const inputs = document.querySelectorAll('#room-code, #student-name');
  inputs.forEach(input => {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        joinRoom();
      }
    });
  });
});

// Heartbeat
setInterval(() => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    sendMessage({ type: 'ping' });
  }
}, 30000);
