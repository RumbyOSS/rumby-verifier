'use client';

import { HistoryTable } from "@/components/app/provably_fair/HistoryTable";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from '@/services/axios';
import { History } from "../types";

const DATA_PER_PAGE = 10;
const Page = () => {
    const [histories, setHistories] = useState<History[]>([]);
    const [count, setCount] = useState(0);
    const [page, setPage] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const hasInit = useRef(false);

    const maxPage = useMemo(() => {
        return Math.floor(count / DATA_PER_PAGE);
    }, [count]);

    const getData = useCallback(async(page = 0) => {
        if(isLoading) return;
        try {
            setIsLoading(true);
            const res = await axios.get<History[]>(`/jackpot/page/${page}`);
            setHistories(res.data);
        }

        catch {
            // do nothing
        }
        setIsLoading(false);
    }, [isLoading]);

    const onLeftClick = useCallback(() => {
        if(isLoading) return;
        const newPage = page - 1;
        if(newPage < 0) {
            return;
        }

        setPage(newPage);
        getData(newPage);
    }, [isLoading, page, getData]);

    const onRightClick = useCallback(() => {
        if(isLoading) return;
        const newPage = page + 1;
        if(newPage > maxPage) {
            return;
        }

        setPage(newPage);
        getData(newPage);
    }, [isLoading, page, maxPage, getData]);

    const getCount = useCallback(async() => {
        try {
            const res = await axios.get<string>("/jackpot/count");
            setCount(Number(res.data));
        }

        catch {
            // do nothing
        }
    }, []);

    useEffect(() => {
        if(hasInit.current) return;
        hasInit.current = true;
        getData();
        getCount();
    }, [getData, getCount]);

	return (
		<div className="flex flex-col w-full">
			
            <div 
                className="h-[1px] w-full self-center my-[50px]"
                style={{
                    background: "linear-gradient(90deg, rgba(96, 59, 247, 0) 0.95%, #603BF7 53.37%, rgba(57, 34, 145, 0) 99.35%)"
                }}    
            >

            </div>
			<HistoryTable
				title="Jackpot History"
                histories={histories}
                onLeftClick={onLeftClick}
                onRightClick={onRightClick}
                page={page}
                maxPage={maxPage}
			/>
		</div>
	)
};

export default Page;
