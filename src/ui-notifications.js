// Notification system replacing native confirm()/alert()
// GOV.UK-styled inline notification banners

const TYPE_CONFIG = {
  error: { borderColor: '#d4351c', bgClass: 'bg-red-50', defaultTitle: 'Error', role: 'alert' },
  warning: { borderColor: '#f47738', bgClass: 'bg-yellow-50', defaultTitle: 'Warning', role: 'alert' },
  success: { borderColor: '#00703c', bgClass: 'bg-green-50', defaultTitle: 'Success', role: 'status' },
  info: { borderColor: '#1d70b8', bgClass: 'bg-blue-50', defaultTitle: 'Important', role: 'status' }
};

const MAX_NOTIFICATIONS = 3;

function getContainer(containerId) {
  if (containerId) {
    return document.getElementById(containerId);
  }
  // Default: global notification area
  const area = document.getElementById('notificationArea');
  return area ? area.firstElementChild : document.body;
}

function enforceLimit(container) {
  const notifications = container.querySelectorAll('.app-notification');
  while (notifications.length >= MAX_NOTIFICATIONS) {
    notifications[0].remove();
  }
}

export function showNotification({ type = 'info', title, message, autoDismissMs = 8000, containerId } = {}) {
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.info;
  const container = getContainer(containerId);
  if (!container) return null;

  enforceLimit(container);

  const el = document.createElement('div');
  el.className = `app-notification flex items-start gap-3 p-4 mb-2 border-l-4 ${config.bgClass} rounded-r shadow-md`;
  el.style.borderLeftColor = config.borderColor;
  el.setAttribute('role', config.role);

  el.innerHTML = `
    <div class="flex-1">
      <p class="font-bold text-sm" style="color: ${config.borderColor}">${title || config.defaultTitle}</p>
      <p class="text-sm text-gray-700 mt-1">${message}</p>
    </div>
    <button class="notification-dismiss text-gray-600 hover:text-gray-800 text-lg leading-none p-1" aria-label="Dismiss notification">&times;</button>
  `;

  el.querySelector('.notification-dismiss').addEventListener('click', () => dismissNotification(el));

  container.appendChild(el);

  if (autoDismissMs > 0) {
    setTimeout(() => {
      if (el.parentNode) dismissNotification(el);
    }, autoDismissMs);
  }

  return el;
}

export function showConfirm({ title = 'Confirm', message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', containerId } = {}) {
  return new Promise((resolve) => {
    const config = TYPE_CONFIG.warning;
    const container = getContainer(containerId);
    if (!container) { resolve(false); return; }

    enforceLimit(container);
    const triggerEl = document.activeElement;

    // Generate a unique ID for aria-describedby linking
    const descId = 'notification-desc-' + Date.now();

    const el = document.createElement('div');
    el.className = `app-notification flex items-start gap-3 p-4 mb-2 border-l-4 ${config.bgClass} rounded-r shadow-md`;
    el.style.borderLeftColor = config.borderColor;
    el.setAttribute('role', 'alertdialog');
    el.setAttribute('aria-label', title);
    el.setAttribute('aria-describedby', descId);

    el.innerHTML = `
      <div class="flex-1">
        <p class="font-bold text-sm" style="color: ${config.borderColor}">${title}</p>
        <p id="${descId}" class="text-sm text-gray-700 mt-1">${message}</p>
        <div class="flex gap-2 mt-3">
          <button class="confirm-btn px-3 py-1 text-sm font-bold rounded" style="background-color: ${config.borderColor}; color: #0b0c0c">${confirmLabel}</button>
          <button class="cancel-btn px-3 py-1 text-sm font-bold text-gray-600 bg-white border border-gray-300 rounded">${cancelLabel}</button>
        </div>
      </div>
      <button class="notification-dismiss text-gray-600 hover:text-gray-800 text-lg leading-none p-1" aria-label="Dismiss">&times;</button>
    `;

    function cleanup(result) {
      if (el.parentNode) el.remove();
      if (triggerEl && triggerEl.focus) triggerEl.focus();
      resolve(result);
    }

    el.querySelector('.confirm-btn').addEventListener('click', () => cleanup(true));
    el.querySelector('.cancel-btn').addEventListener('click', () => cleanup(false));
    el.querySelector('.notification-dismiss').addEventListener('click', () => cleanup(false));

    container.appendChild(el);

    // Focus trap: keep Tab/Shift-Tab within the dialog; Escape cancels
    const focusableEls = el.querySelectorAll('button');
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        const first = focusableEls[0];
        const last = focusableEls[focusableEls.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        cleanup(false);
      }
    });

    el.querySelector('.confirm-btn').focus();
  });
}

export function dismissNotification(el) {
  if (el && el.parentNode) {
    el.remove();
  }
}
