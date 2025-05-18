<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { balanceStore } from '$lib/stores/balance';
	import { chainsStore } from '$lib/stores/chains';
	import { sseStore } from '$lib/stores/sse';
	import { tweened } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import ChainSelector from './ChainSelector.svelte';
	import AddressInput from './AddressInput.svelte';
	import SavedAddresses from './SavedAddresses.svelte';
	import type { BalanceResponse } from '$lib/api';
	import { getBalance } from '$lib/api';
	import { formatIPFSUrl } from '$lib/utils/ipfs';

	// 資產數據狀態
	let assets: {
		name: string;
		value: number;
		change: number;
		icon: string;
		tokenBalance: number;
	}[] = [];
	let totalValue = 0;
	let totalChange = 0;
	let nftCount = 0;

	// 目前選中的區塊鏈和地址
	let currentChain = 'ethereum';
	let currentAddress = '0x55FE002aefF02F77364de339a1292923A15844B8';

	// 數據狀態
	let balanceData: BalanceResponse | null = null;
	let previousBalanceData: BalanceResponse | null = null;
	let isLoading = false;
	let error = '';
	let isAnimating = true;

	// SSE 狀態
	let sseStatus = 'OFFLINE';
	let lastHeartbeat = 0;
	let sseStatusSubscription: () => void;
	let sseCheckInterval: ReturnType<typeof setInterval> | null = null;
	let sseReconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let visibilityChangeHandler: (() => void) | null = null;
	let networkChangeHandler: (() => void) | null = null;

	// 創建 tweened 值用於餘額變化動畫
	const tTotalValue = tweened(0, {
		duration: 1500,
		easing: cubicOut
	});

	// 資產動畫值 - 使用對象來儲存各資產的 tweened 值
	type AssetTweened = {
		[key: string]: {
			value: number;
			tweened: any;
		};
	};
	let tAssetValues: AssetTweened = {};

	/**
	 * 獲取餘額數據
	 */
	async function fetchBalance(chain?: string, address?: string) {
		try {
			isLoading = true;
			error = '';

			// 使用提供的參數或當前值
			const chainToUse = chain || currentChain;
			const addressToUse = address || currentAddress;

			// 檢查地址格式
			if (!addressToUse || !/^0x[a-fA-F0-9]{40}$/.test(addressToUse)) {
				throw new Error('無效的錢包地址格式');
			}

			console.log(`正在獲取鏈 ${chainToUse} 地址 ${addressToUse} 的餘額...`);
			console.log(`請求URL: /api/balances/${chainToUse}/${addressToUse}`);

			// 更新 balanceStore 中的鏈和地址
			balanceStore.setChain(chainToUse);
			balanceStore.setAddress(addressToUse);

			// 通過 balanceStore 獲取數據
			const data = await balanceStore.fetchBalance();

			// 驗證API返回數據
			if (!data) {
				throw new Error('API返回空數據');
			}

			// 記錄返回數據以便調試
			console.log('API返回的原始餘額數據:', JSON.stringify(data));
			console.log(`原生代幣: ${data.nativeBalance.symbol}, 餘額: ${data.nativeBalance.balance}`);
			console.log(`發現 ${data.tokens.length} 個ERC20代幣, ${data.nfts.length} 個NFT`);

			// 保存當前數據為前一個數據（用於動畫）
			// 檢查是否有舊數據，以及是否有值變化
			const shouldAnimate = !!(
				balanceData &&
				data &&
				Math.abs(calculateTotalValue(balanceData) - calculateTotalValue(data)) > 0.01
			);

			console.log('數據變化檢測:', shouldAnimate ? '有變化，啟用動畫' : '無變化或首次加載');

			if (shouldAnimate) {
				previousBalanceData = balanceData;
			}

			// 設置新數據
			balanceData = data;
			isAnimating = shouldAnimate;

			// 清除錯誤
			error = '';

			// 更新UI
			updateBalanceUI(data, shouldAnimate);

			return data;
		} catch (err) {
			error = err instanceof Error ? err.message : '獲取餘額失敗';
			console.error('獲取餘額失敗:', err);

			// 清空資產列表防止顯示舊數據
			assets = [];
			balanceData = null;

			return null;
		} finally {
			isLoading = false;
		}
	}

	/**
	 * 計算資產總值
	 * @param data 餘額數據
	 * @returns 總值
	 */
	function calculateTotalValue(data: BalanceResponse): number {
		if (!data) return 0;
		const nativeValue = data.nativeBalance.usd || 0;
		const tokensValue = data.tokens.reduce((sum, token) => sum + (token.usd || 0), 0);
		return nativeValue + tokensValue;
	}

	/**
	 * 安全地將代幣餘額從字符串轉換為數字
	 * @param balance 餘額字符串
	 * @param decimals 小數位數
	 * @returns 轉換後的數字
	 */
	function safeParseTokenBalance(balance: string, decimals: number): number {
		if (!balance || balance === '0') return 0;

		try {
			// 首先檢查輸入是否有效
			if (typeof balance !== 'string' || balance.trim() === '') {
				console.warn('無效的餘額格式:', balance);
				return 0;
			}

			// 處理科學記數法
			if (balance.includes('e')) {
				const [mantissa, exponent] = balance.split('e');
				const expandedNumber = parseFloat(mantissa) * Math.pow(10, parseInt(exponent));
				return expandedNumber / Math.pow(10, decimals);
			}

			// 優先使用BigInt來處理大數值(如果環境支持)
			if (typeof BigInt !== 'undefined') {
				try {
					// 移除任何前綴的 '0x' 或 非數字字符
					const cleanedBalance = balance.replace(/^0x|[^0-9]/g, '');

					// 如果清理後為空，返回0
					if (!cleanedBalance) return 0;

					const balanceBigInt = BigInt(cleanedBalance);
					const divisorBigInt = BigInt(10 ** decimals);

					// 處理零值情況
					if (balanceBigInt === 0n) return 0;

					const integerPart = balanceBigInt / divisorBigInt;
					const fractionalPart = balanceBigInt % divisorBigInt;

					// 計算小數部分長度 (與小數位數匹配)
					const fractionalPartStr = fractionalPart.toString().padStart(decimals, '0');

					// 構建完整數字字符串
					const fullNumberStr = `${integerPart}.${fractionalPartStr}`;

					// 轉換為浮點數
					return parseFloat(fullNumberStr);
				} catch (e) {
					console.warn('BigInt轉換失敗，回退到浮點數處理:', e, balance);
				}
			}

			// 備用方法：直接使用浮點數處理
			const balanceNum = parseFloat(balance);
			if (isNaN(balanceNum)) {
				console.warn('餘額不是數字:', balance);
				return 0;
			}

			return balanceNum / Math.pow(10, decimals);
		} catch (error) {
			console.error('餘額轉換出錯:', error, { balance, decimals });
			return 0;
		}
	}

	/**
	 * 根據餘額數據更新UI
	 */
	function updateBalanceUI(data: BalanceResponse, animate: boolean) {
		if (!data) {
			console.warn('沒有餘額數據可供處理');
			return;
		}

		console.log('處理餘額數據:', JSON.stringify(data.nativeBalance));
		console.log('強制更新UI，地址:', currentAddress);

		// 記錄原始餘額數值以便調試
		console.log(
			`原始餘額字符串: "${data.nativeBalance.balance}", 小數位: ${data.nativeBalance.decimals}`
		);

		// 處理原生代幣
		const nativeTokenBalance = safeParseTokenBalance(
			data.nativeBalance.balance,
			data.nativeBalance.decimals
		);

		console.log('轉換後的原生代幣餘額:', nativeTokenBalance);

		if (nativeTokenBalance > 0) {
			console.log(`原生代幣餘額 > 0: ${nativeTokenBalance} ${data.nativeBalance.symbol}`);
		} else {
			console.log(`原生代幣餘額為零或未定義`);
		}

		const nativeAsset = {
			name: data.nativeBalance.symbol,
			value: data.nativeBalance.usd || 0,
			tokenBalance: nativeTokenBalance,
			change: 0,
			icon: getIconForToken(data.nativeBalance.symbol)
		};

		// 處理 ERC20 代幣
		const tokenAssets = data.tokens.slice(0, 3).map((token) => {
			const tokenBalance = safeParseTokenBalance(token.balance, token.decimals);
			return {
				name: token.symbol,
				value: token.usd || 0,
				tokenBalance: tokenBalance,
				change: 0,
				icon: getIconForToken(token.symbol)
			};
		});

		// 組合資產列表 - 使用 = 強制重新賦值
		assets = [nativeAsset, ...tokenAssets];
		console.log('更新後的資產列表:', assets);
		console.log('原生代幣金額:', nativeAsset.tokenBalance, nativeAsset.value);

		// 計算總價值（原生代幣 + 所有 ERC20 代幣）
		const newTotalValue =
			data.nativeBalance.usd + data.tokens.reduce((sum, token) => sum + token.usd, 0);

		console.log('計算新總值:', newTotalValue);

		// 如果是加載新數據且啟用動畫
		if (animate && previousBalanceData) {
			// 使用 tweened 進行過渡動畫，並保證動畫持續時間
			console.log(`總值動畫: ${totalValue} -> ${newTotalValue}`);
			tTotalValue.set(newTotalValue, { duration: 1500 });

			// 為每個資產設置動畫
			assets.forEach((asset) => {
				if (!tAssetValues[asset.name]) {
					const assetTweened = tweened(asset.value, {
						duration: 1500,
						easing: cubicOut
					});

					// 儲存資產的當前值和 tweened 對象
					tAssetValues[asset.name] = {
						value: asset.value,
						tweened: assetTweened
					};

					// 建立訂閱以更新值（這個仍然是必要的）
					assetTweened.subscribe((value) => {
						if (tAssetValues[asset.name]) {
							tAssetValues[asset.name].value = value;
						}
					});
				} else {
					// 更新現有 tweened 值
					tAssetValues[asset.name].tweened.set(asset.value);
				}
			});

			// 動畫完成後清除標記
			setTimeout(() => {
				isAnimating = false;
				previousBalanceData = null;
			}, 1500);
		} else {
			// 無動畫時直接設置
			console.log('直接設置新總值(無動畫):', newTotalValue);
			tTotalValue.set(newTotalValue, { duration: 0 });

			// 強制重置所有資產的 tweened 值
			tAssetValues = {};

			assets.forEach((asset) => {
				const assetTweened = tweened(asset.value, { duration: 0 });

				// 儲存資產的當前值和 tweened 對象
				tAssetValues[asset.name] = {
					value: asset.value,
					tweened: assetTweened
				};

				// 建立訂閱以更新值
				assetTweened.subscribe((value) => {
					if (tAssetValues[asset.name]) {
						tAssetValues[asset.name].value = value;
					}
				});
			});
		}

		totalValue = newTotalValue;

		// 獲取 NFT 數量
		nftCount = data.nfts.length;

		// 強制觸發更新
		assets = [...assets];
		setTimeout(() => {
			// 再次強制觸發更新 (確保響應式更新)
			assets = [...assets];
		}, 100);
	}

	/**
	 * 更新區塊鏈
	 */
	function updateChain(chain: string) {
		console.log(`切換鏈至: ${chain}`);

		// 確保鏈ID格式一致 - 處理測試鏈格式
		let chainId = chain;

		// 檢查鏈ID是否包含測試網標識
		const isTestnet = chain.includes('_') || chain.toLowerCase().includes('test');
		if (isTestnet) {
			console.log(`偵測到測試鏈格式: ${chain}`);
		}

		currentChain = chainId;

		// 先清空當前餘額數據，避免顯示錯誤數據
		balanceData = null;
		previousBalanceData = null;
		isAnimating = false;
		assets = []; // 清空資產列表

		// 重置錯誤狀態
		error = '';

		// 獲取該鏈上最後使用的地址
		if (typeof window !== 'undefined') {
			const savedAddresses = localStorage.getItem('savedAddresses');
			if (savedAddresses) {
				try {
					const addresses = JSON.parse(savedAddresses);

					// 嘗試精確匹配
					let addressForChain = addresses.find((a: any) => a.chain === chainId);

					// 如果沒找到，試著用前綴匹配（對測試鏈有幫助）
					if (!addressForChain && isTestnet) {
						// 從測試鏈ID中提取主網ID
						let mainChain = chainId;
						if (chainId.includes('_')) {
							mainChain = chainId.split('_')[0];
						} else if (chainId.toLowerCase().includes('testnet')) {
							// 處理帶有testnet字樣的鏈ID
							mainChain = chainId.toLowerCase().replace('testnet', '').trim();
						} else if (chainId.toLowerCase().includes('test')) {
							// 處理帶有test字樣的鏈ID
							mainChain = chainId.toLowerCase().replace('test', '').trim();
						}

						console.log(`嘗試使用主網 ${mainChain} 的地址`);
						addressForChain = addresses.find(
							(a: any) => a.chain === mainChain || a.chain.startsWith(mainChain + '_')
						);
					}

					if (addressForChain) {
						currentAddress = addressForChain.address;
						console.log(`找到該鏈儲存的地址: ${currentAddress}`);
					} else {
						console.log(`沒有找到${chainId}的已保存地址，使用當前地址: ${currentAddress}`);
					}
				} catch (err) {
					console.error('解析保存的地址失敗:', err);
				}
			}
		}

		// 更新 URL 參數
		updateUrlParams();

		// 延遲一下再獲取餘額，確保UI已更新
		setTimeout(() => {
			// 標記為加載中
			isLoading = true;

			// 更新 balanceStore 中的鏈和地址
			balanceStore.setChain(chainId);
			balanceStore.setAddress(currentAddress);

			// 重新獲取餘額
			console.log(`正在重新獲取 ${chainId} 鏈上 ${currentAddress} 的餘額...`);
			balanceStore
				.fetchBalance()
				.then((data) => {
					// balanceStore 訂閱會處理數據更新
					isLoading = false;
				})
				.catch((err) => {
					error = err instanceof Error ? err.message : '獲取餘額失敗';
					isLoading = false;
				});
		}, 100);
	}

	/**
	 * 手動刷新餘額
	 */
	function refreshBalance() {
		console.log(`手動刷新餘額: 鏈=${currentChain}, 地址=${currentAddress}`);
		// 標記為加載中
		isLoading = true;
		// 清除錯誤
		error = '';

		// 添加按鈕旋轉動畫
		const refreshBtn = document.querySelector('.refresh-btn');
		if (refreshBtn) {
			refreshBtn.classList.add('spinning');
		}

		// 延遲一下再獲取餘額，確保UI已更新
		setTimeout(() => {
			// 使用 balanceStore 獲取餘額，這樣 SSE 更新時能自動同步
			balanceStore.setChain(currentChain);
			balanceStore.setAddress(currentAddress);
			balanceStore
				.fetchBalance()
				.then((data) => {
					// 因為已經訂閱了 balanceStore，這裡不需要重複處理數據
					isLoading = false;
				})
				.catch((err) => {
					error = err instanceof Error ? err.message : '獲取餘額失敗';
					isLoading = false;
				})
				.finally(() => {
					// 移除旋轉效果
					if (refreshBtn) {
						setTimeout(() => {
							refreshBtn.classList.remove('spinning');
						}, 500);
					}
				});
		}, 100);
	}

	/**
	 * 更新地址
	 */
	function updateAddress(address: string) {
		// 檢查地址是否真的變更
		if (currentAddress === address) {
			console.log('地址未變更，不執行操作');
			return;
		}

		console.log(`開始更新地址: 從 ${currentAddress} 到 ${address}`);
		currentAddress = address;

		// 清空狀態，強制刷新
		balanceData = null;
		previousBalanceData = null;
		isAnimating = false;
		tAssetValues = {}; // 強制重置所有 tweened 值
		assets = []; // 清空資產列表
		totalValue = 0; // 重置總值
		tTotalValue.set(0, { duration: 0 }); // 重置總值動畫

		// 標記為加載中
		isLoading = true;
		// 清除錯誤
		error = '';

		// 更新 URL 參數
		updateUrlParams();

		// 更新 balanceStore 中的地址
		balanceStore.setAddress(address);

		// 重新獲取餘額
		console.log(`正在獲取 ${currentChain} 鏈上新地址 ${address} 的餘額...`);
		balanceStore
			.fetchBalance()
			.then((data) => {
				// 手動更新 UI，確保立即刷新
				if (data) {
					console.log('成功獲取新地址的餘額數據，手動更新 UI');
					balanceData = data;
					updateBalanceUI(data, false);
				}
				isLoading = false;
			})
			.catch((err) => {
				error = err instanceof Error ? err.message : '獲取餘額失敗';
				isLoading = false;
			});
	}

	// 根據代幣符號返回圖標
	function getIconForToken(symbol: string): string {
		const icons: Record<string, string> = {
			ETH: '⟠',
			BTC: '₿',
			SOL: '◎',
			MATIC: '⬡',
			USDT: '₮',
			USDC: '₵'
		};

		return icons[symbol] || '🪙';
	}

	// 連接 SSE
	function connectSSE() {
		if (typeof window === 'undefined') return;

		console.log('正在連接 SSE...');

		// 訂閱 SSE 狀態
		sseStatusSubscription = sseStore.subscribe((state) => {
			sseStatus = state.status;
			lastHeartbeat = state.lastHeartbeat;
			console.log(`SSE 狀態變更: ${state.status}`);

			// 當 SSE 連接完成，如果已經有餘額數據，更新狀態 UI
			if (state.status === 'ONLINE' && balanceData && currentChain && currentAddress) {
				console.log('SSE 連接成功，已有餘額數據');
			}

			// 如果收到 SSE 緩存失效事件，balanceStore 會自動更新
			// 這裡可以設置監聽器來監聽 balanceStore 的變化

			// 如果發生錯誤，顯示在 UI 上並嘗試重連
			if (state.status === 'ERROR' && state.lastError) {
				console.error(`SSE 連接錯誤: ${state.lastError}`);

				// 只有在當前沒有顯示 OFFLINE 狀態的錯誤時才更新 ERROR 狀態
				if (!error.includes('已離線')) {
					error = `SSE 連接錯誤: ${state.lastError}`; // 更新UI錯誤狀態
				}

				// 不要自動清除錯誤訊息，讓它保持直到下一個狀態變更
				// 移除清除定時器的邏輯

				// 移除額外的重連定時器，讓 sse.ts 中的重試邏輯處理
				if (sseReconnectTimer) {
					console.log('取消額外的 SSE 重連定時器');
					clearTimeout(sseReconnectTimer);
					sseReconnectTimer = null;
				}
			}

			// 如果已經離線（達到最大重試次數），顯示特殊信息
			if (state.status === 'OFFLINE') {
				console.warn('SSE 連接已離線（達到最大重試次數）');
				error = 'SSE 連接已離線，請點擊重新連接按鈕手動重試';

				// 如果設置了自動重連定時器，取消它
				if (sseReconnectTimer) {
					clearTimeout(sseReconnectTimer);
					sseReconnectTimer = null;
				}
			}

			// 如果連接成功，取消重連定時器
			if (state.status === 'ONLINE' && sseReconnectTimer) {
				console.log('SSE 連接成功，取消重連定時器');
				clearTimeout(sseReconnectTimer);
				sseReconnectTimer = null;
				error = ''; // 清除錯誤消息
			}

			// 如果開始連接中，清除錯誤訊息，但保留離線狀態訊息
			if (state.status === 'CONNECTING' && error && !error.includes('已離線')) {
				error = '';
			}
		});

		// 訂閱 balanceStore 變化
		balanceStore.subscribe((state) => {
			// 如果 balanceStore 中的數據更新了，則更新組件數據
			if (state.data) {
				// 添加調試日誌以檢查地址信息
				console.log(`balanceStore 更新，地址: ${state.address}, 當前組件地址: ${currentAddress}`);

				// 檢查是否有舊數據，以及值是否有實質變化
				const hasChange = !!(
					balanceData &&
					Math.abs(calculateTotalValue(state.data) - calculateTotalValue(balanceData)) > 0.01
				);
				const isNewData = !balanceData;
				// 檢查地址是否變更 - 新增這個條件
				const isAddressChanged = state.address !== currentAddress;

				// 添加更多日誌
				console.log('數據變更檢查: ', {
					isNewData,
					hasChange,
					isAddressChanged,
					oldTotal: balanceData ? calculateTotalValue(balanceData) : 0,
					newTotal: calculateTotalValue(state.data)
				});

				if (isNewData || hasChange || isAddressChanged) {
					console.log('檢測到 balanceStore 數據更新，自動同步餘額數據');
					console.log(
						'數據變化原因:',
						isNewData ? '首次加載' : hasChange ? '金額變化' : '地址變更'
					);

					// 如果是地址變更，強制重置
					if (isAddressChanged) {
						console.log('強制重置所有狀態，因為地址已變更');
						previousBalanceData = null;
						tAssetValues = {}; // 強制重置所有 tweened 值
						assets = []; // 清空資產列表
						totalValue = 0; // 重置總值
						tTotalValue.set(0, { duration: 0 }); // 重置總值動畫
					} else if (hasChange) {
						previousBalanceData = balanceData;
					}

					balanceData = state.data;
					// 注意：不要在訂閱回調中修改 currentAddress，因為這可能導致循環更新
					// 相反，我們會在 UI 更新函數中使用最新的 state.address
					updateBalanceUI(state.data, hasChange && !isAddressChanged); // 只有在金額實際變化且非地址變更時才啟用動畫
				}
			}
		});

		// 啟動 SSE 連接
		sseStore.connect();

		// 添加頁面可見性變更監聽器
		if (typeof document !== 'undefined') {
			visibilityChangeHandler = () => {
				if (document.visibilityState === 'visible') {
					// 當頁面變為可見時，檢查並重連 SSE
					console.log('頁面變為可見，檢查 SSE 連接狀態');
					if (sseStatus !== 'ONLINE' && sseStatus !== 'CONNECTING') {
						console.log('頁面變為可見，重新連接 SSE');
						// 使用 reconnect 方法而非 connect，以重置重試計數
						sseStore.reconnect();
					} else {
						console.log('SSE 已連接或正在連接中');
					}
				}
			};

			document.addEventListener('visibilitychange', visibilityChangeHandler);
		}

		// 添加網絡狀態變更監聽器
		if (typeof window !== 'undefined') {
			networkChangeHandler = () => {
				// 當網絡恢復時，嘗試重連 SSE
				if (navigator.onLine) {
					console.log('網絡連接恢復，檢查 SSE 連接狀態');
					if (sseStatus !== 'ONLINE' && sseStatus !== 'CONNECTING') {
						console.log('網絡恢復，重新連接 SSE');
						// 使用 reconnect 方法而非 connect，以重置重試計數
						sseStore.reconnect();
					}
				} else {
					console.log('網絡連接斷開');
					// 網絡斷開時，不需要主動斷開 SSE，讓它自己處理錯誤
				}
			};

			window.addEventListener('online', networkChangeHandler);
			window.addEventListener('offline', networkChangeHandler);
		}
	}

	/**
	 * 斷開 SSE 連接
	 */
	function disconnectSSE() {
		console.log('斷開 SSE 連接');

		// 取消訂閱
		if (sseStatusSubscription) {
			sseStatusSubscription();
		}

		// 斷開連接
		sseStore.disconnect();

		// 更新狀態
		sseStatus = 'OFFLINE';
		lastHeartbeat = 0;

		// 清除心跳檢查定時器
		if (sseCheckInterval) {
			clearInterval(sseCheckInterval);
			sseCheckInterval = null;
		}

		// 清除重連定時器
		if (sseReconnectTimer) {
			clearTimeout(sseReconnectTimer);
			sseReconnectTimer = null;
		}

		// 移除頁面可見性變更監聽器
		if (typeof document !== 'undefined' && visibilityChangeHandler) {
			document.removeEventListener('visibilitychange', visibilityChangeHandler);
			visibilityChangeHandler = null;
		}

		// 移除網絡狀態變更監聽器
		if (typeof window !== 'undefined' && networkChangeHandler) {
			window.removeEventListener('online', networkChangeHandler);
			window.removeEventListener('offline', networkChangeHandler);
			networkChangeHandler = null;
		}
	}

	onMount(() => {
		// 檢查 URL 參數
		if (typeof window !== 'undefined') {
			const urlParams = new URLSearchParams(window.location.search);
			const chainParam = urlParams.get('chain');
			const addressParam = urlParams.get('address');

			console.log('URL 參數檢查:', { chainParam, addressParam });

			// 如果有有效的地址參數
			if (addressParam && /^0x[a-fA-F0-9]{40}$/.test(addressParam)) {
				console.log(`使用 URL 指定的地址: ${addressParam}`);
				currentAddress = addressParam;
			}

			// 如果有鏈參數
			if (chainParam) {
				// 處理可能的鏈 ID 映射 (例如 eth -> ethereum)
				let chainId = chainParam.toLowerCase();
				if (chainId === 'eth') chainId = 'ethereum';
				if (chainId === 'bsc') chainId = 'binance';
				if (chainId === 'avax') chainId = 'avalanche';

				console.log(`使用 URL 指定的鏈: ${chainId}`);
				currentChain = chainId;
			}
		}

		// 加載資產數據
		// 首次加載時直接調用 balanceStore.fetchBalance
		console.log('初始化加載餘額數據');
		isLoading = true;
		balanceStore.setChain(currentChain);
		balanceStore.setAddress(currentAddress);
		balanceStore
			.fetchBalance()
			.then(() => {
				// 數據會通過訂閱處理
				isLoading = false;
			})
			.catch((err) => {
				error = err instanceof Error ? err.message : '獲取餘額失敗';
				isLoading = false;
			});

		// 連接 SSE
		connectSSE();

		setTimeout(() => {
			isAnimating = false;
		}, 1500);

		// 確保在瀏覽器環境中執行
		if (typeof window !== 'undefined') {
			// 監聽來自ChainSelector的事件
			window.addEventListener('chainChanged', ((e: CustomEvent) => {
				updateChain(e.detail.chain);
				// 更新 URL 參數但不刷新頁面
				updateUrlParams();
			}) as EventListener);

			// 監聽來自AddressInput的事件
			window.addEventListener('addressChanged', ((e: CustomEvent) => {
				updateAddress(e.detail.address);
				// 更新 URL 參數但不刷新頁面
				updateUrlParams();
			}) as EventListener);
		}
	});

	onDestroy(() => {
		// 斷開 SSE 連接
		disconnectSSE();

		// 移除事件監聽
		if (typeof window !== 'undefined') {
			window.removeEventListener('chainChanged', (() => {}) as EventListener);
			window.removeEventListener('addressChanged', (() => {}) as EventListener);
		}
	});

	// 3D 網格效果參數
	let mouseX = 0;
	let mouseY = 0;
	let windowX = 0;
	let windowY = 0;

	function handleMouseMove(e: MouseEvent) {
		// 計算相對位置 -1 到 1 之間
		mouseX = (e.clientX / windowX - 0.5) * 2;
		mouseY = (e.clientY / windowY - 0.5) * 2;
	}

	onMount(() => {
		if (typeof window !== 'undefined') {
			windowX = window.innerWidth;
			windowY = window.innerHeight;

			window.addEventListener('resize', () => {
				windowX = window.innerWidth;
				windowY = window.innerHeight;
			});
		}
	});

	// 更新時間
	let currentTime = new Date().toLocaleTimeString();

	function updateTime() {
		currentTime = new Date().toLocaleTimeString();
	}

	setInterval(updateTime, 1000);

	// 獲取 SSE 狀態文字
	$: systemStatus = isLoading
		? 'LOADING'
		: error
			? 'ERROR'
			: sseStatus === 'ERROR'
				? 'ERROR'
				: sseStatus === 'CONNECTING'
					? 'CONNECTING'
					: sseStatus === 'ONLINE'
						? 'ONLINE'
						: 'OFFLINE';

	// 添加心跳時間格式化
	$: heartbeatTime = lastHeartbeat > 0 ? new Date(lastHeartbeat).toLocaleTimeString() : '無';

	// 格式化顯示代幣餘額
	function formatTokenBalance(balance: number, symbol: string): string {
		if (balance === 0) {
			return `0 ${symbol}`;
		}

		// 處理極小值
		if (balance > 0 && balance < 0.000001) {
			return `${balance.toExponential(4)} ${symbol}`;
		}

		// 根據數值大小動態調整小數位數
		let decimals = 6; // 默認小數位

		if (balance >= 1000) {
			// 大數值使用較少小數位
			decimals = 2;
		} else if (balance >= 1) {
			// 中等數值使用4位小數
			decimals = 4;
		} else if (balance < 0.001) {
			// 非常小的值使用8位小數
			decimals = 8;
		}

		// 去除尾部多餘的0
		const formatted = balance.toFixed(decimals).replace(/\.?0+$/, '');

		// 如果小數點後全是0，則去除小數點
		const finalFormatted = formatted.endsWith('.') ? formatted.slice(0, -1) : formatted;

		return `${finalFormatted} ${symbol}`;
	}

	// 格式化金額為簡短形式（如 1.2M, 4.5B 等）
	function formatShortCurrency(value: number): string {
		if (value === 0) return '$0.00';

		const absValue = Math.abs(value);

		if (absValue >= 1_000_000_000) {
			return '$' + (value / 1_000_000_000).toFixed(1) + 'B';
		} else if (absValue >= 1_000_000) {
			return '$' + (value / 1_000_000).toFixed(1) + 'M';
		} else if (absValue >= 1_000) {
			return '$' + (value / 1_000).toFixed(1) + 'k';
		} else {
			return '$' + value.toFixed(2);
		}
	}

	// 判斷是否使用簡短金額顯示
	function shouldUseShortFormat(value: number): boolean {
		return value >= 1_000_000; // 百萬以上使用簡短格式
	}

	// 更新 URL 參數
	function updateUrlParams() {
		if (typeof window !== 'undefined') {
			const url = new URL(window.location.href);
			url.searchParams.set('chain', currentChain);
			url.searchParams.set('address', currentAddress);
			window.history.replaceState(null, '', url.toString());
		}
	}
