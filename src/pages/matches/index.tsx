import React, { useCallback, useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { getAppId, getSocketURL } from '@/components/shared';
import DerivAPIBasic from '@deriv/deriv-api/dist/DerivAPIBasic';
import './matches.scss';

type TDigit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type TSignal = 'MATCHES' | 'DIFFERS' | 'WAIT';

interface ITickData {
    digit: TDigit;
    quote: number;
    time: string;
}

const DIGIT_COLORS: Record<number, string> = {
    0: '#e74c3c', 1: '#e67e22', 2: '#f1c40f', 3: '#2ecc71', 4: '#1abc9c',
    5: '#3498db', 6: '#9b59b6', 7: '#e91e63', 8: '#00bcd4', 9: '#ff5722',
};

const SYMBOLS = [
    { label: 'Volatility 100 (1s)', value: 'R_100' },
    { label: 'Volatility 75 (1s)', value: 'R_75' },
    { label: 'Volatility 50 (1s)', value: 'R_50' },
    { label: 'Volatility 25 (1s)', value: 'R_25' },
    { label: 'Volatility 10 (1s)', value: 'R_10' },
];

const createApi = (): DerivAPIBasic => {
    const server = getSocketURL().replace(/[^a-zA-Z0-9.]/g, '');
    const appId = String(getAppId()).replace(/[^a-zA-Z0-9]/g, '');
    const url = `wss://${server}/websockets/v3?app_id=${appId}&l=EN&brand=deriv`;
    const ws = new WebSocket(url);
    return new DerivAPIBasic({ connection: ws });
};

const getSignal = (history: TDigit[], targetDigit: number): TSignal => {
    if (history.length < 5) return 'WAIT';
    const last5 = history.slice(-5);
    const matchCount = last5.filter(d => d === targetDigit).length;
    if (matchCount >= 3) return 'MATCHES';
    if (matchCount === 0) return 'DIFFERS';
    return 'WAIT';
};

const Matches = observer(() => {
    const [symbol, setSymbol] = useState('R_100');
    const [ticks, setTicks] = useState<ITickData[]>([]);
    const [digitCounts, setDigitCounts] = useState<number[]>(Array(10).fill(0));
    const [targetDigit, setTargetDigit] = useState<number>(5);
    const [signal, setSignal] = useState<TSignal>('WAIT');
    const [connected, setConnected] = useState(false);
    const [connecting, setConnecting] = useState(false);

    const apiRef = useRef<DerivAPIBasic | null>(null);
    const subRef = useRef<any>(null);
    const countsRef = useRef<number[]>(Array(10).fill(0));
    const historyRef = useRef<TDigit[]>([]);

    const cleanup = useCallback(() => {
        try {
            subRef.current?.unsubscribe?.();
            apiRef.current?.disconnect?.();
        } catch (_) {}
        subRef.current = null;
        apiRef.current = null;
    }, []);

    const connect = useCallback(async (sym: string) => {
        cleanup();
        setConnecting(true);
        setConnected(false);
        setTicks([]);
        countsRef.current = Array(10).fill(0);
        historyRef.current = [];
        setDigitCounts(Array(10).fill(0));
        setSignal('WAIT');

        try {
            const api = createApi();
            apiRef.current = api;

            await new Promise<void>((resolve, reject) => {
                (api as any).connection?.addEventListener('open', resolve);
                (api as any).connection?.addEventListener('error', reject);
                setTimeout(() => reject(new Error('timeout')), 10000);
            });

            const sub = api.subscribe({ ticks: sym, subscribe: 1 });
            subRef.current = sub;
            sub.subscribe({
                next: (res: any) => {
                    if (res.tick) {
                        const quote: number = res.tick.quote;
                        const quoteStr = quote.toFixed(2);
                        const digit = Number(quoteStr[quoteStr.length - 1]) as TDigit;
                        const time = new Date(res.tick.epoch * 1000).toLocaleTimeString('en-US', { hour12: false });

                        historyRef.current = [...historyRef.current.slice(-49), digit];
                        countsRef.current = [...countsRef.current];
                        countsRef.current[digit]++;

                        setTicks(prev => [...prev.slice(-49), { digit, quote, time }]);
                        setDigitCounts([...countsRef.current]);
                        setSignal(getSignal(historyRef.current, targetDigit));
                    }
                },
                error: () => setConnected(false),
            });

            setConnected(true);
        } catch (_) {
            setConnected(false);
        } finally {
            setConnecting(false);
        }
    }, [cleanup, targetDigit]);

    useEffect(() => {
        connect(symbol);
        return () => cleanup();
    }, []);

    const handleSymbolChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSymbol(e.target.value);
        connect(e.target.value);
    };

    const handleTargetChange = (digit: number) => {
        setTargetDigit(digit);
        setSignal(getSignal(historyRef.current, digit));
    };

    const totalTicks = digitCounts.reduce((a, b) => a + b, 0);
    const maxCount = Math.max(...digitCounts, 1);
    const lastDigit = ticks.length > 0 ? ticks[ticks.length - 1].digit : null;
    const lastQuote = ticks.length > 0 ? ticks[ticks.length - 1].quote : null;

    return (
        <div className='matches'>
            <div className='matches__header'>
                <div className='matches__header-left'>
                    <h1 className='matches__title'>Matches / Differs</h1>
                    <p className='matches__subtitle'>Live digit analysis for Matches and Differs trading</p>
                </div>
                <div className='matches__controls'>
                    <select className='matches__select' value={symbol} onChange={handleSymbolChange} disabled={connecting}>
                        {SYMBOLS.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                    </select>
                    <div className={`matches__status ${connected ? 'matches__status--live' : connecting ? 'matches__status--connecting' : 'matches__status--offline'}`}>
                        <span className='matches__status-dot' />
                        {connected ? 'LIVE' : connecting ? 'Connecting...' : 'Offline'}
                    </div>
                </div>
            </div>

            <div className='matches__body'>
                <div className='matches__left-col'>
                    <div className='matches__price-card'>
                        <div className='matches__price-label'>Current Price</div>
                        <div className='matches__price-value'>{lastQuote?.toFixed(2) ?? '—'}</div>
                        {lastDigit !== null && (
                            <div className='matches__last-digit' style={{ background: DIGIT_COLORS[lastDigit] }}>
                                Last Digit: {lastDigit}
                            </div>
                        )}
                    </div>

                    <div className='matches__target-panel'>
                        <h3 className='matches__panel-title'>Select Target Digit</h3>
                        <div className='matches__digit-selector'>
                            {Array.from({ length: 10 }, (_, i) => (
                                <button
                                    key={i}
                                    className={`matches__digit-btn ${targetDigit === i ? 'matches__digit-btn--active' : ''}`}
                                    style={targetDigit === i ? { background: DIGIT_COLORS[i] } : {}}
                                    onClick={() => handleTargetChange(i)}
                                >
                                    {i}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className={`matches__signal-card matches__signal-card--${signal.toLowerCase()}`}>
                        <div className='matches__signal-label'>Signal</div>
                        <div className='matches__signal-value'>{signal}</div>
                        <div className='matches__signal-desc'>
                            {signal === 'MATCHES' && `Digit ${targetDigit} appearing frequently — consider MATCHES`}
                            {signal === 'DIFFERS' && `Digit ${targetDigit} not appearing — consider DIFFERS`}
                            {signal === 'WAIT' && 'Not enough data to generate a signal yet'}
                        </div>
                    </div>
                </div>

                <div className='matches__center-col'>
                    <div className='matches__distribution-panel'>
                        <h3 className='matches__panel-title'>Digit Distribution — Last {totalTicks} ticks</h3>
                        <div className='matches__bars'>
                            {digitCounts.map((count, digit) => {
                                const pct = totalTicks > 0 ? ((count / totalTicks) * 100).toFixed(1) : '0.0';
                                const barH = totalTicks > 0 ? (count / maxCount) * 100 : 0;
                                return (
                                    <div key={digit} className='matches__bar-col'>
                                        <div className='matches__bar-pct'>{pct}%</div>
                                        <div className='matches__bar-wrap'>
                                            <div
                                                className={`matches__bar-fill ${targetDigit === digit ? 'matches__bar-fill--target' : ''}`}
                                                style={{
                                                    height: `${barH}%`,
                                                    background: DIGIT_COLORS[digit],
                                                    opacity: targetDigit === digit ? 1 : 0.7,
                                                }}
                                            />
                                        </div>
                                        <div
                                            className='matches__bar-label'
                                            style={{ color: DIGIT_COLORS[digit], fontWeight: targetDigit === digit ? 800 : 600 }}
                                        >
                                            {digit}
                                        </div>
                                        <div className='matches__bar-count'>{count}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className='matches__tick-history'>
                        <h3 className='matches__panel-title'>Tick Stream (last 50)</h3>
                        <div className='matches__tick-dots'>
                            {ticks.map((tick, i) => (
                                <div
                                    key={i}
                                    className={`matches__tick-dot ${tick.digit === targetDigit ? 'matches__tick-dot--target' : ''}`}
                                    style={{ background: DIGIT_COLORS[tick.digit] }}
                                    title={`${tick.time} | Price: ${tick.quote.toFixed(2)} | Digit: ${tick.digit}`}
                                >
                                    {tick.digit}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className='matches__right-col'>
                    <div className='matches__stats-panel'>
                        <h3 className='matches__panel-title'>Statistics</h3>
                        <div className='matches__stats-list'>
                            {digitCounts.map((count, digit) => {
                                const pct = totalTicks > 0 ? ((count / totalTicks) * 100).toFixed(1) : '0.0';
                                return (
                                    <div
                                        key={digit}
                                        className={`matches__stat-row ${targetDigit === digit ? 'matches__stat-row--target' : ''}`}
                                        onClick={() => handleTargetChange(digit)}
                                    >
                                        <span
                                            className='matches__stat-digit'
                                            style={{ background: DIGIT_COLORS[digit] }}
                                        >
                                            {digit}
                                        </span>
                                        <span className='matches__stat-bar-bg'>
                                            <span
                                                className='matches__stat-bar-fill'
                                                style={{
                                                    width: `${totalTicks > 0 ? (count / maxCount) * 100 : 0}%`,
                                                    background: DIGIT_COLORS[digit],
                                                }}
                                            />
                                        </span>
                                        <span className='matches__stat-count'>{count}</span>
                                        <span className='matches__stat-pct'>{pct}%</span>
                                    </div>
                                );
                            })}
                        </div>
                        <div className='matches__stats-total'>Total ticks: <strong>{totalTicks}</strong></div>
                    </div>
                </div>
            </div>
        </div>
    );
});

export default Matches;
