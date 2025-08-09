'use client';
import { Connection, PublicKey } from '@solana/web3.js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Data, PokaData } from './types';
import { TxDescriber } from '@/components/TxDescriber';
import { config } from '@fortawesome/fontawesome-svg-core'
import '@fortawesome/fontawesome-svg-core/styles.css'
import { bs58 } from '@coral-xyz/anchor/dist/cjs/utils/bytes';
import keccak256 from "keccak256";
import { v4 } from 'uuid';
import { PokaTxDescriber } from '@/components/PokaTxDescriber';
import { PokaDeck } from '@/components/PokaDeck';
config.autoAddCss = false

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export default function Home() {
    const [connection, setConnection] = useState<Connection>();
    const [rpcEndpoint, setRpcEndpoint] = useState("");
    const [matchId, setMatchId] = useState("");
    const [roundId, setRoundId] = useState("");
    // const [isSettingConnection, setIsSettingConnection] = useState(false);
    // const [showGameDescription, setShowGameDescription] = useState(false);
    const [gameId, setGameId] = useState("");
    const [data, setData] = useState<Data>();
    const [pokaData, setPokaData] = useState<PokaData>();

    const hashedServerSeed = useMemo(() => {
        if(!data) return "";
        return bs58.encode(Uint8Array.from(keccak256((new PublicKey(data.server_seed)).toBuffer())));
    }, [data]);

    const pokaHashedServerSeed = useMemo(() => {
        if(!pokaData) return "";
        return bs58.encode(Uint8Array.from(keccak256((new PublicKey(pokaData.server_seed)).toBuffer())));
    }, [pokaData]);

    const betRecords = useMemo(() => {
        if(!data?.records || data.records.length === 0) return [];
        return data.records.filter(x => x.created_tx !== data.created_tx);
    }, [data]);

    const pokaJoinRoundTxs = useMemo(() => {
        if(!pokaData?.records || pokaData.records.length === 0) return [];
        const filtered = pokaData.records.filter(x => x.status === "sitin");
        if(filtered.length === 0) {
            return [];
        }

        // get unique create txs
        return [...new Set(filtered.map(x => x.created_tx))];
    }, [pokaData]);

    const pokaPlaceBetTxs = useMemo(() => {
        if(!pokaData?.records || pokaData.records.length === 0) return [];
        const filtered = pokaData.records.filter(x => x.status !== "sitin");
        if(filtered.length === 0) {
            return [];
        }

        // get unique create txs
        return [...new Set(filtered.map(x => x.created_tx))];
    }, [pokaData]);

    const pokaFoldedPlayers = useMemo(() => {
        if(!pokaData?.records || pokaData.records.length === 0) return [];
        const filtered = pokaData.records.filter(x => x.poka_action === "fold");
        if(filtered.length === 0) {
            return [];
        }

        // get unique create txs
        return [...new Set(filtered.map(x => x.player))];
    }, [pokaData]);

    const onVerify = useCallback(async() => {
        if(!matchId) {
            return;
        }

        if(!roundId) {
            return;
        }

        if(!gameId) {
            return;
        }

        try {
            setData(undefined);
            setPokaData(undefined);
            const res = await axios.get<Data | PokaData>(API_BASE_URL + `/${gameId}/${matchId}/${roundId}`);

            if(gameId === "poka") {
                setPokaData(res.data as PokaData);
            }

            else {
                setData(res.data as Data);
            }
        }

        catch(e: any) {
            if(e.response && e.response.data) {
                alert(e.response.data);
                return;
            }
            alert('Failed to get data');
        }
    }, [roundId, matchId, gameId]);

    useEffect(() => {
        const timeout = setTimeout(async() => {
            // setIsSettingConnection(true);
            try {
                const connection = new Connection(rpcEndpoint, 'confirmed');
                await connection.getLatestBlockhash();
                setConnection(connection);
                // alert('RPC set');
            }

            catch {
                // alert('Invalid RPC');
            }
            // setIsSettingConnection(false);
        }, 1000);

        return () => { clearTimeout(timeout) };
    }, [rpcEndpoint]);

    useEffect(() => {
        setMatchId("");
        setRoundId("");
    }, [gameId]);

    useEffect(() => {
        setData(undefined);
        setPokaData(undefined);
    }, [matchId, roundId]);

    return (
        <div className="min-h-screen w-screen py-5 flex flex-col items-center">

            <div className="flex flex-col w-[768px] mb-[100px]">
                <div className="flex flex-row space-x-[10px] mb-[5px] items-center">
                    <span>RPC Status: </span>
                    {
                        connection?
                        <div className="h-[15px] w-[15px] bg-green-500 rounded-full">
                        </div> :
                        <div className="h-[15px] w-[15px] bg-red-500 rounded-full">
                        </div>
                    }
                </div>

                <div className="flex flex-row space-x-[10px] items-center">
                    <input 
                        type="text" 
                        className='bg-white text-black outline-none px-2 py-1 rounded flex-1' 
                        onChange={({target: { value }}) => { setRpcEndpoint(value) }} 
                        value={rpcEndpoint}
                        placeholder='https://your.rpc'
                    />
                    {/* <button 
                        className='cursor-pointer outline-none h-full bg-green-700 px-2 py-1 rounded w-[100px]' 
                        onClick={onSetConnection}
                    >{isSettingConnection? 'Setting' : 'Set RPC'}</button> */}
                </div>

                <div className="flex flex-row w-full justify-between space-x-[10px] mt-[10px]">
                    <select 
                        className='bg-white text-black outline-none px-2 py-1 rounded flex-1' 
                        onChange={({target: {value}}) => { setGameId(value) }} 
                        value={gameId}
                    >
                        <option value="">Select Game</option>
                        <option value="jackpot">Jackpot</option>
                        <option value="poka">Poka</option>
                        <option value="roulette">Roulette</option>
                        <option value="coinflip">Coinflip</option>
                    </select>
                    <input 
                        type="text" className='bg-white text-black outline-none px-2 py-1 rounded flex-1 disabled:bg-white/60' 
                        onChange={({target: { value }}) => { setMatchId(value) }} 
                        value={matchId}
                        placeholder='Match Id'
                        disabled={gameId === "coinflip"}
                    />
                    <input 
                        type="text" className='bg-white text-black outline-none px-2 py-1 rounded flex-1' 
                        onChange={({target: { value }}) => { 
                            setRoundId(value) ;
                            if(gameId === "coinflip") {
                                setMatchId(value);
                            }
                        }} 
                        value={roundId}
                        placeholder='Round Id'
                    />
                    <button 
                        className='cursor-pointer outline-none h-full bg-green-700 px-2 py-1 rounded w-[100px]' 
                        onClick={onVerify}
                    >Verify</button>
                </div>
                {/* <button className='cursor-pointer outline-none bg-green-700 px-2 py-1 rounded mt-[10px]' onClick={() => {}}>Show Game Description</button> */}

                {
                    gameId === "poka"?
                    <>
                    {
                        pokaData &&
                        <>
                        <div className="flex flex-col bg-white w-full p-5 mt-5 rounded text-black">
                            <strong>Round Details</strong>
                            <ul>
                                <li>Server Seed: <strong>{pokaData.server_seed}</strong></li>
                                <li>Hashed Server Seed: <strong>{pokaData.hashed_server_seed}</strong></li>
                                <li>Client Seeds: </li>
                                <ul style={{ listStyle: "decimal", paddingLeft: 50 }}>
                                    {
                                        pokaData.client_seeds.map(x => (
                                            <li key={v4()}><strong>{x}</strong></li>
                                        ))
                                    }
                                </ul>
                                {/* <li>Target Block: <strong>{data.current_slot}</strong></li> */}
                            </ul>
                        </div>

                        <PokaTxDescriber
                            roundId={roundId}
                            title='Create Match Transaction'
                            tx={pokaData.match_created_tx}
                            connection={connection}
                            hashedServerSeed={pokaHashedServerSeed}
                        />

                        {
                            pokaData.match_created_tx !== pokaData.round_created_tx &&
                            <PokaTxDescriber
                                roundId={roundId}
                                title='Create Round Transaction'
                                tx={pokaData.round_created_tx}
                                connection={connection}
                                hashedServerSeed={pokaHashedServerSeed}
                            />
                        }

                        {
                            pokaJoinRoundTxs.length > 0 &&
                            pokaJoinRoundTxs.map((x) => (
                                <PokaTxDescriber
                                    key={v4()}
                                    roundId={roundId}
                                    title='Player Join Round'
                                    tx={x}
                                    connection={connection}
                                    clientSeeds={pokaData.client_seeds}
                                    serverDeck={pokaData.deck}
                                />
                            ))
                        }

                        <PokaDeck
                            serverSeed={pokaData.server_seed}
                            serverDeck={pokaData.deck}
                            clientSeeds={pokaData.client_seeds}
                        />

                        {
                            pokaPlaceBetTxs.length > 0 &&
                            pokaPlaceBetTxs.map((x) => (
                                <PokaTxDescriber
                                    key={v4()}
                                    roundId={roundId}
                                    title='Draw Card Events'
                                    tx={x}
                                    connection={connection}
                                    clientSeeds={pokaData.client_seeds}
                                    serverDeck={pokaData.deck}
                                />
                            ))
                        }
                        <PokaTxDescriber
                            key={v4()}
                            roundId={roundId}
                            title='Reveal Winner'
                            tx={pokaData.result_tx}
                            connection={connection}
                            clientSeeds={pokaData.client_seeds}
                            serverDeck={pokaData.deck}
                            pokaFoldedPlayers={pokaFoldedPlayers}
                            records={pokaData.records}
                        />
                        </>
                    }
                    </>:
                    <>
                    {
                        data &&
                        <>
                        <div className="flex flex-col bg-white w-full p-5 mt-5 rounded text-black">
                            <strong>Match Details</strong>
                            <ul>
                                <li>Server Seed: <strong>{data.server_seed}</strong></li>
                                <li>Hashed Server Seed: <strong>{data.hashed_server_seed}</strong></li>
                                <li>Public Seed: <strong>{data.public_seed}</strong></li>
                                <li>Target Block: <strong>{data.public_seed_block_height}</strong></li>
                                <li>Random Number: <strong>{data.random_number_revealed}</strong></li>
                                {/* <li>Target Block: <strong>{data.current_slot}</strong></li> */}
                            </ul>
                        </div>


                        <TxDescriber
                            gameId={gameId}
                            title='Create Transaction'
                            tx={data.created_tx}
                            connection={connection}
                            hashedServerSeed={hashedServerSeed}
                            rangeStart={Number(data.records[0].bet_range_start)}
                            rangeEnd={Number(data.records[0].bet_range_end)}
                        />

                        {
                            betRecords.length > 0 &&
                            betRecords.map((x, index) => (
                                <TxDescriber
                                    gameId={gameId}
                                    key={v4()}
                                    title={gameId === "coinflip"? "Opponent Bet" : `Bet ${index + 1}`}
                                    tx={x.created_tx}
                                    connection={connection}
                                    // hashedServerSeed={hashedServerSeed}
                                    rangeStart={Number(x.bet_range_start)}
                                    rangeEnd={Number(x.bet_range_end)}
                                />
                            ))
                        }

                        <TxDescriber
                            gameId={gameId}
                            title='Result Transaction'
                            tx={data.result_tx}
                            connection={connection}
                            serverSeed={data.server_seed}
                            publicSeed={data.public_seed}
                            randomNumber={Number(data.random_number_revealed)}
                            totalAmount={Number(data.total_amount)}
                            records={data.records}
                            targetBlockHeight={Number(data.public_seed_block_height)}
                            fromSlot={Number(data.current_slot)}
                        />
                        </>
                    }
                    </>
                }
            </div>
        </div>
    )
}
