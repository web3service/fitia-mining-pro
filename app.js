const CONFIG = {
    MINING: "0xa70147A41F10e84D25A97997d7e2507096F86BAD",
    USDT: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    FTA: "0x5c418b12c7e9c2A8e9A71A68c6d9b319E7B1d1fd",
    CHAIN_ID: 137,
    WC_PROJECT_ID: "2c10ee910a836551fbabbf7c8cc4542a",
    OPENAI_API_KEY: ""
};

const i18n = {
    en: { connect: "Connect", refTitle: "👥 Referral System", refDesc: "Enter your referrer's address to link.", bindRef: "BIND", power: "POWER", ftaSec: "Hashrate", pending: "PENDING", fta: "FTA", miningActive: "MINING ACTIVE", noMachine: "NO MACHINE", claim: "CLAIM", shopTitle: "⛏️ Shop", machines: "Machines", batteries: "Batteries", buy: "BUY", myAssets: "⚙️ Wallet & Assets", walletBal: "💰 Balances", plugMachine: "🔌 Plug in a machine", plugDesc: "Enter your offline machine ID and choose a battery.", machineId: "Machine ID (0, 1...)", plug: "PLUG IN ⚡", swapTitle: "💱 Swap", youPay: "You pay", balance: "Balance:", youReceive: "You receive", swap: "SWAP", loading: "Loading...", currentRate: "1 FTA = ", home: "Home", shop: "Shop", assets: "Wallet", swapNav: "Swap", connWallet: "Connecting...", errConn: "Connection Error", linking: "Linking...", wcIdMissing: "WalletConnect ID missing!", refLinked: "Referrer linked!", connFirst: "Connect first", enterRefAddr: "Referrer address (0x...)", buyingMachine: "Buying Machine", approveUsdt: "Approving USDT...", approveFta: "Approving FTA...", confirming: "Confirming...", calcFta: "Calculating price...", machineBought: "Machine purchased!", buyingBattery: "Buying Battery", batteryBought: "Battery purchased!", invalidId: "Invalid Machine ID", pluggingIn: "Plugging in...", pluggedIn: "Machine plugged in! ⚡", invalidAmount: "Invalid amount", swapping: "Swapping...", swapSuccess: "Swap successful!", claiming: "Claiming...", claimed: "Rewards claimed!", error: "Error", days: "Days", rig: "RIG", send: "Send", receive: "Receive", recipientAddr: "Recipient address (0x...)", amount: "Amount", confirmSend: "CONFIRM SEND", sending: "Sending...", sentSuccess: "Sent successfully!", addrCopied: "Address copied!", invalidAddr: "Invalid address", totalBal: "Total Balance", activeMachines: "⛏️ Active Machines", myMachines: "⛏️ My Machines", myBatteries: "🔋 My Batteries", active: "Active", expired: "Expired", inactive: "Inactive", available: "Available", plugged: "Plugged", notPlugged: "Not Plugged", timeRemaining: "Remaining", noMachines: "No machines yet", noBatteries: "No batteries yet", batteryLabel: "Battery", usdtPerFta: " USDT", noActiveMachines: "No active machines", exchangeRate: "Exchange Rate", priceImpact: "Price Impact", swapFee: "Swap Fee (0.3%)", minimumReceived: "Minimum Received", slippageTolerance: "Slippage Tolerance", networkFee: "Network Fee", errRejected: "Transaction cancelled", errInsufficientFunds: "Insufficient balance", errNetwork: "Network error. Please try again.", errTimeout: "Transaction timed out. Please try again.", errContract: "Transaction failed. Please try again.", errGeneric: "An error occurred. Please try again.", errAlreadyPending: "A transaction is already pending. Please wait.", errNonce: "Transaction nonce error. Please restart the app." },
    fr: { connect: "Connecter", refTitle: "👥 Parrainage", refDesc: "Entrez l'adresse de votre parrain.", bindRef: "LIER", power: "PUISSANCE", ftaSec: "Hashrate", pending: "EN ATTENTE", fta: "FTA", miningActive: "MINAGE ACTIF", noMachine: "AUCUNE MACHINE", claim: "RÉCLAMER", shopTitle: "⛏️ Boutique", machines: "Machines", batteries: "Batteries", buy: "ACHETER", myAssets: "⚙️ Wallet & Actifs", walletBal: "💰 Soldes", plugMachine: "🔌 Brancher une machine", plugDesc: "Entrez l'ID de votre machine.", machineId: "ID Machine (0, 1...)", plug: "BRANCHER ⚡", swapTitle: "💱 Échange", youPay: "Vous payez", balance: "Solde:", youReceive: "Vous recevez", swap: "ÉCHANGER", loading: "Chargement...", currentRate: "1 FTA = ", home: "Accueil", shop: "Boutique", assets: "Wallet", swapNav: "Swap", connWallet: "Connexion...", errConn: "Erreur connexion", linking: "Liaison...", wcIdMissing: "ID WalletConnect manquant!", refLinked: "Parrain lié!", connFirst: "Connectez-vous d'abord", enterRefAddr: "Adresse parrain (0x...)", buyingMachine: "Achat Machine", approveUsdt: "Approbation USDT...", approveFta: "Approbation FTA...", confirming: "Confirmation...", calcFta: "Calcul prix...", machineBought: "Machine achetée!", buyingBattery: "Achat Batterie", batteryBought: "Batterie achetée!", invalidId: "ID Machine invalide", pluggingIn: "Branchement...", pluggedIn: "Machine branchée! ⚡", invalidAmount: "Montant invalide", swapping: "Swap...", swapSuccess: "Échange réussi!", claiming: "Claim...", claimed: "Gains réclamés!", error: "Erreur", days: "Jours", rig: "RIG", send: "Envoyer", receive: "Recevoir", recipientAddr: "Adresse destinataire (0x...)", amount: "Montant", confirmSend: "CONFIRMER ENVOI", sending: "Envoi...", sentSuccess: "Envoi réussi!", addrCopied: "Adresse copiée!", invalidAddr: "Adresse invalide", totalBal: "Solde Total", activeMachines: "⛏️ Machines Actives", myMachines: "⛏️ Mes Machines", myBatteries: "🔋 Mes Batteries", active: "Actif", expired: "Expiré", inactive: "Inactif", available: "Disponible", plugged: "Branché", notPlugged: "Non branché", timeRemaining: "Restant", noMachines: "Aucune machine", noBatteries: "Aucune batterie", batteryLabel: "Batterie", usdtPerFta: " USDT", noActiveMachines: "Aucune machine active", exchangeRate: "Taux de change", priceImpact: "Impact prix", swapFee: "Frais swap (0.3%)", minimumReceived: "Minimum reçu", slippageTolerance: "Tolérance slippage", networkFee: "Frais réseau", errRejected: "Transaction annulée", errInsufficientFunds: "Solde insuffisant", errNetwork: "Erreur réseau. Veuillez réessayer.", errTimeout: "Délai expiré. Veuillez réessayer.", errContract: "Transaction échouée. Veuillez réessayer.", errGeneric: "Une erreur est survenue. Veuillez réessayer.", errAlreadyPending: "Une transaction est en cours. Veuillez patienter.", errNonce: "Erreur de nonce. Veuillez redémarrer l'application." },
    de: { connect: "Verbinden", refTitle: "👥 Empfehlung", refDesc: "Empfehler-Adresse eingeben.", bindRef: "BINDEN", power: "LEISTUNG", ftaSec: "Hashrate", pending: "AUSSTEHEND", fta: "FTA", miningActive: "MINING AKTIV", noMachine: "KEINE MASCHINE", claim: "EINFORDERN", shopTitle: "⛏️ Shop", machines: "Maschinen", batteries: "Batterien", buy: "KAUFEN", myAssets: "⚙️ Wallet & Assets", walletBal: "💰 Guthaben", plugMachine: "🔌 Maschine anschließen", plugDesc: "Offline-Maschine ID eingeben.", machineId: "Maschinen-ID (0, 1...)", plug: "ANSCHLIESSEN ⚡", swapTitle: "💱 Tausch", youPay: "Sie zahlen", balance: "Guthaben:", youReceive: "Sie erhalten", swap: "TAUSCHEN", loading: "Laden...", currentRate: "1 FTA = ", home: "Home", shop: "Shop", assets: "Wallet", swapNav: "Swap", connWallet: "Verbindung...", errConn: "Verbindungsfehler", linking: "Verknüpfung...", wcIdMissing: "WalletConnect-ID fehlt!", refLinked: "Empfehler verknüpft!", connFirst: "Zuerst verbinden", enterRefAddr: "Empfehler-Adresse (0x...)", buyingMachine: "Kaufe Maschine", approveUsdt: "USDT genehmigen...", approveFta: "FTA genehmigen...", confirming: "Bestätigung...", calcFta: "Preis berechnen...", machineBought: "Maschine gekauft!", buyingBattery: "Kaufe Batterie", batteryBought: "Batterie gekauft!", invalidId: "Ungültige ID", pluggingIn: "Anschließen...", pluggedIn: "Maschine angeschlossen! ⚡", invalidAmount: "Ungültiger Betrag", swapping: "Tauschen...", swapSuccess: "Tausch erfolgreich!", claiming: "Einforderung...", claimed: "Eingefordert!", error: "Fehler", days: "Tage", rig: "RIG", send: "Senden", receive: "Empfangen", recipientAddr: "Empfängeradresse (0x...)", amount: "Betrag", confirmSend: "SENDUNG BESTÄTIGEN", sending: "Senden...", sentSuccess: "Gesendet!", addrCopied: "Kopiert!", invalidAddr: "Ungültige Adresse", totalBal: "Gesamtguthaben", activeMachines: "⛏️ Aktive Maschinen", myMachines: "⛏️ Meine Maschinen", myBatteries: "🔋 Meine Batterien", active: "Aktiv", expired: "Abgelaufen", inactive: "Inaktiv", available: "Verfügbar", plugged: "Angeschlossen", notPlugged: "Nicht angeschlossen", timeRemaining: "Verbleibend", noMachines: "Keine Maschinen", noBatteries: "Keine Batterien", batteryLabel: "Batterie", usdtPerFta: " USDT", noActiveMachines: "Keine aktive Maschinen", exchangeRate: "Wechselkurs", priceImpact: "Preisauswirkung", swapFee: "Swapgebühr (0.3%)", minimumReceived: "Mindestbetrag", slippageTolerance: "Slippage-Toleranz", networkFee: "Netzwerkgebühr", errRejected: "Transaktion abgebrochen", errInsufficientFunds: "Unzureichendes Guthaben", errNetwork: "Netzwerkfehler. Bitte versuchen Sie es erneut.", errTimeout: "Zeitüberschreitung. Bitte versuchen Sie es erneut.", errContract: "Transaktion fehlgeschlagen. Bitte versuchen Sie es erneut.", errGeneric: "Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.", errAlreadyPending: "Eine Transaktion ist bereits ausstehend. Bitte warten Sie.", errNonce: "Nonce-Fehler. Bitte starten Sie die App neu." },
    zh: { connect: "连接", refTitle: "👥 推荐系统", refDesc: "输入推荐人地址进行绑定。", bindRef: "绑定", power: "算力", ftaSec: "Hashrate", pending: "待领取", fta: "FTA", miningActive: "挖矿中", noMachine: "无机器", claim: "领取", shopTitle: "⛏️ 商店", machines: "矿机", batteries: "电池", buy: "购买", myAssets: "⚙️ 钱包与资产", walletBal: "💰 余额", plugMachine: "🔌 插入机器", plugDesc: "输入离线机器ID并选择电池。", machineId: "机器ID (0, 1...)", plug: "插入 ⚡", swapTitle: "💱 兑换", youPay: "您支付", balance: "余额:", youReceive: "您收到", swap: "兑换", loading: "加载中...", currentRate: "1 FTA = ", home: "首页", shop: "商店", assets: "钱包", swapNav: "兑换", connWallet: "连接中...", errConn: "连接错误", linking: "绑定中...", wcIdMissing: "缺少 WalletConnect ID！", refLinked: "推荐人绑定成功！", connFirst: "请先连接", enterRefAddr: "推荐人地址 (0x...)", buyingMachine: "购买机器", approveUsdt: "授权 USDT...", approveFta: "授权 FTA...", confirming: "确认中...", calcFta: "计算价格...", machineBought: "机器购买成功！", buyingBattery: "购买电池", batteryBought: "电池购买成功！", invalidId: "无效ID", pluggingIn: "插入中...", pluggedIn: "机器插入成功！ ⚡", invalidAmount: "无效金额", swapping: "兑换中...", swapSuccess: "兑换成功！", claiming: "领取中...", claimed: "奖励已领取！", error: "错误", days: "天", rig: "矿机", send: "发送", receive: "接收", recipientAddr: "接收方地址 (0x...)", amount: "金额", confirmSend: "确认发送", sending: "发送中...", sentSuccess: "发送成功！", addrCopied: "地址已复制！", invalidAddr: "无效地址", totalBal: "总余额", activeMachines: "⛏️ 运行中矿机", myMachines: "⛏️ 我的矿机", myBatteries: "🔋 我的电池", active: "运行中", expired: "已过期", inactive: "未激活", available: "可用", plugged: "已插入", notPlugged: "未插入", timeRemaining: "剩余", noMachines: "暂无矿机", noBatteries: "暂无电池", batteryLabel: "电池", usdtPerFta: " USDT", noActiveMachines: "无运行中矿机", exchangeRate: "汇率", priceImpact: "价格影响", swapFee: "手续费 (0.3%)", minimumReceived: "最低收到", slippageTolerance: "滑点容忍度", networkFee: "网络费", errRejected: "交易已取消", errInsufficientFunds: "余额不足", errNetwork: "网络错误，请重试。", errTimeout: "交易超时，请重试。", errContract: "交易失败，请重试。", errGeneric: "发生错误，请重试。", errAlreadyPending: "已有交易待处理，请稍候。", errNonce: "Nonce错误，请重启应用。" },
    sg: { connect: "Connect", refTitle: "👥 Referral System", refDesc: "Enter your referrer's address to link.", bindRef: "BIND", power: "POWER", ftaSec: "Hashrate", pending: "PENDING", fta: "FTA", miningActive: "MINING ACTIVE", noMachine: "NO MACHINE", claim: "CLAIM", shopTitle: "⛏️ Shop", machines: "Machines", batteries: "Batteries", buy: "BUY", myAssets: "⚙️ Wallet & Assets", walletBal: "💰 Balances", plugMachine: "🔌 Plug in a machine", plugDesc: "Enter your offline machine ID and choose a battery.", machineId: "Machine ID (0, 1...)", plug: "PLUG IN ⚡", swapTitle: "💱 Swap", youPay: "You pay", balance: "Balance:", youReceive: "You receive", swap: "SWAP", loading: "Loading...", currentRate: "1 FTA = ", home: "Home", shop: "Shop", assets: "Wallet", swapNav: "Swap", connWallet: "Connecting...", errConn: "Connection Error", linking: "Linking...", wcIdMissing: "WalletConnect ID missing!", refLinked: "Referrer linked!", connFirst: "Connect first", enterRefAddr: "Referrer address (0x...)", buyingMachine: "Buying Machine", approveUsdt: "Approving USDT...", approveFta: "Approving FTA...", confirming: "Confirming...", calcFta: "Calculating price...", machineBought: "Machine purchased!", buyingBattery: "Buying Battery", batteryBought: "Battery purchased!", invalidId: "Invalid Machine ID", pluggingIn: "Plugging in...", pluggedIn: "Machine plugged in! ⚡", invalidAmount: "Invalid amount", swapping: "Swapping...", swapSuccess: "Swap successful!", claiming: "Claiming...", claimed: "Rewards claimed!", error: "Error", days: "Days", rig: "RIG", send: "Send", receive: "Receive", recipientAddr: "Recipient address (0x...)", amount: "Amount", confirmSend: "CONFIRM SEND", sending: "Sending...", sentSuccess: "Sent successfully!", addrCopied: "Address copied!", invalidAddr: "Invalid address", totalBal: "Total Balance", activeMachines: "⛏️ Active Machines", myMachines: "⛏️ My Machines", myBatteries: "🔋 My Batteries", active: "Active", expired: "Expired", inactive: "Inactive", available: "Available", plugged: "Plugged", notPlugged: "Not Plugged", timeRemaining: "Remaining", noMachines: "No machines yet", noBatteries: "No batteries yet", batteryLabel: "Battery", usdtPerFta: " USDT", noActiveMachines: "No active machines", exchangeRate: "Exchange Rate", priceImpact: "Price Impact", swapFee: "Swap Fee (0.3%)", minimumReceived: "Minimum Received", slippageTolerance: "Slippage Tolerance", networkFee: "Network Fee", errRejected: "Transaction cancelled", errInsufficientFunds: "Insufficient balance", errNetwork: "Network error. Please try again.", errTimeout: "Transaction timed out. Please try again.", errContract: "Transaction failed. Please try again.", errGeneric: "An error occurred. Please try again.", errAlreadyPending: "A transaction is already pending. Please wait.", errNonce: "Transaction nonce error. Please restart the app." }
};

