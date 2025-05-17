import { writable } from 'svelte/store';
import type { BalanceResponse } from '$lib/api';
import { getBalance } from '$lib/api';

// 定義 store 的類型
export interface BalanceStore {
	chain: string;
	address: string;
	data: BalanceResponse | null;
	isLoading: boolean;
	error: string;
}

// 創建初始狀態
const initialState: BalanceStore = {
	chain: 'ethereum',
	address: '0xfcdc012650ec6125722cba6a1036554c7c0c4090',
	data: null,
	isLoading: false,
	error: ''
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
			update((state) => ({
				...state,
				chain: chain || state.chain,
				address: address || state.address,
				isLoading: true,
				error: ''
			}));

			// 從 store 中獲取當前鏈和地址
			let currentState: BalanceStore;
			subscribe((state) => {
				currentState = state;
			})();

			try {
				// 驗證地址格式
				if (!currentState.address || !/^0x[a-fA-F0-9]{40}$/.test(currentState.address)) {
					throw new Error('無效的錢包地址格式');
				}

				// 獲取餘額數據
				const data = await getBalance(currentState.chain, currentState.address, options);
				update((state) => ({ ...state, data, isLoading: false }));
				return data;
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : '獲取餘額失敗';
				update((state) => ({ ...state, error: errorMessage, isLoading: false }));
				throw err;
			}
		}
	};
}

// 導出 balance store 實例
export const balanceStore = createBalanceStore();
