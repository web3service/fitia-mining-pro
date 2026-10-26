// ═══════════════════════════════════════════════════════════════════
//  FITIA PRO MINER V3.2 — Application Mobile Autonome (APK & Web)
//  Portefeuille Polygon Non-Custodial Chiffré (AES-256-GCM + PIN)
// ═══════════════════════════════════════════════════════════════════

// ─── Configuration Blockchain Polygon Mainnet ──────────────────────
const CONFIG = {
  CORE: "0x1b8EdFb91168Fb233F8CA7cf1631038AC193D743",
  MINE: "0xBd9FA9801eDA247b28B3BB9dDBf1CF52cA563Bc6",
  USDT: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
  FTA:  "0x5c418b12c7e9c2A8e9A71A68c6d9b319E7B1d1fd",
  // QuickSwap V2 sur Polygon PoS (adresses officielles QuickSwap / Polygon).
  QUICKSWAP_ROUTER: "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff",
  QUICKSWAP_FACTORY: "0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32",
  WPOL: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
  CHAIN_ID: 137,
  EXPLORER: "https://polygonscan.com",
  UPDATE_MANIFEST: "https://raw.githubusercontent.com/web3service/fitia-mining-pro/main/update-current.json",
  WHATSAPP_GROUP: "https://chat.whatsapp.com/BDsvPCB6xp8H8X0YaRmPFP",
  WHATSAPP_CHANNEL: "https://whatsapp.com/channel/0029VbCQhI38PgsPLbBJdV1e"
};

// ─── Traductions i18n (5 langues) ──────────────────────────────────
const i18n = {
  fr: {
    createNewWallet: "CRÉER UN PORTEFEUILLE",
    importExistingWallet: "J'ai déjà un portefeuille (12 mots / Clé)",
    downloadApkTitle: "Télécharger l'application Android (.APK)",
    downloadApkSub: "Installation directe sur votre téléphone",
    updateRequiredTitle: "Mise à jour requise",
    updateRequiredMessage: "Des améliorations de sécurité et de nouvelles fonctionnalités sont disponibles. Installez la dernière version pour continuer à utiliser FITIA PRO.",
    updateDownloadInstall: "Télécharger et installer",
    updateInstallHint: "Android vous demandera de confirmer l’installation.",
    updateDownloading: "Téléchargement de la mise à jour…",
    updateStartError: "Impossible de lancer la mise à jour. Réessayez plus tard.",
    updateLatest: "L’application est à jour.",
    updateCheckFailed: "Impossible de vérifier la mise à jour pour le moment.",
    back: "Retour",
    backupSeedTitle: "Phrase de récupération (12 mots)",
    backupSeedWarn: "Notez ces 12 mots dans l'ordre exact et gardez-les en lieu sûr. Ne les partagez jamais : quiconque possède ces mots contrôle vos fonds.",
    yourPolygonAddr: "Adresse Polygon :",
    revealWords: "Afficher",
    hideWords: "Masquer",
    copyWords: "Copier les 12 mots",
    confirmSavedSeed: "J'ai noté et sauvegardé mes 12 mots dans un endroit sûr.",
    continueBtn: "CONTINUER →",
    verifySeedTitle: "Vérifiez votre sauvegarde",
    verifySeedDesc: "Sélectionnez les bons mots correspondant aux numéros demandés.",
    selectWordNum: "Sélectionnez le mot #",
    validateAndSetPin: "VALIDER & CRÉER MON PIN →",
    quizWrong: "Les mots sélectionnés ne correspondent pas. Vérifiez vos 12 mots.",
    importTitle: "Importer un portefeuille",
    seedPhraseTab: "Phrase (12/24 mots)",
    privateKeyTab: "Clé privée (0x...)",
    importSeedHint: "Entrez vos 12 ou 24 mots séparés par un espace.",
    importPkHint: "Collez votre clé privée hexadécimale (64 caractères, avec ou sans 0x).",
    paste: "Coller",
    detectedWallet: "Portefeuille Polygon détecté :",
    continueToPin: "CHOISIR MON CODE PIN",
    createPinTitle: "Créez votre code PIN",
    createPinDesc: "Choisissez un code à 6 chiffres pour chiffrer votre portefeuille.",
    confirmPinTitle: "Confirmez votre code PIN",
    confirmPinDesc: "Saisissez à nouveau vos 6 chiffres pour confirmer.",
    pinMismatch: "Les deux codes PIN ne correspondent pas. Recommencez.",
    walletReady: "Portefeuille sécurisé prêt !",
    unlockTitle: "Déverrouiller FITIA PRO",
    unlockDesc: "Entrez votre code PIN à 6 chiffres",
    forgotPinLink: "Code PIN oublié ? Restaurer avec mes 12 mots / clé",
    wrongPin: "Code PIN incorrect.",
    lockedOutMsg: "Trop d'essais. Réessayez dans {s}s.",
    walletLocked: "🔒 Portefeuille verrouillé",
    refTitle: "Programme de parrainage",
    refSubtitle: "Partagez votre code avec votre communauté.",
    refDesc: "Saisissez le code ou l’adresse Polygon de votre parrain.",
    refAlreadyBound: "Parrain associé :",
    yourRefCode: "Votre code de parrainage",
    refCodeHint: "Ce code personnel ne donne accès à aucun fonds.",
    copyRefCode: "Copier le code",
    refCodeCopied: "Code de parrainage copié !",
    shareRef: "Partager",
    refBindTitle: "Vous avez un code ?",
    refInputLabel: "Code ou adresse du parrain",
    refInputHint: "Formats acceptés : FITIA-001042, #1042, 1042 ou adresse Polygon.",
    invalidRefCode: "Code de parrainage ou adresse invalide",
    refShareTitle: "FITIA PRO — Programme de parrainage",
    refShareMessage: "Rejoignez FITIA PRO et utilisez mon code de parrainage : {code}\n\nDans l’application, ouvrez Paramètres puis Programme de parrainage pour l’associer.",
    bindRef: "ASSOCIER",
    power: "PUISSANCE",
    ftaSec: "Hashrate",
    pending: "EN ATTENTE",
    fta: "FTA",
    miningActive: "MINAGE ACTIF",
    noMachine: "AUCUNE MACHINE",
    claim: "RÉCLAMER",
    shopTitle: "⛏️ Boutique",
    machines: "Machines",
    batteries: "Batteries",
    buy: "ACHETER",
    availUsdt: "Dispo USDT",
    availFta: "Dispo FTA",
    myAssets: "⚙️ Portefeuille & Actifs",
    onchainWalletTitle: "🔐 Mon Portefeuille Polygon",
    miningVaultTitle: "⚡ Compte Minage",
    miningVaultDesc: "Solde utilisé pour la boutique, le swap et vos récompenses de minage. Déposez ou retirez vers votre portefeuille à tout moment.",
    lowPolGasWarn: "Ajoutez un peu de POL (~0.05 POL) à votre adresse pour payer les frais réseau Polygon.",
    noGasPolErr: "⛽ Solde POL insuffisant pour payer les frais réseau Polygon (~0.01 POL requis). Appuyez sur Recevoir pour déposer un peu de POL.",
    plugMachine: "Connexion machine & batterie",
    plugDesc: "Sélectionnez une machine disponible et son autonomie.",
    machineId: "Index Machine (0, 1...)",
    plug: "CONNECTER",
    plugAction: "CONNECTER LA MACHINE",
    plugMachineStep: "1. Choisissez une machine",
    plugBatteryStep: "2. Choisissez une batterie",
    plugPreview: "Aperçu de connexion",
    plugNotReady: "À configurer",
    plugReady: "Prêt à connecter",
    selectMachinePrompt: "Machine à sélectionner",
    selectBatteryPrompt: "Batterie à sélectionner",
    selectMachineToContinue: "Sélectionnez une machine disponible.",
    selectBatteryToContinue: "Sélectionnez une batterie en stock.",
    plugReadySummary: "Machine {machine} • Autonomie {days}",
    plugConsumptionHint: "1 batterie sera utilisée. Confirmation sécurisée sur Polygon.",
    noEligibleMachines: "Toutes vos machines sont actuellement actives.",
    swapTitle: "💱 Échange",
    youPay: "Vous payez",
    balance: "Solde:",
    youReceive: "Vous recevez",
    swap: "ÉCHANGER",
    loading: "Chargement...",
    currentRate: "1 FTA = ",
    home: "Accueil",
    shop: "Boutique",
    assets: "Wallet",
    swapNav: "Swap",
    linking: "Liaison...",
    refLinked: "Parrain lié !",
    enterRefAddr: "FITIA-001042, #1042 ou 0x...",
    buyingMachine: "Achat Machine",
    buyingBattery: "Achat Batterie",
    autoDepositStep: "Dépôt automatique vers Compte Minage...",
    confirming: "Confirmation blockchain...",
    machineBought: "Machine achetée ! ⛏️",
    batteryBought: "Batterie achetée ! 🔋",
    invalidId: "Sélectionnez une machine disponible",
    pluggingIn: "Connexion en cours...",
    pluggedIn: "Machine connectée !",
    invalidAmount: "Montant invalide",
    swapping: "Échange en cours...",
    swapSuccess: "Échange réussi !",
    claiming: "Réclamation en attente…",
    claimed: "Réclamation confirmée",
    claimStillPending: "Réclamation en attente de confirmation sur Polygon.",
    claimNotConfirmed: "Réclamation non confirmée. Vérifiez votre historique avant de réessayer.",
    days: "Jours",
    rig: "RIG",
    totalBal: "Solde Total Estimé",
    walletShort: "Portefeuille",
    miningShort: "Minage",
    activeMachines: "⛏️ Machines Actives",
    myMachines: "⛏️ Mes Machines",
    myBatteries: "🔋 Mes Batteries",
    active: "Actif",
    expired: "Expiré",
    inactive: "Inactif",
    available: "Disponible",
    plugged: "Branché",
    notPlugged: "Non branché",
    timeRemaining: "Restant",
    noMachines: "Aucune machine",
    noBatteries: "Aucune batterie",
    batteryLabel: "Batterie active",
    usdtPerFta: " USDT",
    noActiveMachines: "Aucune machine active",
    exchangeRate: "Taux de change",
    priceImpact: "Impact prix",
    priceImpactWithFee: "Impact + frais du pool",
    swapFee: "Frais swap (4%)",
    dexFeeLabel: "Frais de liquidité QuickSwap",
    minimumReceived: "Minimum reçu",
    slippageTolerance: "Tolérance slippage",
    swapMarket: "Marché",
    quickswapRateInfo: "QuickSwap V2 • Devis et liquidité on-chain",
    swapQuoteLoading: "Récupération du devis on-chain...",
    swapQuoteUnavailable: "Devis indisponible. Vérifiez le réseau et la liquidité, puis réessayez.",
    swapPolGasReserve: "Solde POL insuffisant pour couvrir le montant et les frais réseau estimés.",
    swapPending: "Transaction envoyée. Confirmation Polygon en attente.",
    swapApprovalPending: "Autorisation USDT envoyée. Confirmation en attente.",
    swapSlippageError: "Le prix a évolué au-delà de la tolérance. Demandez un nouveau devis.",
    swapExpired: "Le devis a expiré. Demandez un nouveau devis.",
    swapRejected: "Transaction annulée.",
    swapNotConfirmed: "Échange non confirmé. Vérifiez votre historique avant de réessayer.",
    networkFee: "Frais réseau estimés",
    depositBtn: "DÉPOSER",
    withdrawBtn: "RETIRER",
    depositing: "Dépôt vers Minage...",
    depositSuccess: "Dépôt réussi !",
    withdrawing: "Retrait vers Portefeuille...",
    withdrawSuccess: "Retrait réussi !",
    send: "Envoyer",
    receive: "Recevoir",
    receiveDesc: "Scannez ce QR Code ou copiez l'adresse pour recevoir POL, USDT ou FTA sur Polygon.",
    copyAddrBtn: "Copier l'adresse",
    copyAddrShort: "Copier",
    shareBtn: "Partager",
    availWalletBal: "Disponible portefeuille :",
    sending: "Signature & envoi...",
    sentSuccess: "Transfert envoyé avec succès !",
    addrCopied: "Adresse copiée !",
    secretCopied: "Copié ! Effacement automatique du presse-papiers dans 45s.",
    weakPinErr: "Code PIN trop simple (évitez 123456 ou 000000). Choisissez un code plus fort.",
    burnAddrBlocked: "⛔ Envoi vers l'adresse nulle (0x000...0) bloqué pour protéger vos fonds.",
    contractAddrBlocked: "⛔ Adresse de contrat détectée ! N'envoyez pas directement à l'adresse d'un contrat.",
    confirmSend: "CONFIRMER L'ENVOI 🔒",
    invalidAddr: "Adresse invalide",
    recipientAddr: "Adresse destinataire (0x...)",
    amount: "Montant",
    securityCenterTitle: "Portefeuille & Sécurité",
    lockNow: "Verrouiller",
    backupAndKeys: "Sauvegarde & Clés Secrètes",
    viewSeedPhrase: "Phrase de récupération (12 mots)",
    exportPrivKey: "Exporter la clé privée",
    reqPinHint: "Protégé par code PIN",
    accessProtection: "Protection d'accès",
    changePinTitle: "Modifier le code PIN à 6 chiffres",
    changePinSub: "Rechiffrer le coffre-fort AES-256",
    biometricUnlock: "Déverrouillage biométrique",
    biometricSub: "Empreinte digitale / Reconnaissance faciale",
    autoLockLabel: "Verrouillage automatique",
    autoLockSub: "Après inactivité en arrière-plan",
    never: "Jamais",
    networkNodeTitle: "Réseau Polygon RPC",
    switchOrResetWallet: "Changer ou réinitialiser ce portefeuille",
    neverShareSecretWarn: "Ne donnez JAMAIS ces informations à personne, même au support. Quiconque les voit peut voler tous vos fonds.",
    copySecretBtn: "Copier dans le presse-papiers",
    confirmWithPin: "Confirmation Sécurité",
    enterPinToContinue: "Entrez votre code PIN à 6 chiffres pour autoriser cette opération.",
    pinChangedSuccess: "Code PIN modifié avec succès !",
    errRejected: "Opération annulée",
    errInsufficientFunds: "Solde insuffisant",
    errNetwork: "Erreur réseau Polygon. Basculement RPC...",
    errTimeout: "Délai réseau dépassé. Réessayez.",
    errContract: "Transaction refusée par le contrat.",
    errGeneric: "Une erreur est survenue.",
    errAlreadyPending: "Transaction en cours. Patientez.",
    errNonce: "Erreur de séquence (nonce). Réessayez.",
    errNoMachine: "Aucune machine possédée",
    errRunning: "Cette machine est déjà en marche",
    errNoBattery: "Aucune batterie de ce type disponible",
    errMaxMachine: "Nombre maximum de machines atteint",
    shopExpiredLabel: "EXPIRÉ"
  },
  en: {
    createNewWallet: "CREATE NEW WALLET",
    importExistingWallet: "I already have a wallet (12 words / Key)",
    downloadApkTitle: "Download Android App (.APK)",
    downloadApkSub: "Direct installation on your phone",
    updateRequiredTitle: "Update required",
    updateRequiredMessage: "Security improvements and new features are available. Install the latest version to continue using FITIA PRO.",
    updateDownloadInstall: "Download and install",
    updateInstallHint: "Android will ask you to confirm the installation.",
    updateDownloading: "Downloading the update…",
    updateStartError: "Unable to start the update. Please try again later.",
    updateLatest: "The app is up to date.",
    updateCheckFailed: "Unable to check for updates right now.",
    back: "Back",
    backupSeedTitle: "Recovery Phrase (12 words)",
    backupSeedWarn: "Write down these 12 words in exact order and keep them safe. Never share them: anyone with these words controls your funds.",
    yourPolygonAddr: "Polygon Address:",
    revealWords: "Show",
    hideWords: "Hide",
    copyWords: "Copy 12 words",
    confirmSavedSeed: "I have written down and safely backed up my 12 words.",
    continueBtn: "CONTINUE →",
    verifySeedTitle: "Verify your backup",
    verifySeedDesc: "Select the matching words for the requested positions.",
    selectWordNum: "Select word #",
    validateAndSetPin: "VERIFY & SET MY PIN →",
    quizWrong: "Selected words do not match. Check your 12-word phrase.",
    importTitle: "Import a Wallet",
    seedPhraseTab: "Phrase (12/24 words)",
    privateKeyTab: "Private Key (0x...)",
    importSeedHint: "Enter your 12 or 24 recovery words separated by spaces.",
    importPkHint: "Paste your 64-character hex private key (with or without 0x).",
    paste: "Paste",
    detectedWallet: "Detected Polygon Wallet:",
    continueToPin: "SET MY 6-DIGIT PIN",
    createPinTitle: "Create your PIN",
    createPinDesc: "Choose a 6-digit PIN to encrypt your wallet.",
    confirmPinTitle: "Confirm your PIN",
    confirmPinDesc: "Re-enter your 6 digits to confirm.",
    pinMismatch: "PIN codes do not match. Please try again.",
    walletReady: "Secure wallet ready!",
    unlockTitle: "Unlock FITIA PRO",
    unlockDesc: "Enter your 6-digit PIN",
    forgotPinLink: "Forgot PIN? Restore with 12-word phrase / key",
    wrongPin: "Incorrect PIN.",
    lockedOutMsg: "Too many attempts. Try again in {s}s.",
    walletLocked: "🔒 Wallet locked",
    refTitle: "Referral program",
    refSubtitle: "Share your code with your community.",
    refDesc: "Enter your referrer’s code or Polygon address.",
    refAlreadyBound: "Linked referrer:",
    yourRefCode: "Your referral code",
    refCodeHint: "This personal code does not give access to your funds.",
    copyRefCode: "Copy code",
    refCodeCopied: "Referral code copied!",
    shareRef: "Share",
    refBindTitle: "Have a referral code?",
    refInputLabel: "Referrer code or address",
    refInputHint: "Accepted formats: FITIA-001042, #1042, 1042 or a Polygon address.",
    invalidRefCode: "Invalid referral code or address",
    refShareTitle: "FITIA PRO — Referral program",
    refShareMessage: "Join FITIA PRO and use my referral code: {code}\n\nIn the app, open Settings then Referral program to link it.",
    bindRef: "LINK",
    power: "POWER",
    ftaSec: "Hashrate",
    pending: "PENDING",
    fta: "FTA",
    miningActive: "MINING ACTIVE",
    noMachine: "NO MACHINE",
    claim: "CLAIM",
    shopTitle: "⛏️ Shop",
    machines: "Machines",
    batteries: "Batteries",
    buy: "BUY",
    availUsdt: "Avail USDT",
    availFta: "Avail FTA",
    myAssets: "⚙️ Wallet & Assets",
    onchainWalletTitle: "🔐 My Polygon Wallet",
    miningVaultTitle: "⚡ Mining Account",
    miningVaultDesc: "Balance used for shop, swap and mining rewards. Deposit or withdraw to your wallet anytime.",
    lowPolGasWarn: "Add a small amount of POL (~0.05 POL) to your address to cover Polygon network gas fees.",
    noGasPolErr: "⛽ Insufficient POL for Polygon gas fees (~0.01 POL needed). Tap Receive to add POL.",
    plugMachine: "Machine & battery connection",
    plugDesc: "Select an available machine and its battery life.",
    machineId: "Machine Index (0, 1...)",
    plug: "CONNECT",
    plugAction: "CONNECT MACHINE",
    plugMachineStep: "1. Choose a machine",
    plugBatteryStep: "2. Choose a battery",
    plugPreview: "Connection preview",
    plugNotReady: "Setup required",
    plugReady: "Ready to connect",
    selectMachinePrompt: "Select a machine",
    selectBatteryPrompt: "Select a battery",
    selectMachineToContinue: "Select an available machine.",
    selectBatteryToContinue: "Select a battery in stock.",
    plugReadySummary: "Machine {machine} • {days} battery life",
    plugConsumptionHint: "1 battery will be used. Secure confirmation on Polygon.",
    noEligibleMachines: "All your machines are currently active.",
    swapTitle: "💱 Swap",
    youPay: "You pay",
    balance: "Balance:",
    youReceive: "You receive",
    swap: "SWAP",
    loading: "Loading...",
    currentRate: "1 FTA = ",
    home: "Home",
    shop: "Shop",
    assets: "Wallet",
    swapNav: "Swap",
    linking: "Linking...",
    refLinked: "Referrer linked!",
    enterRefAddr: "FITIA-001042, #1042 or 0x...",
    buyingMachine: "Buying Machine",
    buyingBattery: "Buying Battery",
    autoDepositStep: "Auto-depositing to Mining Account...",
    confirming: "Confirming on Polygon...",
    machineBought: "Machine purchased! ⛏️",
    batteryBought: "Battery purchased! 🔋",
    invalidId: "Select an available machine",
    pluggingIn: "Connecting...",
    pluggedIn: "Machine connected!",
    invalidAmount: "Invalid amount",
    swapping: "Swapping...",
    swapSuccess: "Swap successful!",
    claiming: "Claim pending…",
    claimed: "Claim confirmed",
    claimStillPending: "Claim is still awaiting Polygon confirmation.",
    claimNotConfirmed: "Claim not confirmed. Check your history before trying again.",
    days: "Days",
    rig: "RIG",
    totalBal: "Estimated Total Balance",
    walletShort: "Wallet",
    miningShort: "Mining",
    activeMachines: "⛏️ Active Machines",
    myMachines: "⛏️ My Machines",
    myBatteries: "🔋 My Batteries",
    active: "Active",
    expired: "Expired",
    inactive: "Inactive",
    available: "Available",
    plugged: "Plugged",
    notPlugged: "Not Plugged",
    timeRemaining: "Remaining",
    noMachines: "No machines yet",
    noBatteries: "No batteries yet",
    batteryLabel: "Active battery",
    usdtPerFta: " USDT",
    noActiveMachines: "No active machines",
    exchangeRate: "Exchange Rate",
    priceImpact: "Price Impact",
    priceImpactWithFee: "Price impact + pool fee",
    swapFee: "Swap Fee (4%)",
    dexFeeLabel: "QuickSwap liquidity fee",
    minimumReceived: "Minimum Received",
    slippageTolerance: "Slippage Tolerance",
    swapMarket: "Market",
    quickswapRateInfo: "QuickSwap V2 • On-chain quote and liquidity",
    swapQuoteLoading: "Fetching on-chain quote...",
    swapQuoteUnavailable: "Quote unavailable. Check the network and liquidity, then try again.",
    swapPolGasReserve: "Insufficient POL to cover both the amount and estimated network fees.",
    swapPending: "Transaction sent. Waiting for Polygon confirmation.",
    swapApprovalPending: "USDT approval sent. Waiting for confirmation.",
    swapSlippageError: "The price moved beyond your tolerance. Request a new quote.",
    swapExpired: "The quote expired. Request a new quote.",
    swapRejected: "Transaction cancelled.",
    swapNotConfirmed: "Swap not confirmed. Check your history before trying again.",
    networkFee: "Est. Network Fee",
    depositBtn: "DEPOSIT",
    withdrawBtn: "WITHDRAW",
    depositing: "Depositing to Mining...",
    depositSuccess: "Deposit successful!",
    withdrawing: "Withdrawing to Wallet...",
    withdrawSuccess: "Withdrawal successful!",
    send: "Send",
    receive: "Receive",
    receiveDesc: "Scan this QR Code or copy your address to receive POL, USDT or FTA on Polygon.",
    copyAddrBtn: "Copy Address",
    copyAddrShort: "Copy",
    shareBtn: "Share",
    availWalletBal: "Available in wallet:",
    sending: "Signing & sending...",
    sentSuccess: "Sent successfully!",
    addrCopied: "Address copied!",
    secretCopied: "Copied! Clipboard will auto-clear in 45s for security.",
    weakPinErr: "PIN is too simple (avoid 123456 or 000000). Choose a stronger PIN.",
    burnAddrBlocked: "⛔ Sending to burn address (0x000...0) is blocked to protect your funds.",
    contractAddrBlocked: "⛔ Contract address detected! Do not send tokens directly to a contract address.",
    confirmSend: "CONFIRM SEND 🔒",
    invalidAddr: "Invalid address",
    recipientAddr: "Recipient address (0x...)",
    amount: "Amount",
    securityCenterTitle: "Wallet & Security",
    lockNow: "Lock",
    backupAndKeys: "Backup & Secret Keys",
    viewSeedPhrase: "Recovery Phrase (12 words)",
    exportPrivKey: "Export Private Key",
    reqPinHint: "Protected by PIN",
    accessProtection: "Access Protection",
    changePinTitle: "Change 6-digit PIN",
    changePinSub: "Re-encrypt AES-256 vault",
    biometricUnlock: "Biometric Unlock",
    biometricSub: "Fingerprint / Face Unlock",
    autoLockLabel: "Auto-Lock",
    autoLockSub: "When app is in background",
    never: "Never",
    networkNodeTitle: "Polygon RPC Node",
    switchOrResetWallet: "Switch or Reset Wallet",
    neverShareSecretWarn: "NEVER share this information with anyone, including support. Anyone who sees it can steal your funds.",
    copySecretBtn: "Copy to clipboard",
    confirmWithPin: "Security Confirmation",
    enterPinToContinue: "Enter your 6-digit PIN to authorize this action.",
    pinChangedSuccess: "✅ PIN updated successfully!",
    errRejected: "Operation cancelled",
    errInsufficientFunds: "Insufficient balance",
    errNetwork: "Polygon network error. Switching RPC...",
    errTimeout: "Network timeout. Please try again.",
    errContract: "Transaction reverted by contract.",
    errGeneric: "An error occurred.",
    errAlreadyPending: "Transaction pending. Please wait.",
    errNonce: "Nonce error. Please retry.",
    errNoMachine: "No machine owned",
    errRunning: "Machine already running",
    errNoBattery: "No battery of this type",
    errMaxMachine: "Max machines reached",
    shopExpiredLabel: "EXPIRED"
  },
  de: {
    createNewWallet: "NEUE WALLET ERSTELLEN",
    importExistingWallet: "Bestehende Wallet importieren",
    unlockTitle: "FITIA PRO entsperren",
    unlockDesc: "6-stellige PIN eingeben",
    wrongPin: "Falsche PIN.",
    refTitle: "Empfehlungsprogramm",
    refSubtitle: "Teilen Sie Ihren Code mit Ihrer Community.",
    refDesc: "Geben Sie den Code oder die Polygon-Adresse Ihres Empfehlers ein.",
    refAlreadyBound: "Verbundener Empfehler:",
    yourRefCode: "Ihr Empfehlungscode",
    refCodeHint: "Dieser persönliche Code gewährt keinen Zugriff auf Ihr Guthaben.",
    copyRefCode: "Code kopieren",
    refCodeCopied: "Empfehlungscode kopiert!",
    shareRef: "Teilen",
    refBindTitle: "Haben Sie einen Empfehlungscode?",
    refInputLabel: "Code oder Adresse des Empfehlers",
    refInputHint: "Akzeptierte Formate: FITIA-001042, #1042, 1042 oder eine Polygon-Adresse.",
    invalidRefCode: "Ungültiger Empfehlungscode oder ungültige Adresse",
    refShareTitle: "FITIA PRO — Empfehlungsprogramm",
    refShareMessage: "Treten Sie FITIA PRO bei und verwenden Sie meinen Empfehlungscode: {code}\n\nÖffnen Sie in der App Einstellungen und dann Empfehlungsprogramm, um ihn zu verknüpfen.",
    bindRef: "VERKNÜPFEN",
    enterRefAddr: "FITIA-001042, #1042 oder 0x...",
    power: "LEISTUNG",
    ftaSec: "Hashrate",
    pending: "AUSSTEHEND",
    fta: "FTA",
    miningActive: "MINING AKTIV",
    noMachine: "KEINE MASCHINE",
    claim: "EINFORDERN",
    shopTitle: "⛏️ Shop",
    machines: "Maschinen",
    batteries: "Batterien",
    buy: "KAUFEN",
    myAssets: "⚙️ Wallet & Assets",
    onchainWalletTitle: "🔐 Meine Polygon Wallet",
    miningVaultTitle: "⚡ Mining-Konto",
    plugMachine: "Maschine & Akku verbinden",
    plugDesc: "Wählen Sie eine verfügbare Maschine und ihre Laufzeit.",
    machineId: "Maschinen-Index (0, 1...)",
    plug: "VERBINDEN",
    plugAction: "MASCHINE VERBINDEN",
    plugMachineStep: "1. Maschine auswählen",
    plugBatteryStep: "2. Akku auswählen",
    plugPreview: "Verbindungsvorschau",
    plugNotReady: "Konfiguration nötig",
    plugReady: "Bereit zum Verbinden",
    selectMachinePrompt: "Maschine auswählen",
    selectBatteryPrompt: "Akku auswählen",
    selectMachineToContinue: "Wählen Sie eine verfügbare Maschine.",
    selectBatteryToContinue: "Wählen Sie einen Akku auf Lager.",
    plugReadySummary: "Maschine {machine} • Laufzeit {days}",
    plugConsumptionHint: "1 Akku wird verwendet. Sichere Bestätigung auf Polygon.",
    noEligibleMachines: "Alle Ihre Maschinen sind derzeit aktiv.",
    invalidId: "Wählen Sie eine verfügbare Maschine",
    pluggingIn: "Verbindung läuft...",
    pluggedIn: "Maschine verbunden!",
    errNoBattery: "Kein Akku dieses Typs auf Lager",
    errRunning: "Diese Maschine ist bereits aktiv",
    swapTitle: "💱 Tausch",
    youPay: "Sie zahlen",
    balance: "Guthaben:",
    youReceive: "Sie erhalten",
    swap: "TAUSCHEN",
    home: "Home",
    shop: "Shop",
    assets: "Wallet",
    swapNav: "Swap",
    days: "Tage",
    rig: "RIG",
    totalBal: "Geschätztes Gesamtguthaben",
    activeMachines: "⛏️ Aktive Maschinen",
    myMachines: "⛏️ Meine Maschinen",
    myBatteries: "🔋 Meine Batterien",
    active: "Aktiv",
    expired: "Abgelaufen",
    inactive: "Inaktiv",
    available: "Verfügbar",
    plugged: "Angeschlossen",
    notPlugged: "Nicht angeschlossen",
    timeRemaining: "Verbleibend",
    noMachines: "Keine Maschinen",
    noBatteries: "Keine Batterien",
    noActiveMachines: "Keine aktiven Maschinen",
    depositBtn: "EINZAHLEN",
    withdrawBtn: "ABHEBEN",
    send: "Senden",
    receive: "Empfangen",
    addrCopied: "Adresse kopiert!"
  },
  zh: {
    createNewWallet: "创建新钱包",
    importExistingWallet: "导入已有钱包（12助记词 / 私钥）",
    unlockTitle: "解锁 FITIA PRO",
    unlockDesc: "请输入6位数字PIN码",
    wrongPin: "PIN码错误",
    refTitle: "推荐计划",
    refSubtitle: "与您的社区分享推荐码。",
    refDesc: "输入推荐人的推荐码或 Polygon 地址。",
    refAlreadyBound: "已绑定推荐人：",
    yourRefCode: "您的推荐码",
    refCodeHint: "此个人推荐码不会授予任何人访问您资金的权限。",
    copyRefCode: "复制推荐码",
    refCodeCopied: "推荐码已复制！",
    shareRef: "分享",
    refBindTitle: "您有推荐码吗？",
    refInputLabel: "推荐码或推荐人地址",
    refInputHint: "支持格式：FITIA-001042、#1042、1042 或 Polygon 地址。",
    invalidRefCode: "推荐码或地址无效",
    refShareTitle: "FITIA PRO — 推荐计划",
    refShareMessage: "加入 FITIA PRO 并使用我的推荐码：{code}\n\n在应用中打开“设置”，然后打开“推荐计划”进行绑定。",
    bindRef: "绑定",
    enterRefAddr: "FITIA-001042、#1042 或 0x...",
    power: "算力",
    ftaSec: "Hashrate",
    pending: "待领取",
    fta: "FTA",
    miningActive: "挖矿中",
    noMachine: "无矿机",
    claim: "领取",
    shopTitle: "⛏️ 商店",
    machines: "矿机",
    batteries: "电池",
    buy: "购买",
    myAssets: "⚙️ 钱包与资产",
    onchainWalletTitle: "🔐 我的 Polygon 钱包",
    miningVaultTitle: "⚡ 挖矿账户",
    plugMachine: "连接矿机与电池",
    plugDesc: "选择可用矿机和电池续航时间。",
    machineId: "矿机索引 (0, 1...)",
    plug: "连接",
    plugAction: "连接矿机",
    plugMachineStep: "1. 选择矿机",
    plugBatteryStep: "2. 选择电池",
    plugPreview: "连接预览",
    plugNotReady: "待配置",
    plugReady: "可以连接",
    selectMachinePrompt: "选择矿机",
    selectBatteryPrompt: "选择电池",
    selectMachineToContinue: "请选择一台可用矿机。",
    selectBatteryToContinue: "请选择一块库存电池。",
    plugReadySummary: "矿机 {machine} • 续航 {days}",
    plugConsumptionHint: "将使用 1 块电池，并在 Polygon 上安全确认。",
    noEligibleMachines: "您的所有矿机都在运行中。",
    invalidId: "请选择可用矿机",
    pluggingIn: "正在连接...",
    pluggedIn: "矿机已连接！",
    errNoBattery: "没有此类型的库存电池",
    errRunning: "此矿机已在运行中",
    swapTitle: "💱 兑换",
    youPay: "您支付",
    balance: "余额:",
    youReceive: "您收到",
    swap: "兑换",
    home: "首页",
    shop: "商店",
    assets: "钱包",
    swapNav: "兑换",
    days: "天",
    rig: "矿机",
    totalBal: "预估总资产",
    activeMachines: "⛏️ 运行中矿机",
    myMachines: "⛏️ 我的矿机",
    myBatteries: "🔋 我的电池",
    active: "运行中",
    expired: "已过期",
    inactive: "未激活",
    available: "可用",
    plugged: "已插入",
    notPlugged: "未插入",
    timeRemaining: "剩余",
    noMachines: "暂无矿机",
    noBatteries: "暂无电池",
    noActiveMachines: "无运行中矿机",
    depositBtn: "存入",
    withdrawBtn: "提取",
    send: "发送",
    receive: "接收",
    addrCopied: "地址已复制！"
  },
  sg: {
    createNewWallet: "CREATE NEW WALLET",
    importExistingWallet: "Import Existing Wallet",
    unlockTitle: "Unlock FITIA PRO",
    unlockDesc: "Enter your 6-digit PIN",
    refTitle: "Referral program",
    refSubtitle: "Share your code with your community.",
    refDesc: "Enter your referrer’s code or Polygon address.",
    refAlreadyBound: "Linked referrer:",
    yourRefCode: "Your referral code",
    refCodeHint: "This personal code does not give access to your funds.",
    copyRefCode: "Copy code",
    refCodeCopied: "Referral code copied!",
    shareRef: "Share",
    refBindTitle: "Have a referral code?",
    refInputLabel: "Referrer code or address",
    refInputHint: "Accepted formats: FITIA-001042, #1042, 1042 or a Polygon address.",
    invalidRefCode: "Invalid referral code or address",
    refShareTitle: "FITIA PRO — Referral program",
    refShareMessage: "Join FITIA PRO and use my referral code: {code}\n\nIn the app, open Settings then Referral program to link it.",
    bindRef: "LINK",
    enterRefAddr: "FITIA-001042, #1042 or 0x...",
    plugMachine: "Machine & battery connection",
    plugDesc: "Select an available machine and its battery life.",
    plug: "CONNECT",
    plugAction: "CONNECT MACHINE",
    plugMachineStep: "1. Choose a machine",
    plugBatteryStep: "2. Choose a battery",
    plugPreview: "Connection preview",
    plugNotReady: "Setup required",
    plugReady: "Ready to connect",
    selectMachinePrompt: "Select a machine",
    selectBatteryPrompt: "Select a battery",
    selectMachineToContinue: "Select an available machine.",
    selectBatteryToContinue: "Select a battery in stock.",
    plugReadySummary: "Machine {machine} • {days} battery life",
    plugConsumptionHint: "1 battery will be used. Secure confirmation on Polygon.",
    noEligibleMachines: "All your machines are currently active.",
    invalidId: "Select an available machine",
    pluggingIn: "Connecting...",
    pluggedIn: "Machine connected!",
    days: "days",
    available: "Available",
    noMachines: "No machines yet",
    noBatteries: "No batteries yet",
    errNoBattery: "No battery of this type available",
    errRunning: "This machine is already running"
  }
};

