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

		// 檢查並清理參數
		if (!chain) {
			throw new Error('區塊鏈標識符不能為空');
		}

		if (!address) {
			throw new Error('錢包地址不能為空');
		}

		// 移除地址前後空格
		const cleanAddress = address.trim();

		// 驗證錢包地址格式 (必須是0x開頭的40個16進制字符)
		if (!/^0x[a-fA-F0-9]{40}$/.test(cleanAddress)) {
			throw new Error('無效的錢包地址格式');
		}

		// 檢查是否為測試鏈
		const isTestnet = chain.includes('_') || chain.toLowerCase().includes('test');

		console.log(
			`getBalance 調用 - 鏈:${chain} ${isTestnet ? '(測試鏈)' : ''}, 地址:${cleanAddress}`
		);

		// 建構API URL
		const apiUrl = `/api/balances/${chain}/${cleanAddress}`;
		console.log(`請求API: ${apiUrl}`);

		// 使用 fetch API 發送請求
		const response = await fetchFn(apiUrl, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json'
			}
		});

		if (!response.ok) {
			console.error(`API 請求失敗: ${response.status} ${response.statusText}`);
			throw new Error(`API 請求失敗: ${response.status} ${response.statusText}`);
		}

		const data = (await response.json()) as BalanceResponse;
		console.log(
			`API 返回資料摘要: 原生代幣=${data.nativeBalance.symbol}, 餘額=${data.nativeBalance.balance}, 代幣數量=${data.tokens.length}, NFT數量=${data.nfts.length}`
		);

		// 檢查餘額是否有效並進行數據清理
		if (data.nativeBalance) {
			// 確保餘額是有效的字符串格式
			if (
				typeof data.nativeBalance.balance === 'string' &&
				data.nativeBalance.balance.trim() !== ''
			) {
				console.log(
					`原生代幣餘額有效: ${data.nativeBalance.balance} (${data.nativeBalance.symbol})`
				);
			} else {
				console.warn('API 返回的原生代幣餘額無效或為空');
				// 設置默認值
				data.nativeBalance.balance = '0';
			}

			// 確保小數位數有效
			if (typeof data.nativeBalance.decimals !== 'number' || data.nativeBalance.decimals < 0) {
				console.warn(`無效的小數位數，設置為默認值: ${data.nativeBalance.symbol} -> 18`);
				data.nativeBalance.decimals = 18; // 使用以太坊標準小數位
			}
		} else {
			// 如果缺少原生代幣數據，創建一個默認對象
			data.nativeBalance = {
				symbol: chain.toUpperCase(),
				decimals: 18,
				balance: '0',
				usd: 0
			};
		}

		// 確保代幣數組存在
		if (!Array.isArray(data.tokens)) {
			console.warn('API 返回的代幣數組無效，設置為空數組');
			data.tokens = [];
		}

		// 確保 NFT 數組存在
		if (!Array.isArray(data.nfts)) {
			console.warn('API 返回的 NFT 數組無效，設置為空數組');
			data.nfts = [];
		}

		// 添加更新時間戳（如果不存在）
		if (!data.updatedAt) {
			data.updatedAt = Date.now();
		}

		return data;
	} catch (error) {
		console.error('獲取餘額時出錯:', error);
		throw error;
	}
}
