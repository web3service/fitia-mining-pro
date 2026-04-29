const CONFIG = {
    MINING: "0xa70147A41F10e84D25A97997d7e2507096F86BAD",
    USDT: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    FTA: "0x5c418b12c7e9c2A8e9A71A68c6d9b319E7B1d1fd",
    CHAIN_ID: 137,
    WC_PROJECT_ID: "2c10ee910a836551fbabbf7c8cc4542a",
    RPC_URL: "https://polygon-rpc.com/"
};

const i18n = {
    en: { connect: "Connect", refTitle: "👥 Referral System", refDesc: "Enter your referrer's address to link.", bindRef: "BIND", power: "POWER", ftaSec: "Hashrate", pending: "PENDING", fta: "FTA", miningActive: "MINING ACTIVE", noMachine: "NO MACHINE", claim: "CLAIM", shopTitle: "⛏️ Shop", machines: "Machines", batteries: "Batteries", buy: "BUY", myAssets: "⚙️ Wallet & Assets", walletBal: "💰 Balances", plugMachine: "🔌 Plug in a machine", plugDesc: "Enter your offline machine ID and choose a battery.", machineId: "Machine ID (0, 1...)", plug: "PLUG IN ⚡", swapTitle: "💱 Swap (AMM)", youPay: "You pay", balance: "Balance:", youReceive: "You receive", swap: "SWAP", loading: "Loading...", currentRate: "Current price: 1 FTA = ", home: "Home", shop: "Shop", assets: "Wallet", swapNav: "Swap", connWallet: "Connecting...", errConn: "Connection Error", linking: "Linking...", wcIdMissing: "WalletConnect ID missing!", refLinked: "Referrer linked successfully!", connFirst: "Connect first", enterRefAddr: "Referrer address (0x...)", buyingMachine: "Buying Machine", approveUsdt: "Approving USDT...", approveFta: "Approving FTA...", confirming: "Confirming...", calcFta: "Calculating FTA price...", machineBought: "Machine purchased!", buyingBattery: "Buying Battery", batteryBought: "Battery purchased!", invalidId: "Invalid Machine ID", pluggingIn: "Plugging in...", pluggedIn: "Machine plugged in successfully! ⚡", invalidAmount: "Invalid amount", swapping: "Swapping...", swapSuccess: "Swap successful!", claiming: "Claiming...", claimed: "Rewards claimed!", error: "Error", days: "Days", rig: "RIG", send: "Send", receive: "Receive", recipientAddr: "Recipient address (0x...)", amount: "Amount", confirmSend: "CONFIRM SEND", sending: "Sending...", sentSuccess: "Sent successfully!", addrCopied: "Address copied!", invalidAddr: "Invalid address", totalBal: "Total Balance", loginSuccess: "Wallet Decrypted!", invalidPass: "Invalid Password", passMatch: "Passwords do not match", passRequired: "Password required (min 8 chars, 1 uppercase, 1 number)", walletCreated: "Wallet Created & Encrypted!" },
    fr: { connect: "Connecter", refTitle: "👥 Système de Parrainage", refDesc: "Entrez l'adresse de votre parrain pour le lier.", bindRef: "LIER", power: "PUISSANCE", ftaSec: "Hashrate", pending: "EN ATTENTE", fta: "FTA", miningActive: "MINAGE ACTIF", noMachine: "AUCUNE MACHINE", claim: "RÉCLAMER", shopTitle: "⛏️ Boutique", machines: "Machines", batteries: "Batteries", buy: "ACHETER", myAssets: "⚙️ Wallet & Actifs", walletBal: "💰 Soldes", plugMachine: "🔌 Brancher une machine", plugDesc: "Entrez l'ID de votre machine éteinte et choisissez une batterie.", machineId: "ID Machine (0, 1...)", plug: "BRANCHER ⚡", swapTitle: "💱 Échange (AMM)", youPay: "Vous payez", balance: "Solde:", youReceive: "Vous recevez", swap: "ÉCHANGER", loading: "Chargement...", currentRate: "Prix actuel: 1 FTA = ", home: "Accueil", shop: "Boutique", assets: "Wallet", swapNav: "Swap", connWallet: "Connexion...", errConn: "Erreur connexion", linking: "Liaison...", wcIdMissing: "ID WalletConnect manquant !", refLinked: "Parrain lié avec succès !", connFirst: "Connectez-vous d'abord", enterRefAddr: "Adresse du parrain (0x...)", buyingMachine: "Achat Machine", approveUsdt: "Approbation USDT...", approveFta: "Approbation FTA...", confirming: "Confirmation...", calcFta: "Calcul du prix FTA...", machineBought: "Machine achetée !", buyingBattery: "Achat Batterie", batteryBought: "Batterie achetée !", invalidId: "ID Machine invalide", pluggingIn: "Branchement...", pluggedIn: "Machine branchée ! ⚡", invalidAmount: "Montant invalide", swapping: "Swap...", swapSuccess: "Échange réussi !", claiming: "Claim...", claimed: "Gains réclamés !", error: "Erreur", days: "Jours", rig: "RIG", send: "Envoyer", receive: "Recevoir", recipientAddr: "Adresse du destinataire (0x...)", amount: "Montant", confirmSend: "CONFIRMER ENVOI", sending: "Envoi...", sentSuccess: "Envoi réussi !", addrCopied: "Adresse copiée !", invalidAddr: "Adresse invalide", totalBal: "Solde Total", loginSuccess: "Portefeuille Décrypté !", invalidPass: "Mot de passe invalide", passMatch: "Les mots de passe ne correspondent pas", passRequired: "Mot de passe requis (min 8 car, 1 maj, 1 chiffre)", walletCreated: "Portefeuille Créé & Chiffré !" },
    de: { connect: "Verbinden", refTitle: "👥 Empfehlungssystem", refDesc: "Geben Sie die Adresse Ihres Empfehlers ein.", bindRef: "BINDEN", power: "LEISTUNG", ftaSec: "Hashrate", pending: "AUSSTEHEND", fta: "FTA", miningActive: "MINING AKTIV", noMachine: "KEINE MASCHINE", claim: "EINFORDERN", shopTitle: "⛏️ Shop", machines: "Maschinen", batteries: "Batterien", buy: "KAUFEN", myAssets: "⚙️ Wallet & Assets", walletBal: "💰 Guthaben", plugMachine: "🔌 Maschine anschließen", plugDesc: "Geben Sie die ID Ihrer Offline-Maschine ein.", machineId: "Maschinen-ID (0, 1...)", plug: "ANSCHLIESSEN ⚡", swapTitle: "💱 Tausch (AMM)", youPay: "Sie zahlen", balance: "Guthaben:", youReceive: "Sie erhalten", swap: "TAUSCHEN", loading: "Laden...", currentRate: "Aktueller Preis: 1 FTA = ", home: "Home", shop: "Shop", assets: "Wallet", swapNav: "Swap", connWallet: "Verbindung...", errConn: "Verbindungsfehler", linking: "Verknüpfung...", wcIdMissing: "WalletConnect-ID fehlt!", refLinked: "Empfehler verknüpft!", connFirst: "Zuerst verbinden", enterRefAddr: "Empfehler-Adresse (0x...)", buyingMachine: "Kaufe Maschine", approveUsdt: "USDT genehmigen...", approveFta: "FTA genehmigen...", confirming: "Bestätigung...", calcFta: "FTA-Preis berechnen...", machineBought: "Maschine gekauft!", buyingBattery: "Kaufe Batterie", batteryBought: "Batterie gekauft!", invalidId: "Ungültige ID", pluggingIn: "Anschließen...", pluggedIn: "Maschine angeschlossen! ⚡", invalidAmount: "Ungültiger Betrag", swapping: "Tauschen...", swapSuccess: "Tausch erfolgreich!", claiming: "Einforderung...", claimed: "Eingefordert!", error: "Fehler", days: "Tage", rig: "RIG", send: "Senden", receive: "Empfangen", recipientAddr: "Empfängeradresse (0x...)", amount: "Betrag", confirmSend: "SENDUNG BESTÄTIGEN", sending: "Senden...", sentSuccess: "Gesendet!", addrCopied: "Kopiert!", invalidAddr: "Ungültige Adresse", totalBal: "Gesamtguthaben", loginSuccess: "Wallet Entschlüsselt!", invalidPass: "Ungültiges Passwort", passMatch: "Passwörter stimmen nicht überein", passRequired: "Passwort erforderlich (min 8 Ziffern, 1 Großbuchstabe, 1 Zahl)", walletCreated: "Wallet Erstellt & Verschlüsselt!" },
    zh: { connect: "连接", refTitle: "👥 推荐系统", refDesc: "输入推荐人地址进行绑定。", bindRef: "绑定", power: "算力", ftaSec: "Hashrate", pending: "待领取", fta: "FTA", miningActive: "挖矿中", noMachine: "无机器", claim: "领取", shopTitle: "⛏️ 商店", machines: "矿机", batteries: "电池", buy: "购买", myAssets: "⚙️ 钱包与资产", walletBal: "💰 余额", plugMachine: "🔌 插入机器", plugDesc: "输入离线机器ID并选择电池。", machineId: "机器ID (0, 1...)", plug: "插入 ⚡", swapTitle: "💱 兑换 (AMM)", youPay: "您支付", balance: "余额:", youReceive: "您收到", swap: "兑换", loading: "加载中...", currentRate: "当前价格: 1 FTA = ", home: "首页", shop: "商店", assets: "钱包", swapNav: "兑换", connWallet: "连接中...", errConn: "连接错误", linking: "绑定中...", wcIdMissing: "缺少 WalletConnect ID！", refLinked: "推荐人绑定成功！", connFirst: "请先连接", enterRefAddr: "推荐人地址 (0x...)", buyingMachine: "购买机器", approveUsdt: "授权 USDT...", approveFta: "授权 FTA...", confirming: "确认中...", calcFta: "计算 FTA 价格...", machineBought: "机器购买成功！", buyingBattery: "购买电池", batteryBought: "电池购买成功！", invalidId: "无效ID", pluggingIn: "插入中...", pluggedIn: "机器插入成功！ ⚡", invalidAmount: "无效金额", swapping: "兑换中...", swapSuccess: "兑换成功！", claiming: "领取中...", claimed: "奖励已领取！", error: "错误", days: "天", rig: "矿机", send: "发送", receive: "接收", recipientAddr: "接收方地址 (0x...)", amount: "金额", confirmSend: "确认发送", sending: "发送中...", sentSuccess: "发送成功！", addrCopied: "地址已复制！", invalidAddr: "无效地址", totalBal: "总余额", loginSuccess: "钱包已解密！", invalidPass: "密码无效", passMatch: "密码不匹配", passRequired: "需要密码（至少8位，1个大写字母，1个数字）", walletCreated: "钱包已创建并加密！" },
    sg: { connect: "Connect", refTitle: "👥 Referral System", refDesc: "Enter your referrer's address to link.", bindRef: "BIND", power: "POWER", ftaSec: "Hashrate", pending: "PENDING", fta: "FTA", miningActive: "MINING ACTIVE", noMachine: "NO MACHINE", claim: "CLAIM", shopTitle: "⛏️ Shop", machines: "Machines", batteries: "Batteries", buy: "BUY", myAssets: "⚙️ Wallet & Assets", walletBal: "💰 Balances", plugMachine: "🔌 Plug in a machine", plugDesc: "Enter your offline machine ID and choose a battery.", machineId: "Machine ID (0, 1...)", plug: "PLUG IN ⚡", swapTitle: "💱 Swap (AMM)", youPay: "You pay", balance: "Balance:", youReceive: "You receive", swap: "SWAP", loading: "Loading...", currentRate: "Current price: 1 FTA = ", home: "Home", shop: "Shop", assets: "Wallet", swapNav: "Swap", connWallet: "Connecting...", errConn: "Connection Error", linking: "Linking...", wcIdMissing: "WalletConnect ID missing!", refLinked: "Referrer linked successfully!", connFirst: "Connect first", enterRefAddr: "Referrer address (0x...)", buyingMachine: "Buying Machine", approveUsdt: "Approving USDT...", approveFta: "Approving FTA...", confirming: "Confirming...", calcFta: "Calculating FTA price...", machineBought: "Machine purchased!", buyingBattery: "Buying Battery", batteryBought: "Battery purchased!", invalidId: "Invalid Machine ID", pluggingIn: "Plugging in...", pluggedIn: "Machine plugged in successfully! ⚡", invalidAmount: "Invalid amount", swapping: "Swapping...", swapSuccess: "Swap successful!", claiming: "Claiming...", claimed: "Rewards claimed!", error: "Error", days: "Days", rig: "RIG", send: "Send", receive: "Receive", recipientAddr: "Recipient address (0x...)", amount: "Amount", confirmSend: "CONFIRM SEND", sending: "Sending...", sentSuccess: "Sent successfully!", addrCopied: "Address copied!", invalidAddr: "Invalid address", totalBal: "Total Balance", loginSuccess: "Wallet Decrypted!", invalidPass: "Invalid Password", passMatch: "Passwords do not match", passRequired: "Password required (min 8 chars, 1 uppercase, 1 number)", walletCreated: "Wallet Created & Encrypted!" }
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
    "function swapUsdtForFta(uint256 amount)", "function swapFtaForUsdt(uint256 amount)"
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
        this.isInternalWallet = false;
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
        const decimals = unitIndex === 0 ? 0 : 2;
        return value.toFixed(decimals) + ' ' + units[unitIndex];
    }

    // --- AUTH SYSTEM ---
    showAuthView(view) {
        document.getElementById('auth-login').style.display = view === 'login' ? 'block' : 'none';
        document.getElementById('auth-register').style.display = view === 'register' ? 'block' : 'none';
        document.getElementById('auth-backup').style.display = view === 'backup' ? 'block' : 'none';
    }

    async register() {
        const pass = document.getElementById('reg-password').value;
        const passConfirm = document.getElementById('reg-password-confirm').value;
        
        // Sécurité : Vérification de la force du mot de passe
        if (pass.length < 8) return this.showToast("Min 8 characters!", true);
        if (!/[A-Z]/.test(pass)) return this.showToast("Needs 1 uppercase letter!", true);
        if (!/[0-9]/.test(pass)) return this.showToast("Needs 1 number!", true);
        if (pass !== passConfirm) return this.showToast(this.t('passMatch'), true);
        
        this.setLoader(true, "Generating Wallet...");
        try {
            const wallet = ethers.Wallet.createRandom();
            const mnemonic = wallet.mnemonic.phrase;
            const address = wallet.address;
            
            const encryptedJson = await wallet.encrypt(pass);
            localStorage.setItem('fitia_enc_wallet', encryptedJson);
            localStorage.setItem('fitia_wallet_addr', address);
            
            document.getElementById('seed-phrase-display').innerText = mnemonic;
            this.showAuthView('backup');
            
            this.showToast(this.t('walletCreated'));
        } catch(e) {
            this.showError(e);
        }
        this.setLoader(false);
    }

    confirmBackup() {
        this.loginWithSavedWallet();
    }

    async login() {
        const pass = document.getElementById('login-password').value;
        if (!pass) return this.showToast(this.t('passRequired'), true);
        this.setLoader(true, "Decrypting...");
        try {
            const encryptedJson = localStorage.getItem('fitia_enc_wallet');
            if (!encryptedJson) throw new Error("No wallet found");
            
            const wallet = await ethers.Wallet.fromEncryptedJson(encryptedJson, pass);
            this.provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
            this.signer = wallet.connect(this.provider);
            this.user = wallet.address;
            this.isInternalWallet = true;

            this.initAppAfterAuth();
            this.showToast(this.t('loginSuccess'));
        } catch(e) {
            this.showToast(this.t('invalidPass'), true);
        }
        this.setLoader(false);
    }

    loginWithSavedWallet() {
        const address = localStorage.getItem('fitia_wallet_addr');
        const encryptedJson = localStorage.getItem('fitia_enc_wallet');
        if (address && encryptedJson) {
            document.getElementById('login-password').value = document.getElementById('reg-password').value;
            this.login();
        }
    }

    logout() {
        this.user = null; this.signer = null; this.provider = null;
        this.stopMiningCounter();
        document.getElementById('auth-container').style.display = 'flex';
        document.getElementById('app-shell').style.display = 'none';
    }

    // --- EXTERNAL WALLET (METAMASK / WC) ---
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
                this.isInternalWallet = false;
                this.initAppAfterAuth();
                window.ethereum.on('accountsChanged', () => window.location.reload());
                window.ethereum.on('chainChanged', () => window.location.reload());
            } catch (e) { this.showToast(this.t('errConn'), true); } this.setLoader(false);
        } else if (typeof EthereumProvider !== 'undefined') {
            this.setLoader(true, this.t('connWallet'));
            try {
                const wcProvider = await EthereumProvider.init({ projectId: CONFIG.WC_PROJECT_ID, chains: [CONFIG.CHAIN_ID], showQrModal: true, methods: ['eth_sendTransaction', 'personal_sign'], metadata: { name: 'FITIA PRO MINER', description: 'Mining DApp', url: window.location.origin, icons: [window.location.origin + '/logo.png'] } });
                await wcProvider.enable();
                this.provider = new ethers.BrowserProvider(wcProvider);
                this.signer = await this.provider.getSigner();
                this.user = await this.signer.getAddress();
                this.isInternalWallet = false;
                this.initAppAfterAuth();
                wcProvider.on("disconnect", () => window.location.reload());
            } catch (e) { this.showToast(this.t('errConn'), true); } this.setLoader(false);
        }
    }

    async switchNetwork() { try { await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x89' }] }); } catch (e) { if (e.code === 4902) { await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [{ chainId: '0x89', chainName: 'Polygon', nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 }, rpcUrls: ['https://polygon-rpc.com/'], blockExplorerUrls: ['https://polygonscan.com/'] }] }); } } }

    // --- APP INIT ---
    async init() { 
        this.setLanguage(this.currentLang); 
        const hasWallet = localStorage.getItem('fitia_enc_wallet');
        if (hasWallet) {
            this.showAuthView('login');
        } else {
            this.showAuthView('register');
        }
    }

    async initAppAfterAuth() {
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('app-shell').style.display = 'flex';
        
        this.contracts.usdt = new ethers.Contract(CONFIG.USDT, ERC20_ABI, this.signer);
        this.contracts.fta = new ethers.Contract(CONFIG.FTA, ERC20_ABI, this.signer);
        this.contracts.mining = new ethers.Contract(CONFIG.MINING, MINING_ABI, this.signer);
        
        try { this.ftaDecimals = await this.contracts.fta.decimals(); } catch(e) { this.ftaDecimals = 18; }
        try { this.usdtDecimals = await this.contracts.usdt.decimals(); } catch(e) { this.usdtDecimals = 6; }

        document.getElementById('btn-connect').classList.add('hidden');
        document.getElementById('wallet-status').classList.remove('hidden');
        document.getElementById('addr-display').innerText = this.user.slice(0,6) + "..." + this.user.slice(38);
        
        if(this.isInternalWallet) {
            document.querySelector('.status-dot').style.background = 'var(--primary)';
            document.querySelector('.status-dot').style.boxShadow = '0 0 10px var(--primary)';
            document.getElementById('wallet-status').onclick = () => { if(confirm('Log out?')) this.logout(); };
        } else {
            document.querySelector('.status-dot').style.background = '#10b981';
            document.querySelector('.status-dot').style.boxShadow = '0 0 10px #10b981';
            document.getElementById('wallet-status').onclick = null;
        }

        if (!localStorage.getItem(this.storageKey)) { localStorage.setItem(this.storageKey, Math.floor(Date.now() / 1000)); }
        
        await this.fetchMarketPrices();
        await this.updateData();
        setInterval(() => this.updateData(), 15000);
        this.initVisualizer();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    async fetchMarketPrices() {
        this.polPriceUsd = 0;
        try {
            const response = await fetch('https://api.dexscreener.com/latest/dex/tokens/0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0');
            const data = await response.json();
            if (data.pairs && data.pairs.length > 0) this.polPriceUsd = parseFloat(data.pairs[0].priceUsd) || 0;
        } catch (e) { console.warn("DexScreener fetch failed", e); }
        if (!this.polPriceUsd || this.polPriceUsd === 0) {
            try {
                const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=matic-network&vs_currencies=usd');
                const data = await response.json();
                this.polPriceUsd = data['matic-network']?.usd || 0;
            } catch (e2) { console.warn("CoinGecko fetch failed", e2); }
        }
        if (!this.polPriceUsd) this.polPriceUsd = 0.70;
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
        document.querySelector('#view-my-rigs .card:nth-child(2) h3').innerText = `🔌 ${this.t('plugMachine')}`;
        document.querySelector('#view-my-rigs .card:nth-child(2) p').innerText = this.t('plugDesc');
        document.getElementById('plug-machine-id').placeholder = this.t('machineId');
        document.querySelector('#view-my-rigs .card:nth-child(2) .btn-primary').innerText = this.t('plug');
        document.querySelector('#view-swap .view-title').innerText = this.t('swapTitle');
        const swapHeaders = document.querySelectorAll('.swap-header span:first-child');
        swapHeaders[0].innerText = this.t('youPay'); swapHeaders[1].innerText = this.t('youReceive');
        document.querySelector('#view-swap .btn-primary').innerText = this.t('swap');
        const navSpans = document.querySelectorAll('.nav-item span');
        navSpans[0].innerText = this.t('home'); navSpans[1].innerText = this.t('shop'); navSpans[2].innerText = this.t('assets'); navSpans[3].innerText = this.t('swapNav');
    }

    setShopView(view) { this.shopViewMode = view; document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active')); event.currentTarget.classList.add('active'); this.renderShop(); }

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
                this.updateVisualizerIntensity(this.currentRealPower);
                if (!this.miningTimer) this.startMiningCounter();
            } else {
                this.stopMiningCounter();
                document.getElementById('viz-status').innerText = this.t('noMachine'); document.getElementById('viz-status').style.color = "#666";
                this.pendingBalance = 0; document.getElementById('val-pending').innerText = "0.00000";
            }
            document.getElementById('val-power').innerText = this.formatHashrate(this.currentRealPower);

            const polBal = await this.provider.getBalance(this.user);
            const usdtBal = await this.contracts.usdt.balanceOf(this.user);
            const ftaBal = await this.contracts.fta.balanceOf(this.user);
            
            const pB = parseFloat(ethers.formatUnits(polBal, 18));
            const uB = parseFloat(ethers.formatUnits(usdtBal, this.usdtDecimals));
            const fB = parseFloat(ethers.formatUnits(ftaBal, this.ftaDecimals));

            document.getElementById('bal-pol-2').innerText = pB.toFixed(4); 
            document.getElementById('bal-usdt-2').innerText = uB.toFixed(2); 
            document.getElementById('bal-fta-2').innerText = fB.toFixed(4);

            const rate = await this.contracts.mining.getCurrentRate();
            this.ftaPriceUsd = parseFloat(ethers.formatUnits(rate, this.ftaDecimals)); 
            
            const polUsdVal = pB * this.polPriceUsd;
            const usdtUsdVal = uB * 1.00;
            const ftaUsdVal = fB * this.ftaPriceUsd;
            
            document.getElementById('price-pol').innerText = this.formatUsd(this.polPriceUsd);
            document.getElementById('price-usdt').innerText = this.formatUsd(1.00);
            document.getElementById('price-fta').innerText = this.formatUsd(this.ftaPriceUsd);

            document.getElementById('bal-pol-2-usd').innerText = '≈ ' + this.formatUsd(polUsdVal);
            document.getElementById('bal-usdt-2-usd').innerText = '≈ ' + this.formatUsd(usdtUsdVal);
            document.getElementById('bal-fta-2-usd').innerText = '≈ ' + this.formatUsd(ftaUsdVal);

            const totalUsdVal = polUsdVal + usdtUsdVal + ftaUsdVal;
            document.getElementById('val-total-usd').innerText = this.formatUsd(totalUsdVal);

            document.getElementById('swap-rate').innerText = this.t('currentRate') + this.ftaPriceUsd.toFixed(6) + " USDT";
            
            const fromBal = this.swapDirection === 'USDT_TO_FTA' ? usdtBal : ftaBal;
            const toBal = this.swapDirection === 'USDT_TO_FTA' ? ftaBal : usdtBal;
            document.getElementById('swap-bal-from').innerText = parseFloat(ethers.formatUnits(fromBal, this.swapDirection === 'USDT_TO_FTA' ? this.usdtDecimals : this.ftaDecimals)).toFixed(2);
            document.getElementById('swap-bal-to').innerText = parseFloat(ethers.formatUnits(toBal, this.swapDirection === 'USDT_TO_FTA' ? this.ftaDecimals : this.usdtDecimals)).toFixed(2);

            await this.renderShop();
        } catch (e) { console.error("Refresh Error", e); }
    }

    startMiningCounter() { if (this.miningTimer) return; this.miningTimer = setInterval(() => { if (this.currentRealPower > 0) { this.pendingBalance += this.currentRealPower; document.getElementById('val-pending').innerText = this.pendingBalance.toFixed(5); document.getElementById('val-pending').style.color = 'var(--primary)'; setTimeout(() => document.getElementById('val-pending').style.color = 'var(--text)', 500); } }, 1000); }
    stopMiningCounter() { if (this.miningTimer) { clearInterval(this.miningTimer); this.miningTimer = null; } }

    async bindReferrer() { const addr = document.getElementById('ref-address-input').value; if (!ethers.isAddress(addr)) return this.showToast(this.t('invalidAddr'), true); this.setLoader(true, this.t('linking')); try { await (await this.contracts.mining.setReferrer(addr)).wait(); this.showToast(this.t('refLinked')); document.getElementById('ref-address-input').value = ''; } catch(e) { this.showError(e); } this.setLoader(false); }
    setPayMode(mode) { this.payMode = mode; document.getElementById('btn-pay-usdt').classList.toggle('active', mode === 'USDT'); document.getElementById('btn-pay-fta').classList.toggle('active', mode === 'FTA'); this.renderShop(); }

    async renderShop() { if (this.isLoadingShop) return; const c = document.getElementById('shop-list'); if (this.shopViewMode === 'machines') { if (this.shopMachinesData.length === 0) await this.fetchMachines(); this._renderShopMachinesHTML(c); } else { if (this.shopBatteriesData.length === 0) await this.fetchBatteries(); this._renderShopBatteriesHTML(c); } }
    async fetchMachines() { this.isLoadingShop = true; try { const count = await this.contracts.mining.getMachineCount(); const promises = []; for(let i=0; i<count; i++) promises.push(this.contracts.mining.machineTypes(i)); const results = await Promise.all(promises); this.shopMachinesData = []; for(let i=0; i<count; i++) { const data = results[i]; const priceUsdt = parseFloat(ethers.formatUnits(data.price, this.usdtDecimals)); const powerBN = (BigInt(data.power.toString()) * this.currentMultiplier) / BigInt(10**18); const power = parseFloat(ethers.formatUnits(powerBN, this.ftaDecimals)); this.shopMachinesData.push({ price: priceUsdt, power: power, priceRaw: data.price }); } } catch(e) {} this.isLoadingShop = false; }
    async fetchBatteries() { this.isLoadingShop = true; try { const count = await this.contracts.mining.getBatteryCount(); const promises = []; for(let i=0; i<count; i++) promises.push(this.contracts.mining.batteryTypes(i)); const results = await Promise.all(promises); this.shopBatteriesData = []; for(let i=0; i<count; i++) { const data = results[i]; const priceUsdt = parseFloat(ethers.formatUnits(data.price, this.usdtDecimals)); const days = Number(data.duration) / 86400; this.shopBatteriesData.push({ price: priceUsdt, days: days, priceRaw: data.price }); } } catch(e) {} this.isLoadingShop = false; }

    _renderShopMachinesHTML(c) { c.innerHTML = ''; c.style.gridTemplateColumns = '1fr 1fr'; const icons = ["💻", "🖥️", "⛏️", "🏭"]; for(let i=0; i<this.shopMachinesData.length; i++) { const d = this.shopMachinesData[i]; const div = document.createElement('div'); div.className = 'rig-item'; div.innerHTML = `<div><span class="shop-icon">${icons[i%4]}</span><span class="rig-name">${this.t('rig')} ${i+1}</span><span class="rig-power">${this.formatHashrate(d.power)}</span></div><div><span class="rig-price">${d.price.toFixed(2)} $</span><button class="btn-primary" style="padding:8px; font-size:0.8rem" onclick="App.buyMachine(${i})">${this.t('buy')} (${this.payMode})</button></div>`; c.appendChild(div); } }
    _renderShopBatteriesHTML(c) { c.innerHTML = ''; c.style.gridTemplateColumns = '1fr 1fr 3fr'; const icons = ["🔋", "⚡", "🔌", "💫"]; for(let i=0; i<this.shopBatteriesData.length; i++) { const d = this.shopBatteriesData[i]; const div = document.createElement('div'); div.className = 'battery-shop-item'; div.innerHTML = `<span class="shop-icon" style="font-size: 2rem;">${icons[i%4]}</span><div class="battery-name">${d.days} ${this.t('days')}</div><div class="battery-price">${d.price.toFixed(2)} $</div><button class="btn-primary" style="padding:6px; font-size:0.75rem" onclick="App.buyBattery(${i})">${this.t('buy')} (${this.payMode})</button>`; c.appendChild(div); } }

    async buyMachine(id) { if (!this.user) return this.connect(); this.setLoader(true, `${this.t('buyingMachine')} (${this.payMode})...`); try { const m = this.shopMachinesData[id]; let tx; if (this.payMode === 'USDT') { const allow = await this.contracts.usdt.allowance(this.user, CONFIG.MINING); if (allow < m.priceRaw) { this.setLoader(true, this.t('approveUsdt')); await (await this.contracts.usdt.approve(CONFIG.MINING, m.priceRaw)).wait(); } this.setLoader(true, this.t('confirming')); tx = await this.contracts.mining.buyMachine(id); } else { this.setLoader(true, this.t('calcFta')); const ftaCost = await this.contracts.mining.getFtaCostForUsdtSell(m.priceRaw); const ftaTotal = ftaCost + (ftaCost / 10n); const allow = await this.contracts.fta.allowance(this.user, CONFIG.MINING); if (allow < ftaTotal) { this.setLoader(true, this.t('approveFta')); await (await this.contracts.fta.approve(CONFIG.MINING, ftaTotal)).wait(); } this.setLoader(true, this.t('confirming')); tx = await this.contracts.mining.buyMachineWithFTA(id); } await tx.wait(); this.showToast(this.t('machineBought')); this.shopMachinesData = []; this.updateData(); } catch (e) { this.showError(e); } this.setLoader(false); }
    async buyBattery(id) { if (!this.user) return this.connect(); this.setLoader(true, `${this.t('buyingBattery')} (${this.payMode})...`); try { const b = this.shopBatteriesData[id]; let tx; if (this.payMode === 'USDT') { const allow = await this.contracts.usdt.allowance(this.user, CONFIG.MINING); if (allow < b.priceRaw) { this.setLoader(true, this.t('approveUsdt')); await (await this.contracts.usdt.approve(CONFIG.MINING, b.priceRaw)).wait(); } this.setLoader(true, this.t('confirming')); tx = await this.contracts.mining.buyBattery(id); } else { this.setLoader(true, this.t('calcFta')); const ftaCost = await this.contracts.mining.getFtaCostForUsdtSell(b.priceRaw); const ftaTotal = ftaCost + (ftaCost / 10n); const allow = await this.contracts.fta.allowance(this.user, CONFIG.MINING); if (allow < ftaTotal) { this.setLoader(true, this.t('approveFta')); await (await this.contracts.fta.approve(CONFIG.MINING, ftaTotal)).wait(); } this.setLoader(true, this.t('confirming')); tx = await this.contracts.mining.buyBatteryWithFTA(id); } await tx.wait(); this.showToast(this.t('batteryBought')); this.shopBatteriesData = []; this.updateData(); } catch (e) { this.showError(e); } this.setLoader(false); }

    async plugInMachine() { const mId = document.getElementById('plug-machine-id').value; const bType = document.getElementById('plug-battery-type').value; if (mId === "" || mId < 0) return this.showToast(this.t('invalidId'), true); this.setLoader(true, this.t('pluggingIn')); try { await (await this.contracts.mining.plugInMachine(mId, bType)).wait(); this.showToast(this.t('pluggedIn')); this.updateData(); } catch(e) { this.showError(e); } this.setLoader(false); }
    
    toggleSwap() { this.swapDirection = this.swapDirection === 'USDT_TO_FTA' ? 'FTA_TO_USDT' : 'USDT_TO_FTA'; document.getElementById('token-from-display').innerText = this.swapDirection === 'USDT_TO_FTA' ? 'USDT' : 'FTA'; document.getElementById('token-to-display').innerText = this.swapDirection === 'USDT_TO_FTA' ? 'FTA' : 'USDT'; document.getElementById('swap-to-in').value = ''; this.updateData(); }
    
    async calcSwap() { 
        const val = document.getElementById('swap-from-in').value; 
        if (!val || val <= 0) return document.getElementById('swap-to-in').value = ''; 
        const isUsdtTo = this.swapDirection === 'USDT_TO_FTA'; 
        const amountNum = parseFloat(val);
        let estimatedOutput = 0;
        try { 
            const decimals = isUsdtTo ? this.usdtDecimals : this.ftaDecimals; 
            const amount = ethers.parseUnits(val, decimals); 
            let output; 
            if (isUsdtTo) { 
                output = await this.contracts.mining.getFtaOutForUsdtBuy(amount); 
                estimatedOutput = parseFloat(ethers.formatUnits(output, this.ftaDecimals));
                if (estimatedOutput < 0.00001 && output > 0) estimatedOutput = parseFloat(ethers.formatUnits(output, this.usdtDecimals));
                if (estimatedOutput <= 0 && amountNum > 0 && this.ftaPriceUsd > 0) estimatedOutput = amountNum / this.ftaPriceUsd;
            } else { 
                output = await this.contracts.mining.getUsdtOutForFtaSell(amount); 
                estimatedOutput = parseFloat(ethers.formatUnits(output, this.usdtDecimals));
                if (estimatedOutput < 0.00001 && output > 0) estimatedOutput = parseFloat(ethers.formatUnits(output, this.ftaDecimals));
                if (estimatedOutput <= 0 && amountNum > 0) estimatedOutput = amountNum * this.ftaPriceUsd;
            } 
        } catch(e) { 
            if (isUsdtTo) { estimatedOutput = this.ftaPriceUsd > 0 ? amountNum / this.ftaPriceUsd : 0; } 
            else { estimatedOutput = amountNum * this.ftaPriceUsd; }
        } 
        document.getElementById('swap-to-in').value = estimatedOutput > 0 ? estimatedOutput.toFixed(5) : '0';
    }

    async executeSwap() { const val = document.getElementById('swap-from-in').value; if (!val || val <= 0) return this.showToast(this.t('invalidAmount'), true); this.setLoader(true, this.t('swapping')); const isUsdtTo = this.swapDirection === 'USDT_TO_FTA'; const decimals = isUsdtTo ? this.usdtDecimals : this.ftaDecimals; const amount = ethers.parseUnits(val, decimals); try { const tokenContract = isUsdtTo ? this.contracts.usdt : this.contracts.fta; const allowance = await tokenContract.allowance(this.user, CONFIG.MINING); if (allowance < amount) { this.setLoader(true, this.t(isUsdtTo ? 'approveUsdt' : 'approveFta')); await (await tokenContract.approve(CONFIG.MINING, amount)).wait(); } this.setLoader(true, this.t('confirming')); const tx = isUsdtTo ? await this.contracts.mining.swapUsdtForFta(amount) : await this.contracts.mining.swapFtaForUsdt(amount); await tx.wait(); this.showToast(this.t('swapSuccess')); document.getElementById('swap-from-in').value = ''; document.getElementById('swap-to-in').value = ''; this.updateData(); } catch(e) { this.showError(e); } this.setLoader(false); }
    
    async claim() { if (!this.user) return; this.stopMiningCounter(); this.setLoader(true, this.t('claiming')); try { await (await this.contracts.mining.claimRewards()).wait(); this.pendingBalance = 0; localStorage.setItem(this.storageKey, Math.floor(Date.now() / 1000)); this.showToast(this.t('claimed')); this.updateData(); if (this.currentRealPower > 0) this.startMiningCounter(); } catch(e) { this.showError(e); this.startMiningCounter(); } this.setLoader(false); }

    openSend(tokenSymbol) { this.sendTokenSymbol = tokenSymbol; document.getElementById('send-token-name').innerText = tokenSymbol; document.getElementById('send-to-address').value = ''; document.getElementById('send-amount').value = ''; let balId = 'bal-pol-2'; if(tokenSymbol === 'USDT') balId = 'bal-usdt-2'; if(tokenSymbol === 'FTA') balId = 'bal-fta-2'; document.getElementById('send-bal').innerText = document.getElementById(balId).innerText; document.getElementById('modal-send').classList.add('active'); }
    openReceive() { if(!this.user) return this.showToast(this.t('connFirst'), true); document.getElementById('receive-addr-display').innerText = this.user; document.getElementById('modal-receive').classList.add('active'); }
    closeModals() { document.getElementById('modal-send').classList.remove('active'); document.getElementById('modal-receive').classList.remove('active'); }
    copyReceiveAddress() { navigator.clipboard.writeText(this.user); this.showToast(this.t('addrCopied')); }
    
    async executeSend() { 
        const toAddress = document.getElementById('send-to-address').value; 
        const amountStr = document.getElementById('send-amount').value; 
        if (!ethers.isAddress(toAddress)) return this.showToast(this.t('invalidAddr'), true); 
        if (!amountStr || Number(amountStr) <= 0) return this.showToast(this.t('invalidAmount'), true); 
        this.setLoader(true, this.t('sending')); 
        try { 
            let tx; 
            if (this.sendTokenSymbol === 'POL') { 
                tx = await this.signer.sendTransaction({ to: toAddress, value: ethers.parseEther(amountStr) });
                await tx.wait();
            } else { 
                let contract, decimals; 
                if (this.sendTokenSymbol === 'USDT') { contract = this.contracts.usdt; decimals = this.usdtDecimals; } 
                if (this.sendTokenSymbol === 'FTA') { contract = this.contracts.fta; decimals = this.ftaDecimals; } 
                tx = await contract.transfer(toAddress, ethers.parseUnits(amountStr, decimals)); 
                await tx.wait();
            } 
            this.showToast(this.t('sentSuccess')); this.closeModals(); this.updateData(); 
        } catch(e) { this.showError(e); } this.setLoader(false); 
    }

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