// ─── ABIs Contrats V3 / V3.2 ───────────────────────────────────────
const CORE_ABI = [
  "function usdt() view returns (address)",
  "function fta() view returns (address)",
  "function depositUsdt(uint256 a)",
  "function depositFta(uint256 a)",
  "function depositPol() payable",
  "function withdrawUsdt(uint256 a)",
  "function withdrawFta(uint256 a)",
  "function withdrawPol(uint256 a)",
  "function setReferrer(address r)",
  "function setReferrerById(uint256 rid)",
  "function refr(address) view returns (address)",
  "function rate() view returns (uint256)",
  "function swapUForF(uint256 a, uint256 m, uint256 d)",
  "function swapFForU(uint256 a, uint256 m, uint256 d)",
  "function buyFta(uint256 a) view returns (uint256)",
  "function sellFta(uint256 a) view returns (uint256)",
  "function costFta(uint256 a) view returns (uint256)",
  "function swapFee() view returns (uint256)",
  "function claimFee() view returns (uint256)",
  "function devFee() view returns (uint256)",
  "function comRates(uint256) view returns (uint256)",
  "function difficulty() view returns (uint256)",
  "function uid(address) view returns (uint256)",
  "function aToId(uint256) view returns (address)",
  "function uBal(address) view returns (uint256)",
  "function fBal(address) view returns (uint256)",
  "function pol(address) view returns (uint256)"
];

// ABI complet de FitiaMiningV3_Mine (V3.2 avec custom errors & shopExpiry)
const MINE_ABI = [
  "function buyMachine(uint256 t)",
  "function buyMachineFTA(uint256 t)",
  "function buyBattery(uint256 t)",
  "function buyBatteryFTA(uint256 t)",
  "function plugInMachine(uint256 mi, uint256 bi)",
  "function claimRewards()",
  "function powerOf(address u) view returns (uint256)",
  "function mCount() view returns (uint256)",
  "function bCount() view returns (uint256)",
  "function getMType(uint256) view returns (uint256 price, uint256 power, uint256 shopExpiry)",
  "function getBType(uint256) view returns (uint256 price, uint256 dur)",
  "function myMachines(address u) view returns (tuple(uint256 tid, uint256 exp)[])",
  "function myBattery(address u, uint256 t) view returns (uint256)",
  "function myInfo(address u) view returns (uint256 mc, uint256 ap, uint256 lc)",
  "error Z()",
  "error AM0()",
  "error BadType()",
  "error MaxM()",
  "error NoM()",
  "error Running()",
  "error NoBat()",
  "error InsF(string w)",
  "error FeesH()",
  "error NotOwner()",
  "error RefNoM()",
  "error Expired(string w)"
];

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function transfer(address,uint256) returns (bool)"
];

const QUICKSWAP_ROUTER_ABI = [
  "function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[] amounts)",
  "function swapExactETHForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline) payable returns (uint256[] amounts)",
  "function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[] amounts)"
];
const QUICKSWAP_FACTORY_ABI = [
  "function getPair(address tokenA, address tokenB) view returns (address pair)"
];
const QUICKSWAP_PAIR_ABI = [
  "function token0() view returns (address)",
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)"
];

const SWAP_FEE_RATE = 0.04;
const SLIPPAGE = 0.005;
const DEX_SLIPPAGE_BPS = 50n;
const BPS_DENOMINATOR = 10000n;
const DEX_DEADLINE_SECONDS = 600;

// ═══════════════════════════════════════════════════════════════════
//  CLASSE PRINCIPALE : Application Autonome
// ═══════════════════════════════════════════════════════════════════
class Application {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.user = null;
    this.myReferralCode = '';

    this.core = null;
    this.mine = null;
    this.usdtToken = null;
    this.ftaToken = null;
    this.quickswapRouter = null;
    this.quickswapFactory = null;
    this.activity = new FitiaActivityCenter({
      explorer: CONFIG.EXPLORER,
      formatError: (error) => this.getErrorMessage(error)
    });

    this.payMode = 'USDT';
    this.shopViewMode = 'machines';
    this.swapMarket = 'CORE_FTA';
    this.swapDirection = 'USDT_TO_FTA';
    this.dexQuoteRequestId = 0;
    this.pendingDexQuote = null;
    this.swapTransactionInProgress = false;
    this.plugTransactionInProgress = false;

    this.usdtDecimals = 6;
    this.ftaDecimals = 8;

    // Soldes en cache (Portefeuille Polygon on-chain vs Compte Minage Core)
    this.balances = {
      nativePol: 0,
      walletUsdt: 0,
      walletFta: 0,
      coreUsdt: 0,
      coreFta: 0,
      corePol: 0
    };

    this.polPriceUsd = 0;
    this.ftaPriceUsd = 0;
    this.claimFeePercent = 0;
    this.totalFeeRateFta = 0; // devFee + comRates(0..2)
    this.currentRealPower = 0;
    this.pendingBalance = 0;
    this.onChainLastClaim = 0;

    this.shopMachinesData = [];
    this.shopBatteriesData = [];
    this.isLoadingShop = false;

    this.userMachines = [];
    this.batteryInventory = {};
    this.batteryTypeDurations = {};

    this.miningTimer = null;
    this.refreshInterval = null;
    this.lockoutTimer = null;
    this.backgroundedAt = 0;
    this.availableUpdate = null;
    this.updateCheckInFlight = false;

    this.vizContext = null;
    this.vizBars = [];

    // États d'onboarding / PIN
    this.pendingWalletSecret = null; // { address, privateKey, mnemonic }
    this.pendingWalletOrigin = 'create'; // 'create' | 'import' | 'changepin'
    this.importMode = 'seed'; // 'seed' | 'pk'
    this.seedBlurred = true;
    this.quizQuestions = [];
    this.quizAnswers = {};
    this.setPinStage = 'first'; // 'first' | 'confirm'
    this.setPinFirstValue = '';
    this.setPinBuffer = '';
    this.unlockPinBuffer = '';
    this.confirmPinBuffer = '';
    this.pinVerifyResolver = null;
    this.revealedSecretText = '';

    const savedLang = localStorage.getItem('fitia_lang');
    this.currentLang = savedLang && i18n[savedLang] ? savedLang : 'fr';
    this.announcementCenter = new FitiaAnnouncementCenter(this);
    this.promotionCenter = new FitiaPromotionCenter(this);