</script>

<svelte:window on:mousemove={handleMouseMove} />

<div class="fixed h-full w-full overflow-auto bg-[#0a0c15] p-4 sm:p-8" style="perspective: 1000px;">
	<div class="vhs-scanlines absolute z-10 h-full w-full"></div>
	<div
		class="grid-floor perspective-effect absolute z-0 h-full w-full"
		style="transform: rotateX({45 + mouseY * 5}deg) rotateY({mouseX * 5}deg) translateZ(-10px);"
	></div>

	<!-- 主標題區 -->
	<div class="relative z-20 mb-12 py-8 text-center">
		<div class="relative inline-block">
			<h1 class="relative mb-4 text-4xl font-bold tracking-wider sm:text-6xl">
				<span
					class="font-display drop-shadow-glow bg-gradient-to-r from-[var(--vwave-pink)] to-[var(--vwave-cyan)] bg-clip-text text-transparent transition-all duration-300 hover:scale-105 hover:drop-shadow-[0_0_20px_rgba(255,113,206,0.7)]"
				>
					ONEKEY BALANCE
				</span>
			</h1>
			<div class="cyberpunk-line"></div>
		</div>
		<div class="mt-2 flex flex-wrap items-center justify-center gap-3 text-lg">
			<span class="font-['MS_Gothic',monospace] text-[#fffb96]">STATUS:</span>
			<span
				class="online-tag"
				class:text-[#05ffa1]={systemStatus === 'ONLINE'}
				class:text-[#ff71ce]={systemStatus === 'ERROR'}
				class:text-[#fffb96]={systemStatus === 'CONNECTING' || systemStatus === 'LOADING'}
				class:text-[#808080]={systemStatus === 'OFFLINE'}
			>
				{systemStatus}
				{#if systemStatus === 'ERROR' && error}
					({error})
				{/if}
			</span>
			{#if lastHeartbeat > 0}
				<span class="heart-icon text-[#05ffa1]">♥</span>
				<span class="font-['MS_Gothic',monospace] text-xs text-[#fffb96]">{heartbeatTime}</span>
			{/if}
		</div>
	</div>

	<!-- 選擇區塊鏈與地址 -->
	<div
		class="chain-selector-panel pulse-glow-pink relative z-20 mx-auto mb-8 max-w-screen-lg overflow-hidden rounded-3xl bg-black/40 backdrop-blur"
	>
		<div class="panel-glow"></div>
		<div class="relative p-6 sm:p-8">
			<div class="mb-6 flex flex-wrap items-center justify-between gap-4">
				<h2 class="glow-text font-['Bodoni_Moda',serif] text-xl text-[#ff71ce]">
					選擇區塊鏈與地址
				</h2>
				<ChainSelector {currentChain} on:chainChange={(e) => updateChain(e.detail.chain)} />
			</div>

			<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<div>
					<AddressInput
						{currentAddress}
						{currentChain}
						on:addressChange={(e) => updateAddress(e.detail.address)}
						on:suggestSaved={() => {
							// 簡化處理已保存地址的提示
							const savedAddressesContainer = document.querySelector('.saved-list');
							if (savedAddressesContainer) {
								savedAddressesContainer.classList.add('highlight-pulse');
								setTimeout(() => {
									savedAddressesContainer.classList.remove('highlight-pulse');
								}, 2000);
							}
						}}
						on:saveAddress={(e) => {
							// 調用SavedAddresses組件中的saveAddress方法
							const { chain, address, label } = e.detail;
							const savedAddresses = document.querySelector('div.saved-addresses');

							// 保存地址到localStorage
							if (typeof window !== 'undefined') {
								try {
									// 獲取當前保存的地址列表
									const savedData = localStorage.getItem('savedAddresses');
									const addresses = savedData ? JSON.parse(savedData) : [];

									// 檢查是否已存在
									const exists = addresses.some(
										(addr: any) => addr.chain === chain && addr.address === address
									);

									if (!exists) {
										// 添加新地址
										addresses.push({ chain, address, label });
										// 保存回localStorage
										localStorage.setItem('savedAddresses', JSON.stringify(addresses));

										// 刷新頁面或發出事件通知SavedAddresses組件重新載入
										window.dispatchEvent(new CustomEvent('addressesSaved'));

										// 顯示成功提示
										const notification = document.createElement('div');
										notification.className =
											'fixed top-4 right-4 bg-[#05ffa1]/20 text-[#05ffa1] p-4 rounded-lg z-50 animate-fadeIn';
										notification.textContent = `地址${label ? ` "${label}" ` : ''}已成功保存!`;
										document.body.appendChild(notification);

										// 3秒後移除提示
										setTimeout(() => {
											notification.classList.add('animate-fadeOut');
											setTimeout(() => notification.remove(), 500);
										}, 3000);
									} else {
										// 如果地址已存在但需要更新標籤
										const addrIndex = addresses.findIndex(
											(addr: any) => addr.chain === chain && addr.address === address
										);

										if (addrIndex !== -1 && addresses[addrIndex].label !== label) {
											// 更新標籤
											addresses[addrIndex].label = label;
											// 保存回localStorage
											localStorage.setItem('savedAddresses', JSON.stringify(addresses));
											// 通知更新
											window.dispatchEvent(new CustomEvent('addressesSaved'));

											// 顯示更新提示
											const notification = document.createElement('div');
											notification.className =
												'fixed top-4 right-4 bg-[#01cdfe]/20 text-[#01cdfe] p-4 rounded-lg z-50 animate-fadeIn';
											notification.textContent = `地址標籤已更新為 "${label || '無標籤'}"`;
											document.body.appendChild(notification);

											// 3秒後移除提示
											setTimeout(() => {
												notification.classList.add('animate-fadeOut');
												setTimeout(() => notification.remove(), 500);
											}, 3000);
										}
									}
								} catch (err) {
									console.error('保存地址失敗:', err);

									// 顯示錯誤提示
									const notification = document.createElement('div');
									notification.className =
										'fixed top-4 right-4 bg-[#ff71ce]/20 text-[#ff71ce] p-4 rounded-lg z-50';
									notification.textContent = '保存地址失敗，請稍後重試';
									document.body.appendChild(notification);

									// 3秒後移除提示
									setTimeout(() => notification.remove(), 3000);
								}
							}
						}}
					/>
				</div>
				<div>
					<SavedAddresses
						{currentChain}
						{currentAddress}
						on:addressSelect={(e) => updateAddress(e.detail.address)}
					/>
				</div>
			</div>
		</div>
	</div>

	<!-- 主卡片 -->
	<div
		class="main-panel pulse-glow-cyan relative z-20 mx-auto mb-8 max-w-screen-lg overflow-hidden rounded-3xl bg-black/40 backdrop-blur"
	>
		<div class="panel-glow"></div>
		<div class="relative p-6 sm:p-8">
			<div class="mb-6 flex items-center justify-between">
				<h2 class="glow-text font-['Bodoni_Moda',serif] text-[#05ffa1]">資產總覽</h2>
				<div class="flex items-center gap-4">
					<button
						class="refresh-btn rounded-full bg-[#05ffa1]/20 p-2 text-[#05ffa1] transition-all hover:bg-[#05ffa1]/30"
						on:click={refreshBalance}
						title="刷新餘額"
						disabled={isLoading}
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38" />
						</svg>
					</button>

					<!-- SSE 連接重連按鈕 -->
					{#if sseStatus === 'ERROR' || sseStatus === 'CLOSED'}
						<button
							class="reconnect-btn rounded-full bg-[#ff71ce]/20 p-2 text-[#ff71ce] transition-all hover:bg-[#ff71ce]/30"
							on:click={() => {
								console.log('手動重新連接 SSE');
								// 先斷開舊連接
								disconnectSSE();
								// 延遲一下再重新連接，確保斷開完成
								setTimeout(() => {
									connectSSE();
								}, 500);
							}}
							title="重新連接 SSE"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path d="M2.5 2v6h6M21.5 22v-6h-6M12 7A5 5 0 0 1 17 12M12 17A5 5 0 0 1 7 12" />
							</svg>
						</button>
					{/if}

					<div class="wallet-address font-['MS_Gothic',monospace] text-xs text-[#fffb96]">
						{currentAddress.slice(0, 6)}...{currentAddress.slice(-4)}
						<span class="hidden">{Math.random()}</span>
					</div>
					<div class="digital-time font-['MS_Gothic',monospace]">{currentTime}</div>
				</div>
			</div>

			<div class="bg-gradient relative mb-8 overflow-hidden rounded-2xl p-4">
				<div class="absolute inset-[1px] z-0 rounded-2xl bg-black/80"></div>
				<div
					class="relative z-10 flex items-baseline justify-between text-3xl font-bold text-white sm:text-5xl"
				>
					<span class="glow-text text-[#05ffa1]">
						${$tTotalValue.toLocaleString(undefined, {
							minimumFractionDigits: 2,
							maximumFractionDigits: 2
						})}
					</span>
					<span class="change-indicator {totalChange >= 0 ? 'positive' : 'negative'}">
						{totalChange >= 0 ? '+' : ''}{totalChange}%
					</span>
				</div>
			</div>

			{#if isLoading}
				<div class="py-8 text-center">
					<div class="loading-spinner mb-4"></div>
					<p class="text-[#fffb96]">正在載入資產資料...</p>
				</div>
			{:else if error}
				<div class="py-8 text-center text-[#ff71ce]">
					<p>載入失敗: {error}</p>
				</div>
			{:else}
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{#each assets as asset, i}
						{@const valueLength = tAssetValues[asset.name]
							? tAssetValues[asset.name].value.toLocaleString().length
							: asset.value.toLocaleString().length}
						{@const isLongNumber = valueLength > 10}
						<div
							class="asset-card delay-card-{i + 1} {isAnimating ? 'fade-up' : ''} 
							hover-glow relative flex items-center gap-4 overflow-hidden rounded-2xl border border-white/10 bg-black/80 p-4 backdrop-blur-sm"
							class:long-number-card={isLongNumber}
						>
							<div class="asset-icon" class:asset-icon-large={isLongNumber}>{asset.icon}</div>
							<div class="flex-1">
								<div class="font-['MS_Gothic',monospace] text-sm text-[#fffb96]">{asset.name}</div>
								<div class="price-highlight text-lg font-bold" class:text-base={isLongNumber}>
									{#if shouldUseShortFormat(tAssetValues[asset.name]?.value || asset.value)}
										{formatShortCurrency(tAssetValues[asset.name]?.value || asset.value)}
									{:else}
										${tAssetValues[asset.name]
											? tAssetValues[asset.name].value.toLocaleString(undefined, {
													minimumFractionDigits: 2,
													maximumFractionDigits: 2
												})
											: asset.value.toLocaleString(undefined, {
													minimumFractionDigits: 2,
													maximumFractionDigits: 2
												})}
									{/if}
								</div>
								<div class="mt-1 flex items-center justify-between">
									<span class="text-xs text-white/80">
										{formatTokenBalance(asset.tokenBalance, asset.name)}
									</span>
									<span class="text-xs {asset.change >= 0 ? 'positive' : 'negative'}">
										{asset.change >= 0 ? '+' : ''}{asset.change}%
									</span>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- 次要區域 -->
	<div class="mx-auto grid max-w-screen-lg grid-cols-1 gap-8 sm:grid-cols-2">
		<!-- NFT 展示區 -->
		<div
			class="nft-panel secondary-panel pulse-glow-yellow relative z-20 overflow-hidden rounded-3xl bg-black/40 backdrop-blur"
		>
			<div class="panel-glow"></div>
			<div class="relative p-6 sm:p-8">
				<h2 class="glow-text font-['Bodoni_Moda',serif] text-[#fffb96]">NFT 收藏</h2>
				<div class="mt-2 mb-4 flex items-baseline gap-2">
					<span class="font-['MS_Gothic',monospace] text-3xl text-[#fffb96]">{nftCount}</span>
					<span class="font-body text-white">件藏品</span>
				</div>
				{#if balanceData?.nfts && balanceData.nfts.length > 0}
					<div class="grid grid-cols-2 gap-3">
						{#each balanceData.nfts.slice(0, 4) as nft, i}
							<div
								class="nft-item hover-glow"
								style="background-image: url({formatIPFSUrl(nft.image) || ''})"
							>
								{#if !nft.image}
									<div class="nft-placeholder-text">{nft.name || `NFT #${nft.tokenId}`}</div>
								{/if}
							</div>
						{/each}
					</div>
				{:else}
					<div class="grid grid-cols-2 gap-3">
						<div class="nft-placeholder hover-glow"></div>
						<div class="nft-placeholder hover-glow"></div>
						<div class="nft-placeholder hover-glow"></div>
						<div class="nft-placeholder hover-glow"></div>
					</div>
				{/if}
			</div>
		</div>

		<!-- 資產分佈 -->
		<div
			class="assets-panel secondary-panel pulse-glow-mint relative z-20 overflow-hidden rounded-3xl bg-black/40 backdrop-blur"
		>
			<div class="panel-glow"></div>
			<div class="relative p-6 sm:p-8">
				<h2 class="glow-text font-['Bodoni_Moda',serif] text-[#01cdfe]">資產分佈</h2>
				<div class="mt-4 space-y-3">
					{#if balanceData}
						<div
							class="token-stats hover-glow flex items-center gap-4 rounded-xl border border-white/20 bg-black/80 p-3 transition-all hover:translate-x-1 hover:border-[#05ffa1]"
						>
							<div class="token-type native">原生</div>
							<div class="flex-1">
								<div class="font-bold">
									<span class="glow-text text-[#fffb96]">{balanceData.nativeBalance.symbol}:</span>
									<span class="price-highlight"
										>${balanceData.nativeBalance.usd.toLocaleString(undefined, {
											minimumFractionDigits: 2,
											maximumFractionDigits: 2
										})}</span
									>
								</div>
								<div class="mt-1 text-xs text-[#fffb96]">
									{formatTokenBalance(
										safeParseTokenBalance(
											balanceData.nativeBalance.balance,
											balanceData.nativeBalance.decimals
										),
										balanceData.nativeBalance.symbol
									)}
									<span class="hidden">{Math.random()}</span>
								</div>
							</div>
						</div>
						<div
							class="token-stats hover-glow flex items-center gap-4 rounded-xl border border-white/20 bg-black/80 p-3 transition-all hover:translate-x-1 hover:border-[#05ffa1]"
						>
							<div class="token-type erc20">代幣</div>
							<div class="flex-1">
								<div class="font-bold text-[#fffb96]">
									代幣數量: <span class="glow-text text-white">{balanceData.tokens.length}</span>
								</div>
								<div class="mt-1 text-xs text-[#fffb96]">
									總值: <span class="price-highlight"
										>${balanceData.tokens
											.reduce((sum, token) => sum + token.usd, 0)
											.toLocaleString(undefined, {
												minimumFractionDigits: 2,
												maximumFractionDigits: 2
											})}</span
									>
								</div>
							</div>
						</div>
					{:else}
						<div
							class="transaction-item hover-glow flex items-center gap-4 rounded-xl border border-white/10 bg-black/30 p-3 transition-all hover:translate-x-1 hover:border-[#05ffa1]"
						>
							<div class="transaction-type send">發送</div>
							<div class="flex-1">
								<div class="font-bold text-white">0.25 ETH</div>
								<div class="mt-1 text-xs text-white/60">2小時前</div>
							</div>
						</div>
						<div
							class="transaction-item hover-glow flex items-center gap-4 rounded-xl border border-white/10 bg-black/30 p-3 transition-all hover:translate-x-1 hover:border-[#05ffa1]"
						>
							<div class="transaction-type receive">接收</div>
							<div class="flex-1">
								<div class="font-bold text-white">500 USDT</div>
								<div class="mt-1 text-xs text-white/60">昨天</div>
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	/* 現有樣式保持不變 */

	/* SSE 狀態樣式 */
	.text-\[\#05ffa1\] {
		text-shadow: 0 0 5px #05ffa1;
	}

	.text-\[\#ff71ce\] {
		text-shadow: 0 0 5px #ff71ce;
	}

	.text-\[\#fffb96\] {
		text-shadow: 0 0 5px #fffb96;
	}

	.text-\[\#808080\] {
		text-shadow: 0 0 5px #808080;
	}

	/* 心跳動畫 */
	.heart-icon {
		display: inline-block;
		text-shadow: 0 0 8px #05ffa1;
		animation: heartbeat 1.5s infinite ease-in-out;
	}

	@keyframes heartbeat {
		0% {
			transform: scale(1);
			opacity: 0.8;
		}
		25% {
			transform: scale(1.2);
			opacity: 1;
		}
		50% {
			transform: scale(1);
			opacity: 0.8;
		}
		75% {
			transform: scale(1.2);
			opacity: 1;
		}
		100% {
			transform: scale(1);
			opacity: 0.8;
		}
	}

	/* 添加刷新按鈕的動畫效果 */
	.refresh-btn {
		transition: transform 0.3s ease;
	}

	.refresh-btn.spinning {
		animation: spin 1s linear infinite;
	}

	/* 重連按鈕的脈動效果 */
	.reconnect-btn {
		animation: pulse 2s infinite;
	}

	@keyframes pulse {
		0% {
			box-shadow: 0 0 0 0 rgba(255, 113, 206, 0.4);
		}
		70% {
			box-shadow: 0 0 0 10px rgba(255, 113, 206, 0);
		}
		100% {
			box-shadow: 0 0 0 0 rgba(255, 113, 206, 0);
		}
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	/* 長數字資產卡片樣式 */
	.asset-icon {
		min-width: 30px;
		text-align: center;
		font-size: 20px;
	}

	.asset-icon-large {
		min-width: 40px;
		font-size: 22px;
	}

	.long-number-card {
		padding-left: 12px;
		padding-right: 12px;
	}
</style>
