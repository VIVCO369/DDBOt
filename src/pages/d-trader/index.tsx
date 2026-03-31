import React, { useCallback, useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { getAppId, getSocketURL } from '@/components/shared';
import DerivAPIBasic from '@deriv/deriv-api/dist/DerivAPIBasic';
import './d-trader.scss';

// ─── Types ────────────────────────────────────────────────────────────────────

type TTradeType = 'matches_differs' | 'accumulators' | 'rise_fall' | 'multipliers' | 'turbos';
type TSubType = 'matches' | 'differs' | 'rise' | 'fall' | 'call' | 'put';
type TBasis = 'stake' | 'payout';
type TDurationUnit = 't' | 's' | 'm' | 'h' | 'd';

interface ITick { price: number; epoch: number }
interface IProposal { id: string; payout: number; ask_price: number; longcode: string }
interface IContractResult { result: 'won' | 'lost'; profit: number; sell_price: number }

// ─── Constants ────────────────────────────────────────────────────────────────

const SYMBOLS = [
    { label: 'Volatility 10 (1s)',  value: 'R_10',       group: 'Volatility' },
    { label: 'Volatility 25 (1s)',  value: 'R_25',       group: 'Volatility' },
    { label: 'Volatility 50 (1s)',  value: 'R_50',       group: 'Volatility' },
    { label: 'Volatility 75 (1s)',  value: 'R_75',       group: 'Volatility' },
    { label: 'Volatility 100 (1s)', value: 'R_100',      group: 'Volatility' },
    { label: 'Boom 300 Index',      value: 'BOOM300N',   group: 'Boom & Crash' },
    { label: 'Boom 500 Index',      value: 'BOOM500',    group: 'Boom & Crash' },
    { label: 'Boom 1000 Index',     value: 'BOOM1000',   group: 'Boom & Crash' },
    { label: 'Crash 300 Index',     value: 'CRASH300N',  group: 'Boom & Crash' },
    { label: 'Crash 500 Index',     value: 'CRASH500',   group: 'Boom & Crash' },
    { label: 'Crash 1000 Index',    value: 'CRASH1000',  group: 'Boom & Crash' },
    { label: 'Step Index',          value: 'stpRNG',     group: 'Step' },
    { label: 'Range Break 100',     value: 'RNGBREAKMR100', group: 'Range Break' },
    { label: 'Range Break 200',     value: 'RNGBREAKMR200', group: 'Range Break' },
];

const TRADE_TYPES: { type: TTradeType; label: string; icon: string; contractTypes?: string[] }[] = [
    { type: 'matches_differs', label: 'Matches/Differs', icon: '⚡' },
    { type: 'accumulators',    label: 'Accumulators',    icon: '📈' },
    { type: 'rise_fall',       label: 'Rise/Fall',       icon: '↕' },
    { type: 'multipliers',     label: 'Multipliers',     icon: '✕' },
    { type: 'turbos',          label: 'Turbos',          icon: '🚀' },
];

const GROWTH_RATES = [1, 2, 3, 4, 5];
const DIGIT_COLORS: Record<number, string> = {
    0: '#e74c3c', 1: '#e67e22', 2: '#f1c40f', 3: '#2ecc71', 4: '#1abc9c',
    5: '#3498db', 6: '#9b59b6', 7: '#e91e63', 8: '#00bcd4', 9: '#ff5722',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const createApi = (): DerivAPIBasic => {
    const server = getSocketURL().replace(/[^a-zA-Z0-9.-]/g, '');
    const appId = String(getAppId()).replace(/[^a-zA-Z0-9]/g, '');
    const ws = new WebSocket(`wss://${server}/websockets/v3?app_id=${appId}&l=EN&brand=deriv`);
    return new DerivAPIBasic({ connection: ws });
};

const getLastDigit = (price: number): number => {
    const s = price.toFixed(2);
    return Number(s[s.length - 1]);
};

const fmtPrice = (p: number): string => p.toFixed(3);

// ─── SVG Chart ────────────────────────────────────────────────────────────────

const PriceChart: React.FC<{ ticks: ITick[]; width: number; height: number }> = ({ ticks, width, height }) => {
    if (ticks.length < 2) return (
        <div className='dt-chart__empty'>Connecting to market data...</div>
    );

    const prices = ticks.map(t => t.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 0.001;
    const pad = { top: 24, bottom: 28, left: 10, right: 10 };
    const chartW = width - pad.left - pad.right;
    const chartH = height - pad.top - pad.bottom;

    const toX = (i: number) => pad.left + (i / (ticks.length - 1)) * chartW;
    const toY = (p: number) => pad.top + (1 - (p - min) / range) * chartH;

    const points = ticks.map((t, i) => `${toX(i)},${toY(t.price)}`).join(' ');
    const areaPoints = `${toX(0)},${pad.top + chartH} ${points} ${toX(ticks.length - 1)},${pad.top + chartH}`;

    const lastY = toY(prices[prices.length - 1]);
    const lastX = toX(ticks.length - 1);
    const prevPrice = prices.length > 1 ? prices[prices.length - 2] : prices[prices.length - 1];
    const lineColor = prices[prices.length - 1] >= prevPrice ? '#26a69a' : '#ef5350';

    // Y-axis labels
    const yLabels = [0, 0.25, 0.5, 0.75, 1].map(f => ({
        y: pad.top + (1 - f) * chartH,
        label: fmtPrice(min + f * range),
    }));

    return (
        <svg width={width} height={height} className='dt-chart__svg'>
            <defs>
                <linearGradient id='chartGrad' x1='0' y1='0' x2='0' y2='1'>
                    <stop offset='0%' stopColor={lineColor} stopOpacity='0.3' />
                    <stop offset='100%' stopColor={lineColor} stopOpacity='0.02' />
                </linearGradient>
            </defs>

            {/* Y grid lines */}
            {yLabels.map((l, i) => (
                <g key={i}>
                    <line x1={pad.left} y1={l.y} x2={width - pad.right} y2={l.y}
                        stroke='currentColor' strokeOpacity='0.08' strokeWidth='1' />
                    <text x={width - pad.right + 2} y={l.y + 4}
                        fontSize='9' fill='currentColor' opacity='0.5'>{l.label}</text>
                </g>
            ))}

            {/* Area fill */}
            <polygon points={areaPoints} fill='url(#chartGrad)' />

            {/* Price line */}
            <polyline points={points} fill='none' stroke={lineColor} strokeWidth='2' strokeLinejoin='round' />

            {/* Current price dot */}
            <circle cx={lastX} cy={lastY} r='4' fill={lineColor} />

            {/* Horizontal dashed line at last price */}
            <line x1={pad.left} y1={lastY} x2={lastX - 6} y2={lastY}
                stroke={lineColor} strokeWidth='1' strokeDasharray='3,3' />

            {/* Price label */}
            <rect x={lastX + 6} y={lastY - 10} width={58} height={20} rx='3'
                fill={lineColor} />
            <text x={lastX + 35} y={lastY + 4} textAnchor='middle'
                fontSize='10' fontWeight='700' fill='#fff'>
                {fmtPrice(prices[prices.length - 1])}
            </text>
        </svg>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const DTrader = observer(() => {
    // Market
    const [symbol, setSymbol] = useState('R_10');
    const [symbolLabel, setSymbolLabel] = useState('Volatility 10 (1s)');
    const [ticks, setTicks] = useState<ITick[]>([]);
    const [currentPrice, setCurrentPrice] = useState<number | null>(null);
    const [priceChange, setPriceChange] = useState<number>(0);
    const [digitCounts, setDigitCounts] = useState<number[]>(Array(10).fill(0));
    const [isConnected, setIsConnected] = useState(false);
    const [showSymbolMenu, setShowSymbolMenu] = useState(false);

    // Trade type
    const [tradeType, setTradeType] = useState<TTradeType>('matches_differs');

    // Matches/Differs
    const [selectedDigit, setSelectedDigit] = useState(1);
    const [mdTicks, setMdTicks] = useState(1);

    // Accumulators
    const [growthRate, setGrowthRate] = useState(3);

    // Rise/Fall
    const [rfDuration, setRfDuration] = useState(5);
    const [rfDurationUnit, setRfDurationUnit] = useState<TDurationUnit>('t');

    // Multipliers
    const [multiplier, setMultiplier] = useState(10);
    const [commission, setCommission] = useState('0.0000');

    // Common
    const [stake, setStake] = useState('0.35');
    const [basis, setBasis] = useState<TBasis>('stake');
    const [takeProfitEnabled, setTakeProfitEnabled] = useState(false);
    const [takeProfitValue, setTakeProfitValue] = useState('10');
    const [token, setToken] = useState('');

    // Proposal
    const [matchesPayout, setMatchesPayout] = useState<number | null>(null);
    const [differsPayout, setDiffersPayout] = useState<number | null>(null);
    const [matchesPct, setMatchesPct] = useState<number | null>(null);
    const [differsPct, setDiffersPct] = useState<number | null>(null);
    const [accumPayout, setAccumPayout] = useState<number | null>(null);
    const [rfPayout, setRfPayout] = useState<number | null>(null);

    // Trade result
    const [isTrading, setIsTrading] = useState(false);
    const [tradeResult, setTradeResult] = useState<string | null>(null);
    const [tradeLog, setTradeLog] = useState<{ time: string; label: string; result: string; profit: number }[]>([]);

    // Chart
    const [chartSize, setChartSize] = useState({ width: 600, height: 320 });
    const chartRef = useRef<HTMLDivElement>(null);

    // API refs
    const apiRef = useRef<DerivAPIBasic | null>(null);
    const subRef = useRef<any>(null);
    const countsRef = useRef<number[]>(Array(10).fill(0));
    const proposalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ─── Chart resize ──────────────────────────────────────────────────────────
    useEffect(() => {
        const obs = new ResizeObserver(entries => {
            const e = entries[0];
            if (e) setChartSize({ width: e.contentRect.width, height: e.contentRect.height });
        });
        if (chartRef.current) obs.observe(chartRef.current);
        return () => obs.disconnect();
    }, []);

    // ─── Market connection ─────────────────────────────────────────────────────
    const cleanupMarket = useCallback(() => {
        try { subRef.current?.unsubscribe?.(); } catch (_) {}
        try { apiRef.current?.disconnect?.(); } catch (_) {}
        subRef.current = null;
        apiRef.current = null;
    }, []);

    const connectMarket = useCallback(async (sym: string) => {
        cleanupMarket();
        setIsConnected(false);
        setTicks([]);
        setCurrentPrice(null);
        setPriceChange(0);
        countsRef.current = Array(10).fill(0);
        setDigitCounts(Array(10).fill(0));

        try {
            const api = createApi();
            apiRef.current = api;
            await new Promise<void>((res, rej) => {
                const conn = (api as any).connection as WebSocket;
                conn.addEventListener('open', () => res(), { once: true });
                conn.addEventListener('error', () => rej(new Error('WS error')), { once: true });
                setTimeout(() => rej(new Error('timeout')), 12000);
            });

            // Load history
            const histRes = await api.send({
                ticks_history: sym,
                count: 120,
                end: 'latest',
                style: 'ticks',
            });

            const histPrices: number[] = histRes.history?.prices ?? [];
            const histEpochs: number[] = histRes.history?.times ?? [];
            const initialTicks: ITick[] = histPrices.map((p, i) => ({ price: p, epoch: histEpochs[i] }));
            const initCounts = Array(10).fill(0);
            histPrices.forEach(p => { initCounts[getLastDigit(p)]++; });
            countsRef.current = initCounts;
            setDigitCounts([...initCounts]);
            setTicks(initialTicks);
            if (histPrices.length > 1) {
                setCurrentPrice(histPrices[histPrices.length - 1]);
                setPriceChange(histPrices[histPrices.length - 1] - histPrices[histPrices.length - 2]);
            }

            // Live subscribe
            const sub = api.subscribe({ ticks: sym, subscribe: 1 });
            subRef.current = sub;
            sub.subscribe({
                next: (res: any) => {
                    if (!res.tick) return;
                    const { quote, epoch } = res.tick;
                    const d = getLastDigit(quote);
                    countsRef.current = [...countsRef.current];
                    countsRef.current[d]++;
                    setDigitCounts([...countsRef.current]);
                    setTicks(prev => {
                        const next = [...prev.slice(-199), { price: quote, epoch }];
                        if (prev.length > 0) setPriceChange(quote - prev[prev.length - 1].price);
                        return next;
                    });
                    setCurrentPrice(quote);
                },
                error: () => setIsConnected(false),
            });
            setIsConnected(true);
        } catch (_) {
            setIsConnected(false);
        }
    }, [cleanupMarket]);

    useEffect(() => {
        connectMarket(symbol);
        return () => cleanupMarket();
    }, []);

    const handleSymbolSelect = (sym: string, label: string) => {
        setSymbol(sym);
        setSymbolLabel(label);
        setShowSymbolMenu(false);
        connectMarket(sym);
    };

    // ─── Proposal fetching ────────────────────────────────────────────────────
    const fetchProposals = useCallback(async () => {
        if (proposalTimerRef.current) clearTimeout(proposalTimerRef.current);
        proposalTimerRef.current = setTimeout(async () => {
            try {
                const api = createApi();
                await new Promise<void>((res, rej) => {
                    const conn = (api as any).connection as WebSocket;
                    conn.addEventListener('open', () => res(), { once: true });
                    conn.addEventListener('error', () => rej(), { once: true });
                    setTimeout(() => rej(), 8000);
                });

                const stakeNum = Math.max(0.35, Number(stake) || 0.35);

                if (tradeType === 'matches_differs') {
                    const [mRes, dRes] = await Promise.all([
                        api.send({
                            proposal: 1, contract_type: 'DIGITMATCH', symbol,
                            basis: 'stake', amount: stakeNum, currency: 'USD',
                            duration: mdTicks, duration_unit: 't', barrier: String(selectedDigit),
                        }),
                        api.send({
                            proposal: 1, contract_type: 'DIGITDIFF', symbol,
                            basis: 'stake', amount: stakeNum, currency: 'USD',
                            duration: mdTicks, duration_unit: 't', barrier: String(selectedDigit),
                        }),
                    ]);
                    const mp = mRes.proposal?.payout ?? null;
                    const dp = dRes.proposal?.payout ?? null;
                    setMatchesPayout(mp);
                    setDiffersPayout(dp);
                    setMatchesPct(mp !== null ? ((mp - stakeNum) / stakeNum) * 100 : null);
                    setDiffersPct(dp !== null ? ((dp - stakeNum) / stakeNum) * 100 : null);
                } else if (tradeType === 'rise_fall') {
                    const [rRes, fRes] = await Promise.all([
                        api.send({
                            proposal: 1, contract_type: 'CALL', symbol,
                            basis, amount: stakeNum, currency: 'USD',
                            duration: rfDuration, duration_unit: rfDurationUnit,
                        }),
                        api.send({
                            proposal: 1, contract_type: 'PUT', symbol,
                            basis, amount: stakeNum, currency: 'USD',
                            duration: rfDuration, duration_unit: rfDurationUnit,
                        }),
                    ]);
                    setRfPayout(rRes.proposal?.payout ?? null);
                } else if (tradeType === 'accumulators') {
                    const aRes = await api.send({
                        proposal: 1, contract_type: 'ACCU', symbol,
                        basis: 'stake', amount: stakeNum, currency: 'USD',
                        growth_rate: growthRate / 100,
                        limit_order: takeProfitEnabled ? { take_profit: { order_amount: Number(takeProfitValue), order_date: 0 } } : undefined,
                    });
                    setAccumPayout(aRes.proposal?.payout ?? null);
                }
                api.disconnect?.();
            } catch (_) {}
        }, 600);
    }, [tradeType, symbol, stake, selectedDigit, mdTicks, growthRate, takeProfitEnabled, takeProfitValue, rfDuration, rfDurationUnit, basis]);

    useEffect(() => {
        fetchProposals();
        return () => { if (proposalTimerRef.current) clearTimeout(proposalTimerRef.current); };
    }, [fetchProposals]);

    // ─── Execute trade ────────────────────────────────────────────────────────
    const executeTrade = useCallback(async (contractType: string, label: string) => {
        if (!token) { setTradeResult('⚠️ Enter your API token first'); return; }
        setIsTrading(true);
        setTradeResult(`Buying ${label}...`);

        try {
            const api = createApi();
            await new Promise<void>((res, rej) => {
                const conn = (api as any).connection as WebSocket;
                conn.addEventListener('open', () => res(), { once: true });
                conn.addEventListener('error', () => rej(new Error('WS error')), { once: true });
                setTimeout(() => rej(new Error('timeout')), 10000);
            });

            await api.send({ authorize: token });

            const stakeNum = Math.max(0.35, Number(stake) || 0.35);
            const params: Record<string, unknown> = {
                buy: 1,
                price: stakeNum,
                parameters: {
                    contract_type: contractType,
                    symbol,
                    basis: 'stake',
                    amount: stakeNum,
                    currency: 'USD',
                    ...(contractType === 'DIGITMATCH' || contractType === 'DIGITDIFF'
                        ? { duration: mdTicks, duration_unit: 't', barrier: String(selectedDigit) }
                        : contractType === 'ACCU'
                        ? { growth_rate: growthRate / 100 }
                        : contractType === 'CALL' || contractType === 'PUT'
                        ? { duration: rfDuration, duration_unit: rfDurationUnit }
                        : contractType === 'MULTUP' || contractType === 'MULTDOWN'
                        ? { multiplier, duration_unit: 'd', duration: 365 }
                        : {}),
                },
            };

            const buyRes = await api.send(params);
            const contractId = buyRes.buy?.contract_id;
            if (!contractId) throw new Error(buyRes.error?.message ?? 'No contract ID');

            setTradeResult(`✅ Contract #${contractId} placed!`);
            // Wait for result
            await new Promise(r => setTimeout(r, 2500));
            const poc = await api.send({ proposal_open_contract: 1, contract_id: contractId });
            const pocData = poc.proposal_open_contract;
            const profit = pocData?.profit ?? 0;
            const status = pocData?.status === 'won' ? 'won' : 'lost';
            const msg = status === 'won'
                ? `✅ ${label} WON +$${Math.abs(profit).toFixed(2)}`
                : `❌ ${label} LOST -$${Math.abs(profit).toFixed(2)}`;
            setTradeResult(msg);
            setTradeLog(prev => [{ time: new Date().toLocaleTimeString('en-US', { hour12: false }), label, result: status, profit }, ...prev].slice(0, 30));
            api.disconnect?.();
        } catch (err: any) {
            setTradeResult(`⚠️ ${err.message}`);
        } finally {
            setIsTrading(false);
        }
    }, [token, symbol, stake, selectedDigit, mdTicks, growthRate, rfDuration, rfDurationUnit, multiplier]);

    // ─── Digit bar stats ──────────────────────────────────────────────────────
    const totalDigits = digitCounts.reduce((a, b) => a + b, 0);
    const maxCount = Math.max(...digitCounts, 1);
    const lastDigit = currentPrice !== null ? getLastDigit(currentPrice) : null;

    // ─── Render ───────────────────────────────────────────────────────────────
    const stakeNum = Number(stake) || 0;

    const renderTradePanel = () => {
        if (tradeType === 'matches_differs') return (
            <div className='dt-panel__trade-body'>
                {/* Ticks */}
                <div className='dt-panel__field'>
                    <label className='dt-panel__label'>Ticks</label>
                    <div className='dt-panel__slider-row'>
                        <input type='range' min={1} max={10} value={mdTicks}
                            className='dt-panel__slider'
                            onChange={e => setMdTicks(Number(e.target.value))} />
                        <span className='dt-panel__slider-val'>{mdTicks} Tick{mdTicks > 1 ? 's' : ''}</span>
                    </div>
                </div>

                {/* Last Digit Prediction */}
                <div className='dt-panel__field'>
                    <label className='dt-panel__label'>Last Digit Prediction</label>
                    <div className='dt-panel__digit-grid'>
                        {Array.from({ length: 10 }, (_, d) => (
                            <button
                                key={d}
                                className={`dt-panel__digit-btn ${selectedDigit === d ? 'dt-panel__digit-btn--active' : ''}`}
                                style={selectedDigit === d ? { background: DIGIT_COLORS[d], borderColor: DIGIT_COLORS[d] } : {}}
                                onClick={() => setSelectedDigit(d)}
                            >{d}</button>
                        ))}
                    </div>
                </div>

                {/* Stake */}
                <div className='dt-panel__field'>
                    <div className='dt-panel__basis-tabs'>
                        <button className={`dt-panel__basis-tab ${basis === 'stake' ? 'dt-panel__basis-tab--active' : ''}`} onClick={() => setBasis('stake')}>Stake</button>
                        <button className={`dt-panel__basis-tab ${basis === 'payout' ? 'dt-panel__basis-tab--active' : ''}`} onClick={() => setBasis('payout')}>Payout</button>
                    </div>
                    <div className='dt-panel__amount-row'>
                        <button className='dt-panel__amt-btn' onClick={() => setStake(s => String(Math.max(0.35, (Number(s) || 0) - 0.5).toFixed(2)))}>−</button>
                        <input className='dt-panel__amount-input' type='number' min='0.35' step='0.01'
                            value={stake} onChange={e => setStake(e.target.value)} />
                        <span className='dt-panel__currency'>USD</span>
                        <button className='dt-panel__amt-btn' onClick={() => setStake(s => String(((Number(s) || 0) + 0.5).toFixed(2)))}>+</button>
                    </div>
                </div>

                {/* Payouts */}
                <div className='dt-panel__payouts'>
                    {matchesPayout !== null && (
                        <div className='dt-panel__payout-info'>
                            <span className='dt-panel__payout-label'>Payout</span>
                            <span className='dt-panel__payout-value'>${matchesPayout.toFixed(8)}</span>
                        </div>
                    )}
                </div>

                {/* Buy Buttons */}
                <div className='dt-panel__buy-btns'>
                    <button
                        className='dt-panel__buy-btn dt-panel__buy-btn--matches'
                        onClick={() => executeTrade('DIGITMATCH', `Matches ${selectedDigit}`)}
                        disabled={isTrading}
                    >
                        <span className='dt-panel__buy-icon'>⚡</span>
                        <span className='dt-panel__buy-label'>Matches</span>
                        {matchesPct !== null && <span className='dt-panel__buy-pct'>{matchesPct.toFixed(2)}%</span>}
                    </button>
                    <button
                        className='dt-panel__buy-btn dt-panel__buy-btn--differs'
                        onClick={() => executeTrade('DIGITDIFF', `Differs ${selectedDigit}`)}
                        disabled={isTrading}
                    >
                        <span className='dt-panel__buy-icon'>⚡</span>
                        <span className='dt-panel__buy-label'>Differs</span>
                        {differsPct !== null && <span className='dt-panel__buy-pct'>{differsPct.toFixed(2)}%</span>}
                    </button>
                </div>
            </div>
        );

        if (tradeType === 'accumulators') return (
            <div className='dt-panel__trade-body'>
                {/* Growth Rate */}
                <div className='dt-panel__field'>
                    <label className='dt-panel__label'>Growth rate</label>
                    <div className='dt-panel__growth-rates'>
                        {GROWTH_RATES.map(r => (
                            <button key={r}
                                className={`dt-panel__growth-btn ${growthRate === r ? 'dt-panel__growth-btn--active' : ''}`}
                                onClick={() => setGrowthRate(r)}>{r}%</button>
                        ))}
                    </div>
                </div>

                {/* Stake */}
                <div className='dt-panel__field'>
                    <label className='dt-panel__label'>Stake</label>
                    <div className='dt-panel__amount-row'>
                        <button className='dt-panel__amt-btn' onClick={() => setStake(s => String(Math.max(0.35, (Number(s) || 0) - 0.5).toFixed(2)))}>−</button>
                        <input className='dt-panel__amount-input' type='number' min='0.35' step='0.01'
                            value={stake} onChange={e => setStake(e.target.value)} />
                        <span className='dt-panel__currency'>USD</span>
                        <button className='dt-panel__amt-btn' onClick={() => setStake(s => String(((Number(s) || 0) + 0.5).toFixed(2)))}>+</button>
                    </div>
                </div>

                {/* Take Profit */}
                <div className='dt-panel__field dt-panel__field--row'>
                    <div className='dt-panel__checkbox-row' onClick={() => setTakeProfitEnabled(p => !p)}>
                        <div className={`dt-panel__checkbox ${takeProfitEnabled ? 'dt-panel__checkbox--checked' : ''}`} />
                        <label className='dt-panel__label dt-panel__label--clickable'>Take profit</label>
                    </div>
                    {takeProfitEnabled && (
                        <input className='dt-panel__amount-input dt-panel__amount-input--sm' type='number' min='0'
                            value={takeProfitValue} onChange={e => setTakeProfitValue(e.target.value)} />
                    )}
                </div>

                {accumPayout !== null && (
                    <div className='dt-panel__stat-row'>
                        <span>Max. payout</span>
                        <span>${accumPayout.toFixed(8)}</span>
                    </div>
                )}
                <div className='dt-panel__stat-row'>
                    <span>Max. ticks</span>
                    <span>90 ticks</span>
                </div>

                <button
                    className='dt-panel__buy-btn dt-panel__buy-btn--accumulator dt-panel__buy-btn--full'
                    onClick={() => executeTrade('ACCU', `Accumulator ${growthRate}%`)}
                    disabled={isTrading}
                >
                    <span className='dt-panel__buy-icon'>📈</span>
                    <span className='dt-panel__buy-label'>Buy</span>
                </button>
            </div>
        );

        if (tradeType === 'rise_fall') return (
            <div className='dt-panel__trade-body'>
                <div className='dt-panel__field'>
                    <div className='dt-panel__basis-tabs'>
                        <button className={`dt-panel__basis-tab ${basis === 'stake' ? 'dt-panel__basis-tab--active' : ''}`} onClick={() => setBasis('stake')}>Stake</button>
                        <button className={`dt-panel__basis-tab ${basis === 'payout' ? 'dt-panel__basis-tab--active' : ''}`} onClick={() => setBasis('payout')}>Payout</button>
                    </div>
                    <div className='dt-panel__amount-row'>
                        <button className='dt-panel__amt-btn' onClick={() => setStake(s => String(Math.max(0.35, (Number(s) || 0) - 0.5).toFixed(2)))}>−</button>
                        <input className='dt-panel__amount-input' type='number' min='0.35' step='0.01'
                            value={stake} onChange={e => setStake(e.target.value)} />
                        <span className='dt-panel__currency'>USD</span>
                        <button className='dt-panel__amt-btn' onClick={() => setStake(s => String(((Number(s) || 0) + 0.5).toFixed(2)))}>+</button>
                    </div>
                </div>

                <div className='dt-panel__field'>
                    <label className='dt-panel__label'>Duration</label>
                    <div className='dt-panel__duration-row'>
                        <input className='dt-panel__amount-input dt-panel__amount-input--sm' type='number' min='1'
                            value={rfDuration} onChange={e => setRfDuration(Number(e.target.value))} />
                        <select className='dt-panel__select' value={rfDurationUnit} onChange={e => setRfDurationUnit(e.target.value as TDurationUnit)}>
                            <option value='t'>Ticks</option>
                            <option value='s'>Seconds</option>
                            <option value='m'>Minutes</option>
                            <option value='h'>Hours</option>
                            <option value='d'>Days</option>
                        </select>
                    </div>
                </div>

                {rfPayout !== null && (
                    <div className='dt-panel__payout-info'>
                        <span className='dt-panel__payout-label'>Payout</span>
                        <span className='dt-panel__payout-value'>${rfPayout.toFixed(2)}</span>
                    </div>
                )}

                <div className='dt-panel__buy-btns'>
                    <button
                        className='dt-panel__buy-btn dt-panel__buy-btn--rise'
                        onClick={() => executeTrade('CALL', 'Rise')}
                        disabled={isTrading}
                    >
                        <span>▲ Rise</span>
                    </button>
                    <button
                        className='dt-panel__buy-btn dt-panel__buy-btn--fall'
                        onClick={() => executeTrade('PUT', 'Fall')}
                        disabled={isTrading}
                    >
                        <span>▼ Fall</span>
                    </button>
                </div>
            </div>
        );

        if (tradeType === 'multipliers') return (
            <div className='dt-panel__trade-body'>
                <div className='dt-panel__field'>
                    <label className='dt-panel__label'>Multiplier</label>
                    <select className='dt-panel__select dt-panel__select--full' value={multiplier} onChange={e => setMultiplier(Number(e.target.value))}>
                        {[10, 20, 30, 40, 50, 100, 200, 500, 1000].map(m => (
                            <option key={m} value={m}>x{m}</option>
                        ))}
                    </select>
                </div>
                <div className='dt-panel__field'>
                    <label className='dt-panel__label'>Stake</label>
                    <div className='dt-panel__amount-row'>
                        <button className='dt-panel__amt-btn' onClick={() => setStake(s => String(Math.max(0.35, (Number(s) || 0) - 0.5).toFixed(2)))}>−</button>
                        <input className='dt-panel__amount-input' type='number' min='0.35' step='0.01'
                            value={stake} onChange={e => setStake(e.target.value)} />
                        <span className='dt-panel__currency'>USD</span>
                        <button className='dt-panel__amt-btn' onClick={() => setStake(s => String(((Number(s) || 0) + 0.5).toFixed(2)))}>+</button>
                    </div>
                </div>
                <div className='dt-panel__stat-row'>
                    <span>Commission</span>
                    <span>${(stakeNum * 0.005).toFixed(4)}</span>
                </div>
                <div className='dt-panel__buy-btns'>
                    <button className='dt-panel__buy-btn dt-panel__buy-btn--rise' onClick={() => executeTrade('MULTUP', 'Multiplier Up')} disabled={isTrading}>▲ Up</button>
                    <button className='dt-panel__buy-btn dt-panel__buy-btn--fall' onClick={() => executeTrade('MULTDOWN', 'Multiplier Down')} disabled={isTrading}>▼ Down</button>
                </div>
            </div>
        );

        if (tradeType === 'turbos') return (
            <div className='dt-panel__trade-body'>
                <div className='dt-panel__field'>
                    <label className='dt-panel__label'>Stake</label>
                    <div className='dt-panel__amount-row'>
                        <button className='dt-panel__amt-btn' onClick={() => setStake(s => String(Math.max(0.35, (Number(s) || 0) - 0.5).toFixed(2)))}>−</button>
                        <input className='dt-panel__amount-input' type='number' min='0.35' step='0.01'
                            value={stake} onChange={e => setStake(e.target.value)} />
                        <span className='dt-panel__currency'>USD</span>
                        <button className='dt-panel__amt-btn' onClick={() => setStake(s => String(((Number(s) || 0) + 0.5).toFixed(2)))}>+</button>
                    </div>
                </div>
                <div className='dt-panel__buy-btns'>
                    <button className='dt-panel__buy-btn dt-panel__buy-btn--rise' onClick={() => executeTrade('TURBOSLONG', 'Turbos Long')} disabled={isTrading}>▲ Long</button>
                    <button className='dt-panel__buy-btn dt-panel__buy-btn--fall' onClick={() => executeTrade('TURBOSSHORT', 'Turbos Short')} disabled={isTrading}>▼ Short</button>
                </div>
            </div>
        );

        return null;
    };

    return (
        <div className='dt'>
            {/* ─── Left: chart area ─────────────────────────────────────────────── */}
            <div className='dt-chart-area'>
                {/* Symbol header */}
                <div className='dt-chart-area__header'>
                    <div className='dt-chart-area__symbol-info' onClick={() => setShowSymbolMenu(p => !p)}>
                        <div className='dt-chart-area__symbol-icon'>
                            <span style={{ color: priceChange >= 0 ? '#26a69a' : '#ef5350', fontSize: '1.2rem' }}>
                                {priceChange >= 0 ? '▲' : '▼'}
                            </span>
                        </div>
                        <div>
                            <div className='dt-chart-area__symbol-name'>{symbolLabel}</div>
                            {currentPrice !== null && (
                                <div className='dt-chart-area__symbol-price' style={{ color: priceChange >= 0 ? '#26a69a' : '#ef5350' }}>
                                    {fmtPrice(currentPrice)} {priceChange !== 0 && `${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(3)} (${((Math.abs(priceChange) / (currentPrice - priceChange)) * 100).toFixed(2)}%)`}
                                </div>
                            )}
                        </div>
                        <span className='dt-chart-area__symbol-arrow'>▾</span>
                    </div>

                    {/* Symbol dropdown */}
                    {showSymbolMenu && (
                        <div className='dt-chart-area__symbol-menu'>
                            {Array.from(new Set(SYMBOLS.map(s => s.group))).map(group => (
                                <div key={group} className='dt-chart-area__symbol-group'>
                                    <div className='dt-chart-area__symbol-group-label'>{group}</div>
                                    {SYMBOLS.filter(s => s.group === group).map(s => (
                                        <div
                                            key={s.value}
                                            className={`dt-chart-area__symbol-item ${symbol === s.value ? 'dt-chart-area__symbol-item--active' : ''}`}
                                            onClick={() => handleSymbolSelect(s.value, s.label)}
                                        >
                                            {s.label}
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}

                    <div className='dt-chart-area__status'>
                        <span className={`dt-chart-area__dot ${isConnected ? 'dt-chart-area__dot--live' : ''}`} />
                        {isConnected ? 'Live' : 'Connecting...'}
                    </div>
                </div>

                {/* Chart */}
                <div className='dt-chart' ref={chartRef}>
                    <PriceChart ticks={ticks} width={chartSize.width} height={chartSize.height} />
                </div>

                {/* Digit distribution footer */}
                <div className='dt-digit-bar'>
                    {Array.from({ length: 10 }, (_, d) => {
                        const count = digitCounts[d];
                        const pct = totalDigits > 0 ? ((count / totalDigits) * 100).toFixed(1) : '0.0';
                        const barH = (count / maxCount) * 100;
                        const isLast = lastDigit === d;
                        return (
                            <div key={d} className={`dt-digit-bar__col ${isLast ? 'dt-digit-bar__col--last' : ''}`}>
                                <div className='dt-digit-bar__pct'>{pct}%</div>
                                <div className='dt-digit-bar__wrap'>
                                    <div className='dt-digit-bar__fill'
                                        style={{ height: `${barH}%`, background: DIGIT_COLORS[d], opacity: isLast ? 1 : 0.65 }} />
                                </div>
                                <div className='dt-digit-bar__label' style={{ color: DIGIT_COLORS[d] }}>{d}</div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ─── Right: trade panel ───────────────────────────────────────────── */}
            <div className='dt-panel'>
                {/* Trade type tabs */}
                <div className='dt-panel__types'>
                    <div className='dt-panel__types-scroll'>
                        {TRADE_TYPES.map(t => (
                            <button
                                key={t.type}
                                className={`dt-panel__type-btn ${tradeType === t.type ? 'dt-panel__type-btn--active' : ''}`}
                                onClick={() => setTradeType(t.type)}
                            >
                                <span className='dt-panel__type-icon'>{t.icon}</span>
                                <span className='dt-panel__type-label'>{t.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className='dt-panel__body'>
                    {/* Trade type label */}
                    <div className='dt-panel__type-header'>
                        <span className='dt-panel__type-icon-lg'>{TRADE_TYPES.find(t => t.type === tradeType)?.icon}</span>
                        <span className='dt-panel__type-name'>{TRADE_TYPES.find(t => t.type === tradeType)?.label}</span>
                    </div>

                    {/* Token */}
                    <div className='dt-panel__token-field'>
                        <label className='dt-panel__label'>API Token</label>
                        <input
                            className='dt-panel__token-input'
                            type='password'
                            placeholder='Enter Deriv API token...'
                            value={token}
                            onChange={e => setToken(e.target.value)}
                        />
                    </div>

                    {/* Trade-specific UI */}
                    {renderTradePanel()}

                    {/* Trade result */}
                    {tradeResult && (
                        <div className={`dt-panel__result ${tradeResult.startsWith('✅') ? 'dt-panel__result--win' : tradeResult.startsWith('❌') ? 'dt-panel__result--lose' : 'dt-panel__result--info'}`}>
                            {tradeResult}
                        </div>
                    )}

                    {/* Trade Log */}
                    {tradeLog.length > 0 && (
                        <div className='dt-panel__log'>
                            <div className='dt-panel__log-title'>Recent Trades</div>
                            {tradeLog.map((l, i) => (
                                <div key={i} className={`dt-panel__log-row dt-panel__log-row--${l.result}`}>
                                    <span className='dt-panel__log-time'>{l.time}</span>
                                    <span className='dt-panel__log-label'>{l.label}</span>
                                    <span className={`dt-panel__log-profit ${l.profit >= 0 ? 'dt-pos' : 'dt-neg'}`}>
                                        {l.profit >= 0 ? '+' : ''}${l.profit.toFixed(2)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});

export default DTrader;
