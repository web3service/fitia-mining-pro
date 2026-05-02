const CONFIG = {
    MINING: "0xa70147A41F10e84D25A97997d7e2507096F86BAD",
    USDT: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    FTA: "0x5c418b12c7e9c2A8e9A71A68c6d9b319E7B1d1fd",
    CHAIN_ID: 137,
    WC_PROJECT_ID: "2c10ee910a836551fbabbf7c8cc4542a"
};

const i18n = {
    en: { connect: "Connect", refTitle: "👥 Referral System", refDesc: "Enter your referrer's address to link.", bindRef: "BIND", power: "POWER", ftaSec: "Hashrate", pending: "PENDING", fta: "FTA", miningActive: "MINING ACTIVE", noMachine: "NO MACHINE", claim: "CLAIM", shopTitle: "⛏️ Shop", machines: "Machines", batteries: "Batteries", buy: "BUY", myAssets: "⚙️ Wallet & Assets", walletBal: "💰 Balances", plugMachine: "🔌 Plug in a machine", plugDesc: "Enter your offline machine ID and choose a battery.", machineId: "Machine ID (0, 1...)", plug: "PLUG IN ⚡", swapTitle: "💱 Swap", youPay: "You pay", balance: "Balance:", youReceive: "You receive", swap: "SWAP", loading: "Loading...", currentRate: "1 FTA = ", home: "Home", shop: "Shop", assets: "Wallet", swapNav: "Swap", connWallet: "Connecting...", errConn: "Connection Error", linking: "Linking...", wcIdMissing: "WalletConnect ID missing in code!", refLinked: "Referrer linked successfully!", connFirst: "Connect first", enterRefAddr: "Referrer address (0x...)", buyingMachine: "Buying Machine", approveUsdt: "Approving USDT...", approveFta: "Approving FTA...", confirming: "Confirming...", calcFta: "Calculating FTA price...", machineBought: "Machine purchased!", buyingBattery: "Buying Battery", batteryBought: "Battery purchased!", invalidId: "Invalid Machine ID", pluggingIn: "Plugging in...", pluggedIn: "Machine plugged in successfully! ⚡", invalidAmount: "Invalid amount", swapping: "Swapping...", swapSuccess: "Swap successful!", claiming: "Claiming...", claimed: "Rewards claimed!", error: "Error", days: "Days", rig: "RIG", send: "Send", receive: "Receive", recipientAddr: "Recipient address (0x...)", amount: "Amount", confirmSend: "CONFIRM SEND", sending: "Sending...", sentSuccess: "Sent successfully!", addrCopied: "Address copied!", invalidAddr: "Invalid address", totalBal: "Total Balance", activeMachines: "⛏️ Active Machines", myMachines: "⛏️ My Machines", myBatteries: "🔋 My Batteries", active: "Active", expired: "Expired", inactive: "Inactive", available: "Available", plugged: "Plugged", notPlugged: "Not Plugged", timeRemaining: "Remaining", expiredOn: "Expired", noMachines: "No machines yet", noBatteries: "No batteries yet", batteryLabel: "Battery", machineLabel: "Machine", usdtPerFta: " USDT", noActiveMachines: "No active machines" },
    fr: { connect: "Connecter", refTitle: "👥 Système de Parrainage", refDesc: "Entrez l'adresse de votre parrain pour le lier.", bindRef: "LIER", power: "PUISSANCE", ftaSec: "Hashrate", pending: "EN ATTENTE", fta: "FTA", miningActive: "MINAGE ACTIF", noMachine: "AUCUNE MACHINE", claim: "RÉCLAMER", shopTitle: "⛏️ Boutique", machines: "Machines", batteries: "Batteries", buy: "ACHETER", myAssets: "⚙️ Wallet & Actifs", walletBal: "💰 Soldes", plugMachine: "🔌 Brancher une machine", plugDesc: "Entrez l'ID de votre machine éteinte et choisissez une batterie.", machineId: "ID Machine (0, 1...)", plug: "BRANCHER ⚡", swapTitle: "💱 Échange", youPay: "Vous payez", balance: "Solde:", youReceive: "Vous recevez", swap: "ÉCHANGER", loading: "Chargement...", currentRate: "1 FTA = ", home: "Accueil", shop: "Boutique", assets: "Wallet", swapNav: "Swap", connWallet: "Connexion...", errConn: "Erreur connexion", linking: "Liaison...", wcIdMissing: "ID WalletConnect manquant !", refLinked: "Parrain lié avec succès !", connFirst: "Connectez-vous d'abord", enterRefAddr: "Adresse du parrain (0x...)", buyingMachine: "Achat Machine", approveUsdt: "Approbation USDT...", approveFta: "Approbation FTA...", confirming: "Confirmation...", calcFta: "Calcul du prix FTA...", machineBought: "Machine achetée !", buyingBattery: "Achat Batterie", batteryBought: "Batterie achetée !", invalidId: "ID Machine invalide", pluggingIn: "Branchement...", pluggedIn: "Machine branchée ! ⚡", invalidAmount: "Montant invalide", swapping: "Swap...", swapSuccess: "Échange réussi !", claiming: "Claim...", claimed: "Gains réclamés !", error: "Erreur", days: "Jours", rig: "RIG", send: "Envoyer", receive: "Recevoir", recipientAddr: "Adresse du destinataire (0x...)", amount: "Montant", confirmSend: "CONFIRMER ENVOI", sending: "Envoi...", sentSuccess: "Envoi réussi !", addrCopied: "Adresse copiée !", invalidAddr: "Adresse invalide", totalBal: "Solde Total", activeMachines: "⛏️ Machines Actives", myMachines: "⛏️ Mes Machines", myBatteries: "🔋 Mes Batteries", active: "Actif", expired: "Expiré", inactive: "Inactif", available: "Disponible", plugged: "Branché", notPlugged: "Non branché", timeRemaining: "Restant", expiredOn: "Expiré", noMachines: "Aucune machine", noBatteries: "Aucune batterie", batteryLabel: "Batterie", machineLabel: "Machine", usdtPerFta: " USDT", noActiveMachines: "Aucune machine active" },
    de: { connect: "Verbinden", refTitle: "👥 Empfehlungssystem", refDesc: "Geben Sie die Adresse Ihres Empfehlers ein.", bindRef: "BINDEN", power: "LEISTUNG", ftaSec: "Hashrate", pending: "AUSSTEHEND", fta: "FTA", miningActive: "MINING AKTIV", noMachine: "KEINE MASCHINE", claim: "EINFORDERN", shopTitle: "⛏️ Shop", machines: "Maschinen", batteries: "Batterien", buy: "KAUFEN", myAssets: "⚙️ Wallet & Assets", walletBal: "💰 Guthaben", plugMachine: "🔌 Maschine anschließen", plugDesc: "Geben Sie die ID Ihrer Offline-Maschine ein.", machineId: "Maschinen-ID (0, 1...)", plug: "ANSCHLIESSEN ⚡", swapTitle: "💱 Tausch", youPay: "Sie zahlen", balance: "Guthaben:", youReceive: "Sie erhalten", swap: "TAUSCHEN", loading: "Laden...", currentRate: "1 FTA = ", home: "Home", shop: "Shop", assets: "Wallet", swapNav: "Swap", connWallet: "Verbindung...", errConn: "Verbindungsfehler", linking: "Verknüpfung...", wcIdMissing: "WalletConnect-ID fehlt!", refLinked: "Empfehler verknüpft!", connFirst: "Zuerst verbinden", enterRefAddr: "Empfehler-Adresse (0x...)", buyingMachine: "Kaufe Maschine", approveUsdt: "USDT genehmigen...", approveFta: "FTA genehmigen...", confirming: "Bestätigung...", calcFta: "FTA-Preis berechnen...", machineBought: "Maschine gekauft!", buyingBattery: "Kaufe Batterie", batteryBought: "Batterie gekauft!", invalidId: "Ungültige ID", pluggingIn: "Anschließen...", pluggedIn: "Maschine angeschlossen! ⚡", invalidAmount: "Ungültiger Betrag", swapping: "Tauschen...", swapSuccess: "Tausch erfolgreich!", claiming: "Einforderung...", claimed: "Eingefordert!", error: "Fehler", days: "Tage", rig: "RIG", send: "Senden", receive: "Empfangen", recipientAddr: "Empfängeradresse (0x...)", amount: "Betrag", confirmSend: "SENDUNG BESTÄTIGEN", sending: "Senden...", sentSuccess: "Gesendet!", addrCopied: "Kopiert!", invalidAddr: "Ungültige Adresse", totalBal: "Gesamtguthaben", activeMachines: "⛏️ Aktive Maschinen", myMachines: "⛏️ Meine Maschinen", myBatteries: "🔋 Meine Batterien", active: "Aktiv", expired: "Abgelaufen", inactive: "Inaktiv", available: "Verfügbar", plugged: "Angeschlossen", notPlugged: "Nicht angeschlossen", timeRemaining: "Verbleibend", expiredOn: "Abgelaufen", noMachines: "Keine Maschinen", noBatteries: "Keine Batterien", batteryLabel: "Batterie", machineLabel: "Maschine", usdtPerFta: " USDT", noActiveMachines: "Keine aktive Maschinen" },
    zh: { connect: "连接", refTitle: "👥 推荐系统", refDesc: "输入推荐人地址进行绑定。", bindRef: "绑定", power: "算力", ftaSec: "Hashrate", pending: "待领取", fta: "FTA", miningActive: "挖矿中", noMachine: "无机器", claim: "领取", shopTitle: "⛏️ 商店", machines: "矿机", batteries: "电池", buy: "购买", myAssets: "⚙️ 钱包与资产", walletBal: "💰 余额", plugMachine: "🔌 插入机器", plugDesc: "输入离线机器ID并选择电池。", machineId: "机器ID (0, 1...)", plug: "插入 ⚡", swapTitle: "💱 兑换", youPay: "您支付", balance: "余额:", youReceive: "您收到", swap: "兑换", loading: "加载中...", currentRate: "1 FTA = ", home: "首页", shop: "商店", assets: "钱包", swapNav: "兑换", connWallet: "连接中...", errConn: "连接错误", linking: "绑定中...", wcIdMissing: "缺少 WalletConnect ID！", refLinked: "推荐人绑定成功！", connFirst: "请先连接", enterRefAddr: "推荐人地址 (0x...)", buyingMachine: "购买机器", approveUsdt: "授权 USDT...", approveFta: "授权 FTA...", confirming: "确认中...", calcFta: "计算 FTA 价格...", machineBought: "机器购买成功！", buyingBattery: "购买电池", batteryBought: "电池购买成功！", invalidId: "无效ID", pluggingIn: "插入中...", pluggedIn: "机器插入成功！ ⚡", invalidAmount: "无效金额", swapping: "兑换中...", swapSuccess: "兑换成功！", claiming: "领取中...", claimed: "奖励已领取！", error: "错误", days: "天", rig: "矿机", send: "发送", receive: "接收", recipientAddr: "接收方地址 (0x...)", amount: "金额", confirmSend: "确认发送", sending: "发送中...", sentSuccess: "发送成功！", addrCopied: "地址已复制！", invalidAddr: "无效地址", totalBal: "总余额", activeMachines: "⛏️ 运行中矿机", myMachines: "⛏️ 我的矿机", myBatteries: "🔋 我的电池", active: "运行中", expired: "已过期", inactive: "未激活", available: "可用", plugged: "已插入", notPlugged: "未插入", timeRemaining: "剩余", expiredOn: "已过期", noMachines: "暂无矿机", noBatteries: "暂无电池", batteryLabel: "电池", machineLabel: "矿机", usdtPerFta: " USDT", noActiveMachines: "无运行中矿机" },
    sg: { connect: "Connect", refTitle: "👥 Referral System", refDesc: "Enter your referrer's address to link.", bindRef: "BIND", power: "POWER", ftaSec: "Hashrate", pending: "PENDING", fta: "FTA", miningActive: "MINING ACTIVE", noMachine: "NO MACHINE", claim: "CLAIM", shopTitle: "⛏️ Shop", machines: "Machines", batteries: "Batteries", buy: "BUY", myAssets: "⚙️ Wallet & Assets", walletBal: "💰 Balances", plugMachine: "🔌 Plug in a machine", plugDesc: "Enter your offline machine ID and choose a battery.", machineId: "Machine ID (0, 1...)", plug: "PLUG IN ⚡", swapTitle: "💱 Swap", youPay: "You pay", balance: "Balance:", youReceive: "You receive", swap: "SWAP", loading: "Loading...", currentRate: "1 FTA = ", home: "Home", shop: "Shop", assets: "Wallet", swapNav: "Swap", connWallet: "Connecting...", errConn: "Connection Error", linking: "Linking...", wcIdMissing: "WalletConnect ID missing!", refLinked: "Referrer linked successfully!", connFirst: "Connect first", enterRefAddr: "Referrer address (0x...)", buyingMachine: "Buying Machine", approveUsdt: "Approving USDT...", approveFta: "Approving FTA...", confirming: "Confirming...", calcFta: "Calculating FTA price...", machineBought: "Machine purchased!", buyingBattery: "Buying Battery", batteryBought: "Battery purchased!", invalidId: "Invalid Machine ID", pluggingIn: "Plugging in...", pluggedIn: "Machine plugged in successfully! ⚡", invalidAmount: "Invalid amount", swapping: "Swapping...", swapSuccess: "Swap successful!", claiming: "Claiming...", claimed: "Rewards claimed!", error: "Error", days: "Days", rig: "RIG", send: "Send", receive: "Receive", recipientAddr: "Recipient address (0x...)", amount: "Amount", confirmSend: "CONFIRM SEND", sending: "Sending...", sentSuccess: "Sent successfully!", addrCopied: "Address copied!", invalidAddr: "Invalid address", totalBal: "Total Balance", activeMachines: "⛏️ Active Machines", myMachines: "⛏️ My Machines", myBatteries: "🔋 My Batteries", active: "Active", expired: "Expired", inactive: "Inactive", available: "Available", plugged: "Plugged", notPlugged: "Not Plugged", timeRemaining: "Remaining", expiredOn: "Expired", noMachines: "No machines yet", noBatteries: "No batteries yet", batteryLabel: "Battery", machineLabel: "Machine", usdtPerFta: " USDT", noActiveMachines: "No active machines" }
};

