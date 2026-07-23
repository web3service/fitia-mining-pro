// ═══════════════════════════════════════════════════════════════════

// ─── Configuration ─────────────────────────────────────────────────
const CONFIG = {
  CORE: "0x1b8EdFb91168Fb233F8CA7cf1631038AC193D743",
  MINE: "0xBd9FA9801eDA247b28B3BB9dDBf1CF52cA563Bc6",
  USDT: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
  FTA:  "0x5c418b12c7e9c2A8e9A71A68c6d9b319E7B1d1fd",
  CHAIN_ID: 137,
  WC_PROJECT_ID: "2c10ee910a836551fbabbf7c8cc4542a",
  WHATSAPP_GROUP: "https://chat.whatsapp.com/BDsvPCB6xp8H8X0YaRmPFP",
  WHATSAPP_CHANNEL: "https://whatsapp.com/channel/0029VbCQhI38PgsPLbBJdV1e"
};

// ─── Traductions i18n (5 langues) ──────────────────────────────────
const i18n = {
  en: {
    connect: "Connect", refTitle: "👥 Referral System", refDesc: "Enter referrer address or ID to link.", bindRef: "BIND",
    power: "POWER", ftaSec: "Hashrate", pending: "PENDING", fta: "FTA", miningActive: "MINING ACTIVE", noMachine: "NO MACHINE", claim: "CLAIM",
    shopTitle: "⛏️ Shop", machines: "Machines", batteries: "Batteries", buy: "BUY",
    myAssets: "⚙️ Wallet & Assets", walletBal: "💰 Balances", plugMachine: "🔌 Plug in a machine", plugDesc: "Select a machine index and battery type.",
    machineId: "Machine Index (0, 1...)", plug: "PLUG IN ⚡",
    swapTitle: "💱 Swap", youPay: "You pay", balance: "Balance:", youReceive: "You receive", swap: "SWAP",
    loading: "Loading...", currentRate: "1 FTA = ",
    home: "Home", shop: "Shop", assets: "Wallet", swapNav: "Swap",
    connWallet: "Connecting...", errConn: "Connection Error",
    linking: "Linking...", refLinked: "Referrer linked!", connFirst: "Connect first",
    enterRefAddr: "Referrer address or ID (0x...)", enterRefId: "Referrer ID (number)",
    buyingMachine: "Buying Machine", buyingBattery: "Buying Battery",
    confirming: "Confirming...", calcFta: "Calculating price...",
    machineBought: "Machine purchased!", batteryBought: "Battery purchased!",
    invalidId: "Invalid Machine Index", pluggingIn: "Plugging in...", pluggedIn: "Machine plugged in! ⚡",
    invalidAmount: "Invalid amount", swapping: "Swapping...", swapSuccess: "Swap successful!",
    claiming: "Claiming...", claimed: "Rewards claimed!",
    error: "Error", days: "Days", rig: "RIG",
    totalBal: "Total Balance", activeMachines: "⛏️ Active Machines",
    myMachines: "⛏️ My Machines", myBatteries: "🔋 My Batteries",
    active: "Active", expired: "Expired", inactive: "Inactive", available: "Available",
    plugged: "Plugged", notPlugged: "Not Plugged", timeRemaining: "Remaining",
    noMachines: "No machines yet", noBatteries: "No batteries yet",
    batteryLabel: "Battery", usdtPerFta: " USDT", noActiveMachines: "No active machines",
    exchangeRate: "Exchange Rate", priceImpact: "Price Impact",
    swapFee: "Swap Fee (4%)", minimumReceived: "Minimum Received",
    slippageTolerance: "Slippage Tolerance", networkFee: "Network Fee",
    depositBtn: "DEPOSIT", withdrawBtn: "WITHDRAW", depositing: "Depositing...", depositSuccess: "Deposit successful!", withdrawing: "Withdrawing...", withdrawSuccess: "Withdrawal successful!",
    send: "Send", receive: "Receive", sending: "Sending...", sentSuccess: "Sent successfully!", addrCopied: "Address copied!", confirmSend: "CONFIRM SEND", invalidAddr: "Invalid address", recipientAddr: "Recipient address (0x...)", amount: "Amount",
    errRejected: "Transaction cancelled", errInsufficientFunds: "Insufficient balance",
    errNetwork: "Network error. Please try again.", errTimeout: "Transaction timed out.",
    errContract: "Transaction failed. Please try again.", errGeneric: "An error occurred.",
    errAlreadyPending: "Transaction pending. Please wait.", errNonce: "Nonce error. Restart the app.",
    errNoMachine: "No machine", errRunning: "Machine already running",
    errNoBattery: "No battery of this type", errMaxMachine: "Max machines reached",
  },
  fr: {
    connect: "Connecter", refTitle: "👥 Parrainage", refDesc: "Entrez l'adresse ou l'ID du parrain.", bindRef: "LIER",
    power: "PUISSANCE", ftaSec: "Hashrate", pending: "EN ATTENTE", fta: "FTA", miningActive: "MINAGE ACTIF", noMachine: "AUCUNE MACHINE", claim: "RÉCLAMER",
    shopTitle: "⛏️ Boutique", machines: "Machines", batteries: "Batteries", buy: "ACHETER",
    myAssets: "⚙️ Wallet & Actifs", walletBal: "💰 Soldes", plugMachine: "🔌 Brancher une machine", plugDesc: "Choisissez l'index d'une machine et le type de batterie.",
    machineId: "Index Machine (0, 1...)", plug: "BRANCHER ⚡",
    swapTitle: "💱 Échange", youPay: "Vous payez", balance: "Solde:", youReceive: "Vous recevez", swap: "ÉCHANGER",
    loading: "Chargement...", currentRate: "1 FTA = ",
    home: "Accueil", shop: "Boutique", assets: "Wallet", swapNav: "Swap",
    connWallet: "Connexion...", errConn: "Erreur connexion",
    linking: "Liaison...", refLinked: "Parrain lié!", connFirst: "Connectez-vous d'abord",
    enterRefAddr: "Adresse ou ID parrain (0x...)", enterRefId: "ID Parrain (nombre)",
    buyingMachine: "Achat Machine", buyingBattery: "Achat Batterie",
    confirming: "Confirmation...", calcFta: "Calcul du prix...",
    machineBought: "Machine achetée!", batteryBought: "Batterie achetée!",
    invalidId: "Index Machine invalide", pluggingIn: "Branchement...", pluggedIn: "Machine branchée! ⚡",
    invalidAmount: "Montant invalide", swapping: "Échange...", swapSuccess: "Échange réussi!",
    claiming: "Récupération...", claimed: "Gains réclamés!",
    error: "Erreur", days: "Jours", rig: "RIG",
    totalBal: "Solde Total", activeMachines: "⛏️ Machines Actives",
    myMachines: "⛏️ Mes Machines", myBatteries: "🔋 Mes Batteries",
    active: "Actif", expired: "Expiré", inactive: "Inactif", available: "Disponible",
    plugged: "Branché", notPlugged: "Non branché", timeRemaining: "Restant",
    noMachines: "Aucune machine", noBatteries: "Aucune batterie",
    batteryLabel: "Batterie", usdtPerFta: " USDT", noActiveMachines: "Aucune machine active",
    exchangeRate: "Taux de change", priceImpact: "Impact prix",
    swapFee: "Frais swap (4%)", minimumReceived: "Minimum reçu",
    slippageTolerance: "Tolérance slippage", networkFee: "Frais réseau",
    depositBtn: "DÉPOSER", withdrawBtn: "RETIRER", depositing: "Dépôt...", depositSuccess: "Dépôt réussi!", withdrawing: "Retrait...", withdrawSuccess: "Retrait réussi!",
    send: "Envoyer", receive: "Recevoir", sending: "Envoi...", sentSuccess: "Envoi réussi!", addrCopied: "Adresse copiée!", confirmSend: "CONFIRMER L'ENVOI", invalidAddr: "Adresse invalide", recipientAddr: "Adresse destinataire (0x...)", amount: "Montant",
    errRejected: "Transaction annulée", errInsufficientFunds: "Solde insuffisant",
    errNetwork: "Erreur réseau. Réessayez.", errTimeout: "Délai expiré.",
    errContract: "Transaction échouée. Réessayez.", errGeneric: "Une erreur est survenue.",
    errAlreadyPending: "Transaction en cours. Patientez.", errNonce: "Erreur nonce. Redémarrez l'app.",
    errNoMachine: "Aucune machine", errRunning: "Machine déjà en marche",
    errNoBattery: "Pas de batterie de ce type", errMaxMachine: "Maximum de machines atteint",
  },
  de: {
    connect: "Verbinden", refTitle: "👥 Empfehlung", refDesc: "Empfehler-Adresse oder ID eingeben.", bindRef: "BINDEN",
    power: "LEISTUNG", ftaSec: "Hashrate", pending: "AUSSTEHEND", fta: "FTA", miningActive: "MINING AKTIV", noMachine: "KEINE MASCHINE", claim: "EINFORDERN",
    shopTitle: "⛏️ Shop", machines: "Maschinen", batteries: "Batterien", buy: "KAUFEN",
    myAssets: "⚙️ Wallet & Assets", walletBal: "💰 Guthaben", plugMachine: "🔌 Maschine anschließen", plugDesc: "Wähle Maschinen-Index und Batterietyp.",
    machineId: "Maschinen-Index (0, 1...)", plug: "ANSCHLIESSEN ⚡",
    swapTitle: "💱 Tausch", youPay: "Sie zahlen", balance: "Guthaben:", youReceive: "Sie erhalten", swap: "TAUSCHEN",
    loading: "Laden...", currentRate: "1 FTA = ",
    home: "Home", shop: "Shop", assets: "Wallet", swapNav: "Swap",
    connWallet: "Verbindung...", errConn: "Verbindungsfehler",
    linking: "Verknüpfung...", refLinked: "Empfehler verknüpft!", connFirst: "Zuerst verbinden",
    enterRefAddr: "Empfehler-Adresse oder ID (0x...)", enterRefId: "Empfehler-ID (Zahl)",
    buyingMachine: "Kaufe Maschine", buyingBattery: "Kaufe Batterie",
    confirming: "Bestätigung...", calcFta: "Preis berechnen...",
    machineBought: "Maschine gekauft!", batteryBought: "Batterie gekauft!",
    invalidId: "Ungültiger Index", pluggingIn: "Anschließen...", pluggedIn: "Angeschlossen! ⚡",
    invalidAmount: "Ungültiger Betrag", swapping: "Tauschen...", swapSuccess: "Tausch erfolgreich!",
    claiming: "Einforderung...", claimed: "Eingefordert!",
    error: "Fehler", days: "Tage", rig: "RIG",
    totalBal: "Gesamtguthaben", activeMachines: "⛏️ Aktive Maschinen",
    myMachines: "⛏️ Meine Maschinen", myBatteries: "🔋 Meine Batterien",
    active: "Aktiv", expired: "Abgelaufen", inactive: "Inaktiv", available: "Verfügbar",
    plugged: "Angeschlossen", notPlugged: "Nicht angeschlossen", timeRemaining: "Verbleibend",
    noMachines: "Keine Maschinen", noBatteries: "Keine Batterien",
    batteryLabel: "Batterie", usdtPerFta: " USDT", noActiveMachines: "Keine aktive Maschinen",
    exchangeRate: "Wechselkurs", priceImpact: "Preisauswirkung",
    swapFee: "Swapgebühr (4%)", minimumReceived: "Mindestbetrag",
    slippageTolerance: "Slippage-Toleranz", networkFee: "Netzwerkgebühr",
    depositBtn: "EINZAHLEN", depositing: "Einzahlung...", depositSuccess: "Einzahlung erfolgreich!",
    errRejected: "Transaktion abgebrochen", errInsufficientFunds: "Unzureichendes Guthaben",
    errNetwork: "Netzwerkfehler. Bitte versuchen Sie es erneut.", errTimeout: "Zeitüberschreitung.",
    errContract: "Transaktion fehlgeschlagen.", errGeneric: "Ein Fehler ist aufgetreten.",
    errAlreadyPending: "Transaktion ausstehend.", errNonce: "Nonce-Fehler. App neustarten.",
    errNoMachine: "Keine Maschine", errRunning: "Maschine läuft bereits",
    errNoBattery: "Keine Batterie dieses Typs", errMaxMachine: "Maximale Maschinen erreicht",
  },
  zh: {
    connect: "连接", refTitle: "👥 推荐系统", refDesc: "输入推荐人地址或ID进行绑定。", bindRef: "绑定",
    power: "算力", ftaSec: "Hashrate", pending: "待领取", fta: "FTA", miningActive: "挖矿中", noMachine: "无机器", claim: "领取",
    shopTitle: "⛏️ 商店", machines: "矿机", batteries: "电池", buy: "购买",
    myAssets: "⚙️ 钱包与资产", walletBal: "💰 余额", plugMachine: "🔌 插入机器", plugDesc: "选择机器索引和电池类型。",
    machineId: "机器索引 (0, 1...)", plug: "插入 ⚡",
    swapTitle: "💱 兑换", youPay: "您支付", balance: "余额:", youReceive: "您收到", swap: "兑换",
    loading: "加载中...", currentRate: "1 FTA = ",
    home: "首页", shop: "商店", assets: "钱包", swapNav: "兑换",
    connWallet: "连接中...", errConn: "连接错误",
    linking: "绑定中...", refLinked: "推荐人绑定成功!", connFirst: "请先连接",
    enterRefAddr: "推荐人地址或ID (0x...)", enterRefId: "推荐人ID (数字)",
    buyingMachine: "购买矿机", buyingBattery: "购买电池",
    confirming: "确认中...", calcFta: "计算价格...",
    machineBought: "矿机购买成功!", batteryBought: "电池购买成功!",
    invalidId: "无效索引", pluggingIn: "插入中...", pluggedIn: "插入成功! ⚡",
    invalidAmount: "无效金额", swapping: "兑换中...", swapSuccess: "兑换成功!",
    claiming: "领取中...", claimed: "奖励已领取!",
    error: "错误", days: "天", rig: "矿机",
    totalBal: "总余额", activeMachines: "⛏️ 运行中矿机",
    myMachines: "⛏️ 我的矿机", myBatteries: "🔋 我的电池",
    active: "运行中", expired: "已过期", inactive: "未激活", available: "可用",
    plugged: "已插入", notPlugged: "未插入", timeRemaining: "剩余",
    noMachines: "暂无矿机", noBatteries: "暂无电池",
    batteryLabel: "电池", usdtPerFta: " USDT", noActiveMachines: "无运行中矿机",
    exchangeRate: "汇率", priceImpact: "价格影响",
    swapFee: "手续费 (4%)", minimumReceived: "最低收到",
    slippageTolerance: "滑点容忍度", networkFee: "网络费",
    depositBtn: "存入", depositing: "存入中...", depositSuccess: "存入成功!",
    errRejected: "交易已取消", errInsufficientFunds: "余额不足",
    errNetwork: "网络错误，请重试。", errTimeout: "交易超时。",
    errContract: "交易失败，请重试。", errGeneric: "发生错误。",
    errAlreadyPending: "交易待处理。", errNonce: "Nonce错误，请重启应用。",
    errNoMachine: "没有矿机", errRunning: "矿机已在运行",
    errNoBattery: "没有此类型电池", errMaxMachine: "矿机数量已达上限",
  },
  sg: {
    connect: "Connect", refTitle: "👥 Referral System", refDesc: "Enter referrer address or ID to link.", bindRef: "BIND",
    power: "POWER", ftaSec: "Hashrate", pending: "PENDING", fta: "FTA", miningActive: "MINING ACTIVE", noMachine: "NO MACHINE", claim: "CLAIM",
    shopTitle: "⛏️ Shop", machines: "Machines", batteries: "Batteries", buy: "BUY",
    myAssets: "⚙️ Wallet & Assets", walletBal: "💰 Balances", plugMachine: "🔌 Plug in a machine", plugDesc: "Select a machine index and battery type.",
    machineId: "Machine Index (0, 1...)", plug: "PLUG IN ⚡",
    swapTitle: "💱 Swap", youPay: "You pay", balance: "Balance:", youReceive: "You receive", swap: "SWAP",
    loading: "Loading...", currentRate: "1 FTA = ",
    home: "Home", shop: "Shop", assets: "Wallet", swapNav: "Swap",
    connWallet: "Connecting...", errConn: "Connection Error",
    linking: "Linking...", refLinked: "Referrer linked!", connFirst: "Connect first",
    enterRefAddr: "Referrer address or ID (0x...)", enterRefId: "Referrer ID (number)",
    buyingMachine: "Buying Machine", buyingBattery: "Buying Battery",
    confirming: "Confirming...", calcFta: "Calculating price...",
    machineBought: "Machine purchased!", batteryBought: "Battery purchased!",
    invalidId: "Invalid Machine Index", pluggingIn: "Plugging in...", pluggedIn: "Machine plugged in! ⚡",
    invalidAmount: "Invalid amount", swapping: "Swapping...", swapSuccess: "Swap successful!",
    claiming: "Claiming...", claimed: "Rewards claimed!",
    error: "Error", days: "Days", rig: "RIG",
    totalBal: "Total Balance", activeMachines: "⛏️ Active Machines",
    myMachines: "⛏️ My Machines", myBatteries: "🔋 My Batteries",
    active: "Active", expired: "Expired", inactive: "Inactive", available: "Available",
    plugged: "Plugged", notPlugged: "Not Plugged", timeRemaining: "Remaining",
    noMachines: "No machines yet", noBatteries: "No batteries yet",
    batteryLabel: "Battery", usdtPerFta: " USDT", noActiveMachines: "No active machines",
    exchangeRate: "Exchange Rate", priceImpact: "Price Impact",
    swapFee: "Swap Fee (4%)", minimumReceived: "Minimum Received",
    slippageTolerance: "Slippage Tolerance", networkFee: "Network Fee",
    depositBtn: "DEPOSIT", depositing: "Depositing...", depositSuccess: "Deposit successful!",
    errRejected: "Transaction cancelled", errInsufficientFunds: "Insufficient balance",
    errNetwork: "Network error. Please try again.", errTimeout: "Transaction timed out.",
    errContract: "Transaction failed.", errGeneric: "An error occurred.",
    errAlreadyPending: "Transaction pending.", errNonce: "Nonce error. Restart app.",
    errNoMachine: "No machine", errRunning: "Machine already running",
    errNoBattery: "No battery of this type", errMaxMachine: "Max machines reached",
  }
};

