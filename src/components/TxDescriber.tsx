import Link from "next/link";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLink } from "@fortawesome/free-solid-svg-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getTxDetails } from "@/utils/parser";
import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { findTargetBlockHash, getExplorerLink, getRandomNumberFromSeeds, resolveRouletteOutcome } from "@/utils/common";
import { Record } from "@/app/types";
import { v4 } from "uuid";
import { ROULETTE_RANGES } from "@/constants/common";
import { CheckMark } from "./CheckMark";

const ROULETTE_HOUSE_BET = 1;

type TxDescriberProps = {
    gameId: string;
    title: string;
    connection?: Connection;
    description?: string;
    tx?: string;
    serverSeed?: string;
    hashedServerSeed?: string;
    publicSeed?: string;
    rangeStart?: number;
    rangeEnd?: number;
    targetBlockHeight?: number;
    fromSlot?: number;
    randomNumber?: number;
    totalAmount?: number;
    records?: Record[];
}
const TxDescriber = ({
    gameId,
    title, 
    connection, 
    // description, 
    tx,
    serverSeed,
    hashedServerSeed,
    publicSeed,
    rangeStart,
    rangeEnd,
    randomNumber,
    totalAmount,
    records,
    targetBlockHeight,
    fromSlot,
}: TxDescriberProps) => {
    const [hasError, setHasError] = useState(false);
    const [newMatchEvent, setNewMatchEvent] = useState<any>();
    const [newRoundEvent, setNewRoundEvent] = useState<any>();
    const [placeBetEvent, setPlaceBetEvent] = useState<any>();
    const [revealEvent, setRevealEvent] = useState<any>();
    const [foundSlot, setFoundSlot] = useState<number>();
    const [foundBlockhash, setFoundBlockhash] = useState<string>();
    const isGettingBlock = useRef(false);

    const revealedServerSeed = useMemo(() => {
        if(!revealEvent) return "";
        return new PublicKey(revealEvent.server_seed).toBase58();
    }, [revealEvent]);

    const revealedPublicSeed = useMemo(() => {
        if(!revealEvent) return "";
        return new PublicKey(revealEvent.public_seed).toBase58();
    }, [revealEvent]);

    const onchainRandomNumber = useMemo(() => {
        if(!revealedPublicSeed || !revealedServerSeed || !totalAmount) return;
        const randomNumber = getRandomNumberFromSeeds(Buffer.from(bs58.decode(revealedServerSeed)), Buffer.from(bs58.decode(revealedPublicSeed)), BigInt(totalAmount));
        if(gameId === "roulette") {
            const outcome = resolveRouletteOutcome(Number(randomNumber));
            return outcome;
        }
        return Number(randomNumber);
    }, [revealedPublicSeed, revealedServerSeed, totalAmount, gameId]);

    const winners = useMemo(() => {
        if(!records) return;
        if(!onchainRandomNumber) return;
        let winners = [];
        if(gameId === "roulette") {
            winners = records
                        .sort((a,b) => (Number(a.bet_range_start) - Number(b.bet_range_start)))
                        .filter(x => ROULETTE_RANGES[Number(x.bet_range_start)]?.includes(onchainRandomNumber));
        }

        else {
            // get records that are within the random number range
            winners = records.filter(x => Number(x.bet_range_start) <= onchainRandomNumber && Number(x.bet_range_end) >= onchainRandomNumber); 
        }

        return [...new Set(winners.map(x => x.player))];
    }, [onchainRandomNumber, records, gameId]);

    const onchainWinners = useMemo(() => {
        if(!revealEvent) return [];
        if(!records) return [];
        if(revealEvent.winners.length === 0) return [];
        let housePlayers: string[] = [];
        
        // we only need to find house players for roulette
        if(gameId === "roulette") {
            const filtered = records.filter(x => x.bet_range_start === "0" && x.bet_range_end === "0");
            housePlayers = filtered.map(x => x.player);
        }

        const winners = revealEvent.winners.map((x: any) => (x.player.toBase58() + `${housePlayers.includes(x.player.toBase58())? " (House)" : ""}`)) as string[];
        return [...new Set(winners)];
    }, [revealEvent, records, gameId]);

    const showChoice = useMemo(() => {
        return gameId === "coinflip" || gameId === "roulette";
    }, [gameId]);

    const showTicketRange = useMemo(() => {
        return gameId !== "roulette";
    }, [gameId]);

    const getChoice = useCallback((choice: string) => {
        if(gameId === "coinflip") {
            return Number(BigInt(choice)) === 0? "Heads" : "Tails";
        }

        if(gameId === "roulette") {
            switch(Number(BigInt(choice))) {
                case 0:
                    return "Green";

                case 1:
                    return "Yellow";

                case 2:
                    return "Purple";

                case 3:
                    return "Yellow with Top or Red with Top";

                default:
                    return "Unknown";
            }
        }

        return "Unknown";
    }, [gameId]);

    const Events = useCallback(() => {
        const events: React.ReactElement[] = [];
        if(newMatchEvent) {
            events.push(
                <div key={v4()}>
                    <strong>Event: New Match</strong>
                    <ul>
                        <li>Mint Set: <Link href={`${getExplorerLink("token", newMatchEvent.match_data?.mint.toBase58())}`} target="_blank">{newMatchEvent.match_data?.mint.toBase58()}</Link></li>
                    </ul>
                </div>
            )
        }

        if(newRoundEvent) {
            const eventHashedSeed = bs58.encode(newRoundEvent.hashed_server_seed).toString();
            events.push(
                <div key={v4()}>
                    <strong>Event: New Game Round</strong>
                    <ul>
                        <li>Round: <strong>{newRoundEvent.round.toNumber()}</strong></li>
                        <li>Hashed Server Seed (Raw): <strong>[{newRoundEvent.hashed_server_seed.join(", ")}]</strong></li>
                        <li>Hashed Server Seed (Decoded): <strong>{eventHashedSeed} <CheckMark isSame={eventHashedSeed === hashedServerSeed}/></strong></li>
                    </ul>
                </div>
            )
        }

        if(placeBetEvent) {
            events.push(
                <div key={v4()}>
                    <strong>Event: Place Bet</strong>
                    <ul>
                        <li>Player: <strong>{placeBetEvent.player.toBase58()}</strong></li>
                        <li>Amount: <strong>{Number(BigInt(placeBetEvent.amount)) / LAMPORTS_PER_SOL}</strong></li>
                        {
                            showChoice &&
                            <li>Choice: <strong>{placeBetEvent.bet_type === ROULETTE_HOUSE_BET? 'House' : getChoice(placeBetEvent.choice)}</strong></li>
                        }
                        {
                            showTicketRange &&
                            <li>Ticket Range: <strong>{rangeStart} - {rangeEnd}</strong></li>
                        }
                    </ul>
                </div>
            )
        }

        if(revealEvent) {
            events.push(
                <div key={v4()}>
                    <strong>Event: Reveal Winners</strong>
                    <ul>
                        <li>
                            Winners (On Chain): {onchainWinners.length}
                            <ul style={{
                                listStyle: "decimal",
                                paddingLeft: 50
                            }}>
                                {
                                    onchainWinners.map((x: any) => (
                                        <li key={v4()}><strong>{x}</strong></li>
                                    ))
                                }
                            </ul>
                        </li>
                        <li className="mt-[10px]">Revealed Server Seed (On Chain): <strong>{revealedServerSeed}</strong> <CheckMark isSame={revealedServerSeed === serverSeed}/></li>
                        <li>Revealed Public Seed (On Chain): <strong>{revealedPublicSeed}</strong> <CheckMark isSame={revealedPublicSeed === publicSeed}/></li>
                        <li className="mt-[10px]">Target Slot (RPC): <Link href={`${getExplorerLink("block", foundSlot?.toString() ?? "")}`} target="_blank"><FontAwesomeIcon icon={faLink} /><strong>{foundSlot ?? "Getting Slot.."}</strong></Link></li>
                        <li>Target Blockhash (RPC): <Link href={`${getExplorerLink("block", foundSlot?.toString() ?? "")}`} target="_blank"><FontAwesomeIcon icon={faLink} /><strong>{foundBlockhash ?? "Getting Blockhash.."}</strong> <CheckMark isSame={revealedPublicSeed === foundBlockhash}/></Link></li>
                        <li className="mt-[10px]">Random Number (Calculated): <strong>{onchainRandomNumber}</strong> <CheckMark isSame={Number(onchainRandomNumber) === randomNumber}/></li>
                        <li>
                            Winners (Calculated): {winners?.length ?? 0}
                            <ul style={{
                                listStyle: "decimal",
                                paddingLeft: 50
                            }}>
                                {
                                    winners && winners.map((x: string) => (
                                        <li key={v4()}><strong>{x}</strong> <CheckMark isSame={onchainWinners.map((w: string) => w.replace(" (House)", "")).includes(x)}/></li>
                                    ))
                                }
                            </ul>
                        </li>
                    </ul>
                </div>
            )
        }

        if(events.length === 0) return null;

        return (
            <>
            {...events}
            </>
        );
    }, [
        newMatchEvent, 
        newRoundEvent, 
        placeBetEvent, 
        revealEvent, 
        rangeStart, 
        rangeEnd, 
        serverSeed, 
        showChoice, 
        getChoice, 
        showTicketRange, 
        foundBlockhash, 
        foundSlot,
        hashedServerSeed,
        onchainRandomNumber,
        publicSeed,
        randomNumber,
        revealedPublicSeed,
        revealedServerSeed,
        onchainWinners,
        winners
    ]);

    useEffect(() => {
        setRevealEvent(undefined);
        setPlaceBetEvent(undefined);
        setNewMatchEvent(undefined);
        setNewRoundEvent(undefined);
    }, [tx]);

    useEffect(() => {
        if(!tx) return;
        if(!connection) return;
        
        const getData = async() => {
            console.log('getting details')
            try {
                const events = await getTxDetails(connection, tx);

                if(!events) throw Error("");
                for(const event of events) {
                    switch(event.name) {
                        case "ix1":
                            setPlaceBetEvent(event.args);
                            break;

                        case "ix3":
                            setRevealEvent(event.args);
                            break;

                        case "ix4":
                            setNewRoundEvent(event.args);
                            break;

                        case "ix5":
                            setNewMatchEvent(event.args);
                            break;
                    }
                }
            }

            catch(e) {
                console.log(e)
                setHasError(true);
            }
        }

        getData();
    }, [tx, connection]);


    useEffect(() => {
        const getData = async() => {
            if(!connection) return;
            if(!revealEvent) return;
            if(!targetBlockHeight) return;
            if(!fromSlot) return;
            if(isGettingBlock.current) return;

            isGettingBlock.current = true;
            try {
                const block = await findTargetBlockHash(connection, targetBlockHeight, fromSlot);
                if(!block) throw Error("");

                setFoundBlockhash(block.block.blockhash);
                setFoundSlot(block.slot);
            }

            catch {
                alert('Unable to find block');
            }
            isGettingBlock.current = false;
        }

        getData();
    }, [revealEvent, connection, targetBlockHeight, fromSlot]);

    if(!tx) return null;

    return (
        <div className="flex flex-col bg-white w-full p-5 mt-5 rounded text-black">
            <strong>{title}</strong>
            <Link
                href={`${getExplorerLink("tx", tx)}`}
                target="_blank"
            >
                <div className="flex flex-row items-center">
                    <FontAwesomeIcon icon={faLink} />
                    <span className="ml-3">{tx.substring(0, 5) + "..." + tx.substring(tx.length - 5, tx.length)}</span>
                </div>
            </Link>
            {
                hasError?
                <div>
                    Error
                </div>:
                <div className="mt-5 space-y-[20px]">
                    <Events />
                </div>
            }
        </div>
    )
}

export { TxDescriber };