const MINING_ABI = [
    "function getActivePower(address) view returns (uint256)",
    "function getMachineCount() view returns (uint256)",
    "function getBatteryCount() view returns (uint256)",
    "function machineTypes(uint256) view returns (uint256 price, uint256 power)",
    "function batteryTypes(uint256) view returns (uint256 price, uint256 duration)",
    "function users(address) view returns (uint256 lastClaimTime)",
    "function difficultyMultiplier() view returns (uint256)",
    "function getCurrentRate() view returns (uint256)",
    "function getFtaOutForUsdtBuy(uint256) view returns (uint256)",
    "function getUsdtOutForFtaSell(uint256) view returns (uint256)",
    "function getFtaCostForUsdtSell(uint256) view returns (uint256)",
    "function buyMachine(uint256 typeId)", "function buyMachineWithFTA(uint256 typeId)",
    "function buyBattery(uint256 typeId)", "function buyBatteryWithFTA(uint256 typeId)",
    "function plugInMachine(uint256 machineIndex, uint256 batteryTypeId)",
    "function claimRewards()", "function setReferrer(address)",
    "function swapUsdtForFta(uint256 amount)", "function swapFtaForUsdt(uint256 amount)",
    "function getUserMachineCount(address) view returns (uint256)",
    "function getUserBatteryCount(address) view returns (uint256)",
    "function userMachines(address, uint256) view returns (uint256 typeId, bool isPlugged, uint256 batteryEndTime, uint256 pluggedBatteryType)",
    "function userBatteries(address, uint256) view returns (uint256 typeId, uint256 endTime, bool isUsed)",
    "function getMachineInfo(address, uint256) view returns (uint256, bool, uint256, uint256)",
    "function getBatteryInfo(address, uint256) view returns (uint256, uint256, bool)"
];

