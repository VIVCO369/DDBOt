import React, { useCallback, useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { getAppId, getSocketURL } from '@/components/shared';
import DerivAPIBasic from '@deriv/deriv-api/dist/DerivAPIBasic';
import './king-of-matches.scss';

// ─── Types ─────────────────────────────────────────────────────────────────────

type TCondition = 'all_most' | 'all_least' | 'any_most' | 'any_least' | 'none';
type TTradeMode = 'most' | 'least';
type TContractResult = 'won' | 'lost' | 'pending';
type TTradeLog = { time: string; digit: number; result: TContractResult; profit: number };

// ─── Constants ──────────────────────────────────────────────────────────────────

const SYMBOLS = [
    { label: 'Volatility 100 (1s)', value: 'R_100' },
    { label: 'Volatility 75 (1s)', value: 'R_75' },
    { label: 'Volatility 50 (1s)', value: 'R_50' },
    { label: 'Volatility 25 (1s)', value: 'R_25' },
    { label: 'Volatility 10 (1s)', value: 'R_10' },
    { label: 'Volatility 100', value: 'R_100' },
];

const CONDITIONS: { label: string; value: TCondition }[] = [
    { label: 'All Most Appearing', value: 'all_most' },
    { label: 'All Least Appearing', value: 'all_least' },
    { label: 'Any Most Appearing', value: 'any_most' },
    { label: 'Any Least Appearing', value: 'any_least' },
    { label: 'None', value: 'none' },
];

const TRADE_MODES: { label: string; value: TTradeMode }[] = [
    { label: 'Most Appearing', value: 'most' },
    { label: 'Least Appearing', value: 'least' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

const createApi = (): DerivAPIBasic => {
    const server = getSocketURL().replace(/[^a-zA-Z0-9.-]/g, '');
    const appId = String(getAppId()).replace(/[^a-zA-Z0-9]/g, '');
    const ws = new WebSocket(`wss://${server}/websockets/v3?app_id=${appId}&l=EN&brand=deriv`);
    return new DerivAPIBasic({ connection: ws });
};

const getLastDigit = (quote: number): number => {
    const str = quote.toFixed(2);
    return Number(str[str.length - 1]);
};

const rankDigits = (counts: number[]): { most: number[]; least: number[] } => {
    const sorted = [...counts.map((c, i) => ({ digit: i, count: c }))]
        .sort((a, b) => b.count - a.count);
    const most = sorted.slice(0, 4).map(d => d.digit);
    const least = sorted.slice(6).map(d => d.digit);
    return { most, least };
};

const checkEntryCondition = (
    lastDigits: number[],
    lastN: number,
    condition: TCondition,
    mostDigits: number[],
    leastDigits: number[]
): boolean => {
    if (condition === 'none') return true;
    const slice = lastDigits.slice(-lastN);
    if (condition === 'all_most') return slice.every(d => mostDigits.includes(d));
    if (condition === 'all_least') return slice.every(d => leastDigits.includes(d));
    if (condition === 'any_most') return slice.some(d => mostDigits.includes(d));
    if (condition === 'any_least') return slice.some(d => leastDigits.includes(d));
    return false;
};

// ─── Component ─────────────────────────────────────────────────────────────────

const KingOfMatches = observer(() => {
    // Market / data
    const [symbol, setSymbol] = useState('R_100');
    const [tickCountInput, setTickCountInput] = useState(1000);
    const [digitCounts, setDigitCounts] = useState<number[]>(Array(10).fill(0));
    const [liveDigits, setLiveDigits] = useState<number[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isLive, setIsLive] = useState(false);
    const [lastPrice, setLastPrice] = useState<number | null>(null);

    // Prediction config
    const [useDefaultStake, setUseDefaultStake] = useState(true);
    const [defaultStake, setDefaultStake] = useState('0.5');
    const [alternatingMode, setAlternatingMode] = useState(false);
    const [enableEntryPoint, setEnableEntryPoint] = useState(true);
    const [lastNDigits, setLastNDigits] = useState(5);
    const [condition, setCondition] = useState<TCondition>('all_most');
    const [tradeMode, setTradeMode] = useState<TTradeMode>('most');
    const [takeProfit, setTakeProfit] = useState('5');
    const [stopLoss, setStopLoss] = useState('10');
    const [digitEnabled, setDigitEnabled] = useState<boolean[]>(Array(10).fill(false));
    const [digitStakes, setDigitStakes] = useState<number[]>(Array(10).fill(0.5));

    // Trading state
    const [isAutoTrading, setIsAutoTrading] = useState(false);
    const [isTradingOnce, setIsTradingOnce] = useState(false);
    const [sessionProfit, setSessionProfit] = useState(0);
    const [tradeLogs, setTradeLogs] = useState<TTradeLog[]>([]);
    const [statusMsg, setStatusMsg] = useState('');
    const [alternatingState, setAlternatingState] = useState<'most' | 'least'>('most');
    const [token, setToken] = useState('');

    // API refs
    const apiRef = useRef<DerivAPIBasic | null>(null);
    const subRef = useRef<any>(null);
    const countsRef = useRef<number[]>(Array(10).fill(0));
    const liveDigitsRef = useRef<number[]>([]);
    const autoTradingRef = useRef(false);
    const sessionProfitRef = useRef(0);
    const tpRef = useRef(Number(takeProfit));
    const slRef = useRef(Number(stopLoss));
    const alternatingRef = useRef<'most' | 'least'>('most');

    // Keep refs synced
    useEffect(() => { tpRef.current = Number(takeProfit); }, [takeProfit]);
    useEffect(() => { slRef.current = Number(stopLoss); }, [stopLoss]);
    useEffect(() => { alternatingRef.current = alternatingState; }, [alternatingState]);

    // ─── API ───────────────────────────────────────────────────────────────────

    const cleanup = useCallback(() => {
        try { subRef.current?.unsubscribe?.(); } catch (_) {}
        try { apiRef.current?.disconnect?.(); } catch (_) {}
        subRef.current = null;
        apiRef.current = null;
    }, []);

    const loadHistory = useCallback(async (sym: string, count: number) => {
        cleanup();
        setIsLoading(true);
        setIsLive(false);
        setStatusMsg('Loading tick history...');
        countsRef.current = Array(10).fill(0);
        liveDigitsRef.current = [];
        setDigitCounts(Array(10).fill(0));
        setLiveDigits([]);
        setLastPrice(null);

        try {
            const api = createApi();
            apiRef.current = api;

            await new Promise<void>((resolve, reject) => {
                const conn = (api as any).connection as WebSocket;
                conn.addEventListener('open', () => resolve(), { once: true });
                conn.addEventListener('error', () => reject(new Error('WS error')), { once: true });
                setTimeout(() => reject(new Error('Connection timeout')), 12000);
            });

            // Load history
            const histRes = await api.send({
                ticks_history: sym,
                count,
                end: 'latest',
                style: 'ticks',
                adjust_start_time: 1,
            });

            if (histRes.history?.prices) {
                const newCounts = Array(10).fill(0);
                const digits: number[] = [];
                histRes.history.prices.forEach((p: number) => {
                    const d = getLastDigit(p);
                    newCounts[d]++;
                    digits.push(d);
                });
                countsRef.current = newCounts;
                liveDigitsRef.current = digits;
                setDigitCounts([...newCounts]);
                setLiveDigits([...digits]);
            }

            // Subscribe live
            const sub = api.subscribe({ ticks: sym, subscribe: 1 });
            subRef.current = sub;
            sub.subscribe({
                next: (res: any) => {
                    if (!res.tick) return;
                    const d = getLastDigit(res.tick.quote);
                    setLastPrice(res.tick.quote);
                    countsRef.current = [...countsRef.current];
                    countsRef.current[d]++;
                    liveDigitsRef.current = [...liveDigitsRef.current, d];
                    setDigitCounts([...countsRef.current]);
                    setLiveDigits([...liveDigitsRef.current]);
                    setStatusMsg('');
                },
                error: () => {
                    setIsLive(false);
                    setStatusMsg('Connection lost');
                },
            });

            setIsLive(true);
            setStatusMsg('');
        } catch (err: any) {
            setStatusMsg(`Error: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    }, [cleanup]);

    useEffect(() => {
        loadHistory(symbol, tickCountInput);
        return () => cleanup();
    }, []);

    const handleLoad = () => loadHistory(symbol, tickCountInput);

    // ─── Chart helpers ────────────────────────────────────────────────────────

    const total = digitCounts.reduce((a, b) => a + b, 0);
    const { most: mostDigits, least: leastDigits } = rankDigits(digitCounts);

    const getSortedBars = () => {
        return [...digitCounts.map((c, i) => ({ digit: i, count: c }))].sort((a, b) => b.count - a.count);
    };

    const getBarColor = (digit: number) => {
        if (mostDigits.includes(digit)) return '#26a69a';
        if (leastDigits.includes(digit)) return '#ef5350';
        return '#bdbdbd';
    };

    // ─── Prediction helpers ──────────────────────────────────────────────────

    const activeDigits = digitEnabled.map((en, i) => en ? i : -1).filter(i => i >= 0);
    const totalStake = useDefaultStake
        ? activeDigits.length * Number(defaultStake)
        : activeDigits.reduce((sum, i) => sum + digitStakes[i], 0);

    const entryMet = (() => {
        if (!enableEntryPoint) return true;
        return checkEntryCondition(liveDigitsRef.current, lastNDigits, condition, mostDigits, leastDigits);
    })();

    const lastNSlice = liveDigits.slice(-lastNDigits);

    const toggleDigit = (d: number) => {
        setDigitEnabled(prev => {
            const next = [...prev];
            next[d] = !next[d];
            return next;
        });
    };

    const selectMostAppearing = () => {
        const newEn = Array(10).fill(false);
        if (mostDigits.length > 0) newEn[mostDigits[0]] = true;
        setDigitEnabled(newEn);
    };

    const selectLeastAppearing = () => {
        const newEn = Array(10).fill(false);
        if (leastDigits.length > 0) newEn[leastDigits[0]] = true;
        setDigitEnabled(newEn);
    };

    // ─── Trading ──────────────────────────────────────────────────────────────

    const addLog = (log: TTradeLog) => {
        setTradeLogs(prev => [log, ...prev].slice(0, 50));
    };

    const stopAutoTrading = useCallback(() => {
        autoTradingRef.current = false;
        setIsAutoTrading(false);
        setStatusMsg('Auto trading stopped');
    }, []);

    const executeTradeOnce = useCallback(async () => {
        if (!token) {
            setStatusMsg('⚠️ Please enter your API token to trade');
            return;
        }
        if (activeDigits.length === 0) {
            setStatusMsg('⚠️ Please enable at least one digit');
            return;
        }
        if (enableEntryPoint && !entryMet) {
            setStatusMsg('⏳ Entry condition not met — waiting...');
            return;
        }

        setIsTradingOnce(true);
        setStatusMsg('Placing trade...');

        try {
            const tradeApi = createApi();
            await new Promise<void>((resolve, reject) => {
                const conn = (tradeApi as any).connection as WebSocket;
                conn.addEventListener('open', () => resolve(), { once: true });
                conn.addEventListener('error', () => reject(new Error('WS error')), { once: true });
                setTimeout(() => reject(new Error('timeout')), 10000);
            });

            await tradeApi.send({ authorize: token });

            const effectiveMode = alternatingMode ? alternatingRef.current : tradeMode;
            const targetDigit = effectiveMode === 'most' ? mostDigits[0] : leastDigits[0];
            const stake = useDefaultStake ? Number(defaultStake) : digitStakes[activeDigits[0]];

            const buyRes = await tradeApi.send({
                buy: 1,
                price: stake,
                parameters: {
                    contract_type: 'DIGITMATCH',
                    symbol,
                    duration: 1,
                    duration_unit: 't',
                    basis: 'stake',
                    amount: stake,
                    barrier: String(targetDigit),
                    currency: 'USD',
                },
            });

            const contractId = buyRes.buy?.contract_id;
            if (!contractId) throw new Error('No contract ID returned');

            setStatusMsg(`Trade placed — contract #${contractId}`);

            // Wait for settlement
            await new Promise(res => setTimeout(res, 2500));
            const profitRes = await tradeApi.send({
                proposal_open_contract: 1,
                contract_id: contractId,
            });
            const poc = profitRes.proposal_open_contract;
            const profit = poc?.profit ?? 0;
            const status = poc?.status === 'won' ? 'won' : 'lost';

            sessionProfitRef.current += profit;
            setSessionProfit(sessionProfitRef.current);
            addLog({ time: new Date().toLocaleTimeString('en-US', { hour12: false }), digit: targetDigit, result: status, profit });
            setStatusMsg(status === 'won' ? `✅ Won $${Math.abs(profit).toFixed(2)}` : `❌ Lost $${Math.abs(profit).toFixed(2)}`);

            if (alternatingMode) {
                setAlternatingState(prev => prev === 'most' ? 'least' : 'most');
            }

            tradeApi.disconnect?.();
        } catch (err: any) {
            setStatusMsg(`Trade error: ${err.message}`);
        } finally {
            setIsTradingOnce(false);
        }
    }, [token, activeDigits, enableEntryPoint, entryMet, alternatingMode, tradeMode, mostDigits, leastDigits, symbol, useDefaultStake, defaultStake, digitStakes]);

    const startAutoTrading = useCallback(async () => {
        if (!token) { setStatusMsg('⚠️ Please enter your API token to trade'); return; }
        if (activeDigits.length === 0) { setStatusMsg('⚠️ Please enable at least one digit'); return; }

        autoTradingRef.current = true;
        setIsAutoTrading(true);
        sessionProfitRef.current = sessionProfit;

        const loop = async () => {
            while (autoTradingRef.current) {
                // TP/SL check
                if (sessionProfitRef.current >= tpRef.current) {
                    setStatusMsg(`🏆 Take Profit $${tpRef.current} reached! Stopping.`);
                    stopAutoTrading();
                    return;
                }
                if (sessionProfitRef.current <= -slRef.current) {
                    setStatusMsg(`🛑 Stop Loss $${slRef.current} reached! Stopping.`);
                    stopAutoTrading();
                    return;
                }

                // Entry condition
                if (enableEntryPoint && !checkEntryCondition(liveDigitsRef.current, lastNDigits, condition, rankDigits(countsRef.current).most, rankDigits(countsRef.current).least)) {
                    setStatusMsg('⏳ Waiting for entry condition...');
                    await new Promise(res => setTimeout(res, 1000));
                    continue;
                }

                try {
                    const tradeApi = createApi();
                    await new Promise<void>((resolve, reject) => {
                        const conn = (tradeApi as any).connection as WebSocket;
                        conn.addEventListener('open', () => resolve(), { once: true });
                        conn.addEventListener('error', () => reject(new Error('WS error')), { once: true });
                        setTimeout(() => reject(new Error('timeout')), 10000);
                    });

                    await tradeApi.send({ authorize: token });

                    const ranks = rankDigits(countsRef.current);
                    const effectiveMode = alternatingMode ? alternatingRef.current : tradeMode;
                    const targetDigit = effectiveMode === 'most' ? ranks.most[0] : ranks.least[0];
                    const stake = useDefaultStake ? Number(defaultStake) : digitStakes[activeDigits[0]];

                    setStatusMsg(`📤 Buying DIGITMATCH on digit ${targetDigit}...`);

                    const buyRes = await tradeApi.send({
                        buy: 1,
                        price: stake,
                        parameters: {
                            contract_type: 'DIGITMATCH',
                            symbol,
                            duration: 1,
                            duration_unit: 't',
                            basis: 'stake',
                            amount: stake,
                            barrier: String(targetDigit),
                            currency: 'USD',
                        },
                    });

                    const contractId = buyRes.buy?.contract_id;
                    if (!contractId) throw new Error('No contract ID');

                    setStatusMsg(`⏳ Contract #${contractId} — waiting for result...`);

                    await new Promise(res => setTimeout(res, 2500));
                    const profitRes = await tradeApi.send({
                        proposal_open_contract: 1,
                        contract_id: contractId,
                    });
                    const poc = profitRes.proposal_open_contract;
                    const profit = poc?.profit ?? 0;
                    const status: TContractResult = poc?.status === 'won' ? 'won' : 'lost';

                    sessionProfitRef.current += profit;
                    setSessionProfit(sessionProfitRef.current);
                    addLog({ time: new Date().toLocaleTimeString('en-US', { hour12: false }), digit: targetDigit, result: status, profit });
                    setStatusMsg(status === 'won' ? `✅ Won $${Math.abs(profit).toFixed(2)} | Session: $${sessionProfitRef.current.toFixed(2)}` : `❌ Lost | Session: $${sessionProfitRef.current.toFixed(2)}`);

                    if (alternatingMode) {
                        alternatingRef.current = alternatingRef.current === 'most' ? 'least' : 'most';
                        setAlternatingState(alternatingRef.current);
                    }

                    tradeApi.disconnect?.();
                } catch (err: any) {
                    setStatusMsg(`⚠️ Trade error: ${err.message}`);
                    await new Promise(res => setTimeout(res, 2000));
                }

                await new Promise(res => setTimeout(res, 500));
            }
        };

        loop();
    }, [token, activeDigits, enableEntryPoint, alternatingMode, tradeMode, symbol, useDefaultStake, defaultStake, digitStakes, sessionProfit, lastNDigits, condition, stopAutoTrading]);

    // ─── Render ───────────────────────────────────────────────────────────────

    const sortedBars = getSortedBars();
    const maxCount = Math.max(...digitCounts, 1);

    return (
        <div className='kom'>
            {/* Header */}
            <div className='kom__header'>
                <h2 className='kom__title'>♛ King of Matches</h2>
                <div className='kom__header-row'>
                    <label className='kom__label'>Market:</label>
                    <select className='kom__select' value={symbol} onChange={e => setSymbol(e.target.value)}>
                        {SYMBOLS.map(s => <option key={s.value + s.label} value={s.value}>{s.label}</option>)}
                    </select>
                    <label className='kom__label'>Ticks:</label>
                    <input
                        className='kom__input kom__input--sm'
                        type='number'
                        min={100}
                        max={5000}
                        value={tickCountInput}
                        onChange={e => setTickCountInput(Number(e.target.value))}
                    />
                    <button className='kom__load-btn' onClick={handleLoad} disabled={isLoading}>
                        {isLoading ? '...' : 'Load'}
                    </button>
                    <div className={`kom__live-badge ${isLive ? 'kom__live-badge--on' : 'kom__live-badge--off'}`}>
                        <span className='kom__live-dot' />
                        {isLive ? 'LIVE' : 'Offline'}
                    </div>
                    {lastPrice !== null && (
                        <div className='kom__price'>
                            <span className='kom__price-label'>Price:</span>
                            <span className='kom__price-value'>{lastPrice.toFixed(2)}</span>
                            <span className='kom__price-digit' style={{ background: '#26a69a' }}>
                                {getLastDigit(lastPrice)}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Bar Chart */}
            <div className='kom__chart-section'>
                <div className='kom__bars'>
                    {sortedBars.map(({ digit, count }) => {
                        const pct = total > 0 ? ((count / total) * 100).toFixed(2) : '0.00';
                        const barH = (count / maxCount) * 100;
                        const color = getBarColor(digit);
                        return (
                            <div key={digit} className='kom__bar-col'>
                                <div className='kom__bar-pct'>{pct}%</div>
                                <div className='kom__bar-wrap'>
                                    <div
                                        className='kom__bar-fill'
                                        style={{ height: `${barH}%`, background: color }}
                                    />
                                </div>
                                <div className='kom__bar-label' style={{ color }}>{digit}</div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Quick Select Buttons */}
            <div className='kom__quick-btns'>
                <button className='kom__quick-btn kom__quick-btn--most' onClick={selectMostAppearing}>
                    ↑ Match most appearing digits
                </button>
                <button className='kom__quick-btn kom__quick-btn--least' onClick={selectLeastAppearing}>
                    ↓ Match least appearing digits
                </button>
            </div>

            {/* Predictions Panel */}
            <div className='kom__predictions'>
                <div className='kom__predictions-header'>
                    <span className='kom__predictions-title'>
                        Predictions ({activeDigits.length}/10 Active)
                    </span>
                </div>

                <div className='kom__pred-row'>
                    <div className='kom__pred-toggle-group'>
                        <label className='kom__toggle-label'>Use Default Stake:</label>
                        <button
                            className={`kom__toggle ${useDefaultStake ? 'kom__toggle--on' : ''}`}
                            onClick={() => setUseDefaultStake(p => !p)}
                        >
                            <span className='kom__toggle-knob' />
                        </button>
                    </div>
                    <div className='kom__pred-toggle-group kom__pred-toggle-group--right'>
                        <label className='kom__toggle-label'>Default Stake:</label>
                        <input
                            className='kom__input kom__input--stake'
                            type='number'
                            min='0.35'
                            step='0.01'
                            value={defaultStake}
                            onChange={e => setDefaultStake(e.target.value)}
                            disabled={!useDefaultStake}
                        />
                    </div>
                </div>

                <div className='kom__pred-row'>
                    <div className='kom__pred-toggle-group'>
                        <label className='kom__toggle-label'>Alternating Mode:</label>
                        <button
                            className={`kom__toggle ${alternatingMode ? 'kom__toggle--on' : ''}`}
                            onClick={() => setAlternatingMode(p => !p)}
                        >
                            <span className='kom__toggle-knob' />
                        </button>
                        {alternatingMode && (
                            <span className='kom__toggle-hint'>
                                (Most ⟷ Least, current: <strong>{alternatingState}</strong>)
                            </span>
                        )}
                    </div>
                    <div className='kom__pred-toggle-group kom__pred-toggle-group--right'>
                        <label className='kom__toggle-label'>Enable Entry Point:</label>
                        <button
                            className={`kom__toggle ${enableEntryPoint ? 'kom__toggle--on' : ''}`}
                            onClick={() => setEnableEntryPoint(p => !p)}
                        >
                            <span className='kom__toggle-knob' />
                        </button>
                        <span className='kom__toggle-hint'>(Wait for condition before trading)</span>
                    </div>
                </div>

                {/* Entry Point Config */}
                {enableEntryPoint && (
                    <div className='kom__entry-config'>
                        <h4 className='kom__entry-title'>Entry Point Configuration</h4>
                        <div className='kom__entry-row'>
                            <div className='kom__entry-field'>
                                <label>Last N Digits:</label>
                                <input
                                    className='kom__input'
                                    type='number'
                                    min={1}
                                    max={20}
                                    value={lastNDigits}
                                    onChange={e => setLastNDigits(Number(e.target.value))}
                                />
                            </div>
                            <div className='kom__entry-field'>
                                <label>Condition:</label>
                                <select className='kom__select' value={condition} onChange={e => setCondition(e.target.value as TCondition)}>
                                    {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                </select>
                            </div>
                            <div className='kom__entry-field'>
                                <label>What to Trade:</label>
                                <select className='kom__select' value={tradeMode} onChange={e => setTradeMode(e.target.value as TTradeMode)} disabled={alternatingMode}>
                                    {TRADE_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                </select>
                                <span className='kom__entry-hint'>
                                    {alternatingMode
                                        ? '(Alternating mode active)'
                                        : `(Will trade ${tradeMode.toUpperCase()} appearing)`}
                                </span>
                            </div>
                        </div>
                        <div className='kom__entry-status'>
                            <span className='kom__last-digits-label'>
                                Last {lastNDigits} digits:{' '}
                                <strong>{lastNSlice.join(', ') || '—'}</strong>
                            </span>
                            {entryMet ? (
                                <span className='kom__entry-met'>✅ Entry condition met — Ready to trade!</span>
                            ) : (
                                <span className='kom__entry-not-met'>✗ Entry condition NOT met — Waiting...</span>
                            )}
                        </div>
                    </div>
                )}

                {/* TP / SL */}
                <div className='kom__tpsl-row'>
                    <div className='kom__tpsl-field'>
                        <label>Take Profit ($):</label>
                        <input
                            className='kom__input'
                            type='number'
                            min='1'
                            step='1'
                            value={takeProfit}
                            onChange={e => setTakeProfit(e.target.value)}
                        />
                    </div>
                    <div className='kom__tpsl-field'>
                        <label>Stop Loss ($):</label>
                        <input
                            className='kom__input'
                            type='number'
                            min='1'
                            step='1'
                            value={stopLoss}
                            onChange={e => setStopLoss(e.target.value)}
                        />
                    </div>
                    <div className='kom__tpsl-field'>
                        <label>Session P/L:</label>
                        <span className={`kom__session-pl ${sessionProfit >= 0 ? 'kom__session-pl--pos' : 'kom__session-pl--neg'}`}>
                            {sessionProfit >= 0 ? '+' : ''}${sessionProfit.toFixed(2)}
                        </span>
                    </div>
                </div>

                {/* API Token */}
                <div className='kom__token-row'>
                    <label className='kom__toggle-label'>API Token (for trading):</label>
                    <input
                        className='kom__input kom__input--token'
                        type='password'
                        placeholder='Enter your Deriv API token...'
                        value={token}
                        onChange={e => setToken(e.target.value)}
                    />
                </div>

                {/* Digit Grid */}
                <div className='kom__digit-grid'>
                    {Array.from({ length: 10 }, (_, d) => {
                        const count = digitCounts[d];
                        const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
                        const isMost = mostDigits.includes(d);
                        const isLeastD = leastDigits.includes(d);
                        return (
                            <div
                                key={d}
                                className={`kom__digit-cell ${digitEnabled[d] ? 'kom__digit-cell--active' : ''} ${isMost ? 'kom__digit-cell--most' : ''} ${isLeastD ? 'kom__digit-cell--least' : ''}`}
                                onClick={() => toggleDigit(d)}
                            >
                                <input type='checkbox' checked={digitEnabled[d]} readOnly className='kom__digit-check' />
                                <div className='kom__digit-num'>{d}</div>
                                <div className='kom__digit-pct' style={{ color: getBarColor(d) }}>{pct}%</div>
                                <input
                                    className='kom__digit-stake'
                                    type='number'
                                    min='0.35'
                                    step='0.01'
                                    value={useDefaultStake ? defaultStake : digitStakes[d]}
                                    disabled={useDefaultStake}
                                    onChange={e => {
                                        e.stopPropagation();
                                        const next = [...digitStakes];
                                        next[d] = Number(e.target.value);
                                        setDigitStakes(next);
                                    }}
                                    onClick={e => e.stopPropagation()}
                                />
                            </div>
                        );
                    })}
                </div>

                {/* Total Stake */}
                <div className='kom__total-stake'>
                    Total Stake:{' '}
                    <span className='kom__total-stake-value'>${totalStake.toFixed(2)}</span>
                    <span className='kom__total-stake-hint'>
                        {useDefaultStake
                            ? 'Adjust stakes by toggling off "Use Default Stake" and editing individual values'
                            : 'Individual stake values active'}
                    </span>
                </div>

                {/* Status Message */}
                {statusMsg && (
                    <div className={`kom__status-msg ${statusMsg.startsWith('✅') || statusMsg.startsWith('🏆') ? 'kom__status-msg--win' : statusMsg.startsWith('❌') || statusMsg.startsWith('🛑') ? 'kom__status-msg--lose' : 'kom__status-msg--info'}`}>
                        {statusMsg}
                    </div>
                )}

                {/* Trade Buttons */}
                <div className='kom__trade-btns'>
                    <button
                        className='kom__trade-btn kom__trade-btn--once'
                        onClick={executeTradeOnce}
                        disabled={isTradingOnce || isAutoTrading}
                    >
                        {isTradingOnce ? '⏳ TRADING...' : '⚡ TRADE ONCE'}
                    </button>
                    {isAutoTrading ? (
                        <button className='kom__trade-btn kom__trade-btn--stop' onClick={stopAutoTrading}>
                            ⬛ STOP AUTO TRADING
                        </button>
                    ) : (
                        <button
                            className='kom__trade-btn kom__trade-btn--auto'
                            onClick={startAutoTrading}
                            disabled={isTradingOnce}
                        >
                            ▶ START AUTO TRADING
                        </button>
                    )}
                </div>
            </div>

            {/* Trade Log */}
            {tradeLogs.length > 0 && (
                <div className='kom__log'>
                    <h4 className='kom__log-title'>Trade Log</h4>
                    <div className='kom__log-rows'>
                        {tradeLogs.map((log, i) => (
                            <div key={i} className={`kom__log-row kom__log-row--${log.result}`}>
                                <span className='kom__log-time'>{log.time}</span>
                                <span className='kom__log-digit'>Digit {log.digit}</span>
                                <span className='kom__log-result'>{log.result === 'won' ? '✅ Won' : '❌ Lost'}</span>
                                <span className={`kom__log-profit ${log.profit >= 0 ? 'kom__pos' : 'kom__neg'}`}>
                                    {log.profit >= 0 ? '+' : ''}${log.profit.toFixed(2)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
});

export default KingOfMatches;
