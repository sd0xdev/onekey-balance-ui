// 定義 API 響應類型
export interface NativeBalance {
	symbol: string;
	decimals: number;
	balance: string;
	usd: number;
}

export interface Token {
	symbol: string;
	name: string;
	address: string;
	balance: string;
	decimals: number;
	usd: number;
	logo?: string;
}

export interface NFT {
	address: string;
	tokenId: string;
	name: string;
	symbol: string;
	image: string;
	balance: string;
	floorPrice?: number;
}

export interface BalanceResponse {
	nativeBalance: NativeBalance;
	tokens: Token[];
	nfts: NFT[];
	updatedAt: number;
}

// 定義區塊鏈的資料結構
export interface Chain {
	id: number;
	name: string;
	type: string;
	isTestnet: boolean;
	mainnetRef?: string;
	supportedSymbols: string[];
}

export interface ChainsResponse {
	chains: Chain[];
}

/**
 * 獲取所有可用的區塊鏈列表
 * @param includeTestnet 是否包含測試網絡
 * @param options 可選配置，可以包含 fetch 函數
 * @returns 包含所有支援區塊鏈的資訊
 */
export async function getChains(
	includeTestnet?: boolean,
	options?: { fetch?: typeof fetch }
): Promise<ChainsResponse> {
	try {
		const fetchFn = options?.fetch || fetch;
		const url = includeTestnet ? `/api/chains?include_testnet=true` : `/api/chains`;

		const response = await fetchFn(url, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json'
			}
		});

		if (!response.ok) {
			throw new Error(`API 請求失敗: ${response.status} ${response.statusText}`);
		}

		return (await response.json()) as ChainsResponse;
	} catch (error) {
		console.error('獲取區塊鏈列表時出錯:', error);
		throw error;
	}
}

/**
 * 獲取指定地址在特定鏈上的餘額
 * @param chain 區塊鏈標識符，例如：ethereum, polygon, bsc 等
 * @param address 要查詢的錢包地址
 * @param options 可選配置，可以包含 fetch 函數
 * @returns 包含代幣餘額和 NFT 等資訊的錢包資產組合
 */
export async function getBalance(
	chain: string,
	address: string,
	options?: { fetch?: typeof fetch }
): Promise<BalanceResponse> {
	try {
		// 使用提供的 fetch 或全局 fetch
		const fetchFn = options?.fetch || fetch;

		// 使用 fetch API 發送請求
		// 注意: 根據 vite.config.ts 的配置，/api 前綴會被代理到 API_BASE 並重寫路徑
		const response = await fetchFn(`/api/balances/${chain}/${address}`, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json'
			}
		});

		if (!response.ok) {
			throw new Error(`API 請求失敗: ${response.status} ${response.statusText}`);
		}

		return (await response.json()) as BalanceResponse;
	} catch (error) {
		console.error('獲取餘額時出錯:', error);
		throw error;
	}
}
