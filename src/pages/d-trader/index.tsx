import React from 'react';
import { observer } from 'mobx-react-lite';
import './d-trader.scss';

const DTrader = observer(() => {
    return (
        <div className='d-trader'>
            <div className='d-trader__iframe-container'>
                <iframe
                    src='https://app.deriv.com/dtrader'
                    className='d-trader__iframe'
                    title='DTrader'
                    allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
                    allowFullScreen
                    sandbox='allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox'
                />
            </div>
        </div>
    );
});

export default DTrader;