const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function approve(address, uint256) returns (bool)",
    "function allowance(address, address) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)"
];

class Application {
    constructor() {
        this.provider = null; this.signer = null; this.contracts = {}; this.user = null;
        this.payMode = 'USDT'; this.shopViewMode = 'machines';
        this.swapDirection = 'USDT_TO_FTA';
        this.ftaDecimals = 18; this.usdtDecimals = 6;
        this.currentMultiplier = 2000000000000n; 
        this.currentRealPower = 0; this.pendingBalance = 0;    
        this.miningTimer = null; this.storageKey = "fitia_last_claim_time_v3"; 
        this.shopMachinesData = []; this.shopBatteriesData = [];
        this.isLoadingShop = false; 
        this.vizContext = null; this.vizBars = [];
        this.sendTokenSymbol = 'POL';
        this.polPriceUsd = 0; this.ftaPriceUsd = 0; 
        this.userMachines = []; this.userBatteries = [];
        this.batteryTypeDurations = {};
        const savedLang = localStorage.getItem('fitia_lang');
        this.currentLang = savedLang && i18n[savedLang] ? savedLang : 'en';
    }

    t(key) { return i18n[this.currentLang][key] || i18n['en'][key] || key; }
    formatUsd(value) { return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

    formatHashrate(hashesPerSec) {
        if (hashesPerSec <= 0) return '0 H/s';
        const units = ['H/s', 'KH/s', 'MH/s', 'GH/s', 'TH/s', 'PH/s', 'EH/s'];
        let value = hashesPerSec; let unitIndex = 0;
        while (value >= 1000 && unitIndex < units.length - 1) { value /= 1000; unitIndex++; }
        return value.toFixed(unitIndex === 0 ? 0 : 2) + ' ' + units[unitIndex];
    }

    formatTimeRemaining(seconds) {
        if (seconds <= 0) return this.t('expired');
        const d = Math.floor(seconds / 86400);
        const h = Math.floor((seconds % 86400) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (d > 1) return `${d}d ${h}h`;
        if (d === 1) return `1d ${h}h`;
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    }

    getBatteryDuration(typeId) {
        if (this.batteryTypeDurations[typeId] !== undefined) return this.batteryTypeDurations[typeId];
        const defaults = {0:3, 1:7, 2:15, 3:30, 4:90, 5:180, 6:270, 7:365};
        return defaults[typeId] || 30;
    }

    setLanguage(lang) {
        if(!i18n[lang]) return;
        this.currentLang = lang;
        localStorage.setItem('fitia_lang', lang);
        const flags = { en: '🇬🇧', fr: '🇫🇷', de: '🇩🇪', zh: '🇨🇳', sg: '🇸🇬' };
        document.getElementById('lang-btn-display').innerText = `${flags[lang]} ${lang.toUpperCase()}`;
        this.applyTranslations();
        this.renderShop(); 
    }

    applyTranslations() {
        document.getElementById('btn-connect').innerText = this.t('connect');
        document.querySelector('.total-balance-card small').innerText = this.t('totalBal');
        document.querySelector('.referral-card h3').innerText = this.t('refTitle');
        document.querySelector('.referral-card p.small-text').innerText = this.t('refDesc');
        document.querySelector('#ref-address-input').placeholder = this.t('enterRefAddr');
        document.querySelector('.referral-card .btn-full').innerText = this.t('bindRef');
        const stats = document.querySelectorAll('.stat-card');
        stats[0].querySelector('small:first-child').innerText = this.t('power'); stats[0].querySelector('small:last-child').innerText = this.t('ftaSec');
        stats[1].querySelector('small:first-child').innerText = this.t('pending'); stats[1].querySelector('small:last-child').innerText = this.t('fta');
        document.querySelector('.btn-mega').childNodes[1].textContent = this.t('claim');
        document.querySelector('#view-shop .view-title').innerText = this.t('shopTitle');
        document.querySelectorAll('.shop-tab')[0].innerText = this.t('machines'); document.querySelectorAll('.shop-tab')[1].innerText = this.t('batteries');
        document.querySelector('#view-my-rigs .view-title').innerText = this.t('myAssets');
        document.querySelector('#view-my-rigs .card:first-child h3').innerText = this.t('walletBal');
        document.querySelectorAll('.btn-wallet').forEach(b => { if(b.textContent.includes('Send')) b.innerText = this.t('send'); if(b.textContent.includes('Receive')) b.innerText = this.t('receive'); });
        document.querySelector('#active-machines-section .section-title').innerText = this.t('activeMachines');
        const walletCards = document.querySelectorAll('#view-my-rigs .card');
        if(walletCards[1]) walletCards[1].querySelector('.section-title').innerText = this.t('myMachines');
        if(walletCards[2]) walletCards[2].querySelector('.section-title').innerText = this.t('myBatteries');
        if(walletCards[3]) { walletCards[3].querySelector('h3').innerText = `🔌 ${this.t('plugMachine')}`; walletCards[3].querySelector('p').innerText = this.t('plugDesc'); }
        document.getElementById('plug-machine-id').placeholder = this.t('machineId');
        document.querySelector('#view-swap .view-title').innerText = this.t('swapTitle');
        const swapHeaders = document.querySelectorAll('.swap-header span:first-child');
        swapHeaders[0].innerText = this.t('youPay'); swapHeaders[1].innerText = this.t('youReceive');
        document.querySelector('#view-swap .btn-primary').innerText = this.t('swap');
        const navSpans = document.querySelectorAll('.nav-item span');
        navSpans[0].innerText = this.t('home'); navSpans[1].innerText = this.t('shop'); navSpans[2].innerText = this.t('assets'); navSpans[3].innerText = this.t('swapNav');
    }

    async init() { this.setLanguage(this.currentLang); }

    async fetchMarketPrices() {
        this.polPriceUsd = 0;
        try { const r = await fetch('https://api.dexscreener.com/latest/dex/tokens/0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0'); const d = await r.json(); if (d.pairs && d.pairs.length > 0) this.polPriceUsd = parseFloat(d.pairs[0].priceUsd) || 0; } catch (e) {}
        if (!this.polPriceUsd || this.polPriceUsd === 0) { try { const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=matic-network&vs_currencies=usd'); const d = await r.json(); this.polPriceUsd = d['matic-network']?.usd || 0; } catch (e2) {} }
        if (!this.polPriceUsd) this.polPriceUsd = 0.70;
    }

    async connect() {
        if (!CONFIG.WC_PROJECT_ID || CONFIG.WC_PROJECT_ID === "VOTRE_PROJECT_ID_WALLETCONNECT") { this.showToast(this.t('wcIdMissing'), true); return; }
        if (window.ethereum) {
            this.setLoader(true, this.t('connWallet'));
            try {
                await window.ethereum.request({ method: 'eth_requestAccounts' });
                this.provider = new ethers.BrowserProvider(window.ethereum);
                this.signer = await this.provider.getSigner();
                this.user = await this.signer.getAddress();
                const network = await this.provider.getNetwork();
                if (Number(network.chainId) !== CONFIG.CHAIN_ID) await this.switchNetwork();
                this.initContracts();
                window.ethereum.on('accountsChanged', () => window.location.reload());
                window.ethereum.on('chainChanged', () => window.location.reload());
            } catch (e) { this.showToast(this.t('errConn'), true); } this.setLoader(false);
        } else if (typeof EthereumProvider !== 'undefined') {
            this.setLoader(true, this.t('connWallet'));
            try {
                const wcProvider = await EthereumProvider.init({ projectId: CONFIG.WC_PROJECT_ID, chains: [CONFIG.CHAIN_ID], showQrModal: true, methods: ['eth_sendTransaction', 'personal_sign'], metadata: { name: 'FITIA PRO MINER', description: 'Mining DApp', url: window.location.origin, icons: [window.location.origin + '/logo.png'] } });
                await wcProvider.enable(); this.provider = new ethers.BrowserProvider(wcProvider); this.signer = await this.provider.getSigner(); this.user = await this.signer.getAddress(); this.initContracts(); wcProvider.on("disconnect", () => window.location.reload());
            } catch (e) { this.showToast(this.t('errConn'), true); } this.setLoader(false);
        }
    }

    async initContracts() {
        this.contracts.usdt = new ethers.Contract(CONFIG.USDT, ERC20_ABI, this.signer);
        this.contracts.fta = new ethers.Contract(CONFIG.FTA, ERC20_ABI, this.signer);
        this.contracts.mining = new ethers.Contract(CONFIG.MINING, MINING_ABI, this.signer);
        try { this.ftaDecimals = await this.contracts.fta.decimals(); } catch(e) { this.ftaDecimals = 18; }
        document.getElementById('btn-connect').classList.add('hidden');
        document.getElementById('wallet-status').classList.remove('hidden');
        document.getElementById('addr-display').innerText = this.user.slice(0,6) + "..." + this.user.slice(38);
        if (!localStorage.getItem(this.storageKey)) { localStorage.setItem(this.storageKey, Math.floor(Date.now() / 1000)); }
        await this.fetchMarketPrices();
        await this.cacheBatteryDurations();
        await this.updateData();
        setInterval(() => this.updateData(), 15000);
        this.initVisualizer();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    async cacheBatteryDurations() {
        try { const count = await this.contracts.mining.getBatteryCount(); for (let i = 0; i < count; i++) { try { const bt = await this.contracts.mining.batteryTypes(i); this.batteryTypeDurations[i] = Number(bt.duration) / 86400; } catch(e){} } } catch(e){}
    }

    async switchNetwork() { try { await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x89' }] }); } catch (e) { if (e.code === 4902) { await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [{ chainId: '0x89', chainName: 'Polygon', nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 }, rpcUrls: ['https://polygon-rpc.com/'], blockExplorerUrls: ['https://polygonscan.com/'] }] }); } } }

    setShopView(view) { this.shopViewMode = view; document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active')); event.currentTarget.classList.add('active'); this.renderShop(); }

    async fetchUserAssets() {
        if (!this.user || !this.contracts.mining) return;
        this.userMachines = []; this.userBatteries = [];
        let machineCount = 0;
        try { machineCount = Number(await this.contracts.mining.getUserMachineCount(this.user)); } catch(e) { try { machineCount = Number(await this.contracts.mining.userMachineCount(this.user)); } catch(e2) { machineCount = 0; } }
        for (let i = 0; i < machineCount; i++) {
            try {
                const m = await this.contracts.mining.userMachines(this.user, i);
                this.userMachines.push({ typeId: Number(m.typeId !== undefined ? m.typeId : m[0]), isPlugged: Boolean(m.isPlugged !== undefined ? m.isPlugged : m[1]), batteryEndTime: Number(m.batteryEndTime !== undefined ? m.batteryEndTime : m[2]), pluggedBatteryType: Number(m.pluggedBatteryType !== undefined ? m.pluggedBatteryType : m[3]) });
            } catch(e) { try { const m = await this.contracts.mining.getMachineInfo(this.user, i); this.userMachines.push({ typeId: Number(m[0]), isPlugged: Boolean(m[1]), batteryEndTime: Number(m[2]), pluggedBatteryType: Number(m[3]) }); } catch(e2) { break; } }
        }
        let batteryCount = 0;
        try { batteryCount = Number(await this.contracts.mining.getUserBatteryCount(this.user)); } catch(e) { try { batteryCount = Number(await this.contracts.mining.userBatteryCount(this.user)); } catch(e2) { batteryCount = 0; } }
        for (let i = 0; i < batteryCount; i++) {
            try {
                const b = await this.contracts.mining.userBatteries(this.user, i);
                this.userBatteries.push({ typeId: Number(b.typeId !== undefined ? b.typeId : b[0]), endTime: Number(b.endTime !== undefined ? b.endTime : b[1]), isUsed: Boolean(b.isUsed !== undefined ? b.isUsed : b[2]) });
            } catch(e) { try { const b = await this.contracts.mining.getBatteryInfo(this.user, i); this.userBatteries.push({ typeId: Number(b[0]), endTime: Number(b[1]), isUsed: Boolean(b[2]) }); } catch(e2) { break; } }
        }
    }

    renderActiveMachines() {
        const c = document.getElementById('active-machines-list'); if (!c) return;
        const now = Math.floor(Date.now() / 1000);
        const active = this.userMachines.filter(m => m.isPlugged && m.batteryEndTime > now);
        if (active.length === 0) { c.innerHTML = `<p class="small-text" style="text-align:center;">${this.t('noActiveMachines')}</p>`; return; }
        let html = '';
        active.forEach(m => {
            const remaining = m.batteryEndTime - now;
            const durationDays = this.getBatteryDuration(m.pluggedBatteryType);
            const totalSec = durationDays * 86400;
            const elapsed = totalSec - remaining;
            const progress = Math.min(Math.max((elapsed / totalSec) * 100, 0), 100);
            const barColor = progress < 60 ? 'green' : (progress < 85 ? 'yellow' : 'red');
            const tierNames = ['MK-I','MK-II','MK-III','MK-IV','MK-V','MK-VI','MK-VII','MK-VIII'];
            html += `<div class="asset-row">${this.getMachineMiniSVG(m.typeId)}<div class="asset-info"><div class="asset-name">${tierNames[m.typeId % tierNames.length]} <span class="status-pill active">● ${this.t('active')}</span></div><div class="asset-detail">${this.t('batteryLabel')}: ${durationDays} ${this.t('days')}</div><div class="battery-bar-wrap"><div class="battery-bar-header"><span class="battery-bar-label">${this.t('timeRemaining')}</span><span class="battery-bar-time ${barColor}">${this.formatTimeRemaining(remaining)}</span></div><div class="battery-bar"><div class="battery-bar-fill ${barColor}" style="width:${progress.toFixed(1)}%"></div></div></div></div></div>`;
        });
        c.innerHTML = html;
    }

    renderUserMachines() {
        const c = document.getElementById('my-machines-list'); if (!c) return;
        if (this.userMachines.length === 0) { c.innerHTML = `<p class="small-text" style="text-align:center;">${this.t('noMachines')}</p>`; return; }
        const now = Math.floor(Date.now() / 1000);
        const tierNames = ['MK-I','MK-II','MK-III','MK-IV','MK-V','MK-VI','MK-VII','MK-VIII'];
        let html = '';
        this.userMachines.forEach((m, idx) => {
            let statusClass, statusText;
            if (m.isPlugged && m.batteryEndTime > now) { statusClass = 'active'; statusText = this.t('active'); }
            else if (m.isPlugged && m.batteryEndTime <= now) { statusClass = 'expired'; statusText = this.t('expired'); }
            else { statusClass = 'inactive'; statusText = this.t('inactive'); }
            const dur = this.getBatteryDuration(m.pluggedBatteryType);
            let batteryHtml = '';
            if (m.isPlugged && m.batteryEndTime > 0) {
                const rem = m.batteryEndTime - now; const tot = dur * 86400; const el = tot - rem; const pr = Math.min(Math.max((el / tot) * 100, 0), 100);
                const bc = rem <= 0 ? 'red' : (pr < 60 ? 'green' : (pr < 85 ? 'yellow' : 'red'));
                batteryHtml = `<div class="battery-bar-wrap"><div class="battery-bar-header"><span class="battery-bar-label">${this.t('batteryLabel')}: ${dur} ${this.t('days')}</span><span class="battery-bar-time ${bc}">${rem > 0 ? this.formatTimeRemaining(rem) : this.t('expired')}</span></div><div class="battery-bar"><div class="battery-bar-fill ${rem <= 0 ? 'gray' : bc}" style="width:${rem <= 0 ? 100 : pr.toFixed(1)}%"></div></div></div>`;
            }
            html += `<div class="asset-row">${this.getMachineMiniSVG(m.typeId)}<div class="asset-info"><div class="asset-name">#${idx} ${tierNames[m.typeId % tierNames.length]} <span class="status-pill ${statusClass}">● ${statusText}</span></div><div class="asset-detail">${m.isPlugged ? this.t('plugged') : this.t('notPlugged')}</div>${batteryHtml}</div></div>`;
        });
        c.innerHTML = html;
    }

    renderUserBatteries() {
        const c = document.getElementById('my-batteries-list'); if (!c) return;
        if (this.userBatteries.length === 0) { c.innerHTML = `<p class="small-text" style="text-align:center;">${this.t('noBatteries')}</p>`; return; }
        const now = Math.floor(Date.now() / 1000); let html = '';
        this.userBatteries.forEach((b, idx) => {
            const dur = this.getBatteryDuration(b.typeId); let statusClass, statusText;
            if (b.isUsed && b.endTime > now) { statusClass = 'active'; statusText = this.t('plugged'); }
            else if (b.isUsed && b.endTime <= now) { statusClass = 'expired'; statusText = this.t('expired'); }
            else { statusClass = 'available'; statusText = this.t('available'); }
            let batteryHtml = '';
            if (b.isUsed && b.endTime > 0) {
                const rem = b.endTime - now; const tot = dur * 86400; const el = tot - rem; const pr = Math.min(Math.max((el / tot) * 100, 0), 100);
                const bc = rem <= 0 ? 'red' : (pr < 60 ? 'green' : (pr < 85 ? 'yellow' : 'red'));
                batteryHtml = `<div class="battery-bar-wrap"><div class="battery-bar-header"><span class="battery-bar-label">${this.t('timeRemaining')}</span><span class="battery-bar-time ${bc}">${rem > 0 ? this.formatTimeRemaining(rem) : this.t('expired')}</span></div><div class="battery-bar"><div class="battery-bar-fill ${rem <= 0 ? 'gray' : bc}" style="width:${rem <= 0 ? 100 : pr.toFixed(1)}%"></div></div></div>`;
            }
            html += `<div class="asset-row"><div style="font-size:1.8rem; flex-shrink:0; width:50px; text-align:center;">🔋</div><div class="asset-info"><div class="asset-name">#${idx} ${dur} ${this.t('days')} <span class="status-pill ${statusClass}">● ${statusText}</span></div>${batteryHtml}</div></div>`;
        });
        c.innerHTML = html;
    }

    async updateData() {
        if (!this.user) return;
        try {
            const rawPower = await this.contracts.mining.getActivePower(this.user);
            try { this.currentMultiplier = await this.contracts.mining.difficultyMultiplier(); } catch(e) {}
            const realPowerBN = (rawPower * this.currentMultiplier) / BigInt(10**18); 
            this.currentRealPower = parseFloat(ethers.formatUnits(realPowerBN, this.ftaDecimals)); 
            const lastClaim = parseInt(localStorage.getItem(this.storageKey));
            const timePassed = Math.floor(Date.now() / 1000) - lastClaim;
            if (this.currentRealPower > 0) {
                if (!this.miningTimer) { this.pendingBalance = this.currentRealPower * timePassed; document.getElementById('val-pending').innerText = this.pendingBalance.toFixed(5); }
                document.getElementById('viz-status').innerText = this.t('miningActive'); document.getElementById('viz-status').style.color = "var(--primary)";
                this.updateVisualizerIntensity(this.currentRealPower); if (!this.miningTimer) this.startMiningCounter();
            } else { this.stopMiningCounter(); document.getElementById('viz-status').innerText = this.t('noMachine'); document.getElementById('viz-status').style.color = "#666"; this.pendingBalance = 0; document.getElementById('val-pending').innerText = "0.00000"; }
            document.getElementById('val-power').innerText = this.formatHashrate(this.currentRealPower);
            const polBal = await this.provider.getBalance(this.user); const usdtBal = await this.contracts.usdt.balanceOf(this.user); const ftaBal = await this.contracts.fta.balanceOf(this.user);
            const pB = parseFloat(ethers.formatUnits(polBal, 18)); const uB = parseFloat(ethers.formatUnits(usdtBal, this.usdtDecimals)); const fB = parseFloat(ethers.formatUnits(ftaBal, this.ftaDecimals));
            document.getElementById('bal-pol-2').innerText = pB.toFixed(4); document.getElementById('bal-usdt-2').innerText = uB.toFixed(2); document.getElementById('bal-fta-2').innerText = fB.toFixed(4);
            const rate = await this.contracts.mining.getCurrentRate();
            this.ftaPriceUsd = parseFloat(ethers.formatUnits(rate, this.ftaDecimals)); 
            document.getElementById('price-pol').innerText = this.formatUsd(this.polPriceUsd); document.getElementById('price-usdt').innerText = this.formatUsd(1.00); document.getElementById('price-fta').innerText = this.formatUsd(this.ftaPriceUsd);
            document.getElementById('bal-pol-2-usd').innerText = '≈ ' + this.formatUsd(pB * this.polPriceUsd); document.getElementById('bal-usdt-2-usd').innerText = '≈ ' + this.formatUsd(uB); document.getElementById('bal-fta-2-usd').innerText = '≈ ' + this.formatUsd(fB * this.ftaPriceUsd);
            document.getElementById('val-total-usd').innerText = this.formatUsd((pB * this.polPriceUsd) + uB + (fB * this.ftaPriceUsd));
            document.getElementById('swap-rate').innerText = this.t('currentRate') + this.ftaPriceUsd.toFixed(6) + this.t('usdtPerFta');
            document.getElementById('swap-bal-from').innerText = parseFloat(ethers.formatUnits(this.swapDirection === 'USDT_TO_FTA' ? usdtBal : ftaBal, this.swapDirection === 'USDT_TO_FTA' ? this.usdtDecimals : this.ftaDecimals)).toFixed(4);
            document.getElementById('swap-bal-to').innerText = parseFloat(ethers.formatUnits(this.swapDirection === 'USDT_TO_FTA' ? ftaBal : usdtBal, this.swapDirection === 'USDT_TO_FTA' ? this.ftaDecimals : this.usdtDecimals)).toFixed(4);
            await this.renderShop();
            await this.fetchUserAssets();
            this.renderActiveMachines(); this.renderUserMachines(); this.renderUserBatteries();
        } catch (e) { console.error("Refresh Error", e); }
    }

    startMiningCounter() { if (this.miningTimer) return; this.miningTimer = setInterval(() => { if (this.currentRealPower > 0) { this.pendingBalance += this.currentRealPower; document.getElementById('val-pending').innerText = this.pendingBalance.toFixed(5); document.getElementById('val-pending').style.color = 'var(--primary)'; setTimeout(() => document.getElementById('val-pending').style.color = 'var(--text)', 500); } }, 1000); }
    stopMiningCounter() { if (this.miningTimer) { clearInterval(this.miningTimer); this.miningTimer = null; } }

    async bindReferrer() { const addr = document.getElementById('ref-address-input').value; if (!ethers.isAddress(addr)) return this.showToast(this.t('invalidAddr'), true); this.setLoader(true, this.t('linking')); try { await (await this.contracts.mining.setReferrer(addr)).wait(); this.showToast(this.t('refLinked')); document.getElementById('ref-address-input').value = ''; } catch(e) { this.showError(e); } this.setLoader(false); }
    setPayMode(mode) { this.payMode = mode; document.getElementById('btn-pay-usdt').classList.toggle('active', mode === 'USDT'); document.getElementById('btn-pay-fta').classList.toggle('active', mode === 'FTA'); this.renderShop(); }

    async renderShop() { if (this.isLoadingShop) return; const c = document.getElementById('shop-list'); if (this.shopViewMode === 'machines') { if (this.shopMachinesData.length === 0) await this.fetchMachines(); this._renderShopMachinesHTML(c); } else { if (this.shopBatteriesData.length === 0) await this.fetchBatteries(); this._renderShopBatteriesHTML(c); } }
    async fetchMachines() { this.isLoadingShop = true; try { const count = await this.contracts.mining.getMachineCount(); const promises = []; for(let i=0; i<count; i++) promises.push(this.contracts.mining.machineTypes(i)); const results = await Promise.all(promises); this.shopMachinesData = []; for(let i=0; i<count; i++) { const data = results[i]; const priceUsdt = parseFloat(ethers.formatUnits(data.price, this.usdtDecimals)); const powerBN = (BigInt(data.power.toString()) * this.currentMultiplier) / BigInt(10**18); const power = parseFloat(ethers.formatUnits(powerBN, this.ftaDecimals)); this.shopMachinesData.push({ price: priceUsdt, power: power, priceRaw: data.price }); } } catch(e) {} this.isLoadingShop = false; }
    async fetchBatteries() { this.isLoadingShop = true; try { const count = await this.contracts.mining.getBatteryCount(); const promises = []; for(let i=0; i<count; i++) promises.push(this.contracts.mining.batteryTypes(i)); const results = await Promise.all(promises); this.shopBatteriesData = []; for(let i=0; i<count; i++) { const data = results[i]; const priceUsdt = parseFloat(ethers.formatUnits(data.price, this.usdtDecimals)); const days = Number(data.duration) / 86400; this.shopBatteriesData.push({ price: priceUsdt, days: days, priceRaw: data.price }); } } catch(e) {} this.isLoadingShop = false; }

    getMachineSVG(tier) {
        const tiers = [
            { name: 'MK-I', gpus: 1, color: '#64748b', accent: '#94a3b8', fans: 1, badge: 'STARTER' },
            { name: 'MK-II', gpus: 2, color: '#3b82f6', accent: '#60a5fa', fans: 1, badge: 'STANDARD' },
            { name: 'MK-III', gpus: 3, color: '#8b5cf6', accent: '#a78bfa', fans: 2, badge: 'ADVANCED' },
            { name: 'MK-IV', gpus: 4, color: '#F0B90B', accent: '#FFD43B', fans: 2, badge: 'PRO' },
            { name: 'MK-V', gpus: 5, color: '#f97316', accent: '#fb923c', fans: 2, badge: 'ELITE' },
            { name: 'MK-VI', gpus: 6, color: '#ef4444', accent: '#f87171', fans: 3, badge: 'ULTRA' },
            { name: 'MK-VII', gpus: 8, color: '#06b6d4', accent: '#22d3ee', fans: 3, badge: 'SUPREME' },
            { name: 'MK-VIII', gpus: 8, color: '#eab308', accent: '#facc15', fans: 4, badge: 'LEGEND' }
        ];
        const t = tiers[tier % tiers.length]; const W = 260, H = 170;
        let gpuHtml = '', fanHtml = '', ledHtml = '', ventHtml = '';
        const gpuW=24, gpuH=48, gpuGap=3, maxGpuW=W-40; let eGpuW=gpuW, eGpuGap=gpuGap; let tGpuW=t.gpus*eGpuW+(t.gpus-1)*eGpuGap;
        if(tGpuW>maxGpuW){eGpuW=Math.floor((maxGpuW-(t.gpus-1)*eGpuGap)/t.gpus);tGpuW=t.gpus*eGpuW+(t.gpus-1)*eGpuGap;}
        const gpuSX=(W-tGpuW)/2, gpuY=22;
        for(let i=0;i<t.gpus;i++){const x=gpuSX+i*(eGpuW+eGpuGap); gpuHtml+=`<rect x="${x}" y="${gpuY}" width="${eGpuW}" height="${gpuH}" rx="2" fill="#080c18" stroke="${t.accent}" stroke-width="0.6" opacity="0.85"/>`; const fC=Math.max(3,Math.floor(eGpuW/4)),fG=(eGpuW-6)/fC; for(let j=0;j<9;j++){const fy=gpuY+5+j*4.5; if(fy+2<gpuY+gpuH-10){for(let f=0;f<fC;f++){gpuHtml+=`<rect x="${x+3+f*fG}" y="${fy}" width="${Math.max(1,fG-1.5)}" height="2" rx="0.5" fill="${t.accent}" opacity="0.12"/>`;}}} const cW=Math.min(10,eGpuW-6); gpuHtml+=`<rect x="${x+(eGpuW-cW)/2}" y="${gpuY+gpuH-11}" width="${cW}" height="7" rx="1.5" fill="${t.color}" opacity="0.35"/>`; gpuHtml+=`<circle cx="${x+eGpuW/2}" cy="${gpuY+3}" r="1" fill="${t.accent}" class="led-pulse" style="animation-delay:${i*0.3}s"/>`; }
        const fanR=14,fanGap=14,tFanW=t.fans*fanR*2+(t.fans-1)*fanGap,fanSX=(W-tFanW)/2,fanY=100;
        for(let i=0;i<t.fans;i++){const cx=fanSX+i*(fanR*2+fanGap)+fanR,cy=fanY; fanHtml+=`<circle cx="${cx}" cy="${cy}" r="${fanR+2}" fill="#060a14" stroke="#2a2a3e" stroke-width="1"/><circle cx="${cx}" cy="${cy}" r="${fanR}" fill="#0a0e1a" stroke="#333" stroke-width="0.8"/><g class="fan-blades" style="transform-origin:${cx}px ${cy}px">`; for(let b=0;b<5;b++){fanHtml+=`<rect x="${cx-1.5}" y="${cy-fanR+3}" width="3" height="${fanR-4}" rx="1.5" fill="#1e293b" transform="rotate(${b*72},${cx},${cy})"/>`;} fanHtml+=`</g><circle cx="${cx}" cy="${cy}" r="3.5" fill="${t.accent}" opacity="0.4"/><circle cx="${cx}" cy="${cy}" r="1.5" fill="${t.accent}" opacity="0.7"/>`; }
        for(let i=0;i<6;i++){const lx=25+i*9; ledHtml+=`<circle cx="${lx}" cy="148" r="1.8" fill="${i===0?'#10b981':(i<3?t.accent:'#334155')}" class="led-pulse" style="animation-delay:${i*0.4}s"/>`; }
        for(let v=0;v<3;v++){ventHtml+=`<rect x="30" y="${138+v*5}" width="${W-60}" height="2" rx="1" fill="#060a14" opacity="0.8"/>`;}
        return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="machine-svg"><defs><linearGradient id="bodyG${tier}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1e293b"/><stop offset="50%" stop-color="#162032"/><stop offset="100%" stop-color="#0f172a"/></linearGradient><linearGradient id="topBar${tier}" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="${t.color}" stop-opacity="0.8"/><stop offset="50%" stop-color="${t.accent}" stop-opacity="1"/><stop offset="100%" stop-color="${t.color}" stop-opacity="0.8"/></linearGradient><filter id="glow${tier}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><ellipse cx="${W/2}" cy="${H-3}" rx="${W/2-30}" ry="10" fill="${t.accent}" opacity="0.06" filter="url(#glow${tier})"/><rect x="12" y="10" width="${W-24}" height="${H-22}" rx="8" fill="url(#bodyG${tier})" stroke="#2a3550" stroke-width="1.2"/><rect x="12" y="10" width="${W-24}" height="4" rx="2" fill="url(#topBar${tier})"/><circle cx="20" cy="18" r="1.5" fill="#334155"/><circle cx="${W-20}" cy="18" r="1.5" fill="#334155"/><circle cx="20" cy="${H-20}" r="1.5" fill="#334155"/><circle cx="${W-20}" cy="${H-20}" r="1.5" fill="#334155"/><text x="${W-22}" y="20" font-family="monospace" font-size="7" font-weight="700" fill="${t.accent}" text-anchor="end" opacity="0.7">${t.name}</text><text x="24" y="20" font-family="sans-serif" font-size="6" font-weight="800" fill="#475569" letter-spacing="1.5">FITIA</text>${gpuHtml}<line x1="28" y1="${gpuY+gpuH+6}" x2="${W-28}" y2="${gpuY+gpuH+6}" stroke="#1e293b" stroke-width="0.8" stroke-dasharray="2,2"/>${fanHtml}${ventHtml}${ledHtml}<circle cx="${W-25}" cy="148" r="3.5" fill="none" stroke="${t.accent}" stroke-width="0.8" opacity="0.5"/><line x1="${W-25}" y1="143.5" x2="${W-25}" y2="146" stroke="${t.accent}" stroke-width="0.8" opacity="0.5"/><rect x="12" y="30" width="3" height="50" rx="1.5" fill="${t.color}" opacity="0.15"/><rect x="${W-15}" y="30" width="3" height="50" rx="1.5" fill="${t.color}" opacity="0.15"/></svg>`;
    }

    getMachineMiniSVG(tier) {
        const colors = ['#64748b','#3b82f6','#8b5cf6','#F0B90B','#f97316','#ef4444','#06b6d4','#eab308'];
        const accents = ['#94a3b8','#60a5fa','#a78bfa','#FFD43B','#fb923c','#f87171','#22d3ee','#facc15'];
        const c = colors[tier % colors.length]; const a = accents[tier % accents.length];
        return `<svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" class="machine-svg-mini"><rect x="2" y="2" width="46" height="46" rx="6" fill="#1e293b" stroke="${c}" stroke-width="1"/><rect x="2" y="2" width="46" height="3" rx="1.5" fill="${c}" opacity="0.6"/><rect x="8" y="10" width="14" height="20" rx="2" fill="#080c18" stroke="${a}" stroke-width="0.5"/><rect x="28" y="10" width="14" height="20" rx="2" fill="#080c18" stroke="${a}" stroke-width="0.5"/><circle cx="21" cy="40" r="6" fill="#0a0e1a" stroke="#333" stroke-width="0.5"/><g class="fan-blades" style="transform-origin:21px 40px"><rect x="19.5" y="34.5" width="3" height="5" rx="1.5" fill="#1e293b" transform="rotate(0,21,40)"/><rect x="19.5" y="34.5" width="3" height="5" rx="1.5" fill="#1e293b" transform="rotate(72,21,40)"/><rect x="19.5" y="34.5" width="3" height="5" rx="1.5" fill="#1e293b" transform="rotate(144,21,40)"/><rect x="19.5" y="34.5" width="3" height="5" rx="1.5" fill="#1e293b" transform="rotate(216,21,40)"/><rect x="19.5" y="34.5" width="3" height="5" rx="1.5" fill="#1e293b" transform="rotate(288,21,40)"/></g><circle cx="21" cy="40" r="2" fill="${a}" opacity="0.6"/><circle cx="37" cy="40" r="6" fill="#0a0e1a" stroke="#333" stroke-width="0.5"/><g class="fan-blades" style="transform-origin:37px 40px"><rect x="35.5" y="34.5" width="3" height="5" rx="1.5" fill="#1e293b" transform="rotate(0,37,40)"/><rect x="35.5" y="34.5" width="3" height="5" rx="1.5" fill="#1e293b" transform="rotate(72,37,40)"/><rect x="35.5" y="34.5" width="3" height="5" rx="1.5" fill="#1e293b" transform="rotate(144,37,40)"/><rect x="35.5" y="34.5" width="3" height="5" rx="1.5" fill="#1e293b" transform="rotate(216,37,40)"/><rect x="35.5" y="34.5" width="3" height="5" rx="1.5" fill="#1e293b" transform="rotate(288,37,40)"/></g><circle cx="37" cy="40" r="2" fill="${a}" opacity="0.6"/></svg>`;
    }

    _renderShopMachinesHTML(c) {
        c.innerHTML = ''; c.style.gridTemplateColumns = '1fr 1fr';
        const badgeColors = ['background:#64748b;color:#fff','background:#3b82f6;color:#fff','background:#8b5cf6;color:#fff','background:#F0B90B;color:#000','background:#f97316;color:#fff','background:#ef4444;color:#fff','background:#06b6d4;color:#000','background:#eab308;color:#000'];
        const badgeNames = ['STARTER','STANDARD','ADVANCED','PRO','ELITE','ULTRA','SUPREME','LEGEND'];
        for (let i = 0; i < this.shopMachinesData.length; i++) {
            const d = this.shopMachinesData[i]; const div = document.createElement('div'); div.className = 'rig-item';
            div.innerHTML = `<span class="tier-badge" style="${badgeColors[i%badgeColors.length]}">${badgeNames[i%badgeNames.length]}</span>${this.getMachineSVG(i)}<span class="rig-name" style="font-size:0.85rem;">${this.t('rig')} ${i + 1}</span><span class="rig-power" style="font-size:0.75rem;">${this.formatHashrate(d.power)}</span><span class="rig-price" style="font-size:1rem;">${d.price.toFixed(2)} $</span><button class="btn-primary" style="padding:8px; font-size:0.75rem; margin-top:6px;" onclick="App.buyMachine(${i})">${this.t('buy')} (${this.payMode})</button>`;
            c.appendChild(div);
        }
    }

    _renderShopBatteriesHTML(c) { c.innerHTML = ''; c.style.gridTemplateColumns = '1fr 1fr 3fr'; const icons = ["🔋", "⚡", "🔌", "💫"]; for(let i=0; i<this.shopBatteriesData.length; i++) { const d = this.shopBatteriesData[i]; const div = document.createElement('div'); div.className = 'battery-shop-item'; div.innerHTML = `<span class="shop-icon" style="font-size: 2rem;">${icons[i%4]}</span><div class="battery-name">${d.days} ${this.t('days')}</div><div class="battery-price">${d.price.toFixed(2)} $</div><button class="btn-primary" style="padding:6px; font-size:0.75rem" onclick="App.buyBattery(${i})">${this.t('buy')} (${this.payMode})</button>`; c.appendChild(div); } }

    async buyMachine(id) { if (!this.user) return this.connect(); this.setLoader(true, `${this.t('buyingMachine')} (${this.payMode})...`); try { const m = this.shopMachinesData[id]; if (this.payMode === 'USDT') { const allow = await this.contracts.usdt.allowance(this.user, CONFIG.MINING); if (allow < m.priceRaw) { this.setLoader(true, this.t('approveUsdt')); await (await this.contracts.usdt.approve(CONFIG.MINING, m.priceRaw)).wait(); } this.setLoader(true, this.t('confirming')); await (await this.contracts.mining.buyMachine(id)).wait(); } else { this.setLoader(true, this.t('calcFta')); const ftaCost = await this.contracts.mining.getFtaCostForUsdtSell(m.priceRaw); const ftaTotal = ftaCost + (ftaCost / 10n); const allow = await this.contracts.fta.allowance(this.user, CONFIG.MINING); if (allow < ftaTotal) { this.setLoader(true, this.t('approveFta')); await (await this.contracts.fta.approve(CONFIG.MINING, ftaTotal)).wait(); } this.setLoader(true, this.t('confirming')); await (await this.contracts.mining.buyMachineWithFTA(id)).wait(); } this.showToast(this.t('machineBought')); this.shopMachinesData = []; this.updateData(); } catch (e) { this.showError(e); } this.setLoader(false); }
    async buyBattery(id) { if (!this.user) return this.connect(); this.setLoader(true, `${this.t('buyingBattery')} (${this.payMode})...`); try { const b = this.shopBatteriesData[id]; if (this.payMode === 'USDT') { const allow = await this.contracts.usdt.allowance(this.user, CONFIG.MINING); if (allow < b.priceRaw) { this.setLoader(true, this.t('approveUsdt')); await (await this.contracts.usdt.approve(CONFIG.MINING, b.priceRaw)).wait(); } this.setLoader(true, this.t('confirming')); await (await this.contracts.mining.buyBattery(id)).wait(); } else { this.setLoader(true, this.t('calcFta')); const ftaCost = await this.contracts.mining.getFtaCostForUsdtSell(b.priceRaw); const ftaTotal = ftaCost + (ftaCost / 10n); const allow = await this.contracts.fta.allowance(this.user, CONFIG.MINING); if (allow < ftaTotal) { this.setLoader(true, this.t('approveFta')); await (await this.contracts.fta.approve(CONFIG.MINING, ftaTotal)).wait(); } this.setLoader(true, this.t('confirming')); await (await this.contracts.mining.buyBatteryWithFTA(id)).wait(); } this.showToast(this.t('batteryBought')); this.shopBatteriesData = []; this.updateData(); } catch (e) { this.showError(e); } this.setLoader(false); }

    async plugInMachine() { const mId = document.getElementById('plug-machine-id').value; const bType = document.getElementById('plug-battery-type').value; if (mId === "" || mId < 0) return this.showToast(this.t('invalidId'), true); this.setLoader(true, this.t('pluggingIn')); try { await (await this.contracts.mining.plugInMachine(mId, bType)).wait(); this.showToast(this.t('pluggedIn')); this.updateData(); } catch(e) { this.showError(e); } this.setLoader(false); }
    
    toggleSwap() { this.swapDirection = this.swapDirection === 'USDT_TO_FTA' ? 'FTA_TO_USDT' : 'USDT_TO_FTA'; document.getElementById('token-from-display').innerText = this.swapDirection === 'USDT_TO_FTA' ? 'USDT' : 'FTA'; document.getElementById('token-to-display').innerText = this.swapDirection === 'USDT_TO_FTA' ? 'FTA' : 'USDT'; document.getElementById('swap-to-in').value = ''; document.getElementById('swap-from-in').value = ''; this.updateData(); }
    
    async calcSwap() { 
        const val = document.getElementById('swap-from-in').value; 
        if (!val || val <= 0) return document.getElementById('swap-to-in').value = ''; 
        const inputVal = parseFloat(val);
        let outVal = 0;
        if (this.ftaPriceUsd > 0) {
            if (this.swapDirection === 'USDT_TO_FTA') {
                outVal = inputVal / this.ftaPriceUsd; // 1 USDT / 0.0125 = 80 FTA
            } else {
                outVal = inputVal * this.ftaPriceUsd; // 1 FTA * 0.0125 = 0.0125 USDT
            }
        }
        document.getElementById('swap-to-in').value = outVal > 0 ? outVal.toFixed(6) : ''; 
    }

    async executeSwap() { const val = document.getElementById('swap-from-in').value; if (!val || val <= 0) return this.showToast(this.t('invalidAmount'), true); this.setLoader(true, this.t('swapping')); const isUsdtTo = this.swapDirection === 'USDT_TO_FTA'; const decimals = isUsdtTo ? this.usdtDecimals : this.ftaDecimals; const amount = ethers.parseUnits(val, decimals); try { const tokenContract = isUsdtTo ? this.contracts.usdt : this.contracts.fta; const allowance = await tokenContract.allowance(this.user, CONFIG.MINING); if (allowance < amount) { this.setLoader(true, this.t(isUsdtTo ? 'approveUsdt' : 'approveFta')); await (await tokenContract.approve(CONFIG.MINING, amount)).wait(); } this.setLoader(true, this.t('confirming')); const tx = isUsdtTo ? await this.contracts.mining.swapUsdtForFta(amount) : await this.contracts.mining.swapFtaForUsdt(amount); await tx.wait(); this.showToast(this.t('swapSuccess')); document.getElementById('swap-from-in').value = ''; document.getElementById('swap-to-in').value = ''; this.updateData(); } catch(e) { this.showError(e); } this.setLoader(false); }
    async claim() { if (!this.user) return; this.stopMiningCounter(); this.setLoader(true, this.t('claiming')); try { await (await this.contracts.mining.claimRewards()).wait(); this.pendingBalance = 0; localStorage.setItem(this.storageKey, Math.floor(Date.now() / 1000)); this.showToast(this.t('claimed')); this.updateData(); if (this.currentRealPower > 0) this.startMiningCounter(); } catch(e) { this.showError(e); this.startMiningCounter(); } this.setLoader(false); }

    openSend(tokenSymbol) { this.sendTokenSymbol = tokenSymbol; document.getElementById('send-token-name').innerText = tokenSymbol; document.getElementById('send-to-address').value = ''; document.getElementById('send-amount').value = ''; let balId = 'bal-pol-2'; if(tokenSymbol === 'USDT') balId = 'bal-usdt-2'; if(tokenSymbol === 'FTA') balId = 'bal-fta-2'; document.getElementById('send-bal').innerText = document.getElementById(balId).innerText; document.getElementById('modal-send').classList.add('active'); }
    openReceive() { if(!this.user) return this.showToast(this.t('connFirst'), true); document.getElementById('receive-addr-display').innerText = this.user; document.getElementById('modal-receive').classList.add('active'); }
    closeModals() { document.getElementById('modal-send').classList.remove('active'); document.getElementById('modal-receive').classList.remove('active'); }
    copyReceiveAddress() { navigator.clipboard.writeText(this.user); this.showToast(this.t('addrCopied')); }
    async executeSend() { const toAddress = document.getElementById('send-to-address').value; const amountStr = document.getElementById('send-amount').value; if (!ethers.isAddress(toAddress)) return this.showToast(this.t('invalidAddr'), true); if (!amountStr || Number(amountStr) <= 0) return this.showToast(this.t('invalidAmount'), true); this.setLoader(true, this.t('sending')); try { let tx; if (this.sendTokenSymbol === 'POL') { tx = await this.signer.sendTransaction({ to: toAddress, value: ethers.parseEther(amountStr) }); } else { let contract, decimals; if (this.sendTokenSymbol === 'USDT') { contract = this.contracts.usdt; decimals = this.usdtDecimals; } if (this.sendTokenSymbol === 'FTA') { contract = this.contracts.fta; decimals = this.ftaDecimals; } tx = await contract.transfer(toAddress, ethers.parseUnits(amountStr, decimals)); } await tx.wait(); this.showToast(this.t('sentSuccess')); this.closeModals(); this.updateData(); } catch(e) { this.showError(e); } this.setLoader(false); }

    nav(viewId) { document.querySelectorAll('.view').forEach(el => { el.classList.remove('active'); el.style.display = 'none'; }); const activeView = document.getElementById('view-' + viewId); if(activeView) { activeView.classList.add('active'); activeView.style.display = 'block'; } document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active')); if(event && event.currentTarget) event.currentTarget.classList.add('active'); }

    resizeCanvas() { if(this.vizContext) { const canvas = this.vizContext.canvas; canvas.width = canvas.offsetWidth * 2; canvas.height = canvas.offsetHeight * 2; } }
    initVisualizer() { const canvas = document.getElementById('mining-canvas'); if (!canvas) return; this.resizeCanvas(); this.vizContext = canvas.getContext('2d'); this.vizBars = []; for(let i=0; i<20; i++) this.vizBars.push({ height: 0, targetHeight: 0 }); this.animateVisualizer(); }
    updateVisualizerIntensity(p) { let intensity = p > 0 ? Math.min((p * 500) + 10, 100) : 0; this.vizBars.forEach(bar => bar.targetHeight = (this.vizContext.canvas.height * (intensity/100)) * Math.random()); }
    animateVisualizer() { if(!this.vizContext) return; const ctx = this.vizContext; ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.fillStyle = "#F0B90B"; const w = ctx.canvas.width / 20; this.vizBars.forEach((bar, i) => { bar.height += (bar.targetHeight - bar.height) * 0.1; ctx.fillRect(i * w + 2, ctx.canvas.height - bar.height, w - 4, bar.height); bar.targetHeight += (Math.random() - 0.5) * 10; }); requestAnimationFrame(() => this.animateVisualizer()); }

    setLoader(show, msg="Loading...") { const l = document.getElementById('loader'); document.getElementById('loader-text').innerText = msg; show ? l.classList.remove('hidden') : l.classList.add('hidden'); }
    showError(e) { console.error(e); let msg = this.t('error'); if(e.reason) msg = e.reason; this.showToast(msg, true); }
    showToast(msg, isError=false) { const div = document.createElement('div'); div.className = 'toast'; if (isError) div.style.borderLeftColor = 'var(--danger)'; div.innerText = msg; document.getElementById('toast-container').appendChild(div); setTimeout(() => div.remove(), 4000); }
}

const App = new Application();
window.onload = () => App.init();