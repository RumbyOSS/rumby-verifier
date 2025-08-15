import { BorshInstructionCoder, Idl } from '@coral-xyz/anchor';
import { Connection, PublicKey, VersionedTransactionResponse } from '@solana/web3.js';
import idl from '../../public/idl/rumby_contract.json';
import bs58 from 'bs58';

const bufFromIxData = (d: any): Buffer => {
    if (d instanceof Uint8Array) return Buffer.from(d);
    if (Array.isArray(d)) return Buffer.from(d);
    if (typeof d === 'string') {
        try { return Buffer.from(bs58.decode(d)); } catch { }
        return Buffer.from(d, 'base64');
    }
    throw new Error('Unrecognized ix data format');
}

export const decodeIxsWithIdl = (
    tx: VersionedTransactionResponse,
    idl: Idl,
) => {
    const coder = new BorshInstructionCoder(idl);
    const message = tx.transaction.message as any;
    const programId = new PublicKey(idl.address);

    // Resolve account keys (v0 safe)
    const keys = message.getAccountKeys
        ? message.getAccountKeys({
            accountKeysFromLookups: tx.meta?.loadedAddresses
                ? {
                    writable: tx.meta.loadedAddresses.writable ?? [],
                    readonly: tx.meta.loadedAddresses.readonly ?? [],
                }
                : undefined,
        })
        : { staticAccountKeys: message.accountKeys };

    const out: Array<{ name: string; args: any; index: number; inner?: boolean }> = [];

    // Top-level
    for (let i = 0; i < (message.compiledInstructions?.length ?? 0); i++) {
        const ix = message.compiledInstructions[i];
        const pid = new PublicKey(keys.staticAccountKeys[ix.programIdIndex]);
        if (!pid.equals(programId)) continue;
        const decoded = coder.decode(bufFromIxData(ix.data));
        if (decoded) out.push({ name: decoded.name, args: decoded.data, index: i });
    }

    // Inner ixs (if you need them)
    for (const inner of tx.meta?.innerInstructions ?? []) {
        for (const ix of inner.instructions) {
            const pid = new PublicKey(keys.staticAccountKeys[ix.programIdIndex]);
            if (!pid.equals(programId)) continue;
            const decoded = coder.decode(bufFromIxData(ix.data));
            if (decoded) out.push({ name: decoded.name, args: decoded.data, index: inner.index, inner: true });
        }
    }

    return out;
}

// Modified decoder that shows all instructions
export const decodeAllIxs = (tx: VersionedTransactionResponse, idl: Idl) => {
    const message = tx.transaction.message as any;

    // Resolve account keys (v0 safe)
    const keys = message.getAccountKeys
        ? message.getAccountKeys({
            accountKeysFromLookups: tx.meta?.loadedAddresses
                ? {
                    writable: tx.meta.loadedAddresses.writable ?? [],
                    readonly: tx.meta.loadedAddresses.readonly ?? [],
                }
                : undefined,
        })
        : { staticAccountKeys: message.accountKeys };

    const out: Array<{
        name: string;
        args: any;
        index: number;
        inner?: boolean;
        programId: string;
        rawData: string;
        accounts: string[];
    }> = [];

    // Top-level instructions
    for (let i = 0; i < (message.compiledInstructions?.length ?? 0); i++) {
        const ix = message.compiledInstructions[i];
        const pid = new PublicKey(keys.staticAccountKeys[ix.programIdIndex]);

        // Get account keys for this instruction - handle both legacy and v0 formats
        const accountKeys = ((ix as any).accounts || (ix as any).accountKeyIndexes || []).map((accIndex: number) =>
            keys.staticAccountKeys[accIndex].toBase58()
        );

        // Try to decode with rumby IDL first
        try {
            const coder = new BorshInstructionCoder(idl as Idl);
            const decoded = coder.decode(bufFromIxData(ix.data));
            if (decoded) {
                out.push({
                    name: decoded.name,
                    args: decoded.data,
                    index: i,
                    programId: pid.toBase58(),
                    rawData: bs58.encode(bufFromIxData(ix.data)),
                    accounts: accountKeys
                });
                continue;
            }
        } catch (e: any) {
            console.log(e)
            //If rumby IDL fails, just show raw data
        }

        //If rumby IDL doesn't work, show raw instruction data
        out.push({
            name: 'unknown',
            args: null,
            index: i,
            programId: pid.toBase58(),
            rawData: bs58.encode(bufFromIxData(ix.data)),
            accounts: accountKeys
        });
    }

    // Inner instructions
    for (const inner of tx.meta?.innerInstructions ?? []) {
        for (const ix of inner.instructions) {
            const pid = new PublicKey(keys.staticAccountKeys[ix.programIdIndex]);

            // Get account keys for this instruction - handle both legacy and v0 formats
            const accountKeys = ((ix as any).accounts || (ix as any).accountKeyIndexes || []).map((accIndex: number) =>
                keys.staticAccountKeys[accIndex].toBase58()
            );

            // Try to decode with rumby IDL first
            try {
                const coder = new BorshInstructionCoder(idl as Idl);
                const decoded = coder.decode(bufFromIxData(ix.data));
                if (decoded) {
                    out.push({
                        name: decoded.name,
                        args: decoded.data,
                        index: inner.index,
                        inner: true,
                        programId: pid.toBase58(),
                        rawData: bs58.encode(bufFromIxData(ix.data)),
                        accounts: accountKeys
                    });
                    continue;
                }
            } catch (e: any) {
                console.log(e);
                //If rumby IDL fails, just show raw data
            }

            //If rumby IDL doesn't work, show raw instruction data
            out.push({
                name: 'unknown',
                args: null,
                index: inner.index,
                inner: true,
                programId: pid.toBase58(),
                rawData: bs58.encode(bufFromIxData(ix.data)),
                accounts: accountKeys
            });
        }
    }

    return out;
}

export const getTxDetails = async(connection: Connection, txHash: string) => {
    if(!connection) return;

    try {
        // Check if transaction was successful
        const tx = await connection.getTransaction(txHash, {
            maxSupportedTransactionVersion: 0,
        });
        if (!tx) {
            throw new Error(`Transaction not found for ${txHash}`);
        }

        // console.log(`\n=== All instructions decoded ===`);
        const allDecoded = decodeAllIxs(tx as VersionedTransactionResponse, idl as Idl);
        // console.log(`All decoded instructions:`, JSON.stringify(allDecoded, null, 2));
        // console.log({ allDecoded })

        // console.log(`\n=== All instructions decoded ===`);

        return allDecoded;
    }

    catch {
        console.log('Unable to get tx')
    }
};