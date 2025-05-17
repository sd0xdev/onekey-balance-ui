import { writable } from 'svelte/store';
import type { BalanceResponse } from '$lib/api';
import { getBalance } from '$lib/api';

// 定義 store 的類型
export interface BalanceStore {
	chain: string;
	address: string;
	data: BalanceResponse | null;
	previousData: BalanceResponse | null; // 新增: 保存前一次的餘額數據用於動畫
	isLoading: boolean;
	error: string;
	isAnimating: boolean; // 新增: 標記是否正在進行餘額變化動畫
}

// 創建初始狀態
const initialState: BalanceStore = {
	chain: 'ethereum',
	address: '0xfcdc012650ec6125722cba6a1036554c7c0c4090',
	data: null,
	previousData: null,
	isLoading: false,
	error: '',
	isAnimating: false
};

// 創建 balance store
function createBalanceStore() {
	const { subscribe, set, update } = writable<BalanceStore>(initialState);

	return {
		subscribe,
		// 設置鏈
		setChain: (chain: string) => update((state) => ({ ...state, chain })),
		// 設置地址
		setAddress: (address: string) => update((state) => ({ ...state, address })),
		// 重置 store
		reset: () => set(initialState),
		// 獲取餘額
		fetchBalance: async (chain?: string, address?: string, options?: { fetch?: typeof fetch }) => {
			// 使用參數中的鏈和地址，或使用 store 中的值
			let currentState: BalanceStore | undefined;

			// 先獲取當前狀態
			subscribe((state) => {
				currentState = state;
			})();

			if (!currentState) {
				throw new Error('無法獲取當前狀態');
			}

			// 更新狀態為加載中
			update((state) => ({
				...state,
				chain: chain || state.chain,
				address: address || state.address,
				isLoading: true,
				error: ''
			}));

			try {
				// 驗證地址格式
				if (!currentState.address || !/^0x[a-fA-F0-9]{40}$/.test(currentState.address)) {
					throw new Error('無效的錢包地址格式');
				}

				// 使用最新獲取的狀態中的鏈和地址
				const chainToUse = chain || currentState.chain;
				const addressToUse = address || currentState.address;

				// 獲取餘額數據
				const data = await getBalance(chainToUse, addressToUse, options);

				// 如果有舊數據且新餘額與舊餘額不同，則設置動畫標記
				update((state) => {
					const shouldAnimate = !!(
						state.data &&
						data &&
						JSON.stringify(state.data) !== JSON.stringify(data)
					);

					return {
						...state,
						previousData: shouldAnimate ? state.data : null,
						data,
						isLoading: false,
						isAnimating: shouldAnimate
					};
				});

				return data;
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : '獲取餘額失敗';
				update((state) => ({ ...state, error: errorMessage, isLoading: false }));
				throw err;
			}
		},
		// 標記動畫完成
		setAnimationComplete: () => {
			update((state) => ({
				...state,
				isAnimating: false,
				previousData: null
			}));
		}
	};
}

// 導出 balance store 實例
export const balanceStore = createBalanceStore();
