import { writable, get } from 'svelte/store';
import type { Chain, ChainsResponse } from '$lib/api';
import { getChains } from '$lib/api';
import { balanceStore } from './balance';

export interface UserAddress {
	chain: string;
	address: string;
	label?: string;
}

export interface ChainsStore {
	chains: Chain[];
	selectedChain: string;
	addresses: UserAddress[];
	currentAddress: string;
	isLoading: boolean;
	error: string;
}

// 初始狀態
const initialState: ChainsStore = {
	chains: [],
	selectedChain: 'ethereum', // 預設選擇以太坊
	addresses: [
		{
			chain: 'ethereum',
			address: '0xfcdc012650ec6125722cba6a1036554c7c0c4090',
			label: '預設帳戶'
		}
	],
	currentAddress: '0xfcdc012650ec6125722cba6a1036554c7c0c4090',
	isLoading: false,
	error: ''
};

// 創建 chains store
function createChainsStore() {
	const { subscribe, set, update } = writable<ChainsStore>(initialState);

	return {
		subscribe,
		// 獲取區塊鏈列表
		fetchChains: async (includeTestnet?: boolean, options?: { fetch?: typeof fetch }) => {
			update((state) => ({ ...state, isLoading: true, error: '' }));

			try {
				const response = await getChains(includeTestnet, options);
				update((state) => ({ ...state, chains: response.chains, isLoading: false }));
				return response.chains;
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : '獲取區塊鏈列表失敗';
				update((state) => ({ ...state, error: errorMessage, isLoading: false }));
				throw err;
			}
		},

		// 選擇區塊鏈
		selectChain: (chainId: string) => {
			update((state) => ({ ...state, selectedChain: chainId }));

			// 更新 balance store 中的鏈
			balanceStore.setChain(chainId);

			// 找出該鏈上最後使用的地址
			const state = get({ subscribe });
			const addressForChain = state.addresses.find((a) => a.chain === chainId);

			if (addressForChain) {
				// 更新當前地址
				update((state) => ({ ...state, currentAddress: addressForChain.address }));
				// 更新 balance store 中的地址
				balanceStore.setAddress(addressForChain.address);
			}

			// 刷新餘額資訊
			balanceStore.fetchBalance();
		},

		// 添加/更新地址
		updateAddress: (address: UserAddress) => {
			update((state) => {
				// 檢查是否已有此鏈的地址
				const existingIndex = state.addresses.findIndex((a) => a.chain === address.chain);

				if (existingIndex !== -1) {
					// 如果已存在，更新它
					const updatedAddresses = [...state.addresses];
					updatedAddresses[existingIndex] = address;
					return { ...state, addresses: updatedAddresses };
				} else {
					// 如果不存在，添加它
					return { ...state, addresses: [...state.addresses, address] };
				}
			});
		},

		// 設置當前地址
		setCurrentAddress: (address: string) => {
			update((state) => ({ ...state, currentAddress: address }));

			// 更新 balance store 中的地址
			balanceStore.setAddress(address);

			// 刷新餘額資訊
			balanceStore.fetchBalance();
		},

		// 刪除地址
		removeAddress: (chain: string, address: string) => {
			update((state) => {
				// 過濾掉要刪除的地址
				const updatedAddresses = state.addresses.filter(
					(a) => !(a.chain === chain && a.address === address)
				);
				return { ...state, addresses: updatedAddresses };
			});
		},

		// 重置
		reset: () => set(initialState)
	};
}

// 導出 chains store 實例
export const chainsStore = createChainsStore();
