// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ─── Core interface (ce dont Mine a besoin) ───────────────────────
interface ICore {
    function owner() external view returns (address);
    function usdt() external view returns (address);
    function fta() external view returns (address);
    function feeRecv() external view returns (address);
    function baseRate() external view returns (uint256);
    function slope() external view returns (uint256);
    function netFta() external view returns (uint256);
    function devFee() external view returns (uint256);
    function comRates(uint256) external view returns (uint256);
    function claimFee() external view returns (uint256);
    function uBal(address) external view returns (uint256);
    function fBal(address) external view returns (uint256);
    function refr(address) external view returns (address);
    function uid(address) external view returns (uint256);
    function aToId(uint256) external view returns (address);
    function difficulty() external view returns (uint256);
    function costFta(uint256 a) external view returns (uint256);
    function mEnsure(address a) external returns (uint256);
    function mDebitU(address u, uint256 a) external;
    function mCreditU(address u, uint256 a) external;
    function mDebitF(address u, uint256 a) external;
    function mCreditF(address u, uint256 a) external;
    function mDebitN(uint256 a) external;
    function mCreditN(uint256 a) external;
    function mPayFeeCom(address buyer, uint256 total, bool isFta) external;
}

// ═══════════════════════════════════════════════════════════════════
//  FitiaMiningV3_Mine — Machines • Batteries • Mining • Rewards
//  V3.2 — Ajout : expiration des machines, modif puissance/durée
// ═══════════════════════════════════════════════════════════════════
contract FitiaMiningV3_Mine {
    ICore public core;

    uint256 constant MAX_MACHINES = 100;
    uint256 constant MAX_PRICE = 1_000_000 * 1e6;        // $1M max
    uint256 constant MAX_DUR = 365 days;                 // 1 an max
    uint256 constant MAX_GIFT = 1000;
    uint256 constant MAX_POWER = 1_000_000_000;          // 1 milliard max

    // ─── Types de machines (shop) ──────────────────────────────────
    // shopExpiry = 0 → pas d'expiration (disponible indéfiniment)
    // shopExpiry > 0 → timestamp Unix après lequel la machine n'est plus achetable
    struct MType { uint256 price; uint256 power; uint256 shopExpiry; }
    struct BType { uint256 price; uint256 dur; }
    struct MInst { uint256 tid; uint256 exp; }

    MType[] public mTypes;
    BType[] public bTypes;

    struct User { MInst[] machines; uint256 lc; }
    mapping(address => User) private _u;
    mapping(address => mapping(uint256 => uint256)) private _inv;

    // ─── Custom errors ─────────────────────────────────────────────
    error Z(); error AM0(); error BadType(); error MaxM(); error NoM();
    error Running(); error NoBat(); error InsF(string w); error FeesH();
    error NotOwner(); error RefNoM(); error Expired(string w);

    constructor(address _core) { core = ICore(_core); }
    modifier onlyAdm() { if (msg.sender != core.owner()) revert NotOwner(); _; }

    // ═══════════════════════════════════════════════════════════════
    //  ACHATS
    // ═══════════════════════════════════════════════════════════════

    function buyMachine(uint256 t) external { _buyM(msg.sender, t, false); }
    function buyMachineFTA(uint256 t) external { _buyM(msg.sender, t, true); }

    // ─── Achat interne d'une machine ───────────────────────────────
    function _buyM(address u, uint256 t, bool f) internal {
        if (t >= mTypes.length) revert BadType();
        // Vérifie que la machine n'a pas expiré dans le shop
        uint256 exp = mTypes[t].shopExpiry;
        if (exp > 0 && block.timestamp > exp) revert Expired("M");
        if (_u[u].machines.length >= MAX_MACHINES) revert MaxM();
        core.mEnsure(u);
        _pay(u, mTypes[t].price, f);
        // La machine hérite du shopExpiry comme date d'expiration utilisateur
        // (0 = pas d'expiration utilisateur non plus)
        _u[u].machines.push(MInst(t, exp));
    }

    function buyBattery(uint256 t) external { _buyB(msg.sender, t, false); }
    function buyBatteryFTA(uint256 t) external { _buyB(msg.sender, t, true); }

    function _buyB(address u, uint256 t, bool f) internal {
        if (t >= bTypes.length) revert BadType();
        core.mEnsure(u);
        _pay(u, bTypes[t].price, f);
        _inv[u][t]++;
    }

    // ─── Paiement (USDT ou FTA via le Core) ────────────────────────
    function _pay(address u, uint256 price, bool f) internal {
        if (f) {
            uint256 fn_ = core.costFta(price);
            uint256 tfp = core.devFee() + core.comRates(0) + core.comRates(1) + core.comRates(2);
            if (tfp >= 100) revert FeesH();
            uint256 tp = fn_ + ((fn_ * tfp) / (100 - tfp));
            if (core.fBal(u) < tp) revert InsF("FTA");
            core.mDebitF(u, tp);
            core.mPayFeeCom(u, tp, true);
            core.mDebitN(fn_);
        } else {
            if (core.uBal(u) < price) revert InsF("USDT");
            core.mDebitU(u, price);
            core.mPayFeeCom(u, price, false);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  GIFTS (admin only)
    // ═══════════════════════════════════════════════════════════════

    function giftMachine(address u, uint256 t) external onlyAdm {
        if (u == address(0)) revert Z();
        if (t >= mTypes.length) revert BadType();
        if (_u[u].machines.length >= MAX_MACHINES) revert MaxM();
        // Le gift ignore l'expiration shop — l'admin peut donner même une machine expirée
        // La machine hérite du shopExpiry comme date limite utilisateur
        _u[u].machines.push(MInst(t, mTypes[t].shopExpiry));
    }

    function giftBatteries(address u, uint256 t, uint256 c) external onlyAdm {
        if (u == address(0)) revert Z();
        if (t >= bTypes.length) revert BadType();
        if (c == 0 || c > MAX_GIFT) revert AM0();
        _inv[u][t] += c;
    }

    // ═══════════════════════════════════════════════════════════════
    //  MINING
    // ═══════════════════════════════════════════════════════════════

    function plugInMachine(uint256 mi, uint256 bi) external { _plug(msg.sender, mi, bi); }

    function _plug(address u, uint256 mi, uint256 bi) internal {
        User storage ur = _u[u];
        if (mi >= ur.machines.length || bi >= bTypes.length) revert BadType();
        MInst storage m = ur.machines[mi];
        if (m.exp > 0 && m.exp >= block.timestamp) revert Running();
        if (_inv[u][bi] == 0) revert NoBat();
        // Claim les rewards accumulés avant de brancher
        uint256 pw = _power(u);
        if (pw > 0 && ur.lc < block.timestamp) _cr(u, pw);
        _inv[u][bi]--;
        m.exp = block.timestamp + bTypes[bi].dur;
        ur.lc = block.timestamp;
    }

    function claimRewards() external { _claim(msg.sender); }

    function _claim(address u) internal {
        User storage ur = _u[u];
        if (ur.machines.length == 0) revert NoM();
        uint256 pw = _power(u);
        if (pw == 0) { ur.lc = block.timestamp; return; }
        if (block.timestamp <= ur.lc) return;
        if (ur.lc == 0) { ur.lc = block.timestamp; return; }
        _cr(u, pw);
    }

    function _cr(address u, uint256 pw) internal {
        uint256 rw = ((block.timestamp - _u[u].lc) * pw * core.difficulty()) / 1e18;
        _u[u].lc = block.timestamp;
        if (rw == 0) return;
        uint256 fee = (rw * core.claimFee()) / 100;
        uint256 net = rw - fee;
        core.mCreditF(u, net);
        if (fee > 0) core.mCreditF(core.feeRecv(), fee);
        core.mCreditN(net);
    }

    // ─── Calcul de la puissance active ─────────────────────────────
    function _power(address u) internal view returns (uint256) {
        User storage ur = _u[u];
        uint256 p = 0;
        for (uint i = 0; i < ur.machines.length; i++) {
            if (ur.machines[i].exp > 0 && block.timestamp < ur.machines[i].exp)
                p += mTypes[ur.machines[i].tid].power;
        }
        return p;
    }

    // ═══════════════════════════════════════════════════════════════
    //  ADMIN — Gestion du shop (onlyAdm = owner du Core)
    // ═══════════════════════════════════════════════════════════════

    // ─── Machines ──────────────────────────────────────────────────

    /// @notice Ajoute un type de machine dans le shop
    /// @param p   Prix en unités USDT (6 décimales)
    /// @param pw  Puissance (entier brut, ex: 1000)
    /// @param exp Timestamp d'expiration dans le shop (0 = jamais)
    function addMachineType(uint256 p, uint256 pw, uint256 exp) external onlyAdm {
        if (p == 0 || p > MAX_PRICE) revert AM0();
        if (pw == 0 || pw > MAX_POWER) revert AM0();
        mTypes.push(MType(p, pw, exp));
    }

    /// @notice Modifie le prix d'une machine existante
    function setMachinePrice(uint256 id, uint256 p) external onlyAdm {
        if (id >= mTypes.length) revert BadType();
        if (p == 0 || p > MAX_PRICE) revert AM0();
        mTypes[id].price = p;
    }

    /// @notice Modifie la puissance d'une machine existante
    function setMachinePower(uint256 id, uint256 pw) external onlyAdm {
        if (id >= mTypes.length) revert BadType();
        if (pw == 0 || pw > MAX_POWER) revert AM0();
        mTypes[id].power = pw;
    }

    /// @notice Modifie la date d'expiration dans le shop d'une machine
    /// @param exp Timestamp Unix d'expiration (0 = jamais)
    function setMachineExpiry(uint256 id, uint256 exp) external onlyAdm {
        if (id >= mTypes.length) revert BadType();
        mTypes[id].shopExpiry = exp;
    }

    // ─── Batteries ─────────────────────────────────────────────────

    /// @notice Ajoute un type de batterie dans le shop
    /// @param p Prix en unités USDT (6 décimales)
    /// @param d Durée en secondes (ex: 3 days = 259200)
    function addBatteryType(uint256 p, uint256 d) external onlyAdm {
        if (p == 0 || p > MAX_PRICE) revert AM0();
        if (d == 0 || d > MAX_DUR) revert AM0();
        bTypes.push(BType(p, d));
    }

    /// @notice Modifie le prix d'une batterie existante
    function setBatteryPrice(uint256 id, uint256 p) external onlyAdm {
        if (id >= bTypes.length) revert BadType();
        if (p == 0 || p > MAX_PRICE) revert AM0();
        bTypes[id].price = p;
    }

    /// @notice Modifie la durée d'une batterie existante
    /// @param d Durée en secondes
    function setBatteryDuration(uint256 id, uint256 d) external onlyAdm {
        if (id >= bTypes.length) revert BadType();
        if (d == 0 || d > MAX_DUR) revert AM0();
        bTypes[id].dur = d;
    }

    // ═══════════════════════════════════════════════════════════════
    //  VIEWS
    // ═══════════════════════════════════════════════════════════════

    function powerOf(address u) external view returns (uint256) { return _power(u); }
    function mCount() external view returns (uint256) { return mTypes.length; }
    function bCount() external view returns (uint256) { return bTypes.length; }

    // getMType(id) et getBType(id) sont des alias car mTypes/bTypes
    // sont public et génèrent automatiquement les getters de struct.
    // On garde des noms explicites pour l'ABI du frontend.
    function getMType(uint256 id) external view returns (uint256 price, uint256 power, uint256 shopExpiry) {
        MType storage m = mTypes[id];
        return (m.price, m.power, m.shopExpiry);
    }
    function getBType(uint256 id) external view returns (uint256 price, uint256 dur) {
        BType storage b = bTypes[id];
        return (b.price, b.dur);
    }

    function myMachines(address u) external view returns (MInst[] memory) { return _u[u].machines; }
    function myBattery(address u, uint256 t) external view returns (uint256) { return _inv[u][t]; }

    function myInfo(address u) external view returns (uint256 mc, uint256 ap, uint256 lc) {
        mc = _u[u].machines.length; ap = _power(u); lc = _u[u].lc;
    }
}