// ─── ABIs des contrats V3 ──────────────────────────────────────────

// ABI du Core (tokens, balances, swaps, dépôts, meta-tx)
const CORE_ABI = [
  // ─── Infos ───
  "function usdt() view returns (address)",
  "function fta() view returns (address)",
  "function myInfo() view returns (uint256, uint256, uint256, uint256)",
  // ─── Dépôts ───
  "function depositUsdt(uint256 a)",
  "function depositFta(uint256 a)",
  "function depositPol() payable",
  // ─── Retraits ───
  "function withdrawUsdt(uint256 a)",
  "function withdrawFta(uint256 a)",
  "function withdrawPol(uint256 a)",
  // ─── Parrainage ───
  "function setReferrer(address r)",
  "function setReferrerById(uint256 rid)",
  // ─── Swaps (courbe de liaison) ───
  "function rate() view returns (uint256)",
  "function swapUForF(uint256 a, uint256 m, uint256 d)",
  "function swapFForU(uint256 a, uint256 m, uint256 d)",
  "function buyFta(uint256 a) view returns (uint256)",
  "function sellFta(uint256 a) view returns (uint256)",
  "function costFta(uint256 a) view returns (uint256)",
  // ─── Admin (read-only pour le frontend) ───
  "function swapFee() view returns (uint256)",
  "function difficulty() view returns (uint256)",
  "function uid(address) view returns (uint256)",
  "function aToId(uint256) view returns (address)",
  // ─── Balances internes ───
  "function uBal(address) view returns (uint256)",
  "function fBal(address) view returns (uint256)",
  "function pol(address) view returns (uint256)"
];

