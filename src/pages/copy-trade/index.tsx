import React, { useCallback, useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { getAppId, getSocketURL } from '@/components/shared';
import DerivAPIBasic from '@deriv/deriv-api/dist/DerivAPIBasic';
import './copy-trade.scss';

type TStatus = 'idle' | 'connecting' | 'active' | 'stopped' | 'error';

type TLogEntry = {
    id: number;
    time: string;
    type: 'info' | 'success' | 'error' | 'trade';
    message: string;
};

type TAccountInfo = {
    loginid: string;
    balance: number;
    currency: string;
    fullname: string;
};

type TCopierInfo = {
    loginid: string;
    token: string;
};

const createApi = (): DerivAPIBasic => {
    const server = getSocketURL().replace(/[^a-zA-Z0-9.]/g, '');
    const appId = String(getAppId()).replace(/[^a-zA-Z0-9]/g, '');
    const url = `wss://${server}/websockets/v3?app_id=${appId}&l=EN&brand=deriv`;
    const ws = new WebSocket(url);
    return new DerivAPIBasic({ connection: ws });
};

const formatTime = () => {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { hour12: false });
};

let logIdCounter = 0;

const CopyTrade = observer(() => {
    const [masterToken, setMasterToken] = useState('');
    const [slaveToken, setSlaveToken] = useState('');
    const [status, setStatus] = useState<TStatus>('idle');
    const [logs, setLogs] = useState<TLogEntry[]>([]);
    const [masterInfo, setMasterInfo] = useState<TAccountInfo | null>(null);
    const [slaveInfo, setSlaveInfo] = useState<TAccountInfo | null>(null);
    const [copiers, setCopiers] = useState<TCopierInfo[]>([]);
    const [tradeCount, setTradeCount] = useState(0);
    const [showMasterToken, setShowMasterToken] = useState(false);
    const [showSlaveToken, setShowSlaveToken] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const masterApiRef = useRef<DerivAPIBasic | null>(null);
    const slaveApiRef = useRef<DerivAPIBasic | null>(null);
    const logContainerRef = useRef<HTMLDivElement>(null);
    const transactionSubRef = useRef<any>(null);

    const addLog = useCallback((type: TLogEntry['type'], message: string) => {
        setLogs(prev => [
            ...prev,
            { id: ++logIdCounter, time: formatTime(), type, message },
        ]);
    }, []);

    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs]);

    const cleanup = useCallback(() => {
        try {
            if (transactionSubRef.current) {
                transactionSubRef.current.unsubscribe?.();
                transactionSubRef.current = null;
            }
            if (masterApiRef.current) {
                masterApiRef.current.disconnect?.();
                masterApiRef.current = null;
            }
            if (slaveApiRef.current) {
                slaveApiRef.current.disconnect?.();
                slaveApiRef.current = null;
            }
        } catch (_) {}
    }, []);

    useEffect(() => {
        return () => cleanup();
    }, [cleanup]);

    const authorizeAccount = async (api: DerivAPIBasic, token: string): Promise<TAccountInfo> => {
        const response = await api.authorize({ authorize: token });
        if (response.error) throw new Error(response.error.message);
        const { authorize } = response;
        return {
            loginid: authorize.loginid,
            balance: authorize.balance,
            currency: authorize.currency,
            fullname: authorize.fullname || authorize.loginid,
        };
    };

    const handleStart = async () => {
        if (!masterToken.trim() || !slaveToken.trim()) {
            setErrorMsg('Please enter both master and slave API tokens.');
            return;
        }
        if (masterToken.trim() === slaveToken.trim()) {
            setErrorMsg('Master and slave tokens must be different accounts.');
            return;
        }

        setErrorMsg('');
        setStatus('connecting');
        setLogs([]);
        setMasterInfo(null);
        setSlaveInfo(null);
        setTradeCount(0);
        cleanup();

        try {
            addLog('info', 'Connecting to Deriv API...');

            const masterApi = createApi();
            const slaveApi = createApi();
            masterApiRef.current = masterApi;
            slaveApiRef.current = slaveApi;

            await new Promise<void>((resolve, reject) => {
                let connected = 0;
                const onOpen = () => {
                    connected++;
                    if (connected === 2) resolve();
                };
                const onError = () => reject(new Error('WebSocket connection failed.'));
                (masterApi as any).connection?.addEventListener('open', onOpen);
                (slaveApi as any).connection?.addEventListener('open', onOpen);
                (masterApi as any).connection?.addEventListener('error', onError);
                (slaveApi as any).connection?.addEventListener('error', onError);
                setTimeout(() => reject(new Error('Connection timed out. Please try again.')), 15000);
            });

            addLog('info', 'Authorizing master account...');
            const mInfo = await authorizeAccount(masterApi, masterToken.trim());
            setMasterInfo(mInfo);
            addLog('success', `Master account authorized: ${mInfo.loginid} (${mInfo.currency})`);

            addLog('info', 'Authorizing slave account...');
            const sInfo = await authorizeAccount(slaveApi, slaveToken.trim());
            setSlaveInfo(sInfo);
            addLog('success', `Slave account authorized: ${sInfo.loginid} (${sInfo.currency})`);

            addLog('info', 'Starting copy trading...');
            const copyRes = await slaveApi.send({
                copy_start: 1,
                copy_trading_token: masterToken.trim(),
            });

            if (copyRes.error) {
                throw new Error(copyRes.error.message || 'Failed to start copy trading.');
            }

            addLog('success', '✓ Copy trading started successfully!');
            addLog('info', `All trades from ${mInfo.loginid} will now be copied to ${sInfo.loginid}.`);

            try {
                const listRes = await slaveApi.send({ copytrading_list: 1 });
                if (!listRes.error && listRes.copytrading_list) {
                    const masters = listRes.copytrading_list.masters || [];
                    setCopiers(
                        masters.map((m: any) => ({ loginid: m.loginid, token: m.token }))
                    );
                }
            } catch (_) {}

            const txSub = slaveApi.subscribe({ transaction: 1 });
            transactionSubRef.current = txSub;
            txSub.subscribe({
                next: (res: any) => {
                    if (res.transaction) {
                        const tx = res.transaction;
                        if (tx.action === 'buy') {
                            setTradeCount(c => c + 1);
                            addLog(
                                'trade',
                                `Trade copied: ${tx.contract_id || ''} | ${tx.display_name || 'Contract'} | Amount: ${tx.amount} ${tx.currency || ''}`
                            );
                        }
                    }
                },
                error: () => {},
            });

            setStatus('active');
        } catch (err: any) {
            const msg = err?.message || 'An error occurred. Please check your tokens and try again.';
            setErrorMsg(msg);
            addLog('error', `Error: ${msg}`);
            setStatus('error');
            cleanup();
        }
    };

    const handleStop = async () => {
        if (!masterToken.trim() || !slaveApiRef.current) return;
        try {
            addLog('info', 'Stopping copy trading...');
            const stopRes = await slaveApiRef.current.send({
                copy_stop: 1,
                copy_trading_token: masterToken.trim(),
            });
            if (stopRes.error) {
                addLog('error', `Stop error: ${stopRes.error.message}`);
            } else {
                addLog('success', '✓ Copy trading stopped.');
            }
        } catch (err: any) {
            addLog('error', `Stop error: ${err.message}`);
        } finally {
            setStatus('stopped');
            cleanup();
        }
    };

    const handleReset = () => {
        cleanup();
        setStatus('idle');
        setLogs([]);
        setMasterInfo(null);
        setSlaveInfo(null);
        setCopiers([]);
        setTradeCount(0);
        setErrorMsg('');
    };

    const isRunning = status === 'active';
    const isConnecting = status === 'connecting';

    return (
        <div className='copy-trade'>
            <div className='copy-trade__header'>
                <div className='copy-trade__header-icon'>📋</div>
                <h1 className='copy-trade__title'>Copy Trade</h1>
                <p className='copy-trade__subtitle'>
                    Automatically copy trades from a master account to a slave account in real time.
                </p>
            </div>

            <div className='copy-trade__body'>
                <div className='copy-trade__setup-panel'>
                    <div className='copy-trade__card'>
                        <h2 className='copy-trade__card-title'>
                            <span className='copy-trade__card-icon copy-trade__card-icon--master'>M</span>
                            Master Account
                        </h2>
                        <p className='copy-trade__card-desc'>The account whose trades will be copied.</p>
                        <div className='copy-trade__field'>
                            <label className='copy-trade__label'>API Token</label>
                            <div className='copy-trade__input-wrap'>
                                <input
                                    className='copy-trade__input'
                                    type={showMasterToken ? 'text' : 'password'}
                                    placeholder='Enter master API token...'
                                    value={masterToken}
                                    onChange={e => setMasterToken(e.target.value)}
                                    disabled={isRunning || isConnecting}
                                />
                                <button
                                    className='copy-trade__toggle-visibility'
                                    onClick={() => setShowMasterToken(v => !v)}
                                    type='button'
                                    title={showMasterToken ? 'Hide token' : 'Show token'}
                                >
                                    {showMasterToken ? '🙈' : '👁️'}
                                </button>
                            </div>
                        </div>
                        {masterInfo && (
                            <div className='copy-trade__account-info copy-trade__account-info--master'>
                                <span className='copy-trade__account-badge'>✓</span>
                                <span>{masterInfo.loginid}</span>
                                <span className='copy-trade__account-balance'>
                                    {masterInfo.balance} {masterInfo.currency}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className='copy-trade__arrow'>→</div>

                    <div className='copy-trade__card'>
                        <h2 className='copy-trade__card-title'>
                            <span className='copy-trade__card-icon copy-trade__card-icon--slave'>S</span>
                            Slave Account
                        </h2>
                        <p className='copy-trade__card-desc'>The account that will copy the master's trades.</p>
                        <div className='copy-trade__field'>
                            <label className='copy-trade__label'>API Token</label>
                            <div className='copy-trade__input-wrap'>
                                <input
                                    className='copy-trade__input'
                                    type={showSlaveToken ? 'text' : 'password'}
                                    placeholder='Enter slave API token...'
                                    value={slaveToken}
                                    onChange={e => setSlaveToken(e.target.value)}
                                    disabled={isRunning || isConnecting}
                                />
                                <button
                                    className='copy-trade__toggle-visibility'
                                    onClick={() => setShowSlaveToken(v => !v)}
                                    type='button'
                                    title={showSlaveToken ? 'Hide token' : 'Show token'}
                                >
                                    {showSlaveToken ? '🙈' : '👁️'}
                                </button>
                            </div>
                        </div>
                        {slaveInfo && (
                            <div className='copy-trade__account-info copy-trade__account-info--slave'>
                                <span className='copy-trade__account-badge'>✓</span>
                                <span>{slaveInfo.loginid}</span>
                                <span className='copy-trade__account-balance'>
                                    {slaveInfo.balance} {slaveInfo.currency}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {errorMsg && (
                    <div className='copy-trade__error'>
                        <span>⚠️</span> {errorMsg}
                    </div>
                )}

                <div className='copy-trade__actions'>
                    {status === 'idle' || status === 'error' ? (
                        <button className='copy-trade__btn copy-trade__btn--start' onClick={handleStart}>
                            ▶ Start Copy Trading
                        </button>
                    ) : status === 'connecting' ? (
                        <button className='copy-trade__btn copy-trade__btn--connecting' disabled>
                            <span className='copy-trade__spinner' /> Connecting...
                        </button>
                    ) : status === 'active' ? (
                        <>
                            <div className='copy-trade__status-badge copy-trade__status-badge--active'>
                                <span className='copy-trade__pulse' /> Copy Trading Active
                            </div>
                            <button className='copy-trade__btn copy-trade__btn--stop' onClick={handleStop}>
                                ■ Stop Copy Trading
                            </button>
                        </>
                    ) : (
                        <button className='copy-trade__btn copy-trade__btn--reset' onClick={handleReset}>
                            ↺ Start New Session
                        </button>
                    )}
                </div>

                {(isRunning || status === 'stopped') && (
                    <div className='copy-trade__stats'>
                        <div className='copy-trade__stat'>
                            <div className='copy-trade__stat-value'>{tradeCount}</div>
                            <div className='copy-trade__stat-label'>Trades Copied</div>
                        </div>
                        {masterInfo && slaveInfo && (
                            <>
                                <div className='copy-trade__stat'>
                                    <div className='copy-trade__stat-value'>{masterInfo.loginid}</div>
                                    <div className='copy-trade__stat-label'>Master</div>
                                </div>
                                <div className='copy-trade__stat'>
                                    <div className='copy-trade__stat-value'>{slaveInfo.loginid}</div>
                                    <div className='copy-trade__stat-label'>Slave</div>
                                </div>
                            </>
                        )}
                    </div>
                )}

                <div className='copy-trade__log-panel'>
                    <div className='copy-trade__log-header'>
                        <span>Activity Log</span>
                        <button className='copy-trade__log-clear' onClick={() => setLogs([])}>
                            Clear
                        </button>
                    </div>
                    <div className='copy-trade__log-body' ref={logContainerRef}>
                        {logs.length === 0 ? (
                            <div className='copy-trade__log-empty'>No activity yet. Start copy trading to see logs.</div>
                        ) : (
                            logs.map(log => (
                                <div key={log.id} className={`copy-trade__log-entry copy-trade__log-entry--${log.type}`}>
                                    <span className='copy-trade__log-time'>{log.time}</span>
                                    <span className='copy-trade__log-msg'>{log.message}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className='copy-trade__notice'>
                    <h3>ℹ️ Important Notes</h3>
                    <ul>
                        <li>The master account token must have <strong>Trade</strong> and <strong>Read</strong> permissions enabled.</li>
                        <li>The slave account token must have <strong>Trade</strong> permissions enabled.</li>
                        <li>The master account must have <strong>Allow copiers</strong> enabled in their account settings.</li>
                        <li>Copied trades may differ in stake size based on account balance proportions.</li>
                        <li>Always test with demo accounts before using real money.</li>
                    </ul>
                </div>
            </div>
        </div>
    );
});

export default CopyTrade;
