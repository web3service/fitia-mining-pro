// ═══════════════════════════════════════════════════════════════════
//  HISTORIQUE LOCAL & NOTIFICATIONS — AUCUNE CLÉ / PHRASE MÉMORISÉE
// ═══════════════════════════════════════════════════════════════════
(function (global) {
  'use strict';

  const STORAGE_PREFIX = 'fitia_activity_v1:';
  const DEFAULT_EXPLORER = 'https://polygonscan.com';
  const MAX_TRANSACTIONS = 100;
  const MAX_NOTIFICATIONS = 100;
  const VALID_STATUSES = new Set(['pending', 'success', 'failed']);
  const HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;
  const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
  const DEFAULT_TEXT = {
    activityDefaultTitle: 'Polygon transaction',
    activityPendingMessage: 'Waiting for on-chain confirmation…',
    activitySuccessMessage: 'On-chain response: transaction confirmed.',
    activityFailedMessage: 'On-chain response: transaction failed. Contract reason unavailable.',
    activityPendingNotification: 'Transaction pending',
    activitySuccessNotification: 'On-chain response: success',
    activityFailureNotification: 'On-chain response: failure',
    activityTxSuccess: 'On-chain response: success (status 1).',
    activityTxFailure: 'On-chain response: failure (status 0).',
    activityTxUnconfirmed: 'On-chain response: transaction not confirmed.',
    activityTxReplaced: 'Transaction replaced or cancelled before confirmation.',
    activityContractPrefix: 'Contract:',
    activityReasonUnavailableReceipt: 'Contract reason unavailable in the receipt.',
    activityReasonUnavailable: 'Contract reason unavailable.',
    activityOperation: 'operation',
    activityOperations: 'operations',
    activityNoResults: 'No results',
    activityNoTransactions: 'No transactions recorded',
    activityChangeFilter: 'Change the filter to display other transactions.',
    activityHistoryEmpty: 'Your next transactions initiated in FITIA PRO will appear here.',
    activityNoNotifications: 'No notifications',
    activityNotificationsEmpty: 'Transaction submissions, confirmations and failures will appear here.',
    activityPendingCount: '{count} pending',
    activityUpToDate: 'Up to date',
    activityStatusPending: 'Pending',
    activityStatusSuccess: 'Confirmed',
    activityStatusFailed: 'Failed',
    activityReceiptBlock: 'On-chain receipt • Block #{block}'
  };

  class FitiaActivityCenter {
    constructor(options = {}) {
      this.account = null;
      this.state = { transactions: [], notifications: [] };
      this.activeTab = 'history';
      this.filter = 'all';
      this.watched = new Set();
      this.explorer = this.safeExplorer(options.explorer);
      this.formatError = typeof options.formatError === 'function' ? options.formatError : null;
      this.translate = typeof options.translate === 'function' ? options.translate : null;
      this.language = typeof options.language === 'function' ? options.language : null;
    }

    t(key, values = {}) {
      let text = '';
      try {
        if (this.translate) text = this.translate(key);
      } catch (_) { /* Le repli anglais reste disponible. */ }
      if (!text || text === key) text = DEFAULT_TEXT[key] || key;
      return Object.entries(values).reduce(
        (result, [name, value]) => result.split(`{${name}}`).join(String(value)),
        String(text)
      );
    }

    locale() {
      let lang = 'en';
      try { lang = this.language ? this.language() : 'en'; } catch (_) { /* Anglais par défaut. */ }
      return { fr: 'fr-FR', de: 'de-DE', zh: 'zh-CN', sg: 'en-SG', en: 'en-US' }[lang] || 'en-US';
    }

    safeExplorer(value) {
      try {
        const url = new URL(String(value || DEFAULT_EXPLORER));
        if (url.protocol === 'https:' && url.hostname.toLowerCase() === 'polygonscan.com') {
          return DEFAULT_EXPLORER;
        }
      } catch (_) { /* Domaine officiel utilisé par défaut. */ }
      return DEFAULT_EXPLORER;
    }

    cleanText(value, maxLength = 180) {
      return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLength);
    }

    storageKey() {
      return this.account ? `${STORAGE_PREFIX}${this.account.toLowerCase()}` : null;
    }

    emptyState() {
      return { transactions: [], notifications: [] };
    }

    normalizeTransaction(raw) {
      if (!raw || !HASH_PATTERN.test(String(raw.hash || ''))) return null;
      const createdAt = Number(raw.createdAt);
      const updatedAt = Number(raw.updatedAt);
      const status = VALID_STATUSES.has(raw.status) ? raw.status : 'pending';
      const defaultContractMessage = status === 'pending'
        ? this.t('activityPendingMessage')
        : status === 'success'
          ? this.t('activitySuccessMessage')
          : this.t('activityFailedMessage');
      return {
        hash: String(raw.hash).toLowerCase(),
        type: this.cleanText(raw.type || 'other', 30),
        title: this.cleanText(raw.title || this.t('activityDefaultTitle'), 100),
        description: this.cleanText(raw.description || '', 220),
        amount: this.cleanText(raw.amount || '', 60),
        token: this.cleanText(raw.token || '', 16),
        to: ADDRESS_PATTERN.test(String(raw.to || '')) ? String(raw.to).toLowerCase() : '',
        status,
        contractMessage: this.cleanText(raw.contractMessage || defaultContractMessage, 420),
        createdAt: Number.isFinite(createdAt) && createdAt > 0 ? createdAt : Date.now(),
        updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : Date.now(),
        blockNumber: raw.blockNumber != null && Number.isSafeInteger(Number(raw.blockNumber)) && Number(raw.blockNumber) >= 0
          ? Number(raw.blockNumber)
          : null
      };
    }

    normalizeNotification(raw) {
      if (!raw || !raw.id) return null;
      const createdAt = Number(raw.createdAt);
      return {
        id: this.cleanText(raw.id, 80),
        type: this.cleanText(raw.type || 'info', 20),
        title: this.cleanText(raw.title || 'Notification', 100),
        message: this.cleanText(raw.message || '', 260),
        txHash: HASH_PATTERN.test(String(raw.txHash || '')) ? String(raw.txHash).toLowerCase() : null,
        createdAt: Number.isFinite(createdAt) && createdAt > 0 ? createdAt : Date.now(),
        read: Boolean(raw.read)
      };
    }

    load() {
      const key = this.storageKey();
      if (!key) return this.emptyState();
      try {
        const parsed = JSON.parse(global.localStorage.getItem(key) || '{}');
        return {
          transactions: (Array.isArray(parsed.transactions) ? parsed.transactions : [])
            .map((entry) => this.normalizeTransaction(entry))
            .filter(Boolean)
            .slice(0, MAX_TRANSACTIONS),
          notifications: (Array.isArray(parsed.notifications) ? parsed.notifications : [])
            .map((entry) => this.normalizeNotification(entry))
            .filter(Boolean)
            .slice(0, MAX_NOTIFICATIONS)
        };
      } catch (_) {
        return this.emptyState();
      }
    }

    save() {
      const key = this.storageKey();
      if (!key) return;
      try {
        global.localStorage.setItem(key, JSON.stringify(this.state));
      } catch (_) {
        // Un quota de stockage ne doit jamais interrompre une transaction.
      }
    }

    setAccount(address) {
      const normalized = String(address || '').toLowerCase();
      this.account = ADDRESS_PATTERN.test(normalized) ? normalized : null;
      this.state = this.load();
      this.watched.clear();
      this.render();
    }

    hasPending() {
      return this.state.transactions.some((entry) => entry.status === 'pending');
    }

    getUnreadCount() {
      return this.state.notifications.filter((entry) => !entry.read).length;
    }

    transactionUrl(hash) {
      return HASH_PATTERN.test(String(hash || '')) ? `${this.explorer}/tx/${String(hash).toLowerCase()}` : null;
    }

    addressUrl(address = this.account) {
      return ADDRESS_PATTERN.test(String(address || '')) ? `${this.explorer}/address/${String(address).toLowerCase()}` : null;
    }

    openUrl(url) {
      if (!url || !url.startsWith(`${DEFAULT_EXPLORER}/`)) return;
      const popup = global.open(url, '_blank', 'noopener,noreferrer');
      if (!popup) global.location.assign(url);
    }

    openTransaction(hash) {
      this.openUrl(this.transactionUrl(hash));
    }

    entryMessage(entry) {
      const amount = entry.amount ? ` • ${entry.amount}${entry.token ? ` ${entry.token}` : ''}` : '';
      return `${entry.title}${amount} • ${this.shortHash(entry.hash)}`;
    }

    track(tx, metadata = {}) {
      const entry = this.normalizeTransaction({
        ...metadata,
        hash: tx?.hash,
        to: metadata.to || tx?.to || '',
        status: 'pending',
        contractMessage: this.t('activityPendingMessage'),
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      if (!entry || !this.account) return null;

      const existingIndex = this.state.transactions.findIndex((item) => item.hash === entry.hash);
      const isNew = existingIndex === -1;
      if (isNew) {
        this.state.transactions.unshift(entry);
      } else {
        const existing = this.state.transactions[existingIndex];
        this.state.transactions[existingIndex] = {
          ...existing,
          ...entry,
          createdAt: existing.createdAt,
          status: existing.status,
          contractMessage: existing.status === 'pending' ? entry.contractMessage : existing.contractMessage,
          blockNumber: existing.status === 'pending' ? entry.blockNumber : existing.blockNumber
        };
      }
      this.state.transactions = this.state.transactions.slice(0, MAX_TRANSACTIONS);
      this.save();
      if (isNew) this.notify('pending', this.t('activityPendingNotification'), this.entryMessage(entry), entry.hash);
      else this.render();

      if (typeof tx?.wait === 'function') this.watch(tx, entry.hash);
      return entry;
    }

    contractErrorDetail(error) {
      const revertName = this.cleanText(error?.revert?.name || '', 80);
      if (revertName) {
        let args = [];
        try {
          args = error?.revert?.args
            ? Array.from(error.revert.args).map((value) => this.cleanText(value, 70))
            : [];
        } catch (_) { /* Le nom de l'erreur reste exploitable sans ses arguments. */ }
        return `${revertName}${args.length ? `(${args.join(', ')})` : ''}`;
      }
      const reason = this.cleanText(error?.reason || '', 180);
      if (reason) return reason;
      const shortMessage = this.cleanText(error?.shortMessage || '', 180);
      return shortMessage.toLowerCase().includes('revert') ? shortMessage : '';
    }

    friendlyContractError(error) {
      if (!this.formatError) return '';
      try {
        return this.cleanText(this.formatError(error), 180);
      } catch (_) {
        return '';
      }
    }

    buildContractMessage(status, receipt = null, error = null) {
      if (status === 'success') return this.t('activityTxSuccess');
      const parts = [
        receipt && error?.code !== 'TRANSACTION_REPLACED'
          ? this.t('activityTxFailure')
          : this.t('activityTxUnconfirmed')
      ];
      if (error?.code === 'TRANSACTION_REPLACED') {
        parts.push(this.t('activityTxReplaced'));
      } else {
        const detail = this.contractErrorDetail(error);
        if (detail) {
          parts.push(`${this.t('activityContractPrefix')} ${detail.replace(/[.]+$/, '')}.`);
          const friendly = this.friendlyContractError(error);
          if (friendly && friendly !== detail && friendly !== `${this.t('activityContractPrefix')} ${detail}`) parts.push(friendly);
        } else {
          parts.push(this.t(receipt ? 'activityReasonUnavailableReceipt' : 'activityReasonUnavailable'));
        }
      }
      return parts.join(' ');
    }

    watch(tx, hash) {
      if (this.watched.has(hash)) return;
      const watchedAccount = this.account;
      this.watched.add(hash);
      Promise.resolve()
        .then(() => tx.wait())
        .then((receipt) => {
          if (!receipt) {
            this.watched.delete(hash);
            return;
          }
          if (this.account !== watchedAccount) return;
          const failed = Number(receipt.status ?? 1) === 0;
          this.finalize(hash, failed ? 'failed' : 'success', receipt);
        })
        .catch((error) => {
          // Une erreur réseau laisse l'opération en attente pour une reprise ultérieure.
          if (error?.receipt || error?.code === 'CALL_EXCEPTION' || error?.code === 'TRANSACTION_REPLACED') {
            if (this.account !== watchedAccount) return;
            const receipt = error.receipt || null;
            const failed = error?.code === 'TRANSACTION_REPLACED' || Number(receipt?.status ?? 0) === 0;
            this.finalize(hash, failed ? 'failed' : 'success', receipt, error);
          } else {
            this.watched.delete(hash);
          }
        });
    }

    finalize(hash, status, receipt = null, error = null) {
      if (!VALID_STATUSES.has(status) || status === 'pending') return;
      const normalizedHash = String(hash || '').toLowerCase();
      const entry = this.state.transactions.find((item) => item.hash === normalizedHash);
      if (!entry || entry.status !== 'pending') return;
      entry.status = status;
      entry.updatedAt = Date.now();
      entry.contractMessage = this.buildContractMessage(status, receipt, error);
      if (receipt?.blockNumber != null && Number.isSafeInteger(Number(receipt.blockNumber)) && Number(receipt.blockNumber) >= 0) {
        entry.blockNumber = Number(receipt.blockNumber);
      }
      this.save();
      this.notify(
        status,
        this.t(status === 'success' ? 'activitySuccessNotification' : 'activityFailureNotification'),
        `${this.entryMessage(entry)} • ${entry.contractMessage}`,
        entry.hash
      );
    }

    async refreshPending(provider) {
      if (!provider || !this.account) return;
      const pending = this.state.transactions.filter((entry) => entry.status === 'pending');
      for (const entry of pending) {
        try {
          const receipt = await provider.getTransactionReceipt(entry.hash);
          if (receipt) {
            const failed = Number(receipt.status ?? 1) === 0;
            this.finalize(entry.hash, failed ? 'failed' : 'success', receipt);
          } else if (typeof provider.waitForTransaction === 'function') {
            this.watch({ wait: () => provider.waitForTransaction(entry.hash, 1) }, entry.hash);
          }
        } catch (_) {
          // Le prochain déverrouillage ou rafraîchissement réessaiera.
        }
      }
    }

    notify(type, title, message, txHash = null) {
      if (!this.account) return;
      this.state.notifications.unshift({
        id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        type: this.cleanText(type || 'info', 20),
        title: this.cleanText(title, 100),
        message: this.cleanText(message, 260),
        txHash: HASH_PATTERN.test(String(txHash || '')) ? String(txHash).toLowerCase() : null,
        createdAt: Date.now(),
        read: false
      });
      this.state.notifications = this.state.notifications.slice(0, MAX_NOTIFICATIONS);
      this.save();
      this.render();
    }

    markNotificationRead(id) {
      const notification = this.state.notifications.find((entry) => entry.id === id);
      if (!notification || notification.read) return;
      notification.read = true;
      this.save();
      this.render();
    }

    markAllNotificationsRead() {
      let changed = false;
      this.state.notifications.forEach((entry) => {
        if (!entry.read) {
          entry.read = true;
          changed = true;
        }
      });
      if (changed) {
        this.save();
        this.render();
      }
    }

    setTab(tab) {
      this.activeTab = tab === 'notifications' ? 'notifications' : 'history';
      this.render();
    }

    setFilter(filter) {
      this.filter = VALID_STATUSES.has(filter) ? filter : 'all';
      this.renderHistory();
    }

    shortHash(hash) {
      const value = String(hash || '');
      return value.length > 16 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value;
    }

    formatDate(timestamp) {
      try {
        return new Intl.DateTimeFormat(this.locale(), {
          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
        }).format(new Date(Number(timestamp)));
      } catch (_) {
        return new Date(Number(timestamp)).toLocaleString();
      }
    }

    element(tag, className = '', text = null) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== null) node.textContent = text;
      return node;
    }

    emptyMessage(title, message, icon = '◷') {
      const empty = this.element('div', 'activity-empty');
      empty.appendChild(this.element('div', 'activity-empty-icon', icon));
      empty.appendChild(this.element('strong', '', title));
      empty.appendChild(this.element('p', '', message));
      return empty;
    }

    render() {
      this.renderBadge();
      this.renderTabs();
      this.renderHistory();
      this.renderNotifications();
    }

    renderBadge() {
      const count = this.getUnreadCount();
      const label = count > 99 ? '99+' : String(count);
      ['activity-unread-badge', 'activity-tab-badge'].forEach((id) => {
        const badge = document.getElementById(id);
        if (!badge) return;
        badge.textContent = label;
        badge.classList.toggle('hidden', count === 0);
      });
      const pending = this.state.transactions.filter((entry) => entry.status === 'pending').length;
      const pendingBadge = document.getElementById('wallet-pending-count');
      if (pendingBadge) {
        pendingBadge.textContent = pending ? this.t('activityPendingCount', { count: pending }) : this.t('activityUpToDate');
        pendingBadge.classList.toggle('has-pending', pending > 0);
      }
    }

    renderTabs() {
      const historyTab = document.getElementById('activity-tab-history');
      const notificationTab = document.getElementById('activity-tab-notifications');
      const historyPanel = document.getElementById('activity-history-panel');
      const notificationPanel = document.getElementById('activity-notifications-panel');
      historyTab?.classList.toggle('active', this.activeTab === 'history');
      notificationTab?.classList.toggle('active', this.activeTab === 'notifications');
      historyTab?.setAttribute('aria-selected', String(this.activeTab === 'history'));
      notificationTab?.setAttribute('aria-selected', String(this.activeTab === 'notifications'));
      historyPanel?.classList.toggle('hidden', this.activeTab !== 'history');
      notificationPanel?.classList.toggle('hidden', this.activeTab !== 'notifications');
    }

    renderHistory() {
      const list = document.getElementById('activity-history-list');
      if (!list) return;
      list.innerHTML = '';
      const entries = this.state.transactions.filter((entry) => this.filter === 'all' || entry.status === this.filter);
      const count = document.getElementById('activity-history-count');
      if (count) {
        count.textContent = `${entries.length} ${this.t(entries.length === 1 ? 'activityOperation' : 'activityOperations')}`;
      }
      if (!entries.length) {
        const filtered = this.state.transactions.length > 0;
        list.appendChild(this.emptyMessage(
          this.t(filtered ? 'activityNoResults' : 'activityNoTransactions'),
          this.t(filtered ? 'activityChangeFilter' : 'activityHistoryEmpty'),
          filtered ? '⌕' : '◷'
        ));
        return;
      }

      const icons = {
        send: '↗', approval: '✓', deposit: '↓', withdraw: '↑', purchase: '🛒',
        mining: '⚡', claim: '🎁', referral: '👥', swap: '⇄', other: '•'
      };
      const statusLabels = {
        pending: this.t('activityStatusPending'),
        success: this.t('activityStatusSuccess'),
        failed: this.t('activityStatusFailed')
      };
      entries.forEach((entry) => {
        const item = this.element('article', `activity-item status-${entry.status}`);
        const symbol = this.element('div', `activity-type-icon type-${entry.type}`, icons[entry.type] || icons.other);
        const main = this.element('div', 'activity-item-main');
        const titleRow = this.element('div', 'activity-title-row');
        titleRow.appendChild(this.element('strong', 'activity-item-title', entry.title));
        titleRow.appendChild(this.element('span', `activity-status status-${entry.status}`, statusLabels[entry.status]));
        main.appendChild(titleRow);
        if (entry.amount) {
          main.appendChild(this.element('div', 'activity-amount', `${entry.amount}${entry.token ? ` ${entry.token}` : ''}`));
        }
        if (entry.description) main.appendChild(this.element('div', 'activity-description', entry.description));
        if (entry.contractMessage) {
          main.appendChild(this.element('div', `activity-contract-message status-${entry.status}`, entry.contractMessage));
        }
        if (entry.blockNumber != null) {
          main.appendChild(this.element('div', 'activity-block', this.t('activityReceiptBlock', { block: entry.blockNumber })));
        }
        main.appendChild(this.element('div', 'activity-meta', `${this.formatDate(entry.createdAt)} • ${this.shortHash(entry.hash)}`));
        item.append(symbol, main);
        list.appendChild(item);
      });
    }

    renderNotifications() {
      const list = document.getElementById('activity-notifications-list');
      if (!list) return;
      list.innerHTML = '';
      const markAll = document.getElementById('activity-mark-all-read');
      if (markAll) markAll.disabled = this.getUnreadCount() === 0;
      if (!this.state.notifications.length) {
        list.appendChild(this.emptyMessage(
          this.t('activityNoNotifications'),
          this.t('activityNotificationsEmpty'),
          '♪'
        ));
        return;
      }

      const icons = { pending: '◷', success: '✓', failed: '!', info: 'i' };
      this.state.notifications.forEach((entry) => {
        const item = this.element('button', `notification-item${entry.read ? '' : ' unread'}`);
        item.type = 'button';
        item.addEventListener('click', () => this.markNotificationRead(entry.id));
        item.appendChild(this.element('span', `notification-icon status-${entry.type}`, icons[entry.type] || icons.info));
        const content = this.element('span', 'notification-content');
        const titleRow = this.element('span', 'notification-title-row');
        titleRow.appendChild(this.element('strong', '', entry.title));
        if (!entry.read) titleRow.appendChild(this.element('span', 'notification-unread-dot', ''));
        content.appendChild(titleRow);
        content.appendChild(this.element('span', 'notification-message', entry.message));
        content.appendChild(this.element('span', 'notification-time', this.formatDate(entry.createdAt)));
        item.appendChild(content);
        list.appendChild(item);
      });
    }
  }

  global.FitiaActivityCenter = FitiaActivityCenter;
})(window);