// ABI du Mine (machines, batteries, minage)
const MINE_ABI = [
  // ─── Achats ───
  "function buyMachine(uint256 t)",
  "function buyMachineFTA(uint256 t)",
  "function buyBattery(uint256 t)",
  "function buyBatteryFTA(uint256 t)",
  // ─── Minage ───
  "function plugInMachine(uint256 mi, uint256 bi)",
  "function claimRewards()",
  // ─── Views ───
  "function powerOf(address u) view returns (uint256)",
  "function mCount() view returns (uint256)",
  "function bCount() view returns (uint256)",
  "function getMType(uint256) view returns (uint256 price, uint256 power, uint256 shopExpiry)",
  "function getBType(uint256) view returns (uint256 price, uint256 dur)",
  "function myMachines(address u) view returns (tuple(uint256 tid, uint256 exp)[])",
  "function myBattery(address u, uint256 t) view returns (uint256)",
  "function myInfo(address u) view returns (uint256 mc, uint256 ap, uint256 lc)"
];

// ─── Constantes ────────────────────────────────────────────────────
const SWAP_FEE_RATE = 0.04;
const SLIPPAGE = 0.005;
const ONE_18 = 10n ** 18n;

// ═══════════════════════════════════════════════════════════════════
//  CLASSE PRINCIPALE : Application
// ═══════════════════════════════════════════════════════════════════
class Application {
  constructor() {
    // ─── Fournisseur blockchain ───
    this.provider = null;
    this.signer = null;
    this.user = null;

    // ─── Contrats ───
    this.core = null;
    this.mine = null;

    // ─── Mode de paiement ───
    this.payMode = 'USDT';
    this.shopViewMode = 'machines';

    // ─── Direction du swap ───
    this.swapDirection = 'USDT_TO_FTA';

    // ─── Décimales des tokens ───
    this.usdtDecimals = 6;
    this.ftaDecimals = 8;  // ⚠️ Le token FTA utilise 8 décimales

    // ─── Données en cache ───
    this.polPriceUsd = 0;
    this.ftaPriceUsd = 0;
    this.currentRealPower = 0;
    this.pendingBalance = 0;

    // ─── Données boutique ───
    this.shopMachinesData = [];
    this.shopBatteriesData = [];
    this.isLoadingShop = false;

    // ─── Données utilisateur ───
    this.userMachines = [];
    this.batteryInventory = {};
    this.batteryTypeDurations = {};

    // ─── Minage local ───
    this.miningTimer = null;
    this.lastClaimTimestamp = 0;
    this.storageKey = "fitia_v3_last_claim";

    // ─── Visualiseur ───
    this.vizContext = null;
    this.vizBars = [];

    // ─── Langue ───
    const savedLang = localStorage.getItem('fitia_lang');
    this.currentLang = savedLang && i18n[savedLang] ? savedLang : 'fr';

    // ─── Chat assistant ───
    this.chatInitialized = false;
    this.chatHistory = [];

    // ─── Historique des prix pour calculer l'évolution ───
    this.prevPriceCheckpoint = {};
    this.priceCheckpointTime = 0;
  }

  // ─── Traduction ──────────────────────────────────────────────────
  // Retourne la traduction pour la clé donnée, avec fallback anglais
  t(key) {
    return i18n[this.currentLang]?.[key] || i18n['en'][key] || key;
  }