const CHAT_INTENTS = {
    greeting: { weight: 2, keywords: { all:['hello','hi','hey','hola'], en:['good morning','good evening','howdy','greetings','sup','whats up'], fr:['bonjour','salut','coucou','bonsoir','yo'], de:['hallo','guten tag','moin','servus'], zh:['你好','您好','嗨','早上好','晚上好'] } },
    goodbye: { weight: 2, keywords: { all:['bye','goodbye','see you'], fr:['au revoir','à bientôt','adieu'], de:['tschüss','auf wiedersehen'], zh:['再见','拜拜'] } },
    thanks: { weight: 2, keywords: { all:['thanks','thank you','thx','ty','merci','danke','谢谢'] } },
    help: { weight: 3, keywords: { all:['help','aide','hilfe','帮助','guide','how to use','what can you do'], en:['assist','support','lost','confused'], fr:['aider','perdu','confus'], de:['anleitung','verloren'], zh:['帮忙','指导','不懂'] } },
    mining: { weight: 2, keywords: { all:['mining','mine','miner','minage','挖矿','hashrate','power','算力'], en:['how to mine','start mining','mining reward'], fr:['comment miner','démarrer minage'], de:['mining starten','mining belohnung'], zh:['如何挖矿','开始挖矿'] } },
    buy_machine: { weight: 3, keywords: { all:['buy machine','acheter machine','kaufen maschine','购买矿机','shop machine','rig'], en:['buy rig','get machine','machine price','best machine'], fr:['quelle machine','prix machine'], de:['maschine kaufen','maschinenpreis'], zh:['买矿机','矿机价格'] } },
    buy_battery: { weight: 3, keywords: { all:['battery','batterie','电池'], en:['buy battery','battery price','battery duration'], fr:['acheter batterie','durée batterie'], de:['batterie kaufen','batteriedauer'], zh:['买电池','电池价格'] } },
    plug_in: { weight: 3, keywords: { all:['plug','activate','brancher','anschließen','插入','connect machine','start machine'], en:['plug in','activate machine','how to start mining'], fr:['brancher machine','activer machine'], de:['maschine aktivieren'], zh:['插入机器','激活矿机'] } },
    claim: { weight: 3, keywords: { all:['claim','reward','réclamer','领取','harvest','withdraw reward'], en:['claim rewards','pending rewards','collect'], fr:['récompenses en attente'], de:['belohnung beanspruchen'], zh:['领取奖励','待领取'] } },
    swap: { weight: 3, keywords: { all:['swap','exchange','échange','tausch','兑换','trade','convert'], en:['swap tokens','exchange rate','swap usdt'], fr:['échanger tokens','taux de change'], de:['token tauschen','wechselkurs'], zh:['兑换代币','汇率'] } },
    wallet: { weight: 2, keywords: { all:['wallet','balance','solde','guthaben','钱包','余额','send','receive'], en:['my balance','send tokens','withdraw'], fr:['mon solde','envoyer tokens'], de:['mein guthaben','tokens senden'], zh:['我的余额','转账'] } },
    referral: { weight: 2, keywords: { all:['referral','parrain','empfehlung','推荐','invite','referrer'], en:['how to refer','referral bonus'], fr:['comment parrainer'], de:['wie empfehlen'], zh:['如何推荐','邀请'] } },
    connect: { weight: 3, keywords: { all:['connect','connexion','verbinden','连接','metamask','walletconnect','login'], en:['connect wallet','link wallet'], fr:['connecter wallet'], de:['wallet verbinden'], zh:['连接钱包'] } },
    what_is_fta: { weight: 2, keywords: { all:['what is fta','was ist fta','fta是什么','about fta','fta token'], en:['explain fta','fta coin'], fr:['c\'est quoi fta'], de:['erkläre fta'], zh:['解释FTA'] } },
    how_it_works: { weight: 2, keywords: { all:['how it works','comment ça marche','wie funktioniert','怎么运作','getting started','beginner'], en:['how does mining work','explain the app','overview'], fr:['guide débutant'], de:['anfängerleitfaden'], zh:['新手指南','如何开始'] } },
    earn_more: { weight: 2, keywords: { all:['earn more','gagner plus','mehr verdienen','赚更多','profit','strategy','passive income'], en:['increase earnings','best strategy','maximize'], fr:['augmenter gains'], de:['einnahmen steigern'], zh:['增加收益','策略'] } },
    price: { weight: 2, keywords: { all:['price','prix','preis','价格','rate','cost'], en:['fta price','machine price','current rate'], fr:['prix fta','combien coûte'], de:['fta preis','aktueller kurs'], zh:['价格','汇率'] } },
    error: { weight: 3, keywords: { all:['error','erreur','fehler','错误','problem','issue','not working','failed'], en:['transaction failed','can\'t buy','can\'t claim','stuck'], fr:['problème','ne marche pas'], de:['problem','funktioniert nicht'], zh:['出错了','不能用','卡住了'] } },
    status: { weight: 2, keywords: { all:['status','état','状态','my mining','current power','my progress'], en:['mining status','am i mining','my hashrate'], fr:['statut minage','mon hashrate'], de:['mining status','mein hashrate'], zh:['挖矿状态','当前算力'] } },
    network: { weight: 2, keywords: { all:['polygon','matic','pol','network','chain','réseau','netzwerk','网络','gas fee'], en:['which network','gas fees'], fr:['quel réseau','frais de gas'], de:['welches netzwerk','gasgebühren'], zh:['哪个网络','矿工费'] } }
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

const SWAP_FEE_RATE = 0.003;
const SLIPPAGE = 0.005;

class Application {
    constructor() {
        this.provider = null; this.signer = null; this.contracts = {}; this.user = null;
        this.payMode = 'USDT'; this.shopViewMode = 'machines';
        this.swapDirection = 'USDT_TO_FTA';
        this.ftaDecimals = 18; this.usdtDecimals = 6;
        this.currentMultiplier = 1n;
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
        this.chatInitialized = false;
        this.chatHistory = [];
    }

    t(key) { return i18n[this.currentLang][key] || i18n['en'][key] || key; }
    formatUsd(v) { return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

    formatHashrate(h) {
        if (h <= 0) return '0 H/s';
        const units = ['nH/s', 'µH/s', 'mH/s', 'H/s', 'KH/s', 'MH/s', 'GH/s', 'TH/s', 'PH/s'];
        const baseIndex = 3;
        let value = h; let unitIndex = baseIndex;
        while (value < 1 && unitIndex > 0) { value *= 1000; unitIndex--; }
        while (value >= 1000 && unitIndex < units.length - 1) { value /= 1000; unitIndex++; }
        return value.toFixed(2) + ' ' + units[unitIndex];
    }

    formatTimeRemaining(s) {
        if (s <= 0) return this.t('expired');
        const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
        if (d > 1) return `${d}d ${h}h`; if (d === 1) return `1d ${h}h`; if (h > 0) return `${h}h ${m}m`; return `${m}m`;
    }

    getBatteryDuration(typeId) {
        if (this.batteryTypeDurations[typeId] !== undefined) return this.batteryTypeDurations[typeId];
        return {0:3,1:7,2:15,3:30,4:90,5:180,6:270,7:365}[typeId] || 30;
    }

    setLanguage(lang) {
        if(!i18n[lang]) return;
        this.currentLang = lang; localStorage.setItem('fitia_lang', lang);
        const flags = {en:'🇬🇧',fr:'🇫🇷',de:'🇩🇪',zh:'🇨🇳',sg:'🇸🇬'};
        document.getElementById('lang-btn-display').innerText = `${flags[lang]} ${lang.toUpperCase()}`;
        this.applyTranslations(); this.renderShop();
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
        const wc = document.querySelectorAll('#view-my-rigs .card');
        if(wc[1]) wc[1].querySelector('.section-title').innerText = this.t('myMachines');
        if(wc[2]) wc[2].querySelector('.section-title').innerText = this.t('myBatteries');
        document.querySelector('#view-swap .view-title').innerText = this.t('swapTitle');
        const sh = document.querySelectorAll('.swap-header span:first-child');
        sh[0].innerText = this.t('youPay'); sh[1].innerText = this.t('youReceive');
        document.querySelector('#view-swap .btn-primary').innerText = this.t('swap');
        document.querySelectorAll('.nav-item span').forEach((s,i) => s.innerText = this.t(['home','shop','assets','swapNav'][i]));
    }

    async init() { this.setLanguage(this.currentLang); }

    async fetchMarketPrices() {
        this.polPriceUsd = 0;
        try { const r = await fetch('https://api.dexscreener.com/latest/dex/tokens/0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0'); const d = await r.json(); if (d.pairs?.length) this.polPriceUsd = parseFloat(d.pairs[0].priceUsd) || 0; } catch(e){}
        if (!this.polPriceUsd) { try { const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=matic-network&vs_currencies=usd'); const d = await r.json(); this.polPriceUsd = d['matic-network']?.usd || 0; } catch(e2){} }
        if (!this.polPriceUsd) this.polPriceUsd = 0.70;
    }

    async connect() {
        if (!CONFIG.WC_PROJECT_ID || CONFIG.WC_PROJECT_ID.includes("...")) { this.showToast(this.t('wcIdMissing'), true); return; }
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
            } catch (e) { this.showError(e); } this.setLoader(false);
        } else if (typeof EthereumProvider !== 'undefined') {
            this.setLoader(true, this.t('connWallet'));
            try {
                const wc = await EthereumProvider.init({ projectId: CONFIG.WC_PROJECT_ID, chains: [CONFIG.CHAIN_ID], showQrModal: true, methods: ['eth_sendTransaction','personal_sign'], metadata: { name: 'FITIA PRO MINER', description: 'Mining DApp', url: window.location.origin, icons: [window.location.origin + '/logo.png'] } });
                await wc.enable(); this.provider = new ethers.BrowserProvider(wc); this.signer = await this.provider.getSigner(); this.user = await this.signer.getAddress(); this.initContracts(); wc.on("disconnect", () => window.location.reload());
            } catch (e) { this.showError(e); } this.setLoader(false);
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
        if (!localStorage.getItem(this.storageKey)) localStorage.setItem(this.storageKey, Math.floor(Date.now() / 1000));
        await this.fetchMarketPrices();
        await this.cacheBatteryDurations();
        await this.updateData();
        setInterval(() => this.updateData(), 15000);
        this.initVisualizer();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    async cacheBatteryDurations() {
        try { const c = await this.contracts.mining.getBatteryCount(); for(let i=0;i<c;i++) { try { const b = await this.contracts.mining.batteryTypes(i); this.batteryTypeDurations[i] = Number(b.duration)/86400; } catch(e){} } } catch(e){}
    }

    async switchNetwork() { try { await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x89' }] }); } catch(e) { if(e.code===4902) await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [{ chainId: '0x89', chainName: 'Polygon', nativeCurrency: {name:'MATIC',symbol:'MATIC',decimals:18}, rpcUrls: ['https://polygon-rpc.com/'], blockExplorerUrls: ['https://polygonscan.com/'] }] }); } }

    setShopView(v) { this.shopViewMode = v; document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active')); event.currentTarget.classList.add('active'); this.renderShop(); }

    async fetchUserAssets() {
        if (!this.user) return;
        this.userMachines = []; this.userBatteries = [];
        let mc = 0;
        try { mc = Number(await this.contracts.mining.getUserMachineCount(this.user)); } catch(e) { try { mc = Number(await this.contracts.mining.userMachineCount(this.user)); } catch(e2){} }
        for (let i = 0; i < mc; i++) {
            try { const m = await this.contracts.mining.userMachines(this.user, i); this.userMachines.push({ typeId: Number(m.typeId ?? m[0]), isPlugged: Boolean(m.isPlugged ?? m[1]), batteryEndTime: Number(m.batteryEndTime ?? m[2]), pluggedBatteryType: Number(m.pluggedBatteryType ?? m[3]) }); }
            catch(e) { try { const m = await this.contracts.mining.getMachineInfo(this.user, i); this.userMachines.push({ typeId: Number(m[0]), isPlugged: Boolean(m[1]), batteryEndTime: Number(m[2]), pluggedBatteryType: Number(m[3]) }); } catch(e2) { break; } }
        }
        let bc = 0;
        try { bc = Number(await this.contracts.mining.getUserBatteryCount(this.user)); } catch(e) { try { bc = Number(await this.contracts.mining.userBatteryCount(this.user)); } catch(e2){} }
        for (let i = 0; i < bc; i++) {
            try { const b = await this.contracts.mining.userBatteries(this.user, i); this.userBatteries.push({ typeId: Number(b.typeId ?? b[0]), endTime: Number(b.endTime ?? b[1]), isUsed: Boolean(b.isUsed ?? b[2]) }); }
            catch(e) { try { const b = await this.contracts.mining.getBatteryInfo(this.user, i); this.userBatteries.push({ typeId: Number(b[0]), endTime: Number(b[1]), isUsed: Boolean(b[2]) }); } catch(e2) { break; } }
        }
    }

    renderActiveMachines() {
        const c = document.getElementById('active-machines-list'); if(!c) return;
        const now = Math.floor(Date.now()/1000);
        const active = this.userMachines.filter(m => m.isPlugged && m.batteryEndTime > now);
        if (!active.length) { c.innerHTML = `<p class="small-text" style="text-align:center;">${this.t('noActiveMachines')}</p>`; return; }
        const tierNames = ['MK-I','MK-II','MK-III','MK-IV','MK-V','MK-VI','MK-VII','MK-VIII'];
        c.innerHTML = active.map(m => {
            const rem = m.batteryEndTime - now, dur = this.getBatteryDuration(m.pluggedBatteryType), tot = dur*86400, el = tot-rem;
            const pr = Math.min(Math.max((el/tot)*100,0),100), bc = pr<60?'green':(pr<85?'yellow':'red');
            return `<div class="asset-row">${this.getMachineMiniSVG(m.typeId)}<div class="asset-info"><div class="asset-name">${tierNames[m.typeId%8]} <span class="status-pill active">● ${this.t('active')}</span></div><div class="asset-detail">${this.t('batteryLabel')}: ${dur} ${this.t('days')}</div><div class="battery-bar-wrap"><div class="battery-bar-header"><span class="battery-bar-label">${this.t('timeRemaining')}</span><span class="battery-bar-time ${bc}">${this.formatTimeRemaining(rem)}</span></div><div class="battery-bar"><div class="battery-bar-fill ${bc}" style="width:${pr.toFixed(1)}%"></div></div></div></div></div>`;
        }).join('');
    }

    renderUserMachines() {
        const c = document.getElementById('my-machines-list'); if(!c) return;
        if (!this.userMachines.length) { c.innerHTML = `<p class="small-text" style="text-align:center;">${this.t('noMachines')}</p>`; return; }
        const now = Math.floor(Date.now()/1000), tierNames = ['MK-I','MK-II','MK-III','MK-IV','MK-V','MK-VI','MK-VII','MK-VIII'];
        c.innerHTML = this.userMachines.map((m,i) => {
            let sc, st;
            if (m.isPlugged && m.batteryEndTime>now) { sc='active'; st=this.t('active'); } else if (m.isPlugged && m.batteryEndTime<=now) { sc='expired'; st=this.t('expired'); } else { sc='inactive'; st=this.t('inactive'); }
            const dur = this.getBatteryDuration(m.pluggedBatteryType);
            let bh = '';
            if (m.isPlugged && m.batteryEndTime>0) {
                const rem=m.batteryEndTime-now, tot=dur*86400, el=tot-rem, pr=Math.min(Math.max((el/tot)*100,0),100);
                const bc=rem<=0?'red':(pr<60?'green':(pr<85?'yellow':'red'));
                bh=`<div class="battery-bar-wrap"><div class="battery-bar-header"><span class="battery-bar-label">${this.t('batteryLabel')}: ${dur} ${this.t('days')}</span><span class="battery-bar-time ${bc}">${rem>0?this.formatTimeRemaining(rem):this.t('expired')}</span></div><div class="battery-bar"><div class="battery-bar-fill ${rem<=0?'gray':bc}" style="width:${rem<=0?100:pr.toFixed(1)}%"></div></div></div>`;
            }
            return `<div class="asset-row">${this.getMachineMiniSVG(m.typeId)}<div class="asset-info"><div class="asset-name">#${i} ${tierNames[m.typeId%8]} <span class="status-pill ${sc}">● ${st}</span></div><div class="asset-detail">${m.isPlugged?this.t('plugged'):this.t('notPlugged')}</div>${bh}</div></div>`;
        }).join('');
    }

    renderUserBatteries() {
        const c = document.getElementById('my-batteries-list'); if(!c) return;
        if (!this.userBatteries.length) { c.innerHTML = `<p class="small-text" style="text-align:center;">${this.t('noBatteries')}</p>`; return; }
        const now = Math.floor(Date.now()/1000);
        c.innerHTML = this.userBatteries.map((b,i) => {
            const dur = this.getBatteryDuration(b.typeId);
            let sc, st;
            if (b.isUsed && b.endTime>now) { sc='active'; st=this.t('plugged'); } else if (b.isUsed && b.endTime<=now) { sc='expired'; st=this.t('expired'); } else { sc='available'; st=this.t('available'); }
            let bh = '';
            if (b.isUsed && b.endTime>0) {
                const rem=b.endTime-now, tot=dur*86400, el=tot-rem, pr=Math.min(Math.max((el/tot)*100,0),100);
                const bc=rem<=0?'red':(pr<60?'green':(pr<85?'yellow':'red'));
                bh=`<div class="battery-bar-wrap"><div class="battery-bar-header"><span class="battery-bar-label">${this.t('timeRemaining')}</span><span class="battery-bar-time ${bc}">${rem>0?this.formatTimeRemaining(rem):this.t('expired')}</span></div><div class="battery-bar"><div class="battery-bar-fill ${rem<=0?'gray':bc}" style="width:${rem<=0?100:pr.toFixed(1)}%"></div></div></div>`;
            }
            return `<div class="asset-row"><div style="font-size:1.8rem;flex-shrink:0;width:50px;text-align:center;">🔋</div><div class="asset-info"><div class="asset-name">#${i} ${dur} ${this.t('days')} <span class="status-pill ${sc}">● ${st}</span></div>${bh}</div></div>`;
        }).join('');
    }

    async updateData() {
        if (!this.user) return;
        try {
            const rawPower = await this.contracts.mining.getActivePower(this.user);
            try { this.currentMultiplier = await this.contracts.mining.difficultyMultiplier(); } catch(e){}
            let realPower;
            const rpRaw = BigInt(rawPower.toString());
            if (this.currentMultiplier > 1n) {
                const rpBN = (rpRaw * this.currentMultiplier) / BigInt(10**18);
                realPower = parseFloat(ethers.formatUnits(rpBN, this.ftaDecimals));
            } else {
                realPower = parseFloat(ethers.formatUnits(rpRaw, this.ftaDecimals));
            }
            this.currentRealPower = realPower;
            
            const lc = parseInt(localStorage.getItem(this.storageKey)), tp = Math.floor(Date.now()/1000) - lc;
            if (this.currentRealPower > 0) {
                if (!this.miningTimer) { this.pendingBalance = this.currentRealPower * tp; document.getElementById('val-pending').innerText = this.pendingBalance.toFixed(5); }
                document.getElementById('viz-status').innerText = this.t('miningActive'); document.getElementById('viz-status').style.color = "var(--primary)";
                this.updateVisualizerIntensity(this.currentRealPower); if(!this.miningTimer) this.startMiningCounter();
            } else { this.stopMiningCounter(); document.getElementById('viz-status').innerText = this.t('noMachine'); document.getElementById('viz-status').style.color = "#666"; this.pendingBalance = 0; document.getElementById('val-pending').innerText = "0.00000"; }
            document.getElementById('val-power').innerText = this.formatHashrate(this.currentRealPower);
            const polBal = await this.provider.getBalance(this.user), usdtBal = await this.contracts.usdt.balanceOf(this.user), ftaBal = await this.contracts.fta.balanceOf(this.user);
            const pB = parseFloat(ethers.formatUnits(polBal,18)), uB = parseFloat(ethers.formatUnits(usdtBal,this.usdtDecimals)), fB = parseFloat(ethers.formatUnits(ftaBal,this.ftaDecimals));
            document.getElementById('bal-pol-2').innerText = pB.toFixed(4); document.getElementById('bal-usdt-2').innerText = uB.toFixed(2); document.getElementById('bal-fta-2').innerText = fB.toFixed(4);
            const rate = await this.contracts.mining.getCurrentRate();
            this.ftaPriceUsd = parseFloat(ethers.formatUnits(rate, this.ftaDecimals));
            document.getElementById('price-pol').innerText = this.formatUsd(this.polPriceUsd); document.getElementById('price-usdt').innerText = this.formatUsd(1); document.getElementById('price-fta').innerText = this.formatUsd(this.ftaPriceUsd);
            document.getElementById('bal-pol-2-usd').innerText = '≈ ' + this.formatUsd(pB*this.polPriceUsd); document.getElementById('bal-usdt-2-usd').innerText = '≈ ' + this.formatUsd(uB); document.getElementById('bal-fta-2-usd').innerText = '≈ ' + this.formatUsd(fB*this.ftaPriceUsd);
            document.getElementById('val-total-usd').innerText = this.formatUsd(pB*this.polPriceUsd + uB + fB*this.ftaPriceUsd);
            document.getElementById('swap-rate').innerText = this.t('currentRate') + this.ftaPriceUsd.toFixed(6) + this.t('usdtPerFta');
            document.getElementById('swap-bal-from').innerText = parseFloat(ethers.formatUnits(this.swapDirection==='USDT_TO_FTA'?usdtBal:ftaBal, this.swapDirection==='USDT_TO_FTA'?this.usdtDecimals:this.ftaDecimals)).toFixed(4);
            document.getElementById('swap-bal-to').innerText = parseFloat(ethers.formatUnits(this.swapDirection==='USDT_TO_FTA'?ftaBal:usdtBal, this.swapDirection==='USDT_TO_FTA'?this.ftaDecimals:this.usdtDecimals)).toFixed(4);
            await this.renderShop();
            await this.fetchUserAssets();
            this.renderActiveMachines(); this.renderUserMachines(); this.renderUserBatteries();
            if (document.getElementById('swap-from-in').value) this.calcSwap();
        } catch(e) { console.error("Refresh Error", e); }
    }

    startMiningCounter() { if(this.miningTimer) return; this.miningTimer = setInterval(() => { if(this.currentRealPower>0) { this.pendingBalance += this.currentRealPower; document.getElementById('val-pending').innerText = this.pendingBalance.toFixed(5); document.getElementById('val-pending').style.color = 'var(--primary)'; setTimeout(() => document.getElementById('val-pending').style.color = 'var(--text)', 500); } }, 1000); }
    stopMiningCounter() { if(this.miningTimer) { clearInterval(this.miningTimer); this.miningTimer = null; } }

    async bindReferrer() { const a = document.getElementById('ref-address-input').value; if(!ethers.isAddress(a)) return this.showToast(this.t('invalidAddr'),true); this.setLoader(true, this.t('linking')); try { await (await this.contracts.mining.setReferrer(a)).wait(); this.showToast(this.t('refLinked')); document.getElementById('ref-address-input').value = ''; } catch(e){this.showError(e);} this.setLoader(false); }
    setPayMode(m) { this.payMode = m; document.getElementById('btn-pay-usdt').classList.toggle('active',m==='USDT'); document.getElementById('btn-pay-fta').classList.toggle('active',m==='FTA'); this.renderShop(); }

    async renderShop() { if(this.isLoadingShop) return; const c = document.getElementById('shop-list'); if(this.shopViewMode==='machines') { if(!this.shopMachinesData.length) await this.fetchMachines(); this._renderShopMachinesHTML(c); } else { if(!this.shopBatteriesData.length) await this.fetchBatteries(); this._renderShopBatteriesHTML(c); } }
    
    async fetchMachines() { 
        this.isLoadingShop=true; 
        try { 
            try { this.currentMultiplier = await this.contracts.mining.difficultyMultiplier(); } catch(e){}
            const c=await this.contracts.mining.getMachineCount(), p=[]; 
            for(let i=0;i<c;i++) p.push(this.contracts.mining.machineTypes(i)); 
            const r=await Promise.all(p); 
            this.shopMachinesData=[]; 
            for(let i=0;i<c;i++) { 
                const d=r[i]; 
                const priceUsdt = parseFloat(ethers.formatUnits(d.price, this.usdtDecimals));
                const rawPower = BigInt(d.power.toString());
                let power;
                if (this.currentMultiplier > 1n) {
                    const powerBN = (rawPower * this.currentMultiplier) / BigInt(10**18);
                    power = parseFloat(ethers.formatUnits(powerBN, this.ftaDecimals));
                } else {
                    power = parseFloat(ethers.formatUnits(rawPower, this.ftaDecimals));
                }
                if (power === 0) { const ep = [1, 5, 20, 100, 500, 2000, 10000, 50000]; power = ep[i % ep.length] || 1; }
                this.shopMachinesData.push({price: priceUsdt, power: power, priceRaw: d.price}); 
            } 
        } catch(e){ console.error("fetchMachines error", e); } 
        this.isLoadingShop=false; 
    }
    
    async fetchBatteries() { this.isLoadingShop=true; try { const c=await this.contracts.mining.getBatteryCount(), p=[]; for(let i=0;i<c;i++) p.push(this.contracts.mining.batteryTypes(i)); const r=await Promise.all(p); this.shopBatteriesData=[]; for(let i=0;i<c;i++) { const d=r[i], pu=parseFloat(ethers.formatUnits(d.price,this.usdtDecimals)), dy=Number(d.duration)/86400; this.shopBatteriesData.push({price:pu,days:dy,priceRaw:d.price}); } } catch(e){} this.isLoadingShop=false; }

    getMachineSVG(tier) {
        const tiers=[{name:'MK-I',gpus:1,color:'#64748b',accent:'#94a3b8',fans:1},{name:'MK-II',gpus:2,color:'#3b82f6',accent:'#60a5fa',fans:1},{name:'MK-III',gpus:3,color:'#8b5cf6',accent:'#a78bfa',fans:2},{name:'MK-IV',gpus:4,color:'#F0B90B',accent:'#FFD43B',fans:2},{name:'MK-V',gpus:5,color:'#f97316',accent:'#fb923c',fans:2},{name:'MK-VI',gpus:6,color:'#ef4444',accent:'#f87171',fans:3},{name:'MK-VII',gpus:8,color:'#06b6d4',accent:'#22d3ee',fans:3},{name:'MK-VIII',gpus:8,color:'#eab308',accent:'#facc15',fans:4}];
        const t=tiers[tier%tiers.length],W=260,H=170;let gpuH='',fanH='',ledH='',ventH='';
        const gpuW=24,gpuH2=48,gG=3,mGW=W-40;let eGW=gpuW,eG=gG,tGW=t.gpus*eGW+(t.gpus-1)*eG;if(tGW>mGW){eGW=Math.floor((mGW-(t.gpus-1)*eG)/t.gpus);tGW=t.gpus*eGW+(t.gpus-1)*eG;}
        const gSX=(W-tGW)/2,gY=22;
        for(let i=0;i<t.gpus;i++){const x=gSX+i*(eGW+eG);gpuH+=`<rect x="${x}" y="${gY}" width="${eGW}" height="${gpuH2}" rx="2" fill="#080c18" stroke="${t.accent}" stroke-width="0.6" opacity="0.85"/>`;const fC=Math.max(3,Math.floor(eGW/4)),fG=(eGW-6)/fC;for(let j=0;j<9;j++){const fy=gY+5+j*4.5;if(fy+2<gY+gpuH2-10){for(let f=0;f<fC;f++){gpuH+=`<rect x="${x+3+f*fG}" y="${fy}" width="${Math.max(1,fG-1.5)}" height="2" rx="0.5" fill="${t.accent}" opacity="0.12"/>`;}}}const cW=Math.min(10,eGW-6);gpuH+=`<rect x="${x+(eGW-cW)/2}" y="${gY+gpuH2-11}" width="${cW}" height="7" rx="1.5" fill="${t.color}" opacity="0.35"/><circle cx="${x+eGW/2}" cy="${gY+3}" r="1" fill="${t.accent}" class="led-pulse" style="animation-delay:${i*0.3}s"/>`;}
        const fR=14,fG2=14,tFW=t.fans*fR*2+(t.fans-1)*fG2,fSX=(W-tFW)/2,fY=100;
        for(let i=0;i<t.fans;i++){const cx=fSX+i*(fR*2+fG2)+fR,cy=fY;fanH+=`<circle cx="${cx}" cy="${cy}" r="${fR+2}" fill="#060a14" stroke="#2a2a3e" stroke-width="1"/><circle cx="${cx}" cy="${cy}" r="${fR}" fill="#0a0e1a" stroke="#333" stroke-width="0.8"/><g class="fan-blades" style="transform-origin:${cx}px ${cy}px">`;for(let b=0;b<5;b++){fanH+=`<rect x="${cx-1.5}" y="${cy-fR+3}" width="3" height="${fR-4}" rx="1.5" fill="#1e293b" transform="rotate(${b*72},${cx},${cy})"/>`;}fanH+=`</g><circle cx="${cx}" cy="${cy}" r="3.5" fill="${t.accent}" opacity="0.4"/><circle cx="${cx}" cy="${cy}" r="1.5" fill="${t.accent}" opacity="0.7"/>`;}
        for(let i=0;i<6;i++){const lx=25+i*9;ledH+=`<circle cx="${lx}" cy="148" r="1.8" fill="${i===0?'#10b981':(i<3?t.accent:'#334155')}" class="led-pulse" style="animation-delay:${i*0.4}s"/>`;}
        for(let v=0;v<3;v++){ventH+=`<rect x="30" y="${138+v*5}" width="${W-60}" height="2" rx="1" fill="#060a14" opacity="0.8"/>`;}
        return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="machine-svg"><defs><linearGradient id="bG${tier}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1e293b"/><stop offset="50%" stop-color="#162032"/><stop offset="100%" stop-color="#0f172a"/></linearGradient><linearGradient id="tB${tier}" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="${t.color}" stop-opacity="0.8"/><stop offset="50%" stop-color="${t.accent}" stop-opacity="1"/><stop offset="100%" stop-color="${t.color}" stop-opacity="0.8"/></linearGradient></defs><ellipse cx="${W/2}" cy="${H-3}" rx="${W/2-30}" ry="10" fill="${t.accent}" opacity="0.06"/><rect x="12" y="10" width="${W-24}" height="${H-22}" rx="8" fill="url(#bG${tier})" stroke="#2a3550" stroke-width="1.2"/><rect x="12" y="10" width="${W-24}" height="4" rx="2" fill="url(#tB${tier})"/><circle cx="20" cy="18" r="1.5" fill="#334155"/><circle cx="${W-20}" cy="18" r="1.5" fill="#334155"/><circle cx="20" cy="${H-20}" r="1.5" fill="#334155"/><circle cx="${W-20}" cy="${H-20}" r="1.5" fill="#334155"/><text x="${W-22}" y="20" font-family="monospace" font-size="7" font-weight="700" fill="${t.accent}" text-anchor="end" opacity="0.7">${t.name}</text><text x="24" y="20" font-family="sans-serif" font-size="6" font-weight="800" fill="#475569" letter-spacing="1.5">FITIA</text>${gpuH}<line x1="28" y1="${gY+gpuH2+6}" x2="${W-28}" y2="${gY+gpuH2+6}" stroke="#1e293b" stroke-width="0.8" stroke-dasharray="2,2"/>${fanH}${ventH}${ledH}<circle cx="${W-25}" cy="148" r="3.5" fill="none" stroke="${t.accent}" stroke-width="0.8" opacity="0.5"/><line x1="${W-25}" y1="143.5" x2="${W-25}" y2="146" stroke="${t.accent}" stroke-width="0.8" opacity="0.5"/><rect x="12" y="30" width="3" height="50" rx="1.5" fill="${t.color}" opacity="0.15"/><rect x="${W-15}" y="30" width="3" height="50" rx="1.5" fill="${t.color}" opacity="0.15"/></svg>`;
    }

    getMachineMiniSVG(tier) {
        const c=['#64748b','#3b82f6','#8b5cf6','#F0B90B','#f97316','#ef4444','#06b6d4','#eab308'][tier%8];
        const a=['#94a3b8','#60a5fa','#a78bfa','#FFD43B','#fb923c','#f87171','#22d3ee','#facc15'][tier%8];
        return `<svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" class="machine-svg-mini"><rect x="2" y="2" width="46" height="46" rx="6" fill="#1e293b" stroke="${c}" stroke-width="1"/><rect x="2" y="2" width="46" height="3" rx="1.5" fill="${c}" opacity="0.6"/><rect x="8" y="10" width="14" height="20" rx="2" fill="#080c18" stroke="${a}" stroke-width="0.5"/><rect x="28" y="10" width="14" height="20" rx="2" fill="#080c18" stroke="${a}" stroke-width="0.5"/><circle cx="21" cy="40" r="6" fill="#0a0e1a" stroke="#333" stroke-width="0.5"/><g class="fan-blades" style="transform-origin:21px 40px"><rect x="19.5" y="34.5" width="3" height="5" rx="1.5" fill="#1e293b" transform="rotate(0,21,40)"/><rect x="19.5" y="34.5" width="3" height="5" rx="1.5" fill="#1e293b" transform="rotate(72,21,40)"/><rect x="19.5" y="34.5" width="3" height="5" rx="1.5" fill="#1e293b" transform="rotate(144,21,40)"/><rect x="19.5" y="34.5" width="3" height="5" rx="1.5" fill="#1e293b" transform="rotate(216,21,40)"/><rect x="19.5" y="34.5" width="3" height="5" rx="1.5" fill="#1e293b" transform="rotate(288,21,40)"/></g><circle cx="21" cy="40" r="2" fill="${a}" opacity="0.6"/><circle cx="37" cy="40" r="6" fill="#0a0e1a" stroke="#333" stroke-width="0.5"/><g class="fan-blades" style="transform-origin:37px 40px"><rect x="35.5" y="34.5" width="3" height="5" rx="1.5" fill="#1e293b" transform="rotate(0,37,40)"/><rect x="35.5" y="34.5" width="3" height="5" rx="1.5" fill="#1e293b" transform="rotate(72,37,40)"/><rect x="35.5" y="34.5" width="3" height="5" rx="1.5" fill="#1e293b" transform="rotate(144,37,40)"/><rect x="35.5" y="34.5" width="3" height="5" rx="1.5" fill="#1e293b" transform="rotate(216,37,40)"/><rect x="35.5" y="34.5" width="3" height="5" rx="1.5" fill="#1e293b" transform="rotate(288,37,40)"/></g><circle cx="37" cy="40" r="2" fill="${a}" opacity="0.6"/></svg>`;
    }

    _renderShopMachinesHTML(c) {
        c.innerHTML='';c.style.gridTemplateColumns='1fr 1fr';
        const bc=['background:#64748b;color:#fff','background:#3b82f6;color:#fff','background:#8b5cf6;color:#fff','background:#F0B90B;color:#000','background:#f97316;color:#fff','background:#ef4444;color:#fff','background:#06b6d4;color:#000','background:#eab308;color:#000'];
        const bn=['STARTER','STANDARD','ADVANCED','PRO','ELITE','ULTRA','SUPREME','LEGEND'];
        for(let i=0;i<this.shopMachinesData.length;i++){const d=this.shopMachinesData[i],div=document.createElement('div');div.className='rig-item';div.innerHTML=`<span class="tier-badge" style="${bc[i%8]}">${bn[i%8]}</span>${this.getMachineSVG(i)}<span class="rig-name" style="font-size:0.85rem;">${this.t('rig')} ${i+1}</span><span class="rig-power" style="font-size:0.75rem;">${this.formatHashrate(d.power)}</span><span class="rig-price" style="font-size:1rem;">${d.price.toFixed(2)} $</span><button class="btn-primary" style="padding:8px;font-size:0.75rem;margin-top:6px;" onclick="App.buyMachine(${i})">${this.t('buy')} (${this.payMode})</button>`;c.appendChild(div);}
    }

    _renderShopBatteriesHTML(c) { c.innerHTML='';c.style.gridTemplateColumns='1fr 1fr 3fr';const ic=["🔋","⚡","🔌","💫"];for(let i=0;i<this.shopBatteriesData.length;i++){const d=this.shopBatteriesData[i],div=document.createElement('div');div.className='battery-shop-item';div.innerHTML=`<span class="shop-icon" style="font-size:2rem;">${ic[i%4]}</span><div class="battery-name">${d.days} ${this.t('days')}</div><div class="battery-price">${d.price.toFixed(2)} $</div><button class="btn-primary" style="padding:6px;font-size:0.75rem" onclick="App.buyBattery(${i})">${this.t('buy')} (${this.payMode})</button>`;c.appendChild(div);} }

    async buyMachine(id) { if(!this.user) return this.connect(); this.setLoader(true,`${this.t('buyingMachine')} (${this.payMode})...`); try { const m=this.shopMachinesData[id]; if(this.payMode==='USDT'){const al=await this.contracts.usdt.allowance(this.user,CONFIG.MINING);if(al<m.priceRaw){this.setLoader(true,this.t('approveUsdt'));await(await this.contracts.usdt.approve(CONFIG.MINING,m.priceRaw)).wait();}this.setLoader(true,this.t('confirming'));await(await this.contracts.mining.buyMachine(id)).wait();}else{this.setLoader(true,this.t('calcFta'));const fc=await this.contracts.mining.getFtaCostForUsdtSell(m.priceRaw),ft=fc+(fc/10n),al=await this.contracts.fta.allowance(this.user,CONFIG.MINING);if(al<ft){this.setLoader(true,this.t('approveFta'));await(await this.contracts.fta.approve(CONFIG.MINING,ft)).wait();}this.setLoader(true,this.t('confirming'));await(await this.contracts.mining.buyMachineWithFTA(id)).wait();} this.showToast(this.t('machineBought'));this.shopMachinesData=[];this.updateData(); } catch(e){this.showError(e);} this.setLoader(false); }
    async buyBattery(id) { if(!this.user) return this.connect(); this.setLoader(true,`${this.t('buyingBattery')} (${this.payMode})...`); try { const b=this.shopBatteriesData[id]; if(this.payMode==='USDT'){const al=await this.contracts.usdt.allowance(this.user,CONFIG.MINING);if(al<b.priceRaw){this.setLoader(true,this.t('approveUsdt'));await(await this.contracts.usdt.approve(CONFIG.MINING,b.priceRaw)).wait();}this.setLoader(true,this.t('confirming'));await(await this.contracts.mining.buyBattery(id)).wait();}else{this.setLoader(true,this.t('calcFta'));const fc=await this.contracts.mining.getFtaCostForUsdtSell(b.priceRaw),ft=fc+(fc/10n),al=await this.contracts.fta.allowance(this.user,CONFIG.MINING);if(al<ft){this.setLoader(true,this.t('approveFta'));await(await this.contracts.fta.approve(CONFIG.MINING,ft)).wait();}this.setLoader(true,this.t('confirming'));await(await this.contracts.mining.buyBatteryWithFTA(id)).wait();} this.showToast(this.t('batteryBought'));this.shopBatteriesData=[];this.updateData(); } catch(e){this.showError(e);} this.setLoader(false); }

    async plugInMachine() { const mI=document.getElementById('plug-machine-id').value,bT=document.getElementById('plug-battery-type').value; if(mI===""||mI<0) return this.showToast(this.t('invalidId'),true); this.setLoader(true,this.t('pluggingIn')); try { await(await this.contracts.mining.plugInMachine(mI,bT)).wait(); this.showToast(this.t('pluggedIn')); this.updateData(); } catch(e){this.showError(e);} this.setLoader(false); }
    
    toggleSwap() { this.swapDirection = this.swapDirection==='USDT_TO_FTA'?'FTA_TO_USDT':'USDT_TO_FTA'; document.getElementById('token-from-display').innerText = this.swapDirection==='USDT_TO_FTA'?'USDT':'FTA'; document.getElementById('token-to-display').innerText = this.swapDirection==='USDT_TO_FTA'?'FTA':'USDT'; document.getElementById('swap-to-in').value=''; document.getElementById('swap-from-in').value=''; document.getElementById('swap-details').classList.add('hidden'); this.updateData(); }
    
    calcSwap() { 
        const val = document.getElementById('swap-from-in').value; 
        if (!val || val <= 0) { document.getElementById('swap-to-in').value = ''; document.getElementById('swap-details').classList.add('hidden'); return; }
        const inputVal = parseFloat(val);
        const isUsdtTo = this.swapDirection === 'USDT_TO_FTA';
        const fee = inputVal * SWAP_FEE_RATE;
        const netInput = inputVal - fee;
        let netOutput = 0;
        if (this.ftaPriceUsd > 0) { netOutput = isUsdtTo ? (netInput / this.ftaPriceUsd) : (netInput * this.ftaPriceUsd); }
        const minReceived = netOutput * (1 - SLIPPAGE);
        document.getElementById('swap-to-in').value = netOutput > 0 ? netOutput.toFixed(6) : '';
        const detailsEl = document.getElementById('swap-details');
        detailsEl.classList.remove('hidden');
        const fromToken = isUsdtTo ? 'USDT' : 'FTA', toToken = isUsdtTo ? 'FTA' : 'USDT';
        document.getElementById('swap-detail-rate').innerText = isUsdtTo ? `1 USDT = ${(1 / this.ftaPriceUsd).toFixed(2)} FTA` : `1 FTA = ${this.ftaPriceUsd.toFixed(6)} USDT`;
        document.getElementById('swap-detail-fee').innerText = `${fee.toFixed(6)} ${fromToken}`;
        document.getElementById('swap-detail-min').innerText = `${minReceived.toFixed(6)} ${toToken}`;
        const gasPol = 0.015;
        document.getElementById('swap-detail-network').innerText = `≈ ${gasPol.toFixed(3)} POL (${this.formatUsd(gasPol * this.polPriceUsd)})`;
    }

    async executeSwap() { 
        const val = document.getElementById('swap-from-in').value; 
        if (!val || val <= 0) return this.showToast(this.t('invalidAmount'), true); 
        this.setLoader(true, this.t('swapping')); 
        const isUsdtTo = this.swapDirection === 'USDT_TO_FTA'; 
        const decimals = isUsdtTo ? this.usdtDecimals : this.ftaDecimals; 
        const amount = ethers.parseUnits(val, decimals); 
        try { 
            const tokenContract = isUsdtTo ? this.contracts.usdt : this.contracts.fta; 
            const allowance = await tokenContract.allowance(this.user, CONFIG.MINING); 
            if (allowance < amount) { this.setLoader(true, this.t(isUsdtTo ? 'approveUsdt' : 'approveFta')); await (await tokenContract.approve(CONFIG.MINING, amount)).wait(); } 
            this.setLoader(true, this.t('confirming')); 
            const tx = isUsdtTo ? await this.contracts.mining.swapUsdtForFta(amount) : await this.contracts.mining.swapFtaForUsdt(amount); 
            await tx.wait(); 
            this.showToast(this.t('swapSuccess')); 
            document.getElementById('swap-from-in').value = ''; document.getElementById('swap-to-in').value = ''; document.getElementById('swap-details').classList.add('hidden');
            this.updateData(); 
        } catch(e) { this.showError(e); } this.setLoader(false); 
    }
    
    async claim() { if(!this.user) return; this.stopMiningCounter(); this.setLoader(true, this.t('claiming')); try { await(await this.contracts.mining.claimRewards()).wait(); this.pendingBalance=0; localStorage.setItem(this.storageKey, Math.floor(Date.now()/1000)); this.showToast(this.t('claimed')); this.updateData(); if(this.currentRealPower>0) this.startMiningCounter(); } catch(e){this.showError(e); this.startMiningCounter();} this.setLoader(false); }

    openSend(ts) { this.sendTokenSymbol=ts; document.getElementById('send-token-name').innerText=ts; document.getElementById('send-to-address').value=''; document.getElementById('send-amount').value=''; let bid='bal-pol-2'; if(ts==='USDT')bid='bal-usdt-2'; if(ts==='FTA')bid='bal-fta-2'; document.getElementById('send-bal').innerText=document.getElementById(bid).innerText; document.getElementById('modal-send').classList.add('active'); }
    openReceive() { if(!this.user) return this.showToast(this.t('connFirst'),true); document.getElementById('receive-addr-display').innerText=this.user; document.getElementById('modal-receive').classList.add('active'); }
    closeModals() { document.getElementById('modal-send').classList.remove('active'); document.getElementById('modal-receive').classList.remove('active'); }
    copyReceiveAddress() { navigator.clipboard.writeText(this.user); this.showToast(this.t('addrCopied')); }
    async executeSend() { const to=document.getElementById('send-to-address').value, amt=document.getElementById('send-amount').value; if(!ethers.isAddress(to)) return this.showToast(this.t('invalidAddr'),true); if(!amt||Number(amt)<=0) return this.showToast(this.t('invalidAmount'),true); this.setLoader(true,this.t('sending')); try { let tx; if(this.sendTokenSymbol==='POL'){tx=await this.signer.sendTransaction({to,value:ethers.parseEther(amt)});}else{let ct,dc;if(this.sendTokenSymbol==='USDT'){ct=this.contracts.usdt;dc=this.usdtDecimals;}if(this.sendTokenSymbol==='FTA'){ct=this.contracts.fta;dc=this.ftaDecimals;}tx=await ct.transfer(to,ethers.parseUnits(amt,dc));} await tx.wait(); this.showToast(this.t('sentSuccess')); this.closeModals(); this.updateData(); } catch(e){this.showError(e);} this.setLoader(false); }

    nav(viewId) { document.querySelectorAll('.view').forEach(el=>{el.classList.remove('active');el.style.display='none';}); const av=document.getElementById('view-'+viewId); if(av){av.classList.add('active');av.style.display='block';} document.querySelectorAll('.nav-item').forEach(el=>el.classList.remove('active')); if(event?.currentTarget) event.currentTarget.classList.add('active'); }

    resizeCanvas() { if(this.vizContext){const c=this.vizContext.canvas;c.width=c.offsetWidth*2;c.height=c.offsetHeight*2;} }
    initVisualizer() { const c=document.getElementById('mining-canvas'); if(!c) return; this.resizeCanvas(); this.vizContext=c.getContext('2d'); this.vizBars=[]; for(let i=0;i<20;i++) this.vizBars.push({height:0,targetHeight:0}); this.animateVisualizer(); }
    updateVisualizerIntensity(p) { let i=p>0?Math.min((p*500)+10,100):0; this.vizBars.forEach(b=>b.targetHeight=(this.vizContext.canvas.height*(i/100))*Math.random()); }
    animateVisualizer() { if(!this.vizContext) return; const ctx=this.vizContext; ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height); ctx.fillStyle="#F0B90B"; const w=ctx.canvas.width/20; this.vizBars.forEach((b,i)=>{b.height+=(b.targetHeight-b.height)*0.1; ctx.fillRect(i*w+2,ctx.canvas.height-b.height,w-4,b.height); b.targetHeight+=(Math.random()-0.5)*10;}); requestAnimationFrame(()=>this.animateVisualizer()); }

    setLoader(show, msg="Processing...") { 
        const l = document.getElementById('loader'); 
        document.getElementById('loader-text').innerText = msg; 
        if (show) { l.classList.remove('hidden'); } else { l.classList.add('hidden'); }
    }

    getErrorMessage(e) {
        const errStr = (e?.message || '').toLowerCase() + ' ' + (e?.code || '').toLowerCase() + ' ' + (e?.reason || '').toLowerCase() + ' ' + (e?.shortMessage || '').toLowerCase();
        const infoErr = (e?.info?.error?.message || '').toLowerCase();
        const combined = errStr + ' ' + infoErr;
        if (combined.includes('user rejected') || combined.includes('user denied') || combined.includes('cancelled by user') || combined.includes('action_rejected') || combined.includes('transaction was rejected') || e?.code === 'ACTION_REJECTED' || e?.code === 4001 || e?.code === -32000 || (e?.info?.error?.code === 4001) || combined.includes('user cancel')) return this.t('errRejected');
        if (combined.includes('insufficient funds') || combined.includes('insufficient balance') || combined.includes('not enough') || combined.includes('underpriced') || combined.includes('exceeds allowance') || combined.includes('erc20: insufficient') || combined.includes('transfer amount exceeds')) return this.t('errInsufficientFunds');
        if (combined.includes('nonce') || combined.includes('already known') || combined.includes('replacement fee too low')) return this.t('errNonce');
        if (combined.includes('already pending') || combined.includes('pending transaction')) return this.t('errAlreadyPending');
        if (combined.includes('timeout') || combined.includes('timed out') || combined.includes('deadline')) return this.t('errTimeout');
        if (combined.includes('network') || combined.includes('fetch') || combined.includes('failed to fetch') || combined.includes('connection') || combined.includes('could not decode') || combined.includes('missing revert data') || combined.includes('call revert exception')) return this.t('errNetwork');
        if (combined.includes('revert') || combined.includes('execution reverted') || combined.includes('vm execution error') || combined.includes('gas required exceeds allowance') || combined.includes('transaction failed')) return this.t('errContract');
        return this.t('errGeneric');
    }

    showError(e) {
        console.error("Transaction Error:", e);
        const msg = this.getErrorMessage(e);
        this.showToast(msg, true);
    }

    showToast(msg, isError=false) { 
        const div = document.createElement('div'); 
        div.className = 'toast' + (isError ? ' toast-error' : ' toast-success'); 
        div.innerText = msg; 
        document.getElementById('toast-container').appendChild(div); 
        setTimeout(() => div.remove(), 4000); 
    }

    // ===== CHAT ASSISTANT =====
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

    removeTyping(id) { const el = document.getElementById(id); if (el) el.remove(); }

    getWelcomeMessage() {
        const m = {
            en: "👋 Hey! I'm your FITIA PRO assistant. I can help you with mining, buying machines & batteries, swapping tokens, wallet operations, and more.\n\nTry asking me:\n• How does mining work?\n• Which machine should I buy?\n• How to plug in a machine?\n• How to swap FTA/USDT?",
            fr: "👋 Salut ! Je suis votre assistant FITIA PRO. Je peux vous aider avec le minage, l'achat de machines et batteries, l'échange de tokens, et plus encore.\n\nEssayez de me demander :\n• Comment fonctionne le minage ?\n• Quelle machine acheter ?\n• Comment brancher une machine ?\n• Comment échanger FTA/USDT ?",
            de: "👋 Hallo! Ich bin dein FITIA PRO Assistent. Ich helfe dir bei Mining, Maschinen- & Batteriekauf, Token-Tausch und mehr.\n\nFrag mich ruhig:\n• Wie funktioniert Mining?\n• Welche Maschine kaufen?\n• Maschine anschließen?\n• FTA/USDT tauschen?",
            zh: "👋 你好！我是你的FITIA PRO助手。我可以帮你了解挖矿、购买矿机和电池、代币兑换等。\n\n试试问我：\n• 挖矿怎么运作？\n• 买哪个矿机好？\n• 如何插入机器？\n• 如何兑换FTA/USDT？",
            sg: "👋 Hey! I'm your FITIA PRO assistant. I can help you with mining, buying machines & batteries, swapping tokens, and more.\n\nTry asking me:\n• How does mining work?\n• Which machine should I buy?\n• How to plug in a machine?\n• How to swap FTA/USDT?"
        };
        return m[this.currentLang] || m.en;
    }

    generateLocalResponse(msg) {
        const m = msg.toLowerCase().replace(/[?!.,;:'"]/g, '').trim();
        const intents = this.detectIntents(m);
        const topIntent = intents.length > 0 ? intents[0].intent : 'unknown';
        return this.craftResponse(topIntent, m);
    }

    detectIntents(m) {
        const scored = [];
        const words = m.split(/\s+/);
        for (const [intent, data] of Object.entries(CHAT_INTENTS)) {
            let score = 0;
            const langKeys = ['all', this.currentLang, 'en'];
            for (const lk of langKeys) {
                if (!data.keywords[lk]) continue;
                for (const kw of data.keywords[lk]) {
                    if (m.includes(kw)) score += (data.weight || 1);
                    else {
                        const kwWords = kw.split(/\s+/);
                        if (kwWords.length > 1) {
                            let partial = 0;
                            for (const w of kwWords) { if (words.includes(w)) partial++; }
                            if (partial > 0) score += (partial / kwWords.length) * (data.weight || 1) * 0.5;
                        }
                    }
                }
            }
            if (score > 0) scored.push({ intent, score });
        }
        scored.sort((a, b) => b.score - a.score);
        return scored;
    }

    craftResponse(intent, userMsg) {
        const L = this.currentLang;
        const conn = !!this.user;
        const machines = this.userMachines || [];
        const batteries = this.userBatteries || [];
        const power = this.currentRealPower || 0;
        const pending = this.pendingBalance || 0;
        const ftaP = this.ftaPriceUsd || 0;
        const activeMachines = machines.filter(m => m.isPlugged && m.batteryEndTime > Math.floor(Date.now()/1000));
        const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

        const R = {
            greeting: {
                en: conn ? [`👋 Hey! Your mining power is at ${this.formatHashrate(power)} with ${activeMachines.length} active machine(s). How can I help?`, `Hello! You have ${pending.toFixed(4)} FTA pending. Anything you'd like to know?`] : [`👋 Welcome! First step: connect your wallet to get started. Need help with anything?`],
                fr: conn ? [`👋 Salut ! Puissance de minage : ${this.formatHashrate(power)}. Comment puis-je aider ?`] : [`👋 Bienvenue ! Connectez votre wallet pour commencer.`],
                de: conn ? [`👋 Hey! Mining-Leistung: ${this.formatHashrate(power)}. Wie kann ich helfen?`] : [`👋 Willkommen! Verbinde zuerst dein Wallet.`],
                zh: conn ? [`👋 你好！算力：${this.formatHashrate(power)}。有什么可以帮你的？`] : [`👋 欢迎！连接钱包开始挖矿。`],
                sg: conn ? [`👋 Hey! Mining power: ${this.formatHashrate(power)}. How can I help?`] : [`👋 Welcome! Connect your wallet to get started.`]
            },
            goodbye: { en: ["👋 See you later! Happy mining!"], fr: ["👋 À bientôt ! Bon minage !"], de: ["👋 Bis bald! Happy Mining!"], zh: ["👋 再见！祝你挖矿愉快！"], sg: ["👋 See you later! Happy mining!"] },
            thanks: { en: ["You're welcome! 😊 Let me know if you need anything else."], fr: ["De rien ! 😊 N'hésitez pas si vous avez d'autres questions."], de: ["Gerne! 😊"], zh: ["不客气！😊 还有其他问题随时问我。"], sg: ["You're welcome! 😊"] },
            help: {
                en: ["🛠️ Here's what I can help with:\n\n⛏️ Mining — How mining works, your hashrate, rewards\n🛒 Shop — Buying machines & batteries\n🔌 Plug In — Activating your machines\n💱 Swap — Exchanging USDT ↔ FTA\n💰 Wallet — Balances, sending, receiving\n👥 Referral — Earning with referrals\n🔧 Troubleshooting — Fixing errors\n\nJust ask me about any of these topics!"],
                fr: ["🛠️ Voici ce dont je peux vous aider :\n\n⛏️ Minage\n🛒 Boutique\n🔌 Branchement\n💱 Échange\n💰 Wallet\n👥 Parrainage\n🔧 Dépannage"],
                de: ["🛠️ Hier ist womit ich helfen kann:\n\n⛏️ Mining\n🛒 Shop\n🔌 Anschließen\n💱 Tausch\n💰 Wallet\n👥 Empfehlung\n🔧 Fehlerbehebung"],
                zh: ["🛠️ 我可以帮助你：\n\n⛏️ 挖矿\n🛒 商店\n🔌 插入\n💱 兑换\n💰 钱包\n👥 推荐\n🔧 故障排除"],
                sg: ["🛠️ I can help with: Mining, Shop, Plug In, Swap, Wallet, Referral, Troubleshooting. Just ask!"]
            },
            mining: {
                en: conn ? [`⛏️ Mining on FITIA PRO:\n\n1️⃣ Buy a machine from the Shop\n2️⃣ Buy a battery (3 to 365 days)\n3️⃣ Plug in your machine with the battery\n4️⃣ Machine mines FTA automatically\n5️⃣ Claim your pending rewards anytime\n\nYour stats:\n• Power: ${this.formatHashrate(power)}\n• Active: ${activeMachines.length}\n• Pending: ${pending.toFixed(5)} FTA`] : [`⛏️ Mining on FITIA PRO:\n\n1️⃣ Connect wallet\n2️⃣ Buy a machine\n3️⃣ Buy a battery\n4️⃣ Plug in\n5️⃣ Mine & Claim FTA`],
                fr: conn ? [`⛏️ Minage FITIA PRO :\n\n1️⃣ Achetez une machine\n2️⃣ Achetez une batterie\n3️⃣ Branchez la machine\n4️⃣ Minage automatique de FTA\n5️⃣ Réclamez vos récompenses\n\nPuissance : ${this.formatHashrate(power)}`] : [`⛏️ Connectez votre wallet pour commencer à miner !`],
                de: conn ? [`⛏️ Mining:\n\n1️⃣ Maschine kaufen\n2️⃣ Batterie kaufen\n3️⃣ Anschließen\n4️⃣ Automatisches Mining\n5️⃣ Belohnungen abholen\n\nLeistung: ${this.formatHashrate(power)}`] : [`⛏️ Verbinde dein Wallet!`],
                zh: conn ? [`⛏️ 挖矿：\n\n1️⃣ 购买矿机\n2️⃣ 购买电池\n3️⃣ 插入矿机\n4️⃣ 自动挖矿\n5️⃣ 领取奖励\n\n算力：${this.formatHashrate(power)}`] : [`⛏️ 请先连接钱包！`],
                sg: conn ? [`⛏️ Mining: Buy machine → Buy battery → Plug in → Mine FTA → Claim rewards.\n\nYour power: ${this.formatHashrate(power)}`] : [`⛏️ Connect wallet to start mining!`]
            },
            buy_machine: { en: conn ? [`🛒 To buy a machine:\n\n1️⃣ Go to Shop tab\n2️⃣ Choose USDT or FTA payment\n3️⃣ Click BUY\n\nHigher tiers = more FTA/sec!`] : [`🛒 Connect your wallet first!`], fr: conn ? [`🛒 Pour acheter : Boutique → Choisir paiement → ACHETER`] : [`🛒 Connectez votre wallet !`], de: conn ? [`🛒 Maschine kaufen: Shop → Zahlung wählen → KAUFEN`] : [`🛒 Verbinde Wallet!`], zh: conn ? [`🛒 购买矿机：商店 → 选择支付 → 购买`] : [`🛒 连接钱包！`], sg: conn ? [`🛒 Buy: Shop tab → Choose payment → BUY`] : [`🛒 Connect wallet!`] },
            buy_battery: { en: conn ? [`🔋 Batteries power your machines for a set duration (3-365 days).\n\n1️⃣ Shop → Batteries tab\n2️⃣ Choose USDT or FTA\n3️⃣ Click BUY\n\n💡 Longer batteries = better value per day!`] : [`🔋 Connect wallet to buy batteries!`], fr: conn ? [`🔋 Batteries : Boutique → Onglet Batteries → ACHETER\nPlus long = meilleur rapport qualité/prix !`] : [`🔋 Connectez-vous !`], de: conn ? [`🔋 Batterien: Shop → Batterien → KAUFEN`] : [`🔋 Verbinde Wallet!`], zh: conn ? [`🔋 电池：商店 → 电池 → 购买\n时间越长越划算！`] : [`🔋 连接钱包！`], sg: conn ? [`🔋 Buy: Shop → Batteries → BUY. Longer = better value!`] : [`🔋 Connect wallet!`] },
            plug_in: { en: conn ? [`🔌 To plug in:\n\n1️⃣ Wallet & Assets tab\n2️⃣ "Plug in a machine" section\n3️⃣ Enter Machine ID (0, 1...)\n4️⃣ Select battery type\n5️⃣ Click PLUG IN ⚡\n\nUnplugged: ${machines.filter(m=>!m.isPlugged).length} | Unused batteries: ${batteries.filter(b=>!b.isUsed).length}`] : [`🔌 Connect wallet first!`], fr: conn ? [`🔌 Brancher : Wallet → Section Brancher → ID machine → Batterie → BRANCHER`] : [`🔌 Connectez-vous !`], de: conn ? [`🔌 Anschließen: Wallet → "Maschine anschließen" → ID → Batterie → ANSCHLIESSEN`] : [`🔌 Verbinde Wallet!`], zh: conn ? [`🔌 插入：钱包 → 插入机器 → 输入ID → 选电池 → 插入⚡`] : [`🔌 连接钱包！`], sg: conn ? [`🔌 Plug in: Wallet tab → Enter ID → Select battery → PLUG IN`] : [`🔌 Connect wallet!`] },
            claim: { en: conn ? [`🎁 Claim rewards:\n\n1️⃣ Check pending FTA on Home\n2️⃣ Click CLAIM\n3️⃣ Confirm transaction\n\nPending: ${pending.toFixed(5)} FTA`] : [`🎁 Connect wallet to claim!`], fr: conn ? [`🎁 Réclamer : Accueil → RÉCLAMER → Confirmer\nEn attente : ${pending.toFixed(5)} FTA`] : [`🎁 Connectez-vous !`], de: conn ? [`🎁 Abholen: Startseite → EINFORDERN → Bestätigen`] : [`🎁 Verbinde Wallet!`], zh: conn ? [`🎁 领取：首页 → 领取 → 确认\n待领取：${pending.toFixed(5)} FTA`] : [`🎁 连接钱包！`], sg: conn ? [`🎁 Claim: Home → CLAIM → Confirm\nPending: ${pending.toFixed(5)} FTA`] : [`🎁 Connect wallet!`] },
            swap: { en: [`💱 Swap on FITIA PRO:\n\n1️⃣ Go to Swap tab\n2️⃣ Choose direction: USDT ↔ FTA\n3️⃣ Enter amount\n4️⃣ Check rate & details\n5️⃣ Click SWAP\n\nRate: 1 FTA = ${ftaP > 0 ? ftaP.toFixed(6) : '...'} USDT | Fee: 0.3%`], fr: [`💱 Échange : Onglet Swap → Direction → Montant → ÉCHANGER\nTaux : 1 FTA = ${ftaP > 0 ? ftaP.toFixed(6) : '...'} USDT`], de: [`💱 Tausch: Swap-Tab → Richtung → Betrag → TAUSCHEN`], zh: [`💱 兑换：兑换页 → 方向 → 金额 → 兑换\n汇率：1 FTA = ${ftaP > 0 ? ftaP.toFixed(6) : '...'} USDT`], sg: [`💱 Swap: Swap tab → Direction → Amount → SWAP\nRate: 1 FTA = ${ftaP > 0 ? ftaP.toFixed(6) : '...'} USDT`] },
            wallet: { en: conn ? [`💰 Wallet overview:\n\nAddress: ${this.user?.slice(0,6)}...${this.user?.slice(-4)}\n\nCheck balances in Wallet tab.\nSend/Receive from there.\n\n⚠️ Polygon network only!`] : [`💰 Connect wallet to view balances!`], fr: conn ? [`💰 Adresse : ${this.user?.slice(0,6)}...${this.user?.slice(-4)}\n⚠️ Réseau Polygon uniquement !`] : [`💰 Connectez-vous !`], de: conn ? [`💰 Adresse: ${this.user?.slice(0,6)}...${this.user?.slice(-4)}`] : [`💰 Verbinde Wallet!`], zh: conn ? [`💰 地址：${this.user?.slice(0,6)}...${this.user?.slice(-4)}\n⚠️ 仅限Polygon！`] : [`💰 连接钱包！`], sg: conn ? [`💰 Address: ${this.user?.slice(0,6)}...${this.user?.slice(-4)}\n⚠️ Polygon only!`] : [`💰 Connect wallet!`] },
            referral: { en: [`👥 Referral System:\n\n1️⃣ Your wallet address = your referral code\n2️⃣ Share it with friends\n3️⃣ They enter it in Referral section\n4️⃣ Click BIND\n\nBoth earn bonus rewards!\n\nYour code: ${conn ? this.user : 'Connect wallet first'}`], fr: [`👥 Votre adresse = code de parrainage. Partagez-la !`], de: [`👥 Deine Adresse = Empfehlungscode. Teile sie!`], zh: [`👥 你的地址 = 推荐码。分享给朋友！`], sg: [`👥 Your address = referral code. Share it!`] },
            connect: { en: conn ? [`✅ Wallet already connected! ${this.user?.slice(0,6)}...${this.user?.slice(-4)}`] : [`🔗 Click "Connect" → Choose MetaMask/WalletConnect → Approve → Ensure Polygon network`], fr: conn ? [`✅ Wallet connecté !`] : [`🔗 Cliquez "Connecter" → Approuvez → Réseau Polygon`], de: conn ? [`✅ Wallet verbunden!`] : [`🔗 "Verbinden" → Genehmigen → Polygon`], zh: conn ? [`✅ 钱包已连接！`] : [`🔗 点击"连接" → 批准 → Polygon网络`], sg: conn ? [`✅ Connected!`] : [`🔗 Click "Connect" → Approve → Polygon`] },
            what_is_fta: { en: [`🪙 FTA is the native mining reward token.\n\n🔹 Earned by mining\n🔹 Swappable to USDT\n🔹 Used to buy machines & batteries\n\nPrice: ${ftaP > 0 ? '$' + ftaP.toFixed(6) : 'Loading...'}`], fr: [`🪙 FTA est le jeton de récompense de minage. Prix : ${ftaP > 0 ? ftaP.toFixed(6) + ' USDT' : 'Chargement...'}`], de: [`🪙 FTA ist der Mining-Belohnungstoken.`], zh: [`🪙 FTA是挖矿奖励代币。价格：${ftaP > 0 ? ftaP.toFixed(6) + ' USDT' : '加载中...'}`], sg: [`🪙 FTA is the mining reward token. Price: ${ftaP > 0 ? '$' + ftaP.toFixed(6) : 'Loading...'}`] },
            how_it_works: { en: [`📖 How FITIA PRO works:\n\n1️⃣ CONNECT wallet\n2️⃣ BUY machines & batteries\n3️⃣ PLUG IN machines\n4️⃣ MINE FTA automatically\n5️⃣ CLAIM rewards\n6️⃣ SWAP or REINVEST`], fr: [`📖 Comment ça marche : Connecter → Acheter → Brancher → Miner → Réclamer → Échanger`], de: [`📖 So funktioniert's: Verbinden → Kaufen → Anschließen → Minen → Abholen → Tauschen`], zh: [`📖 运作方式：连接 → 购买 → 插入 → 挖矿 → 领取 → 兑换`], sg: [`📖 How it works: Connect → Buy → Plug in → Mine → Claim → Swap`] },
            earn_more: { en: conn ? [`📈 Earn more:\n\n1️⃣ Upgrade machines\n2️⃣ Run multiple machines\n3️⃣ Use longer batteries\n4️⃣ Claim & reinvest regularly\n5️⃣ Use referrals\n\nYour power: ${this.formatHashrate(power)}`] : [`📈 Connect wallet to start earning!`], fr: conn ? [`📈 Gagnez plus : Machines supérieures → Plusieurs machines → Réinvestir`] : [`📈 Connectez-vous !`], de: conn ? [`📈 Mehr verdienen: Höhere Maschinen → Reinvestieren`] : [`📈 Verbinde Wallet!`], zh: conn ? [`📈 赚更多：升级矿机 → 多台运行 → 再投资`] : [`📈 连接钱包！`], sg: conn ? [`📈 Earn more: Upgrade → Multiple machines → Reinvest\nPower: ${this.formatHashrate(power)}`] : [`📈 Connect wallet!`] },
            price: { en: conn ? [`📊 Prices:\n\n🪙 FTA: ${ftaP > 0 ? '$' + ftaP.toFixed(6) : 'Loading...'}\n💵 USDT: $1.00\n💎 POL: ${this.polPriceUsd > 0 ? '$' + this.polPriceUsd.toFixed(4) : 'Loading...'}`] : [`📊 Connect wallet for prices!`], fr: conn ? [`📊 FTA: ${ftaP > 0 ? ftaP.toFixed(6) + ' USDT' : '...'} | POL: ${this.polPriceUsd > 0 ? this.polPriceUsd.toFixed(4) + ' $' : '...'}`] : [`📊 Connectez-vous !`], de: conn ? [`📊 FTA: ${ftaP > 0 ? '$' + ftaP.toFixed(6) : '...'} | POL: ${this.polPriceUsd > 0 ? '$' + this.polPriceUsd.toFixed(4) : '...'}`] : [`📊 Verbinde Wallet!`], zh: conn ? [`📊 FTA：${ftaP > 0 ? '$' + ftaP.toFixed(6) : '...'} | POL：${this.polPriceUsd > 0 ? '$' + this.polPriceUsd.toFixed(4) : '...'}`] : [`📊 连接钱包！`], sg: conn ? [`📊 FTA: ${ftaP > 0 ? '$' + ftaP.toFixed(6) : '...'} | POL: ${this.polPriceUsd > 0 ? '$' + this.polPriceUsd.toFixed(4) : '...'}`] : [`📊 Connect wallet!`] },
            error: { en: [`🔧 Common errors:\n\n❌ "Cancelled" → You rejected in wallet\n❌ "Insufficient" → Not enough tokens/gas\n❌ "Network error" → Check Polygon connection\n❌ "Failed" → Contract rejected (expired battery?)\n\n💡 Ensure Polygon network + enough POL for gas!`], fr: [`🔧 Erreurs courantes : Annulée → Insuffisant → Réseau → Échouée. Vérifiez Polygon et le gas !`], de: [`🔧 Häufige Fehler: Abgebrochen → Unzureichend → Netzwerk → Fehlgeschlagen. Polygon + Gas prüfen!`], zh: [`🔧 常见错误：取消 → 余额不足 → 网络 → 失败。确保Polygon和足够的POL！`], sg: [`🔧 Errors: Cancelled → Insufficient → Network → Failed. Ensure Polygon + POL for gas!`] },
            status: { en: conn ? [`📊 Status:\n\n⚡ Power: ${this.formatHashrate(power)}\n⛏️ Active: ${activeMachines.length}/${machines.length}\n🎁 Pending: ${pending.toFixed(5)} FTA`] : [`📊 Connect wallet to see status!`], fr: conn ? [`📊 Statut : ${this.formatHashrate(power)} | ${activeMachines.length} actives | ${pending.toFixed(5)} FTA`] : [`📊 Connectez-vous !`], de: conn ? [`📊 Status: ${this.formatHashrate(power)} | ${activeMachines.length} aktiv`] : [`📊 Verbinde Wallet!`], zh: conn ? [`📊 状态：${this.formatHashrate(power)} | ${activeMachines.length}运行中 | ${pending.toFixed(5)} FTA`] : [`📊 连接钱包！`], sg: conn ? [`📊 Status: ${this.formatHashrate(power)} | Active: ${activeMachines.length} | Pending: ${pending.toFixed(5)} FTA`] : [`📊 Connect wallet!`] },
            network: { en: [`🌐 FITIA PRO runs on Polygon:\n\n🔹 Chain ID: 137\n🔹 Currency: POL (MATIC)\n🔹 Very low gas fees (< $0.01)\n\n⚠️ Ensure your wallet is on Polygon!`], fr: [`🌐 Réseau Polygon (Chain ID: 137). Gas très bas. ⚠️ Vérifiez le réseau !`], de: [`🌐 Polygon Netzwerk (Chain ID: 137). Niedrige Gasgebühren. ⚠️ Netzwerk prüfen!`], zh: [`🌐 Polygon网络 (Chain ID: 137)。Gas费极低。⚠️ 确保在Polygon！`], sg: [`🌐 Polygon network (Chain ID: 137). Low gas. ⚠️ Ensure Polygon!`] },
            unknown: { en: [`🤔 I didn't understand. Try:\n• "How does mining work?"\n• "Buy machine"\n• "My status"\n• "Help"`], fr: [`🤔 Je n'ai pas compris. Essayez : "Minage", "Acheter", "Aide"`], de: [`🤔 Nicht verstanden. Frag: "Mining", "Kaufen", "Hilfe"`], zh: [`🤔 不太理解。试试："挖矿"，"购买"，"帮助"`], sg: [`🤔 I didn't understand. Try: "mining", "buy", "status", "help"`] }
        };

        const responses = R[intent] || R.unknown;
        const langResponses = responses[L] || responses.en || responses;
        if (Array.isArray(langResponses)) return pick(langResponses);
        return langResponses;
    }
}

const App = new Application();
window.onload = () => App.init();