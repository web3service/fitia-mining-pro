// ═══════════════════════════════════════════════════════════════════
//  ASSISTANT FITIA LOCAL — AIDE HORS LIGNE, SANS SECRET NI HALLUCINATION
// ═══════════════════════════════════════════════════════════════════
(function (global) {
  'use strict';

  class FitiaAssistant {
    constructor(app, config = {}) {
      this.app = app;
      this.config = config;
      this.lastIntent = null;
      this.intents = this.buildIntents();
    }

    copy(en, fr) {
      return this.app.currentLang === 'fr' ? fr : en;
    }

    normalize(value) {
      return String(value || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ');
    }

    containsSensitiveSecret(value) {
      const text = String(value || '').trim();
      if (!text) return false;
      if (/^(?:0x)?[0-9a-f]{64}$/i.test(text) || /^\d{6}$/.test(text)) return true;
      const words = text.split(/\s+/);
      if (![12, 15, 18, 21, 24].includes(words.length) || !words.every((word) => /^[a-z]+$/i.test(word))) return false;
      try {
        if (global.ethers?.Mnemonic && typeof global.ethers.Mnemonic.isValidMnemonic === 'function') {
          if (global.ethers.Mnemonic.isValidMnemonic(text)) return true;
        }
      } catch (_) { /* La détection prudente ci-dessous reste disponible. */ }
      const questionTerms = /^(what|how|why|when|where|can|should|is|are|comment|pourquoi|quoi|que|est|peut|faut)\b/i;
      return !questionTerms.test(text) && new Set(words.map((word) => word.toLowerCase())).size >= 8;
    }

    formatPending(app) {
      const decimals = Number(app.ftaDecimals) || 8;
      const raw = Math.max(0, Number(app.pendingBalance) || 0);
      const value = raw / (10 ** decimals);
      return value.toFixed(decimals).replace(/\.?0+$/, '') || '0';
    }

    buildIntents() {
      const intents = [];
      const add = (id, priority, terms, answer) => {
        intents.push({ id, priority, terms: terms.map((term) => this.normalize(term)), answer });
      };

      add('sensitive-request', 130, [
        'share my recovery phrase', 'send my recovery phrase', 'share my private key', 'send my private key',
        'donner ma phrase', 'envoyer ma cle privee', 'partager mon code pin', 'can i give you my seed'
      ], () => this.copy(
        'Never share your recovery phrase, private key or PIN in this chat or with support. These secrets give full control of your wallet. Keep them offline and private.',
        'Ne partagez jamais votre phrase de récupération, votre clé privée ou votre PIN dans ce chat ni avec le support. Ces secrets donnent un accès total à votre portefeuille. Gardez-les hors ligne et privés.'
      ));

      add('pending-rewards', 120, [
        'pending rewards', 'pending fta', 'pending balance', 'how much fta', 'how much rewards', 'how much can i claim',
        'recompenses en attente', 'solde en attente', 'combien de fta', 'combien de recompenses', 'combien puis je reclamer'
      ], (app) => this.copy(
        `Your current estimated mining reward is ${this.formatPending(app)} FTA. It increases while an eligible machine is active. Tap CLAIM on the home screen and keep a little POL for the Polygon network fee. The final confirmed amount is recorded in your local history.`,
        `Votre récompense de minage estimée est actuellement de ${this.formatPending(app)} FTA. Elle augmente lorsqu’une machine éligible est active. Appuyez sur RÉCLAMER sur l’accueil et conservez un peu de POL pour les frais réseau Polygon. Le montant final confirmé est enregistré dans votre historique local.`
      ));

      add('balance', 115, [
        'my balance', 'wallet balance', 'my usdt', 'my fta balance', 'check balance', 'how much usdt',
        'mon solde', 'solde portefeuille', 'mes usdt', 'mon solde fta', 'verifier mon solde'
      ], (app) => {
        const balances = app.balances || {};
        const walletFta = Number(balances.walletFta) || 0;
        const miningFta = Number(balances.coreFta) || 0;
        const walletUsdt = Number(balances.walletUsdt) || 0;
        const miningUsdt = Number(balances.coreUsdt) || 0;
        const pol = (Number(balances.nativePol) || 0) + (Number(balances.corePol) || 0);
        return this.copy(
          `Your latest balances are:\n• Wallet: ${walletUsdt.toFixed(2)} USDT and ${walletFta.toFixed(8).replace(/\.?0+$/, '')} FTA\n• Mining Account: ${miningUsdt.toFixed(2)} USDT and ${miningFta.toFixed(8).replace(/\.?0+$/, '')} FTA\n• POL available for gas and transfers: ${pol.toFixed(6).replace(/\.?0+$/, '')} POL\nOpen Wallet to refresh the on-chain balances. Pending mining rewards are shown separately on Home.`,
          `Vos derniers soldes sont :\n• Portefeuille : ${walletUsdt.toFixed(2)} USDT et ${walletFta.toFixed(8).replace(/\.?0+$/, '')} FTA\n• Compte Minage : ${miningUsdt.toFixed(2)} USDT et ${miningFta.toFixed(8).replace(/\.?0+$/, '')} FTA\n• POL disponible pour le gaz et les transferts : ${pol.toFixed(6).replace(/\.?0+$/, '')} POL\nOuvrez Wallet pour actualiser les soldes on-chain. Les récompenses de minage en attente sont affichées séparément sur l’accueil.`
        );
      });

      add('address', 115, [
        'my address', 'wallet address', 'receive address', 'what is my address', 'mon adresse', 'adresse du portefeuille'
      ], (app) => this.copy(
        `Your public Polygon address is:\n${app.user || 'Unlock your wallet to view it.'}\nYou can safely share this address to receive POL, USDT or FTA. It is not a private key.`,
        `Votre adresse Polygon publique est :\n${app.user || 'Déverrouillez votre portefeuille pour la voir.'}\nVous pouvez la partager sans danger pour recevoir du POL, de l’USDT ou du FTA. Ce n’est pas une clé privée.`
      ));

      add('power', 110, ['my power', 'mining power', 'hashrate', 'ma puissance', 'puissance de minage'], (app) => this.copy(
        `Your current estimated mining power is ${app.formatHashrate(app.currentRealPower || 0)}. It depends on your connected, unexpired machines and their battery status.`,
        `Votre puissance de minage estimée actuelle est de ${app.formatHashrate(app.currentRealPower || 0)}. Elle dépend de vos machines connectées, non expirées et de l’état de leurs batteries.`
      ));

      add('machine-status', 110, ['my machines', 'active machines', 'machine status', 'mes machines', 'machines actives', 'etat machine'], (app) => {
        const now = Math.floor(Date.now() / 1000);
        const machines = Array.isArray(app.userMachines) ? app.userMachines : [];
        const active = machines.filter((machine) => Number(machine.exp) > now).length;
        return this.copy(
          `You own ${machines.length} machine${machines.length === 1 ? '' : 's'}; ${active} currently ${active === 1 ? 'is' : 'are'} within its connection period. Open Wallet → Machine & battery connection to select an available machine and a charged battery.`,
          `Vous possédez ${machines.length} machine${machines.length > 1 ? 's' : ''} ; ${active} est ou sont actuellement dans sa période de connexion. Ouvrez Wallet → Connexion machine & batterie pour sélectionner une machine disponible et une batterie chargée.`
        );
      });

      add('claim-fee', 105, ['claim fee', 'claiming fee', 'reward fee', 'frais de reclamation', 'frais claim'], (app) => {
        const fee = Number(app.claimFeePercent) || 0;
        const detail = fee > 0 ? `The currently configured claim fee is ${fee}%.` : 'No claim fee is currently shown by the latest contract data.';
        return this.copy(
          `${detail} Polygon gas is separate and paid in POL. Review the pending amount before claiming; the confirmed amount remains in your history.`,
          `${fee > 0 ? `Les frais de réclamation actuellement configurés sont de ${fee} %.` : 'Aucun frais de réclamation n’est actuellement indiqué par les dernières données du contrat.'} Le gaz Polygon est distinct et payé en POL. Vérifiez le montant en attente avant de réclamer ; le montant confirmé reste dans votre historique.`
        );
      });

      add('claim', 90, [
        'claim', 'claim rewards', 'collect rewards', 'mining rewards', 'rewards', 'reclamer', 'recompense', 'recuperer mes gains'
      ], () => this.copy(
        'To claim mining rewards:\n1. Make sure a machine is actively connected and has generated FTA.\n2. Keep a small amount of POL for Polygon gas.\n3. On Home, tap CLAIM and confirm the transaction.\n4. Wait for on-chain confirmation before claiming again. The history will show Pending, then Confirmed or Failed.',
        'Pour réclamer vos récompenses de minage :\n1. Vérifiez qu’une machine est connectée et a généré du FTA.\n2. Conservez un peu de POL pour le gaz Polygon.\n3. Sur l’accueil, appuyez sur RÉCLAMER et confirmez la transaction.\n4. Attendez la confirmation on-chain avant une nouvelle réclamation. L’historique affichera En attente, puis Confirmée ou Échouée.'
      ));

      add('forgot-pin', 105, ['forgot pin', 'forgot my pin', 'forget pin', 'forget my pin', 'pin forgotten', 'pin oublie', 'oublie mon pin'], () => this.copy(
        'If you forgot your PIN, choose “Forgot PIN?” on the unlock screen and restore the wallet with your recovery phrase or private key, then choose a new PIN. Never send those secrets to anyone. Without your recovery backup, the PIN cannot be bypassed.',
        'Si vous avez oublié votre PIN, choisissez « Code PIN oublié ? » sur l’écran de déverrouillage et restaurez le portefeuille avec votre phrase de récupération ou votre clé privée, puis choisissez un nouveau PIN. Ne transmettez jamais ces secrets. Sans sauvegarde de récupération, le PIN ne peut pas être contourné.'
      ));

      add('lost-recovery', 105, ['lost recovery phrase', 'lost my seed', 'lost private key', 'phrase perdue', 'perdu mes 12 mots', 'cle privee perdue'], () => this.copy(
        'A recovery phrase or private key cannot be reconstructed by FITIA PRO or support. If the wallet still unlocks with your PIN, immediately back up the recovery phrase from Settings → Backup & Secret Keys and consider moving funds to a new securely backed-up wallet. Never share the backup.',
        'Une phrase de récupération ou une clé privée ne peut être reconstruite ni par FITIA PRO ni par le support. Si le portefeuille s’ouvre encore avec votre PIN, sauvegardez immédiatement la phrase depuis Paramètres → Sauvegarde & Clés Secrètes et envisagez de transférer les fonds vers un nouveau portefeuille correctement sauvegardé. Ne partagez jamais cette sauvegarde.'
      ));

      add('create-wallet', 100, ['create wallet', 'new wallet', 'creer un portefeuille', 'nouveau portefeuille'], () => this.copy(
        'To create a wallet, tap CREATE NEW WALLET. Write down the 12 words in their exact order, verify the requested words, then create a strong 6-digit PIN. Keep the recovery phrase offline: it is the only way to restore the wallet on another device.',
        'Pour créer un portefeuille, appuyez sur CRÉER UN PORTEFEUILLE. Notez les 12 mots dans leur ordre exact, vérifiez les mots demandés, puis créez un PIN robuste à 6 chiffres. Conservez la phrase de récupération hors ligne : elle permet de restaurer le portefeuille sur un autre appareil.'
      ));

      add('import-wallet', 100, ['import wallet', 'restore wallet', 'import existing', 'import', 'importer un portefeuille', 'restaurer un portefeuille', 'importer'], () => this.copy(
        'To import an existing wallet, choose “I already have a wallet” on the welcome screen. Select Phrase or Private Key, enter it only in the secure import field, verify the detected address, then choose your PIN. Never import a phrase supplied by another person.',
        'Pour importer un portefeuille existant, choisissez « J’ai déjà un portefeuille » sur l’accueil. Sélectionnez Phrase ou Clé privée, saisissez-la uniquement dans le champ d’import sécurisé, vérifiez l’adresse détectée, puis choisissez votre PIN. N’importez jamais une phrase fournie par une autre personne.'
      ));

      add('backup', 95, ['recovery phrase', 'seed phrase', '12 words', 'backup', 'private key security', 'phrase de recuperation', '12 mots', 'sauvegarde'], () => this.copy(
        'Your 12-word recovery phrase controls the wallet. Write it down offline in the correct order and store multiple secure copies where only you can access them. Do not screenshot it, upload it, or send it to support. You can reveal it in Settings after PIN confirmation.',
        'Votre phrase de récupération de 12 mots contrôle le portefeuille. Notez-la hors ligne dans le bon ordre et conservez plusieurs copies sécurisées accessibles uniquement par vous. Ne la photographiez pas, ne la téléversez pas et ne l’envoyez pas au support. Vous pouvez l’afficher dans Paramètres après confirmation du PIN.'
      ));

      add('mining-setup', 85, [
        'start mining', 'how to mine', 'buy machine', 'connect machine', 'battery', 'mining machine',
        'commencer a miner', 'comment miner', 'acheter machine', 'connecter machine', 'batterie', 'machine de minage', 'machine'
      ], () => this.copy(
        'To start mining:\n1. Receive USDT for the purchase and a little POL for gas.\n2. In Shop, buy a machine and a compatible battery. Required deposits are handled by the app.\n3. In Wallet → Machine & battery connection, select the machine and battery, then confirm.\n4. Follow your power and pending FTA on Home. Replace or reconnect power when the battery period ends.',
        'Pour commencer à miner :\n1. Recevez des USDT pour l’achat et un peu de POL pour le gaz.\n2. Dans Boutique, achetez une machine et une batterie compatible. Les dépôts nécessaires sont gérés par l’application.\n3. Dans Wallet → Connexion machine & batterie, sélectionnez la machine et la batterie, puis confirmez.\n4. Suivez la puissance et le FTA en attente sur l’accueil. Reconnectez une source d’énergie à la fin de la période de batterie.'
      ));

      add('gas', 100, ['gas', 'network fee', 'why pol', 'need pol', 'polygon fee', 'gaz', 'frais reseau', 'pourquoi pol'], () => this.copy(
        'POL pays Polygon network fees for transactions such as purchases, claims, swaps and transfers. It is separate from USDT and FTA. Keep a small POL reserve in your wallet; if gas is insufficient, tap Receive and add POL before retrying.',
        'Le POL paie les frais réseau Polygon des achats, réclamations, swaps et transferts. Il est distinct de l’USDT et du FTA. Conservez une petite réserve de POL dans votre portefeuille ; si le gaz est insuffisant, appuyez sur Recevoir et ajoutez du POL avant de réessayer.'
      ));

      add('swap-fee', 100, ['swap fee', 'exchange fee', 'slippage', 'minimum received', 'frais swap', 'frais echange', 'minimum recu'], () => this.copy(
        'FITIA Core USDT ↔ FTA swaps display a 4% swap fee and the estimated minimum received. POL ↔ USDT uses QuickSwap V2: the pool fee, price impact and minimum received are included in the quote. Slippage protects you from an unfavorable price change; request a fresh quote if the price moves too far or the quote expires.',
        'Les swaps FITIA Core USDT ↔ FTA affichent des frais de 4 % et le minimum estimé. POL ↔ USDT utilise QuickSwap V2 : les frais du pool, l’impact du prix et le minimum reçu figurent dans le devis. Le slippage protège contre une variation défavorable ; demandez un nouveau devis si le prix change trop ou si le devis expire.'
      ));

      add('swap', 70, ['swap', 'exchange', 'convert', 'echanger', 'echange', 'convertir'], () => this.copy(
        'Open Swap, select the market and direction, then enter an amount. Review the rate, fees, price impact when applicable, minimum received and your POL gas reserve before confirming. USDT ↔ FTA uses FITIA Core; POL ↔ USDT uses QuickSwap V2. Wait for confirmation before submitting another transaction.',
        'Ouvrez Swap, sélectionnez le marché et la direction, puis saisissez un montant. Vérifiez le taux, les frais, l’impact du prix le cas échéant, le minimum reçu et votre réserve de POL avant de confirmer. USDT ↔ FTA utilise FITIA Core ; POL ↔ USDT utilise QuickSwap V2. Attendez la confirmation avant une autre transaction.'
      ));

      add('deposit-withdraw', 95, ['deposit and withdraw', 'deposit withdraw', 'deposer et retirer', 'depot et retrait'], () => this.copy(
        'In Wallet → Mining Account, DEPOSIT moves assets from your Polygon wallet to the contract balance used by mining features; WITHDRAW moves available assets back to your wallet. Select the token and amount, keep POL for gas and wait for each transaction to confirm before starting another.',
        'Dans Wallet → Compte Minage, DÉPOSER transfère les actifs du portefeuille Polygon vers le solde du contrat utilisé par le minage ; RETIRER transfère les actifs disponibles vers votre portefeuille. Sélectionnez le jeton et le montant, conservez du POL pour le gaz et attendez la confirmation de chaque transaction avant d’en commencer une autre.'
      ));

      add('deposit', 80, ['deposit', 'add to mining account', 'deposer', 'depot', 'ajouter au compte minage'], () => this.copy(
        'In Wallet → Mining Account, choose DEPOSIT to move USDT, FTA or POL from your Polygon wallet to the Mining Account used by the shop and FITIA Core swap. Check the token and amount, keep POL for gas, and wait for confirmation.',
        'Dans Wallet → Compte Minage, choisissez DÉPOSER pour transférer USDT, FTA ou POL depuis votre portefeuille Polygon vers le Compte Minage utilisé par la boutique et le swap FITIA Core. Vérifiez le jeton et le montant, conservez du POL pour le gaz et attendez la confirmation.'
      ));

      add('withdraw', 80, ['withdraw', 'withdraw to wallet', 'retirer', 'retrait', 'retirer vers portefeuille'], () => this.copy(
        'In Wallet → Mining Account, choose WITHDRAW to move available USDT, FTA or POL back to your Polygon wallet. Mining rewards must first be claimed according to the contract flow. Keep POL for gas and wait for on-chain confirmation.',
        'Dans Wallet → Compte Minage, choisissez RETIRER pour transférer les USDT, FTA ou POL disponibles vers votre portefeuille Polygon. Les récompenses de minage doivent d’abord être réclamées selon le fonctionnement du contrat. Conservez du POL pour le gaz et attendez la confirmation on-chain.'
      ));

      add('receive', 85, ['receive', 'qr code', 'recevoir', 'recevoir des tokens'], (app) => this.copy(
        `In Wallet, tap Receive to show your QR code and public address${app.user ? ` (${app.shortAddr(app.user)})` : ''}. Receive only POL, USDT or FTA on Polygon, and verify the sender uses the correct network. Your address is public; your recovery phrase and private key are not.`,
        `Dans Wallet, appuyez sur Recevoir pour afficher votre QR code et votre adresse publique${app.user ? ` (${app.shortAddr(app.user)})` : ''}. Recevez uniquement du POL, de l’USDT ou du FTA sur Polygon et vérifiez que l’expéditeur utilise le bon réseau. Votre adresse est publique ; votre phrase de récupération et votre clé privée ne le sont pas.`
      ));

      add('send', 80, ['send token', 'transfer', 'send usdt', 'send fta', 'envoyer', 'transfert', 'envoyer usdt'], () => this.copy(
        'In Wallet, tap Send, select POL, USDT or FTA, paste the recipient address and enter the amount. Verify the full address and network, keep enough POL for gas, then authorize with your PIN. Sending to contract or burn addresses is blocked for protection.',
        'Dans Wallet, appuyez sur Envoyer, sélectionnez POL, USDT ou FTA, collez l’adresse du destinataire et saisissez le montant. Vérifiez l’adresse complète et le réseau, conservez assez de POL pour le gaz, puis autorisez avec votre PIN. Les envois vers les contrats ou l’adresse nulle sont bloqués pour votre protection.'
      ));

      add('history', 90, ['history', 'transaction status', 'transaction pending', 'transaction failed', 'historique', 'transaction en attente', 'transaction echouee'], () => this.copy(
        'Activity → History shows transactions initiated in FITIA PRO with Pending, Confirmed or Failed status. A pending transaction is waiting for Polygon confirmation; avoid sending it again immediately. Failed entries include a contract reason when available. The history is local to this wallet on this device, so older or external operations may not appear.',
        'Activité → Historique affiche les transactions initiées dans FITIA PRO avec les statuts En attente, Confirmée ou Échouée. Une transaction en attente attend la confirmation Polygon ; évitez de la renvoyer immédiatement. Les échecs indiquent le motif du contrat lorsqu’il est disponible. L’historique est local à ce portefeuille sur cet appareil ; les opérations anciennes ou externes peuvent ne pas apparaître.'
      ));

      add('referral', 80, ['referral', 'referrer', 'invite', 'parrain', 'parrainage', 'inviter'], (app) => this.copy(
        `Open Settings → Referral program to copy or share your referral link or backup code${app.getMyReferralCode?.() ? ` (${app.getMyReferralCode()})` : ''}, view your linked referrer, or link a referrer using a FITIA code, numeric ID or Polygon address. A referral link or code never gives access to your funds.`,
        `Ouvrez Paramètres → Programme de parrainage pour copier ou partager votre lien ou code de secours${app.getMyReferralCode?.() ? ` (${app.getMyReferralCode()})` : ''}, voir votre parrain ou associer un parrain avec un code FITIA, un identifiant numérique ou une adresse Polygon. Un lien ou code de parrainage ne donne jamais accès à vos fonds.`
      ));

      add('pin-security', 75, ['pin', 'biometric', 'auto lock', 'change pin', 'code pin', 'biometrie', 'verrouillage'], () => this.copy(
        'Use a unique 6-digit PIN that is not repetitive or sequential. In Settings you can change the PIN, enable supported biometric unlock and configure auto-lock. The PIN encrypts your local vault; it does not replace the recovery phrase.',
        'Utilisez un PIN unique à 6 chiffres, non répétitif et non séquentiel. Dans Paramètres, vous pouvez modifier le PIN, activer la biométrie compatible et configurer le verrouillage automatique. Le PIN chiffre le coffre local ; il ne remplace pas la phrase de récupération.'
      ));

      add('security', 60, ['security', 'safe', 'non custodial', 'secure', 'securite', 'securise', 'non custodial'], () => this.copy(
        'FITIA PRO is non-custodial: keys remain encrypted on your device. Protect your recovery phrase, private key and PIN, verify every transaction, keep your device updated and never follow instructions from someone asking for those secrets. Support will never need them.',
        'FITIA PRO est non-custodial : les clés restent chiffrées sur votre appareil. Protégez votre phrase de récupération, votre clé privée et votre PIN, vérifiez chaque transaction, gardez votre appareil à jour et ne suivez jamais les instructions d’une personne demandant ces secrets. Le support n’en aura jamais besoin.'
      ));

      add('price', 75, ['fta price', 'token price', 'exchange rate', 'cours fta', 'prix fta', 'taux de change'], (app) => {
        const price = Number(app.ftaPriceUsd) || 0;
        return this.copy(
          price > 0
            ? `The latest in-app estimate is 1 FTA ≈ ${price.toFixed(6)} USDT. Open Swap for a fresh transaction quote; the executable rate, liquidity and fees determine the final amount.`
            : 'The FTA rate is not currently available. Check your connection and open Swap to request a fresh on-chain quote before making a decision.',
          price > 0
            ? `La dernière estimation dans l’application est 1 FTA ≈ ${price.toFixed(6)} USDT. Ouvrez Swap pour obtenir un nouveau devis ; le taux exécutable, la liquidité et les frais déterminent le montant final.`
            : 'Le cours du FTA n’est pas disponible actuellement. Vérifiez votre connexion et ouvrez Swap pour demander un nouveau devis on-chain avant toute décision.'
        );
      });

      add('update', 75, ['update', 'new version', 'install update', 'mise a jour', 'nouvelle version'], () => this.copy(
        'When a new signed version is required, FITIA PRO displays a blocking update screen. Use Download and install inside the app, then confirm Android’s installation prompt. Back up your recovery phrase before any wallet reinstallation or device change.',
        'Lorsqu’une nouvelle version signée est requise, FITIA PRO affiche un écran de mise à jour bloquant. Utilisez Télécharger et installer dans l’application, puis confirmez l’installation Android. Sauvegardez votre phrase de récupération avant toute réinstallation ou changement d’appareil.'
      ));

      add('language', 75, ['language', 'english', 'french', 'change language', 'langue', 'anglais', 'francais'], () => this.copy(
        'Use the language selector in the main header to switch between English, Français, Deutsch, 中文 and English (SG). Your choice is saved on this device; English is the default for a new installation.',
        'Utilisez le sélecteur de langue dans l’en-tête principal pour choisir English, Français, Deutsch, 中文 ou English (SG). Votre choix est enregistré sur cet appareil ; l’anglais est la langue par défaut d’une nouvelle installation.'
      ));

      add('announcements', 65, ['announcement', 'event', 'promotion', 'news', 'annonce', 'evenement', 'promotion', 'actualite'], () => this.copy(
        'Official announcements can appear on Home. Shop gift cards and badges are visual presentations only: they never change a machine’s on-chain price or purchase conditions. Always check the actual shop details before confirming.',
        'Les annonces officielles peuvent apparaître sur l’accueil. Les cartes cadeaux et badges de la boutique sont uniquement visuels : ils ne modifient jamais le prix on-chain ni les conditions d’achat. Vérifiez toujours les informations réelles de la boutique avant de confirmer.'
      ));

      add('network', 70, ['network error', 'rpc', 'connection problem', 'offline', 'erreur reseau', 'probleme connexion', 'hors ligne'], () => this.copy(
        'Check your internet connection and retry after a few seconds. FITIA PRO can switch between public Polygon RPC nodes automatically. Balances and quotes may be stale while offline; never assume a transaction failed only because a response was interrupted—check its local status before retrying.',
        'Vérifiez votre connexion Internet et réessayez après quelques secondes. FITIA PRO peut basculer automatiquement entre plusieurs nœuds RPC Polygon publics. Les soldes et devis peuvent être anciens hors ligne ; ne considérez pas une transaction comme échouée uniquement parce qu’une réponse a été interrompue : vérifiez son statut local avant de réessayer.'
      ));

      add('community', 70, ['community', 'whatsapp', 'official group', 'support contact', 'communaute', 'groupe officiel', 'contacter support'], () => this.copy(
        `Official communities:\n• Group: ${this.config.WHATSAPP_GROUP || ''}\n• Channel: ${this.config.WHATSAPP_CHANNEL || ''}\nNever share recovery phrases, private keys or PIN codes with anyone there.`,
        `Communautés officielles :\n• Groupe : ${this.config.WHATSAPP_GROUP || ''}\n• Chaîne : ${this.config.WHATSAPP_CHANNEL || ''}\nN’y partagez jamais de phrase de récupération, clé privée ou code PIN.`
      ));

      add('fees', 55, ['fee', 'fees', 'cost', 'frais', 'cout'], () => this.copy(
        'There are three different cost types: Polygon gas paid in POL, the 4% fee shown for FITIA Core USDT ↔ FTA swaps, and QuickSwap pool/price costs for POL ↔ USDT. Any applicable claim fee is shown by the contract data. Always review the confirmation details before signing.',
        'Il existe trois types de coûts : le gaz Polygon payé en POL, les frais de 4 % affichés pour les swaps FITIA Core USDT ↔ FTA, et les coûts du pool/prix QuickSwap pour POL ↔ USDT. Les éventuels frais de réclamation proviennent des données du contrat. Vérifiez toujours les détails avant de signer.'
      ));

      add('wallet', 50, ['wallet', 'portefeuille', 'non custodial wallet'], () => this.copy(
        'FITIA PRO includes a Polygon wallet secured by your PIN and device protections. It can hold POL, USDT and FTA, while the Mining Account is a separate contract balance used for mining, shop purchases and FITIA Core swaps. You control the wallet through your recovery phrase; no support agent should ever request it.',
        'FITIA PRO intègre un portefeuille Polygon protégé par votre PIN et les protections de l’appareil. Il peut contenir du POL, de l’USDT et du FTA, tandis que le Compte Minage est un solde de contrat distinct utilisé pour le minage, la boutique et les swaps FITIA Core. Vous contrôlez le portefeuille avec votre phrase de récupération ; aucun agent du support ne doit la demander.'
      ));

      add('token-info', 45, ['what is fta', 'what is usdt', 'what is pol', 'token', 'polygon network', 'quest ce que fta', 'quest ce que usdt', 'quest ce que pol', 'jeton', 'reseau polygon'], () => this.copy(
        'POL is Polygon’s network token and pays gas. USDT is a stable-value token used for purchases and swaps. FTA is the FITIA ecosystem token used by mining rewards and app features. Always verify the Polygon network and token before sending assets.',
        'Le POL est le jeton du réseau Polygon et paie le gaz. L’USDT est un jeton à valeur stable utilisé pour les achats et swaps. Le FTA est le jeton de l’écosystème FITIA utilisé par les récompenses de minage et les fonctions de l’application. Vérifiez toujours le réseau Polygon et le jeton avant un envoi.'
      ));

      add('troubleshooting', 35, ['error', 'not working', 'failed', 'problem', 'issue', 'erreur', 'echoue', 'probleme', 'bug'], () => this.copy(
        'Tell me which feature you were using and the exact non-sensitive error message. First check your internet connection, POL gas balance, token balance and whether the same transaction is already pending. Do not repeatedly submit a transaction after an interrupted response; check Activity → History first.',
        'Indiquez-moi la fonction utilisée et le message d’erreur exact sans information sensible. Vérifiez d’abord la connexion Internet, le solde de POL pour le gaz, le solde du jeton et l’absence d’une transaction déjà en attente. Ne renvoyez pas une transaction après une réponse interrompue sans vérifier Activité → Historique.'
      ));

      add('fitia-info', 25, ['fitia pro', 'what is fitia', 'this app', 'quest ce que fitia', 'cette application'], () => this.copy(
        'FITIA PRO is a standalone Android app for the FITIA ecosystem on Polygon. It combines an encrypted non-custodial wallet, mining and rewards, a machine shop, swaps, referrals and local transaction history. The assistant works locally and does not need your secrets.',
        'FITIA PRO est une application Android autonome pour l’écosystème FITIA sur Polygon. Elle réunit un portefeuille non-custodial chiffré, le minage et les récompenses, une boutique de machines, les swaps, le parrainage et un historique local. L’assistant fonctionne localement et n’a pas besoin de vos secrets.'
      ));

      add('greeting', 40, ['hello', 'hi', 'hey', 'good morning', 'good evening', 'bonjour', 'salut', 'bonsoir'], (app) => this.copy(
        `Hello! Your FITIA PRO assistant is ready. I can explain wallet creation or recovery, mining, claims, balances, swaps, fees, security, referrals and transaction issues. Your wallet is ${app.shortAddr(app.user)}. What do you need help with?`,
        `Bonjour ! Votre assistant FITIA PRO est prêt. Je peux expliquer la création ou la récupération du portefeuille, le minage, les réclamations, les soldes, les swaps, les frais, la sécurité, le parrainage et les problèmes de transaction. Votre portefeuille est ${app.shortAddr(app.user)}. Comment puis-je vous aider ?`
      ));

      add('thanks', 45, ['thank you', 'thanks', 'merci', 'merci beaucoup'], () => this.copy(
        'You’re welcome. I’m here whenever you need help with FITIA PRO.',
        'Avec plaisir. Je reste disponible pour vous aider avec FITIA PRO.'
      ));

      add('help', 30, ['help', 'what can you do', 'aide', 'que peux tu faire'], () => this.copy(
        'I can help you create or restore a wallet, back it up safely, receive or send assets, buy and connect machines, claim FTA, understand balances and fees, use swaps, manage referrals, interpret transaction statuses and troubleshoot common errors. Ask your question in your own words and never include a secret.',
        'Je peux vous aider à créer ou restaurer un portefeuille, le sauvegarder, recevoir ou envoyer des actifs, acheter et connecter des machines, réclamer du FTA, comprendre les soldes et frais, utiliser les swaps, gérer le parrainage, interpréter les transactions et résoudre les erreurs courantes. Posez votre question avec vos propres mots sans inclure de secret.'
      ));

      return intents;
    }

    scoreIntent(intent, normalizedMessage) {
      const padded = ` ${normalizedMessage} `;
      let score = 0;
      for (const term of intent.terms) {
        if (term && padded.includes(` ${term} `)) {
          score += term.split(' ').length * 3 + Math.min(3, Math.floor(term.length / 8));
        }
      }
      return score > 0 ? score + intent.priority : 0;
    }

    getWelcomeMessage() {
      const messages = {
        fr: '👋 Bienvenue sur FITIA PRO Autonome !\nVotre portefeuille Polygon est directement intégré et chiffré.\nPosez vos questions sur : Wallet, Minage, Swap, Sécurité ou Parrainage !',
        en: '👋 Welcome to FITIA PRO!\nI can help with wallet setup and recovery, mining, rewards, balances, swaps, fees, security, referrals and troubleshooting. Ask in your own words—never share your recovery phrase, private key or PIN.',
        de: '👋 Willkommen bei FITIA PRO! Frag mich zu Wallet, Mining, Tausch und Sicherheit. Teile niemals Wiederherstellungsphrase, privaten Schlüssel oder PIN.',
        zh: '👋 欢迎使用 FITIA PRO！我可以帮助您了解钱包、挖矿、奖励、兑换、费用和安全。请勿分享助记词、私钥或 PIN。',
        sg: '👋 Welcome to FITIA PRO! Ask about Wallet, Mining, Rewards, Swap, Security or Referral. Never share your recovery phrase, private key or PIN.'
      };
      return messages[this.app.currentLang] || messages.en;
    }

    sensitiveResponse() {
      return this.copy(
        'For your security, I hid that message and did not store the secret in the chat history. Never share your recovery phrase, private key or PIN with anyone, including support. If you already exposed them elsewhere, move your funds to a new wallet with a new recovery phrase as soon as possible.',
        'Pour votre sécurité, j’ai masqué ce message et je n’ai pas enregistré le secret dans l’historique du chat. Ne partagez jamais votre phrase de récupération, votre clé privée ou votre PIN, même avec le support. Si vous les avez déjà exposés ailleurs, transférez vos fonds vers un nouveau portefeuille avec une nouvelle phrase de récupération dès que possible.'
      );
    }

    fallbackResponse() {
      return this.copy(
        'I don’t have enough reliable information to answer that accurately. I can help with FITIA PRO, wallets, mining, rewards, balances, deposits, withdrawals, swaps, fees, security, referrals, updates and transaction problems. Rephrase your question with the feature or error you see. Never include your recovery phrase, private key or PIN.',
        'Je n’ai pas assez d’informations fiables pour répondre précisément. Je peux vous aider avec FITIA PRO, le portefeuille, le minage, les récompenses, les soldes, les dépôts, retraits, swaps, frais, la sécurité, le parrainage, les mises à jour et les problèmes de transaction. Reformulez votre question en indiquant la fonction ou l’erreur affichée. N’incluez jamais votre phrase de récupération, clé privée ou PIN.'
      );
    }

    respond(message) {
      if (this.containsSensitiveSecret(message)) return this.sensitiveResponse();
      const normalized = this.normalize(message);
      if (!normalized) return this.fallbackResponse();
      let best = null;
      let bestScore = 0;
      for (const intent of this.intents) {
        const score = this.scoreIntent(intent, normalized);
        if (score > bestScore) {
          best = intent;
          bestScore = score;
        }
      }
      if (!best) {
        this.lastIntent = null;
        return this.fallbackResponse();
      }
      this.lastIntent = best.id;
      try {
        return best.answer(this.app);
      } catch (_) {
        return this.fallbackResponse();
      }
    }
  }

  global.FitiaAssistant = FitiaAssistant;
})(window);