    this.chatInitialized = false;
    this.chatHistory = [];
    this.prevPriceCheckpoint = {};
    this.priceCheckpointTime = 0;
  }

  // ─── Traduction avec fallback multi-niveaux ──────────────────────
  t(key) {
    return i18n[this.currentLang]?.[key] || i18n.fr[key] || i18n.en[key] || key;
  }

  formatUsd(v) {
    const num = Number.isFinite(v) ? v : 0;
    return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  formatHashrate(h) {
    if (h <= 0) return '0 H/s';
    const units = ['nH/s', 'µH/s', 'mH/s', 'H/s', 'KH/s', 'MH/s', 'GH/s', 'TH/s', 'PH/s'];
    let value = h, unitIndex = 3;
    while (value < 1 && unitIndex > 0) { value *= 1000; unitIndex--; }
    while (value >= 1000 && unitIndex < units.length - 1) { value /= 1000; unitIndex++; }
    return value.toFixed(2) + ' ' + units[unitIndex];
  }

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

  shortAddr(addr) {
    if (!addr || addr.length < 12) return addr || '0x...';
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  }

  getBatteryDuration(typeId) {
    if (this.batteryTypeDurations[typeId] !== undefined) return this.batteryTypeDurations[typeId];
    const fallback = { 0: 3, 1: 7, 2: 15, 3: 30, 4: 90, 5: 180, 6: 270, 7: 365 };
    return fallback[typeId] || 30;
  }

  getMachineTierName(tier) {
    const tierNames = ['MK-I', 'MK-II', 'MK-III', 'MK-IV', 'MK-V', 'MK-VI', 'MK-VII', 'MK-VIII'];
    const index = Math.abs(Math.trunc(Number(tier) || 0)) % tierNames.length;
    return tierNames[index];
  }

  getPlugBatteryVisual(days) {
    const duration = Number.isFinite(Number(days)) ? Number(days) : 0;
    return `<span class="real-battery" aria-hidden="true">
      <span class="battery-cap"></span>
      <span class="battery-body">
        <span class="battery-level" style="width:85%"></span>
        <span class="battery-charge-indicator">${duration}J</span>
      </span>
    </span>`;
  }

  // ═══════════════════════════════════════════════════════════════
  //  INITIALISATION & CYCLE DE VIE DU PORTEFEUILLE AUTONOME
  // ═══════════════════════════════════════════════════════════════
  async init() {
    this.setLanguage(this.currentLang);
    this.announcementCenter.init();
    this.promotionCenter.init();
    this.setupLifecycleListeners();

    // Masquer les bannières de téléchargement APK lorsqu'on est déjà dans l'APK Android installé
    if (FitiaSecurity.Native.isNativeApk()) {
      document.getElementById('welcome-apk-download')?.classList.add('hidden');
      document.getElementById('sec-apk-download-btn')?.classList.add('hidden');
    }

    const meta = await FitiaSecurity.Vault.init();
    if (meta.exists) {
      await this.openUnlockScreen(meta);
    } else {
      this.showAuthStep('welcome');
    }
  }

  normalizeUpdateManifest(raw) {
    if (!raw || raw.enabled !== true) return null;
    const versionCode = Number(raw.versionCode);
    if (!Number.isSafeInteger(versionCode) || versionCode <= 0) return null;
    const versionName = String(raw.versionName || '').trim();
    const sha256 = String(raw.sha256 || '').toLowerCase();
    if (!/^[0-9A-Za-z.-]{1,24}$/.test(versionName) || !/^[0-9a-f]{64}$/.test(sha256)) return null;
    try {
      const apkUrl = new URL(String(raw.apkUrl || ''));
      if (apkUrl.protocol !== 'https:' || apkUrl.hostname !== 'github.com' || apkUrl.username || apkUrl.password) return null;
      if ((apkUrl.port && apkUrl.port !== '443') || !apkUrl.pathname.startsWith('/web3service/fitia-mining-pro/releases/download/') || !apkUrl.pathname.endsWith('.apk')) return null;
      return {
        versionCode,
        versionName,
        apkUrl: apkUrl.href,
        sha256
      };
    } catch (_) {
      return null;
    }
  }

  async checkForUpdates(manual = false) {
    if (this.updateCheckInFlight || !FitiaSecurity.Native.isNativeApk()) return;
    const installedVersionCode = FitiaSecurity.Native.getAppVersionCode();
    if (!installedVersionCode) return;
    this.updateCheckInFlight = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(CONFIG.UPDATE_MANIFEST, {
        cache: 'no-store',
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      if (!response.ok) throw new Error('UPDATE_UNAVAILABLE');
      const update = this.normalizeUpdateManifest(await response.json());
      if (!update || update.versionCode <= installedVersionCode) {
        if (manual) this.showToast(this.t('updateLatest'));
        return;
      }
      this.showUpdateModal(update);
    } catch (_) {
      if (manual) this.showToast(this.t('updateCheckFailed'), true);
    } finally {
      clearTimeout(timeout);
      this.updateCheckInFlight = false;
    }
  }

  showUpdateModal(update) {
    if (!update) return;
    this.availableUpdate = update;
    localStorage.removeItem('fitia_update_dismissed_code');
    document.getElementById('update-required-message').textContent = this.t('updateRequiredMessage');
    document.getElementById('modal-update').classList.add('active');
  }

  startUpdateDownload() {
    const update = this.availableUpdate;
    if (!update) return;
    const started = FitiaSecurity.Native.downloadAndInstallUpdate(update.apkUrl, update.sha256);
    if (!started) {
      this.showToast(this.t('updateStartError'), true);
      return;
    }
    // La mise à jour reste obligatoire jusqu'à l'installation effective de la nouvelle version.
    this.showToast(this.t('updateDownloading'));
  }

  setupLifecycleListeners() {
    // Fermer le menu langue en cliquant ailleurs
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#lang-selector')) {
        document.getElementById('lang-menu-content')?.classList.remove('open');
      }
    });

    // Verrouillage automatique (arrière-plan ET inactivité à l'écran)
    this.lastUserActivityAt = Date.now();
    ['pointerdown', 'touchstart', 'keydown'].forEach((evt) => {
      document.addEventListener(evt, () => { this.lastUserActivityAt = Date.now(); }, { passive: true });
    });

    setInterval(() => {
      if (!this.user) return;
      const settings = FitiaSecurity.Vault.getSettings();
      const mins = Number(settings.autoLockMinutes);
      if (mins > 0 && (Date.now() - this.lastUserActivityAt) >= mins * 60 * 1000) {
        this.lockWallet(true);
      }
    }, 15000);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.announcementCenter.stop();
        this.backgroundedAt = Date.now();
        FitiaSecurity.Native.setScreenSecure(true);
      } else if (this.user && this.backgroundedAt > 0) {
        const settings = FitiaSecurity.Vault.getSettings();
        const mins = Number(settings.autoLockMinutes);
        if (mins > 0 && (Date.now() - this.backgroundedAt) >= mins * 60 * 1000) {
          this.lockWallet(true);
        } else {
          FitiaSecurity.Native.setScreenSecure(false);
          this.activity.refreshPending(this.provider);
        }
        if (this.user) this.announcementCenter.start();
        this.backgroundedAt = 0;
      }
    });

    // Support du clavier physique sur ordinateur (pratique en aperçu Web)
    document.addEventListener('keydown', (e) => {
      const confirmModal = document.getElementById('modal-pin-confirm');
      if (confirmModal && confirmModal.classList.contains('active')) {
        if (/^\d$/.test(e.key)) this.onConfirmPinDigit(e.key);
        else if (e.key === 'Backspace') this.onConfirmPinBackspace();
        else if (e.key === 'Escape') this.cancelPinVerification();
        return;
      }
      const authScreen = document.getElementById('auth-screen');
      if (authScreen && !authScreen.classList.contains('hidden')) {
        const unlockStep = document.getElementById('auth-step-unlock');
        const setpinStep = document.getElementById('auth-step-setpin');
        if (unlockStep && !unlockStep.classList.contains('hidden')) {
          if (/^\d$/.test(e.key)) this.onUnlockDigit(e.key);
          else if (e.key === 'Backspace') this.onUnlockBackspace();
        } else if (setpinStep && !setpinStep.classList.contains('hidden')) {
          if (/^\d$/.test(e.key)) this.onSetPinDigit(e.key);
          else if (e.key === 'Backspace') this.onSetPinBackspace();
        }
      }
    });

    // Gestionnaire du bouton Retour matériel Android (appelé par MainActivity.java)
    window.onAndroidBackPressed = () => {
      if (document.getElementById('modal-update')?.classList.contains('active')) {
        return true;
      }
      const confirmModal = document.getElementById('modal-pin-confirm');
      if (confirmModal?.classList.contains('active')) {
        this.cancelPinVerification();
        return true;
      }
      const revealModal = document.getElementById('modal-secret-reveal');
      if (revealModal?.classList.contains('active')) {
        this.closeRevealModal();
        return true;
      }
      const anyModal = document.querySelector('.modal.active');
      if (anyModal) {
        this.closeModals();
        return true;
      }
      const chatPanel = document.getElementById('chat-panel');
      if (chatPanel?.classList.contains('active')) {
        this.toggleChat();
        return true;
      }
      const dash = document.getElementById('view-dashboard');
      if (this.user && dash && !dash.classList.contains('active')) {
        const homeBtn = document.querySelector('.nav-item[data-nav="dashboard"]');
        this.nav('dashboard', homeBtn);
        return true;
      }
      return false;
    };
  }

  toggleLangMenu(e) {
    e?.stopPropagation();
    document.getElementById('lang-menu-content')?.classList.toggle('open');
  }

  setLanguage(lang) {
    if (!i18n[lang]) return;
    this.currentLang = lang;
    localStorage.setItem('fitia_lang', lang);
    const flags = { en: '🇬🇧', fr: '🇫🇷', de: '🇩🇪', zh: '🇨🇳', sg: '🇸🇬' };
    const btn = document.getElementById('lang-btn-display');
    if (btn) btn.innerText = `${flags[lang]} ${lang.toUpperCase()}`;
    document.getElementById('lang-menu-content')?.classList.remove('open');
    this.applyTranslations();
    const isDexSwap = this.swapMarket === 'POL_USDT';
    const swapImpactLabel = document.getElementById('swap-detail-impact-label');
    const swapFeeLabel = document.getElementById('swap-detail-fee-label');
    if (swapImpactLabel) swapImpactLabel.textContent = this.t(isDexSwap ? 'priceImpactWithFee' : 'priceImpact');
    if (swapFeeLabel) swapFeeLabel.textContent = this.t(isDexSwap ? 'dexFeeLabel' : 'swapFee');
    if (isDexSwap && this.pendingDexQuote) {
      document.getElementById('swap-rate').textContent = this.t('quickswapRateInfo');
    }
    if (this.announcementCenter?.initialized) this.announcementCenter.render();
    if (this.user) {
      this.renderShop();
      this.renderActiveMachines();
      this.renderUserMachines();
      this.renderUserBatteries();
      this.renderPlugInterface();
    }
  }

  applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (key) el.textContent = this.t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) el.placeholder = this.t(key);
    });
  }

  // ═══════════════════════════════════════════════════════════════
  //  NAVIGATION DES ÉCRANS D'AUTHENTIFICATION & CRÉATION WALLET
  // ═══════════════════════════════════════════════════════════════
  showAuthStep(stepName) {
    // Active FLAG_SECURE contre les captures d'écran sur tous les écrans sensibles (création, 12 mots, PIN)
    FitiaSecurity.Native.setScreenSecure(true);
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('app-shell').classList.add('hidden');
    document.getElementById('chat-fab-btn')?.classList.add('hidden');

    const steps = ['welcome', 'backup', 'verify', 'import', 'setpin', 'unlock'];
    steps.forEach((s) => {
      const el = document.getElementById(`auth-step-${s}`);
      if (el) el.classList.toggle('hidden', s !== stepName);
    });
  }

  // ─── 1. Créer un nouveau portefeuille 12 mots ────────────────────
  startCreateWallet() {
    FitiaSecurity.Native.vibrate(20);
    const created = FitiaSecurity.Vault.generateNewWallet();
    this.pendingWalletSecret = created;
    this.pendingWalletOrigin = 'create';
    this.seedBlurred = true;

    document.getElementById('create-addr-preview').textContent = this.shortAddr(created.address);
    const grid = document.getElementById('seed-words-grid');
    grid.classList.add('blurred');
    const words = created.mnemonic.split(' ');
    grid.innerHTML = words.map((w, idx) => `
      <div class="seed-word-chip">
        <span class="seed-word-idx">${idx + 1}.</span>
        <span class="seed-word-val">${FitiaSecurity.escapeHtml(w)}</span>
      </div>
    `).join('');

    const toggleBtn = document.getElementById('btn-toggle-seed');
    if (toggleBtn) toggleBtn.innerHTML = `<span>${FitiaSecurity.escapeHtml(this.t('revealWords'))}</span>`;

    const cb = document.getElementById('seed-saved-checkbox');
    cb.checked = false;
    document.getElementById('btn-continue-verify').disabled = true;

    this.showAuthStep('backup');
  }

  toggleSeedBlur() {
    this.seedBlurred = !this.seedBlurred;
    const grid = document.getElementById('seed-words-grid');
    grid.classList.toggle('blurred', this.seedBlurred);
    const toggleBtn = document.getElementById('btn-toggle-seed');
    if (toggleBtn) {
      toggleBtn.innerHTML = `<span>${FitiaSecurity.escapeHtml(this.t(this.seedBlurred ? 'revealWords' : 'hideWords'))}</span>`;
    }
  }

  async copyCreatedSeed() {
    if (!this.pendingWalletSecret?.mnemonic) return;
    this.seedBlurred = false;
    document.getElementById('seed-words-grid').classList.remove('blurred');
    await FitiaSecurity.Native.copySensitive(this.pendingWalletSecret.mnemonic);
    this.showToast(this.t('secretCopied'));
  }

  onSeedCheckboxChange() {
    const checked = document.getElementById('seed-saved-checkbox').checked;
    document.getElementById('btn-continue-verify').disabled = !checked;
  }

  // ─── 2. Quiz de vérification rapide (2 mots sur 12) ──────────────
  goToSeedVerify() {
    if (!this.pendingWalletSecret?.mnemonic) return;
    const words = this.pendingWalletSecret.mnemonic.split(' ');

    // Choisit 2 indices aléatoires distincts
    const indices = [];
    while (indices.length < 2) {
      const r = Math.floor(Math.random() * words.length);
      if (!indices.includes(r)) indices.push(r);
    }
    indices.sort((a, b) => a - b);

    const decoysPool = ['galaxy', 'carbon', 'shield', 'planet', 'anchor', 'crystal', 'velvet', 'harbor', 'matrix', 'rocket', 'timber', 'oxygen'];
    this.quizAnswers = {};
    this.quizQuestions = indices.map((wordIdx) => {
      const correct = words[wordIdx];
      const opts = new Set([correct]);
      // Ajoute d'autres mots de la phrase ou du pool
      const candidates = [...words.filter((w) => w !== correct), ...decoysPool];
      while (opts.size < 4 && candidates.length) {
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        opts.add(pick);
      }
      const shuffled = Array.from(opts).sort(() => Math.random() - 0.5);
      return { wordIdx, correct, options: shuffled };
    });

    this.renderSeedQuiz();
    this.showAuthStep('verify');
  }

  renderSeedQuiz() {
    const container = document.getElementById('seed-quiz-container');
    container.innerHTML = '';
    this.quizQuestions.forEach((q, qIdx) => {
      const card = document.createElement('div');
      card.className = 'quiz-card';
      const title = document.createElement('div');
      title.className = 'quiz-question';
      title.textContent = `${this.t('selectWordNum')}${q.wordIdx + 1}`;
      const optsWrap = document.createElement('div');
      optsWrap.className = 'quiz-options';
      q.options.forEach((opt) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'quiz-opt-btn' + (this.quizAnswers[qIdx] === opt ? ' selected' : '');
        btn.textContent = opt;
        btn.addEventListener('click', () => this.selectQuizOption(qIdx, opt));
        optsWrap.appendChild(btn);
      });
      card.appendChild(title);
      card.appendChild(optsWrap);
      container.appendChild(card);
    });
  }

  selectQuizOption(qIdx, word) {
    FitiaSecurity.Native.vibrate(15);
    this.quizAnswers[qIdx] = word;
    this.renderSeedQuiz();
  }

  completeSeedVerify() {
    for (let i = 0; i < this.quizQuestions.length; i++) {
      if (this.quizAnswers[i] !== this.quizQuestions[i].correct) {
        FitiaSecurity.Native.vibrate(60);
        return this.showToast(this.t('quizWrong'), true);
      }
    }
    this.openSetPinScreen('create');
  }

  // ─── 3. Importer un portefeuille existant ────────────────────────
  startImportWallet(fromLock = false) {
    this.importFromLock = fromLock;
    this.pendingWalletSecret = null;
    this.pendingWalletOrigin = 'import';
    document.getElementById('import-secret-input').value = '';
    document.getElementById('import-detected-box').classList.add('hidden');
    document.getElementById('btn-import-continue').disabled = true;
    this.setImportMode('seed');
    this.showAuthStep('import');
  }

  cancelImportFlow() {
    const meta = FitiaSecurity.Vault.getMetadata();
    if (this.importFromLock && meta.exists) {
      this.openUnlockScreen(meta);
    } else {
      this.showAuthStep('welcome');
    }
  }

  setImportMode(mode) {
    this.importMode = mode;
    document.getElementById('tab-import-seed').classList.toggle('active', mode === 'seed');
    document.getElementById('tab-import-pk').classList.toggle('active', mode === 'pk');
    const hint = document.getElementById('import-hint-text');
    const input = document.getElementById('import-secret-input');
    if (mode === 'seed') {
      hint.textContent = this.t('importSeedHint');
      input.placeholder = "word1 word2 word3 ...";
    } else {
      hint.textContent = this.t('importPkHint');
      input.placeholder = "0x...";
    }
    this.onImportInputChange();
  }

  async pasteIntoImport() {
    try {
      if (navigator.clipboard?.readText) {
        const txt = await navigator.clipboard.readText();
        if (txt) {
          document.getElementById('import-secret-input').value = txt.trim();
          this.onImportInputChange();
        }
      }
    } catch (_) {
      this.showToast("Appuyez longuement dans le champ pour coller.");
    }
  }

  onImportInputChange() {
    const val = document.getElementById('import-secret-input').value.trim();
    const box = document.getElementById('import-detected-box');
    const addrEl = document.getElementById('import-detected-addr');
    const btn = document.getElementById('btn-import-continue');

    if (!val) {
      this.pendingWalletSecret = null;
      box.classList.add('hidden');
      btn.disabled = true;
      return;
    }

    try {
      const parsed = this.importMode === 'seed'
        ? FitiaSecurity.Vault.parseMnemonic(val)
        : FitiaSecurity.Vault.parsePrivateKey(val);
      this.pendingWalletSecret = parsed;
      addrEl.textContent = parsed.address;
      box.classList.remove('hidden');
      btn.disabled = false;
    } catch (_) {
      this.pendingWalletSecret = null;
      box.classList.add('hidden');
      btn.disabled = true;
    }
  }

  submitImportSecret() {
    if (!this.pendingWalletSecret) return;
    this.openSetPinScreen('import');
  }

  // ─── 4. Création & Confirmation du Code PIN à 6 chiffres ─────────
  openSetPinScreen(origin) {
    this.pendingWalletOrigin = origin;
    this.setPinStage = 'first';
    this.setPinFirstValue = '';
    this.setPinBuffer = '';
    document.getElementById('setpin-title').textContent = this.t('createPinTitle');
    document.getElementById('setpin-subtitle').textContent = this.t('createPinDesc');
    document.getElementById('setpin-error').textContent = '';
    this.updateDotsUI('setpin-dots', 0);
    this.showAuthStep('setpin');
  }

  backFromSetPin() {
    if (this.pendingWalletOrigin === 'changepin') {
      if (this.pendingWalletSecret) {
        this.pendingWalletSecret.privateKey = '';
        this.pendingWalletSecret.mnemonic = '';
        this.pendingWalletSecret = null;
      }
      FitiaSecurity.Native.setScreenSecure(false);
      document.getElementById('auth-screen').classList.add('hidden');
      document.getElementById('app-shell').classList.remove('hidden');
      document.getElementById('chat-fab-btn')?.classList.remove('hidden');
      return;
    }
    if (this.pendingWalletOrigin === 'import') {
      this.showAuthStep('import');
    } else {
      this.showAuthStep('verify');
    }
  }

  updateDotsUI(containerId, count, shake = false) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const spans = el.querySelectorAll('span');
    spans.forEach((s, i) => s.classList.toggle('filled', i < count));
    if (shake) {
      el.classList.remove('shake');
      void el.offsetWidth;
      el.classList.add('shake');
    }
  }

  async onSetPinDigit(d) {
    if (this.setPinBuffer.length >= 6) return;
    FitiaSecurity.Native.vibrate(15);
    this.setPinBuffer += d;
    document.getElementById('setpin-error').textContent = '';
    this.updateDotsUI('setpin-dots', this.setPinBuffer.length);

    if (this.setPinBuffer.length === 6) {
      if (this.setPinStage === 'first') {
        if (FitiaSecurity.Vault.isWeakPin(this.setPinBuffer)) {
          FitiaSecurity.Native.vibrate(70);
          this.setPinBuffer = '';
          document.getElementById('setpin-error').textContent = this.t('weakPinErr');
          this.updateDotsUI('setpin-dots', 0, true);
          return;
        }
        this.setPinFirstValue = this.setPinBuffer;
        this.setPinBuffer = '';
        this.setPinStage = 'confirm';
        setTimeout(() => {
          document.getElementById('setpin-title').textContent = this.t('confirmPinTitle');
          document.getElementById('setpin-subtitle').textContent = this.t('confirmPinDesc');
          this.updateDotsUI('setpin-dots', 0);
        }, 160);
      } else {
        if (this.setPinBuffer !== this.setPinFirstValue) {
          FitiaSecurity.Native.vibrate(70);
          this.setPinStage = 'first';
          this.setPinFirstValue = '';
          this.setPinBuffer = '';
          document.getElementById('setpin-title').textContent = this.t('createPinTitle');
          document.getElementById('setpin-subtitle').textContent = this.t('createPinDesc');
          document.getElementById('setpin-error').textContent = this.t('pinMismatch');
          this.updateDotsUI('setpin-dots', 0, true);
          return;
        }

        // Sauvegarde chiffrée AES-256-GCM !
        const finalPin = this.setPinBuffer;
        this.setPinBuffer = '';
        this.setPinFirstValue = '';
        this.setLoader(true, "Chiffrement AES-256-GCM...");
        try {
          await FitiaSecurity.Vault.saveVault(this.pendingWalletSecret, finalPin);
          const secretCopy = { ...this.pendingWalletSecret };
          this.pendingWalletSecret = null;

          if (this.pendingWalletOrigin === 'changepin') {
            this.setLoader(false);
            FitiaSecurity.Native.setScreenSecure(false);
            document.getElementById('auth-screen').classList.add('hidden');
            document.getElementById('app-shell').classList.remove('hidden');
            document.getElementById('chat-fab-btn')?.classList.remove('hidden');
            this.showToast(this.t('pinChangedSuccess'));
            return;
          }

          await this.activateUnlockedSession(secretCopy);
          this.showToast(this.t('walletReady'));
        } catch (err) {
          this.showError(err);
        } finally {
          this.setLoader(false);
        }
      }
    }
  }

  onSetPinBackspace() {
    if (!this.setPinBuffer.length) return;
    FitiaSecurity.Native.vibrate(12);
    this.setPinBuffer = this.setPinBuffer.slice(0, -1);
    this.updateDotsUI('setpin-dots', this.setPinBuffer.length);
  }

  // ─── 5. Déverrouillage du Portefeuille Existant ──────────────────
  async openUnlockScreen(meta = null) {
    const m = meta || FitiaSecurity.Vault.getMetadata();
    this.unlockPinBuffer = '';
    document.getElementById('unlock-addr-badge').textContent = this.shortAddr(m.address);
    document.getElementById('unlock-error-msg').textContent = '';
    this.updateDotsUI('unlock-dots', 0);

    const bioSupported = await FitiaSecurity.Vault.isBiometricSupported();
    const showBio = bioSupported && m.biometricEnabled;
    document.getElementById('btn-unlock-bio')?.classList.toggle('hidden', !showBio);
    document.getElementById('btn-unlock-spacer')?.classList.toggle('hidden', showBio);

    this.showAuthStep('unlock');
    this.startLockoutCountdownIfNeeded();

    if (showBio && FitiaSecurity.Vault.getLockoutRemainingSec() === 0) {
      setTimeout(() => this.triggerBiometricUnlock(true), 250);
    }
  }

  startLockoutCountdownIfNeeded() {
    if (this.lockoutTimer) clearInterval(this.lockoutTimer);
    const update = () => {
      const rem = FitiaSecurity.Vault.getLockoutRemainingSec();
      const errEl = document.getElementById('unlock-error-msg');
      if (rem > 0) {
        if (errEl) errEl.textContent = this.t('lockedOutMsg').replace('{s}', rem);
      } else if (this.lockoutTimer) {
        clearInterval(this.lockoutTimer);
        this.lockoutTimer = null;
        if (errEl && errEl.textContent.includes('s')) errEl.textContent = '';
      }
    };
    update();
    if (FitiaSecurity.Vault.getLockoutRemainingSec() > 0) {
      this.lockoutTimer = setInterval(update, 1000);
    }
  }

  async onUnlockDigit(d) {
    if (FitiaSecurity.Vault.getLockoutRemainingSec() > 0) {
      this.startLockoutCountdownIfNeeded();
      return;
    }
    if (this.unlockPinBuffer.length >= 6) return;
    FitiaSecurity.Native.vibrate(15);
    this.unlockPinBuffer += d;
    document.getElementById('unlock-error-msg').textContent = '';
    this.updateDotsUI('unlock-dots', this.unlockPinBuffer.length);

    if (this.unlockPinBuffer.length === 6) {
      const pinAttempt = this.unlockPinBuffer;
      this.unlockPinBuffer = '';
      try {
        const secret = await FitiaSecurity.Vault.unlockWithPin(pinAttempt);
        this.setLoader(true, "Connexion directe à Polygon...");
        await this.activateUnlockedSession(secret);
      } catch (err) {
        FitiaSecurity.Native.vibrate(70);
        this.updateDotsUI('unlock-dots', 0, true);
        if (err.code === 'LOCKED_OUT' || err.remainingSec > 0) {
          this.startLockoutCountdownIfNeeded();
        } else {
          const left = err.attemptsLeft !== undefined && err.attemptsLeft > 0 ? ` (${err.attemptsLeft})` : '';
          document.getElementById('unlock-error-msg').textContent = this.t('wrongPin') + left;
        }
      } finally {
        this.setLoader(false);
      }
    }
  }

  onUnlockBackspace() {
    if (!this.unlockPinBuffer.length) return;
    FitiaSecurity.Native.vibrate(12);
    this.unlockPinBuffer = this.unlockPinBuffer.slice(0, -1);
    this.updateDotsUI('unlock-dots', this.unlockPinBuffer.length);
  }

  async triggerBiometricUnlock(silent = false) {
    try {
      const secret = await FitiaSecurity.Vault.unlockWithBiometric();
      this.setLoader(true, "Connexion directe à Polygon...");
      await this.activateUnlockedSession(secret);
    } catch (e) {
      if (!silent) this.showToast("Vérification biométrique annulée. Utilisez votre code PIN.", true);
    } finally {
      this.setLoader(false);
    }
  }

  promptRestoreFromLock() {
    this.startImportWallet(true);
  }

  // ─── Verrouiller le portefeuille (efface la clé de la RAM) ───────
  lockWallet(silent = false) {
    // 1) Purge immédiate et atomique de toutes les clés & secrets en RAM
    this.pendingWalletSecret = null;
    this.revealedSecretText = '';
    this.signer = null;
    this.user = null;
    this.myReferralCode = '';
    const referralCodeLabel = document.getElementById('my-ref-id-label');
    if (referralCodeLabel) referralCodeLabel.textContent = '—';
    this.core = null;
    this.mine = null;
    this.usdtToken = null;
    this.ftaToken = null;
    this.quickswapRouter = null;
    this.quickswapFactory = null;
    this.pendingDexQuote = null;
    this.dexQuoteRequestId += 1;
    this.swapTransactionInProgress = false;
    this.plugTransactionInProgress = false;
    const plugMachineInput = document.getElementById('plug-machine-id');
    const plugBatteryInput = document.getElementById('plug-battery-type');
    if (plugMachineInput) plugMachineInput.value = '';
    if (plugBatteryInput) plugBatteryInput.value = '';

    // 2) Réactivation immédiate de FLAG_SECURE puis fermeture des modales
    FitiaSecurity.Native.setScreenSecure(true);
    this.cancelPinVerification();
    this.closeModals();
    this.closeRevealModal();
    this.stopMiningCounter();
    this.announcementCenter.stop();
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    this.openUnlockScreen();
    if (!silent) this.showToast(this.t('walletLocked'));
  }

  // ═══════════════════════════════════════════════════════════════
  //  HISTORIQUE & NOTIFICATIONS DES TRANSACTIONS
  // ═══════════════════════════════════════════════════════════════
  openActivity(tab = 'history') {
    if (!this.user) return;
    this.closeModals();
    this.activity.setTab(tab);
    document.getElementById('modal-activity')?.classList.add('active');
  }

  shortActivityAddress(address) {
    const value = String(address || '');
    return value.length === 42 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
  }

  formatActivityAmount(value, decimals) {
    const formatted = ethers.formatUnits(value ?? 0, decimals);
    return formatted.includes('.') ? formatted.replace(/\.?0+$/, '') : formatted;
  }

  describeActivityTransaction(txRequest = {}) {
    const to = String(txRequest.to || '').toLowerCase();
    const data = typeof txRequest.data === 'string' ? txRequest.data : '0x';
    let hasValue = false;
    try { hasValue = BigInt(txRequest.value ?? 0) > 0n; } catch (_) { /* Le fallback reste non financier. */ }
    const fallback = {
      type: hasValue && (!data || data === '0x') ? 'send' : 'other',
      title: hasValue && (!data || data === '0x') ? 'Envoi de POL' : 'Interaction Polygon',
      description: to ? `${hasValue && (!data || data === '0x') ? 'Vers' : 'Contrat'} ${this.shortActivityAddress(to)}` : 'Transaction sur le réseau Polygon',
      amount: '',
      token: hasValue && (!data || data === '0x') ? 'POL' : '',
      to
    };

    try {
      if (fallback.type === 'send') {
        fallback.amount = this.formatActivityAmount(txRequest.value || 0, 18);
        return fallback;
      }
      if (!data || data === '0x') return fallback;

      const candidates = [
        { address: CONFIG.CORE, contract: this.core, kind: 'core' },
        { address: CONFIG.MINE, contract: this.mine, kind: 'mine' },
        { address: CONFIG.USDT, contract: this.usdtToken, kind: 'USDT' },
        { address: CONFIG.FTA, contract: this.ftaToken, kind: 'FTA' },
        { address: CONFIG.QUICKSWAP_ROUTER, contract: this.quickswapRouter, kind: 'quickswap' }
      ];
      const matched = candidates.find((item) => String(item.address).toLowerCase() === to && item.contract);
      if (!matched) return fallback;
      const parsed = matched.contract.interface.parseTransaction({ data, value: txRequest.value || 0 });
      if (!parsed) return fallback;
      const args = parsed.args;
      const result = { ...fallback, title: `Interaction ${parsed.name}` };
      const tokenDecimals = matched.kind === 'USDT' ? this.usdtDecimals : this.ftaDecimals;

      if (matched.kind === 'USDT' || matched.kind === 'FTA') {
        result.token = matched.kind;
        if (parsed.name === 'transfer') {
          result.type = 'send';
          result.title = `Envoi de ${matched.kind}`;
          result.amount = this.formatActivityAmount(args[1], tokenDecimals);
          result.description = `Vers ${this.shortActivityAddress(args[0])}`;
        } else if (parsed.name === 'approve') {
          result.type = 'approval';
          result.title = `Autorisation ${matched.kind}`;
          result.amount = this.formatActivityAmount(args[1], tokenDecimals);
          result.description = `Dépense autorisée à ${this.shortActivityAddress(args[0])}`;
        }
        return result;
      }

      if (matched.kind === 'quickswap') {
        if (parsed.name === 'swapExactETHForTokens') {
          return {
            ...result,
            type: 'swap',
            title: 'Swap POL → USDT',
            token: 'POL',
            amount: this.formatActivityAmount(txRequest.value || 0, 18),
            description: 'Échange via QuickSwap V2'
          };
        }
        if (parsed.name === 'swapExactTokensForETH') {
          return {
            ...result,
            type: 'swap',
            title: 'Swap USDT → POL',
            token: 'USDT',
            amount: this.formatActivityAmount(args[0], this.usdtDecimals),
            description: 'Échange via QuickSwap V2'
          };
        }
        return result;
      }

      if (matched.kind === 'core') {
        const coreOperations = {
          depositUsdt: ['deposit', 'Dépôt USDT', 'USDT', this.usdtDecimals, 'Portefeuille → Compte Minage'],
          depositFta: ['deposit', 'Dépôt FTA', 'FTA', this.ftaDecimals, 'Portefeuille → Compte Minage'],
          withdrawUsdt: ['withdraw', 'Retrait USDT', 'USDT', this.usdtDecimals, 'Compte Minage → Portefeuille'],
          withdrawFta: ['withdraw', 'Retrait FTA', 'FTA', this.ftaDecimals, 'Compte Minage → Portefeuille'],
          withdrawPol: ['withdraw', 'Retrait POL', 'POL', 18, 'Compte Minage → Portefeuille'],
          swapUForF: ['swap', 'Swap USDT → FTA', 'USDT', this.usdtDecimals, 'Échange via FITIA Core'],
          swapFForU: ['swap', 'Swap FTA → USDT', 'FTA', this.ftaDecimals, 'Échange via FITIA Core']
        };
        if (coreOperations[parsed.name]) {
          const [type, title, token, decimals, description] = coreOperations[parsed.name];
          return { ...result, type, title, token, description, amount: this.formatActivityAmount(args[0], decimals) };
        }
        if (parsed.name === 'depositPol') {
          return { ...result, type: 'deposit', title: 'Dépôt POL', token: 'POL', description: 'Portefeuille → Compte Minage', amount: this.formatActivityAmount(txRequest.value || 0, 18) };
        }
        if (parsed.name === 'setReferrer') {
          return { ...result, type: 'referral', title: 'Parrainage enregistré', description: `Parrain ${this.shortActivityAddress(args[0])}` };
        }
        if (parsed.name === 'setReferrerById') {
          return { ...result, type: 'referral', title: 'Parrainage enregistré', description: `ID parrain #${args[0].toString()}` };
        }
        return result;
      }

      if (matched.kind === 'mine') {
        if (parsed.name === 'buyMachine' || parsed.name === 'buyMachineFTA') {
          const token = parsed.name === 'buyMachineFTA' ? 'FTA' : 'USDT';
          const priceRaw = this.shopMachinesData[Number(args[0])]?.priceRaw;
          return {
            ...result,
            type: 'purchase',
            title: 'Achat de machine',
            description: `Machine de type ${Number(args[0]) + 1}`,
            token,
            amount: token === 'USDT' && priceRaw != null ? this.formatActivityAmount(priceRaw, this.usdtDecimals) : ''
          };
        }
        if (parsed.name === 'buyBattery' || parsed.name === 'buyBatteryFTA') {
          const token = parsed.name === 'buyBatteryFTA' ? 'FTA' : 'USDT';
          const priceRaw = this.shopBatteriesData[Number(args[0])]?.priceRaw;
          return {
            ...result,
            type: 'purchase',
            title: 'Achat de batterie',
            description: `Batterie de type ${Number(args[0]) + 1}`,
            token,
            amount: token === 'USDT' && priceRaw != null ? this.formatActivityAmount(priceRaw, this.usdtDecimals) : ''
          };
        }
        if (parsed.name === 'plugInMachine') {
          return {
            ...result,
            type: 'mining',
            title: 'Connexion de machine',
            description: `Machine #${Number(args[0]) + 1} • Batterie type ${Number(args[1]) + 1}`
          };
        }
        if (parsed.name === 'claimRewards') {
          return {
            ...result,
            type: 'claim',
            title: 'Réclamation des récompenses',
            description: 'Récompenses de minage FITIA',
            token: 'FTA',
            amount: this.pendingBalance > 0 ? this.pendingBalance.toFixed(this.ftaDecimals) : ''
          };
        }
      }
      return result;
    } catch (_) {
      return fallback;
    }
  }

  installActivityTracking() {
    const signer = this.signer;
    if (!signer || signer.__fitiaActivityTracking || typeof signer.sendTransaction !== 'function') return;
    const originalSendTransaction = signer.sendTransaction;
    const app = this;
    Object.defineProperty(signer, '__fitiaActivityTracking', { value: true, configurable: true });
    signer.sendTransaction = async function (txRequest) {
      const metadata = app.describeActivityTransaction(txRequest);
      const tx = await originalSendTransaction.call(this, txRequest);
      try {
        app.activity.track(tx, metadata);
      } catch (error) {
        console.error('Erreur historique local:', error);
      }
      return tx;
    };
  }

  // ═══════════════════════════════════════════════════════════════
  //  ACTIVATION DE LA SESSION BLOCKCHAIN POLYGON (SANS WALLET EXTERNE)
  // ═══════════════════════════════════════════════════════════════
  async activateUnlockedSession(secret) {
    const conn = await FitiaSecurity.Rpc.connectBestProvider();
    this.provider = conn.provider;
    this.lastRpcLatency = conn.latencyMs;

    this.signer = FitiaSecurity.Rpc.createSigner(secret.privateKey, this.provider);
    this.user = secret.address;
    this.activity.setAccount(this.user);
    this.installActivityTracking();
    this.lastUserActivityAt = Date.now();
    // Efface immédiatement la copie de secret passée en paramètre
    secret.privateKey = '';
    secret.mnemonic = '';

    this.core = new ethers.Contract(CONFIG.CORE, CORE_ABI, this.signer);
    this.mine = new ethers.Contract(CONFIG.MINE, MINE_ABI, this.signer);
    this.usdtToken = new ethers.Contract(CONFIG.USDT, ERC20_ABI, this.signer);
    this.ftaToken = new ethers.Contract(CONFIG.FTA, ERC20_ABI, this.signer);
    this.quickswapRouter = new ethers.Contract(CONFIG.QUICKSWAP_ROUTER, QUICKSWAP_ROUTER_ABI, this.signer);
    this.quickswapFactory = new ethers.Contract(CONFIG.QUICKSWAP_FACTORY, QUICKSWAP_FACTORY_ABI, this.provider);

    // Bascule l'affichage vers l'application principale (autorise les captures du tableau de bord public)
    FitiaSecurity.Native.setScreenSecure(false);
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');
    document.getElementById('chat-fab-btn')?.classList.remove('hidden');
    this.announcementCenter.render();
    this.announcementCenter.start();
    this.announcementCenter.refresh();
    this.promotionCenter.refresh({ force: true });

    const short = this.shortAddr(this.user);
    document.getElementById('wallet-card-addr').textContent = short;

    // Décimales dynamiques du token FTA + paramètres de frais du Core
    try {
      const [ftaDec, claimFeeRaw, devFeeRaw, c0, c1, c2] = await Promise.all([
        this.ftaToken.decimals().catch(() => 8),
        this.core.claimFee().catch(() => 0n),
        this.core.devFee().catch(() => 0n),
        this.core.comRates(0).catch(() => 0n),
        this.core.comRates(1).catch(() => 0n),
        this.core.comRates(2).catch(() => 0n)
      ]);
      this.ftaDecimals = Number(ftaDec);
      this.claimFeePercent = Number(claimFeeRaw);
      this.totalFeeRateFta = Number(devFeeRaw) + Number(c0) + Number(c1) + Number(c2);
    } catch (_) { /* valeurs par défaut sécurisées */ }

    await this.fetchMarketPrices();
    await this.cacheBatteryDurations();
    await this.updateData();

    if (this.refreshInterval) clearInterval(this.refreshInterval);
    this.refreshInterval = setInterval(() => this.updateData(), 15000);

    this.initVisualizer();
    window.addEventListener('resize', () => this.resizeCanvas());
    setTimeout(() => this.checkForUpdates(false), 1200);
  }

  // ─── Vérification préalable du gaz POL sur Polygon ───────────────
  async ensurePolGas() {
    const polWei = await this.provider.getBalance(this.user);
    // Minimum ~0.0015 POL pour couvrir une transaction Polygon standard
    if (polWei < ethers.parseUnits("0.0015", 18)) {
      this.showToast(this.t('noGasPolErr'), true);
      return false;
    }
    return true;
  }

  // ─── Récupération du prix POL ────────────────────────────────────
  async fetchMarketPrices() {
    try {
      const r = await fetch('https://api.dexscreener.com/latest/dex/tokens/0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0');
      const d = await r.json();
      if (d.pairs?.length) this.polPriceUsd = parseFloat(d.pairs[0].priceUsd) || 0;
    } catch (_) {}
    if (!this.polPriceUsd) {
      try {
        const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=polygon-ecosystem-token,matic-network&vs_currencies=usd');
        const d = await r.json();
        this.polPriceUsd = d['polygon-ecosystem-token']?.usd || d['matic-network']?.usd || 0;
      } catch (_) {}
    }
    if (!this.polPriceUsd) this.polPriceUsd = 0.42;
  }

  // ─── Cache des batteries & liste déroulante dynamique ────────────
  async cacheBatteryDurations() {
    try {
      const count = Number(await this.mine.bCount());
      for (let i = 0; i < count; i++) {
        try {
          const b = await this.mine.getBType(i);
          this.batteryTypeDurations[i] = Number(b.dur) / 86400;
        } catch (_) {}
      }
      this.refreshPlugBatteryDropdown();
    } catch (_) {}
  }

  refreshPlugBatteryDropdown() {
    this.renderPlugInterface();
  }

  getPlugPlaceholderIcon(kind) {
    if (kind === 'machine') {
      return '<svg viewBox="0 0 50 50" class="plug-placeholder-svg"><rect x="5" y="4" width="40" height="42" rx="7"/><rect x="11" y="12" width="12" height="17" rx="2"/><rect x="27" y="12" width="12" height="17" rx="2"/><circle cx="18" cy="37" r="5"/><circle cx="32" cy="37" r="5"/></svg>';
    }
    return '<svg viewBox="0 0 50 50" class="plug-placeholder-svg"><rect x="5" y="15" width="36" height="22" rx="5"/><path d="M43 21v10m-31-5h19"/></svg>';
  }

  renderPlugInterface() {
    const card = document.getElementById('plug-machine-card');
    const machineInput = document.getElementById('plug-machine-id');
    const batteryInput = document.getElementById('plug-battery-type');
    const machineOptions = document.getElementById('plug-machine-options');
    const batteryOptions = document.getElementById('plug-battery-options');
    if (!card || !machineInput || !batteryInput || !machineOptions || !batteryOptions) return;

    const machineScroll = machineOptions.scrollLeft;
    const batteryScroll = batteryOptions.scrollLeft;
    const now = Math.floor(Date.now() / 1000);
    const machines = this.userMachines
      .map((machine, index) => ({ ...machine, index }))
      .filter((machine) => machine.exp <= 0 || machine.exp < now);
    const batteryTypes = Array.from(new Set([
      ...Object.keys(this.batteryTypeDurations),
      ...Object.keys(this.batteryInventory)
    ])).map(Number).filter(Number.isSafeInteger).sort((a, b) => a - b)
      .map((typeId) => ({
        typeId,
        days: this.getBatteryDuration(typeId),
        qty: Number(this.batteryInventory[typeId] || 0)
      }))
      .filter((battery) => battery.qty > 0);

    let selectedMachineIndex = machineInput.value === '' ? null : Number(machineInput.value);
    if (!Number.isSafeInteger(selectedMachineIndex) || !machines.some((machine) => machine.index === selectedMachineIndex)) {
      selectedMachineIndex = null;
    }
    let selectedBatteryType = batteryInput.value === '' ? null : Number(batteryInput.value);
    if (!Number.isSafeInteger(selectedBatteryType) || !batteryTypes.some((battery) => battery.typeId === selectedBatteryType)) {
      selectedBatteryType = null;
    }
    machineInput.value = selectedMachineIndex === null ? '' : String(selectedMachineIndex);
    batteryInput.value = selectedBatteryType === null ? '' : String(selectedBatteryType);

    const renderEmpty = (container, message) => {
      const empty = document.createElement('p');
      empty.className = 'plug-options-empty';
      empty.textContent = message;
      container.replaceChildren(empty);
    };
    const availableLabel = FitiaSecurity.escapeHtml(this.t('available'));
    const daysLabel = FitiaSecurity.escapeHtml(this.t('days'));

    if (!machines.length) {
      renderEmpty(machineOptions, this.t(this.userMachines.length ? 'noEligibleMachines' : 'noMachines'));
    } else {
      machineOptions.innerHTML = machines.map((machine) => {
        const selected = machine.index === selectedMachineIndex;
        return `<button type="button" class="plug-option plug-machine-option${selected ? ' selected' : ''}" data-plug-machine="${machine.index}" aria-pressed="${selected}" onclick="App.selectPlugMachine(${machine.index})">
          <span class="plug-option-check" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg></span>
          <span class="plug-option-icon">${this.getMachineMiniSVG(machine.tid)}</span>
          <strong>#${machine.index} · ${this.getMachineTierName(machine.tid)}</strong>
          <span class="plug-option-status"><i></i>${availableLabel}</span>
        </button>`;
      }).join('');
    }

    if (!batteryTypes.length) {
      renderEmpty(batteryOptions, this.t('noBatteries'));
    } else {
      batteryOptions.innerHTML = batteryTypes.map((battery) => {
        const selected = battery.typeId === selectedBatteryType;
        return `<button type="button" class="plug-option plug-battery-option${selected ? ' selected' : ''}" data-plug-battery="${battery.typeId}" aria-pressed="${selected}" onclick="App.selectPlugBattery(${battery.typeId})">
          <span class="plug-option-check" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg></span>
          <span class="plug-option-icon">${this.getPlugBatteryVisual(battery.days)}</span>
          <strong>${battery.days} ${daysLabel}</strong>
          <span class="plug-option-stock">×${battery.qty}</span>
        </button>`;
      }).join('');
    }

    const selectedMachine = machines.find((machine) => machine.index === selectedMachineIndex) || null;
    const selectedBattery = batteryTypes.find((battery) => battery.typeId === selectedBatteryType) || null;
    const ready = Boolean(selectedMachine && selectedBattery);
    const previewMachine = document.getElementById('plug-preview-machine');
    const previewBattery = document.getElementById('plug-preview-battery');
    const previewMachineIcon = document.getElementById('plug-preview-machine-icon');
    const previewBatteryIcon = document.getElementById('plug-preview-battery-icon');

    previewMachine.classList.toggle('selected', Boolean(selectedMachine));
    previewBattery.classList.toggle('selected', Boolean(selectedBattery));
    previewMachineIcon.innerHTML = selectedMachine ? this.getMachineMiniSVG(selectedMachine.tid) : this.getPlugPlaceholderIcon('machine');
    previewBatteryIcon.innerHTML = selectedBattery ? this.getPlugBatteryVisual(selectedBattery.days) : this.getPlugPlaceholderIcon('battery');
    document.getElementById('plug-preview-machine-name').textContent = selectedMachine
      ? `#${selectedMachine.index} · ${this.getMachineTierName(selectedMachine.tid)}`
      : this.t('selectMachinePrompt');
    document.getElementById('plug-preview-battery-name').textContent = selectedBattery
      ? `${selectedBattery.days} ${this.t('days')} · ×${selectedBattery.qty}`
      : this.t('selectBatteryPrompt');

    card.classList.toggle('is-ready', ready);
    document.getElementById('plug-connector').classList.toggle('ready', ready);
    const statusBadge = document.getElementById('plug-status-badge');
    statusBadge.classList.toggle('ready', ready);
    statusBadge.textContent = this.t(ready ? 'plugReady' : 'plugNotReady');
    const summary = document.getElementById('plug-summary');
    if (ready) {
      summary.textContent = this.t('plugReadySummary')
        .replace('{machine}', `#${selectedMachine.index}`)
        .replace('{days}', `${selectedBattery.days} ${this.t('days')}`);
    } else {
      summary.textContent = this.t(selectedMachine ? 'selectBatteryToContinue' : 'selectMachineToContinue');
    }

    document.getElementById('plug-machine-count').textContent = String(machines.length);
    document.getElementById('plug-battery-count').textContent = String(batteryTypes.reduce((total, battery) => total + battery.qty, 0));
    const submit = document.getElementById('btn-plug-machine');
    submit.disabled = !ready || this.plugTransactionInProgress;
    submit.classList.toggle('is-loading', this.plugTransactionInProgress);
    machineOptions.scrollLeft = machineScroll;
    batteryOptions.scrollLeft = batteryScroll;
  }

  selectPlugMachine(machineIdx) {
    const index = Number(machineIdx);
    const machine = this.userMachines[index];
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isSafeInteger(index) || index < 0 || !machine) {
      this.showToast(this.t('invalidId'), true);
      return false;
    }
    if (machine.exp > 0 && machine.exp >= now) {
      this.showToast(this.t('errRunning'), true);
      return false;
    }
    document.getElementById('plug-machine-id').value = String(index);
    this.renderPlugInterface();
    FitiaSecurity.Native.vibrate(14);
    return true;
  }

  selectPlugBattery(typeId) {
    const index = Number(typeId);
    if (!Number.isSafeInteger(index) || index < 0 || Number(this.batteryInventory[index] || 0) <= 0) {
      this.showToast(this.t('errNoBattery'), true);
      return false;
    }
    document.getElementById('plug-battery-type').value = String(index);
    this.renderPlugInterface();
    FitiaSecurity.Native.vibrate(14);
    return true;
  }

  // ═══════════════════════════════════════════════════════════════
  //  LECTURE DES DONNÉES ON-CHAIN (WALLET + CORE + MINE V3.2)
  // ═══════════════════════════════════════════════════════════════
  async updateData() {
    if (!this.user || !this.core || !this.mine) return;
    void this.announcementCenter.refresh({ force: false });
    if (this.activity.hasPending()) this.activity.refreshPending(this.provider);
    try {
      // Lecture groupée parallèle pour une réactivité maximale sur mobile
      const [
        mineInfoRaw,
        diffRaw,
        rateRaw,
        coreUBal,
        coreFBal,
        corePolBal,
        nativePolBal,
        walletUsdtBal,
        walletFtaBal,
        myUidRaw,
        myRefAddr
      ] = await Promise.all([
        this.mine.myInfo(this.user).catch(() => [0n, 0n, 0n]),
        this.core.difficulty().catch(() => 2000000000000n),
        this.core.rate().catch(() => 0n),
        this.core.uBal(this.user).catch(() => 0n),
        this.core.fBal(this.user).catch(() => 0n),
        this.core.pol(this.user).catch(() => 0n),
        this.provider.getBalance(this.user).catch(() => 0n),
        this.usdtToken.balanceOf(this.user).catch(() => 0n),
        this.ftaToken.balanceOf(this.user).catch(() => 0n),
        this.core.uid(this.user).catch(() => 0n),
        this.core.refr(this.user).catch(() => ethers.ZeroAddress)
      ]);

      // ─── 1. Puissance & Pending depuis FitiaMiningV3_Mine.myInfo(u) ─
      const activePowerRaw = Number(mineInfoRaw.ap ?? mineInfoRaw[1] ?? 0n);
      const onChainLc = Number(mineInfoRaw.lc ?? mineInfoRaw[2] ?? 0n);
      this.onChainLastClaim = onChainLc;

      const diffNum = Number(diffRaw);
      const feeFactor = this.claimFeePercent > 0 && this.claimFeePercent < 100
        ? (100 - this.claimFeePercent) / 100
        : 1;
      // Unités brutes FTA (8 décimales) générées par seconde (net de claimFee)
      this.currentRealPower = activePowerRaw > 0 ? ((activePowerRaw * diffNum) / 1e18) * feeFactor : 0;

      // ─── 2. Prix du FTA via Core.rate() (en 6 décimales USDT) ─────
      if (rateRaw > 0n) {
        this.ftaPriceUsd = parseFloat(ethers.formatUnits(rateRaw, this.usdtDecimals));
      }

      // ─── 3. Soldes Portefeuille Polygon vs Compte Minage Core ────
      const nPol = parseFloat(ethers.formatUnits(nativePolBal, 18));
      const wUsdt = parseFloat(ethers.formatUnits(walletUsdtBal, this.usdtDecimals));
      const wFta = parseFloat(ethers.formatUnits(walletFtaBal, this.ftaDecimals));
      const cUsdt = parseFloat(ethers.formatUnits(coreUBal, this.usdtDecimals));
      const cFta = parseFloat(ethers.formatUnits(coreFBal, this.ftaDecimals));
      const cPol = parseFloat(ethers.formatUnits(corePolBal, 18));

      this.balances = {
        nativePol: nPol,
        walletUsdt: wUsdt,
        walletFta: wFta,
        coreUsdt: cUsdt,
        coreFta: cFta,
        corePol: cPol
      };

      // Affichage Carte 1 : Portefeuille Polygon On-Chain
      document.getElementById('bal-pol').textContent = (nPol + cPol).toFixed(4);
      document.getElementById('bal-wallet-usdt').textContent = wUsdt.toFixed(2);
      document.getElementById('bal-wallet-fta').textContent = wFta.toFixed(4);

      document.getElementById('bal-pol-usd').textContent = '≈ ' + this.formatUsd((nPol + cPol) * this.polPriceUsd);
      document.getElementById('bal-wallet-usdt-usd').textContent = '≈ ' + this.formatUsd(wUsdt);
      document.getElementById('bal-wallet-fta-usd').textContent = '≈ ' + this.formatUsd(wFta * this.ftaPriceUsd);

      // Affichage Carte 2 : Compte Minage Core
      document.getElementById('bal-usdt').textContent = cUsdt.toFixed(2);
      document.getElementById('bal-fta').textContent = cFta.toFixed(4);
      document.getElementById('bal-usdt-usd').textContent = '≈ ' + this.formatUsd(cUsdt);
      document.getElementById('bal-fta-usd').textContent = '≈ ' + this.formatUsd(cFta * this.ftaPriceUsd);

      // Totaux Dashboard & Boutique
      const walletUsdTotal = (nPol + cPol) * this.polPriceUsd + wUsdt + wFta * this.ftaPriceUsd;
      const miningUsdTotal = cUsdt + cFta * this.ftaPriceUsd;
      document.getElementById('val-wallet-sub-usd').textContent = this.formatUsd(walletUsdTotal);
      document.getElementById('val-mining-sub-usd').textContent = this.formatUsd(miningUsdTotal);
      document.getElementById('val-total-usd').textContent = this.formatUsd(walletUsdTotal + miningUsdTotal);

      document.getElementById('shop-avail-usdt').textContent = (cUsdt + wUsdt).toFixed(2);
      document.getElementById('shop-avail-fta').textContent = (cFta + wFta).toFixed(4);

      document.getElementById('val-power').textContent = this.formatHashrate(this.currentRealPower);

      // Prix unitaires & variations
      document.getElementById('price-pol').textContent = this.formatUsd(this.polPriceUsd);
      document.getElementById('price-usdt').textContent = this.formatUsd(1);
      document.getElementById('price-fta').textContent = this.formatUsd(this.ftaPriceUsd);
      this.updatePriceChange('pol', this.polPriceUsd);
      this.updatePriceChange('usdt', 1);
      this.updatePriceChange('fta', this.ftaPriceUsd);

      // Infos Parrainage (code FITIA dérivé du même UID on-chain + parrain actuel)
      const myUid = Number(myUidRaw);
      const brandedReferralCode = this.formatReferralCode(myUid);
      this.myReferralCode = brandedReferralCode || this.user || '';
      const referralCodeLabel = document.getElementById('my-ref-id-label');
      referralCodeLabel.textContent = this.myReferralCode || '—';
      referralCodeLabel.classList.toggle('ref-code-address', !brandedReferralCode);
      referralCodeLabel.title = this.myReferralCode;
      if (myRefAddr && myRefAddr !== ethers.ZeroAddress) {
        document.getElementById('current-referrer-status').textContent = `${this.t('refAlreadyBound')} ${this.shortAddr(myRefAddr)}`;
        document.getElementById('ref-form-wrap')?.classList.add('hidden');
      } else {
        document.getElementById('ref-form-wrap')?.classList.remove('hidden');
      }

      // Infos Swap : FITIA Core cumule wallet + minage, QuickSwap utilise uniquement le wallet.
      const totalAvailUsdt = cUsdt + wUsdt;
      const totalAvailFta = cFta + wFta;
      if (this.swapMarket === 'POL_USDT') {
        const pair = this.getSwapPair();
        const fromBalance = pair.from === 'POL' ? nPol : wUsdt;
        const toBalance = pair.to === 'POL' ? nPol : wUsdt;
        document.getElementById('swap-bal-from').textContent = fromBalance.toFixed(pair.from === 'POL' ? 6 : 2);
        document.getElementById('swap-bal-to').textContent = toBalance.toFixed(pair.to === 'POL' ? 6 : 2);
        if (!this.pendingDexQuote && !document.getElementById('swap-from-in').value) {
          document.getElementById('swap-rate').textContent = this.t('quickswapRateInfo');
        }
      } else {
        document.getElementById('swap-rate').textContent = this.t('currentRate') + this.ftaPriceUsd.toFixed(6) + this.t('usdtPerFta');
        document.getElementById('swap-bal-from').textContent = (this.swapDirection === 'USDT_TO_FTA' ? totalAvailUsdt : totalAvailFta).toFixed(4);
        document.getElementById('swap-bal-to').textContent = (this.swapDirection === 'USDT_TO_FTA' ? totalAvailFta : totalAvailUsdt).toFixed(4);
      }

      // ─── 4. Compteur de minage synchronisé sur lc on-chain ───────
      const nowSec = Math.floor(Date.now() / 1000);
      if (this.currentRealPower > 0) {
        const elapsed = onChainLc > 0 ? Math.max(0, nowSec - onChainLc) : 0;
        const pendingRawUnits = this.currentRealPower * elapsed;
        this.pendingBalance = pendingRawUnits;
        document.getElementById('val-pending').textContent = (pendingRawUnits / (10 ** this.ftaDecimals)).toFixed(8);
        if (!this.miningTimer) this.startMiningCounter();
        document.getElementById('viz-status').textContent = this.t('miningActive');
        document.getElementById('viz-status').style.color = 'var(--primary)';
        this.updateVisualizerIntensity(this.currentRealPower);
      } else {
        this.stopMiningCounter();
        this.pendingBalance = 0;
        document.getElementById('viz-status').textContent = this.t('noMachine');
        document.getElementById('viz-status').style.color = '#64748b';
        document.getElementById('val-pending').textContent = '0.00000000';
      }

      await this.fetchUserAssets();
      this.refreshPlugBatteryDropdown();
      this.renderActiveMachines();
      this.renderUserMachines();
      this.renderUserBatteries();
      await this.renderShop();

      if (document.getElementById('swap-from-in').value) this.calcSwap();
    } catch (e) {
      console.error("Erreur updateData:", e);
      // Basculement automatique vers un autre nœud RPC si le nœud courant ne répond plus
      if (String(e?.message || '').toLowerCase().includes('network') || String(e?.message || '').toLowerCase().includes('fetch')) {
        this.failoverRpcSilently();
      }
    }
  }

  async failoverRpcSilently() {
    try {
      const conn = await FitiaSecurity.Rpc.connectBestProvider();
      this.provider = conn.provider;
      this.signer = this.signer.connect(this.provider);
      this.installActivityTracking();
      this.core = new ethers.Contract(CONFIG.CORE, CORE_ABI, this.signer);
      this.mine = new ethers.Contract(CONFIG.MINE, MINE_ABI, this.signer);
      this.usdtToken = new ethers.Contract(CONFIG.USDT, ERC20_ABI, this.signer);
      this.ftaToken = new ethers.Contract(CONFIG.FTA, ERC20_ABI, this.signer);
      this.quickswapRouter = new ethers.Contract(CONFIG.QUICKSWAP_ROUTER, QUICKSWAP_ROUTER_ABI, this.signer);
      this.quickswapFactory = new ethers.Contract(CONFIG.QUICKSWAP_FACTORY, QUICKSWAP_FACTORY_ABI, this.provider);
    } catch (_) {}
  }

  startMiningCounter() {
    if (this.miningTimer) return;
    const scale = 10 ** this.ftaDecimals;
    this.miningTimer = setInterval(() => {
      if (this.currentRealPower > 0) {
        this.pendingBalance += this.currentRealPower;
        const el = document.getElementById('val-pending');
        if (el) {
          el.textContent = (this.pendingBalance / scale).toFixed(8);
          el.style.color = 'var(--primary)';
          setTimeout(() => { el.style.color = 'var(--text)'; }, 450);
        }
      }
    }, 1000);
  }

  stopMiningCounter() {
    if (this.miningTimer) {
      clearInterval(this.miningTimer);
      this.miningTimer = null;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  ACTIFS UTILISATEUR (MACHINES & BATTERIES V3.2)
  // ═══════════════════════════════════════════════════════════════
  async fetchUserAssets() {
    if (!this.user) return;
    this.userMachines = [];
    this.batteryInventory = {};

    try {
      const machinesRaw = await this.mine.myMachines(this.user);
      for (const m of machinesRaw) {
        this.userMachines.push({
          tid: Number(m.tid ?? m[0]),
          exp: Number(m.exp ?? m[1])
        });
      }
    } catch (e) {
      console.error("Erreur myMachines:", e);
    }

    try {
      const bCount = Number(await this.mine.bCount());
      const calls = [];
      for (let t = 0; t < bCount; t++) calls.push(this.mine.myBattery(this.user, t).catch(() => 0n));
      const qtys = await Promise.all(calls);
      qtys.forEach((q, idx) => {
        const n = Number(q);
        if (n > 0) this.batteryInventory[idx] = n;
      });
    } catch (_) {}
  }

  renderActiveMachines() {
    const container = document.getElementById('active-machines-list');
    if (!container) return;
    const now = Math.floor(Date.now() / 1000);
    const active = this.userMachines
      .map((m, idx) => ({ ...m, idx }))
      .filter((m) => m.exp > now);

    if (!active.length) {
      container.innerHTML = `<p class="small-text" style="text-align:center;">${this.t('noActiveMachines')}</p>`;
      return;
    }

    const tierNames = ['MK-I', 'MK-II', 'MK-III', 'MK-IV', 'MK-V', 'MK-VI', 'MK-VII', 'MK-VIII'];
    container.innerHTML = active.map((m) => {
      const rem = m.exp - now;
      const pct = Math.max(8, Math.min(100, Math.round((rem / (30 * 86400)) * 100)));
      return `<div class="asset-row">${this.getMachineMiniSVG(m.tid)}
        <div class="asset-info">
          <div class="asset-name">#${m.idx} ${tierNames[m.tid % 8]} <span class="status-pill active">● ${this.t('active')}</span></div>
          <div class="asset-detail">${this.t('batteryLabel')}</div>
          <div class="battery-bar-wrap">
            <div class="battery-bar-header">
              <span class="battery-bar-label">${this.t('timeRemaining')}</span>
              <span class="battery-bar-time green">${this.formatTimeRemaining(rem)}</span>
            </div>
            <div class="battery-bar"><div class="battery-bar-fill green" style="width:${pct}%"></div></div>
          </div>
        </div>
      </div>`;
    }).join('');
  }

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
      const isRunning = m.exp > now;
      const statusClass = isRunning ? 'active' : (m.exp > 0 ? 'expired' : 'inactive');
      const statusText = isRunning ? this.t('active') : (m.exp > 0 ? this.t('expired') : this.t('inactive'));
      let extra = '';
      if (isRunning) {
        const rem = m.exp - now;
        extra = `<div class="battery-bar-wrap"><div class="battery-bar-header"><span class="battery-bar-label">${this.t('timeRemaining')}</span><span class="battery-bar-time green">${this.formatTimeRemaining(rem)}</span></div><div class="battery-bar"><div class="battery-bar-fill green" style="width:65%"></div></div></div>`;
      }
      const quickPlugBtn = !isRunning
        ? `<button class="btn-chip accent sm" onclick="App.quickSelectMachineToPlug(${i})">${this.t('plug')}</button>`
        : '';

      return `<div class="asset-row">${this.getMachineMiniSVG(m.tid)}
        <div class="asset-info">
          <div class="asset-name">#${i} ${tierNames[m.tid % 8]} <span class="status-pill ${statusClass}">● ${statusText}</span></div>
          <div class="asset-detail">${isRunning ? this.t('plugged') : this.t('notPlugged')}</div>
          ${extra}
        </div>
        ${quickPlugBtn}
      </div>`;
    }).join('');
  }

  quickSelectMachineToPlug(machineIdx) {
    if (!this.selectPlugMachine(machineIdx)) return;
    const card = document.getElementById('plug-machine-card');
    card?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    const options = document.getElementById('plug-machine-options');
    const selected = options?.querySelector(`[data-plug-machine="${Number(machineIdx)}"]`);
    if (options && selected) {
      options.scrollLeft = Math.max(0, selected.offsetLeft - (options.clientWidth - selected.offsetWidth) / 2);
    }
  }

  renderUserBatteries() {
    const container = document.getElementById('my-batteries-list');
    if (!container) return;
    const entries = Object.entries(this.batteryInventory).filter(([, qty]) => qty > 0);
    if (!entries.length) {
      container.innerHTML = `<p class="small-text" style="text-align:center;">${this.t('noBatteries')}</p>`;
      return;
    }
    container.innerHTML = entries.map(([typeId, qty]) => {
      const dur = this.getBatteryDuration(Number(typeId));
      return `<div class="asset-row">
        <div class="real-battery">
          <div class="battery-cap"></div>
          <div class="battery-body">
            <div class="battery-level" style="width:85%"></div>
            <div class="battery-charge-indicator">${dur}J</div>
          </div>
        </div>
        <div class="asset-info">
          <div class="asset-name">${dur} ${this.t('days')} <span class="status-pill available">● ${this.t('available')}</span></div>
          <div class="asset-detail">Quantité: ×${qty}</div>
        </div>
      </div>`;
    }).join('');
  }

  // ═══════════════════════════════════════════════════════════════
  //  AUTO-DÉPÔT INTELLIGENT (PORTEFEUILLE POLYGON → COMPTE MINAGE CORE)
  // ═══════════════════════════════════════════════════════════════
  async ensureCoreBalance(tokenSymbol, requiredBN) {
    if (tokenSymbol === 'USDT') {
      const currentCore = await this.core.uBal(this.user);
      if (currentCore >= requiredBN) return true;

      const shortfall = requiredBN - currentCore;
      const walletBal = await this.usdtToken.balanceOf(this.user);
      if (walletBal < shortfall) {
        const totalAvail = parseFloat(ethers.formatUnits(currentCore + walletBal, this.usdtDecimals));
        const needed = parseFloat(ethers.formatUnits(requiredBN, this.usdtDecimals));
        this.showToast(`❌ Solde USDT insuffisant (${totalAvail.toFixed(2)} / ${needed.toFixed(2)} USDT).`, true);
        return false;
      }

      const allowance = await this.usdtToken.allowance(this.user, CONFIG.CORE);
      if (allowance < shortfall) {
        this.setLoader(true, "Approbation USDT...");
        await (await this.usdtToken.approve(CONFIG.CORE, shortfall)).wait();
      }
      this.setLoader(true, this.t('autoDepositStep'));
      await (await this.core.depositUsdt(shortfall)).wait();
      return true;
    } else {
      const currentCore = await this.core.fBal(this.user);
      if (currentCore >= requiredBN) return true;

      const shortfall = requiredBN - currentCore;
      const walletBal = await this.ftaToken.balanceOf(this.user);
      if (walletBal < shortfall) {
        const totalAvail = parseFloat(ethers.formatUnits(currentCore + walletBal, this.ftaDecimals));
        const needed = parseFloat(ethers.formatUnits(requiredBN, this.ftaDecimals));
        this.showToast(`❌ Solde FTA insuffisant (${totalAvail.toFixed(4)} / ${needed.toFixed(4)} FTA).`, true);
        return false;
      }

      const allowance = await this.ftaToken.allowance(this.user, CONFIG.CORE);
      if (allowance < shortfall) {
        this.setLoader(true, "Approbation FTA...");
        await (await this.ftaToken.approve(CONFIG.CORE, shortfall)).wait();
      }
      this.setLoader(true, this.t('autoDepositStep'));
      await (await this.core.depositFta(shortfall)).wait();
      return true;
    }
  }

  // Calcule le coût exact en FTA selon FitiaMiningV3_Mine._pay(u, price, true)
  async computeRequiredFtaForUsdtPrice(priceRawBN) {
    const fn_ = await this.core.costFta(priceRawBN);
    const tfp = BigInt(this.totalFeeRateFta);
    if (tfp >= 100n) return fn_;
    return fn_ + ((fn_ * tfp) / (100n - tfp));
  }

  // ═══════════════════════════════════════════════════════════════
  //  DÉPÔT & RETRAIT MANUELS (PORTEFEUILLE ↔ COMPTE MINAGE)
  // ═══════════════════════════════════════════════════════════════
  onTransferTokenChange(token) {
    if (!['USDT', 'FTA'].includes(token)) return;
    document.getElementById('deposit-token-select').value = token;
    document.querySelectorAll('.transfer-token-option[data-transfer-token]').forEach((button) => {
      const isActive = button.dataset.transferToken === token;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
    document.getElementById('deposit-amount').value = '';
  }

  fillMaxDeposit() {
    const token = document.getElementById('deposit-token-select').value;
    const maxWallet = token === 'USDT' ? this.balances.walletUsdt : this.balances.walletFta;
    const maxCore = token === 'USDT' ? this.balances.coreUsdt : this.balances.coreFta;
    // Remplit avec le solde portefeuille s'il y en a, sinon le solde minage (pour faciliter le retrait)
    const val = maxWallet > 0 ? maxWallet : maxCore;
    document.getElementById('deposit-amount').value = val > 0 ? val : '';
  }

  async deposit() {
    if (!this.user) return;
    const tokenType = document.getElementById('deposit-token-select').value;
    const amountStr = document.getElementById('deposit-amount').value;
    const amount = parseFloat(amountStr);
    if (!amount || amount <= 0) return this.showToast(this.t('invalidAmount'), true);
    if (!(await this.ensurePolGas())) return;

    this.setLoader(true, this.t('depositing'));
    try {
      if (tokenType === 'USDT') {
        const amountBN = ethers.parseUnits(amount.toFixed(this.usdtDecimals), this.usdtDecimals);
        const walletBal = await this.usdtToken.balanceOf(this.user);
        if (walletBal < amountBN) {
          this.setLoader(false);
          return this.showToast(`❌ Solde Portefeuille USDT insuffisant (${parseFloat(ethers.formatUnits(walletBal, this.usdtDecimals)).toFixed(2)} USDT).`, true);
        }
        const allowance = await this.usdtToken.allowance(this.user, CONFIG.CORE);
        if (allowance < amountBN) {
          this.setLoader(true, "Approbation USDT...");
          await (await this.usdtToken.approve(CONFIG.CORE, amountBN)).wait();
        }
        this.setLoader(true, this.t('confirming'));
        await (await this.core.depositUsdt(amountBN)).wait();
      } else {
        const amountBN = ethers.parseUnits(amount.toFixed(this.ftaDecimals), this.ftaDecimals);
        const walletBal = await this.ftaToken.balanceOf(this.user);
        if (walletBal < amountBN) {
          this.setLoader(false);
          return this.showToast(`❌ Solde Portefeuille FTA insuffisant (${parseFloat(ethers.formatUnits(walletBal, this.ftaDecimals)).toFixed(4)} FTA).`, true);
        }
        const allowance = await this.ftaToken.allowance(this.user, CONFIG.CORE);
        if (allowance < amountBN) {
          this.setLoader(true, "Approbation FTA...");
          await (await this.ftaToken.approve(CONFIG.CORE, amountBN)).wait();
        }
        this.setLoader(true, this.t('confirming'));
        await (await this.core.depositFta(amountBN)).wait();
      }
      FitiaSecurity.Native.vibrate(30);
      this.showToast(this.t('depositSuccess'));
      document.getElementById('deposit-amount').value = '';
      await this.updateData();
    } catch (e) {
      this.showError(e);
    } finally {
      this.setLoader(false);
    }
  }

  async withdraw() {
    if (!this.user) return;
    const tokenType = document.getElementById('deposit-token-select').value;
    const amount = parseFloat(document.getElementById('deposit-amount').value);
    if (!amount || amount <= 0) return this.showToast(this.t('invalidAmount'), true);
    if (!(await this.ensurePolGas())) return;

    this.setLoader(true, this.t('withdrawing'));
    try {
      if (tokenType === 'USDT') {
        const amountBN = ethers.parseUnits(amount.toFixed(this.usdtDecimals), this.usdtDecimals);
        await (await this.core.withdrawUsdt(amountBN)).wait();
      } else {
        const amountBN = ethers.parseUnits(amount.toFixed(this.ftaDecimals), this.ftaDecimals);
        await (await this.core.withdrawFta(amountBN)).wait();
      }
      FitiaSecurity.Native.vibrate(30);
      this.showToast(this.t('withdrawSuccess'));
      document.getElementById('deposit-amount').value = '';
      await this.updateData();
    } catch (e) {
      this.showError(e);
    } finally {
      this.setLoader(false);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  ENVOYER & RECEVOIR (QR CODE HORS-LIGNE + CONFIRMATION PIN)
  // ═══════════════════════════════════════════════════════════════
  openSend() {
    document.getElementById('send-to-address').value = '';
    document.getElementById('send-amount').value = '';
    document.getElementById('modal-send').classList.add('active');
    this.updateSendBalance();
  }

  updateSendBalance() {
    const token = document.getElementById('send-token-select').value;
    let val = this.balances.nativePol;
    let dec = 4;
    if (token === 'USDT') { val = this.balances.walletUsdt; dec = 2; }
    if (token === 'FTA') { val = this.balances.walletFta; dec = 4; }
    document.getElementById('send-bal').textContent = `${val.toFixed(dec)} ${token}`;
  }

  fillMaxSend() {
    const token = document.getElementById('send-token-select').value;
    let maxVal = 0;
    if (token === 'POL') {
      maxVal = Math.max(0, this.balances.nativePol - 0.015); // Garde une réserve pour le gaz
      document.getElementById('send-amount').value = maxVal > 0 ? maxVal.toFixed(5) : '';
    } else if (token === 'USDT') {
      maxVal = this.balances.walletUsdt;
      document.getElementById('send-amount').value = maxVal > 0 ? maxVal.toFixed(2) : '';
    } else {
      maxVal = this.balances.walletFta;
      document.getElementById('send-amount').value = maxVal > 0 ? maxVal.toFixed(4) : '';
    }
  }

  async pasteRecipientAddr() {
    try {
      if (navigator.clipboard?.readText) {
        const t = await navigator.clipboard.readText();
        if (t) document.getElementById('send-to-address').value = t.trim();
      }
    } catch (_) {}
  }

  openReceive() {
    if (!this.user) return;
    document.getElementById('receive-addr-display').textContent = this.user;
    this.renderQrCode(this.user);
    document.getElementById('modal-receive').classList.add('active');
  }

  renderQrCode(text) {
    const box = document.getElementById('receive-qr-box');
    if (!box) return;
    try {
      if (typeof qrcode === 'function') {
        const qr = qrcode(0, 'M');
        qr.addData(text);
        qr.make();
        box.innerHTML = qr.createSvgTag({ cellSize: 5, margin: 1, scalable: true });
      }
    } catch (e) {
      box.textContent = text;
    }
  }

  closeModals() {
    document.querySelectorAll('.modal:not(#modal-pin-confirm):not(#modal-secret-reveal):not(#modal-update)').forEach((m) => {
      m.classList.remove('active');
    });
  }

  async copyReceiveAddress() {
    if (!this.user) return;
    await FitiaSecurity.Native.copyText(this.user);
    this.showToast(this.t('addrCopied'));
  }

  async shareReceiveAddress() {
    if (!this.user) return;
    await FitiaSecurity.Native.shareText('Mon adresse Polygon FITIA PRO', this.user);
  }

  async executeSend() {
    const toRaw = document.getElementById('send-to-address').value.trim();
    const amtClean = document.getElementById('send-amount').value.trim().replace(',', '.');
    const amtNum = Number(amtClean);
    if (!ethers.isAddress(toRaw)) return this.showToast(this.t('invalidAddr'), true);
    const to = ethers.getAddress(toRaw);

    // Protection anti-perte de fonds : bloque l'adresse nulle et les adresses de contrats connues
    if (to === ethers.ZeroAddress) {
      return this.showToast(this.t('burnAddrBlocked'), true);
    }
    const knownContracts = [CONFIG.USDT, CONFIG.FTA, CONFIG.CORE, CONFIG.MINE].map((a) => a.toLowerCase());
    if (knownContracts.includes(to.toLowerCase())) {
      return this.showToast(this.t('contractAddrBlocked'), true);
    }

    if (!amtClean || !Number.isFinite(amtNum) || amtNum <= 0) return this.showToast(this.t('invalidAmount'), true);

    const token = document.getElementById('send-token-select').value;
    const avail = token === 'POL' ? this.balances.nativePol : (token === 'USDT' ? this.balances.walletUsdt : this.balances.walletFta);
    if (amtNum > avail + 1e-9) {
      return this.showToast(this.t('errInsufficientFunds'), true);
    }
    if (!(await this.ensurePolGas())) return;

    // Demande le code PIN à 6 chiffres avant d'envoyer des fonds à l'extérieur
    const verified = await this.requestPinVerification(`${this.t('send')} ${amtClean} ${token}`);
    if (!verified) return;
    // Efface immédiatement le secret déchiffré de la RAM après vérification d'identité
    if (verified.secret) {
      verified.secret.privateKey = '';
      verified.secret.mnemonic = '';
    }

    this.setLoader(true, this.t('sending'));
    try {
      let tx;
      if (token === 'POL') {
        tx = await this.signer.sendTransaction({ to, value: ethers.parseEther(amtNum.toFixed(18).replace(/\.?0+$/, '') || '0') });
      } else if (token === 'USDT') {
        tx = await this.usdtToken.transfer(to, ethers.parseUnits(amtNum.toFixed(this.usdtDecimals), this.usdtDecimals));
      } else {
        tx = await this.ftaToken.transfer(to, ethers.parseUnits(amtNum.toFixed(this.ftaDecimals), this.ftaDecimals));
      }
      await tx.wait();
      FitiaSecurity.Native.vibrate(35);
      this.showToast(this.t('sentSuccess'));
      this.closeModals();
      await this.updateData();
    } catch (e) {
      this.showError(e);
    } finally {
      this.setLoader(false);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  BOUTIQUE & MINAGE (CONTRAT FitiaMiningV3_Mine V3.2)
  // ═══════════════════════════════════════════════════════════════
  setPayMode(mode) {
    this.payMode = mode;
    document.getElementById('btn-pay-usdt').classList.toggle('active', mode === 'USDT');
    document.getElementById('btn-pay-fta').classList.toggle('active', mode === 'FTA');
    this.renderShop();
  }

  setShopView(v, btnEl) {
    this.shopViewMode = v;
    document.querySelectorAll('#view-shop .shop-tab').forEach((t) => t.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    this.renderShop();
  }

  async renderShop() {
    if (this.isLoadingShop || !this.mine) return;
    const container = document.getElementById('shop-list');
    if (!container) return;
    if (this.shopViewMode === 'machines') {
      if (!this.shopMachinesData.length) await this.fetchMachines();
      this._renderShopMachinesHTML(container);
    } else {
      if (!this.shopBatteriesData.length) await this.fetchBatteries();
      this._renderShopBatteriesHTML(container);
    }
  }

  async fetchMachines() {
    this.isLoadingShop = true;
    try {
      const count = Number(await this.mine.mCount());
      const calls = [];
      for (let i = 0; i < count; i++) {
        calls.push(
          this.mine.getMType(i).catch(async () => {
            // Compatibilité rétroactive si un contrat V3.0 (sans shopExpiry) répond sur 64 octets
            const legacyMine = new ethers.Contract(
              CONFIG.MINE,
              ["function getMType(uint256) view returns (uint256 price, uint256 power)"],
              this.provider
            );
            const leg = await legacyMine.getMType(i);
            return { price: leg.price, power: leg.power, shopExpiry: 0n };
          })
        );
      }
      const results = await Promise.all(calls);
      this.shopMachinesData = results.map((d) => ({
        price: parseFloat(ethers.formatUnits(d.price, this.usdtDecimals)),
        power: Number(d.power),
        priceRaw: d.price,
        shopExpiry: Number(d.shopExpiry ?? 0)
      }));
    } catch (e) {
      console.error("Erreur fetchMachines:", e);
    }
    this.isLoadingShop = false;
  }

  async fetchBatteries() {
    this.isLoadingShop = true;
    try {
      const count = Number(await this.mine.bCount());
      const calls = [];
      for (let i = 0; i < count; i++) calls.push(this.mine.getBType(i));
      const results = await Promise.all(calls);
      this.shopBatteriesData = results.map((d) => ({
        price: parseFloat(ethers.formatUnits(d.price, this.usdtDecimals)),
        days: Number(d.dur) / 86400,
        priceRaw: d.price
      }));
    } catch (e) {
      console.error("Erreur fetchBatteries:", e);
    }
    this.isLoadingShop = false;
  }

  formatPriceDisplay(usdtPrice) {
    if (this.payMode === 'FTA' && this.ftaPriceUsd > 0) {
      const tfp = this.totalFeeRateFta;
      const baseFta = usdtPrice / this.ftaPriceUsd;
      const totalFta = tfp > 0 && tfp < 100 ? baseFta + (baseFta * tfp) / (100 - tfp) : baseFta;
      return `≈ ${totalFta.toFixed(1)} FTA`;
    }
    return `${usdtPrice.toFixed(2)} $`;
  }

  getMachineMiniSVG(tier) {
    const c = ['#64748b', '#3b82f6', '#8b5cf6', '#F0B90B', '#f97316', '#ef4444', '#06b6d4', '#eab308'];
    const a = ['#94a3b8', '#60a5fa', '#a78bfa', '#FFD43B', '#fb923c', '#f87171', '#22d3ee', '#facc15'];
    const tc = c[tier % 8], ta = a[tier % 8];
    return `<svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" class="machine-svg-mini"><rect x="2" y="2" width="46" height="46" rx="6" fill="#1e293b" stroke="${tc}" stroke-width="1"/><rect x="2" y="2" width="46" height="3" rx="1.5" fill="${tc}" opacity="0.6"/><rect x="8" y="10" width="14" height="20" rx="2" fill="#080c18" stroke="${ta}" stroke-width="0.5"/><rect x="28" y="10" width="14" height="20" rx="2" fill="#080c18" stroke="${ta}" stroke-width="0.5"/><circle cx="21" cy="40" r="6" fill="#0a0e1a" stroke="#333" stroke-width="0.5"/><circle cx="37" cy="40" r="6" fill="#0a0e1a" stroke="#333" stroke-width="0.5"/></svg>`;
  }

  _renderShopMachinesHTML(container) {
    container.innerHTML = '';
    const badges = [
      'background:#64748b;color:#fff', 'background:#3b82f6;color:#fff', 'background:#8b5cf6;color:#fff', 'background:#F0B90B;color:#000',
      'background:#f97316;color:#fff', 'background:#ef4444;color:#fff', 'background:#06b6d4;color:#000', 'background:#eab308;color:#000'
    ];
    const names = ['STARTER', 'STANDARD', 'ADVANCED', 'PRO', 'ELITE', 'ULTRA', 'SUPREME', 'LEGEND'];
    const now = Math.floor(Date.now() / 1000);

    for (let i = 0; i < this.shopMachinesData.length; i++) {
      const d = this.shopMachinesData[i];
      const isShopExpired = d.shopExpiry > 0 && now > d.shopExpiry;
      let expiryHtml = '';
      if (d.shopExpiry > 0) {
        expiryHtml = isShopExpired
          ? `<span class="rig-expiry-note" style="color:#ef4444;">⛔ ${this.t('shopExpiredLabel')}</span>`
          : `<span class="rig-expiry-note">⏳ ${this.formatTimeRemaining(d.shopExpiry - now)}</span>`;
      }

      const div = document.createElement('div');
      div.className = 'rig-item' + (isShopExpired ? ' expired-shop' : '');
      div.innerHTML = `<span class="tier-badge" style="${badges[i % 8]}">${names[i % 8]}</span>
        <div style="display:flex;justify-content:center;">${this.getMachineMiniSVG(i)}</div>
        <span class="rig-name">${this.t('rig')} ${i + 1}</span>
        <span class="rig-power">${this.formatHashrate(d.power)}</span>
        ${expiryHtml}
        <span class="rig-price">${this.formatPriceDisplay(d.price)}</span>
        <button class="btn-primary" style="padding:8px;font-size:0.75rem;" ${isShopExpired ? 'disabled' : ''} onclick="App.buyMachine(${i})">
          ${isShopExpired ? this.t('shopExpiredLabel') : `${this.t('buy')} (${this.payMode})`}
        </button>`;
      this.promotionCenter.decorate(div, 'machine', i);
      container.appendChild(div);
    }
  }

  _renderShopBatteriesHTML(container) {
    container.innerHTML = '';
    for (let i = 0; i < this.shopBatteriesData.length; i++) {
      const d = this.shopBatteriesData[i];
      const div = document.createElement('div');
      div.className = 'battery-shop-item';
      div.innerHTML = `
        <div class="real-battery">
          <div class="battery-cap"></div>
          <div class="battery-body">
            <div class="battery-level" style="width:82%"></div>
            <div class="battery-charge-indicator">${d.days}J</div>
          </div>
        </div>
        <div class="battery-name">${d.days} ${this.t('days')}</div>
        <div class="battery-price">${this.formatPriceDisplay(d.price)}</div>
        <button class="btn-primary" style="padding:8px;font-size:0.75rem" onclick="App.buyBattery(${i})">${this.t('buy')} (${this.payMode})</button>`;
      this.promotionCenter.decorate(div, 'battery', i);
      container.appendChild(div);
    }
  }

  async buyMachine(typeId) {
    if (!this.user) return;
    const mData = this.shopMachinesData[typeId];
    if (!mData) return this.showToast("Machine indisponible", true);
    if (mData.shopExpiry > 0 && Math.floor(Date.now() / 1000) > mData.shopExpiry) {
      return this.showToast("Cette machine a expiré dans la boutique.", true);
    }
    if (!(await this.ensurePolGas())) return;

    this.setLoader(true, `${this.t('buyingMachine')} (${this.payMode})...`);
    try {
      if (this.payMode === 'USDT') {
        const ok = await this.ensureCoreBalance('USDT', mData.priceRaw);
        if (!ok) { this.setLoader(false); return; }
        this.setLoader(true, `${this.t('buyingMachine')}...`);
        await (await this.mine.buyMachine(typeId)).wait();
      } else {
        const reqFta = await this.computeRequiredFtaForUsdtPrice(mData.priceRaw);
        const ok = await this.ensureCoreBalance('FTA', reqFta);
        if (!ok) { this.setLoader(false); return; }
        this.setLoader(true, `${this.t('buyingMachine')} (FTA)...`);
        await (await this.mine.buyMachineFTA(typeId)).wait();
      }
      FitiaSecurity.Native.vibrate(35);
      this.showToast(this.t('machineBought'));
      this.shopMachinesData = [];
      await this.updateData();
    } catch (e) {
      this.showError(e);
    } finally {
      this.setLoader(false);
    }
  }

  async buyBattery(typeId) {
    if (!this.user) return;
    const bData = this.shopBatteriesData[typeId];
    if (!bData) return;
    if (!(await this.ensurePolGas())) return;

    this.setLoader(true, `${this.t('buyingBattery')} (${this.payMode})...`);
    try {
      if (this.payMode === 'USDT') {
        const ok = await this.ensureCoreBalance('USDT', bData.priceRaw);
        if (!ok) { this.setLoader(false); return; }
        this.setLoader(true, `${this.t('buyingBattery')}...`);
        await (await this.mine.buyBattery(typeId)).wait();
      } else {
        const reqFta = await this.computeRequiredFtaForUsdtPrice(bData.priceRaw);
        const ok = await this.ensureCoreBalance('FTA', reqFta);
        if (!ok) { this.setLoader(false); return; }
        this.setLoader(true, `${this.t('buyingBattery')} (FTA)...`);
        await (await this.mine.buyBatteryFTA(typeId)).wait();
      }
      FitiaSecurity.Native.vibrate(35);
      this.showToast(this.t('batteryBought'));
      this.shopBatteriesData = [];
      await this.updateData();
    } catch (e) {
      this.showError(e);
    } finally {
      this.setLoader(false);
    }
  }

  async plugInMachine() {
    if (this.plugTransactionInProgress) return;
    const machineInput = document.getElementById('plug-machine-id');
    const batteryInput = document.getElementById('plug-battery-type');
    const machineIndex = Number(machineInput.value);
    const batteryTypeId = Number(batteryInput.value);
    const machine = this.userMachines[machineIndex];
    const now = Math.floor(Date.now() / 1000);

    if (machineInput.value === '' || !Number.isSafeInteger(machineIndex) || machineIndex < 0 || !machine) {
      return this.showToast(this.t('invalidId'), true);
    }
    if (machine.exp > 0 && machine.exp >= now) {
      return this.showToast(this.t('errRunning'), true);
    }
    if (batteryInput.value === '' || !Number.isSafeInteger(batteryTypeId) || batteryTypeId < 0 || Number(this.batteryInventory[batteryTypeId] || 0) <= 0) {
      return this.showToast(this.t('errNoBattery'), true);
    }

    this.plugTransactionInProgress = true;
    this.renderPlugInterface();
    try {
      if (!(await this.ensurePolGas())) return;
      this.setLoader(true, this.t('pluggingIn'));
      await (await this.mine.plugInMachine(machineIndex, batteryTypeId)).wait();
      FitiaSecurity.Native.vibrate(40);
      this.showToast(this.t('pluggedIn'));
      machineInput.value = '';
      this.renderPlugInterface();
      await this.updateData();
    } catch (e) {
      this.showError(e);
    } finally {
      this.plugTransactionInProgress = false;
      this.setLoader(false);
      this.renderPlugInterface();
    }
  }

  isServerResponse403(error) {
    const numericStatuses = [
      error?.status,
      error?.statusCode,
      error?.response?.status,
      error?.info?.responseStatus
    ];
    if (numericStatuses.some((value) => Number(value) === 403)) return true;
    const text = [
      error?.message,
      error?.shortMessage,
      error?.reason,
      error?.error?.message
    ].filter(Boolean).join(' ');
    return /\b403\b/.test(text);
  }

  async waitForClaimReceipt(tx) {
    try {
      return await tx.wait();
    } catch (error) {
      if (!this.isServerResponse403(error)) throw error;
      const hash = tx?.hash || error?.transactionHash || error?.hash || error?.transaction?.hash || '';
      if (hash && this.provider && typeof this.provider.getTransactionReceipt === 'function') {
        try {
          return await this.provider.getTransactionReceipt(hash);
        } catch (_) {
          return null;
        }
      }
      return null;
    }
  }

  async claim() {
    if (!this.user) return;
    if (!this.userMachines.length) return this.showToast(this.t('errNoMachine'), true);

    this.stopMiningCounter();
    this.setLoader(true, this.t('claiming'));
    this.showToast(this.t('claiming'));
    try {
      if (!(await this.ensurePolGas())) {
        if (this.currentRealPower > 0) this.startMiningCounter();
        return;
      }
      const tx = await this.mine.claimRewards();
      const receipt = await this.waitForClaimReceipt(tx);
      if (!receipt) {
        this.showToast(this.t('claimStillPending'));
        if (this.currentRealPower > 0) this.startMiningCounter();
        return;
      }
      if (Number(receipt.status ?? 1) === 0) {
        this.showToast(this.t('claimNotConfirmed'), true);
        if (this.currentRealPower > 0) this.startMiningCounter();
        return;
      }
      this.pendingBalance = 0;
      document.getElementById('val-pending').textContent = "0.00000000";
      FitiaSecurity.Native.vibrate(45);
      this.showToast(this.t('claimed'));
      try {
        await this.updateData();
      } catch (_) {
        // Un rafraîchissement RPC en échec n'annule pas une réclamation confirmée.
      }
    } catch (e) {
      if (this.isServerResponse403(e)) {
        this.showToast(this.t('claimNotConfirmed'), true);
      } else {
        this.showError(e);
      }
      if (this.currentRealPower > 0) this.startMiningCounter();
    } finally {
      this.setLoader(false);
    }
  }

  // ─── Parrainage ──────────────────────────────────────────────────
  formatReferralCode(uid) {
    const value = Number(uid);
    if (!Number.isSafeInteger(value) || value <= 0) return '';
    return `FITIA-${String(value).padStart(6, '0')}`;
  }

  parseReferralInput(value) {
    const input = String(value || '').trim();
    if (ethers.isAddress(input)) return { type: 'address', value: ethers.getAddress(input) };
    const match = input.match(/^(?:FITIA-([0-9]{1,78})|#?([0-9]{1,78}))$/i);
    const digits = match?.[1] || match?.[2];
    if (!digits) return null;
    const referralId = BigInt(digits);
    if (referralId <= 0n) return null;
    return { type: 'id', value: referralId };
  }

  getMyReferralCode() {
    return this.myReferralCode || this.user || '';
  }

  async copyMyReferralCode() {
    if (!this.user) return;
    const code = this.getMyReferralCode();
    if (!code) return;
    const copied = await FitiaSecurity.Native.copyText(code);
    this.showToast(copied ? this.t('refCodeCopied') : this.t('errGeneric'), !copied);
  }

  async shareMyReferral() {
    if (!this.user) return;
    const code = this.getMyReferralCode();
    if (!code) return;
    const message = this.t('refShareMessage').replace('{code}', code);
    const shared = await FitiaSecurity.Native.shareText(this.t('refShareTitle'), message);
    if (!shared) this.showToast(this.t('errGeneric'), true);
  }

  async bindReferrer() {
    const input = document.getElementById('ref-address-input').value.trim();
    const parsed = this.parseReferralInput(input);
    if (!parsed || !this.user) return this.showToast(this.t('invalidRefCode'), true);
    if (!(await this.ensurePolGas())) return;

    this.setLoader(true, this.t('linking'));
    try {
      if (parsed.type === 'address') {
        await (await this.core.setReferrer(parsed.value)).wait();
      } else {
        await (await this.core.setReferrerById(parsed.value)).wait();
      }
      this.showToast(this.t('refLinked'));
      document.getElementById('ref-address-input').value = '';
      await this.updateData();
    } catch (e) {
      this.showError(e);
    } finally {
      this.setLoader(false);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  SWAP : USDT ↔ FTA (FITIA Core) + POL ↔ USDT (QuickSwap V2)
  // ═══════════════════════════════════════════════════════════════
  getSwapPair() {
    const pairs = {
      USDT_TO_FTA: { from: 'USDT', to: 'FTA' },
      FTA_TO_USDT: { from: 'FTA', to: 'USDT' },
      POL_TO_USDT: { from: 'POL', to: 'USDT' },
      USDT_TO_POL: { from: 'USDT', to: 'POL' }
    };
    return pairs[this.swapDirection] || pairs.USDT_TO_FTA;
  }

  getSwapTokenDecimals(token) {
    if (token === 'POL') return 18;
    return token === 'USDT' ? this.usdtDecimals : this.ftaDecimals;
  }

  getSwapTokenIcon(token) {
    const icons = {
      POL: 'assets/pol.svg',
      USDT: 'assets/usdt.svg',
      FTA: 'assets/fta.png'
    };
    return icons[token] || '';
  }

  formatSwapAmount(value, decimals, displayDecimals = 6) {
    const raw = ethers.formatUnits(value, decimals);
    const [whole, fraction = ''] = raw.split('.');
    const truncated = fraction.slice(0, displayDecimals).replace(/0+$/, '');
    return truncated ? `${whole}.${truncated}` : whole;
  }

  parseSwapInput(value, decimals) {
    const clean = String(value ?? '').trim();
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(clean)) return null;
    try {
      const amount = ethers.parseUnits(clean, decimals);
      return amount > 0n ? amount : null;
    } catch (_) {
      return null;
    }
  }

  setSwapMarket(market) {
    if (this.swapTransactionInProgress || !['CORE_FTA', 'POL_USDT'].includes(market) || market === this.swapMarket) return;
    this.swapMarket = market;
    this.swapDirection = market === 'POL_USDT' ? 'POL_TO_USDT' : 'USDT_TO_FTA';
    this.renderSwapInterface();
    return this.updateData();
  }

  renderSwapInterface() {
    this.dexQuoteRequestId += 1;
    this.pendingDexQuote = null;
    const pair = this.getSwapPair();
    const isDex = this.swapMarket === 'POL_USDT';
    document.querySelectorAll('.swap-market-option[data-swap-market]').forEach((button) => {
      const isActive = button.dataset.swapMarket === this.swapMarket;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
    document.getElementById('token-from-logo').src = this.getSwapTokenIcon(pair.from);
    document.getElementById('token-to-logo').src = this.getSwapTokenIcon(pair.to);
    document.getElementById('token-from-symbol').textContent = pair.from;
    document.getElementById('token-to-symbol').textContent = pair.to;
    document.getElementById('swap-from-in').value = '';
    document.getElementById('swap-to-in').value = '';
    document.getElementById('swap-details').classList.add('hidden');
    document.getElementById('swap-detail-impact-label').textContent = this.t(isDex ? 'priceImpactWithFee' : 'priceImpact');
    document.getElementById('swap-detail-fee-label').textContent = this.t(isDex ? 'dexFeeLabel' : 'swapFee');
    document.getElementById('swap-detail-impact').textContent = isDex ? '—' : '< 2%';
    document.getElementById('swap-detail-fee').textContent = '—';
    document.getElementById('swap-detail-min').textContent = '—';
    document.getElementById('swap-detail-slippage').textContent = `${SLIPPAGE * 100}%`;
    document.getElementById('swap-rate').textContent = isDex
      ? this.t('quickswapRateInfo')
      : this.t('currentRate') + this.ftaPriceUsd.toFixed(6) + this.t('usdtPerFta');
    document.getElementById('btn-execute-swap').disabled = isDex;
  }

  toggleSwap() {
    if (this.swapTransactionInProgress) return;
    if (this.swapMarket === 'POL_USDT') {
      this.swapDirection = this.swapDirection === 'POL_TO_USDT' ? 'USDT_TO_POL' : 'POL_TO_USDT';
    } else {
      this.swapDirection = this.swapDirection === 'USDT_TO_FTA' ? 'FTA_TO_USDT' : 'USDT_TO_FTA';
    }
    this.renderSwapInterface();
    return this.updateData();
  }

  async fillMaxSwap() {
    if (this.swapTransactionInProgress) return;
    if (this.swapMarket === 'POL_USDT') {
      const pair = this.getSwapPair();
      try {
        if (pair.from === 'POL') {
          if (!this.provider || !this.user) return;
          const [balanceWei, fees] = await Promise.all([
            this.provider.getBalance(this.user),
            FitiaSecurity.Rpc.getOptimalFeeData(this.provider)
          ]);
          // Réserve conservative pour le gaz ; le contrôle final utilise l'estimation réelle.
          const gasReserve = (fees.maxFeePerGas * 400000n * 120n) / 100n;
          const available = balanceWei > gasReserve ? balanceWei - gasReserve : 0n;
          document.getElementById('swap-from-in').value = available > 0n ? this.formatSwapAmount(available, 18, 6) : '';
        } else {
          document.getElementById('swap-from-in').value = this.balances.walletUsdt > 0
            ? this.balances.walletUsdt.toFixed(this.usdtDecimals)
            : '';
        }
      } catch (e) {
        this.showError(e);
        return;
      }
    } else {
      const isUsdtTo = this.swapDirection === 'USDT_TO_FTA';
      const maxAvail = isUsdtTo
        ? (this.balances.coreUsdt + this.balances.walletUsdt)
        : (this.balances.coreFta + this.balances.walletFta);
      document.getElementById('swap-from-in').value = maxAvail > 0
        ? maxAvail.toFixed(isUsdtTo ? this.usdtDecimals : 4)
        : '';
    }
    this.calcSwap();
  }

  calcSwap() {
    if (this.swapMarket === 'POL_USDT') return this.calcDexSwap();
    const val = document.getElementById('swap-from-in').value;
    document.getElementById('btn-execute-swap').disabled = false;
    document.getElementById('swap-detail-impact-label').textContent = this.t('priceImpact');
    document.getElementById('swap-detail-fee-label').textContent = this.t('swapFee');
    document.getElementById('swap-detail-impact').textContent = '< 2%';
    if (!val || Number(val) <= 0) {
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
    document.getElementById('swap-details').classList.remove('hidden');
    const fromToken = isUsdtTo ? 'USDT' : 'FTA';
    const toToken = isUsdtTo ? 'FTA' : 'USDT';
    document.getElementById('swap-detail-rate').textContent = isUsdtTo && this.ftaPriceUsd > 0
      ? `1 USDT = ${(1 / this.ftaPriceUsd).toFixed(2)} FTA`
      : `1 FTA = ${this.ftaPriceUsd.toFixed(6)} USDT`;
    document.getElementById('swap-detail-fee').textContent = `${fee.toFixed(6)} ${fromToken}`;
    document.getElementById('swap-detail-min').textContent = `${minReceived.toFixed(6)} ${toToken}`;
  }

  async calcDexSwap() {
    const requestId = ++this.dexQuoteRequestId;
    this.pendingDexQuote = null;
    const outputInput = document.getElementById('swap-to-in');
    const details = document.getElementById('swap-details');
    const button = document.getElementById('btn-execute-swap');
    outputInput.value = '';
    details.classList.add('hidden');
    button.disabled = true;
    if (this.swapTransactionInProgress) return;

    const pair = this.getSwapPair();
    const inputDecimals = this.getSwapTokenDecimals(pair.from);
    const outputDecimals = this.getSwapTokenDecimals(pair.to);
    const amountIn = this.parseSwapInput(document.getElementById('swap-from-in').value, inputDecimals);
    if (!amountIn) {
      document.getElementById('swap-rate').textContent = this.t('quickswapRateInfo');
      return;
    }

    const cachedBalance = pair.from === 'POL' ? this.balances.nativePol : this.balances.walletUsdt;
    if (Number(ethers.formatUnits(amountIn, inputDecimals)) > cachedBalance + 1e-9) {
      document.getElementById('swap-rate').textContent = this.t('errInsufficientFunds');
      return;
    }

    document.getElementById('swap-detail-impact-label').textContent = this.t('priceImpactWithFee');
    document.getElementById('swap-detail-fee-label').textContent = this.t('dexFeeLabel');
    document.getElementById('swap-rate').textContent = this.t('swapQuoteLoading');
    const path = pair.from === 'POL' ? [CONFIG.WPOL, CONFIG.USDT] : [CONFIG.USDT, CONFIG.WPOL];

    try {
      const quote = await this.getDexSwapQuote(amountIn, path);
      if (requestId !== this.dexQuoteRequestId || this.swapTransactionInProgress) return;
      this.pendingDexQuote = quote;
      outputInput.value = this.formatSwapAmount(quote.expectedOut, outputDecimals, 6);
      details.classList.remove('hidden');

      const inputHuman = Number(ethers.formatUnits(amountIn, inputDecimals));
      const outputHuman = Number(ethers.formatUnits(quote.expectedOut, outputDecimals));
      const executionRate = inputHuman > 0 ? outputHuman / inputHuman : 0;
      document.getElementById('swap-detail-rate').textContent = `1 ${pair.from} = ${executionRate.toFixed(pair.to === 'POL' ? 8 : 6)} ${pair.to}`;
      document.getElementById('swap-detail-impact').textContent = `${(Number(quote.priceImpactBps) / 100).toFixed(2)}%`;
      document.getElementById('swap-detail-fee').textContent = '0.30%';
      document.getElementById('swap-detail-min').textContent = `${this.formatSwapAmount(quote.minOut, outputDecimals, 6)} ${pair.to}`;
      document.getElementById('swap-rate').textContent = this.t('quickswapRateInfo');
      button.disabled = false;
    } catch (error) {
      if (requestId !== this.dexQuoteRequestId) return;
      console.error('QuickSwap quote:', error);
      this.pendingDexQuote = null;
      outputInput.value = '';
      details.classList.add('hidden');
      document.getElementById('swap-rate').textContent = this.t('swapQuoteUnavailable');
      button.disabled = true;
    }
  }

  async getDexSwapQuote(amountIn, path) {
    if (!this.quickswapRouter || !this.quickswapFactory || !this.provider) {
      throw new Error('QUICKSWAP_NOT_READY');
    }
    const amounts = await this.quickswapRouter.getAmountsOut(amountIn, path);
    const expectedOut = amounts[amounts.length - 1];
    if (!expectedOut || expectedOut <= 0n) throw new Error('EMPTY_QUICKSWAP_QUOTE');
    const minOut = (expectedOut * (BPS_DENOMINATOR - DEX_SLIPPAGE_BPS)) / BPS_DENOMINATOR;

    const pairAddress = await this.quickswapFactory.getPair(path[0], path[1]);
    if (!pairAddress || pairAddress.toLowerCase() === ethers.ZeroAddress.toLowerCase()) {
      throw new Error('NO_QUICKSWAP_LIQUIDITY');
    }
    const pairContract = new ethers.Contract(pairAddress, QUICKSWAP_PAIR_ABI, this.provider);
    const [token0, reserves] = await Promise.all([pairContract.token0(), pairContract.getReserves()]);
    const token0IsInput = token0.toLowerCase() === path[0].toLowerCase();
    const reserveIn = token0IsInput ? reserves[0] : reserves[1];
    const reserveOut = token0IsInput ? reserves[1] : reserves[0];
    if (reserveIn <= 0n || reserveOut <= 0n) throw new Error('EMPTY_QUICKSWAP_POOL');

    // Écart entre le prix spot sans frais et le prix réellement coté (frais pool inclus).
    const idealOut = (amountIn * reserveOut) / reserveIn;
    const priceImpactBps = idealOut > expectedOut && idealOut > 0n
      ? ((idealOut - expectedOut) * BPS_DENOMINATOR) / idealOut
      : 0n;
    return { amountIn, expectedOut, minOut, path, pairAddress, priceImpactBps };
  }

  async ensureDexUsdtAllowance(amountIn) {
    const allowance = await this.usdtToken.allowance(this.user, CONFIG.QUICKSWAP_ROUTER);
    if (allowance >= amountIn) return;
    // L'USDT Polygon exige une remise à zéro avant de modifier une allowance existante.
    if (allowance > 0n) {
      const resetTx = await this.usdtToken.approve(CONFIG.QUICKSWAP_ROUTER, 0n);
      this.showToast(this.t('swapApprovalPending'));
      await resetTx.wait();
    }
    const approvalTx = await this.usdtToken.approve(CONFIG.QUICKSWAP_ROUTER, amountIn);
    this.showToast(this.t('swapApprovalPending'));
    await approvalTx.wait();
  }

  async getDexDeadline() {
    const block = await this.provider.getBlock('latest');
    if (!block) throw new Error('POLYGON_BLOCK_UNAVAILABLE');
    return BigInt(block.timestamp + DEX_DEADLINE_SECONDS);
  }

  async ensureDexPolGas(amountIn, quote, deadline) {
    const balanceWei = await this.provider.getBalance(this.user);
    if (balanceWei < amountIn) {
      this.showToast(this.t('errInsufficientFunds'), true);
      return false;
    }
    const [fees, gasEstimate] = await Promise.all([
      FitiaSecurity.Rpc.getOptimalFeeData(this.provider),
      this.quickswapRouter.swapExactETHForTokens.estimateGas(quote.minOut, quote.path, this.user, deadline, { value: amountIn })
    ]);
    const required = amountIn + ((gasEstimate * fees.maxFeePerGas * 120n) / 100n);
    if (balanceWei < required) {
      this.showToast(this.t('swapPolGasReserve'), true);
      return false;
    }
    return true;
  }

  async ensureDexTokenSwapGas(quote, amountIn, deadline) {
    const [balanceWei, fees, gasEstimate] = await Promise.all([
      this.provider.getBalance(this.user),
      FitiaSecurity.Rpc.getOptimalFeeData(this.provider),
      this.quickswapRouter.swapExactTokensForETH.estimateGas(amountIn, quote.minOut, quote.path, this.user, deadline)
    ]);
    const required = (gasEstimate * fees.maxFeePerGas * 120n) / 100n;
    if (balanceWei < required) {
      this.showToast(this.t('swapPolGasReserve'), true);
      return false;
    }
    return true;
  }

  async executeSwap() {
    if (this.swapMarket === 'POL_USDT') return this.executeDexSwap();
    const val = document.getElementById('swap-from-in').value;
    if (!val || Number(val) <= 0) return this.showToast(this.t('invalidAmount'), true);
    if (!(await this.ensurePolGas())) return;

    const isUsdtTo = this.swapDirection === 'USDT_TO_FTA';
    this.setLoader(true, this.t('swapping'));

    try {
      const decimals = isUsdtTo ? this.usdtDecimals : this.ftaDecimals;
      const amountBN = ethers.parseUnits(Number(val).toFixed(decimals), decimals);

      // Si une partie des tokens est dans le Portefeuille Polygon, la dépose automatiquement dans Core
      const ok = await this.ensureCoreBalance(isUsdtTo ? 'USDT' : 'FTA', amountBN);
      if (!ok) { this.setLoader(false); return; }

      this.setLoader(true, this.t('swapping'));
      const netInput = parseFloat(val) * (1 - SWAP_FEE_RATE);
      const expectedOut = isUsdtTo ? (netInput / this.ftaPriceUsd) : (netInput * this.ftaPriceUsd);
      const outDec = isUsdtTo ? this.ftaDecimals : this.usdtDecimals;
      const minOut = ethers.parseUnits(Math.max(0, expectedOut * (1 - SLIPPAGE)).toFixed(outDec), outDec);
      const deadline = Math.floor(Date.now() / 1000) + 1200;

      const tx = isUsdtTo
        ? await this.core.swapUForF(amountBN, minOut, deadline)
        : await this.core.swapFForU(amountBN, minOut, deadline);
      await tx.wait();

      FitiaSecurity.Native.vibrate(35);
      this.showToast(this.t('swapSuccess'));
      document.getElementById('swap-from-in').value = '';
      document.getElementById('swap-to-in').value = '';
      document.getElementById('swap-details').classList.add('hidden');
      await this.updateData();
    } catch (e) {
      this.showError(e);
    } finally {
      this.setLoader(false);
    }
  }

  async executeDexSwap() {
    if (this.swapTransactionInProgress) return;
    const pair = this.getSwapPair();
    const inputDecimals = this.getSwapTokenDecimals(pair.from);
    const amountIn = this.parseSwapInput(document.getElementById('swap-from-in').value, inputDecimals);
    if (!amountIn) return this.showToast(this.t('invalidAmount'), true);

    this.swapTransactionInProgress = true;
    document.getElementById('btn-execute-swap').disabled = true;
    this.setLoader(true, this.t('swapping'));
    try {
      if (!(await this.ensurePolGas())) return;
      const path = pair.from === 'POL' ? [CONFIG.WPOL, CONFIG.USDT] : [CONFIG.USDT, CONFIG.WPOL];
      // Nouveau devis juste avant signature : le minimum reçu ne dépend jamais d'un ancien affichage.
      const quote = await this.getDexSwapQuote(amountIn, path);
      const deadline = await this.getDexDeadline();
      let tx;

      if (pair.from === 'POL') {
        if (!(await this.ensureDexPolGas(amountIn, quote, deadline))) return;
        tx = await this.quickswapRouter.swapExactETHForTokens(
          quote.minOut, path, this.user, deadline, { value: amountIn }
        );
      } else {
        const walletUsdt = await this.usdtToken.balanceOf(this.user);
        if (walletUsdt < amountIn) {
          this.showToast(this.t('errInsufficientFunds'), true);
          return;
        }
        await this.ensureDexUsdtAllowance(amountIn);
        if (!(await this.ensureDexTokenSwapGas(quote, amountIn, deadline))) return;
        tx = await this.quickswapRouter.swapExactTokensForETH(
          amountIn, quote.minOut, path, this.user, deadline
        );
      }

      this.showToast(this.t('swapPending'));
      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1) throw new Error('SWAP_NOT_CONFIRMED');
      FitiaSecurity.Native.vibrate(35);
      this.showToast(this.t('swapSuccess'));
      this.pendingDexQuote = null;
      document.getElementById('swap-from-in').value = '';
      document.getElementById('swap-to-in').value = '';
      document.getElementById('swap-details').classList.add('hidden');
      await this.updateData();
    } catch (e) {
      this.showError(e);
    } finally {
      this.swapTransactionInProgress = false;
      this.setLoader(false);
      const hasQuote = this.pendingDexQuote && document.getElementById('swap-from-in').value;
      document.getElementById('btn-execute-swap').disabled = this.swapMarket === 'POL_USDT' ? !hasQuote : false;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  CENTRE DE SÉCURITÉ & GESTION DU PORTEFEUILLE INTÉGRÉ
  // ═══════════════════════════════════════════════════════════════
  async openSecurityModal() {
    if (!this.user) return;
    const meta = FitiaSecurity.Vault.getMetadata();
    const settings = FitiaSecurity.Vault.getSettings();

    document.getElementById('sec-full-address').textContent = this.user;
    document.getElementById('sec-rpc-latency').textContent = this.lastRpcLatency ? `Polygon • ${this.lastRpcLatency} ms` : 'Polygon • Actif';

    // Masquer l'option 12 mots si importé par clé privée pure
    document.getElementById('btn-export-seed').classList.toggle('hidden', !meta.hasMnemonic);

    // Biométrie
    const bioSupported = await FitiaSecurity.Vault.isBiometricSupported();
    document.getElementById('sec-bio-row').classList.toggle('hidden', !bioSupported);
    if (bioSupported) {
      document.getElementById('toggle-biometric').checked = !!meta.biometricEnabled;
    }

    // Délai auto-verrouillage
    document.getElementById('select-autolock').value = String(settings.autoLockMinutes ?? 5);

    // Liste des nœuds RPC Polygon (création DOM sûre anti-XSS)
    const rpcSelect = document.getElementById('select-rpc-node');
    const rpcs = FitiaSecurity.Rpc.getAvailableRpcs();
    rpcSelect.innerHTML = '';
    rpcs.forEach((r) => {
      const opt = document.createElement('option');
      opt.value = r.url;
      opt.selected = r.url === FitiaSecurity.Rpc.currentRpcUrl;
      opt.textContent = `${r.name} (${r.url.replace(/^https:\/\//i, '')})`;
      rpcSelect.appendChild(opt);
    });
    document.getElementById('custom-rpc-input').value = settings.customRpcUrl || '';

    document.getElementById('modal-security').classList.add('active');
  }

  openPolygonScan() {
    if (!this.user) return;
    window.open(`${CONFIG.EXPLORER}/address/${this.user}`, '_blank', 'noopener,noreferrer');
  }

  // ─── Vérification interactive du PIN (retourne le secret déchiffré ou null) ───
  requestPinVerification(titleText) {
    return new Promise((resolve) => {
      FitiaSecurity.Native.setScreenSecure(true);
      this.pinVerifyResolver = resolve;
      this.confirmPinBuffer = '';
      document.getElementById('pin-confirm-title').textContent = titleText || this.t('confirmWithPin');
      document.getElementById('confirm-pin-error').textContent = '';
      this.updateDotsUI('confirm-pin-dots', 0);
      document.getElementById('modal-pin-confirm').classList.add('active');
    });
  }

  cancelPinVerification() {
    document.getElementById('modal-pin-confirm').classList.remove('active');
    if (this.user && !document.getElementById('modal-secret-reveal')?.classList.contains('active')) {
      FitiaSecurity.Native.setScreenSecure(false);
    }
    this.confirmPinBuffer = '';
    if (this.pinVerifyResolver) {
      const r = this.pinVerifyResolver;
      this.pinVerifyResolver = null;
      r(null);
    }
  }

  async onConfirmPinDigit(d) {
    if (this.confirmPinBuffer.length >= 6) return;
    FitiaSecurity.Native.vibrate(15);
    this.confirmPinBuffer += d;
    document.getElementById('confirm-pin-error').textContent = '';
    this.updateDotsUI('confirm-pin-dots', this.confirmPinBuffer.length);

    if (this.confirmPinBuffer.length === 6) {
      const pin = this.confirmPinBuffer;
      this.confirmPinBuffer = '';
      try {
        const secret = await FitiaSecurity.Vault.unlockWithPin(pin);
        document.getElementById('modal-pin-confirm').classList.remove('active');
        if (this.user && !document.getElementById('modal-secret-reveal')?.classList.contains('active')) {
          FitiaSecurity.Native.setScreenSecure(false);
        }
        if (this.pinVerifyResolver) {
          const r = this.pinVerifyResolver;
          this.pinVerifyResolver = null;
          r({ secret, pin });
        }
      } catch (err) {
        FitiaSecurity.Native.vibrate(70);
        this.updateDotsUI('confirm-pin-dots', 0, true);
        if (err.code === 'LOCKED_OUT' || err.remainingSec > 0) {
          document.getElementById('confirm-pin-error').textContent = this.t('lockedOutMsg').replace('{s}', err.remainingSec);
        } else {
          document.getElementById('confirm-pin-error').textContent = this.t('wrongPin');
        }
      }
    }
  }

  onConfirmPinBackspace() {
    if (!this.confirmPinBuffer.length) return;
    FitiaSecurity.Native.vibrate(12);
    this.confirmPinBuffer = this.confirmPinBuffer.slice(0, -1);
    this.updateDotsUI('confirm-pin-dots', this.confirmPinBuffer.length);
  }

  // ─── Export Phrase 12 mots ───────────────────────────────────────
  async exportRecoveryPhrase() {
    const res = await this.requestPinVerification(this.t('viewSeedPhrase'));
    if (!res?.secret?.mnemonic) return;
    FitiaSecurity.Native.setScreenSecure(true);
    this.revealedSecretText = res.secret.mnemonic;

    document.getElementById('reveal-modal-title').textContent = this.t('viewSeedPhrase');
    const grid = document.getElementById('reveal-seed-grid');
    grid.classList.remove('hidden', 'blurred');
    document.getElementById('reveal-pk-box').classList.add('hidden');

    grid.innerHTML = res.secret.mnemonic.split(' ').map((w, i) => `
      <div class="seed-word-chip">
        <span class="seed-word-idx">${i + 1}.</span>
        <span class="seed-word-val">${FitiaSecurity.escapeHtml(w)}</span>
      </div>
    `).join('');
    document.getElementById('modal-secret-reveal').classList.add('active');
  }

  // ─── Export Clé Privée ───────────────────────────────────────────
  async exportPrivateKey() {
    const res = await this.requestPinVerification(this.t('exportPrivKey'));
    if (!res?.secret?.privateKey) return;
    FitiaSecurity.Native.setScreenSecure(true);
    this.revealedSecretText = res.secret.privateKey;

    document.getElementById('reveal-modal-title').textContent = this.t('exportPrivKey');
    document.getElementById('reveal-seed-grid').innerHTML = '';
    document.getElementById('reveal-seed-grid').classList.add('hidden');
    const pkBox = document.getElementById('reveal-pk-box');
    pkBox.classList.remove('hidden');
    document.getElementById('reveal-pk-text').textContent = res.secret.privateKey;
    document.getElementById('modal-secret-reveal').classList.add('active');
  }

  closeRevealModal() {
    this.revealedSecretText = '';
    document.getElementById('reveal-seed-grid').innerHTML = '';
    document.getElementById('reveal-pk-text').textContent = '';
    document.getElementById('modal-secret-reveal').classList.remove('active');
    if (this.user && document.getElementById('auth-screen')?.classList.contains('hidden')) {
      FitiaSecurity.Native.setScreenSecure(false);
    }
  }

  async copyRevealedSecret() {
    if (!this.revealedSecretText) return;
    await FitiaSecurity.Native.copySensitive(this.revealedSecretText);
    this.showToast(this.t('secretCopied'));
  }

  // ─── Changement de Code PIN ──────────────────────────────────────
  async startChangePin() {
    const res = await this.requestPinVerification("Entrez votre PIN actuel");
    if (!res?.secret) return;
    this.closeModals();
    this.pendingWalletSecret = res.secret;
    this.openSetPinScreen('changepin');
  }

  // ─── Biométrie ON / OFF ──────────────────────────────────────────
  async onToggleBiometric(checkboxEl) {
    if (checkboxEl.checked) {
      const res = await this.requestPinVerification(this.t('biometricUnlock'));
      if (!res?.pin) {
        checkboxEl.checked = false;
        return;
      }
      try {
        await FitiaSecurity.Vault.enableBiometric(res.pin);
        this.showToast("✅ Biométrie activée !");
      } catch (_) {
        checkboxEl.checked = false;
        this.showToast("Biométrie non disponible sur cet appareil.", true);
      }
    } else {
      await FitiaSecurity.Vault.disableBiometric();
      this.showToast("Biométrie désactivée.");
    }
  }

  onChangeAutoLock(minutesVal) {
    FitiaSecurity.Vault.saveSettings({ autoLockMinutes: Number(minutesVal) });
    this.showToast("Préférence enregistrée ✓");
  }

  async onSelectRpcNode(rpcUrl) {
    this.setLoader(true, "Test du nœud RPC Polygon...");
    try {
      const res = await FitiaSecurity.Rpc.connectBestProvider(rpcUrl);
      this.provider = res.provider;
      this.lastRpcLatency = res.latencyMs;
      this.signer = this.signer.connect(this.provider);
      this.installActivityTracking();
      this.core = new ethers.Contract(CONFIG.CORE, CORE_ABI, this.signer);
      this.mine = new ethers.Contract(CONFIG.MINE, MINE_ABI, this.signer);
      this.usdtToken = new ethers.Contract(CONFIG.USDT, ERC20_ABI, this.signer);
      this.ftaToken = new ethers.Contract(CONFIG.FTA, ERC20_ABI, this.signer);
      this.quickswapRouter = new ethers.Contract(CONFIG.QUICKSWAP_ROUTER, QUICKSWAP_ROUTER_ABI, this.signer);
      this.quickswapFactory = new ethers.Contract(CONFIG.QUICKSWAP_FACTORY, QUICKSWAP_FACTORY_ABI, this.provider);
      document.getElementById('sec-rpc-latency').textContent = res.latencyMs ? `Polygon • ${res.latencyMs} ms` : 'Polygon • Actif';
      this.showToast(`✅ Connecté (${res.latencyMs || 'OK'} ms)`);
      await this.updateData();
    } catch (e) {
      this.showError(e);
    } finally {
      this.setLoader(false);
    }
  }

  async saveCustomRpc() {
    const url = document.getElementById('custom-rpc-input').value.trim();
    if (!url) {
      FitiaSecurity.Vault.saveSettings({ customRpcUrl: '' });
      return this.openSecurityModal();
    }
    const cleanUrl = FitiaSecurity.Rpc.validateRpcUrl(url);
    if (!cleanUrl) {
      return this.showToast("⛔ URL RPC refusée : HTTPS public uniquement (pas de HTTP en clair ni d'adresse locale).", true);
    }
    FitiaSecurity.Vault.saveSettings({ customRpcUrl: cleanUrl });
    await this.onSelectRpcNode(cleanUrl);
    await this.openSecurityModal();
  }

  async promptResetWallet() {
    const res = await this.requestPinVerification("Confirmer la réinitialisation");
    if (!res?.secret) return;
    const ok = window.confirm("⚠️ ATTENTION : Assurez-vous d'avoir sauvegardé vos 12 mots ou votre clé privée ! Voulez-vous vraiment retirer ce portefeuille de cet appareil ?");
    if (!ok) return;

    this.closeModals();
    this.stopMiningCounter();
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    await FitiaSecurity.Vault.deleteVault();
    this.user = null;
    this.myReferralCode = '';
    this.signer = null;
    this.plugTransactionInProgress = false;
    document.getElementById('plug-machine-id').value = '';
    document.getElementById('plug-battery-type').value = '';
    this.showAuthStep('welcome');
  }

  // ═══════════════════════════════════════════════════════════════
  //  VISUALISEUR, NAVIGATION, ERREURS & ASSISTANT CHAT
  // ═══════════════════════════════════════════════════════════════
  resizeCanvas() {
    if (this.vizContext) {
      const c = this.vizContext.canvas;
      c.width = c.offsetWidth * 2;
      c.height = c.offsetHeight * 2;
    }
  }

  initVisualizer() {
    const c = document.getElementById('mining-canvas');
    if (!c || this.vizContext) return;
    this.vizContext = c.getContext('2d');
    this.resizeCanvas();
    this.vizBars = [];
    for (let i = 0; i < 20; i++) this.vizBars.push({ height: 0, targetHeight: 0 });
    this.animateVisualizer();
  }

  updateVisualizerIntensity(p) {
    if (!this.vizContext) return;
    const intensity = p > 0 ? Math.min((p * 500) + 18, 95) : 0;
    this.vizBars.forEach((b) => {
      b.targetHeight = (this.vizContext.canvas.height * (intensity / 100)) * Math.random();
    });
  }

  animateVisualizer() {
    if (!this.vizContext) return;
    const ctx = this.vizContext;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = "#F0B90B";
    const w = ctx.canvas.width / 20;
    this.vizBars.forEach((b, i) => {
      b.height += (b.targetHeight - b.height) * 0.12;
      const barH = Math.max(0, b.height);
      ctx.fillRect(i * w + 2, ctx.canvas.height - barH, Math.max(2, w - 4), barH);
      if (this.currentRealPower > 0) b.targetHeight += (Math.random() - 0.5) * 10;
      else b.targetHeight *= 0.9;
    });
    requestAnimationFrame(() => this.animateVisualizer());
  }

  nav(viewId, btnEl) {
    document.querySelectorAll('.view').forEach((el) => {
      el.classList.remove('active');
      el.style.display = 'none';
    });
    const activeView = document.getElementById('view-' + viewId);
    if (activeView) {
      activeView.classList.add('active');
      activeView.style.display = 'block';
    }
    document.querySelectorAll('.nav-item').forEach((el) => el.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    if (viewId === 'dashboard') {
      setTimeout(() => this.resizeCanvas(), 50);
      this.announcementCenter.start();
    } else {
      this.announcementCenter.stop();
    }
    if (viewId === 'shop') this.promotionCenter.refresh();
  }

  setLoader(show) {
    // L'animation reste visible, sans afficher de message pendant le chargement.
    const loader = document.getElementById('loader');
    loader.classList.toggle('hidden', !show);
  }

  getErrorMessage(e) {
    const errName = e?.revert?.name || '';
    if (errName === 'NoM') return this.t('errNoMachine');
    if (errName === 'Running') return this.t('errRunning');
    if (errName === 'NoBat') return this.t('errNoBattery');
    if (errName === 'MaxM') return this.t('errMaxMachine');
    if (errName === 'Expired') return "Cette machine a expiré dans la boutique.";
    if (errName === 'InsF') return `${this.t('errInsufficientFunds')} (${e?.revert?.args?.[0] || ''})`;

    const shortMsg = e?.shortMessage || e?.reason || '';
    const errStr = ((e?.message || '') + ' ' + shortMsg + ' ' + (e?.code || '')).toLowerCase();

    if (e?.code === 'ACTION_REJECTED' || e?.code === 4001 || errStr.includes('user rejected') || errStr.includes('action_rejected')) return this.t('swapRejected');
    if (errStr.includes('insufficient_output_amount') || errStr.includes('insufficient output amount')) return this.t('swapSlippageError');
    if (errStr.includes('uniswapv2router') && errStr.includes('expired')) return this.t('swapExpired');
    if (errStr.includes('quickswap_not_ready') || errStr.includes('quickswap_liquidity') || errStr.includes('empty_quickswap')) return this.t('swapQuoteUnavailable');
    if (errStr.includes('swap_not_confirmed')) return this.t('swapNotConfirmed');
    if (errStr.includes('insufficient funds') || errStr.includes('insf')) return this.t('noGasPolErr');
    if (errStr.includes('tff') || errStr.includes('transferfrom')) return '❌ Transfert refusé : vérifiez votre solde USDT/FTA.';
    if (errStr.includes('nonce')) return this.t('errNonce');
    if (errStr.includes('timeout') || errStr.includes('deadline')) return this.t('errTimeout');
    if (errStr.includes('network') || errStr.includes('failed to fetch')) return this.t('errNetwork');
    if (errStr.includes('nom')) return this.t('errNoMachine');
    if (errStr.includes('running')) return this.t('errRunning');
    if (errStr.includes('nobat')) return this.t('errNoBattery');
    if (errStr.includes('maxm')) return this.t('errMaxMachine');
    if (shortMsg) return 'Contrat : ' + shortMsg;
    return this.t('errGeneric');
  }

  showError(e) {
    console.error("FITIA Tx Error:", e);
    this.showToast(this.getErrorMessage(e), true);
  }

  showToast(msg, isError = false) {
    const div = document.createElement('div');
    div.className = 'toast' + (isError ? ' toast-error' : ' toast-success');
    div.textContent = msg;
    const container = document.getElementById('toast-container');
    container.appendChild(div);
    setTimeout(() => div.remove(), 4000);
  }

  updatePriceChange(token, newPrice) {
    const el = document.getElementById('change-' + token);
    if (!el || !newPrice) return;
    const now = Date.now();
    const interval = 5 * 60 * 1000;
    const checkpoint = this.prevPriceCheckpoint[token];

    if (!checkpoint || now - this.priceCheckpointTime > interval) {
      this.prevPriceCheckpoint[token] = newPrice;
      if (this.priceCheckpointTime === 0 || now - this.priceCheckpointTime > interval * 2) {
        this.priceCheckpointTime = now;
      }
      el.textContent = '0.00%';
      el.className = 'token-change flat';
      return;
    }

    const change = ((newPrice - checkpoint) / checkpoint) * 100;
    const absChange = Math.abs(change);
    const sign = absChange >= 0.01 && change > 0 ? '+' : '';
    const cssClass = absChange < 0.01 ? 'flat' : (change > 0 ? 'up' : 'down');
    el.textContent = sign + change.toFixed(2) + '%';
    el.className = 'token-change ' + cssClass;
  }

  // ─── Assistant Chat Intégré ──────────────────────────────────────
  toggleChat() {
    const panel = document.getElementById('chat-panel');
    const isActive = panel.classList.toggle('active');
    if (isActive && !this.chatInitialized) {
      this.chatInitialized = true;
      setTimeout(() => this.addChatBubble('assistant', this.getWelcomeMessage()), 350);
    }
    if (isActive) setTimeout(() => document.getElementById('chat-input').focus(), 300);
  }

  sendChatMessage() {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';
    this.addChatBubble('user', msg);
    this.chatHistory.push({ role: 'user', text: msg });
    const typingId = this.showTyping();
    setTimeout(() => {
      this.removeTyping(typingId);
      const response = this.generateLocalResponse(msg);
      this.addChatBubble('assistant', response);
      this.chatHistory.push({ role: 'assistant', text: response });
    }, 500);
  }

  addChatBubble(role, text) {
    const container = document.getElementById('chat-messages');
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${role}`;
    bubble.textContent = text;
    container.appendChild(bubble);
    requestAnimationFrame(() => { container.scrollTop = container.scrollHeight; });
  }

  showTyping() {
    const container = document.getElementById('chat-messages');
    const typing = document.createElement('div');
    const id = 'typing-' + Date.now();
    typing.id = id;
    typing.className = 'chat-bubble assistant';
    typing.innerHTML = '● ● ●';
    container.appendChild(typing);
    container.scrollTop = container.scrollHeight;
    return id;
  }

  removeTyping(id) {
    document.getElementById(id)?.remove();
  }

  getWelcomeMessage() {
    const m = {
      fr: "👋 Bienvenue sur FITIA PRO Autonome !\nVotre portefeuille Polygon est directement intégré et chiffré.\nPosez vos questions sur : Wallet, Minage, Swap, Sécurité ou Parrainage !",
      en: "👋 Welcome to FITIA PRO Standalone!\nYour Polygon wallet is built-in and encrypted.\nAsk me about: Wallet, Mining, Swap, Security or Referral!",
      de: "👋 Willkommen bei FITIA PRO! Frag mich zu: Wallet, Mining, Tausch, Sicherheit!",
      zh: "👋 欢迎使用 FITIA PRO 独立版！内置加密钱包。问我：挖矿、兑换、钱包、安全！",
      sg: "👋 Welcome to FITIA PRO Standalone! Ask about Wallet, Mining, Swap, Security!"
    };
    return m[this.currentLang] || m.fr;
  }

  generateLocalResponse(msg) {
    const m = msg.toLowerCase();
    const power = this.currentRealPower || 0;
    const pendingFta = (this.pendingBalance || 0) / (10 ** this.ftaDecimals);
    const ftaP = this.ftaPriceUsd || 0;

    if (m.includes('salut') || m.includes('bonjour') || m.includes('hello') || m.includes('hi')) {
      return `👋 Bonjour ! Portefeuille actif : ${this.shortAddr(this.user)}.\nPuissance : ${this.formatHashrate(power)}.\nComment puis-je vous aider ?`;
    }
    if (m.includes('minage') || m.includes('mine') || m.includes('machine') || m.includes('batterie')) {
      return `⛏️ Minage Autonome FITIA :\n1️⃣ Envoyez des USDT et un peu de POL (~0.05 POL pour les frais réseau) sur votre adresse FITIA (bouton Recevoir)\n2️⃣ Achetez une machine et une batterie dans Boutique (le dépôt se fait automatiquement !)\n3️⃣ Branchez la machine dans l'onglet Wallet\n4️⃣ Cliquez sur RÉCLAMER pour récolter vos FTA !\nEn attente : ${pendingFta.toFixed(6)} FTA`;
    }
    if (m.includes('swap') || m.includes('échange') || m.includes('echange')) {
      return `💱 Swap intégré USDT ↔ FTA :\nTaux actuel : 1 FTA = ${ftaP > 0 ? ftaP.toFixed(6) : '...'} USDT (frais 4%).\nPlus besoin de MetaMask : la transaction est signée directement par votre portefeuille FITIA !`;
    }
    if (m.includes('wallet') || m.includes('portefeuille') || m.includes('solde') || m.includes('dépôt') || m.includes('depot') || m.includes('pol')) {
      return `🔐 Portefeuille Intégré :\n• Votre adresse Polygon reçoit POL, USDT et FTA.\n• Gardez toujours ~0.05 POL pour payer les frais réseau Polygon.\n• Cliquez sur l'icône 🛡️ en haut pour sauvegarder vos 12 mots secrets ou changer votre code PIN.`;
    }
    if (m.includes('sécurité') || m.includes('securite') || m.includes('pin') || m.includes('12 mots') || m.includes('clé')) {
      return `🛡️ Sécurité maximale :\n✅ Chiffrement AES-256-GCM par code PIN à 6 chiffres\n✅ Clé privée stockée uniquement sur votre téléphone\n✅ Sauvegardez vos 12 mots dans 🛡️ Sécurité afin de pouvoir restaurer votre portefeuille si vous changez de téléphone !`;
    }
    if (m.includes('communauté') || m.includes('whatsapp') || m.includes('groupe')) {
      return `📱 Communautés officielles :\n👥 Groupe : ${CONFIG.WHATSAPP_GROUP}\n📢 Chaîne : ${CONFIG.WHATSAPP_CHANNEL}`;
    }
    if (m.includes('parrain')) {
      return `👥 Parrainage :\nPartagez votre adresse (${this.shortAddr(this.user)}) ou votre ID pour recevoir des commissions sur les achats de vos filleuls !`;
    }
    return "Posez-moi une question sur : 'minage', 'portefeuille', 'swap', 'sécurité', '12 mots', 'parrainage' ou 'communauté' !";
  }
}

// ─── Démarrage de l'application ────────────────────────────────────
const App = new Application();
window.App = App;
window.addEventListener('DOMContentLoaded', () => App.init());