  // ─── Formatage ───────────────────────────────────────────────────
  formatUsd(v) {
    return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Formate le hashrate avec les unités appropriées
  formatHashrate(h) {
    if (h <= 0) return '0 H/s';
    const units = ['nH/s', 'µH/s', 'mH/s', 'H/s', 'KH/s', 'MH/s', 'GH/s', 'TH/s', 'PH/s'];
    const baseIndex = 3; // H/s
    let value = h, unitIndex = baseIndex;
    while (value < 1 && unitIndex > 0) { value *= 1000; unitIndex--; }
    while (value >= 1000 && unitIndex < units.length - 1) { value /= 1000; unitIndex++; }
    return value.toFixed(2) + ' ' + units[unitIndex];
  }

  // Formate le temps restant en jours/heures/minutes
  formatTimeRemaining(s) {
    if (s <= 0) return this.t('expired');
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d > 1) return `${d}j ${h}h`;
    if (d === 1) return `1j ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  // Retourne la durée en jours pour un type de batterie donné
  getBatteryDuration(typeId) {
    if (this.batteryTypeDurations[typeId] !== undefined) return this.batteryTypeDurations[typeId];
    // Fallback si le cache n'est pas encore rempli
    const fallback = { 0: 3, 1: 7, 2: 15, 3: 30, 4: 90, 5: 180, 6: 270, 7: 365 };
    return fallback[typeId] || 30;
  }

  // ─── Gestion de la langue ────────────────────────────────────────
  setLanguage(lang) {
    if (!i18n[lang]) return;
    this.currentLang = lang;
    localStorage.setItem('fitia_lang', lang);
    const flags = { en: '🇬🇧', fr: '🇫🇷', de: '🇩🇪', zh: '🇨🇳', sg: '🇸🇬' };
    document.getElementById('lang-btn-display').innerText = `${flags[lang]} ${lang.toUpperCase()}`;
    this.applyTranslations();
    this.renderShop();
  }

  // Applique les traductions à tous les éléments statiques du DOM
  applyTranslations() {
    document.getElementById('btn-connect').innerText = this.t('connect');
    document.querySelector('.total-balance-card small').innerText = this.t('totalBal');
    document.querySelector('.referral-card h3').innerText = this.t('refTitle');
    document.querySelector('.referral-card p.small-text').innerText = this.t('refDesc');
    document.querySelector('#ref-address-input').placeholder = this.t('enterRefAddr');
    document.querySelector('.referral-card .btn-full').innerText = this.t('bindRef');
    const stats = document.querySelectorAll('.stat-card');
    if (stats[0]) { stats[0].querySelector('small:first-child').innerText = this.t('power'); stats[0].querySelector('small:last-child').innerText = this.t('ftaSec'); }
    if (stats[1]) { stats[1].querySelector('small:first-child').innerText = this.t('pending'); stats[1].querySelector('small:last-child').innerText = this.t('fta'); }
    const megaBtn = document.querySelector('.btn-mega');
    if (megaBtn) { const span = megaBtn.querySelectorAll('span')[1]; if (span) span.textContent = this.t('claim'); }
    const shopTitle = document.querySelector('#view-shop .view-title');
    if (shopTitle) shopTitle.innerText = this.t('shopTitle');
    const shopTabs = document.querySelectorAll('.shop-tab');
    if (shopTabs[0]) shopTabs[0].innerText = this.t('machines');
    if (shopTabs[1]) shopTabs[1].innerText = this.t('batteries');
    const assetsTitle = document.querySelector('#view-my-rigs .view-title');
    if (assetsTitle) assetsTitle.innerText = this.t('myAssets');
    const walletBalH3 = document.querySelector('#view-my-rigs .card:first-child h3');
    if (walletBalH3) walletBalH3.innerText = this.t('walletBal');
    const activeMachinesTitle = document.querySelector('#active-machines-section .section-title');
    if (activeMachinesTitle) activeMachinesTitle.innerText = this.t('activeMachines');
    const wc = document.querySelectorAll('#view-my-rigs .card');
    if (wc[1]) wc[1].querySelector('.section-title').innerText = this.t('myMachines');
    if (wc[2]) wc[2].querySelector('.section-title').innerText = this.t('myBatteries');
    const swapTitle = document.querySelector('#view-swap .view-title');
    if (swapTitle) swapTitle.innerText = this.t('swapTitle');
    const sh = document.querySelectorAll('.swap-header span:first-child');
    if (sh[0]) sh[0].innerText = this.t('youPay');
    if (sh[1]) sh[1].innerText = this.t('youReceive');
    const swapBtn = document.querySelector('#view-swap .btn-primary');
    if (swapBtn) swapBtn.innerText = this.t('swap');
    document.querySelectorAll('.nav-item span').forEach((s, i) => s.innerText = this.t(['home', 'shop', 'assets', 'swapNav'][i]));
  }

  // ─── Initialisation ──────────────────────────────────────────────
  async init() { this.setLanguage(this.currentLang); }

  // ─── Récupération du prix POL ────────────────────────────────────
  async fetchMarketPrices() {
    this.polPriceUsd = 0;
    try {
      const r = await fetch('https://api.dexscreener.com/latest/dex/tokens/0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0');
      const d = await r.json();
      if (d.pairs?.length) this.polPriceUsd = parseFloat(d.pairs[0].priceUsd) || 0;
    } catch (e) { /* silencieux */ }
    if (!this.polPriceUsd) {
      try {
        const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=matic-network&vs_currencies=usd');
        const d = await r.json();
        this.polPriceUsd = d['matic-network']?.usd || 0;
      } catch (e2) { /* silencieux */ }
    }
    if (!this.polPriceUsd) this.polPriceUsd = 0.70;
  }

  // ─── Connexion wallet ────────────────────────────────────────────
  async connect() {
    // Si MetaMask est disponible
    if (window.ethereum) {
      this.setLoader(true, this.t('connWallet'));
      try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        this.provider = new ethers.BrowserProvider(window.ethereum);
        this.signer = await this.provider.getSigner();
        this.user = await this.signer.getAddress();
        const network = await this.provider.getNetwork();
        if (Number(network.chainId) !== CONFIG.CHAIN_ID) await this.switchNetwork();
        await this.initContracts();
        window.ethereum.on('accountsChanged', () => window.location.reload());
        window.ethereum.on('chainChanged', () => window.location.reload());
      } catch (e) { this.showError(e); } finally { this.setLoader(false); }
    }
    // Si WalletConnect est disponible
    else if (typeof EthereumProvider !== 'undefined' && CONFIG.WC_PROJECT_ID && !CONFIG.WC_PROJECT_ID.includes("...")) {
      this.setLoader(true, this.t('connWallet'));
      try {
        const wc = await EthereumProvider.init({
          projectId: CONFIG.WC_PROJECT_ID,
          chains: [CONFIG.CHAIN_ID],
          showQrModal: true,
          methods: ['eth_sendTransaction', 'personal_sign'],
          metadata: { name: 'FITIA PRO MINER', description: 'Mining DApp', url: window.location.origin, icons: [window.location.origin + '/logo.png'] }
        });
        await wc.enable();
        this.provider = new ethers.BrowserProvider(wc);
        this.signer = await this.provider.getSigner();
        this.user = await this.signer.getAddress();
        await this.initContracts();
        wc.on("disconnect", () => window.location.reload());
      } catch (e) { this.showError(e); } finally { this.setLoader(false); }
    } else {
      this.showToast("Installez MetaMask ou utilisez un navigateur Web3.", true);
    }
  }

  // ─── Initialisation des contrats ─────────────────────────────────
  async initContracts() {
    // Instanciation du Core V3
    this.core = new ethers.Contract(CONFIG.CORE, CORE_ABI, this.signer);
    // Instanciation du Mine V3
    this.mine = new ethers.Contract(CONFIG.MINE, MINE_ABI, this.signer);
    // Récupération dynamique des décimales du token FTA
    try {
      const ftaContract = new ethers.Contract(CONFIG.FTA, ["function decimals() view returns (uint8)"], this.provider);
      this.ftaDecimals = Number(await ftaContract.decimals());
    } catch (e) { /* garde la valeur par défaut 8 */ }
    // Met à jour l'interface
    document.getElementById('btn-connect').classList.add('hidden');
    document.getElementById('wallet-status').classList.remove('hidden');
    document.getElementById('addr-display').innerText = this.user.slice(0, 6) + "..." + this.user.slice(38);
    // Initialise le cache de temps de claim
    if (!localStorage.getItem(this.storageKey)) localStorage.setItem(this.storageKey, Math.floor(Date.now() / 1000));
    // Récupère les prix de marché
    await this.fetchMarketPrices();
    // Remplit le cache des durées de batterie
    await this.cacheBatteryDurations();
    // Met à jour toutes les données
    await this.updateData();
    // Rafraîchissement périodique (15 secondes)
    setInterval(() => this.updateData(), 15000);
    // Initialise le visualiseur de minage
    this.initVisualizer();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  // ─── Cache des durées de batterie ────────────────────────────────
  async cacheBatteryDurations() {
    try {
      const count = Number(await this.mine.bCount());
      for (let i = 0; i < count; i++) {
        try {
          const b = await this.mine.getBType(i);
          // La durée est en secondes, on convertit en jours
          this.batteryTypeDurations[i] = Number(b.dur) / 86400;
        } catch (e) { /* ignore les erreurs individuelles */ }
      }
    } catch (e) { /* ignore si bCount échoue */ }
  }

  // ─── Changement de réseau ────────────────────────────────────────
  async switchNetwork() {
    try {
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x89' }] });
    } catch (e) {
      if (e.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x89', chainName: 'Polygon',
            nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
            rpcUrls: ['https://polygon-rpc.com/'],
            blockExplorerUrls: ['https://polygonscan.com/']
          }]
        });
      }
    }
  }

  // ─── Changement de sous-vue boutique ─────────────────────────────
  setShopView(v) {
    this.shopViewMode = v;
    document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
    event.currentTarget.classList.add('active');
    this.renderShop();
  }

  // ─── Récupération des assets utilisateur ─────────────────────────
  async fetchUserAssets() {
    if (!this.user) return;
    this.userMachines = [];
    this.batteryInventory = {};

    // Récupère les machines via myInfo + myMachines
    try {
      const machinesRaw = await this.mine.myMachines(this.user);
      // Les machines sont retournées comme [{tid, exp}, ...]
      for (const m of machinesRaw) {
        this.userMachines.push({
          tid: Number(m.tid ?? m[0]),
          exp: Number(m.exp ?? m[1])
        });
      }
    } catch (e) {
      console.error("Erreur récupération machines:", e);
      // Fallback via myInfo pour connaître le nombre
      try {
        const info = await this.mine.myInfo(this.user);
        const mc = Number(info.mc ?? info[0]);
        for (let i = 0; i < mc; i++) {
          this.userMachines.push({ tid: 0, exp: 0 });
        }
      } catch (e2) { /* ignore */ }
    }

    // Récupère l'inventaire des batteries par type
    try {
      const bCount = Number(await this.mine.bCount());
      for (let t = 0; t < bCount; t++) {
        try {
          const qty = Number(await this.mine.myBattery(this.user, t));
          if (qty > 0) this.batteryInventory[t] = qty;
        } catch (e) { /* ignore type sans batterie */ }
      }
    } catch (e) { /* ignore */ }
  }

  // ─── Rendu des machines actives ──────────────────────────────────
  renderActiveMachines() {
    const container = document.getElementById('active-machines-list');
    if (!container) return;
    const now = Math.floor(Date.now() / 1000);
    // Machine active = expiry > maintenant
    const active = this.userMachines.filter(m => m.exp > now);
    if (!active.length) {
      container.innerHTML = `<p class="small-text" style="text-align:center;">${this.t('noActiveMachines')}</p>`;
      return;
    }
    const tierNames = ['MK-I', 'MK-II', 'MK-III', 'MK-IV', 'MK-V', 'MK-VI', 'MK-VII', 'MK-VIII'];
    container.innerHTML = active.map(m => {
      const rem = m.exp - now;
      // On estime un total basé sur la durée du type (le contrat ne stocke pas le type de batterie branché)
      const totalSec = rem;
      const pr = 50; // Approximation (le contrat V3 ne stocke pas la durée exacte de la batterie)
      const bc = 'green';
      return `<div class="asset-row">${this.getMachineMiniSVG(m.tid)}
        <div class="asset-info">
          <div class="asset-name">${tierNames[m.tid % 8]} <span class="status-pill active">● ${this.t('active')}</span></div>
          <div class="asset-detail">${this.t('batteryLabel')}</div>
          <div class="battery-bar-wrap">
            <div class="battery-bar-header">
              <span class="battery-bar-label">${this.t('timeRemaining')}</span>
              <span class="battery-bar-time green">${this.formatTimeRemaining(rem)}</span>
            </div>
            <div class="battery-bar"><div class="battery-bar-fill green" style="width:${pr}%"></div></div>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  // ─── Rendu des machines possédées ────────────────────────────────
  renderUserMachines() {
    const container = document.getElementById('my-machines-list');
    if (!container) return;
    if (!this.userMachines.length) {
      container.innerHTML = `<p class="small-text" style="text-align:center;">${this.t('noMachines')}</p>`;
      return;
    }
    const now = Math.floor(Date.now() / 1000);
    const tierNames = ['MK-I', 'MK-II', 'MK-III', 'MK-IV', 'MK-V', 'MK-VI', 'MK-VII', 'MK-VIII'];
    container.innerHTML = this.userMachines.map((m, i) => {
      let statusClass, statusText;
      if (m.exp > now) { statusClass = 'active'; statusText = this.t('active'); }
      else if (m.exp > 0 && m.exp <= now) { statusClass = 'expired'; statusText = this.t('expired'); }
      else { statusClass = 'inactive'; statusText = this.t('inactive'); }
      let extra = '';
      if (m.exp > now) {
        const rem = m.exp - now;
        extra = `<div class="battery-bar-wrap"><div class="battery-bar-header"><span class="battery-bar-label">${this.t('timeRemaining')}</span><span class="battery-bar-time green">${this.formatTimeRemaining(rem)}</span></div><div class="battery-bar"><div class="battery-bar-fill green" style="width:50%"></div></div></div>`;
      }
      return `<div class="asset-row">${this.getMachineMiniSVG(m.tid)}
        <div class="asset-info">
          <div class="asset-name">#${i} ${tierNames[m.tid % 8]} <span class="status-pill ${statusClass}">● ${statusText}</span></div>
          <div class="asset-detail">${m.exp > now ? this.t('plugged') : this.t('notPlugged')}</div>
          ${extra}
        </div>
      </div>`;
    }).join('');
  }

  // ─── Rendu des batteries possédées ───────────────────────────────
  renderUserBatteries() {
    const container = document.getElementById('my-batteries-list');
    if (!container) return;
    const entries = Object.entries(this.batteryInventory).filter(([,qty]) => qty > 0);
    if (!entries.length) {
      container.innerHTML = `<p class="small-text" style="text-align:center;">${this.t('noBatteries')}</p>`;
      return;
    }
    container.innerHTML = entries.map(([typeId, qty]) => {
      const dur = this.getBatteryDuration(Number(typeId));
      const chargeLevel = 80; // Valeur esthétique
      return `<div class="asset-row">
        <div class="real-battery">
          <div class="battery-cap"></div>
          <div class="battery-body">
            <div class="battery-level" style="width:${chargeLevel}%"></div>
            <div class="battery-charge-indicator">${Math.round(chargeLevel)}%</div>
          </div>
        </div>
        <div class="asset-info">
          <div class="asset-name">${dur} ${this.t('days')} <span class="status-pill available">● ${this.t('available')}</span></div>
          <div class="asset-detail">Quantité: ${qty}</div>
        </div>
      </div>`;
    }).join('');
  }

  // ─── Mise à jour périodique des données ──────────────────────────
  async updateData() {
    if (!this.user) return;
    try {
      // ─── Récupération de la puissance active ─────────────────────
      // ⚠️ powerOf() retourne un entier brut (pas en wei/18 décimales).
      // La formule de reward dans le contrat Mine est :
      //   reward = elapsed * power * difficulty / 1e18
      // Donc FTA/seconde = power * difficulty / 1e18
      const rawPower = await this.mine.powerOf(this.user);
      let powNum = Number(rawPower);
      let diffNum = 2e12; // fallback si la lecture échoue
      try {
        const difficultyRaw = await this.core.difficulty();
        diffNum = Number(difficultyRaw);
      } catch (e) { /* utilise la valeur par défaut */ }
      // Puissance effective en FTA par seconde (déjà en unités humaines)
      this.currentRealPower = powNum > 0 ? (powNum * diffNum) / 1e18 : 0;

      // ─── Récupération du taux FTA via le Core ────────────────────
      // La fonction rate() retourne le prix en unités USDT (6 décimales)
      // car le contrat calcule en USDT → FTA, pas l'inverse.
      let rateRaw;
      try {
        rateRaw = await this.core.rate();
        // ⚠️ Correction : on utilise usdtDecimals (6) et non ftaDecimals (18)
        this.ftaPriceUsd = parseFloat(ethers.formatUnits(rateRaw, this.usdtDecimals));
      } catch (e) {
        // Fallback : utilise la dernière valeur connue
      }

      // ─── Récupération des balances internes au Core ──────────────
      const uBal = await this.core.uBal(this.user);
      const fBal = await this.core.fBal(this.user);
      const polBal = await this.core.pol(this.user);

      // ─── Récupération du solde POL natif ─────────────────────────
      const nativePol = await this.provider.getBalance(this.user);

      const uB = parseFloat(ethers.formatUnits(uBal, this.usdtDecimals));
      const fB = parseFloat(ethers.formatUnits(fBal, this.ftaDecimals));
      const pB = parseFloat(ethers.formatUnits(polBal, 18));
      const nB = parseFloat(ethers.formatUnits(nativePol, 18));

      // ─── Mise à jour des affichages ──────────────────────────────
      document.getElementById('val-power').innerText = this.formatHashrate(this.currentRealPower);
      document.getElementById('bal-pol').innerText = (pB + nB).toFixed(4);
      document.getElementById('bal-usdt').innerText = uB.toFixed(2);
      document.getElementById('bal-fta').innerText = fB.toFixed(4);

      document.getElementById('price-pol').innerText = this.formatUsd(this.polPriceUsd);
      document.getElementById('price-usdt').innerText = this.formatUsd(1);
      document.getElementById('price-fta').innerText = this.formatUsd(this.ftaPriceUsd);

      // ─── Indicateurs de variation en pourcentage ────────────────
      this.updatePriceChange('pol', this.polPriceUsd);
      this.updatePriceChange('usdt', 1); // USDT est stable, mais on garde le mécanisme
      this.updatePriceChange('fta', this.ftaPriceUsd);

      document.getElementById('bal-pol-usd').innerText = '≈ ' + this.formatUsd((pB + nB) * this.polPriceUsd);
      document.getElementById('bal-usdt-usd').innerText = '≈ ' + this.formatUsd(uB);
      document.getElementById('bal-fta-usd').innerText = '≈ ' + this.formatUsd(fB * this.ftaPriceUsd);
      document.getElementById('val-total-usd').innerText = this.formatUsd((pB + nB) * this.polPriceUsd + uB + fB * this.ftaPriceUsd);

      // ─── Données swap ────────────────────────────────────────────
      document.getElementById('swap-rate').innerText = this.t('currentRate') + this.ftaPriceUsd.toFixed(6) + this.t('usdtPerFta');
      document.getElementById('swap-bal-from').innerText = (this.swapDirection === 'USDT_TO_FTA' ? uB : fB).toFixed(4);
      document.getElementById('swap-bal-to').innerText = (this.swapDirection === 'USDT_TO_FTA' ? fB : uB).toFixed(4);

      // ─── Gestion du statut de minage ─────────────────────────────
      this.lastClaimTimestamp = parseInt(localStorage.getItem(this.storageKey) || '0');
      const elapsed = Math.floor(Date.now() / 1000) - this.lastClaimTimestamp;

      // ⚠️ CORRECTION : le contrat Mine crédite des unités brutes de FTA (8 décimales).
      // La formule Solidity est : rw = elapsed * power * difficulty / 1e18
      // rw est en unités brutes (×1e8 pour avoir des vrais FTA).
      // Le frontend doit diviser par 1e8 pour afficher le vrai nombre de FTA.
      // Sans ça, le pending est 100 millions de fois trop élevé (mirage).
      if (this.currentRealPower > 0) {
        if (!this.miningTimer) {
          // currentRealPower = power * difficulty / 1e18 = unités brutes/seconde
          // On divise par 1e8 pour avoir des vrais FTA
          const pendingFtaRaw = this.currentRealPower * elapsed;
          document.getElementById('val-pending').innerText = (pendingFtaRaw / 1e8).toFixed(8);
          this.startMiningCounter();
        }
        document.getElementById('viz-status').innerText = this.t('miningActive');
        document.getElementById('viz-status').style.color = "var(--primary)";
        this.updateVisualizerIntensity(this.currentRealPower);
      } else {
        this.stopMiningCounter();
        document.getElementById('viz-status').innerText = this.t('noMachine');
        document.getElementById('viz-status').style.color = "#666";
        document.getElementById('val-pending').innerText = "0.00000000";
      }

      // ─── Rafraîchit la boutique et les assets ────────────────────
      await this.renderShop();
      await this.fetchUserAssets();
      this.renderActiveMachines();
      this.renderUserMachines();
      this.renderUserBatteries();

      if (document.getElementById('swap-from-in').value) this.calcSwap();
    } catch (e) {
      console.error("Erreur updateData:", e);
    }
  }

  // ─── Compteur de minage local (simulation côté client) ───────────
  startMiningCounter() {
    if (this.miningTimer) return;
    // pendingBalance = accumulateur en unités brutes de FTA (÷1e8 pour vrais FTA)
    this.pendingBalance = parseFloat(document.getElementById('val-pending').innerText) * 1e8 || 0;
    this.miningTimer = setInterval(() => {
      if (this.currentRealPower > 0) {
        this.pendingBalance += this.currentRealPower; // unités brutes par seconde
        document.getElementById('val-pending').innerText = (this.pendingBalance / 1e8).toFixed(8);
        document.getElementById('val-pending').style.color = 'var(--primary)';
        setTimeout(() => document.getElementById('val-pending').style.color = 'var(--text)', 500);
      }
    }, 1000);
  }

  stopMiningCounter() {
    if (this.miningTimer) {
      clearInterval(this.miningTimer);
      this.miningTimer = null;
    }
  }

  // ─── Dépôt dans le Core V3 (support USDT et FTA) ───────────────
  async deposit() {
    if (!this.user) return this.connect();
    const tokenType = document.getElementById('deposit-token-select').value;
    const amount = parseFloat(document.getElementById('deposit-amount').value);
    if (!amount || amount <= 0) return this.showToast(this.t('invalidAmount'), true);

    // Vérification rapide que l'adresse du token est configurée
    const tokenAddr = tokenType === 'USDT' ? CONFIG.USDT : CONFIG.FTA;
    if (!tokenAddr || tokenAddr === '0x0000000000000000000000000000000000000000') {
      return this.showToast('❌ Adresse du token ' + tokenType + ' non configurée dans CONFIG. Veuillez définir CONFIG.' + tokenType, true);
    }

    this.setLoader(true, this.t('depositing'));
    try {
      if (tokenType === 'USDT') {
        const usdtContract = new ethers.Contract(CONFIG.USDT, [
          "function approve(address,uint256) returns (bool)",
          "function allowance(address,address) view returns (uint256)",
          "function balanceOf(address) view returns (uint256)",
          "function decimals() view returns (uint8)"
        ], this.provider);
        const amountBN = ethers.parseUnits(amount.toString(), this.usdtDecimals);
        // Vérifier le solde wallet avant d'essayer
        const walletBal = await usdtContract.balanceOf(this.user);
        if (walletBal < amountBN) {
          const walletFormatted = parseFloat(ethers.formatUnits(walletBal, this.usdtDecimals));
          return this.showToast(`❌ Solde USDT insuffisant dans votre wallet. Vous avez ${walletFormatted.toFixed(2)} USDT, vous essayez de déposer ${amount.toFixed(2)} USDT.`, true);
        }
        const allowance = await usdtContract.allowance(this.user, CONFIG.CORE);
        if (allowance < amountBN) {
          this.setLoader(true, "Approbation USDT...");
          await (await usdtContract.connect(this.signer).approve(CONFIG.CORE, amountBN)).wait();
        }
        this.setLoader(true, this.t('confirming'));
        await (await this.core.depositUsdt(amountBN)).wait();
      } else {
        // Dépôt FTA
        const ftaContract = new ethers.Contract(CONFIG.FTA, [
          "function approve(address,uint256) returns (bool)",
          "function allowance(address,address) view returns (uint256)",
          "function balanceOf(address) view returns (uint256)",
          "function decimals() view returns (uint8)"
        ], this.provider);
        // Lire les décimales depuis le contrat FTA
        try {
          const dec = await ftaContract.decimals();
          this.ftaDecimals = Number(dec);
        } catch (e) {
          console.warn("Impossible de lire decimals() sur FTA, fallback à 8");
          this.ftaDecimals = 8;
        }
        const amountBN = ethers.parseUnits(amount.toString(), this.ftaDecimals);
        // Vérifier le solde wallet avant d'essayer
        const walletBal = await ftaContract.balanceOf(this.user);
        if (walletBal < amountBN) {
          const walletFormatted = parseFloat(ethers.formatUnits(walletBal, this.ftaDecimals));
          return this.showToast(`❌ Solde FTA insuffisant dans votre wallet. Vous avez ${walletFormatted.toFixed(4)} FTA, vous essayez de déposer ${amount.toFixed(4)} FTA.`, true);
        }
        // Vérifier l'allowance et approuver si nécessaire (utiliser le signer pour les tx)
        const allowance = await ftaContract.allowance(this.user, CONFIG.CORE);
        if (allowance < amountBN) {
          this.setLoader(true, "Approbation FTA...");
          await (await ftaContract.connect(this.signer).approve(CONFIG.CORE, amountBN)).wait();
        }
        this.setLoader(true, this.t('confirming'));
        await (await this.core.depositFta(amountBN)).wait();
      }
      this.showToast(this.t('depositSuccess'));
      document.getElementById('deposit-amount').value = '';
      this.updateData();
    } catch (e) {
      // Si le loader est encore actif après une erreur pendant approve,
      // on désactive le loader avant d'afficher l'erreur
      this.setLoader(false);
      this.showError(e);
      return; // Évite d'appeler setLoader(false) deux fois
    }
    this.setLoader(false);
  }

  // ─── Retrait depuis le Core V3 ────────────────────────────────
  async withdraw() {
    if (!this.user) return this.connect();
    const tokenType = document.getElementById('deposit-token-select').value;
    const amount = parseFloat(document.getElementById('deposit-amount').value);
    if (!amount || amount <= 0) return this.showToast(this.t('invalidAmount'), true);

    this.setLoader(true, this.t('withdrawing'));
    try {
      if (tokenType === 'USDT') {
        const amountBN = ethers.parseUnits(amount.toString(), this.usdtDecimals);
        await (await this.core.withdrawUsdt(amountBN)).wait();
      } else {
        // Retrait FTA — utiliser les décimales réelles du token (8)
        const amountBN = ethers.parseUnits(amount.toString(), this.ftaDecimals);
        await (await this.core.withdrawFta(amountBN)).wait();
      }
      this.showToast(this.t('withdrawSuccess'));
      document.getElementById('deposit-amount').value = '';
      this.updateData();
    } catch (e) { this.showError(e); }
    this.setLoader(false);
  }

  // ─── Ouvrir la modale d'envoi (avec sélecteur de token) ─────────
  openSend() {
    document.getElementById('send-to-address').value = '';
    document.getElementById('send-amount').value = '';
    document.getElementById('modal-send').classList.add('active');
    this.updateSendBalance();
  }

  // ─── Met à jour le solde affiché dans la modale d'envoi ────────
  updateSendBalance() {
    const token = document.getElementById('send-token-select').value;
    this.sendTokenSymbol = token;
    let balId = 'bal-pol';
    if (token === 'USDT') balId = 'bal-usdt';
    if (token === 'FTA') balId = 'bal-fta';
    document.getElementById('send-bal').innerText = document.getElementById(balId)?.innerText || '0';
  }

  // ─── Ouvrir la modale de réception ───────────────────────────────
  openReceive() {
    if (!this.user) return this.showToast(this.t('connFirst'), true);
    document.getElementById('receive-addr-display').innerText = this.user;
    document.getElementById('modal-receive').classList.add('active');
  }

  // ─── Fermer les modales ────────────────────────────────────────
  closeModals() {
    document.getElementById('modal-send').classList.remove('active');
    document.getElementById('modal-receive').classList.remove('active');
  }

  // ─── Copier l'adresse ─────────────────────────────────────────
  copyReceiveAddress() {
    navigator.clipboard.writeText(this.user);
    this.showToast(this.t('addrCopied'));
  }

  // ─── Exécuter l'envoi ─────────────────────────────────────────
  async executeSend() {
    const to = document.getElementById('send-to-address').value;
    const amt = document.getElementById('send-amount').value;
    if (!ethers.isAddress(to)) return this.showToast(this.t('invalidAddr'), true);
    if (!amt || Number(amt) <= 0) return this.showToast(this.t('invalidAmount'), true);
    this.setLoader(true, this.t('sending'));
    try {
      const token = document.getElementById('send-token-select').value;
      let tx;
      if (token === 'POL') {
        tx = await this.signer.sendTransaction({ to, value: ethers.parseEther(amt) });
      } else {
        // Envoi via le contrat de token
        const tokenAddr = token === 'USDT' ? CONFIG.USDT : CONFIG.FTA;
        const dec = token === 'USDT' ? this.usdtDecimals : this.ftaDecimals;
        const tokenContract = new ethers.Contract(tokenAddr, ["function transfer(address,uint256) returns (bool)"], this.signer);
        tx = await tokenContract.transfer(to, ethers.parseUnits(amt, dec));
      }
      await tx.wait();
      this.showToast(this.t('sentSuccess'));
      this.closeModals();
      this.updateData();
    } catch (e) { this.showError(e); }
    this.setLoader(false);
  }

  // ─── Achat d'une machine ─────────────────────────────────────────
  async buyMachine(typeId) {
    if (!this.user) return this.connect();

    // Vérifie l'expiration shop côté frontend (sécurité)
    const mData = this.shopMachinesData[typeId];
    if (!mData) return this.showToast("Machine indisponible", true);
    if (mData.shopExpiry > 0 && Math.floor(Date.now() / 1000) > mData.shopExpiry) {
      return this.showToast("Cette machine n'est plus disponible", true);
    }

    this.setLoader(true, `${this.t('buyingMachine')} (${this.payMode})...`);
    try {
      if (this.payMode === 'USDT') {
        await (await this.mine.buyMachine(typeId)).wait();
      } else {
        await (await this.mine.buyMachineFTA(typeId)).wait();
      }
      this.showToast(this.t('machineBought'));
      this.shopMachinesData = [];
      this.updateData();
    } catch (e) { this.showError(e); }
    this.setLoader(false);
  }

  // ─── Achat d'une batterie ────────────────────────────────────────
  async buyBattery(typeId) {
    if (!this.user) return this.connect();
    this.setLoader(true, `${this.t('buyingBattery')} (${this.payMode})...`);
    try {
      if (this.payMode === 'USDT') {
        await (await this.mine.buyBattery(typeId)).wait();
      } else {
        await (await this.mine.buyBatteryFTA(typeId)).wait();
      }
      this.showToast(this.t('batteryBought'));
      this.shopBatteriesData = [];
      this.updateData();
    } catch (e) { this.showError(e); }
    this.setLoader(false);
  }

  // ─── Branchement d'une machine ───────────────────────────────────
  async plugInMachine() {
    const machineIndex = document.getElementById('plug-machine-id').value;
    const batteryTypeId = document.getElementById('plug-battery-type').value;

    if (machineIndex === "" || machineIndex < 0) return this.showToast(this.t('invalidId'), true);
    // Vérification que l'utilisateur a bien une batterie de ce type
    if (!this.batteryInventory || !this.batteryInventory[Number(batteryTypeId)] || this.batteryInventory[Number(batteryTypeId)] <= 0) {
      return this.showToast(this.t('errNoBattery'), true);
    }

    this.setLoader(true, this.t('pluggingIn'));
    try {
      await (await this.mine.plugInMachine(machineIndex, batteryTypeId)).wait();
      this.showToast(this.t('pluggedIn'));
      this.updateData();
    } catch (e) {
      this.showError(e);
    }
    this.setLoader(false);
  }

  // ─── Récupération des gains (claim) ──────────────────────────────
  async claim() {
    if (!this.user) return;
    this.stopMiningCounter();
    this.setLoader(true, this.t('claiming'));
    try {
      const tx = await this.mine.claimRewards();
      await tx.wait();
      // Réinitialise le pending affiché et le compteur de temps
      this.pendingBalance = 0;
      document.getElementById('val-pending').innerText = "0.00000000";
      localStorage.setItem(this.storageKey, Math.floor(Date.now() / 1000));
      this.showToast(this.t('claimed'));
      await this.updateData();
      if (this.currentRealPower > 0) this.startMiningCounter();
    } catch (e) {
      const errStr = (e?.message || '').toLowerCase();
      if (errStr.includes('tfee') || errStr.includes('transfer')) {
        this.showToast('⚠️ Le contrat Mine n\'a pas assez de liquidité FTA pour payer les frais de claim. Contactez l\'admin.', true);
      } else if (errStr.includes('nom') || errStr.includes('no machine')) {
        this.showToast('⚠️ Aucune machine trouvée. Achetez une machine et branchez-la d\'abord.', true);
      } else {
        this.showError(e);
      }
      if (this.currentRealPower > 0) this.startMiningCounter();
    }
    this.setLoader(false);
  }

  // ─── Parrainage ──────────────────────────────────────────────────
  async bindReferrer() {
    const input = document.getElementById('ref-address-input').value.trim();
    if (!input) return this.showToast(this.t('invalidAddr'), true);
    if (!this.user) return this.showToast(this.t('connFirst'), true);

    this.setLoader(true, this.t('linking'));
    try {
      // Si l'adresse ressemble à une adresse Ethereum, on utilise setReferrer
      if (input.startsWith('0x') && input.length === 42) {
        await (await this.core.setReferrer(input)).wait();
      } else {
        // Sinon on traite comme un ID numérique
        const refId = parseInt(input);
        if (isNaN(refId)) throw new Error("Format invalide");
        await (await this.core.setReferrerById(refId)).wait();
      }
      this.showToast(this.t('refLinked'));
      document.getElementById('ref-address-input').value = '';
    } catch (e) { this.showError(e); }
    this.setLoader(false);
  }

  // ─── Mode de paiement ────────────────────────────────────────────
  setPayMode(mode) {
    this.payMode = mode;
    document.getElementById('btn-pay-usdt').classList.toggle('active', mode === 'USDT');
    document.getElementById('btn-pay-fta').classList.toggle('active', mode === 'FTA');
    this.renderShop();
  }

  // ─── Rendu de la boutique ────────────────────────────────────────
  async renderShop() {
    if (this.isLoadingShop) return;
    const container = document.getElementById('shop-list');
    if (this.shopViewMode === 'machines') {
      if (!this.shopMachinesData.length) await this.fetchMachines();
      this._renderShopMachinesHTML(container);
    } else {
      if (!this.shopBatteriesData.length) await this.fetchBatteries();
      this._renderShopBatteriesHTML(container);
    }
  }

  // ─── Récupération des machines du shop ───────────────────────────
  async fetchMachines() {
    this.isLoadingShop = true;
    try {
      const count = Number(await this.mine.mCount());
      const promises = [];
      for (let i = 0; i < count; i++) promises.push(this.mine.getMType(i));
      const results = await Promise.all(promises);
      this.shopMachinesData = [];
      for (let i = 0; i < count; i++) {
        const d = results[i];
        const priceUsdt = parseFloat(ethers.formatUnits(d.price, this.usdtDecimals));
        // power est un entier brut (pas de décimales)
        const power = Number(d.power);
        // shopExpiry : 0 = jamais, >0 = timestamp d'expiration
        const shopExpiry = Number(d.shopExpiry ?? 0);
        this.shopMachinesData.push({ price: priceUsdt, power: power, priceRaw: d.price, shopExpiry: shopExpiry });
      }
    } catch (e) { console.error("Erreur fetchMachines:", e); }
    this.isLoadingShop = false;
  }

  // ─── Récupération des batteries du shop ──────────────────────────
  async fetchBatteries() {
    this.isLoadingShop = true;
    try {
      const count = Number(await this.mine.bCount());
      const promises = [];
      for (let i = 0; i < count; i++) promises.push(this.mine.getBType(i));
      const results = await Promise.all(promises);
      this.shopBatteriesData = [];
      for (let i = 0; i < count; i++) {
        const d = results[i];
        const price = parseFloat(ethers.formatUnits(d.price, this.usdtDecimals));
        const days = Number(d.dur) / 86400;
        this.shopBatteriesData.push({ price: price, days: days, priceRaw: d.price });
      }
    } catch (e) { console.error("Erreur fetchBatteries:", e); }
    this.isLoadingShop = false;
  }

  // ─── SVG des machines (miniature) ────────────────────────────────
  getMachineMiniSVG(tier) {
    const c = ['#64748b', '#3b82f6', '#8b5cf6', '#F0B90B', '#f97316', '#ef4444', '#06b6d4', '#eab308'];
    const a = ['#94a3b8', '#60a5fa', '#a78bfa', '#FFD43B', '#fb923c', '#f87171', '#22d3ee', '#facc15'];
    const tc = c[tier % 8], ta = a[tier % 8];
    return `<svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" class="machine-svg-mini"><rect x="2" y="2" width="46" height="46" rx="6" fill="#1e293b" stroke="${tc}" stroke-width="1"/><rect x="2" y="2" width="46" height="3" rx="1.5" fill="${tc}" opacity="0.6"/><rect x="8" y="10" width="14" height="20" rx="2" fill="#080c18" stroke="${ta}" stroke-width="0.5"/><rect x="28" y="10" width="14" height="20" rx="2" fill="#080c18" stroke="${ta}" stroke-width="0.5"/><circle cx="21" cy="40" r="6" fill="#0a0e1a" stroke="#333" stroke-width="0.5"/><circle cx="37" cy="40" r="6" fill="#0a0e1a" stroke="#333" stroke-width="0.5"/></svg>`;
  }

  // ─── Rendu HTML des machines (boutique) ──────────────────────────
  _renderShopMachinesHTML(container) {
    container.innerHTML = '';
    container.style.gridTemplateColumns = '1fr 1fr';
    const badges = [
      'background:#64748b;color:#fff', 'background:#3b82f6;color:#fff', 'background:#8b5cf6;color:#fff', 'background:#F0B90B;color:#000',
      'background:#f97316;color:#fff', 'background:#ef4444;color:#fff', 'background:#06b6d4;color:#000', 'background:#eab308;color:#000'
    ];
    const names = ['STARTER', 'STANDARD', 'ADVANCED', 'PRO', 'ELITE', 'ULTRA', 'SUPREME', 'LEGEND'];
    for (let i = 0; i < this.shopMachinesData.length; i++) {
      const d = this.shopMachinesData[i];
      const div = document.createElement('div');
      div.className = 'rig-item';
      div.innerHTML = `<span class="tier-badge" style="${badges[i % 8]}">${names[i % 8]}</span>
        ${this.getMachineMiniSVG(i)}
        <span class="rig-name" style="font-size:0.85rem;">${this.t('rig')} ${i + 1}</span>
        <span class="rig-power" style="font-size:0.75rem;">${this.formatHashrate(d.power)}</span>
        <span class="rig-price" style="font-size:1rem;">${d.price.toFixed(2)} $</span>
        <button class="btn-primary" style="padding:8px;font-size:0.75rem;margin-top:6px;" onclick="App.buyMachine(${i})">${this.t('buy')} (${this.payMode})</button>`;
      container.appendChild(div);
    }
  }

  // ─── Rendu HTML des batteries (boutique) ─────────────────────────
  _renderShopBatteriesHTML(container) {
    container.innerHTML = '';
    container.style.gridTemplateColumns = '1fr 1fr';
    for (let i = 0; i < this.shopBatteriesData.length; i++) {
      const d = this.shopBatteriesData[i];
      const chargeLevel = Math.floor(Math.random() * 40) + 60;
      const div = document.createElement('div');
      div.className = 'battery-shop-item';
      div.innerHTML = `
        <div class="real-battery">
          <div class="battery-cap"></div>
          <div class="battery-body">
            <div class="battery-level" style="width:${chargeLevel}%"></div>
            <div class="battery-charge-indicator">${d.days}J</div>
          </div>
        </div>
        <div class="battery-name">${d.days} ${this.t('days')}</div>
        <div class="battery-price">${d.price.toFixed(2)} $</div>
        <button class="btn-primary" style="padding:6px;font-size:0.75rem" onclick="App.buyBattery(${i})">${this.t('buy')} (${this.payMode})</button>`;
      container.appendChild(div);
    }
  }

  // ─── Swap : inverser la direction ────────────────────────────────
  toggleSwap() {
    this.swapDirection = this.swapDirection === 'USDT_TO_FTA' ? 'FTA_TO_USDT' : 'USDT_TO_FTA';
    document.getElementById('token-from-display').innerText = this.swapDirection === 'USDT_TO_FTA' ? 'USDT' : 'FTA';
    document.getElementById('token-to-display').innerText = this.swapDirection === 'USDT_TO_FTA' ? 'FTA' : 'USDT';
    document.getElementById('swap-to-in').value = '';
    document.getElementById('swap-from-in').value = '';
    document.getElementById('swap-details').classList.add('hidden');
    this.updateData();
  }

  // ─── Swap : calcul du montant reçu ───────────────────────────────
  calcSwap() {
    const val = document.getElementById('swap-from-in').value;
    if (!val || val <= 0) {
      document.getElementById('swap-to-in').value = '';
      document.getElementById('swap-details').classList.add('hidden');
      return;
    }
    const inputVal = parseFloat(val);
    const isUsdtTo = this.swapDirection === 'USDT_TO_FTA';
    const fee = inputVal * SWAP_FEE_RATE;
    const netInput = inputVal - fee;
    let netOutput = 0;
    if (this.ftaPriceUsd > 0) {
      netOutput = isUsdtTo ? (netInput / this.ftaPriceUsd) : (netInput * this.ftaPriceUsd);
    }
    const minReceived = netOutput * (1 - SLIPPAGE);
    document.getElementById('swap-to-in').value = netOutput > 0 ? netOutput.toFixed(6) : '';
    const detailsEl = document.getElementById('swap-details');
    detailsEl.classList.remove('hidden');
    const fromToken = isUsdtTo ? 'USDT' : 'FTA';
    const toToken = isUsdtTo ? 'FTA' : 'USDT';
    document.getElementById('swap-detail-rate').innerText = isUsdtTo
      ? `1 USDT = ${(1 / this.ftaPriceUsd).toFixed(2)} FTA`
      : `1 FTA = ${this.ftaPriceUsd.toFixed(6)} USDT`;
    document.getElementById('swap-detail-fee').innerText = `${fee.toFixed(6)} ${fromToken}`;
    document.getElementById('swap-detail-min').innerText = `${minReceived.toFixed(6)} ${toToken}`;
  }

  // ─── Exécution du swap via le Core V3 ────────────────────────────
  async executeSwap() {
    const val = document.getElementById('swap-from-in').value;
    if (!val || val <= 0) return this.showToast(this.t('invalidAmount'), true);
    this.setLoader(true, this.t('swapping'));
    const isUsdtTo = this.swapDirection === 'USDT_TO_FTA';

    try {
      const decimals = isUsdtTo ? this.usdtDecimals : this.ftaDecimals;
      const amount = ethers.parseUnits(val, decimals);

      // Calcul du minimum reçu pour le slippage
      const netInput = parseFloat(val) * (1 - SWAP_FEE_RATE);
      const expectedOut = isUsdtTo ? (netInput / this.ftaPriceUsd) : (netInput * this.ftaPriceUsd);
      // minOut : si USDT→FTA alors decimals=FTA (8), si FTA→USDT alors decimals=USDT (6)
      const outDec = isUsdtTo ? this.ftaDecimals : this.usdtDecimals;
      const minOut = ethers.parseUnits((expectedOut * (1 - SLIPPAGE)).toFixed(outDec), outDec);

      // Deadline : 20 minutes dans le futur
      const deadline = Math.floor(Date.now() / 1000) + 1200;

      let tx;
      if (isUsdtTo) {
        tx = await this.core.swapUForF(amount, minOut, deadline);
      } else {
        tx = await this.core.swapFForU(amount, minOut, deadline);
      }
      await tx.wait();
      this.showToast(this.t('swapSuccess'));
      document.getElementById('swap-from-in').value = '';
      document.getElementById('swap-to-in').value = '';
      document.getElementById('swap-details').classList.add('hidden');
      this.updateData();
    } catch (e) { this.showError(e); }
    this.setLoader(false);
  }

  // ─── Visualiseur de minage ───────────────────────────────────────
  resizeCanvas() {
    if (this.vizContext) {
      const c = this.vizContext.canvas;
      c.width = c.offsetWidth * 2;
      c.height = c.offsetHeight * 2;
    }
  }

  initVisualizer() {
    const c = document.getElementById('mining-canvas');
    if (!c) return;
    this.resizeCanvas();
    this.vizContext = c.getContext('2d');
    this.vizBars = [];
    for (let i = 0; i < 20; i++) this.vizBars.push({ height: 0, targetHeight: 0 });
    this.animateVisualizer();
  }

  updateVisualizerIntensity(p) {
    const intensity = p > 0 ? Math.min((p * 500) + 10, 100) : 0;
    this.vizBars.forEach(b => b.targetHeight = (this.vizContext.canvas.height * (intensity / 100)) * Math.random());
  }

  animateVisualizer() {
    if (!this.vizContext) return;
    const ctx = this.vizContext;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = "#F0B90B";
    const w = ctx.canvas.width / 20;
    this.vizBars.forEach((b, i) => {
      b.height += (b.targetHeight - b.height) * 0.1;
      ctx.fillRect(i * w + 2, ctx.canvas.height - b.height, w - 4, b.height);
      b.targetHeight += (Math.random() - 0.5) * 10;
    });
    requestAnimationFrame(() => this.animateVisualizer());
  }

  // ─── Navigation ──────────────────────────────────────────────────
  nav(viewId) {
    document.querySelectorAll('.view').forEach(el => { el.classList.remove('active'); el.style.display = 'none'; });
    const activeView = document.getElementById('view-' + viewId);
    if (activeView) { activeView.classList.add('active'); activeView.style.display = 'block'; }
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if (event?.currentTarget) event.currentTarget.classList.add('active');
  }

  // ─── Loader plein écran ──────────────────────────────────────────
  setLoader(show, msg = "Traitement...") {
    const loader = document.getElementById('loader');
    document.getElementById('loader-text').innerText = msg;
    if (show) { loader.classList.remove('hidden'); } else { loader.classList.add('hidden'); }
  }

  // ─── Gestion des erreurs ─────────────────────────────────────────
  getErrorMessage(e) {
    // Extraire le message court ethers v6 (contient la raison du revert)
    const shortMsg = e?.shortMessage || e?.reason || '';
    const errStr = ((e?.message || '') + ' ' + shortMsg + ' ' + (e?.code || '') + ' ' + (e?.reason || '')).toLowerCase();

    if (errStr.includes('user rejected') || errStr.includes('user denied') || errStr.includes('action_rejected') || e?.code === 4001) return this.t('errRejected');
    if (errStr.includes('insufficient') || errStr.includes('not enough') || errStr.includes('insf')) return this.t('errInsufficientFunds');
    // Erreurs de transfert : approve manquant, solde insuffisant, etc.
    if (errStr.includes('tff') || errStr.includes('transferfrom') || errStr.includes('erc20: transfer amount exceeds')) return '❌ Transfert échoué. Vérifiez que vous avez approuvé le contrat et que votre solde wallet FTA est suffisant.';
    if (errStr.includes('nonce')) return this.t('errNonce');
    if (errStr.includes('reentrant')) return '⚠️ Une transaction est déjà en cours. Patientez quelques secondes.';
    if (errStr.includes('pending')) return this.t('errAlreadyPending');
    if (errStr.includes('timeout') || errStr.includes('deadline')) return this.t('errTimeout');
    if (errStr.includes('network') || errStr.includes('fetch') || errStr.includes('call revert')) return this.t('errNetwork');
    if (errStr.includes('revert') || errStr.includes('execution')) return this.t('errContract');
    if (errStr.includes('nom') || errStr.includes('no machine')) return this.t('errNoMachine');
    if (errStr.includes('running')) return this.t('errRunning');
    if (errStr.includes('nobat') || errStr.includes('no battery')) return this.t('errNoBattery');
    if (errStr.includes('maxm') || errStr.includes('max machine')) return this.t('errMaxMachine');

    // Fallback : afficher le vrai message ethers si disponible, sinon générique
    if (shortMsg) return 'Erreur contrat : ' + shortMsg;
    return this.t('errGeneric');
  }

  showError(e) {
    // Log complet pour débogage console
    console.error("═══ Transaction Error ═══");
    console.error("Message:", e?.message);
    console.error("Short:", e?.shortMessage);
    console.error("Reason:", e?.reason);
    console.error("Code:", e?.code);
    console.error("Data:", e?.data);
    console.error("Full:", e);
    this.showToast(this.getErrorMessage(e), true);
  }

  showToast(msg, isError = false) {
    const div = document.createElement('div');
    div.className = 'toast' + (isError ? ' toast-error' : ' toast-success');
    div.innerText = msg;
    const container = document.getElementById('toast-container');
    container.appendChild(div);
    setTimeout(() => div.remove(), 4000);
  }

  // ─── Mise à jour de l'indicateur de pourcentage d'évolution ─────
  // Compare le prix actuel avec un checkpoint pris toutes les 5 minutes.
  // Sans ça, comparer toutes les 15 secondes donne toujours ~0.00%
  // car la bonding curve ne bouge pas assez vite.
  updatePriceChange(token, newPrice) {
    const el = document.getElementById('change-' + token);
    if (!el) return;
    const now = Date.now();
    const interval = 5 * 60 * 1000; // checkpoint toutes les 5 minutes
    const checkpoint = this.prevPriceCheckpoint[token];

    // Premier passage ou reset périodique : on pose un nouveau checkpoint
    if (checkpoint === undefined || checkpoint === null || checkpoint === 0
        || now - this.priceCheckpointTime > interval) {
      this.prevPriceCheckpoint[token] = newPrice;
      if (this.priceCheckpointTime === 0 || now - this.priceCheckpointTime > interval * 2) {
        this.priceCheckpointTime = now;
      }
      el.textContent = '0.00%';
      el.className = 'token-change flat';
      return;
    }

    // Calcul de l'évolution depuis le dernier checkpoint
    const change = ((newPrice - checkpoint) / checkpoint) * 100;
    const absChange = Math.abs(change);
    let sign, cssClass;
    if (absChange < 0.01) {
      sign = '';
      cssClass = 'flat';
    } else if (change > 0) {
      sign = '+';
      cssClass = 'up';
    } else {
      sign = '';
      cssClass = 'down';
    }
    el.textContent = sign + change.toFixed(2) + '%';
    el.className = 'token-change ' + cssClass;
  }

  // ═══ CHAT ASSISTANT ══════════════════════════════════════════════
  toggleChat() {
    const panel = document.getElementById('chat-panel');
    const isActive = panel.classList.toggle('active');
    if (isActive && !this.chatInitialized) {
      this.chatInitialized = true;
      setTimeout(() => this.addChatBubble('assistant', this.getWelcomeMessage()), 400);
    }
    if (isActive) setTimeout(() => document.getElementById('chat-input').focus(), 350);
  }

  sendChatMessage() {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';
    this.addChatBubble('user', msg);
    this.chatHistory.push({ role: 'user', text: msg });
    const typingId = this.showTyping();
    const delay = 400 + Math.min(msg.length * 25, 1200) + Math.random() * 400;
    setTimeout(() => {
      this.removeTyping(typingId);
      const response = this.generateLocalResponse(msg);
      this.addChatBubble('assistant', response);
      this.chatHistory.push({ role: 'assistant', text: response });
    }, delay);
  }

  addChatBubble(role, text) {
    const container = document.getElementById('chat-messages');
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${role}`;
    bubble.textContent = text;
    container.appendChild(bubble);
    requestAnimationFrame(() => container.scrollTop = container.scrollHeight);
  }

  showTyping() {
    const container = document.getElementById('chat-messages');
    const typing = document.createElement('div');
    const id = 'typing-' + Date.now();
    typing.id = id;
    typing.className = 'chat-bubble assistant';
    typing.innerHTML = '<span style="letter-spacing:3px;animation:loaderTextPulse 1s infinite">● ● ●</span>';
    container.appendChild(typing);
    container.scrollTop = container.scrollHeight;
    return id;
  }

  removeTyping(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  getWelcomeMessage() {
    const m = {
      en: "👋 Welcome to FITIA PRO! I'm your crypto assistant.\nAsk me about: Mining, Swap, Wallet, Security, Community!",
      fr: "👋 Bienvenue sur FITIA PRO ! Je suis votre assistant crypto.\nDemandez-moi : Minage, Échange, Wallet, Sécurité, Communauté !",
      de: "👋 Willkommen bei FITIA PRO! Dein Krypto-Assistent.\nFrag mich zu: Mining, Tausch, Wallet, Sicherheit!",
      zh: "👋 欢迎使用 FITIA PRO！你的加密助手。\n问我：挖矿、兑换、钱包、安全！",
      sg: "👋 Welcome to FITIA PRO! Your crypto assistant.\nAsk about: Mining, Swap, Wallet, Security!"
    };
    return m[this.currentLang] || m.en;
  }

  generateLocalResponse(msg) {
    const m = msg.toLowerCase().replace(/[?!.,;:'"]/g, '').trim();
    const conn = !!this.user;
    const power = this.currentRealPower || 0;
    const pending = this.pendingBalance || 0;
    const ftaP = this.ftaPriceUsd || 0;

    // Détection des intentions simplifiée
    if (m.includes('salut') || m.includes('bonjour') || m.includes('hello') || m.includes('hi') || m.includes('你好')) {
      return conn
        ? `👋 Salut ! Puissance actuelle : ${this.formatHashrate(power)}. ${this.userMachines.filter(m => m.exp > Math.floor(Date.now()/1000)).length} machine(s) active(s). Comment puis-je vous aider ?`
        : "👋 Bienvenue ! Connectez votre wallet pour commencer. Besoin d'aide ?";
    }
    if (m.includes('merci') || m.includes('thanks') || m.includes('谢谢')) return "De rien ! 😊 Besoin d'autre chose ?";
    if (m.includes('aide') || m.includes('help') || m.includes('帮助')) return "🛠️ Je peux vous aider avec :\n⛏️ Minage — Acheter machine, batterie, brancher\n💱 Échange — USDT ↔ FTA\n💰 Wallet — Dépôt, retrait, solde\n👥 Parrainage — Gagner avec les références\n🛡️ Sécurité — Conseils\n📱 Communauté — WhatsApp";
    if (m.includes('minage') || m.includes('mine') || m.includes('miner') || m.includes('挖矿')) {
      return conn
        ? `⛏️ Minage FITIA :\n1️⃣ Achetez une machine (Boutique)\n2️⃣ Achetez une batterie\n3️⃣ Branchez la machine (Wallet)\n4️⃣ Gagnez du FTA automatiquement !\n5️⃣ Réclamez vos gains\nPuissance : ${this.formatHashrate(power)}\nEn attente : ${pending.toFixed(5)} FTA`
        : "⛏️ Connectez votre wallet pour commencer le minage !";
    }
    if (m.includes('swap') || m.includes('échange') || m.includes('echange') || m.includes('兑换')) {
      return `💱 Échange USDT ↔ FTA :\nAllez dans l'onglet Swap, choisissez la direction, entrez le montant et cliquez ÉCHANGER.\nTaux actuel : 1 FTA = ${ftaP > 0 ? ftaP.toFixed(6) : '...'} USDT\nFrais : 4%`;
    }
    if (m.includes('wallet') || m.includes('solde') || m.includes('dépôt') || m.includes('depot') || m.includes('余额')) {
      return "💰 Wallet :\n• Déposez USDT ou FTA pour les utiliser dans la dApp\n• Retirez à tout moment\n• Envoyez/recevez des tokens\n• Tout se passe sur Polygon (frais très bas)";
    }
    if (m.includes('sécurité') || m.includes('securite') || m.includes('security') || m.includes('安全')) {
      return "🛡️ Sécurité :\n✅ Ne partagez JAMAIS votre phrase de récupération\n✅ Personne de FITIA ne vous la demandera\n✅ Vérifiez les adresses avant d'envoyer\n✅ Utilisez uniquement les liens officiels";
    }
    if (m.includes('communauté') || m.includes('whatsapp') || m.includes('groupe') || m.includes('社群')) {
      return `📱 Communautés officielles :\n👥 Groupe WhatsApp : ${CONFIG.WHATSAPP_GROUP}\n📢 Chaîne WhatsApp : ${CONFIG.WHATSAPP_CHANNEL}`;
    }
    if (m.includes('parrain') || m.includes('parrainage') || m.includes('référence') || m.includes('推荐')) {
      return conn
        ? `👥 Parrainage : Votre adresse est votre code de parrainage : ${this.user.slice(0, 6)}...${this.user.slice(-4)}\nPartagez-la pour gagner des bonus !`
        : "👥 Connectez votre wallet pour voir votre code de parrainage !";
    }
    return "Je ne suis pas sûr de comprendre. Essayez : 'minage', 'swap', 'wallet', 'sécurité', 'communauté', ou 'parrainage'. Je suis là pour vous aider !";
  }
}

// ─── Démarrage de l'application ────────────────────────────────────
const App = new Application();
App.init();
